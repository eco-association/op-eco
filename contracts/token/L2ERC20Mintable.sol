// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/* Interface Imports */
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IL2StandardERC20} from "@eth-optimism/contracts/standards/IL2StandardERC20.sol";

/* Contract Imports */
import {ERC20Upgradeable} from "./ERC20Upgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";

/**
 * @title L2ERC20Mintable
 * @dev The L2ERC20Mintable represents a ERC20Upgradeable token that has minting, burining, and role management capabilities.
 */
contract L2ERC20Mintable is ERC20Upgradeable, EIP712Upgradeable, IERC165 {
    /**
     * @dev Address which has the ability to change permission roles
     */
    address public tokenRoleAdmin;

    /**
     * @dev Address of the L1 token contract
     */
    address public l1Token;

    /**
     * @dev Mapping storing contracts able to mint tokens
     */
    mapping(address => bool) public minters;
    /**
     * @dev Mapping storing contracts able to burn tokens
     */
    mapping(address => bool) public burners;

    /**
     * @dev Event for recording the transfer amounts after _beforeTokenTransfer applies the inflation multiplier
     * @param from Address sending tokens
     * @param to Address receive tokens
     * @param value This is in the base (unchanging) amounts the currency is stored in (gons)
     */
    event BaseValueTransfer(
        address indexed from,
        address indexed to,
        uint256 value
    );

    /**
     * @dev Event for minted tokens
     * @param _account Address receive tokens
     * @param _amount Amount of tokens being created
     */
    event Mint(address indexed _account, uint256 _amount);

    /**
     * @dev Event for burned tokens
     * @param _account Address losing tokens
     * @param _amount Amount of tokens being destroyed
     */
    event Burn(address indexed _account, uint256 _amount);

    /**
     * @dev Modifier for checking if the sender is a minter
     */
    modifier onlyMinterRole() {
        require(minters[msg.sender], "L2ERC20Mintable: not authorized to mint");
        _;
    }

    /**
     * @dev Modifier for checking if the sender is allowed to burn
     * both burners and the message sender can burn
     * @param _from the address burning tokens
     */
    modifier onlyBurnerRoleOrSelf(address _from) {
        require(
            _from == msg.sender || burners[msg.sender],
            "L2ERC20Mintable: not authorized to burn"
        );
        _;
    }

    /**
     * @dev Modifier for checking if the sender is able to edit roles
     */
    modifier onlyTokenRoleAdmin() {
        require(
            msg.sender == tokenRoleAdmin,
            "L2ERC20Mintable: not authorized to edit roles"
        );
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
     * @dev Initializer that sets token information as well as the inital role values and the L1 Token address. Child contracts should call this method in a public initializer: 
     * 'function initialize(address _l1Token, address _l2Bridge, string memory _name) override public initializer'
     * @param _l1Token sets the L1 token address that is able to process withdrawals (available for convenience and interface compliance)
     * @param _l2Bridge sets the bridge to give all permissions to
     * @param _name the name of the token
     * @param _symbol the symbol of the token
     */
    function _initialize(
        address _l1Token,
        address _l2Bridge,
        string memory _name,
        string memory _symbol
    ) internal virtual {
        ERC20Upgradeable.__ERC20_init(_name, _symbol);
        minters[_l2Bridge] = true;
        burners[_l2Bridge] = true;
        l1Token = _l1Token;
        tokenRoleAdmin = _l2Bridge;
    }

    /**
     * @dev change the minting permissions for an address
     * only callable by tokenRoleAdmin
     * @param _key the address to change permissions for
     * @param _value the new permission. true = can mint, false = cannot mint
     */
    function updateMinters(
        address _key,
        bool _value
    ) public onlyTokenRoleAdmin {
        minters[_key] = _value;
    }

    /**
     * @dev change the burning permissions for an address
     * only callable by tokenRoleAdmin
     * @param _key the address to change permissions for
     * @param _value the new permission. true = can burn, false = cannot burn
     */
    function updateBurners(
        address _key,
        bool _value
    ) public onlyTokenRoleAdmin {
        burners[_key] = _value;
    }

    /**
     * @dev give the role admin privilege to another address
     * only callable by tokenRoleAdmin
     * @param _newAdmin the address to be the new admin
     */
    function updateTokenRoleAdmin(address _newAdmin) public onlyTokenRoleAdmin {
        tokenRoleAdmin = _newAdmin;
    }

    /**
     * @dev Mint tokens for an address. Only callable by minter role addresses
     * @param _to the address to receive tokens
     * @param _amount the amount of tokens to be created
     */
    function mint(address _to, uint256 _amount) external onlyMinterRole {
        _mint(_to, _amount);
        emit Mint(_to, _amount);
    }

    /**
     * @dev Burn tokens for an address. Only callable by burner role addresses
     * @param _from the address to lose tokens
     * @param _amount the amount of tokens to be destroyed
     */
    function burn(
        address _from,
        uint256 _amount
    ) external onlyBurnerRoleOrSelf(_from) {
        _burn(_from, _amount);
        emit Burn(_from, _amount);
    }

    /**
     * @dev function to utilize ERC165 to signal compliance to an Optimism network system
     * IERC165 and IL2StandardERC20 are the supported interfaces
     * @param _interfaceId the ID hash of the interface
     */
    function supportsInterface(
        bytes4 _interfaceId
    ) external pure returns (bool) {
        bytes4 firstSupportedInterface = type(IERC165).interfaceId; // ERC165
        bytes4 secondSupportedInterface = type(IL2StandardERC20).interfaceId; // compliant to OP's IL2StandardERC20
        return
            _interfaceId == firstSupportedInterface ||
            _interfaceId == secondSupportedInterface;
    }
}
