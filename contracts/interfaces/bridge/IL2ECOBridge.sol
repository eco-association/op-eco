// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IL2ERC20Bridge} from "@eth-optimism/contracts/L2/messaging/IL2ERC20Bridge.sol";

/**
 * @title IL2ECOBridge
 */
interface IL2ECOBridge is IL2ERC20Bridge {
    // Event for when the inflation multiplier is set in the rebase function
    event RebaseInitiated(uint256 _inflationMultiplier);

    // Event for when the L2ECO token implementation is upgraded
    event UpgradeECOImplementation(address _newEcoImpl);

    // Event for when the L2ECOBridge authority is transferred to a new bridge address
    event UpgradeSelf(address _newBridgeImpl);

    /**
     * @dev Passes the inflation multiplier to the L2Eco token.
     * @param _inflationMultiplier The inflation multiplier to rebase the
     */
    function rebase(uint256 _inflationMultiplier) external;

    /**
     * @dev Sets the L2ECO token proxy to a new implementation address for the L2ECO token.
     * @param _newEcoImpl The address of the new L2ECO token implementation
     */
    function upgradeECO(address _newEcoImpl) external;

    /**
     * @dev Upgrades this contract implementation by passing the new implementation address to the ProxyAdmin.
     * @param _newBridgeImpl The new L2ECOBridge implementation address.
     */
    function upgradeSelf(address _newBridgeImpl) external;
}
