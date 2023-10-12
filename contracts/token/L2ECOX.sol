// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/* Interface Imports */
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IL2StandardERC20} from "@eth-optimism/contracts/standards/IL2StandardERC20.sol";

/* Contract Imports */
import {L2ERC20Mintable} from "./L2ERC20Mintable.sol";

/**
 * @title L2ECOX
 * @dev The L2ECOX represents 1:1 ECOX tokens on the ethereum mainnet that have been bridge via L1ECOXBridge and L2ECOXBridge.
 * L2ECOX is an ERC20 token implementation which represents the L2 side of the bridge. The L2ECOX token has the limitation on optimism
 * that it is not convertable to L2ECO the way ECOX is to ECO on L1.
 */
contract L2ECOX is L2ERC20Mintable {
    /**
     * Disable the implementation contract
     * @custom:oz-upgrades-unsafe-allow constructor
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializer that sets token information as well as the inital role values and the L1 Token address
     * @param _l1Token sets the L1 token address that is able to process withdrawals (available for convenience and interface compliance)
     * @param _l2Bridge sets the bridge to give all permissions to
     */
    function initialize(
        address _l1Token,
        address _l2Bridge
    ) public initializer {
      _initialize(_l1Token, _l2Bridge, "ECOX", "ECOX");
    }
}
