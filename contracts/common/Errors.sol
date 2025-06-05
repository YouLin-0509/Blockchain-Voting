// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// --- VotingRouter Errors ---
// Note: The `Phase` type for VotingRouter__InvalidPhase (represented as uint8 here)
// is expected to be cast from VotingRouter.Phase when reverted.
error VotingRouter__NotAdmin(address caller);
error VotingRouter__InvalidPhase(uint8 currentPhase, uint8 requiredPhase);
error VotingRouter__AlreadyRegistered(address voter);
error VotingRouter__NotRegistered(address voter);
error VotingRouter__AlreadyVoted(address voter);
error VotingRouter__InvalidCandidateId(uint256 candidateId, uint256 candidateCount);
error VotingRouter__InvalidAddress(address addr); // Used for invalid plugin or admin addresses

// --- TallyBase Errors ---
error TallyBase__InvalidCandidateId(uint256 candidateId, uint256 candidateCount);
error TallyBase__AlreadyVoted(address voter);
