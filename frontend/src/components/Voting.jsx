/* global BigInt */
import React, { useState, useEffect } from 'react';
import { useAccount, useContractWrite, usePrepareContractWrite, useContractRead } from 'wagmi';
import { CONTRACT_ADDRESSES, CONTRACT_ABIS, CONTRACT_OWNER } from '../config/contracts';

const Voting = () => {
  const { address } = useAccount();
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [error, setError] = useState('');
  const [justVoted, setJustVoted] = useState(false);

  const candidates = ['候選人A', '候選人B', '候選人C'];

  // 檢查用戶是否已投票
  const { data: userHasVoted, refetch: refetchVoteStatus } = useContractRead({
    address: CONTRACT_ADDRESSES.COUNTING,
    abi: CONTRACT_ABIS.COUNTING,
    functionName: 'getHasVoted',
    args: [address],
    enabled: !!address,
    blockTag: 'latest',
    staleTime: 1000,
  });

  // 判斷用戶是否真的投過票
  const userHasActuallyVoted = userHasVoted === true;

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
    functionName: 'submitVote',
    args: [
      selectedCandidateId !== '' ? BigInt(selectedCandidateId) : undefined,
    ],
    enabled: !!address && selectedCandidateId !== '' && isRegistered && !userHasActuallyVoted,
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
    if (selectedCandidateId === '') {
      setError('請選擇候選人');
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
      setError(err.message || '投票失敗');
    }
  };

  // 當地址變化時重置狀態
  useEffect(() => {
    setJustVoted(false);
    setError('');
    setSelectedCandidateId('');
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
      ) : userHasActuallyVoted && !justVoted ? (
        <div className="success-message">
          <p>✅ 您已成功投票。</p>
        </div>
      ) : (
        <div>
          <label htmlFor="candidate-select">選擇候選人：</label>
          <select
            id="candidate-select"
            value={selectedCandidateId}
            onChange={(e) => setSelectedCandidateId(e.target.value)}
            disabled={isVoting}
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
            disabled={selectedCandidateId === '' || isVoting || !submitVote}
          >
            {isVoting ? '投票中...' : '投票'}
          </button>
          
          {justVoted && <p className="success">🎉 投票成功！感謝您的參與。</p>}
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  );
};

export default Voting;
