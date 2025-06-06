// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITally {
    /**
     * @notice Records a vote for a given candidate from a specific voter.
     * @dev Should only be callable by the VotingRouter.
     * @param voter The address of the user casting the vote.
     * @param candidateId The ID of the candidate to vote for.
     */
    function tallyVote(address voter, uint256 candidateId) external;

    /**
     * @notice Gets the vote count for all candidates.
     * @dev Should only be callable by the VotingRouter or be a public view function.
     * @return An array of vote counts, indexed by candidateId.
     */
    function getResults() external view returns (uint256[] memory);

    /**
     * @notice Gets the total number of candidates.
     * @return The number of candidates.
     */
    function getCandidateCount() external view returns (uint256);

    // Potentially add other functions if needed, e.g., getResultForCandidate(uint256 candidateId)
    // However, getResults() can serve this purpose by returning all results.
}
