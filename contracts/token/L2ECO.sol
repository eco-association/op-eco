// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {ERC20Pausable} from "@helix-foundation/currency/contracts/currency/ERC20Pausable.sol";
import {DelegatePermit} from "@helix-foundation/currency/contracts/currency/DelegatePermit.sol";

/**
 * @title L2ECO
 */
contract L2ECO is ERC20Pausable, DelegatePermit {
    uint256 public constant INITIAL_INFLATION_MULTIPLIER = 1e18;

    uint256 internal linearInflationMultiplier;

    address public tokenRoleAdmin;

    // address of the L1 token contract
    address public l1Token;

    // additional roles to be managed by roleAdmin from ERC20Pausable
    mapping(address => bool) public minters;
    mapping(address => bool) public burners;
    mapping(address => bool) public rebasers;

    // to be used to record the transfer amounts after _beforeTokenTransfer
    // these values are the base (unchanging) values the currency is stored in
    event BaseValueTransfer(
        address indexed from,
        address indexed to,
        uint256 value
    );

    /** Fired when notified by L1 of a new inflation multiplier.
     * Used to calculate values for the rebased token.
     */
    event NewInflationMultiplier(uint256 inflationMultiplier);

    modifier onlyMinterRole() {
        require(minters[msg.sender], "not authorized to mint");
        _;
    }

    modifier onlyBurnerRoleOrSelf(address _from) {
        require(
            _from == msg.sender || burners[msg.sender],
            "not authorized to burn"
        );
        _;
    }

    modifier onlyRebaserRole() {
        require(rebasers[msg.sender], "not authorized to rebase");
        _;
    }

    modifier onlyTokenRoleAdmin() {
        require(msg.sender == tokenRoleAdmin, "not authorized to edit roles");
        _;
    }

    // when admin becomes mutable, we put it in the initialize function
    constructor(address admin)
        ERC20Pausable("Optimism ECO", "OP-ECO", admin, address(0))
    {}

    function initialize(
        address _l1Token,
        address _l2Bridge,
        address _initialPauser
    ) public {
        require(
            linearInflationMultiplier == 0,
            "Contract has already been initialized."
        );
        linearInflationMultiplier = INITIAL_INFLATION_MULTIPLIER;
        minters[_l2Bridge] = true;
        burners[_l2Bridge] = true;
        rebasers[_l2Bridge] = true;
        l1Token = _l1Token;
        tokenRoleAdmin = _l2Bridge;
        pauser = _initialPauser;
    }

    /** Access function to determine the token balance held by some address.
     */
    function balanceOf(address _owner) public view override returns (uint256) {
        return _balances[_owner] / linearInflationMultiplier;
    }

    /** Returns the total (inflation corrected) token supply
     */
    function totalSupply() public view override returns (uint256) {
        return _totalSupply / linearInflationMultiplier;
    }

    function updateMinters(address _key, bool _value)
        public
        onlyTokenRoleAdmin
    {
        minters[_key] = _value;
    }

    function updateBurners(address _key, bool _value)
        public
        onlyTokenRoleAdmin
    {
        burners[_key] = _value;
    }

    function updateRebasers(address _key, bool _value)
        public
        onlyTokenRoleAdmin
    {
        rebasers[_key] = _value;
    }

    function updateTokenRoleAdmin(address _newAdmin) public onlyTokenRoleAdmin {
        tokenRoleAdmin = _newAdmin;
    }

    function mint(address _to, uint256 _value) external onlyMinterRole {
        _mint(_to, _value);
    }

    function burn(address _from, uint256 _value)
        external
        onlyBurnerRoleOrSelf(_from)
    {
        _burn(_from, _value);
    }

    function rebase(uint256 _newLinearInflationMultiplier)
        external
        onlyRebaserRole
    {
        _rebase(_newLinearInflationMultiplier);
    }

    function _rebase(uint256 _newLinearInflationMultiplier) internal {
        linearInflationMultiplier = _newLinearInflationMultiplier;
        emit NewInflationMultiplier(_newLinearInflationMultiplier);
    }

    // this function converts to gons for the sake of transferring
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override returns (uint256) {
        amount = super._beforeTokenTransfer(from, to, amount);
        uint256 gonsAmount = amount * linearInflationMultiplier;

        emit BaseValueTransfer(from, to, gonsAmount);

        return gonsAmount;
    }
}
