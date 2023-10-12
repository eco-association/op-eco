// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/* Interface Imports */
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IL2StandardERC20} from "@eth-optimism/contracts/standards/IL2StandardERC20.sol";

/* Contract Imports */
import {L2ERC20Mintable} from "./L2ERC20Mintable.sol";

/**
 * @title L2ECO
 * @dev The L2 ECO token is all tokens that have been bridge via the L1ECOBridge and L2ECOBridge
 * It differens in a few key ways from the L1 ECO token:
 * Balances are not checkpointed.
 * There is no voting on the L2 and therefore significant gas is saved by not saving balances.
 * Obviously with no voting, there is no delegation.
 * Permissions are handled differently.
 * Instead of updated via governance, there are granular roles gating minting, burning, and rebasing
 * These roles are stored on the contract instead of managed through ERC1820
 * Because of this there is no root policy address.
 * No generational timing.
 * The token contract trusts the sources of admin actions and doesn't keep any internal timing.
 */
contract L2ECO is L2ERC20Mintable {
    /**
     * @dev Constant for setting the initial inflation multiplier
     */
    uint256 public constant INITIAL_INFLATION_MULTIPLIER = 1e18;

    /**
     * @dev Stores the current inflation multiplier
     */
    uint256 public linearInflationMultiplier;

    /**
     * @dev Mapping storing contracts able to rebase the token
     */
    mapping(address => bool) public rebasers;

    /** 
     * @dev Emitted when notified by L1 of a new inflation multiplier.
     * does not necessarily mean the multiplier changes (can be same as before)
     * @param inflationMultiplier new inflation multiplier used to calculate values for the rebased token.
     */
    event NewInflationMultiplier(uint256 inflationMultiplier);

    /**
     * @dev Modifier for checking if the sender is a rebaser
     */
    modifier onlyRebaserRole() {
        require(rebasers[msg.sender], "L2ECO: not authorized to rebase");
        _;
    }

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
        _initialize(_l1Token, _l2Bridge, "ECO", "ECO");
        linearInflationMultiplier = INITIAL_INFLATION_MULTIPLIER;
        rebasers[_l2Bridge] = true;
    }

    /** 
     * @dev Access function to determine the token balance held by some address.
     */
    function balanceOf(address _owner) public view override returns (uint256) {
        return super.balanceOf(_owner) / linearInflationMultiplier;
    }

    /**
     * @dev Returns the total (inflation corrected) token supply
     */
    function totalSupply() public view override returns (uint256) {
        return super.totalSupply() / linearInflationMultiplier;
    }

    /**
     * @dev change the rebasing permissions for an address
     * only callable by tokenRoleAdmin
     * @param _key the address to change permissions for
     * @param _value the new permission. true = can rebase, false = cannot rebase
     */
    function updateRebasers(address _key, bool _value)
        public
        onlyTokenRoleAdmin
    {
        rebasers[_key] = _value;
    }

    /**
     * @dev Rebase tokens for all addresses. Done by changing the inflation multiplier. Only callable by rebaser role addresses
     * @param _newLinearInflationMultiplier the new inflation multiplier to replace the current one
     */
    function rebase(uint256 _newLinearInflationMultiplier)
        external
        onlyRebaserRole
    {
        _rebase(_newLinearInflationMultiplier);
        emit NewInflationMultiplier(_newLinearInflationMultiplier);
    }

    /**
     * @dev helper function for rebases. overwrites the old inflation multiplier with the new one
     * @param _newLinearInflationMultiplier the new inflation multiplier to replace the current one
     */
    function _rebase(uint256 _newLinearInflationMultiplier) internal {
        linearInflationMultiplier = _newLinearInflationMultiplier;
    }

    /**
     * @dev overrides the ERC20 hook to account for the rebasing factor in all transactions
     * emits an event showing the base value (ERC20 emits the inputted value)
     * @param from address sending the tokens
     * @param to address receive the tokens
     * @param amount the amount of tokens to be transferred
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override returns(uint256) {
        amount = super._beforeTokenTransfer(from, to, amount);
        // overwrite for efficiency
        amount = amount * linearInflationMultiplier;

        emit BaseValueTransfer(from, to, amount);
        return amount;
    }
}
