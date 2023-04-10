// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {L2StandardERC20} from "@eth-optimism/contracts/standards/L2StandardERC20.sol";
import {IL2ECO} from "../interfaces/token/IL2ECO.sol";

/**
 * @title L2ECO
 */
contract L2ECO is L2StandardERC20, IL2ECO {
    constructor(
    ) L2StandardERC20(msg.sender, msg.sender, "Optimism ECO", "OP-ECO") {}

    function initialize(address _l2Bridge, address _initialPauser) public {}

    function rebase(uint256 _inflationMultiplier) external virtual {}
}
