import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useMockBlockchain } from '../contexts/MockBlockchainContext'; // Import the hook

function Registration() {
  const { address, isConnected } = useAccount();
  const { registerVoter, getIsVoterRegistered, isRegistrationOpen } = useMockBlockchain(); // Use the context

  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState('');

  // Ensure address is available before calling context functions that might depend on it
  const alreadyRegistered = address ? getIsVoterRegistered(address) : false;
  const regOpen = isRegistrationOpen(); // This one is global, doesn't need address

  const handleRegister = async () => {
    if (!isConnected || !address) {
      setRegistrationStatus('Please connect your wallet first.');
      return;
    }

    setIsRegistering(true);
    setRegistrationStatus('Attempting to register...');

    try {
      // Use the mock function
      // Simulate network delay for mock call
      const result = await new Promise(resolve => setTimeout(() => resolve(registerVoter(address)), 1000));
      setRegistrationStatus(`Success! Registered Voter ID: ${result.voterId} (Mocked)`);
      console.log('Mock registration successful:', result);
    } catch (error) {
      console.error('Mock registration error:', error);
      setRegistrationStatus(`Registration failed: ${error.message} (Mocked)`);
    } finally {
      setIsRegistering(false);
    }
  };

  if (!isConnected) {
    return <p>Please connect your wallet to register.</p>;
  }

  // Re-check regOpen and alreadyRegistered here if they could change due to other actions
  // For this component, it's mostly fine, but good practice if state can change rapidly.
  const currentRegOpen = isRegistrationOpen();
  const currentAlreadyRegistered = address ? getIsVoterRegistered(address) : false;


  if (!currentRegOpen) {
    return <p>Registration is currently closed.</p>;
  }

  if (currentAlreadyRegistered) {
    return <p>You are already registered.</p>;
  }

  return (
    <div>
      <h3>Voter Registration</h3>
      <button onClick={handleRegister} disabled={isRegistering || !currentRegOpen || currentAlreadyRegistered}>
        {isRegistering ? 'Registering...' : 'Register as Voter'}
      </button>
      {registrationStatus && <p>Status: {registrationStatus}</p>}
    </div>
  );
}

export default Registration;
