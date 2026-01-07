// script/RegisterTrader.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/TrustLayerHook.sol";

// Anvil:
// 1. set -a; source .env.anvil; set +a
// 2. forge script script/04_RegisterTrader.s.sol --rpc-url http://127.0.0.1:8545 --broadcast -vvvv --via-ir

contract RegisterTraderScript is Script {
    function run() external {
        uint256 pk = uint256(vm.envBytes32("PRIVATE_KEY"));
        address hook = vm.envAddress("HOOK_ADDRESS");
        address trader = vm.envAddress("TRADER_ADDRESS");

        console2.log("Current relayer:", TrustLayerHook(hook).relayer());
        
        
        vm.startBroadcast(pk);

        TrustLayerHook(hook).registerTrader(
            trader,
            2,                          // Tier B (Pro)
            bytes32(uint256(12345)),    // Mock commitment
            block.number + 1000000      // Expiry
        );
        
        vm.stopBroadcast();
        
        console2.log("Registered trader:", trader);
        console2.log("Tier:", uint256(2));

    }
}