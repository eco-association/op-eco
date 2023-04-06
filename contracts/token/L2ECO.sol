// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {L2StandardERC20} from "@eth-optimism/contracts/standards/L2StandardERC20.sol";
import {IL2ECO} from "../interfaces/token/IL2ECO.sol";

/**
 * @title L2ECO
 */
contract L2ECO is L2StandardERC20, IL2ECO {
    constructor(address _l2Bridge, address _l1Token)
        L2StandardERC20(_l2Bridge, _l1Token, "Optimism ECO", "OP-ECO")
    {}

    function rebase(uint256 _inflationMultiplier) external virtual {}
}
