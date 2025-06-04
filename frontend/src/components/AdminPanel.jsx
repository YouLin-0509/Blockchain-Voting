import React, { useState, useEffect } from 'react';
import { useAccount, useContractWrite, usePrepareContractWrite, useContractRead } from 'wagmi';
import { CONTRACT_ADDRESSES, CONTRACT_ABIS, CONTRACT_OWNER, NETWORK_INFO } from '../config/contracts';

// 假設候選人列表與 Voting.jsx 一致
const CANDIDATES_LIST = ['候選人A', '候選人B', '候選人C']; // ID: 0, 1, 2

const AdminPanel = () => {
  const { address } = useAccount();
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isRedeploying, setIsRedeploying] = useState(false);

  // 檢查是否是合約擁有者
  const isOwner = address?.toLowerCase() === CONTRACT_OWNER.toLowerCase();

  // 讀取註冊狀態
  const { data: isRegistrationOpen, refetch: refetchRegistrationStatus } = useContractRead({
    address: CONTRACT_ADDRESSES.MANAGEMENT,
    abi: CONTRACT_ABIS.MANAGEMENT,
    functionName: 'isRegistrationOpen',
    enabled: !!address && isOwner,
    watch: true,
  });

  // 讀取已註冊選民數量
  const { data: votersCount, refetch: refetchVotersCount } = useContractRead({
    address: CONTRACT_ADDRESSES.MANAGEMENT,
    abi: CONTRACT_ABIS.MANAGEMENT,
    functionName: 'getRegisteredVotersCount',
    enabled: !!address && isOwner,
    watch: true,
  });

  // 準備關閉註冊交易
  const { config: closeRegistrationConfig } = usePrepareContractWrite({
    address: CONTRACT_ADDRESSES.MANAGEMENT,
    abi: CONTRACT_ABIS.MANAGEMENT,
    functionName: 'closeRegistration',
    enabled: !!address && isOwner && isRegistrationOpen,
  });

  // 執行關閉註冊交易
  const { 
    write: closeRegistration, 
    isLoading: isClosing 
  } = useContractWrite({
    ...closeRegistrationConfig,
    onSuccess: () => {
      setSuccessMessage('註冊已關閉！');
      refetchRegistrationStatus();
      refetchVotersCount();
    },
    onError: (error) => {
      console.error('關閉註冊失敗:', error);
      setError(error.message || '關閉註冊失敗');
    }
  });

  // --- CountingContract_Base 相關讀取 ---
  const { data: isVotingOpen, refetch: refetchVotingStatus } = useContractRead({
    address: CONTRACT_ADDRESSES.COUNTING, 
    abi: CONTRACT_ABIS.COUNTING,
    functionName: 'isVotingOpen',
    enabled: !!address && isOwner,
    watch: true,
  });

  // --- CountingContract_Base 相關寫入 (開啟投票) ---
  const { config: openVotingConfig } = usePrepareContractWrite({
    address: CONTRACT_ADDRESSES.COUNTING,
    abi: CONTRACT_ABIS.COUNTING,
    functionName: 'openVoting',
    enabled: !!address && isOwner && isRegistrationOpen === false && isVotingOpen === false,
  });

  const { 
    write: openVoting, 
    isLoading: isOpeningVoting 
  } = useContractWrite({
    ...openVotingConfig,
    onSuccess: () => {
      setSuccessMessage('投票已開啟！');
      refetchVotingStatus();
    },
    onError: (error) => {
      console.error('開啟投票失敗:', error);
      setError(error.message || '開啟投票失敗');
    }
  });

  // --- CountingContract_Base 相關寫入 (關閉投票) ---
  const { config: closeVotingConfig } = usePrepareContractWrite({
    address: CONTRACT_ADDRESSES.COUNTING,
    abi: CONTRACT_ABIS.COUNTING,
    functionName: 'closeVoting',
    enabled: !!address && isOwner && isVotingOpen === true,
  });

  const { 
    write: closeVoting, 
    isLoading: isClosingVoting 
  } = useContractWrite({
    ...closeVotingConfig,
    onSuccess: () => {
      setSuccessMessage('投票已關閉！結果現在可見。');
      refetchVotingStatus();
    },
    onError: (error) => {
      console.error('關閉投票失敗:', error);
      setError(error.message || '關閉投票失敗');
    }
  });

  const handleCloseRegistration = async () => {
    try {
      setError('');
      setSuccessMessage('');
      await closeRegistration?.();
    } catch (err) {
      setError(err.message || '關閉註冊失敗');
    }
  };

  const handleOpenVoting = async () => {
    try {
      setError('');
      setSuccessMessage('');
      await openVoting?.();
    } catch (err) {
      setError(err.message || '開啟投票操作失敗');
    }
  };

  const handleCloseVoting = async () => {
    try {
      setError('');
      setSuccessMessage('');
      await closeVoting?.();
    } catch (err) {
      setError(err.message || '關閉投票操作失敗');
    }
  };

  // 網頁端重新部署功能
  const handleRedeploy = async () => {
    if (!window.confirm('⚠️ 重新部署將重置所有資料，確定要繼續嗎？')) {
      return;
    }

    try {
      setIsRedeploying(true);
      setError('');
      setSuccessMessage('');

      // 調用後端重新部署API
      const response = await fetch('/api/redeploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestedBy: address
        })
      });

      if (response.ok) {
        setSuccessMessage('🔄 重新部署已啟動！請等待約30秒後刷新頁面。');
        
        // 輪詢檢查部署狀態
        const checkDeploymentStatus = setInterval(async () => {
          try {
            const statusResponse = await fetch('/deployment-status.json');
            if (statusResponse.ok) {
              const status = await statusResponse.json();
              if (status.isDeployed && status.lastDeployment) {
                const deploymentTime = new Date(status.lastDeployment);
                const now = new Date();
                if (now - deploymentTime < 60000) { // 最近1分鐘內部署的
                  clearInterval(checkDeploymentStatus);
                  setSuccessMessage('✅ 重新部署完成！正在重新載入頁面...');
                  setTimeout(() => {
                    window.location.reload();
                  }, 2000);
                }
              }
            }
          } catch (err) {
            console.log('檢查部署狀態時出錯:', err);
          }
        }, 3000);

        // 30秒後停止輪詢
        setTimeout(() => {
          clearInterval(checkDeploymentStatus);
          if (isRedeploying) {
            setIsRedeploying(false);
            setSuccessMessage('部署可能需要更長時間，請手動刷新頁面檢查。');
          }
        }, 30000);

      } else {
        throw new Error('重新部署請求失敗');
      }
    } catch (err) {
      setError('重新部署失敗: ' + err.message);
      setIsRedeploying(false);
    }
  };

  // --- 讀取投票結果 ---
  // 為每個候選人讀取票數
  const candidateResults = CANDIDATES_LIST.map((candidateName, index) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { data: votes } = useContractRead({
      address: CONTRACT_ADDRESSES.COUNTING,
      abi: CONTRACT_ABIS.COUNTING,
      functionName: 'getVotesForCandidate',
      args: [BigInt(index)],
      enabled: !!address && isOwner && isVotingOpen === false, // 只有投票結束後才顯示/刷新結果
      watch: true,
    });
    return { name: candidateName, id: index, votes: votes?.toString() || '0' };
  });

  if (!isOwner) {
    return <p>您不是合約擁有者，無法訪問管理面板。</p>;
  }

  return (
    <div className="admin-panel">
      <h2>管理面板</h2>
      
      <div className="admin-info">
        <p>已註冊選民數量: {votersCount?.toString() || '0'}</p>
        <p>註冊狀態: {isRegistrationOpen ? '開放中' : '已關閉'}</p>
        <p>合約擁有者: {CONTRACT_OWNER}</p>
        <p>部署網路: {NETWORK_INFO.name} ({NETWORK_INFO.systemType})</p>
        <p>部署時間: {new Date(NETWORK_INFO.deployedAt).toLocaleString()}</p>
      </div>
      
      <div className="admin-actions">
        <div className="action-section">
          <h3>註冊管理</h3>
          <button 
            onClick={handleCloseRegistration}
            disabled={isClosing || isRegistrationOpen === false || !closeRegistration}
          >
            {isClosing ? '處理中...' : '關閉註冊'}
          </button>
        </div>

        <div className="action-section">
          <h3>投票管理</h3>
          <button 
            onClick={handleOpenVoting}
            disabled={isOpeningVoting || isRegistrationOpen === true || isVotingOpen === true || !openVoting}
            title={isRegistrationOpen === true ? "需先關閉註冊才能開啟投票" : ""}
          >
            {isOpeningVoting ? '處理中...' : '開啟投票'}
          </button>
          <button 
            onClick={handleCloseVoting}
            disabled={isClosingVoting || isVotingOpen === false || !closeVoting}
          >
            {isClosingVoting ? '處理中...' : '關閉投票'}
          </button>
        </div>

        <div className="action-section">
          <h3>📊 選舉結果 (Base System)</h3>
          {isVotingOpen === true && <p>投票仍在進行中，結果將在投票關閉後顯示。</p>}
          {isVotingOpen === false && (
            <table>
              <thead>
                <tr>
                  <th>候選人 ID</th>
                  <th>候選人名稱</th>
                  <th>得票數</th>
                </tr>
              </thead>
              <tbody>
                {candidateResults.map(candidate => (
                  <tr key={candidate.id}>
                    <td>{candidate.id}</td>
                    <td>{candidate.name}</td>
                    <td>{candidate.votes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!isOwner && <p>只有合約擁有者才能查看即時結果。</p>}
        </div>

        <div className="action-section danger-section">
          <h3>🔄 重新部署系統</h3>
          <p className="warning-text">⚠️ 此操作將重置所有資料並重新啟動區塊鏈</p>
          <button 
            onClick={handleRedeploy}
            disabled={isRedeploying}
            className="redeploy-btn"
          >
            {isRedeploying ? '🔄 部署中...' : '🔄 一鍵重新部署'}
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {successMessage && <p className="success">{successMessage}</p>}
    </div>
  );
};

export default AdminPanel;
