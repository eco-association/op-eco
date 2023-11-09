// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.19;

/// ============ Imports ============

import "../interfaces/token/IERC20.sol"; // ERC20 minified interface

/// @title Faucet
/// @author Anish Agnihotri
/// @notice Drips ECO to users that authenticate with a server via twitter. Does not allow repeat drips.
contract Faucet {
    /// ============ Immutable storage ============

    /// @notice ECO ERC20 token
    IERC20 public immutable ECO;

    /// ============ Mutable storage ============

    /// @notice ECO to disperse (unverified)
    uint256 public DRIP_UNVERIFIED;

    /// @notice ECO to disperse (verified)
    uint256 public DRIP_VERIFIED;

    /// @notice Whether or not multi drip is enabled. When true the same
    /// social ID can be dripped to multiple times.
    bool public isMultiDrip;

    /// @notice Addresses of approved operators
    mapping(address => bool) public approvedOperators;
    /// @notice Addresses of super operators
    mapping(address => bool) public superOperators;
    /// @notice Mint status of each hashed socialID
    mapping(string => bool) public hasMinted;

    /// ============ Modifiers ============

    /// @notice Requires sender to be contract super operator
    modifier isSuperOperator() {
        // Ensure sender is super operator
        require(superOperators[msg.sender], "Not super operator");
        _;
    }

    /// @notice Requires sender to be contract approved operator
    modifier isApprovedOperator() {
        // Ensure sender is in approved operators or is super operator
        require(
            approvedOperators[msg.sender] || superOperators[msg.sender],
            "Not approved operator"
        );
        _;
    }

    /// ============ Events ============

    /// @notice Emitted after faucet drips to a recipient
    /// @param recipient address dripped to
    event FaucetDripped(address indexed recipient);

    /// @notice Emitted after faucet drained to a recipient
    /// @param recipient address drained to
    event FaucetDrained(address indexed recipient);

    /// @notice Emitted after operator status is updated
    /// @param operator address being updated
    /// @param status new operator status
    event OperatorUpdated(address indexed operator, bool status);

    /// @notice Emitted after super operator is updated
    /// @param operator address being updated
    /// @param status new operator status
    event SuperOperatorUpdated(address indexed operator, bool status);

    /// @notice Emitted after drip amount is updated
    /// @param newUnverifiedDrip new drip_unverified amount
    /// @param newVerifiedDrip new drip_verified amount
    event DripAmountsUpdated(
        uint256 newUnverifiedDrip,
        uint256 newVerifiedDrip
    );

    /// @notice Emitted when multi drip is updated
    /// @param isMultiDrip new multi drip setting
    event MultiDripUpdated(
        bool isMultiDrip
    );

    /// @notice Emitted after the air batch drip function is called
    /// @param recipients number of recipients
    /// @param totalAmount total amount dripped
    event BatchDrip(uint256 recipients, uint256 totalAmount);

    /// ============ Constructor ============

    /// @notice Creates a new faucet contract
    /// @param _ECO address of ECO contract
    constructor(
        address _ECO,
        uint256 _DRIP_UNVERIFIED,
        uint256 _DRIP_VERIFIED,
        address _superOperator,
        address[] memory _approvedOperators
    ) {
        ECO = IERC20(_ECO);
        DRIP_UNVERIFIED = _DRIP_UNVERIFIED;
        DRIP_VERIFIED = _DRIP_VERIFIED;
        superOperators[_superOperator] = true;

        for (uint i = 0; i < _approvedOperators.length; i++) {
            approvedOperators[_approvedOperators[i]] = true;
        }
    }

    /// ============ Functions ============

    /// @notice Drips and mints tokens to recipient
    /// @param _recipient to drip tokens to
    function drip(
        string memory _socialHash,
        address _recipient,
        bool _verified
    ) external isApprovedOperator {
        require(
            !hasMinted[_socialHash] || isMultiDrip,
            "the owner of this social ID has already minted."
        );

        uint256 dripAmount = _verified ? DRIP_VERIFIED : DRIP_UNVERIFIED;
        // Drip ECO
        require(ECO.transfer(_recipient, dripAmount), "Failed dripping ECO");

        hasMinted[_socialHash] = true;

        emit FaucetDripped(_recipient);
    }

    /**
     * @notice Drip ERC20 tokens to a list of addresses as a batch to decrease gas costs.
     * There is no check to see if the addresses have already been dripped to. Use with caution.
     * @dev This function is a modified version of the airdropERC20 function from GasliteDrop.sol https://etherscan.io/address/0x09350f89e2d7b6e96ba730783c2d76137b045fef#code
     *
     * @param _token The address of the ERC20 contract
     * @param _addresses The addresses to airdrop to
     * @param _amounts The amounts to airdrop
     * @param _totalAmount The total amount to airdrop
     */
    function batchDrip(
        address _token,
        address[] calldata _addresses,
        uint256[] calldata _amounts,
        uint256 _totalAmount
    ) external payable isApprovedOperator {
        // Check that the number of addresses matches the number of amounts
        require(
            _addresses.length == _amounts.length,
            "Addresses and amounts must be of same size"
        );
        emit BatchDrip(_addresses.length, _totalAmount);
        string
            memory invalidAllowance = "Faucet contract is not approved to transfer tokens";
        string
            memory invalidTransfer = "Tokens failed to transfer to recipient";
        assembly {
            // transferFrom(address from, address to, uint256 amount)
            mstore(0x00, hex"23b872dd")
            // from address
            mstore(0x04, caller())
            // to address (this contract)
            mstore(0x24, address())
            // total amount
            mstore(0x44, _totalAmount)

            // transfer total amount to this contract
            if iszero(call(gas(), _token, 0, 0x00, 0x64, 0, 0)) {
                revert(add(invalidAllowance, 32), mload(invalidAllowance))
            }

            // transfer(address to, uint256 value)
            mstore(0x00, hex"a9059cbb")

            // end of array
            let end := add(_addresses.offset, shl(5, _addresses.length))
            // diff = _addresses.offset - _amounts.offset
            let diff := sub(_addresses.offset, _amounts.offset)

            // Loop through the addresses
            for {
                let addressOffset := _addresses.offset
            } 1 {

            } {
                // to address
                mstore(0x04, calldataload(addressOffset))
                // amount
                mstore(0x24, calldataload(sub(addressOffset, diff)))
                // transfer the tokens
                if iszero(call(gas(), _token, 0, 0x00, 0x64, 0, 0)) {
                    revert(add(invalidTransfer, 32), mload(invalidTransfer))
                }
                // increment the address offset
                addressOffset := add(addressOffset, 0x20)
                // if addressOffset >= end, break
                if iszero(lt(addressOffset, end)) {
                    break
                }
            }
        }
    }

    function drain(address _recipient) external isSuperOperator {
        uint256 ecoBalance = ECO.balanceOf(address(this));
        require(ECO.transfer(_recipient, ecoBalance), "Failed to drain");

        emit FaucetDrained(_recipient);
    }

    /// @notice Allows super operator to update approved drip operator status
    /// @param _operator address to update
    /// @param _status of operator to toggle (true == allowed to drip)
    function updateApprovedOperator(
        address _operator,
        bool _status
    ) external isSuperOperator {
        approvedOperators[_operator] = _status;
        emit OperatorUpdated(_operator, _status);
    }

    /// @notice Allows super operator to update super operator
    /// @param _operator address to update
    /// @param _status of operator to toggle (true === is super operator)
    function updateSuperOperator(
        address _operator,
        bool _status
    ) external isSuperOperator {
        superOperators[_operator] = _status;
        emit SuperOperatorUpdated(_operator, _status);
    }

    /// @notice Allows super operator to update drip amount
    /// @param unverifiedDrip new drip_unverified amount
    /// @param verifiedDrip new drip_verified amount
    function updateDripAmount(
        uint256 unverifiedDrip,
        uint256 verifiedDrip
    ) external isSuperOperator {
        DRIP_UNVERIFIED = unverifiedDrip;
        DRIP_VERIFIED = verifiedDrip;
        emit DripAmountsUpdated(DRIP_UNVERIFIED, DRIP_VERIFIED);
    }

    /**
     * @notice Allows super operator to update multi drip status
     * @param _enabled whether or not multi drip is enabled
     */
    function updateMultiDrip(bool _enabled) external isSuperOperator {
        isMultiDrip = _enabled;
        emit MultiDripUpdated(isMultiDrip);
    }
}
