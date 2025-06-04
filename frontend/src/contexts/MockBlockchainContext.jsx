import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * @file MockBlockchainContext.jsx
 * @description This file defines a React Context that simulates blockchain interactions.
 * It is used for frontend development and UI/UX testing in environments where
 * direct smart contract compilation and deployment (e.g., via Hardhat) are problematic.
 * This mock allows the frontend components to function as if they are interacting
 * with real smart contracts (`ManagementContract` and `CountingContract`).
 *
 * The context provides:
 * - A simulated blockchain state (`initialBlockchainState`).
 * - Mock functions that mimic the behavior of smart contract methods.
 * - Helper functions for UI components to check certain states (e.g., ownership).
 *
 * To use this mock context, wrap the main application component with `<MockBlockchainProvider>`.
 * Components can then access the mock state and functions using the `useMockBlockchain` hook.
 */

const MockBlockchainContext = createContext();

export const useMockBlockchain = () => useContext(MockBlockchainContext);

// Defines the initial state of the simulated blockchain.
// Mirrors key state variables from ManagementContract.sol and CountingContract.sol.
const initialBlockchainState = {
  // --- ManagementContract states ---
  isVoterRegistered: {}, // Mapping: address => bool. Tracks if a voter address is registered.
  voterIdToAddress: {},  // Mapping: uint256 (id) => address. Maps voter ID to their address.
  registeredVotersList: [], // Array: address[]. List of all registered voter addresses.
  registrationClosed: false, // Boolean: Tracks if the voter registration period is closed.
  nextVoterId: 1,          // Uint256: Counter for assigning unique voter IDs, starting from 1.
  taskSpecCID: '',         // String: Stores the IPFS CID for the (mock) MPC task specification.
  resultViewers: {},     // Mapping: address => bool. Tracks addresses authorized to view results.
  owner: '0xOwnerPlaceholderAddress', // String: Simulated address of the contract owner for Ownable checks.

  // --- CountingContract states ---
  submittedBallots: {}, // Mapping: address => bytes32 (cid). Stores CID of submitted ballot for each voter.
  encryptedSigma: '',     // Bytes: Placeholder for encrypted sum of votes (result of MPC).
  encryptedSortedBallots: '', // Bytes: Placeholder for encrypted sorted list of ballots (result of MPC).
};

export const MockBlockchainProvider = ({ children }) => {
  const [state, setState] = useState(initialBlockchainState);

  // --- Mock ManagementContract Functions ---

  /**
   * @function registerVoter
   * @description Simulates the `register` function of `ManagementContract.sol`.
   * Registers a new voter if registration is open and the voter is not already registered.
   * @param {string} voterAddress - The address of the voter to register.
   * @throws {Error} If registration is closed or voter is already registered.
   * @returns {object} An object containing the new voterId and voterAddress.
   */
  const registerVoter = useCallback((voterAddress) => {
    if (state.registrationClosed) {
      throw new Error("Registration is closed");
    }
    if (state.isVoterRegistered[voterAddress]) {
      throw new Error("Voter already registered");
    }

    const newVoterId = state.nextVoterId;
    setState(prevState => ({
      ...prevState,
      isVoterRegistered: { ...prevState.isVoterRegistered, [voterAddress]: true },
      voterIdToAddress: { ...prevState.voterIdToAddress, [newVoterId]: voterAddress },
      registeredVotersList: [...prevState.registeredVotersList, voterAddress],
      nextVoterId: newVoterId + 1,
    }));
    console.log(`MockEvent: Registered(voterAddress: ${voterAddress}, voterId: ${newVoterId})`); // Simulate event emission
    return { voterId: newVoterId, voterAddress };
  }, [state.registrationClosed, state.isVoterRegistered, state.nextVoterId]);

  /**
   * @function closeRegistration
   * @description Simulates the `closeRegistration` (owner-only) function of `ManagementContract.sol`.
   * Closes the registration period.
   * @param {string} callerAddress - The address attempting to close registration.
   * @throws {Error} If caller is not the owner or registration is already closed.
   * @returns {object} An object containing the total number of registered voters.
   */
  const closeRegistration = useCallback((callerAddress) => {
    // Simulate onlyOwner modifier
    if (callerAddress !== state.owner) {
      throw new Error("OwnableUnauthorizedAccount: Only owner can close registration.");
    }
    if (state.registrationClosed) {
      // This specific error might not be in the actual contract but is good for mock UX
      throw new Error("Registration already closed.");
    }
    setState(prevState => ({
      ...prevState,
      registrationClosed: true,
    }));
    console.log(`MockEvent: RegistrationClosed(totalVoters: ${state.registeredVotersList.length})`);
    return { totalVoters: state.registeredVotersList.length };
  }, [state.owner, state.registrationClosed, state.registeredVotersList.length]);

  /**
   * @function dispatchMPC
   * @description Simulates the `dispatchMPC` (owner-only) function of `ManagementContract.sol`.
   * Dispatches the MPC task by setting a mock taskSpecCID.
   * @param {string} callerAddress - The address attempting to dispatch.
   * @param {number} voters - Number of voters (for mock event).
   * @param {number} candidates - Number of candidates (for mock event).
   * @throws {Error} If caller is not owner or registration is not closed.
   * @returns {object} An object containing the mock taskSpecCID.
   */
  const dispatchMPC = useCallback((callerAddress, voters, candidates) => {
    // Simulate onlyOwner modifier
    if (callerAddress !== state.owner) {
      throw new Error("OwnableUnauthorizedAccount: Only owner can dispatch MPC.");
    }
    // Simulate whenRegistrationClosed modifier
    if (!state.registrationClosed) {
      throw new Error("Registration is not yet closed");
    }
    const mockCID = `QmMockTaskSpec-${Date.now()}`; // Generate a dummy CID
    setState(prevState => ({
      ...prevState,
      taskSpecCID: mockCID,
    }));
    console.log(`MockEvent: MPCDispatched(taskSpecCID: ${mockCID}, voters: ${voters}, candidates: ${candidates})`);
    return { taskSpecCID: mockCID };
  }, [state.owner, state.registrationClosed]);

  /**
   * @function grantResultViewer
   * @description Simulates the `grantResultViewer` (owner-only) function of `ManagementContract.sol`.
   * Grants an address permission to view results.
   * @param {string} callerAddress - The address attempting the grant.
   * @param {string} viewerAddress - The address to be granted permission.
   * @throws {Error} If caller is not owner or viewerAddress is invalid.
   * @returns {object} An object containing the authorized viewerAddress.
   */
  const grantResultViewer = useCallback((callerAddress, viewerAddress) => {
    // Simulate onlyOwner modifier
    if (callerAddress !== state.owner) {
      throw new Error("OwnableUnauthorizedAccount: Only owner can grant viewer permission.");
    }
    if (!viewerAddress || viewerAddress === '0x0000000000000000000000000000000000000000') { // Solidity zero address check
        throw new Error("Cannot grant to zero address");
    }
    setState(prevState => ({
      ...prevState,
      resultViewers: { ...prevState.resultViewers, [viewerAddress]: true },
    }));
    console.log(`MockEvent: ResultViewerGranted(authorizedAddress: ${viewerAddress})`);
    return { authorizedAddress: viewerAddress };
  }, [state.owner]);

  // --- Mock View Functions (ManagementContract) ---
  const getRegisteredVotersCount = useCallback(() => state.registeredVotersList.length, [state.registeredVotersList]);
  const isRegistrationOpen = useCallback(() => !state.registrationClosed, [state.registrationClosed]);
  const getIsVoterRegistered = useCallback((voterAddress) => !!state.isVoterRegistered[voterAddress], [state.isVoterRegistered]);


  // --- Mock CountingContract Functions ---

  /**
   * @function submitEncryptedBallot
   * @description Simulates the `submitEncryptedBallot` function of `CountingContract.sol`.
   * Allows a registered voter to submit their encrypted ballot.
   * @param {string} voterAddress - The address of the voter submitting the ballot.
   * @param {string} cid - The IPFS CID of the encrypted ballot (mocked as a string).
   * @param {string} veRangeProof - The VeRange proof (mocked, "0xfail" simulates failure).
   * @throws {Error} If voter not registered, ballot already submitted, or mock VeRange proof fails.
   * @returns {object} An object containing the voterAddress and ballotCID.
   */
  const submitEncryptedBallot = useCallback((voterAddress, cid, veRangeProof) => {
    if (!state.isVoterRegistered[voterAddress]) {
      throw new Error("Voter not registered.");
    }
    // Actual contract might have stricter phase control (e.g., only when registration is closed and voting is open).
    // Here, we implicitly allow if registration is closed, but a real system might have a dedicated "votingOpen" state.
    if (state.submittedBallots[voterAddress]) {
      throw new Error("Ballot already submitted for this address");
    }
    // Simulate VeRange proof verification
    if (!veRangeProof || veRangeProof === "0xfail") { // "0xfail" is a mock trigger for failure
        console.log(`Mock VeRangeProof verification failed for proof: ${veRangeProof}`);
        throw new Error("Mock VeRange proof verification failed");
    }

    setState(prevState => ({
      ...prevState,
      submittedBallots: { ...prevState.submittedBallots, [voterAddress]: cid },
    }));
    console.log(`MockEvent: BallotAccepted(voterAddress: ${voterAddress}, ballotCID: ${cid})`);
    return { voterAddress, ballotCID: cid };
  }, [state.isVoterRegistered, state.registrationClosed, state.submittedBallots]); // state.registrationClosed included if it affects voting phase

  /**
   * @function publishResult
   * @description Simulates the `publishResult` (restricted) function of `CountingContract.sol`.
   * Publishes the encrypted results of the MPC process.
   * @param {string} callerAddress - Address attempting to publish (checked against owner for mock).
   * @param {string} encSigma - Mock encrypted sum of votes.
   * @param {string} encSorted - Mock encrypted sorted list of ballots.
   * @throws {Error} If caller is not owner, MPC task not dispatched, or results already published.
   * @returns {object} An object containing the encSigma and encSorted.
   */
  const publishResult = useCallback((callerAddress, encSigma, encSorted) => {
    // Simulate access control (e.g., only owner or authorized MPC node)
    if (callerAddress !== state.owner) {
      throw new Error("OwnableUnauthorizedAccount: Only owner/authorized can publish results.");
    }
    // Simulate dependency on MPC dispatch
    if (!state.taskSpecCID) {
        throw new Error("MPC task not dispatched yet.");
    }
    // Prevent re-publishing if results are already there
     if (state.encryptedSigma) {
        throw new Error("Results already published.");
    }

    setState(prevState => ({
      ...prevState,
      encryptedSigma: encSigma,
      encryptedSortedBallots: encSorted,
    }));
    console.log(`MockEvent: ResultPublished(encSigma: ${encSigma}, encSortedList: ${encSorted})`);
    return { encSigma, encSorted };
  }, [state.owner, state.taskSpecCID, state.encryptedSigma]);

  // --- Mock View Functions (CountingContract) ---
  const getSubmittedBallotCID = useCallback((voterAddress) => state.submittedBallots[voterAddress] || null, [state.submittedBallots]);

  // Value provided by the context
  const value = {
    // Raw state (can be used for display or complex checks in UI)
    ...state,
    // ManagementContract mock functions
    registerVoter,
    closeRegistration,
    dispatchMPC,
    grantResultViewer,
    getRegisteredVotersCount,
    isRegistrationOpen,
    getIsVoterRegistered,
    // CountingContract mock functions
    submitEncryptedBallot,
    publishResult,
    getSubmittedBallotCID,
    // Helper to check if a connected address is the mock owner
    isOwner: (address) => address === state.owner,
  };

  return (
    <MockBlockchainContext.Provider value={value}>
      {children}
    </MockBlockchainContext.Provider>
  );
};
