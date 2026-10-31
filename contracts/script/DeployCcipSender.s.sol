// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Script, console} from "forge-std/Script.sol";
import {CcipAuditSender} from "../src/CcipAuditMirror.sol";

contract DeployCcipSender is Script {
    function run() external {
        address router = vm.envAddress("CCIP_ROUTER");
        address link = vm.envAddress("CCIP_LINK");
        uint64 destinationSelector = uint64(vm.envUint("CCIP_DESTINATION_CHAIN_SELECTOR"));
        address receiver = vm.envAddress("CCIP_RECEIVER");
        uint256 privateKey = vm.envOr("PRIVATE_KEY", uint256(0));

        if (privateKey == 0) {
            vm.startBroadcast();
        } else {
            vm.startBroadcast(privateKey);
        }
        CcipAuditSender sender =
            new CcipAuditSender(router, link, destinationSelector, receiver);
        vm.stopBroadcast();

        console.log("CcipAuditSender:", address(sender));
    }
}
