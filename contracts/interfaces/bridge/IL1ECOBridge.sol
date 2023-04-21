// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IL1ERC20Bridge} from "@eth-optimism/contracts/L1/messaging/IL1ERC20Bridge.sol";

/**
 * @title IL1ECOBridge
 */
interface IL1ECOBridge is IL1ERC20Bridge {
    // Event for when the L2ECO token implementation is upgraded
    event UpgradeL2ECO(address _newEcoImpl);

    // Event for when the L2ECOBridge authority is transferred to a new bridge address
    event UpgradeSelf(address _newBridgeImpl);

    /**
     * @dev Upgrades the L2ECO token implementation address, by sending
     *      a cross domain message to the L2 Bridge via the L1 Messenger
     * @param _impl L2 contract address.
     * @param _l2Gas Gas limit for the L2 message.
     */
    function upgradeECO(address _impl, uint32 _l2Gas) external;

    /**
     * @dev Upgrades this contract implementation by passing the new implementation address to the ProxyAdmin.
     * @param _newBridgeImpl The new L1ECOBridge implementation address.
     */
    function upgradeSelf(address _newBridgeImpl) external;
}
