import React, { useState } from 'react';
import { useAccount, useContractWrite, usePrepareContractWrite, useContractRead } from 'wagmi';
import { CONTRACT_ADDRESSES, CONTRACT_ABIS, CONTRACT_OWNER, NETWORK_INFO } from '../config/contracts';

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
  });

  // 讀取已註冊選民數量
  const { data: votersCount, refetch: refetchVotersCount } = useContractRead({
    address: CONTRACT_ADDRESSES.MANAGEMENT,
    abi: CONTRACT_ABIS.MANAGEMENT,
    functionName: 'getRegisteredVotersCount',
    enabled: !!address && isOwner,
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

  // 準備派發MPC交易
  const { config: dispatchMPCConfig } = usePrepareContractWrite({
    address: CONTRACT_ADDRESSES.MANAGEMENT,
    abi: CONTRACT_ABIS.MANAGEMENT,
    functionName: 'dispatchMPC',
    args: [votersCount || 0, 3], // 假設有3個候選人
    enabled: !!address && isOwner && !isRegistrationOpen && votersCount,
  });

  // 執行派發MPC交易
  const { 
    write: dispatchMPC, 
    isLoading: isDispatching 
  } = useContractWrite({
    ...dispatchMPCConfig,
    onSuccess: () => {
      setSuccessMessage('MPC 任務已派發！');
    },
    onError: (error) => {
      console.error('派發MPC失敗:', error);
      setError(error.message || '派發MPC失敗');
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

  const handleDispatchMPC = async () => {
    try {
      setError('');
      setSuccessMessage('');
      await dispatchMPC?.();
    } catch (err) {
      setError(err.message || '派發MPC失敗');
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
        <p>部署網路: {NETWORK_INFO.name}</p>
        <p>部署時間: {new Date(NETWORK_INFO.deployedAt).toLocaleString()}</p>
      </div>
      
      <div className="admin-actions">
        <div className="action-section">
          <h3>關閉註冊</h3>
          <button 
            onClick={handleCloseRegistration}
            disabled={isClosing || !isRegistrationOpen || !closeRegistration}
          >
            {isClosing ? '處理中...' : '關閉註冊'}
          </button>
        </div>

        <div className="action-section">
          <h3>派發 MPC 任務</h3>
          <button 
            onClick={handleDispatchMPC}
            disabled={isDispatching || isRegistrationOpen || !dispatchMPC}
          >
            {isDispatching ? '處理中...' : '派發 MPC 任務'}
          </button>
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
