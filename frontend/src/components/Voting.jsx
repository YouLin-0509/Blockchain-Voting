/* global BigInt */
import React, { useState, useEffect } from 'react';
import { useAccount, useContractWrite, usePrepareContractWrite, useContractRead } from 'wagmi';
import { VOTING_ROUTER_ADDRESS, VOTING_ROUTER_ABI } from '../config/contracts';

// Enum for phases from contract (mirroring AdminPanel)
const PHASES = {
  REGISTRATION: 0,
  VOTING: 1,
  FINISHED: 2,
};

const Voting = () => {
  const { address } = useAccount();
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [error, setError] = useState('');
  const [justVoted, setJustVoted] = useState(false);

  // Fetch candidates dynamically
  const { data: candidatesData, isLoading: isLoadingCandidates } = useContractRead({
    address: VOTING_ROUTER_ADDRESS,
    abi: VOTING_ROUTER_ABI,
    functionName: 'getCandidates',
    enabled: !!VOTING_ROUTER_ADDRESS,
    watch: false, // Candidates list is usually static per deployment/voting session
  });
  const candidates = candidatesData || [];


  const { data: contractAdmin } = useContractRead({
    address: VOTING_ROUTER_ADDRESS,
    abi: VOTING_ROUTER_ABI,
    functionName: 'admin',
    enabled: !!VOTING_ROUTER_ADDRESS && !!address, 
    watch: true,
  });

  const { data: currentPhaseData } = useContractRead({
    address: VOTING_ROUTER_ADDRESS,
    abi: VOTING_ROUTER_ABI,
    functionName: 'getPhase', // Changed from 'phase'
    enabled: !!VOTING_ROUTER_ADDRESS && !!address,
    watch: true,
  });
  const currentPhase = currentPhaseData !== undefined ? Number(currentPhaseData) : undefined;


  const isVotingOpen = currentPhase === PHASES.VOTING;

  const { data: userHasVoted, refetch: refetchVoteStatus } = useContractRead({
    address: VOTING_ROUTER_ADDRESS,
    abi: VOTING_ROUTER_ABI,
    functionName: 'hasVoted', // Reads the public mapping
    args: [address],
    enabled: !!address && !!VOTING_ROUTER_ADDRESS,
    blockTag: 'latest',
    staleTime: 1000,
  });

  const userHasActuallyVoted = userHasVoted === true;

  const { data: isRegisteredData } = useContractRead({
    address: VOTING_ROUTER_ADDRESS,
    abi: VOTING_ROUTER_ABI,
    functionName: 'isRegistered', // Changed from 'isVoter', calls the view function
    args: [address],
    enabled: !!address && !!VOTING_ROUTER_ADDRESS,
    blockTag: 'latest',
    staleTime: 1000,
  });
  const isRegistered = isRegisteredData === true;

  const { config: voteConfig } = usePrepareContractWrite({
    address: VOTING_ROUTER_ADDRESS,
    abi: VOTING_ROUTER_ABI,
    functionName: 'vote',
    args: [
      selectedCandidateId !== '' ? BigInt(selectedCandidateId) : undefined,
    ],
    enabled: !!address && selectedCandidateId !== '' && isRegistered && !userHasActuallyVoted && isVotingOpen && !!VOTING_ROUTER_ADDRESS,
  });

  const { 
    write: submitVote,
    isLoading: isVoting,
    isSuccess: voteSuccess
  } = useContractWrite({
    ...voteConfig,
    onSuccess: () => {
      setJustVoted(true);
      setTimeout(() => {
        refetchVoteStatus();
      }, 2000);
    },
    onError: (error) => {
      console.error('投票失敗:', error);
      setError(error.shortMessage || error.message || '投票失敗');
    }
  });

  const handleVote = async () => {
    if (selectedCandidateId === '') {
      setError('請選擇候選人');
      return;
    }
    if (!isVotingOpen) {
      setError('目前非投票時間。');
      return;
    }
    if (!isRegistered) {
      setError('您尚未註冊為選民');
      return;
    }
    if (userHasActuallyVoted) {
      setError('您已經投過票了');
      return;
    }
    try {
      setError('');
      await submitVote?.();
    } catch (err) {
      setError(err.shortMessage || err.message || '投票失敗');
    }
  };

  useEffect(() => {
    setJustVoted(false);
    setError('');
    setSelectedCandidateId('');
  }, [address]);

  useEffect(() => {
    if (voteSuccess && justVoted) {
      const timer = setTimeout(() => {
        setJustVoted(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [voteSuccess, justVoted]);

  const isOwner = address && contractAdmin && address.toLowerCase() === contractAdmin.toLowerCase();

  let content;
  if (isLoadingCandidates) {
    content = <p>正在讀取候選人列表...</p>;
  } else if (!address) {
    content = <p>請先連接錢包</p>;
  } else if (currentPhase === undefined) {
    content = <p>正在讀取投票階段...</p>;
  } else if (!isRegistered) {
    content = <p>您尚未註冊為選民，請先完成註冊</p>;
  } else if (!isVotingOpen) {
    content = <p>目前非投票時間。</p>;
  } else if (isOwner) {
    content = (
      <div className="owner-dashboard">
        <h3>🗳️ 投票監控</h3>
        <p>您是合約管理員。投票正在進行中。</p>
        {/* This section could show real-time (non-final) stats if available, or just a message */}
      </div>
    );
  } else if (userHasActuallyVoted && !justVoted) {
    content = (
      <div className="success-message">
        <p>✅ 您已成功投票。</p>
      </div>
    );
  } else {
    content = (
      <div>
        <label htmlFor="candidate-select">選擇候選人：</label>
        <select
          id="candidate-select"
          value={selectedCandidateId}
          onChange={(e) => setSelectedCandidateId(e.target.value)}
          disabled={isVoting || userHasActuallyVoted || isLoadingCandidates}
        >
          <option value="">請選擇候選人</option>
          {candidates.map((candidateName, index) => (
            <option key={candidateName} value={index}>
              {candidateName}
            </option>
          ))}
        </select>
        
        <button 
          onClick={handleVote}
          disabled={selectedCandidateId === '' || isVoting || !submitVote || userHasActuallyVoted || isLoadingCandidates}
        >
          {isVoting ? '投票中...' : '投票'}
        </button>
        
        {justVoted && <p className="success">🎉 投票成功！感謝您的參與。</p>}
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="voting-container">
      <h2>投票</h2>
      {content}
    </div>
  );
};

export default Voting;
