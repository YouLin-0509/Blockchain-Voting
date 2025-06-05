// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title VotingBase
 * @notice Pure on-chain baseline voting contract – no MPC, no ZKP.
 * @dev  phasing: Register → Voting → Ended
 */
contract VotingBase {
    /* ---------- Types & Storage ---------- */
    enum Phase { Register, Voting, Ended }
    Phase   public phase = Phase.Register;

    address public immutable admin;
    string[] public candidates;                    // candidateId = idx
    mapping(address => bool) public isVoter;
    mapping(address => bool) public hasVoted;
    mapping(uint256  => uint256) private _results; // candidateId → votes

    /* ---------- Events ---------- */
    event VoterRegistered(address indexed voter);
    event VoteCast(address indexed voter, uint256 indexed candidateId);
    event PhaseSwitched(Phase indexed newPhase);

    /* ---------- Modifiers ---------- */
    modifier onlyAdmin()            { require(msg.sender == admin, "NOT_ADMIN");  _; }
    modifier inPhase(Phase want)    { require(phase == want,      "BAD_PHASE");  _; }

    /* ---------- Constructor ---------- */
    constructor(string[] memory _cand) {
        admin      = msg.sender;
        candidates = _cand;
    }

    /* ---------- Registration (Public) ---------- */
    /**
     * @notice Allows any user to register themselves as a voter during the registration phase.
     */
    function register()
        external inPhase(Phase.Register)
    {
        require(msg.sender != admin, "ADMIN_CANNOT_REGISTER");
        require(!isVoter[msg.sender], "DUP_REGISTRATION"); // Check if already registered
        isVoter[msg.sender] = true;
        emit VoterRegistered(msg.sender);
    }

    /* ---------- Admin Methods ---------- */
    /**
     * @notice Allows admin to add a specific voter during the registration phase.
     * @param voter The address of the voter to add.
     */
    function addVoter(address voter)
        external onlyAdmin inPhase(Phase.Register)
    {
        require(!isVoter[voter], "DUP_VOTER_ADMIN"); // Differentiated error message
        isVoter[voter] = true;
        emit VoterRegistered(voter);
    }

    function startVoting()
        external onlyAdmin inPhase(Phase.Register)
    {
        phase = Phase.Voting;
        emit PhaseSwitched(phase);
    }

    function endVoting()
        external onlyAdmin inPhase(Phase.Voting)
    {
        phase = Phase.Ended;
        emit PhaseSwitched(phase);
    }

    /* ---------- Voting ---------- */
    function vote(uint256 candidateId)
        external inPhase(Phase.Voting)
    {
        require(isVoter[msg.sender],      "NOT_VOTER");
        require(!hasVoted[msg.sender],    "ALREADY");
        require(candidateId < candidates.length, "BAD_ID");

        hasVoted[msg.sender] = true;
        _results[candidateId] += 1;
        emit VoteCast(msg.sender, candidateId);
    }

    /* ---------- Read-only ---------- */
    function result(uint256 id)
        external view returns (uint256)
    {
        require(phase == Phase.Ended, "NOT_ENDED");
        return _results[id];
    }

    function allResults()
        external view returns (uint256[] memory out)
    {
        require(phase == Phase.Ended, "NOT_ENDED");
        out = new uint256[](candidates.length);
        for (uint256 i; i < candidates.length; ++i) out[i] = _results[i];
    }
} 