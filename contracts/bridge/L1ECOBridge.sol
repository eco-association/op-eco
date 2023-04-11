// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/* Interface Imports */
import {IL1ECOBridge} from "../interfaces/bridge/IL1ECOBridge.sol";
import {IL2ECOBridge} from "../interfaces/bridge/IL2ECOBridge.sol";
import {IL2ERC20Bridge} from "@eth-optimism/contracts/L2/messaging/IL2ERC20Bridge.sol";
import {L2ECOBridge} from "../bridge/L2ECOBridge.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/* Library Imports */
import {CrossDomainEnabled} from "@eth-optimism/contracts/libraries/bridge/CrossDomainEnabled.sol";
import {Lib_PredeployAddresses} from "@eth-optimism/contracts/libraries/constants/Lib_PredeployAddresses.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IGenerationIncrease} from "@helix-foundation/currency/contracts/governance/IGenerationIncrease.sol";
import {ECO} from "@helix-foundation/currency/contracts/currency/ECO.sol";
// import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title L1ECOBridge
 * @dev The L1 ETH and ERC20 Bridge is a contract which stores deposited L1 funds and standard
 * tokens that are in use on L2. It synchronizes a corresponding L2 Bridge, informing it of deposits
 * and listening to it for newly finalized withdrawals.
 *
 */
contract L1ECOBridge is IL1ECOBridge, CrossDomainEnabled {
    // using SafeERC20 for IERC20;

    /********************************
     * External Contract References *
     ********************************/
    
    // L2 side of the bridge
    address public l2TokenBridge;

    // L1 ECO address
    address public ecoAddress;

    // Balance of gons deposited
    uint256 public deposits;

    // Current inflation multiplier
    uint256 public inflationMultiplier;

    // L2 upgrader role
    address public upgrader;

    /***************
     * Constructor *
     ***************/

    // This contract lives behind a proxy, so the constructor parameters will go unused.
    constructor() CrossDomainEnabled(address(0)) {}

    /******************
     * Initialization *
     ******************/

    /**
     * @param _l1messenger L1 Messenger address being used for cross-chain communications.
     * @param _l2TokenBridge L2 standard bridge address.
     */
    // slither-disable-next-line external-function
    function initialize(address _l1messenger, address _l2TokenBridge, address _ecoAddress, address _upgrader) public {
        require(
            messenger == address(0),
            "Contract has already been initialized."
        );
        messenger = _l1messenger;
        l2TokenBridge = _l2TokenBridge;
        ecoAddress = _ecoAddress;
        upgrader = _upgrader;
        inflationMultiplier = ECO(_ecoAddress).getPastLinearInflation(block.number);
        
    }

    /**************
     * Depositing *
     **************/

    /** @dev Modifier requiring sender to be EOA.  This check could be bypassed by a malicious
     *  contract via initcode, but it takes care of the user error we want to avoid.
     */
    modifier onlyEOA() {
        // Used to stop deposits from contracts (avoid accidentally lost tokens)
        require(!Address.isContract(msg.sender), "Account not EOA");
        _;
    }

    modifier onlyUpgrader() {
        require(msg.sender == upgrader, "Caller not authorized to upgrade L2 contracts.");
        _;
    }

    function upgradeL2(address _impl, uint32 _l2Gas) external onlyUpgrader {
        bytes memory message = abi.encodeWithSelector(
            L2ECOBridge.upgradeImpl.selector,
            // IL2ERC20Bridge.finalizeDeposit.selector,
            _impl
        );

        sendCrossDomainMessage(l2TokenBridge, _l2Gas, message);
    }

    /**
     */
    function depositERC20(
        address _l1Token,
        address _l2Token,
        uint256 _amount,
        uint32 _l2Gas,
        bytes calldata _data
    ) external virtual onlyEOA {
        _initiateERC20Deposit(
            _l1Token,
            _l2Token,
            msg.sender,
            msg.sender,
            _amount,
            _l2Gas,
            _data
        );
    }

    /**
     */
    function depositERC20To(
        address _l1Token,
        address _l2Token,
        address _to,
        uint256 _amount,
        uint32 _l2Gas,
        bytes calldata _data
    ) external virtual {
        _initiateERC20Deposit(
            _l1Token,
            _l2Token,
            msg.sender,
            _to,
            _amount,
            _l2Gas,
            _data
        );
    }

    /**
     * @dev Performs the logic for deposits by informing the L2 Deposited Token
     * contract of the deposit and calling a handler to lock the L1 funds. (e.g. transferFrom)
     *
     * @param _l1Token Address of the L1 ERC20 we are depositing
     * @param _l2Token Address of the L1 respective L2 ERC20
     * @param _from Account to pull the deposit from on L1
     * @param _to Account to give the deposit to on L2
     * @param _amount Amount of the ERC20 to deposit.
     * @param _l2Gas Gas limit required to complete the deposit on L2.
     * @param _data Optional data to forward to L2. This data is provided
     *        solely as a convenience for external contracts. Aside from enforcing a maximum
     *        length, these contracts provide no guarantees about its content.
     */
    function _initiateERC20Deposit(
        address _l1Token,
        address _l2Token,
        address _from,
        address _to,
        uint256 _amount,
        uint32 _l2Gas,
        bytes calldata _data
    ) internal {
        // When a deposit is initiated on L1, the L1 Bridge transfers the funds to itself for future
        // withdrawals. The use of safeTransferFrom enables support of "broken tokens" which do not
        // return a boolean value.

        // slither-disable-next-line reentrancy-events, reentrancy-benign
        ECO(_l1Token).transferFrom(_from, address(this), _amount);
        // convert eco to gons value
        _amount = _amount * inflationMultiplier;

        // Construct calldata for _l2Token.finalizeDeposit(_to, _amount)
        bytes memory message = abi.encodeWithSelector(
            //call parent interface of IL2ECOBridge to get the selector
            IL2ERC20Bridge.finalizeDeposit.selector,
            _l1Token,
            _l2Token,
            _from,
            _to,
            _amount,
            _data
        );

        // Send calldata into L2
        // slither-disable-next-line reentrancy-events, reentrancy-benign
        sendCrossDomainMessage(l2TokenBridge, _l2Gas, message);

        // slither-disable-next-line reentrancy-benign
        deposits += _amount;

        // slither-disable-next-line reentrancy-events
        emit ERC20DepositInitiated(
            _l1Token,
            _l2Token,
            _from,
            _to,
            _amount,
            _data
        );
    }

    /*************************
     * Cross-chain Functions *
     *************************/

    /**
     */
    function finalizeERC20Withdrawal(
        address _l1Token,
        address _l2Token,
        address _from,
        address _to,
        uint256 _amount,
        bytes calldata _data
    ) external onlyFromCrossDomainAccount(l2TokenBridge) {
        deposits -= _amount;

        _amount = _amount / inflationMultiplier;

        // When a withdrawal is finalized on L1, the L1 Bridge transfers the funds to the withdrawer
        // slither-disable-next-line reentrancy-events
        ECO(_l1Token).transfer(_to, _amount);

        // slither-disable-next-line reentrancy-events
        emit ERC20WithdrawalFinalized(
            _l1Token,
            _l2Token,
            _from,
            _to,
            _amount,
            _data
        );
    }

    function notifyGenerationIncrease() external {
        inflationMultiplier = ECO(ecoAddress).getPastLinearInflation(block.number);
    }

    /*****************************
     * Temporary - Migrating ETH *
     *****************************/

    /**
     * @dev Adds ETH balance to the account. This is meant to allow for ETH
     * to be migrated from an old gateway to a new gateway.
     * NOTE: This is left for one upgrade only so we are able to receive the migrated ETH from the
     * old contract
     */
    function donateETH() external payable {}
}
