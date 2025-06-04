// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";

// Interface for the base ManagementContract
interface IManagementContract_Base {
    function isVoterRegistered(address voter) external view returns (bool);
    function registrationClosed() external view returns (bool);
}

contract CountingContract_Base is Ownable {

    // --- State Variables ---
    IManagementContract_Base public managementContract;
    
    bool public votingOpen = false;
    mapping(uint256 => uint256) public votesPerCandidate; // candidateId => voteCount
    mapping(address => bool) public hasVoted;             // voterAddress => hasVoted
    uint256 public totalVotesCast;

    // --- Events ---
    event VoteCast(address indexed voter, uint256 candidateId);
    event VotingOpened(uint256 timestamp);
    event VotingClosed(uint256 timestamp);

    // --- Constructor ---
    constructor(address _managementContractAddress) Ownable(msg.sender) {
        require(_managementContractAddress != address(0), "Invalid management contract address");
        managementContract = IManagementContract_Base(_managementContractAddress);
    }

    // --- Owner Functions ---
    /**
     * @notice Opens the voting period.
     * @dev Only callable by the owner. Registration should ideally be closed.
     */
    function openVoting() public onlyOwner {
        require(managementContract.registrationClosed(), "Registration in ManagementContract must be closed first");
        require(!votingOpen, "Voting is already open");
        votingOpen = true;
        emit VotingOpened(block.timestamp);
    }

    /**
     * @notice Closes the voting period.
     * @dev Only callable by the owner.
     */
    function closeVoting() public onlyOwner {
        require(votingOpen, "Voting is not open");
        votingOpen = false;
        emit VotingClosed(block.timestamp);
    }

    // --- Voter Functions ---
    /**
     * @notice Submits a vote for a candidate.
     * @param candidateId The ID of the candidate to vote for.
     */
    function submitVote(uint256 candidateId) public {
        require(votingOpen, "Voting is not open");
        require(managementContract.isVoterRegistered(msg.sender), "Voter not registered");
        require(!hasVoted[msg.sender], "You have already voted");
        // Assuming candidateId is valid (e.g., checked by UI or a max_candidates variable could be added)

        votesPerCandidate[candidateId]++;
        hasVoted[msg.sender] = true;
        totalVotesCast++;
        
        emit VoteCast(msg.sender, candidateId);
    }

    // --- View Functions ---
    /**
     * @notice Gets the number of votes for a specific candidate.
     * @param candidateId The ID of the candidate.
     * @return uint256 The total votes for the candidate.
     */
    function getVotesForCandidate(uint256 candidateId) public view returns (uint256) {
        return votesPerCandidate[candidateId];
    }

    /**
     * @notice Checks if a specific voter has already voted.
     * @param voterAddress The address of the voter.
     * @return bool True if the voter has voted, false otherwise.
     */
    function getHasVoted(address voterAddress) public view returns (bool) {
        return hasVoted[voterAddress];
    }

    /**
     * @notice Checks if the voting period is currently open.
     * @return bool True if voting is open, false otherwise.
     */
    function isVotingOpen() public view returns (bool) {
        return votingOpen;
    }
} 