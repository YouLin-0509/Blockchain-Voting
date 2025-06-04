// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol"; // For owner-restricted functions

contract ManagementContract_Base is Ownable {

    // --- Events ---
    event Registered(address indexed voterAddress, uint256 voterId);
    event RegistrationClosed(uint256 totalVoters);
    // MPCDispatched event removed
    event ResultViewerGranted(address indexed authorizedAddress);

    // --- Storage ---
    mapping(address => bool) public isVoterRegistered;
    mapping(uint256 => address) public voterIdToAddress;
    address[] public registeredVoters; // Array to easily get count and list if needed

    bool public registrationClosed = false;
    uint256 private nextVoterId = 1; // Voter IDs will start from 1

    // taskSpecCID storage removed

    mapping(address => bool) public resultViewers;

    // --- Modifiers ---
    modifier whenRegistrationOpen() {
        require(!registrationClosed, "Registration is closed");
        _;
    }

    // whenRegistrationClosed modifier is not strictly needed if dispatchMPC is removed,
    // but can be kept if other functions might use it. For now, let's keep it.
    modifier whenRegistrationClosed() {
        require(registrationClosed, "Registration is not yet closed");
        _;
    }

    // --- Functions ---

    constructor() Ownable(msg.sender) {
        // Initialize contract
    }

    /**
     * @notice Registers a new voter.
     * @dev Simplified version. Ring signature and pkSet are placeholders.
     * @param ringSig Placeholder for the ring signature.
     * @param pkSet Placeholder for the public key set.
     */
    function register(bytes memory ringSig, bytes memory pkSet) public whenRegistrationOpen {
        // Parameters ringSig and pkSet are kept for interface consistency with other versions,
        // but their actual verification is simplified or placeholder.
        // bytes memory _ringSig = ringSig; // Keep compiler happy about unused var
        // bytes memory _pkSet = pkSet;     // Keep compiler happy about unused var

        require(msg.sender != owner(), "Owner cannot register as a voter");
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

    // dispatchMPC function removed

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