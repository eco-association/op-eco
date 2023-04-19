// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "../utils/PausableUpgradeable.sol";

/**
 * @dev Implementation of the {IERC20} interface with pausability
 * When paused by the pauser admin, transfers revert.
 */
contract ERC20PausableUpgradeable is ERC20Upgradeable, PausableUpgradeable {
    address public roleAdmin;

    // initially no-one should have the pauser role
    // it can be granted and revoked by the admin policy
    address public pauser;

    /**
     * @notice event indicating the pauser was updated
     * @param pauser The new pauser
     */
    event PauserAssignment(address indexed pauser);

    modifier validAdmin(address _roleAdmin) {
        require(
            address(_roleAdmin) != address(0),
            "ERC20PausableUpgradeable: unrecoverable: do not set the _roleAdmin as the zero address"
        );
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == roleAdmin, "ERC20PausableUpgradeable: not admin");
        _;
    }

    modifier onlyPauser() {
        require(msg.sender == pauser, "ERC20PausableUpgradeable: not pauser");
        _;
    }

    /**
     * Disable the implementation contract
     */
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Proxy initializer for the contract
     *
     * @param _name The name of the token
     * @param _symbol The symbol of the token
     * @param _roleAdmin The admin address
     * @param _initialPauser The initial pauser address
     */
    function __ERC20PausableUpgradeable_init(
        string memory _name,
        string memory _symbol,
        address _roleAdmin,
        address _initialPauser
    ) public onlyInitializing validAdmin(_roleAdmin) {
        ERC20Upgradeable.__ERC20_init(_name, _symbol);
        PausableUpgradeable.__Pausable_init();
        roleAdmin = _roleAdmin;
        pauser = _initialPauser;
        emit PauserAssignment(_initialPauser);
    }

    /**
     * @dev Hook that is called before any transfer of tokens. This includes
     * minting and burning.
     *
     * If the token is not paused, it will pass through the amount
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override whenNotPaused {}

    /**
     * @notice pauses transfers of this token
     * @dev only callable by the pauser
     */
    function pause() external onlyPauser {
        super._pause();
    }

    /**
     * @notice unpauses transfers of this token
     * @dev only callable by the pauser
     */
    function unpause() external onlyPauser {
        super._unpause();
    }

    /**
     * @notice set the given address as the pauser
     * @param _pauser The address that can pause this token
     * @dev only the roleAdmin can call this function
     */
    function setPauser(address _pauser) public onlyAdmin {
        require(_pauser != pauser, "ERC20Pausable: must change pauser");
        pauser = _pauser;
        emit PauserAssignment(_pauser);
    }
}
