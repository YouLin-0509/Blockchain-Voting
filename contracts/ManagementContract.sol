// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol"; // For owner-restricted functions

contract ManagementContract is Ownable {

    // --- Events ---
    event Registered(address indexed voterAddress, uint256 voterId);
    event RegistrationClosed(uint256 totalVoters);
    event MPCDispatched(string taskSpecCID, uint256 voters, uint256 candidates);
    event ResultViewerGranted(address indexed authorizedAddress);

    // --- Storage ---
    mapping(address => bool) public isVoterRegistered;
    mapping(uint256 => address) public voterIdToAddress;
    address[] public registeredVoters; // Array to easily get count and list if needed

    bool public registrationClosed = false;
    uint256 private nextVoterId = 1; // Voter IDs will start from 1

    string public taskSpecCID; // Stores the IPFS CID for the MPC task specification

    mapping(address => bool) public resultViewers;

    // --- Modifiers ---
    modifier whenRegistrationOpen() {
        require(!registrationClosed, "Registration is closed");
        _;
    }

    modifier whenRegistrationClosed() {
        require(registrationClosed, "Registration is not yet closed");
        _;
    }

    // --- Functions ---

    /**
     * @notice Registers a new voter.
     * @dev Simplified version for now. Ring signature and pkSet are placeholders.
     * @param ringSig Placeholder for the ring signature.
     * @param pkSet Placeholder for the public key set.
     */
    function register(bytes memory ringSig, bytes memory pkSet) public whenRegistrationOpen {
        // TODO: Implement actual ring signature verification in a later phase.
        // For now, we'll use this basic logic.
        // bytes memory _ringSig = ringSig; // Keep compiler happy about unused var
        // bytes memory _pkSet = pkSet;     // Keep compiler happy about unused var

        require(!isVoterRegistered[msg.sender], "Voter already registered");

        isVoterRegistered[msg.sender] = true;
        voterIdToAddress[nextVoterId] = msg.sender;
        registeredVoters.push(msg.sender);

        emit Registered(msg.sender, nextVoterId);
        nextVoterId++;
    }

    /**
     * @notice Closes the registration period.
     * @dev Only callable by the owner.
     */
    function closeRegistration() public onlyOwner whenRegistrationOpen {
        registrationClosed = true;
        emit RegistrationClosed(registeredVoters.length);
    }

    /**
     * @notice Dispatches the MPC task.
     * @dev Placeholder implementation. Generates a dummy TaskSpec CID.
     * @param voters The number of registered voters.
     * @param candidates The number of candidates.
     */
    function dispatchMPC(uint256 voters, uint256 candidates) public onlyOwner whenRegistrationClosed {
        // TODO: Implement actual TaskSpec generation and IPFS upload in a later phase.
        // For now, use a dummy CID.
        taskSpecCID = "QmPlaceholderTaskSpecCID1234567890"; // Dummy IPFS CID
        emit MPCDispatched(taskSpecCID, voters, candidates);
    }

    /**
     * @notice Grants an address the permission to view results.
     * @dev Only callable by the owner.
     * @param auth The address to authorize.
     */
    function grantResultViewer(address auth) public onlyOwner {
        require(auth != address(0), "Cannot grant to zero address");
        resultViewers[auth] = true;
        emit ResultViewerGranted(auth);
    }

    // --- View Functions (Optional but good for UI) ---

    function getRegisteredVotersCount() public view returns (uint256) {
        return registeredVoters.length;
    }

    function isRegistrationOpen() public view returns (bool) {
        return !registrationClosed;
    }
}
