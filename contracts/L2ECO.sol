// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import {ERC20Pausable} from "@helix-foundation/currency/contracts/currency/ERC20Pausable.sol";
import {DelegatePermit} from "@helix-foundation/currency/contracts/currency/DelegatePermit.sol";

/**
 * @title L2ECO
 */
contract L2ECO is ERC20Pausable, DelegatePermit {
    constructor(
        address _l2Bridge,
        address _l1Token,
        address admin,
        address _initialPauser
    ) ERC20Pausable("Optimism ECO", "OP-ECO", admin, _initialPauser) {}
}
