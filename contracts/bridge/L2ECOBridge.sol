// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IL1ECOBridge} from "../interfaces/bridge/IL1ECOBridge.sol";
import {IL2ECOBridge} from "../interfaces/bridge/IL2ECOBridge.sol";
import {L2ECO} from "../token/L2ECO.sol";
import {IL1ERC20Bridge} from "@eth-optimism/contracts/L1/messaging/IL1ERC20Bridge.sol";
import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import {CrossDomainEnabled} from "@eth-optimism/contracts/libraries/bridge/CrossDomainEnabled.sol";
import {Lib_PredeployAddresses} from "@eth-optimism/contracts/libraries/constants/Lib_PredeployAddresses.sol";

/**
 * @title L2ECOBridge
 * @dev The L2 Standard bridge is a contract which works together with the L1 Standard bridge to
 * enable ETH and ERC20 transitions between L1 and L2.
 * This contract acts as a minter for new tokens when it hears about deposits into the L1 Standard
 * bridge.
 * This contract also acts as a burner of the tokens intended for withdrawal, informing the L1
 * bridge to release L1 funds.
 */
contract L2ECOBridge is IL2ECOBridge, CrossDomainEnabled {
    // L1 bridge contract. This is the only address that can call `finalizeDeposit` on this contract.
    address public l1TokenBridge;

    /**
     * @dev L2 token address
     */
    L2ECO public l2EcoToken;

    /**
     * @dev Modifier to check that the L2 token is the same as the one set in the constructor
     * @param _l2Token L2 token address to check
     */
    modifier isL2EcoToken(address _l2Token) {
        require(
            _l2Token == address(l2EcoToken),
            "L2ECOBridge: Invalid L2ECO token address"
        );
        _;
    }

    /**
     * @dev Modifier to check that the L1 token is the same as the L2 token's L1 token address
     */
    modifier tokensMatch(address _l1Token) {
        require(
            _l1Token == l2EcoToken.l1Token(),
            "L2ECOBridge: Invalid L1 token address"
        );
        _;
    }

    /**
     * @dev Modifier to check that the inflation multiplier is non-zero
     */
    modifier validRebaseMultiplier(uint256 _inflationMutiplier) {
        require(
            _inflationMutiplier > 0,
            "L2ECOBridge: Invalid inflation multiplier"
        );
        _;
    }

    /**
     * @dev Constructor that sets the L2 messanger to use, L1 bridge address and the L2 token address
     * @param _l2CrossDomainMessenger Cross-domain messenger used by this contract on L2
     * @param _l1TokenBridge Address of the L1 bridge deployed to L1 chain
     * @param _l2EcoToken Address of the L2 ECO token deployed to L2 chain
     */
    constructor(
        address _l2CrossDomainMessenger,
        address _l1TokenBridge,
        address _l2EcoToken
    ) CrossDomainEnabled(_l2CrossDomainMessenger) {
        l1TokenBridge = _l1TokenBridge;
        l2EcoToken = L2ECO(_l2EcoToken);
    }

    /**
     * @dev Withdraws tokens from L2 to L1 for the caller
     * @param _l2Token L2 token address to withdraw
     * @param _amount Amount of tokens to withdraw
     * @param _l1Gas Gas limit for the L1 transaction
     * @param _data Optional data to include when calling the L1 bridge
     */
    function withdraw(
        address _l2Token,
        uint256 _amount,
        uint32 _l1Gas,
        bytes calldata _data
    ) external virtual isL2EcoToken(_l2Token) {
        _initiateWithdrawal(msg.sender, msg.sender, _amount, _l1Gas, _data);
    }

    /**
     * @dev Withdraws tokens from L2 to L1 to the address the caller specifies
     * @param _l2Token L2 token address to withdraw
     * @param _to Address to send the tokens to on L1
     * @param _amount Amount of tokens to withdraw
     * @param _l1Gas Gas limit for the L1 transaction
     * @param _data Optional data to include when calling the L1 bridge
     */
    function withdrawTo(
        address _l2Token,
        address _to,
        uint256 _amount,
        uint32 _l1Gas,
        bytes calldata _data
    ) external virtual isL2EcoToken(_l2Token) {
        _initiateWithdrawal(msg.sender, _to, _amount, _l1Gas, _data);
    }

    /**
     * @dev Finallizes a deposit by minting the correct amount of L2 tokens to the recipient's address
     */
    function finalizeDeposit(
        address _l1Token,
        address _l2Token,
        address _from,
        address _to,
        uint256 _amount,
        bytes calldata _data
    )
        external
        virtual
        onlyFromCrossDomainAccount(l1TokenBridge)
        isL2EcoToken(_l2Token)
        tokensMatch(_l1Token)
    {
        // When a deposit is finalized, we credit the account on L2 with the same amount of
        // tokens.
        L2ECO(_l2Token).mint(_to, _amount);
        emit DepositFinalized(_l1Token, _l2Token, _from, _to, _amount, _data);
    }

    /**
     * @dev Notifies the L2 token that the inflation multiplier has changed.
     * @param _inflationMultiplier The new inflation multiplier.
     */
    function rebase(uint256 _inflationMultiplier)
        external
        virtual
        onlyFromCrossDomainAccount(l1TokenBridge)
        validRebaseMultiplier(_inflationMultiplier)
    {
        l2EcoToken.rebase(_inflationMultiplier);
        emit RebaseInitiated(_inflationMultiplier);
    }

    /**
     * @dev Performs the logic for withdrawals by burning the token and informing
     *      the L1 token Gateway of the withdrawal.
     * @param _from Account to pull the withdrawal from on L2.
     * @param _to Account to give the withdrawal to on L1.
     * @param _amount Amount of the token to withdraw.
     * @param _l1Gas Unused, but included for potential forward compatibility considerations.
     * @param _data Optional data to forward to L1. This data is provided
     *        solely as a convenience for external contracts. Aside from enforcing a maximum
     *        length, these contracts provide no guarantees about its content.
     */
    function _initiateWithdrawal(
        address _from,
        address _to,
        uint256 _amount,
        uint32 _l1Gas,
        bytes calldata _data
    ) internal {
        // Burn the withdrawn tokens from L2
        l2EcoToken.burn(msg.sender, _amount);

        // Construct calldata for l1TokenBridge.finalizeERC20Withdrawal(_to, _amount)
        address l1Token = l2EcoToken.l1Token();
        bytes memory message = abi.encodeWithSelector(
            //call parent interface of IL1ECOBridge to get the selector
            IL1ERC20Bridge.finalizeERC20Withdrawal.selector,
            l1Token,
            l2EcoToken,
            _from,
            _to,
            _amount,
            _data
        );

        // Send message up to L1 bridge
        sendCrossDomainMessage(l1TokenBridge, _l1Gas, message);

        // Emit event to notify L2 of withdrawal
        emit WithdrawalInitiated(
            l1Token,
            address(l2EcoToken),
            msg.sender,
            _to,
            _amount,
            _data
        );
    }
}
