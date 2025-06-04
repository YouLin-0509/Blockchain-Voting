import React, { useState, useEffect } from 'react';
import { useAccount, useContractWrite, usePrepareContractWrite, useContractRead } from 'wagmi';
import { CONTRACT_ADDRESSES, CONTRACT_ABIS, CONTRACT_OWNER } from '../config/contracts';
import { ethers } from 'ethers';

const Voting = () => {
  const { address } = useAccount();
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [error, setError] = useState('');
  const [justVoted, setJustVoted] = useState(false);

  const candidates = ['候選人A', '候選人B', '候選人C'];

  // 檢查用戶是否已投票
  const { data: hasVoted, refetch: refetchVoteStatus } = useContractRead({
    address: CONTRACT_ADDRESSES.COUNTING,
    abi: CONTRACT_ABIS.COUNTING,
    functionName: 'submittedBallots',
    args: [address],
    enabled: !!address,
    blockTag: 'latest',
    staleTime: 1000,
  });

  // 檢查用戶是否已註冊
  const { data: isRegistered } = useContractRead({
    address: CONTRACT_ADDRESSES.MANAGEMENT,
    abi: CONTRACT_ABIS.MANAGEMENT,
    functionName: 'isVoterRegistered',
    args: [address],
    enabled: !!address,
    blockTag: 'latest',
    staleTime: 1000,
  });

  // 準備投票交易
  const { config: voteConfig } = usePrepareContractWrite({
    address: CONTRACT_ADDRESSES.COUNTING,
    abi: CONTRACT_ABIS.COUNTING,
    functionName: 'submitBallot',
    args: [
      ethers.encodeBytes32String(selectedCandidate), // 將候選人名稱轉換為 bytes32
      '0x00' // 簡化版本，使用空的證明
    ],
    enabled: !!address && !!selectedCandidate && isRegistered && !hasVoted,
  });

  // 執行投票交易
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
      setError(error.message || '投票失敗');
    }
  });

  const handleVote = async () => {
    if (!selectedCandidate) {
      setError('請選擇候選人');
      return;
    }

    if (!isRegistered) {
      setError('您尚未註冊為選民');
      return;
    }

    if (hasVoted) {
      setError('您已經投過票了');
      return;
    }

    try {
      setError('');
      await submitVote?.();
    } catch (err) {
      setError(err.message || '投票失敗');
    }
  };

  // 當地址變化時重置狀態
  useEffect(() => {
    setJustVoted(false);
    setError('');
    setSelectedCandidate('');
  }, [address]);

  // 當投票成功時重置 justVoted 狀態（延遲執行）
  useEffect(() => {
    if (voteSuccess && justVoted) {
      const timer = setTimeout(() => {
        setJustVoted(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [voteSuccess, justVoted]);

  const isOwner = address?.toLowerCase() === CONTRACT_OWNER.toLowerCase();

  return (
    <div className="voting-container">
      <h2>投票</h2>
      
      {!address ? (
        <p>請先連接錢包</p>
      ) : !isRegistered ? (
        <p>您尚未註冊為選民，請先完成註冊</p>
      ) : isOwner ? (
        <div className="owner-dashboard">
          <h3>📊 投票結果管理</h3>
          <p>您是合約擁有者，可以查看投票統計</p>
          {/* 這裡會在管理面板中顯示詳細的投票結果 */}
        </div>
      ) : hasVoted && !justVoted ? (
        <div className="success-message">
          <p>已投票</p>
        </div>
      ) : (
        <div>
          <label htmlFor="candidate-select">選擇候選人：</label>
          <select
            id="candidate-select"
            value={selectedCandidate}
            onChange={(e) => setSelectedCandidate(e.target.value)}
            disabled={isVoting}
          >
            <option value="">請選擇候選人</option>
            {candidates.map(candidate => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </select>
          
          <button 
            onClick={handleVote}
            disabled={!selectedCandidate || isVoting || !submitVote}
          >
            {isVoting ? '投票中...' : '投票'}
          </button>
          
          {justVoted && <p className="success">投票成功！</p>}
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  );
};

export default Voting;
