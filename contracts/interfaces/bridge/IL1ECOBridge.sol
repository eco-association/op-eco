// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IL1ERC20Bridge} from "@eth-optimism/contracts/L1/messaging/IL1ERC20Bridge.sol";

/**
 * @title IL1ECOBridge
 */
interface IL1ECOBridge is IL1ERC20Bridge {

    function upgradeECO(address _impl, uint32 l2Gas) external;

    function rebase(uint32 _l2Gas) external;

}
