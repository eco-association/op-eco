// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import {ERC20Pausable} from "@helix-foundation/currency/contracts/currency/ERC20Pausable.sol";
import {DelegatePermit} from "@helix-foundation/currency/contracts/currency/DelegatePermit.sol";

/**
 * @title L2ECO
 */
contract L2ECO is ERC20Pausable, DelegatePermit {

  uint256 public constant INITIAL_INFLATION_MULTIPLIER = 1e18;

  uint256 internal _linearInflationMultiplier;

  // to be used to record the transfer amounts after _beforeTokenTransfer
  // these values are the base (unchanging) values the currency is stored in
  event BaseValueTransfer(
    address indexed from,
    address indexed to,
    uint256 value
  );

  constructor(
      address _l2Bridge,
      address _l1Token,
      address admin,
      address _initialPauser
  ) ERC20Pausable("Optimism ECO", "OP-ECO", admin, _initialPauser) {
    _linearInflationMultiplier = INITIAL_INFLATION_MULTIPLIER;
  }

  // this function converts to gons for the sake of transferring
  function _beforeTokenTransfer(
      address from,
      address to,
      uint256 amount
  ) internal virtual override returns (uint256) {
      amount = super._beforeTokenTransfer(from, to, amount);
      uint256 gonsAmount = amount * _linearInflationMultiplier;

      emit BaseValueTransfer(from, to, gonsAmount);

      return gonsAmount;
  }

  // maybe we need this function for compatibility?
  function getPastLinearInflation(uint256 blockNumber)
      public
      view
      returns (uint256)
  {
      require(
          blockNumber <= block.number,
          "InflationCheckpoints: cannot check future block"
      );
      return _linearInflationMultiplier;
  }

  /** Access function to determine the token balance held by some address.
    */
  function balanceOf(address _owner) public view override returns (uint256) {
      return _balances[_owner] / _linearInflationMultiplier;
  }
}
