import React, { useState, useEffect } from 'react';
import { useAccount, useContractWrite, usePrepareContractWrite, useContractRead } from 'wagmi';
import { VOTING_ROUTER_ADDRESS, VOTING_ROUTER_ABI } from '../config/contracts';
import { ethers } from 'ethers'; // Import ethers

// Enum for phases from contract
const PHASES = {
  REGISTRATION: 0,
  VOTING: 1,
  FINISHED: 2,
};

const AdminPanel = () => {
  const { address } = useAccount();
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // --- State for new admin functions ---
  const [voterToRegister, setVoterToRegister] = useState('');
  const [newAdminAddress, setNewAdminAddress] = useState('');
  const [newTallyPluginAddress, setNewTallyPluginAddress] = useState('');
  const [newVerifierPluginAddress, setNewVerifierPluginAddress] = useState('');


  const { data: contractAdmin } = useContractRead({
    address: VOTING_ROUTER_ADDRESS,
    abi: VOTING_ROUTER_ABI,
    functionName: 'admin',
    enabled: !!VOTING_ROUTER_ADDRESS,
    watch: true,
  });

  const isOwner = address && contractAdmin && address.toLowerCase() === contractAdmin.toLowerCase();

  const { data: currentPhaseData, refetch: refetchPhase } = useContractRead({
    address: VOTING_ROUTER_ADDRESS,
    abi: VOTING_ROUTER_ABI,
    functionName: 'getPhase',
    enabled: !!address && isOwner && !!VOTING_ROUTER_ADDRESS,
    watch: true,
  });
  const currentPhase = currentPhaseData !== undefined ? Number(currentPhaseData) : undefined;

  const isRegistrationOpen = currentPhase === PHASES.REGISTRATION;
  const isVotingOpen = currentPhase === PHASES.VOTING;

  // Prepare transaction to start voting
  const { config: startVotingConfig } = usePrepareContractWrite({
    address: VOTING_ROUTER_ADDRESS,
    abi: VOTING_ROUTER_ABI,
    functionName: 'startVotingPeriod',
    enabled: !!address && isOwner && isRegistrationOpen && !!VOTING_ROUTER_ADDRESS,
  });

  const { 
    write: startVotingWrite, 
    isLoading: isStartingVoting 
  } = useContractWrite({
    ...startVotingConfig,
    onSuccess: () => {
      setSuccessMessage('投票階段已開啟！');
      refetchPhase();
    },
    onError: (error) => {
      console.error('開啟投票階段失敗:', error);
      setError(error.shortMessage || error.message || '開啟投票階段失敗');
    }
  });

  // Prepare transaction to end voting
  const { config: endVotingConfig } = usePrepareContractWrite({
    address: VOTING_ROUTER_ADDRESS,
    abi: VOTING_ROUTER_ABI,
    functionName: 'endVotingPeriod',
    enabled: !!address && isOwner && isVotingOpen && !!VOTING_ROUTER_ADDRESS,
  });

  const { 
    write: endVotingWrite, 
    isLoading: isEndingVoting 
  } = useContractWrite({
    ...endVotingConfig,
    onSuccess: () => {
      setSuccessMessage('投票已結束！結果現在可見。');
      refetchPhase();
      refetchResults?.(); // This will now refer to the single, correct refetchResults
    },
    onError: (error) => {
      console.error('結束投票階段失敗:', error);
      setError(error.shortMessage || error.message || '結束投票階段失敗');
    }
  });

  const handleStartVoting = async () => {
    try {
      setError(''); setSuccessMessage('');
      await startVotingWrite?.();
    } catch (err) {
      setError(err.shortMessage || err.message || '開啟投票階段操作失敗');
    }
  };

  const handleEndVoting = async () => {
    try {
      setError(''); setSuccessMessage('');
      await endVotingWrite?.();
    } catch (err) {
      setError(err.shortMessage || err.message || '結束投票階段操作失敗');
    }
  };

  // Fetch candidates (確保只聲明一次)
  const { data: fetchedCandidates, isLoading: isLoadingCandidates } = useContractRead({
    address: VOTING_ROUTER_ADDRESS,
    abi: VOTING_ROUTER_ABI,
    functionName: 'getCandidates',
    enabled: !!address && isOwner && !!VOTING_ROUTER_ADDRESS,
    watch: false, 
  });

  // Fetch results (這是保留的、正確的聲明)
  const { data: fetchedResults, isLoading: isLoadingResults, refetch: refetchResults } = useContractRead({
    address: VOTING_ROUTER_ADDRESS,
    abi: VOTING_ROUTER_ABI,
    functionName: 'getResults',
    enabled: !!address && isOwner && currentPhase === PHASES.FINISHED && !!VOTING_ROUTER_ADDRESS,
    watch: true,
  });
  
  const [candidateResults, setCandidateResults] = useState([]);

  useEffect(() => {
    if (isLoadingCandidates || isLoadingResults) {
      if (candidateResults.length > 0) {
         setCandidateResults([]);
      }
      return; 
    }
    const currentCandidateNames = fetchedCandidates || [];
    const currentVoteCounts = fetchedResults || [];
    let newCombinedResults = [];
    if (currentPhase === PHASES.FINISHED && currentCandidateNames.length > 0) {
      if (currentVoteCounts.length > 0 && currentCandidateNames.length === currentVoteCounts.length) {
        newCombinedResults = currentCandidateNames.map((name, index) => ({
          id: index, name: name,
          votes: currentVoteCounts[index] !== undefined ? currentVoteCounts[index].toString() : '0',
        }));
      } else {
        newCombinedResults = currentCandidateNames.map((name, index) => ({ 
          id: index, name: name, votes: '0' 
        }));
      }
    } else {
      newCombinedResults = [];
    }
    if (JSON.stringify(newCombinedResults) !== JSON.stringify(candidateResults)) {
      setCandidateResults(newCombinedResults);
    }
  }, [
    fetchedCandidates, 
    fetchedResults, 
    currentPhase, 
    isLoadingCandidates, 
    isLoadingResults, 
    candidateResults
  ]);

  // --- Hooks for new admin functions ---

  // Display plugin addresses
  const { data: tallyPluginAddress } = useContractRead({
    address: VOTING_ROUTER_ADDRESS, abi: VOTING_ROUTER_ABI, functionName: 'tallyPlugin', enabled: isOwner, watch: true
  });
  const { data: verifierPluginAddress } = useContractRead({
    address: VOTING_ROUTER_ADDRESS, abi: VOTING_ROUTER_ABI, functionName: 'verifierPlugin', enabled: isOwner, watch: true
  });

  // Register Voter By Admin
  const { config: regVoterByAdminConfig, error: regVoterByAdminPrepError } = usePrepareContractWrite({
    address: VOTING_ROUTER_ADDRESS, abi: VOTING_ROUTER_ABI, functionName: 'registerVoterByAdmin',
    args: [voterToRegister],
    enabled: isOwner && ethers.isAddress(voterToRegister) && (currentPhase === PHASES.REGISTRATION || currentPhase === PHASES.VOTING), // Allow registration during reg or voting phase
  });
  const { write: registerVoterByAdminWrite, isLoading: isRegisteringVoterByAdmin } = useContractWrite({
    ...regVoterByAdminConfig,
    onSuccess: () => { setSuccessMessage(`選民 ${voterToRegister} 已成功註冊！`); setVoterToRegister(''); },
    onError: (err) => { setError(`註冊選民失敗: ${err.shortMessage || err.message}`); }
  });

  // Set Admin
  const { config: setAdminConfig, error: setAdminPrepError } = usePrepareContractWrite({
    address: VOTING_ROUTER_ADDRESS, abi: VOTING_ROUTER_ABI, functionName: 'setAdmin',
    args: [newAdminAddress],
    enabled: isOwner && ethers.isAddress(newAdminAddress),
  });
  const { write: setAdminWrite, isLoading: isSettingAdmin } = useContractWrite({
    ...setAdminConfig,
    onSuccess: () => { setSuccessMessage(`管理員已更新為 ${newAdminAddress}！`); setNewAdminAddress(''); refetchPhase(); /* Admin might change, refresh relevant data */},
    onError: (err) => { setError(`設定管理員失敗: ${err.shortMessage || err.message}`); }
  });
  
  // Set Tally Plugin
  const { config: setTallyConfig, error: setTallyPrepError } = usePrepareContractWrite({
    address: VOTING_ROUTER_ADDRESS, abi: VOTING_ROUTER_ABI, functionName: 'setTallyPlugin',
    args: [newTallyPluginAddress],
    enabled: isOwner && ethers.isAddress(newTallyPluginAddress),
  });
  const { write: setTallyWrite, isLoading: isSettingTally } = useContractWrite({
    ...setTallyConfig,
    onSuccess: () => { setSuccessMessage(`計票插件已更新為 ${newTallyPluginAddress}！`); setNewTallyPluginAddress(''); /* May need to refetch plugin address display */ },
    onError: (err) => { setError(`設定計票插件失敗: ${err.shortMessage || err.message}`); }
  });

  // Set Verifier Plugin
  const { config: setVerifierConfig, error: setVerifierPrepError } = usePrepareContractWrite({
    address: VOTING_ROUTER_ADDRESS, abi: VOTING_ROUTER_ABI, functionName: 'setVerifierPlugin',
    args: [newVerifierPluginAddress],
    enabled: isOwner && (ethers.isAddress(newVerifierPluginAddress) || newVerifierPluginAddress === ethers.ZeroAddress || newVerifierPluginAddress === '0x0000000000000000000000000000000000000000'), // Allow zero address
  });
  const { write: setVerifierWrite, isLoading: isSettingVerifier } = useContractWrite({
    ...setVerifierConfig,
    onSuccess: () => { setSuccessMessage(`驗證插件已更新為 ${newVerifierPluginAddress}！`); setNewVerifierPluginAddress(''); /* May need to refetch plugin address display */ },
    onError: (err) => { setError(`設定驗證插件失敗: ${err.shortMessage || err.message}`); }
  });
  
  // --- Helper functions for new admin actions ---
  const handleAdminRegisterVoter = () => {
    if (!ethers.isAddress(voterToRegister)) { setError('請輸入有效的選民地址'); return; }
    setError(''); setSuccessMessage('');
    registerVoterByAdminWrite?.();
    if (regVoterByAdminPrepError) setError(`準備註冊選民失敗: ${regVoterByAdminPrepError.shortMessage || regVoterByAdminPrepError.message}`);
  };
  const handleSetAdmin = () => {
    if (!ethers.isAddress(newAdminAddress)) { setError('請輸入有效的新管理員地址'); return; }
    setError(''); setSuccessMessage('');
    setAdminWrite?.();
    if (setAdminPrepError) setError(`準備設定管理員失敗: ${setAdminPrepError.shortMessage || setAdminPrepError.message}`);
  };
  const handleSetTallyPlugin = () => {
    if (!ethers.isAddress(newTallyPluginAddress)) { setError('請輸入有效的計票插件地址'); return; }
    setError(''); setSuccessMessage('');
    setTallyWrite?.();
    if (setTallyPrepError) setError(`準備設定計票插件失敗: ${setTallyPrepError.shortMessage || setTallyPrepError.message}`);
  };
  const handleSetVerifierPlugin = () => {
    if (!ethers.isAddress(newVerifierPluginAddress) && newVerifierPluginAddress !== ethers.ZeroAddress && newVerifierPluginAddress !== '0x0000000000000000000000000000000000000000') { setError('請輸入有效的驗證插件地址或零地址'); return; }
    setError(''); setSuccessMessage('');
    setVerifierWrite?.();
    if (setVerifierPrepError) setError(`準備設定驗證插件失敗: ${setVerifierPrepError.shortMessage || setVerifierPrepError.message}`);
  };


  if (!isOwner) {
    return <p>您不是合約擁有者，無法訪問管理面板。</p>;
  }

  const getPhaseText = (phaseValue) => {
    if (phaseValue === PHASES.REGISTRATION) return '註冊階段 (Registration)';
    if (phaseValue === PHASES.VOTING) return '投票階段 (Voting)';
    if (phaseValue === PHASES.FINISHED) return '結束階段 (Finished)';
    return '未知階段';
  };

  return (
    <div className="admin-panel">
      <h2>管理面板</h2>
      
      <div className="admin-info">
        <p>目前階段: <strong>{currentPhase !== undefined ? getPhaseText(currentPhase) : '讀取中...'}</strong></p>
        <p>合約管理員: {contractAdmin ? contractAdmin : '讀取中...'}</p>
        <p>計票插件地址: {tallyPluginAddress || '未設定或讀取中...'}</p>
        <p>驗證插件地址: {verifierPluginAddress || '未設定或讀取中...'}</p>
      </div>
      
      <div className="admin-actions">
        <div className="action-section">
          <h3>階段管理</h3>
          {isRegistrationOpen && (
            <button onClick={handleStartVoting} disabled={isStartingVoting || !startVotingWrite} >
              {isStartingVoting ? '處理中...' : '開始投票階段'}
            </button>
          )}
          {isVotingOpen && (
            <button onClick={handleEndVoting} disabled={isEndingVoting || !endVotingWrite} >
              {isEndingVoting ? '處理中...' : '結束投票階段'}
            </button>
          )}
          {currentPhase === PHASES.FINISHED && <p>投票已結束。</p>}
        </div>

        {currentPhase === PHASES.FINISHED && (
          <div className="results-section">
            <h3>投票結果</h3>
            {isLoadingCandidates || isLoadingResults ? <p>正在載入結果...</p> : (
              candidateResults.length > 0 ? (
                <ul>
                  {candidateResults.map(candidate => ( <li key={candidate.id}> {candidate.name}: {candidate.votes} 票 </li> ))}
                </ul>
              ) : ( <p>暫無結果或候選人列表為空。</p> )
            )}
          </div>
        )}

        <div className="action-section">
          <h3>系統管理</h3>
          <div>
            <h4>管理員註冊選民</h4>
            <input type="text" value={voterToRegister} onChange={(e) => setVoterToRegister(e.target.value)} placeholder="輸入選民地址" />
            <button onClick={handleAdminRegisterVoter} disabled={isRegisteringVoterByAdmin || !registerVoterByAdminWrite}>
              {isRegisteringVoterByAdmin ? '註冊中...' : '註冊選民'}
            </button>
          </div>
          <div>
            <h4>設定新管理員</h4>
            <input type="text" value={newAdminAddress} onChange={(e) => setNewAdminAddress(e.target.value)} placeholder="輸入新管理員地址" />
            <button onClick={handleSetAdmin} disabled={isSettingAdmin || !setAdminWrite}>
              {isSettingAdmin ? '設定中...' : '設定管理員'}
            </button>
          </div>
          <div>
            <h4>設定計票插件</h4>
            <input type="text" value={newTallyPluginAddress} onChange={(e) => setNewTallyPluginAddress(e.target.value)} placeholder="輸入計票插件地址" />
            <button onClick={handleSetTallyPlugin} disabled={isSettingTally || !setTallyWrite}>
              {isSettingTally ? '設定中...' : '設定計票插件'}
            </button>
          </div>
          <div>
            <h4>設定驗證插件</h4>
            <input type="text" value={newVerifierPluginAddress} onChange={(e) => setNewVerifierPluginAddress(e.target.value)} placeholder="輸入驗證插件地址 (或零地址)" />
            <button onClick={handleSetVerifierPlugin} disabled={isSettingVerifier || !setVerifierWrite}>
              {isSettingVerifier ? '設定中...' : '設定驗證插件'}
            </button>
          </div>
        </div>
      </div>

      {error && <p className="error">錯誤: {error}</p>}
      {successMessage && <p className="success">{successMessage}</p>}
    </div>
  );
};

export default AdminPanel;
