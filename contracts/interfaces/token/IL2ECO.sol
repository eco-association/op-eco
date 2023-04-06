// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IL2StandardERC20} from "@eth-optimism/contracts/standards/IL2StandardERC20.sol";

interface IL2ECO is IL2StandardERC20 {
    /**
     * @dev Applies a rebase to the token, scaling the total supply and the balances of all holders
     * @param _inflationMultiplier The inflation multiplier to rebase the L2Eco token with.
     */
    function rebase(uint256 _inflationMultiplier) external;
}
