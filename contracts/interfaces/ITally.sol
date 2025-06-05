// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITally {
    function tallyAll(bytes32[] calldata ballotCIDs) external;
}
