// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import {L2StandardERC20} from "@eth-optimism/contracts/standards/L2StandardERC20.sol";

/**
 * @title L2ECO
 */
contract L2ECO is L2StandardERC20 {
    constructor(address _l2Bridge, address _l1Token)
        L2StandardERC20(_l2Bridge, _l1Token, "Optimism ECO", "OP-ECO")
    {}
}
