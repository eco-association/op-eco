// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

contract GoofECO {
    
    string[] public oodles;

    uint256 inflationMultiplier;

    constructor(uint256 _inflationMultiplier) {
        oodles.push('poodles');
        inflationMultiplier = _inflationMultiplier;
    }

    function getPastLinearInflation(uint256 blockNumber) public view returns (uint256) {
        return inflationMultiplier;
    }

    function setMultiplier(uint256 _newMultiplier) public {
        inflationMultiplier = _newMultiplier;
    }

}