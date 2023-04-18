// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {console} from "hardhat/console.sol";

import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract TokenInitial {
    uint256 public constant INITIAL_INFLATION_MULTIPLIER = 1e18;

    function initialize() public {
        // empty
    }
}
