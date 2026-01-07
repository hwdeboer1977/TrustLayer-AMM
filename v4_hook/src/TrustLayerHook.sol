// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {SwapParams} from "v4-core/src/types/PoolOperation.sol";

/// @title TrustLayerHook
/// @notice Uniswap V4 Hook that enforces tiered trading access based on ZK credentials
/// @dev Integrates with Aleo ZK credential system via off-chain relayer
contract TrustLayerHook is BaseHook {
    using LPFeeLibrary for uint24;
    using PoolIdLibrary for PoolKey;

    // ============ STRUCTS ============

    struct TierConfig {
        uint24 feeBps;          // Fee in basis points (e.g., 3000 = 0.3%)
        uint256 maxTradeSize;   // Max trade size in token units
        bool enabled;           // Is this tier enabled
    }

    struct TraderInfo {
        uint8 tier;             // 0 = unregistered, 1 = Basic, 2 = Pro, 3 = Whale
        uint256 registeredAt;   // Block number when registered
        uint256 expiry;         // Block number when credential expires
        bytes32 commitment;     // Aleo credential commitment
    }

    // ============ STATE ============

    // Admin
    address public admin;
    address public relayer;     // Trusted relayer that verifies Aleo proofs

    // Tier configurations
    mapping(uint8 => TierConfig) public tierConfigs;

    // Trader registry: address => TraderInfo
    mapping(address => TraderInfo) public traders;

    // Pool whitelist (optional): poolId => enabled
    mapping(PoolId => bool) public whitelistedPools;
    bool public requirePoolWhitelist;

    // ============ EVENTS ============

    event TraderRegistered(
        address indexed trader,
        uint8 tier,
        bytes32 commitment,
        uint256 expiry
    );
    event TraderRevoked(address indexed trader, bytes32 commitment);
    event TierConfigUpdated(uint8 tier, uint24 feeBps, uint256 maxTradeSize);
    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);
    event PoolWhitelisted(PoolId indexed poolId, bool enabled);

    // ============ ERRORS ============

    error NotAdmin();
    error NotRelayer();
    error MustUseDynamicFee();
    error TraderNotRegistered();
    error TierNotEnabled();
    error CredentialExpired();
    error TradeTooLarge(uint256 requested, uint256 maxAllowed);
    error PoolNotWhitelisted();
    error InvalidTier();

    // ============ MODIFIERS ============

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyRelayer() {
        if (msg.sender != relayer) revert NotRelayer();
        _;
    }

    // ============ CONSTRUCTOR ============

    constructor(IPoolManager _poolManager, address _relayer) BaseHook(_poolManager) {
        admin = msg.sender;
        relayer = _relayer;

        // Initialize default tier configs
        // Tier 0: Unregistered - no access
        tierConfigs[0] = TierConfig({
            feeBps: 0,
            maxTradeSize: 0,
            enabled: false
        });

        // Tier 1: Basic (score 600-699)
        tierConfigs[1] = TierConfig({
            feeBps: 5000,           // 0.5% fee
            maxTradeSize: 10_000e18, // 10k tokens
            enabled: true
        });

        // Tier 2: Pro (score 700-799)
        tierConfigs[2] = TierConfig({
            feeBps: 3000,           // 0.3% fee
            maxTradeSize: 100_000e18, // 100k tokens
            enabled: true
        });

        // Tier 3: Whale (score 800+)
        tierConfigs[3] = TierConfig({
            feeBps: 1000,           // 0.1% fee
            maxTradeSize: 1_000_000e18, // 1M tokens
            enabled: true
        });
    }

    // ============ HOOK PERMISSIONS ============

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
            afterInitialize: false,
            beforeAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterAddLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ============ HOOK CALLBACKS ============

    function _beforeInitialize(address, PoolKey calldata key, uint160)
        internal
        override
        returns (bytes4)
    {
        // Require dynamic fee flag for tier-based fees
        if (!key.fee.isDynamicFee()) revert MustUseDynamicFee();
        return this.beforeInitialize.selector;
    }

    function _beforeSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata
    ) internal override returns (bytes4, BeforeSwapDelta, uint24) {
        // Check pool whitelist if enabled
        if (requirePoolWhitelist) {
            if (!whitelistedPools[key.toId()]) revert PoolNotWhitelisted();
        }

        // Get trader info (use tx.origin to get actual trader, not router)
        TraderInfo memory trader = traders[tx.origin];

        // Check if registered
        if (trader.tier == 0) revert TraderNotRegistered();

        // Check if tier is enabled
        TierConfig memory config = tierConfigs[trader.tier];
        if (!config.enabled) revert TierNotEnabled();

        // Check if credential expired
        if (block.number > trader.expiry) revert CredentialExpired();

        // Check trade size
        uint256 tradeSize = params.amountSpecified < 0
            ? uint256(-params.amountSpecified)
            : uint256(params.amountSpecified);

        if (tradeSize > config.maxTradeSize) {
            revert TradeTooLarge(tradeSize, config.maxTradeSize);
        }

        // Return tier-based fee
        uint24 feeWithFlag = config.feeBps | LPFeeLibrary.OVERRIDE_FEE_FLAG;

        return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, feeWithFlag);
    }

    // ============ RELAYER FUNCTIONS ============

    /// @notice Register a trader after verifying their Aleo ZK proof
    /// @param trader The Ethereum address of the trader
    /// @param tier The tier (1=Basic, 2=Pro, 3=Whale)
    /// @param commitment The Aleo credential commitment hash
    /// @param expiry Block number when credential expires
    function registerTrader(
        address trader,
        uint8 tier,
        bytes32 commitment,
        uint256 expiry
    ) external onlyRelayer {
        if (tier == 0 || tier > 3) revert InvalidTier();

        traders[trader] = TraderInfo({
            tier: tier,
            registeredAt: block.number,
            expiry: expiry,
            commitment: commitment
        });

        emit TraderRegistered(trader, tier, commitment, expiry);
    }

    /// @notice Revoke a trader's access (e.g., credential revoked on Aleo)
    /// @param trader The Ethereum address of the trader
    function revokeTrader(address trader) external onlyRelayer {
        bytes32 commitment = traders[trader].commitment;
        delete traders[trader];
        emit TraderRevoked(trader, commitment);
    }

    /// @notice Batch register multiple traders
    function batchRegisterTraders(
        address[] calldata traderAddresses,
        uint8[] calldata tiers,
        bytes32[] calldata commitments,
        uint256[] calldata expiries
    ) external onlyRelayer {
        require(
            traderAddresses.length == tiers.length &&
            tiers.length == commitments.length &&
            commitments.length == expiries.length,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < traderAddresses.length; i++) {
            if (tiers[i] == 0 || tiers[i] > 3) revert InvalidTier();
            
            traders[traderAddresses[i]] = TraderInfo({
                tier: tiers[i],
                registeredAt: block.number,
                expiry: expiries[i],
                commitment: commitments[i]
            });

            emit TraderRegistered(traderAddresses[i], tiers[i], commitments[i], expiries[i]);
        }
    }

    // ============ ADMIN FUNCTIONS ============

    /// @notice Update tier configuration
    function setTierConfig(
        uint8 tier,
        uint24 feeBps,
        uint256 maxTradeSize,
        bool enabled
    ) external onlyAdmin {
        tierConfigs[tier] = TierConfig({
            feeBps: feeBps,
            maxTradeSize: maxTradeSize,
            enabled: enabled
        });
        emit TierConfigUpdated(tier, feeBps, maxTradeSize);
    }

    /// @notice Update relayer address
    function setRelayer(address newRelayer) external onlyAdmin {
        emit RelayerUpdated(relayer, newRelayer);
        relayer = newRelayer;
    }

    /// @notice Transfer admin role
    function setAdmin(address newAdmin) external onlyAdmin {
        admin = newAdmin;
    }

    /// @notice Whitelist or remove a pool
    function setPoolWhitelist(PoolId poolId, bool enabled) external onlyAdmin {
        whitelistedPools[poolId] = enabled;
        emit PoolWhitelisted(poolId, enabled);
    }

    /// @notice Enable/disable pool whitelist requirement
    function setRequirePoolWhitelist(bool required) external onlyAdmin {
        requirePoolWhitelist = required;
    }

    // ============ VIEW FUNCTIONS ============

    /// @notice Get trader info
    function getTraderInfo(address trader) external view returns (TraderInfo memory) {
        return traders[trader];
    }

    /// @notice Get tier config
    function getTierConfig(uint8 tier) external view returns (TierConfig memory) {
        return tierConfigs[tier];
    }

    /// @notice Check if trader can swap
    function canSwap(address trader, uint256 tradeSize) external view returns (bool, string memory) {
        TraderInfo memory info = traders[trader];
        
        if (info.tier == 0) return (false, "Not registered");
        
        TierConfig memory config = tierConfigs[info.tier];
        
        if (!config.enabled) return (false, "Tier disabled");
        if (block.number > info.expiry) return (false, "Credential expired");
        if (tradeSize > config.maxTradeSize) return (false, "Trade too large");
        
        return (true, "OK");
    }

    /// @notice Preview fee for a trader
    function previewFee(address trader) external view returns (uint24) {
        TraderInfo memory info = traders[trader];
        if (info.tier == 0) return 0;
        return tierConfigs[info.tier].feeBps;
    }
}
