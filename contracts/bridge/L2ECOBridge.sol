// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/* Interface Imports */
import {IL1ECOBridge} from "../interfaces/bridge/IL1ECOBridge.sol";
import {IL1ERC20Bridge} from "@eth-optimism/contracts/L1/messaging/IL1ERC20Bridge.sol";
import {IL2ECOBridge} from "../interfaces/bridge/IL2ECOBridge.sol";
import {IL2ERC20Bridge} from "@eth-optimism/contracts/L2/messaging/IL2ERC20Bridge.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/* Contract Imports */
import {L2ECO} from "../token/L2ECO.sol";
import {CrossDomainEnabledUpgradeable} from "./CrossDomainEnabledUpgradeable.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

/**
 * @title L2ECOBridge
 * @dev The L2 ECO bridge is a contract which works together with the L1 ECO bridge to
 * enable ECO transport between L1 and L2 as well as the enaction of upgrades (as directed by the L1)
 * This contract acts as a minter for new tokens when it hears about deposits into the L1 Standard
 * bridge.
 * This contract also acts as a burner of the tokens intended for withdrawal, informing the L1
 * bridge to release L1 funds.
 * This contract enacts rebases as directed by the L1 bridge
 * This contract performs upgrades of the ECO token on the L2 (and itself) as directed by the L1 bridge
 */
contract L2ECOBridge is IL2ECOBridge, CrossDomainEnabledUpgradeable {
    /**
     * @dev L1 bridge contract. This is the only address (crossdomain only) that can call most functions on this contract.
     */
    address public l1TokenBridge;

    /**
     * @dev L2 token address
     */
    address public l1Eco;

    /**
     * @dev L2 token address
     */
    L2ECO public l2Eco;

    /**
     * @dev The block number on L1 of the most recent upgradeEco call, used to prevent replay attacks on failed upgrade calls
     */
    uint256 public upgradeEcoBlock;

    /**
     * @dev The block number on L1 of the most recent upgradeSelf call, used to prevent replay attacks on failed upgrade calls
     */
    uint256 public upgradeSelfBlock;

    /**
     * @dev The block number on L1 of the most recent rebase call, used to prevent replay attacks on failed rebase calls
     */
    uint256 public rebaseBlock;

    /**
     * @dev L2 proxy admin that manages the upgrade of L2 token implementation
     */
    ProxyAdmin public l2ProxyAdmin;

    /**
     * @dev The block number on L1 of the most recent upgradeEcoX call, used to prevent replay attacks on failed upgrade calls
     */
    uint256 public upgradeEcoXBlock;

    /**
     * @dev The address of the proxy for L2ECOx, encoded as a constant as the value is added via upgrade and so is already known
     */
    address public constant L2ECOX = 0xf805B07ee64f03f0aeb963883f70D0Ac0D0fE242;

    /**
     * @dev Modifier to check that the L1 token is the same as the predefined L2 token's L1 token address
     * @param _l1Token L1 token address to check
     */
    modifier isL1EcoToken(address _l1Token) {
        require(_l1Token == l1Eco, "L2ECOBridge: invalid L1 token address");
        _;
    }

    /**
     * @dev Modifier to check that the L2 token is the same as the one set in the constructor
     * @param _l2Token L2 token address to check
     */
    modifier isL2EcoToken(address _l2Token) {
        require(
            _l2Token == address(l2Eco),
            "L2ECOBridge: invalid L2 token address"
        );
        _;
    }

    /**
     * @dev Modifier to check that the inflation multiplier is non-zero
     * @param _inflationMutiplier inflation multiplier to check
     */
    modifier validRebaseMultiplier(uint256 _inflationMutiplier) {
        require(
            _inflationMutiplier > 0,
            "L2ECOBridge: invalid inflation multiplier"
        );
        _;
    }

    /**
     * @dev Modifier requiring sender to be EOA.  This check could be bypassed by a malicious
     * contract via initcode, but it takes care of the user error we want to avoid.
     */
    modifier onlyEOA() {
        // Used to stop deposits from contracts (avoid accidentally lost tokens)
        require(msg.sender.code.length == 0, "L2ECOBridge: Account not EOA");
        _;
    }

    /**
     * @dev Modifier to check that the upgradeEco call has the correct L1 block number in order to
     * prevent replay attacks on failed upgrade calls
     */
    modifier validUpgradeEcoBlock(uint256 _blockNumber) {
        require(
            _blockNumber > upgradeEcoBlock,
            "L2ECOBridge: upgradeEco block number must be greater than last"
        );
        upgradeEcoBlock = _blockNumber;
        _;
    }

    /**
     * @dev Modifier to check that the upgradeEcoX call has the correct L1 block number in order to
     * prevent replay attacks on failed upgrade calls
     */
    modifier validUpgradeEcoXBlock(uint256 _blockNumber) {
        require(
            _blockNumber > upgradeEcoXBlock,
            "L2ECOBridge: upgradeEcoX block number must be greater than last"
        );
        upgradeEcoXBlock = _blockNumber;
        _;
    }

    /**
     * @dev Modifier to check that the upgradeSelf call has the correct L1 block number in order to
     * prevent replay attacks on failed upgrade calls
     */
    modifier validUpgradeSelfBlock(uint256 _blockNumber) {
        require(
            _blockNumber > upgradeSelfBlock,
            "L2ECOBridge: upgradeSelf block number must be greater than last upgrade block"
        );
        upgradeSelfBlock = _blockNumber;
        _;
    }


    /**
     * @dev Modifier to check that the rebase call has the correct L1 block number in order to
     * prevent replay attacks on failed rebase calls
     */
    modifier validrebaseBlock(uint256 _blockNumber) {
        require(
            _blockNumber > rebaseBlock,
            "L2ECOBridge: rebase block number must be greater than last upgrade block"
        );
        rebaseBlock = _blockNumber;
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
     * @inheritdoc IL2ECOBridge
     */
    function initialize(
        address _l2CrossDomainMessenger,
        address _l1TokenBridge,
        address _l1Eco,
        address _l2Eco,
        address _l2ProxyAdmin
    ) public initializer {
        CrossDomainEnabledUpgradeable.__CrossDomainEnabledUpgradeable_init(
            _l2CrossDomainMessenger
        );
        l1TokenBridge = _l1TokenBridge;
        l1Eco = _l1Eco;
        l2Eco = L2ECO(_l2Eco);
        l2ProxyAdmin = ProxyAdmin(_l2ProxyAdmin);
    }

    /**
     * @inheritdoc IL2ERC20Bridge
     * @param _l1Gas The minimum gas limit required for an L1 address finalizing the transation
     */
    function withdraw(
        address _l2Token,
        uint256 _amount,
        uint32 _l1Gas,
        bytes calldata _data
    ) external virtual onlyEOA isL2EcoToken(_l2Token) {
        _initiateWithdrawal(msg.sender, msg.sender, _amount, _l1Gas, _data);
    }

    /**
     * @inheritdoc IL2ERC20Bridge
     * @param _l1Gas The minimum gas limit required for an L1 address finalizing the transation
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
     * @inheritdoc IL2ERC20Bridge
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
        isL1EcoToken(_l1Token)
        isL2EcoToken(_l2Token)
    {
        // When a deposit is finalized, we convert the transferred gons to ECO using the current
        // inflation multiplier, then we credit the account on L2 with the same amount of tokens.
        _amount = _amount / l2Eco.linearInflationMultiplier();
        L2ECO(_l2Token).mint(_to, _amount);
        emit DepositFinalized(_l1Token, _l2Token, _from, _to, _amount, _data);
    }

    /**
     * @inheritdoc IL2ECOBridge
     */
    function rebase(
        uint256 _inflationMultiplier,
        uint256 _blockNumber
    )
        external
        virtual
        onlyFromCrossDomainAccount(l1TokenBridge)
        validRebaseMultiplier(_inflationMultiplier)
        validrebaseBlock(_blockNumber)
    {
        l2Eco.rebase(_inflationMultiplier);
        emit RebaseInitiated(_inflationMultiplier);
    }

    /**
     * @inheritdoc IL2ECOBridge
     * @custom:oz-upgrades-unsafe-allow-reachable delegatecall
     */
    function upgradeECO(
        address _newEcoImpl,
        uint256 _blockNumber
    )
        external
        virtual
        onlyFromCrossDomainAccount(l1TokenBridge)
        validUpgradeEcoBlock(_blockNumber)
    {
        //cast to a payable address since l2Eco is the proxy address of a ITransparentUpgradeableProxy contract
        address payable proxyAddr = payable(address(l2Eco));

        ITransparentUpgradeableProxy proxy = ITransparentUpgradeableProxy(
            proxyAddr
        );
        l2ProxyAdmin.upgrade(proxy, _newEcoImpl);

        emit UpgradeECOImplementation(_newEcoImpl);
    }

    /**
     * @inheritdoc IL2ECOBridge
     * @custom:oz-upgrades-unsafe-allow-reachable delegatecall
     */
    function upgradeECOx(
        address _newEcoXImpl,
        uint256 _blockNumber
    )
        external
        virtual
        onlyFromCrossDomainAccount(l1TokenBridge)
        validUpgradeEcoXBlock(_blockNumber)
    {
        //cast to a payable address since L2ECOX is the proxy address of a ITransparentUpgradeableProxy contract
        address payable proxyAddr = payable(L2ECOX);

        ITransparentUpgradeableProxy proxy = ITransparentUpgradeableProxy(
            proxyAddr
        );
        l2ProxyAdmin.upgrade(proxy, _newEcoXImpl);

        emit UpgradeECOxImplementation(_newEcoXImpl);
    }

    /**
     * @inheritdoc IL2ECOBridge
     * @custom:oz-upgrades-unsafe-allow-reachable delegatecall
     */
    function upgradeSelf(
        address _newBridgeImpl,
        uint256 _blockNumber
    )
        external
        virtual
        onlyFromCrossDomainAccount(l1TokenBridge)
        validUpgradeSelfBlock(_blockNumber)
    {
        //cast to a payable address since l2Eco is the proxy address of a ITransparentUpgradeableProxy contract
        address payable proxyAddr = payable(address(this));

        ITransparentUpgradeableProxy proxy = ITransparentUpgradeableProxy(
            proxyAddr
        );
        l2ProxyAdmin.upgrade(proxy, _newBridgeImpl);

        emit UpgradeSelf(_newBridgeImpl);
    }

    /**
     * @dev Performs the logic for withdrawals by burning the token and informing
     *      the L1 token Gateway of the withdrawal.
     * @param _from Account to pull the withdrawal from on L2.
     * @param _to Account to give the withdrawal to on L1.
     * @param _amount Amount of the token to withdraw.
     * @param _l1Gas The minimum gas limit required for an L1 address finalizing the transation
     * @param _data Optional data to forward to L1.
     */
    function _initiateWithdrawal(
        address _from,
        address _to,
        uint256 _amount,
        uint32 _l1Gas,
        bytes calldata _data
    ) internal {
        // Burn the withdrawn tokens from L2
        l2Eco.burn(msg.sender, _amount);

        // Construct calldata for l1TokenBridge.finalizeERC20Withdrawal(_to, _amount)
        _amount = _amount * l2Eco.linearInflationMultiplier();
        bytes memory message = abi.encodeWithSelector(
            //call parent interface of IL1ECOBridge to get the selector
            IL1ERC20Bridge.finalizeERC20Withdrawal.selector,
            l1Eco,
            l2Eco,
            _from,
            _to,
            _amount,
            _data
        );

        // Send message up to L1 bridge
        sendCrossDomainMessage(l1TokenBridge, _l1Gas, message);

        // Emit event to notify L2 of withdrawal
        emit WithdrawalInitiated(
            l1Eco,
            address(l2Eco),
            msg.sender,
            _to,
            _amount,
            _data
        );
    }
}
