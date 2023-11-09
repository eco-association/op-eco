// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.19;

import "./Faucet.sol";

contract FaucetStaging is Faucet {
    /// @notice Whether or not multi drip is enabled. When true the same
    /// social ID can be dripped to multiple times.
    bool public isMultiDrip;

    /// @notice Emitted when multi drip is updated
    /// @param isMultiDrip new multi drip setting
    event MultiDripUpdated(bool isMultiDrip);

    /// @notice Requires drip to be valid for the social hash
    modifier validDrip(string memory _socialHash) override {
        require(
            !hasMinted[_socialHash] || isMultiDrip,
            "the owner of this social ID has already minted."
        );
        _;
    }

    /// @notice Creates a new faucet contract
    /// @param _ECO address of ECO contract
    constructor(
        address _ECO,
        uint256 _DRIP_UNVERIFIED,
        uint256 _DRIP_VERIFIED,
        address _superOperator,
        address[] memory _approvedOperators
    )
        Faucet(
            _ECO,
            _DRIP_UNVERIFIED,
            _DRIP_VERIFIED,
            _superOperator,
            _approvedOperators
        )
    {}

    /**
     * @notice Allows super operator to update multi drip status
     * @param _enabled whether or not multi drip is enabled
     */
    function updateMultiDrip(bool _enabled) external isSuperOperator {
        isMultiDrip = _enabled;
        emit MultiDripUpdated(isMultiDrip);
    }
}
