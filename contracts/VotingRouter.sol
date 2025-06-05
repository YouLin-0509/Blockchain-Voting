// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/ITally.sol";
import "./interfaces/IVerifier.sol"; // Will be used later
import "./common/Errors.sol"; // Corrected import path for Errors.sol

// Removed inline error definitions that are now imported

contract VotingRouter {
    /* ---------- Types ---------- */
    enum Phase { Register, Voting, Ended }

    /* ---------- State Variables ---------- */
    address public admin;
    ITally public tallyPlugin;
    IVerifier public verifierPlugin; // Optional, can be address(0)

    Phase public currentPhase;
    string[] public candidates;
    uint256 public candidateCount;

    mapping(address => bool) public isVoterRegistered;
    mapping(address => bool) public hasVoted;

    /* ---------- Events ---------- */
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);
    event PhaseChanged(Phase oldPhase, Phase newPhase);
    event VoterRegistered(address indexed voter);
    event VoteCast(address indexed voter, uint256 indexed candidateId); // Mirrored from TallyPlugin or emitted by Router
    event VerifiedVoteCast(address indexed voter, uint256 commitmentX, uint256 commitmentY); // New event for votes with proof
    event TallyPluginSet(address indexed newTallyAddress);
    event VerifierPluginSet(address indexed newVerifierAddress);

    /* ---------- Modifiers ---------- */
    modifier onlyAdmin() {
        if (msg.sender != admin) {
            revert VotingRouter__NotAdmin(msg.sender);
        }
        _;
    }

    modifier inPhase(Phase _requiredPhase) {
        if (currentPhase != _requiredPhase) {
            revert VotingRouter__InvalidPhase(uint8(currentPhase), uint8(_requiredPhase));
        }
        _;
    }

    /* ---------- Constructor ---------- */
    constructor(
        string[] memory _candidates,
        address _tallyPluginAddress,
        address _verifierPluginAddress // Pass address(0) if no verifier initially
    ) {
        if (_tallyPluginAddress == address(0)) {
            revert VotingRouter__InvalidAddress(_tallyPluginAddress);
        }

        admin = msg.sender;
        candidates = _candidates;
        candidateCount = _candidates.length;
        
        tallyPlugin = ITally(_tallyPluginAddress);
        // Check if tallyPlugin's candidate count matches, if an interface for that exists
        // For now, assume they are consistent by deployment convention.
        // uint256 pluginCandidateCount = tallyPlugin.getCandidateCount();
        // require(pluginCandidateCount == candidateCount, "Router/Plugin candidate mismatch");


        if (_verifierPluginAddress != address(0)) {
            verifierPlugin = IVerifier(_verifierPluginAddress);
        }

        currentPhase = Phase.Register;
        emit PhaseChanged(Phase.Register, Phase.Register); // Indicates initial phase
        emit TallyPluginSet(_tallyPluginAddress);
        if (_verifierPluginAddress != address(0)) {
            emit VerifierPluginSet(_verifierPluginAddress);
        }
    }

    /* ---------- Admin Functions ---------- */
    function setAdmin(address _newAdmin) external onlyAdmin {
        if (_newAdmin == address(0)) {
            revert VotingRouter__InvalidAddress(_newAdmin);
        }
        address oldAdmin = admin;
        admin = _newAdmin;
        emit AdminChanged(oldAdmin, _newAdmin);
    }
    
    function setTallyPlugin(address _newTallyPluginAddress) external onlyAdmin {
        if (_newTallyPluginAddress == address(0)) {
            revert VotingRouter__InvalidAddress(_newTallyPluginAddress);
        }
        tallyPlugin = ITally(_newTallyPluginAddress);
        emit TallyPluginSet(_newTallyPluginAddress);
    }

    function setVerifierPlugin(address _newVerifierPluginAddress) external onlyAdmin {
        // Allow setting to address(0) to disable verifier
        verifierPlugin = IVerifier(_newVerifierPluginAddress); // No specific error if address(0) for verifier
        emit VerifierPluginSet(_newVerifierPluginAddress);
    }

    function startVotingPeriod() external onlyAdmin inPhase(Phase.Register) {
        Phase oldPhase = currentPhase;
        currentPhase = Phase.Voting;
        emit PhaseChanged(oldPhase, currentPhase);
    }

    function endVotingPeriod() external onlyAdmin inPhase(Phase.Voting) {
        Phase oldPhase = currentPhase;
        currentPhase = Phase.Ended;
        emit PhaseChanged(oldPhase, currentPhase);
    }

    /**
     * @notice Admin function to register a voter.
     * @param _voter The address of the voter to register.
     */
    function registerVoterByAdmin(address _voter) external onlyAdmin inPhase(Phase.Register) {
        if (isVoterRegistered[_voter]) {
            revert VotingRouter__AlreadyRegistered(_voter);
        }
        isVoterRegistered[_voter] = true;
        emit VoterRegistered(_voter);
    }

    /* ---------- Public User Functions ---------- */
    /**
     * @notice Allows users to register themselves during the registration phase.
     */
    function register() external inPhase(Phase.Register) {
        if (msg.sender == admin) {
            revert VotingRouter__NotAdmin(msg.sender); // Admin cannot use public register, must use admin function
        }
        if (isVoterRegistered[msg.sender]) {
            revert VotingRouter__AlreadyRegistered(msg.sender);
        }
        isVoterRegistered[msg.sender] = true;
        emit VoterRegistered(msg.sender);
    }

    /**
     * @notice Allows a registered voter to cast a vote.
     * @param _candidateId The ID of the candidate to vote for.
     */
    function vote(uint256 _candidateId) external inPhase(Phase.Voting) {
        if (!isVoterRegistered[msg.sender]) {
            revert VotingRouter__NotRegistered(msg.sender);
        }
        if (hasVoted[msg.sender]) {
            revert VotingRouter__AlreadyVoted(msg.sender);
        }
        if (_candidateId >= candidateCount) {
            revert VotingRouter__InvalidCandidateId(_candidateId, candidateCount);
        }

        // Interact with the Tally Plugin
        tallyPlugin.tallyVote(msg.sender, _candidateId); // Pass actual voter

        hasVoted[msg.sender] = true;
        emit VoteCast(msg.sender, _candidateId); // Router also emits this for its own log / UI
    }
    
    /**
     * @notice Allows a registered voter to cast a vote with a VeRange proof.
     * @dev This function interacts with a verifierPlugin to validate the proof
     *      and then with a tallyPlugin to record the verified vote (commitment).
     */
    function voteWithProof(
        // Parameters match IVerifier.verifyVeRange
        uint256[] memory W_points_x,
        uint256[] memory W_points_y,
        uint256[] memory T_points_x,
        uint256[] memory T_points_y,
        uint256 R_point_x,
        uint256 R_point_y,
        uint256 S_point_x,
        uint256 S_point_y,
        uint256 eta1,
        uint256 eta2,
        uint256 commitmentCmOmega_x,
        uint256 commitmentCmOmega_y,
        uint256[] memory v_prime_scalars,
        uint256[] memory H_exponents
    ) external inPhase(Phase.Voting) {
        if (!isVoterRegistered[msg.sender]) {
            revert VotingRouter__NotRegistered(msg.sender);
        }
        if (hasVoted[msg.sender]) {
            revert VotingRouter__AlreadyVoted(msg.sender);
        }

        if (address(verifierPlugin) == address(0)) {
            revert("VotingRouter: Verifier plugin not set"); // Using string error for now
        }

        bool isValid = verifierPlugin.verifyVeRange(
            W_points_x, W_points_y, T_points_x, T_points_y,
            R_point_x, R_point_y, S_point_x, S_point_y,
            eta1, eta2,
            commitmentCmOmega_x, commitmentCmOmega_y,
            v_prime_scalars, H_exponents
        );

        if (!isValid) {
            revert("VotingRouter: Invalid proof"); // Using string error for now
        }

        // Assuming ITally interface will have a function like tallyCommitment
        // This function in ITally would take the voter's address and the commitment.
        // The actual candidateId is now hidden by the commitment.
        tallyPlugin.tallyCommitment(msg.sender, commitmentCmOmega_x, commitmentCmOmega_y);

        hasVoted[msg.sender] = true;
        emit VerifiedVoteCast(msg.sender, commitmentCmOmega_x, commitmentCmOmega_y);
    }

    /* ---------- View Functions ---------- */
    function getPhase() external view returns (Phase) {
        return currentPhase;
    }

    function getCandidates() external view returns (string[] memory) {
        return candidates;
    }
    
    function getCandidateCount() external view returns (uint256) {
        return candidateCount;
    }

    function isRegistered(address _user) external view returns (bool) {
        return isVoterRegistered[_user];
    }

    function checkHasVoted(address _user) external view returns (bool) {
        return hasVoted[_user];
    }

    /**
     * @notice Gets the results from the tally plugin. Only available when voting has ended.
     */
    function getResults() external view inPhase(Phase.Ended) returns (uint256[] memory) {
        return tallyPlugin.getResults();
    }

    // Optional: Add a function to query tallyPlugin.getCandidateCount() to ensure consistency
    function getTallyPluginCandidateCount() external view returns (uint256) {
        return tallyPlugin.getCandidateCount();
    }
}
