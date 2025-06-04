import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useMockBlockchain } from '../contexts/MockBlockchainContext'; // Import the hook

function AdminPanel() {
  const { address, isConnected } = useAccount();
  const {
    closeRegistration,
    dispatchMPC,
    publishResult,
    isOwner,
    owner,
    registrationClosed,
    taskSpecCID,
    encryptedSigma,
    encryptedSortedBallots,
    getRegisteredVotersCount
  } = useMockBlockchain();

  const [adminStatus, setAdminStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentAction, setCurrentAction] = useState(''); // For action-specific loading text

  const [numCandidates, setNumCandidates] = useState(2);
  const [mockSigma, setMockSigma] = useState('mockEncSigma-final-123');
  const [mockSorted, setMockSorted] = useState('mockEncSorted-final-abc');

  const iAmOwner = address && isOwner(address);

  const handleAdminAction = async (actionName, actionFn, ...args) => {
    if (!isConnected || !address) {
      setAdminStatus('Error: Please connect your wallet.');
      return;
    }
    if (!iAmOwner) {
      setAdminStatus('Error: You are not authorized to perform admin actions.');
      return;
    }

    setIsProcessing(true);
    setCurrentAction(actionName); // Set current action for specific loading text
    setAdminStatus(`Processing: ${actionName}...`);

    try {
      const result = await new Promise(resolve => setTimeout(() => resolve(actionFn(address, ...args)), 1000));
      setAdminStatus(`Success! '${actionName}' complete. ${result ? `Details: ${JSON.stringify(result)}` : ''} (Mocked)`);
      console.log(`Mock admin action '${actionName}' successful:`, result);
    } catch (error) {
      console.error(`Mock admin action '${actionName}' error:`, error);
      setAdminStatus(`Failed: ${actionName} - ${error.message} (Mocked)`);
    } finally {
      setIsProcessing(false);
      setCurrentAction(''); // Reset current action
    }
  };

  if (!isConnected) {
    return <p>Connect your wallet to see admin options.</p>;
  }
  if (!iAmOwner) {
    return <p>Admin panel is restricted to the owner. Current Mock Owner: <strong>{owner}</strong></p>;
  }

  return (
    <div>
      <h3>Admin Panel (Mock Owner: {owner})</h3>
      <p>Your Address: <strong>{address}</strong> {iAmOwner ? <span style={{color: "green"}}>(You ARE Owner)</span> : <span style={{color: "red"}}>(You are NOT Owner)</span>}</p>

      <div style={{ margin: '15px 0', padding: '10px', border: '1px solid #ddd', borderRadius: '5px', backgroundColor: '#f9f9f9' }}>
        <h4>1. Registration Control</h4>
        <button
          onClick={() => handleAdminAction('Close Registration', closeRegistration)}
          disabled={isProcessing || registrationClosed}
        >
          {isProcessing && currentAction === 'Close Registration' ? 'Processing: Closing...' : (registrationClosed ? 'Registration IS CLOSED' : 'Close Registration')}
        </button>
        {registrationClosed
            ? <small style={{marginLeft: '10px', color: 'green', fontWeight: 'bold'}}> (Status: Closed - Total Registered: {getRegisteredVotersCount()})</small>
            : <small style={{marginLeft: '10px', color: 'blue', fontWeight: 'bold'}}> (Status: Open)</small>}
      </div>

      <div style={{ margin: '15px 0', padding: '10px', border: '1px solid #ddd', borderRadius: '5px', backgroundColor: '#f9f9f9' }}>
        <h4>2. MPC Dispatch Control</h4>
        <label htmlFor="numCandidates">Number of Candidates: </label>
        <input
          id="numCandidates"
          type="number"
          value={numCandidates}
          onChange={e => setNumCandidates(parseInt(e.target.value))}
          style={{width: "50px", marginLeft:"5px", marginRight:"10px"}}
          disabled={isProcessing || !registrationClosed || !!taskSpecCID}
        />
        <button
          onClick={() => handleAdminAction('Dispatch MPC Task', dispatchMPC, getRegisteredVotersCount(), numCandidates)}
          disabled={isProcessing || !registrationClosed || !!taskSpecCID}
        >
          {isProcessing && currentAction === 'Dispatch MPC Task' ? 'Processing: Dispatching...' : (taskSpecCID ? 'MPC Task IS DISPATCHED' : 'Dispatch MPC Task')}
        </button>
        {!registrationClosed && <small style={{display: 'block', color: '#e85600', marginTop: '5px'}}>Note: Registration must be closed before dispatching MPC.</small>}
        {registrationClosed && taskSpecCID && <small style={{marginLeft: '10px', color: 'green', fontWeight: 'bold'}}> (Status: Dispatched - Task CID: {taskSpecCID})</small>}
        {registrationClosed && !taskSpecCID && <small style={{marginLeft: '10px', color: 'blue', fontWeight: 'bold'}}> (Status: Ready to Dispatch)</small>}
      </div>

      <div style={{ margin: '15px 0', padding: '10px', border: '1px solid #ddd', borderRadius: '5px', backgroundColor: '#f9f9f9' }}>
        <h4>3. Result Publishing Control</h4>
        <div>
            <label htmlFor="mockSigma">Mock Encrypted Sigma: </label>
            <input id="mockSigma" type="text" value={mockSigma} onChange={e=>setMockSigma(e.target.value)} style={{marginRight:"10px", marginBottom: '5px', width: '250px'}} disabled={isProcessing || !taskSpecCID || !!encryptedSigma}/>
        </div>
        <div>
            <label htmlFor="mockSorted">Mock Encrypted Sorted List: </label>
            <input id="mockSorted" type="text" value={mockSorted} onChange={e=>setMockSorted(e.target.value)} style={{marginRight:"10px", marginBottom: '10px', width: '250px'}} disabled={isProcessing || !taskSpecCID || !!encryptedSigma}/>
        </div>
        <button
          onClick={() => handleAdminAction('Publish Results', publishResult, mockSigma, mockSorted)}
          disabled={isProcessing || !taskSpecCID || !!encryptedSigma}
        >
          {isProcessing && currentAction === 'Publish Results' ? 'Processing: Publishing...' : (encryptedSigma ? 'Results ARE PUBLISHED' : 'Publish Results')}
        </button>
        {!taskSpecCID && <small style={{display: 'block', color: '#e85600', marginTop: '5px'}}>Note: MPC Task must be dispatched before publishing results.</small>}
        {taskSpecCID && encryptedSigma && <small style={{marginLeft: '10px', color: 'green', fontWeight: 'bold'}}> (Status: Published - Sigma: {encryptedSigma}, Sorted: {encryptedSortedBallots})</small>}
        {taskSpecCID && !encryptedSigma && <small style={{marginLeft: '10px', color: 'blue', fontWeight: 'bold'}}> (Status: Ready to Publish)</small>}
      </div>

      {adminStatus && <p style={{fontWeight: 'bold', padding: '10px', border: '1px solid #eee', borderRadius: '5px', backgroundColor: adminStatus.startsWith('Success!') ? '#e6ffed' : (adminStatus.startsWith('Failed:') || adminStatus.startsWith('Error:')) ? '#ffe6e6' : '#f0f0f0' }}>{adminStatus}</p>}
    </div>
  );
}

export default AdminPanel;
