// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IL2ERC20Bridge} from "@eth-optimism/contracts/L2/messaging/IL2ERC20Bridge.sol";

/**
 * @title IL2ECOBridge
 */
interface IL2ECOBridge is IL2ERC20Bridge {
    // Event for when the inflation multiplier is set in the rebase function
    event RebaseInitiated(uint256 _inflationMultiplier);

    // Event for when the L2ECO token proxy is upgraded
    event UpgradeECOInitiated(address _newEco);

    /**
     * @dev Passes the inflation multiplier to the L2Eco token.
     * @param _inflationMultiplier The inflation multiplier to rebase the
     */
    function rebase(uint256 _inflationMultiplier) external;

    /**
     * @dev Sets the L2ECO token proxy to a new implementation address for the L2ECO token.
     * @param _newEco The address of the new L2ECO token implementation
     */
    function upgradeECO(address _newEco) external;
}
