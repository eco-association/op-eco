// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IL1ERC20MintableBridge} from "./IL1ERC20MintableBridge.sol";

/**
 * @title IL1ECOBridge
 */
interface IL1ECOBridge is IL1ERC20MintableBridge {
    /**
     * @dev initiates the propagation of a linear rebase from L1 to L2
     * @param _l2Gas Gas limit for the L2 message.
     */
    function rebase(uint32 _l2Gas) external;
}
