// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Script, console} from "forge-std/Script.sol";
import {CcipAuditReceiver} from "../src/CcipAuditMirror.sol";

contract DeployCcipReceiver is Script {
    function run() external {
        address router = vm.envAddress("CCIP_ROUTER");
        uint64 sourceSelector = uint64(vm.envUint("CCIP_SOURCE_CHAIN_SELECTOR"));
        address sourceSender = vm.envAddress("CCIP_SOURCE_SENDER");
        uint256 privateKey = vm.envOr("PRIVATE_KEY", uint256(0));

        if (privateKey == 0) {
            vm.startBroadcast();
        } else {
            vm.startBroadcast(privateKey);
        }
        CcipAuditReceiver receiver =
            new CcipAuditReceiver(router, sourceSelector, sourceSender);
        vm.stopBroadcast();

        console.log("CcipAuditReceiver:", address(receiver));
    }
}
