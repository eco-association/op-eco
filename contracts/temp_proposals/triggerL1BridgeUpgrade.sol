// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@helix-foundation/currency/contracts/policy/Policy.sol";
import "@helix-foundation/currency/contracts/policy/Policed.sol";
import "@helix-foundation/currency/contracts/governance/community/proposals/Proposal.sol";
import "../bridge/L1ECOBridge.sol";

/** @title Upgrade L2Bridge or L2ECO
 * A proposal to trigger the upgrade cycle on the L2
 */
contract TriggerL1BridgeUpgrade is Policy, Proposal {
    // The address to be targeted by the proposal
    L1ECOBridge public immutable l1Bridge;

    // The L1 address for the new implementation
    address public immutable l1Impl;

    /** Instantiate a new proposal.
     *
     * @param _l1Bridge The address of the L1 Bridge
     * @param _l1Impl The address on L2 of the new implementation contract
     */
    constructor(
        address _l1Bridge,
        address _l1Impl
    ) {
        l1Bridge = L1ECOBridge(_l1Bridge);
        l1Impl = _l1Impl;
    }

    /** The name of the proposal.
     */
    function name() public pure override returns (string memory) {
        return "A proposal to trigger the upgrade cycle on the L1";
    }

    /** A description of what the proposal does.
     */
    function description() public pure override returns (string memory) {
        return "This proposal upgrades the L1 Bridge for Optimism"; // can be adapted to L2 bridge upgrade probably
    }

    /** A URL where more details can be found.
     */
    function url() public pure override returns (string memory) {
        return "";
    }

    /** Calls the function on the L1Bridge
     * this function only accepts calls via governance by the root policy
     */
    function enacted(address) public override {
        l1Bridge.upgradeSelf(l1Impl);
    }
}
