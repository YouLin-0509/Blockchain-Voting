// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./base/TallyBase.sol";

contract SimpleTally is TallyBase {
    constructor(string[] memory _candidates) TallyBase(_candidates) {}

    function tallyCommitment(
        address,
        uint256,
        uint256
    ) external pure {
        // Dummy implementation for compilation purposes
    }

    function getTally() external view returns (uint256[] memory) {
        uint256[] memory dummyTally = new uint256[](candidates.length);
        return dummyTally;
    }
}
