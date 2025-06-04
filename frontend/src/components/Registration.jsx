import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useContractWrite, usePrepareContractWrite, useContractRead, usePublicClient } from 'wagmi';
import { CONTRACT_ADDRESSES, CONTRACT_ABIS, CONTRACT_OWNER } from '../config/contracts';
import { readContract } from '@wagmi/core'; // 更底層的調用

function ConnectWallet() {
  const { connect, connectors, isLoading, pendingConnector } = useConnect();
  const { disconnect } = useDisconnect();
  const { address, isConnected } = useAccount();

  if (isConnected) {
    const isOwner = address?.toLowerCase() === CONTRACT_OWNER.toLowerCase();
    
    return (
      <div className="wallet-status">
        <p>您的錢包地址: {address}</p>
        {isOwner && <p className="owner-badge">✓ 合約擁有者</p>}
        <button onClick={() => disconnect()} className="disconnect-btn">
          斷開連接
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-status">
      <p>您的錢包地址: 未連接</p>
      {connectors.map((connector) => (
        <button
          key={connector.id}
          onClick={() => connect({ connector })}
          disabled={!connector.ready || isLoading}
          className="connect-btn"
        >
          {isLoading && connector.id === pendingConnector?.id
            ? '連接中...'
            : `連接 ${connector.name}`}
        </button>
      ))}
    </div>
  );
}

const Registration = () => {
  const { address } = useAccount();
  const [error, setError] = useState('');
  const [justRegistered, setJustRegistered] = useState(false);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(undefined);
  const [isCheckingRegistrationOpen, setIsCheckingRegistrationOpen] = useState(true);

  // 檢查是否已註冊（從智能合約讀取）
  const { data: isRegistered, refetch: refetchRegistration, isError: isRegistrationError } = useContractRead({
    address: CONTRACT_ADDRESSES.MANAGEMENT,
    abi: CONTRACT_ABIS.MANAGEMENT,
    functionName: 'isVoterRegistered',
    args: [address],
    enabled: !!address,
    blockTag: 'latest',
    staleTime: 1000, 
  });

  // 手動檢查註冊是否開放
  useEffect(() => {
    const checkStatus = async () => {
      setIsCheckingRegistrationOpen(true);
      setError(''); // 清除之前的錯誤
      try {
        console.log('[DEBUG] 嘗試手動讀取 isRegistrationOpen...');
        const data = await readContract({
          address: CONTRACT_ADDRESSES.MANAGEMENT,
          abi: CONTRACT_ABIS.MANAGEMENT,
          functionName: 'isRegistrationOpen',
          blockTag: 'latest',
        });
        console.log('[DEBUG] 手動 isRegistrationOpen 返回:', data);
        setIsRegistrationOpen(data);
      } catch (err) {
        console.error('[DEBUG] 手動讀取 isRegistrationOpen 失敗:', err);
        setError('無法獲取註冊開放狀態: ' + (err.shortMessage || err.message));
        setIsRegistrationOpen(false); 
      }
      setIsCheckingRegistrationOpen(false);
    };
    checkStatus();
  }, []); 

  // 準備註冊交易
  const {
    config: registerConfig, 
    error: prepareError, 
    isError: isPrepareError, 
    isLoading: isLoadingPrepare,
    status: prepareStatus
  } = usePrepareContractWrite({
    address: CONTRACT_ADDRESSES.MANAGEMENT,
    abi: CONTRACT_ABIS.MANAGEMENT,
    functionName: 'register',
    args: ['0x', '0x'],
    enabled: !!address && !isRegistered && !isRegistrationError && isRegistrationOpen === true,
  });
  
  useEffect(() => {
    console.log('[DEBUG] usePrepareContractWrite status:', prepareStatus);
    if (isPrepareError) {
      console.error('[DEBUG] 準備註冊交易失敗 (prepareError object):', prepareError);
      setError('準備註冊時出錯: ' + (prepareError.shortMessage || prepareError.message));
    }
    if (registerConfig) {
      console.log('[DEBUG] 準備好的註冊交易配置 (registerConfig):', registerConfig);
    } else {
      console.log('[DEBUG] registerConfig 尚未準備好或為 undefined。');
    }
  }, [prepareError, isPrepareError, registerConfig, prepareStatus]);

  const { 
    write: registerVoter, 
    isLoading: isRegistering,
    isSuccess: registerSuccess,
    status: writeStatus,
    error: writeError
  } = useContractWrite({
    ...registerConfig,
    onSuccess: () => {
      console.log('[DEBUG] useContractWrite onSuccess');
      setJustRegistered(true);
      setTimeout(() => {
        refetchRegistration(); 
      }, 2000);
    },
    onError: (error) => {
      console.error('[DEBUG] useContractWrite onError:', error);
      let detailedMessage = '註冊失敗';
      if (error && typeof error.message === 'string') {
        if (error.message.includes("Voter already registered")) {
          detailedMessage = '您已經註冊過了';
        } else if (error.message.includes("Registration is closed")) {
          detailedMessage = '註冊已關閉';
        } else if (error.shortMessage) {
          detailedMessage = error.shortMessage;
        } else {
          detailedMessage = error.message;
        }
      }
      setError(detailedMessage);
    }
  });

  useEffect(() => {
    console.log('[DEBUG] useContractWrite status:', writeStatus);
    if (writeError) {
        console.error('[DEBUG] useContractWrite error state:', writeError);
    }
  }, [writeStatus, writeError]);

  const handleRegister = async () => {
    console.log('[DEBUG] handleRegister 點擊');
    setError(''); // 清除之前的錯誤

    if (!address) {
      setError('請先連接錢包');
      return;
    }
    if (isCheckingRegistrationOpen) {
      setError('正在檢查註冊狀態，請稍候...');
      return;
    }
    if (isRegistrationError) {
      setError('無法檢查選民註冊狀態，請重新載入頁面');
      return;
    }
    if (isRegistrationOpen !== true) {
      setError('註冊目前未開放或狀態未知。' + ` (isRegistrationOpen: ${isRegistrationOpen})`);
      return;
    }
    if (isRegistered) {
      setError('您已經註冊過了。');
      return;
    }

    console.log('[DEBUG] handleRegister 準備調用 registerVoter, isLoadingPrepare:', isLoadingPrepare, 'isPrepareError:', isPrepareError);
    console.log('[DEBUG] registerConfig 在 handleRegister 中:', registerConfig);

    if (isLoadingPrepare) {
        setError('正在準備註冊交易，請稍候...');
        return;
    }
    if (isPrepareError || !registerConfig?.request) { // 檢查 registerConfig.request 是否存在
        console.error("[DEBUG] Register config is not ready or has an error in handleRegister", registerConfig, prepareError);
        setError('註冊配置準備失敗，請刷新頁面或稍後再試。' + (prepareError?.shortMessage || ''));
        return;
    }

    try {
      console.log('[DEBUG] 即將調用 registerVoter()...');
      await registerVoter?.();
      console.log('[DEBUG] registerVoter() 調用完畢 (不代表成功，等待 onSuccess/onError)');
    } catch (err) {
      console.error('[DEBUG] handleRegister catch block error:', err);
      setError(err.shortMessage || err.message || '註冊時捕獲到意外錯誤');
    }
  };

  useEffect(() => {
    setJustRegistered(false);
    setError('');
  }, [address]);

  useEffect(() => {
    if (registerSuccess && justRegistered) {
      const timer = setTimeout(() => {
        setJustRegistered(false);
      }, 3000); 
      return () => clearTimeout(timer);
    }
  }, [registerSuccess, justRegistered]);

  if (isCheckingRegistrationOpen && isRegistrationOpen === undefined) {
    return <p>正在載入註冊狀態...</p>;
  }

  return (
    <div className="registration-container">
      <h2>選民註冊</h2>
      <ConnectWallet />
      {!address ? (
        <p>請先連接錢包進行註冊</p>
      ) : isRegistrationError ? (
        <div className="error">
          <p>無法檢查選民註冊狀態，請重新載入頁面或檢查網路連接</p>
        </div>
      ) : isRegistrationOpen === false ? (
        <div className="error">
          <p>註冊已關閉，無法進行新的註冊</p>
        </div>
      ) : isRegistered && !justRegistered ? (
        <div className="success-message">
          <p>已註冊</p>
        </div>
      ) : (
        <div>
          <button 
            onClick={handleRegister}
            disabled={!address || isRegistering || !registerVoter || isRegistered || isRegistrationOpen !== true || isPrepareError || isLoadingPrepare}
          >
            {isRegistering ? '註冊中...' : (isLoadingPrepare ? '準備中...' : '註冊為選民')}
          </button>
          {justRegistered && <p className="success">註冊成功！</p>}
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  );
};

export default Registration;
