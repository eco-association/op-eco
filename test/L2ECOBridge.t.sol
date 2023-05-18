// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../contracts/bridge/L2ECOBridge.sol";

contract CounterTest is Test {
    using stdStorage for StdStorage;
    L2ECOBridge public l2Bridge;
    Storage1 test;

    function setUp() public {
        test = new Storage1();
        // l2Bridge = new L2ECOBridge();
        // stdstore.target(address(l2Bridge)).sig("_initializing").checked_write(
        //     false
        // );
        // l2Bridge.initialize(
        //     address(0x0),
        //     address(0x0),
        //     address(0x0),
        //     address(0x0)
        // );
    }

    function testFindExists() public {
        // Lets say we want to find the slot for the public
        // variable `exists`. We just pass in the function selector
        // to the `find` command
        uint256 slot = stdstore.target(address(test)).sig("exists()").find();
        assertEq(slot, 0);
    }

       function testWriteExists() public {
        // Lets say we want to write to the slot for the public
        // variable `exists`. We just pass in the function selector
        // to the `checked_write` command
        stdstore.target(address(test)).sig(test.exists.selector).checked_write(100);
        assertEq(test.exists(), 100);
    }


    function testSetup() public {
        // assertEq(address(l2Bridge.l2EcoToken()), address(0x0));
    }

    // function testSetNumber(uint256 x) public {
    //     counter.setNumber(x);
    //     assertEq(counter.number(), x);
    // }
}

// A complex storage contract
contract Storage {
    struct UnpackedStruct {
        uint256 a;
        uint256 b;
    }

    constructor() {
        map_addr[msg.sender] = 1;
    }

    uint256 private exists = 1;
    mapping(address => uint256) public map_addr;
    // mapping(address => Packed) public map_packed;
    mapping(address => UnpackedStruct) public map_struct;
    mapping(address => mapping(address => uint256)) public deep_map;
    mapping(address => mapping(address => UnpackedStruct)) public deep_map_struct;
    UnpackedStruct public basicStruct = UnpackedStruct({
        a: 1,
        b: 2
    });

    function hidden() public view returns (bytes32 t) {
        // an extremely hidden storage slot
        bytes32 slot = keccak256("my.random.var");
        assembly {
            t := sload(slot)
        }
    }
}

contract Storage1 is Storage {
    uint256 public exists = 1;
}