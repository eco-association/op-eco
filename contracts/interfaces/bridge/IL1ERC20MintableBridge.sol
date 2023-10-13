// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IL1ERC20Bridge} from "@eth-optimism/contracts/L1/messaging/IL1ERC20Bridge.sol";

/**
 * @title IL1ERC20MintableBridge
 */
interface IL1ERC20MintableBridge is IL1ERC20Bridge {
    // Event for when the L2ERC20 token implementation is upgraded
    event UpgradeL2ERC20(address _newERC20Impl);

    // Event for when the L2Bridge token implementation is upgraded
    event UpgradeL2Bridge(address _newBridgeImpl);

    // Event for when this contract's token implementation is upgraded
    event UpgradeSelf(address _newBridgeImpl);

    // Event for when failed withdrawal needs to be u-turned
    event WithdrawalFailed(
        address indexed _l1Token,
        address indexed _l2Token,
        address indexed _from,
        address _to,
        uint256 _amount,
        bytes _data
    );

    // /**
    //  * @param _l1messenger L1 Messenger address being used for cross-chain communications.
    //  * @param _l2TokenBridge L2 token bridge address.
    //  * @param _l1Token address of L1 token contract.
    //  * @param _l2Token address of L2 token contract.
    //  * @param _l1ProxyAdmin address of ProxyAdmin contract for the L1 Bridge.
    //  * @param _upgrader address that can perform upgrades.
    //  */
    // function _initialize(
    //     address _l1messenger,
    //     address _l2TokenBridge,
    //     address _l1Token,
    //     address _l2Token,
    //     address _l1ProxyAdmin,
    //     address _upgrader
    // ) internal;

    /**
     * @dev Upgrades the L2ERC20 token implementation address by sending
     *      a cross domain message to the L2 Bridge via the L1 Messenger
     * @param _impl L2 contract address.
     * @param _l2Gas Gas limit for the L2 message.
     */
    function upgradeToken(address _impl, uint32 _l2Gas) external;

    /**
     * @dev Upgrades the L2ERC20Bridge implementation address by sending
     *      a cross domain message to the L2ERC20Bridge via the L1 Messenger
     * @param _impl L2 contract address.
     * @param _l2Gas Gas limit for the L2 message.
     */
    function upgradeL2Bridge(address _impl, uint32 _l2Gas) external;

    /**
     * @dev Upgrades this contract implementation by passing the new implementation address to the ProxyAdmin.
     * @param _newBridgeImpl The new L1ERC20Bridge implementation address.
     */
    function upgradeSelf(address _newBridgeImpl) external;
}
