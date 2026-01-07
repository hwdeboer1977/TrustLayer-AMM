// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/TrustLayerHook.sol";

// Anvil:
// 1. set -a; source .env.anvil; set +a
// 2. forge script script/Check_status.s.sol --rpc-url http://127.0.0.1:8545 -vvvv --via-ir

contract CheckStatusScript is Script {
    function run() external view {
        address hook = vm.envAddress("HOOK_ADDRESS");
        address trader = vm.envAddress("TRADER_ADDRESS");

        TrustLayerHook trustHook = TrustLayerHook(hook);

        console2.log("=== Hook Info ===");
        console2.log("Hook address:", hook);
        console2.log("Admin:", trustHook.admin());
        console2.log("Relayer:", trustHook.relayer());
        console2.log("");

        console2.log("=== Tier Configurations ===");
        for (uint8 i = 0; i <= 3; i++) {
            TrustLayerHook.TierConfig memory config = trustHook.getTierConfig(i);
            console2.log("--- Tier", uint256(i), "---");
            console2.log("  Fee (bps):", uint256(config.feeBps));
            console2.log("  Max Trade Size:", config.maxTradeSize);
            console2.log("  Enabled:", config.enabled);
        }
        console2.log("");

        console2.log("=== Trader Info ===");
        console2.log("Trader address:", trader);
        
        TrustLayerHook.TraderInfo memory info = trustHook.getTraderInfo(trader);
        console2.log("  Tier:", uint256(info.tier));
        console2.log("  Registered at block:", info.registeredAt);
        console2.log("  Expiry block:", info.expiry);
        console2.log("  Commitment:", vm.toString(info.commitment));
        console2.log("");

        // Check if trader can swap various amounts
        console2.log("=== Can Swap Check ===");
        uint256[] memory amounts = new uint256[](4);
        amounts[0] = 1_000e18;      // 1k
        amounts[1] = 10_000e18;     // 10k
        amounts[2] = 100_000e18;    // 100k
        amounts[3] = 1_000_000e18;  // 1M

        for (uint256 i = 0; i < amounts.length; i++) {
            (bool canSwap, string memory reason) = trustHook.canSwap(trader, amounts[i]);
            console2.log("  Amount:", amounts[i] / 1e18, "tokens");
            console2.log("    Can swap:", canSwap);
            console2.log("    Reason:", reason);
        }
        console2.log("");

        // Preview fee
        console2.log("=== Fee Preview ===");
        uint24 fee = trustHook.previewFee(trader);
        console2.log("  Fee for trader (bps):", uint256(fee));
    }
}
