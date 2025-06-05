// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../interfaces/ITally.sol";
import "../../common/Errors.sol"; // Import custom errors

/**
 * @title TallyBase
 * @notice A base implementation for the ITally interface.
 * @dev Handles the core logic of recording votes and retrieving results.
 *      Assumes that caller (VotingRouter) handles phase checks and initial voter eligibility.
 */
abstract contract TallyBase is ITally {
    /* ---------- Storage ---------- */
    string[] public candidates;                     // candidateId = idx
    mapping(address => bool) public hasVoted;       // Tracks if a voter has already cast a vote through this tally module.
    mapping(uint256  => uint256) private _results; // candidateId → votes

    /* ---------- Events ---------- */
    event VoteCast(address indexed voter, uint256 indexed candidateId);

    /* ---------- Constructor ---------- */
    constructor(string[] memory _cand) {
        candidates = _cand;
    }

    /* ---------- ITally Interface Implementation ---------- */

    /**
     * @inheritdoc ITally
     * @dev Records a vote for a given candidate from a specific voter.
     *      Prevents the same voter from voting multiple times via this tally instance.
     */
    function tallyVote(address voter, uint256 candidateId) external override {
        if (candidateId >= candidates.length) {
            revert TallyBase__InvalidCandidateId(candidateId, candidates.length);
        }
        if (hasVoted[voter]) {
            revert TallyBase__AlreadyVoted(voter);
        }

        hasVoted[voter] = true;
        _results[candidateId] += 1;
        emit VoteCast(voter, candidateId);
    }

    /**
     * @inheritdoc ITally
     * @dev Returns the vote counts for all candidates.
     */
    function getResults() external view override returns (uint256[] memory out) {
        out = new uint256[](candidates.length);
        for (uint256 i = 0; i < candidates.length; ++i) {
            out[i] = _results[i];
        }
    }

    /**
     * @inheritdoc ITally
     * @dev Returns the total number of candidates.
     */
    function getCandidateCount() external view override returns (uint256) {
        return candidates.length;
    }

    // Consider if any internal helper functions from VotingBase are needed.
    // For now, the logic is simple enough to be inline.
} 