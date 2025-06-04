import { useState, useEffect } from 'react'; // Added useEffect
import { useAccount } from 'wagmi';
import { useMockBlockchain } from '../contexts/MockBlockchainContext'; // Import the hook

function Voting() {
  const { address, isConnected } = useAccount();
  const {
    submitEncryptedBallot,
    getSubmittedBallotCID,
    getIsVoterRegistered, // Corrected from isRegistrationOpen which is not what we need here
    registrationClosed, // Direct state access to determine if voting period might be open
    encryptedSigma // To check if results are published
  } = useMockBlockchain();

  const [isVoting, setIsVoting] = useState(false);
  const [votingStatus, setVotingStatus] = useState('');
  const [ballotCID, setBallotCID] = useState('');
  const [veRangeProof, setVeRangeProof] = useState('');
  const [testFailProof, setTestFailProof] = useState(false); // For testing failure path

  // State for UI based on blockchain mock state
  const [canVote, setCanVote] = useState(false);
  const [voteMessage, setVoteMessage] = useState('');
  const [userSubmittedCID, setUserSubmittedCID] = useState(null);

  // Function to generate dummy data
  const generateDummyData = (failProof = false) => {
    setBallotCID(`mockCID-${Date.now().toString(36)}`);
    if (failProof) {
      setVeRangeProof("0xfail"); // Specific value to trigger mock failure in context
    } else {
      setVeRangeProof(`mockProof-${Math.random().toString(36).substring(2)}`);
    }
    setTestFailProof(failProof);
  };

  // Generate dummy data on component mount
  useEffect(() => {
    generateDummyData();
  }, []);

  useEffect(() => {
    if (!isConnected || !address) {
      setCanVote(false);
      setVoteMessage('Please connect your wallet to cast your vote.');
      setUserSubmittedCID(null);
      return;
    }

    const registered = getIsVoterRegistered(address);
    const votedCID = getSubmittedBallotCID(address);
    setUserSubmittedCID(votedCID);

    if (!registered) {
      setCanVote(false);
      setVoteMessage('Not Registered: You must be registered to vote. Please use the registration panel.');
    } else if (votedCID) {
      setCanVote(false);
      setVoteMessage(`Already Voted: Your vote with CID ${votedCID} has been recorded.`);
    } else if (!registrationClosed) {
      setCanVote(false);
      setVoteMessage('Voting Not Open: Registration period is not yet closed.');
    } else if (registrationClosed && encryptedSigma) { // If registration is closed AND results are published
        setCanVote(false);
        setVoteMessage('Voting Concluded: Results have been published.');
    }
    else if (registrationClosed && !encryptedSigma) { // Registration closed, results not yet published
      setCanVote(true);
      setVoteMessage('Eligible to Vote: Please submit your generated ballot data.');
    } else {
      setCanVote(false); // Default catch-all
      setVoteMessage('Voting status cannot be determined. Please check contract state.');
    }
  }, [address, isConnected, getIsVoterRegistered, getSubmittedBallotCID, registrationClosed, encryptedSigma]);


  const handleSubmitVote = async () => {
    if (!canVote || !ballotCID || !veRangeProof) {
      setVotingStatus('Error: Cannot submit vote. Conditions not met or data missing.');
      return;
    }

    setIsVoting(true);
    setVotingStatus('Processing: Submitting your vote...');

    try {
      const result = await new Promise(resolve => setTimeout(() => resolve(submitEncryptedBallot(address, ballotCID, veRangeProof)), 1000));
      setVotingStatus(`Success! Vote submitted. CID: ${result.ballotCID} (Mocked)`);
      console.log('Mock vote submission successful:', result);
      setUserSubmittedCID(result.ballotCID); // Update UI immediately after mock success
      setCanVote(false); // Prevent further voting
    } catch (error) {
      console.error('Mock voting error:', error);
      setVotingStatus(`Failed: ${error.message} (Mocked)`);
    } finally {
      setIsVoting(false);
    }
  };

  if (!isConnected) {
    return <p>{voteMessage}</p>; // voteMessage already set by useEffect
  }

  return (
    <div>
      <h3>Cast Your Vote</h3>
      <p style={{ fontWeight: canVote ? 'normal' : 'bold', color: canVote ? 'green' : 'red' }}>{voteMessage}</p>
      {userSubmittedCID && !canVote && ( // If already voted, show this instead of generate buttons
         <p>Your submitted Ballot CID: <strong>{userSubmittedCID}</strong></p>
      )}
      {canVote && isConnected && (
        <>
          <p>Generated Ballot IPFS CID (mock): <strong>{ballotCID}</strong></p>
          <p>Generated VeRange Proof (mock): <strong style={{color: testFailProof ? 'red' : 'inherit'}}>{veRangeProof}</strong></p>
          <button onClick={() => generateDummyData(false)} style={{marginRight: '10px'}} disabled={isVoting}>
            Regenerate Valid Dummy Data
          </button>
          <button onClick={() => generateDummyData(true)} style={{marginRight: '10px', color: 'red'}} disabled={isVoting}>
            Regenerate Invalid Dummy Proof (for testing failure)
          </button>
          <button onClick={handleSubmitVote} disabled={isVoting || !canVote}>
            {isVoting ? 'Processing: Submitting...' : 'Submit Vote'}
          </button>
        </>
      )}
      {votingStatus && <p><strong>Status:</strong> {votingStatus}</p>}
    </div>
  );
}

export default Voting;
