// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Script, console} from "forge-std/Script.sol";
import {MockStablecoin} from "../src/MockStablecoin.sol";
import {AgreementEscrow} from "../src/AgreementEscrow.sol";

contract Deploy is Script {
    function run() external {
        uint256 privateKey = vm.envOr("PRIVATE_KEY", uint256(0));
        address deployer = privateKey == 0 ? msg.sender : vm.addr(privateKey);

        if (privateKey == 0) {
            vm.startBroadcast();
        } else {
            vm.startBroadcast(privateKey);
        }
        MockStablecoin token = new MockStablecoin();
        AgreementEscrow escrow = new AgreementEscrow();
        token.mint(deployer, 1_000_000e6);
        vm.stopBroadcast();

        console.log("MockStablecoin:", address(token));
        console.log("AgreementEscrow:", address(escrow));
        console.log("Deployer:", deployer);
    }
}
