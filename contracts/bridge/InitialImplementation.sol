// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

// This bridge exists for being the initial target of the proxy before we have all the addresses to initialize fully
contract InitialImplementation {

    // this function is for compliance with OZ proxy framework
    function initialize() public {
        // empty
    }
}
