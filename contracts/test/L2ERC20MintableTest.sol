// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import {L2ERC20Mintable} from "../token/L2ERC20Mintable.sol";

contract L2ERC20MintableTest is L2ERC20Mintable {
  
  function initialize(
        address _l1Token,
        address _l2Bridge
    ) public initializer {
      _initialize(_l1Token, _l2Bridge, "MintableTest", "MintableTest");
    }
}
