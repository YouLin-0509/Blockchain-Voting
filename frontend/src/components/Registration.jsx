import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useContractWrite, usePrepareContractWrite, useContractRead } from 'wagmi';
import { VOTING_ROUTER_ADDRESS, VOTING_ROUTER_ABI } from '../config/contracts';

// Enum for phases from contract
const PHASES = {
  REGISTRATION: 0,
  VOTING: 1,
  FINISHED: 2,
};

function ConnectWallet() {
  const { connect, connectors, isLoading, pendingConnector } = useConnect();
  const { disconnect } = useDisconnect();
  const { address, isConnected } = useAccount();

  if (isConnected) {
    return (
      <div className="wallet-status">
        <p>您的錢包地址: {address}</p>
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
  const { address: currentUserAddress } = useAccount();
  const [error, setError] = useState('');
  const [justRegistered, setJustRegistered] = useState(false);

  const { data: contractAdminAddress, isLoading: isLoadingAdmin } = useContractRead({
    address: VOTING_ROUTER_ADDRESS,
    abi: VOTING_ROUTER_ABI,
    functionName: 'admin',
    enabled: !!VOTING_ROUTER_ADDRESS,
    watch: true,
  });

  const isAdmin = !isLoadingAdmin && currentUserAddress && contractAdminAddress && currentUserAddress.toLowerCase() === contractAdminAddress.toLowerCase();

  const { data: currentPhaseData, isLoading: isLoadingPhase, isError: isPhaseError } = useContractRead({
    address: VOTING_ROUTER_ADDRESS,
    abi: VOTING_ROUTER_ABI,
    functionName: 'getPhase',
    enabled: !!VOTING_ROUTER_ADDRESS && !!currentUserAddress,
    watch: true,
  });
  const currentPhase = currentPhaseData !== undefined ? Number(currentPhaseData) : undefined;

  const { data: isRegisteredData, refetch: refetchRegistration, isError: isRegistrationCheckError } = useContractRead({
    address: VOTING_ROUTER_ADDRESS,
    abi: VOTING_ROUTER_ABI,
    functionName: 'isRegistered',
    args: [currentUserAddress],
    enabled: !!currentUserAddress && !!VOTING_ROUTER_ADDRESS,
    blockTag: 'latest',
    staleTime: 1000, 
  });
  const isRegistered = isRegisteredData === true;

  const {
    config: registerConfig, 
    error: prepareError, 
    isError: isPrepareError, 
    isLoading: isLoadingPrepare,
  } = usePrepareContractWrite({
    address: VOTING_ROUTER_ADDRESS,
    abi: VOTING_ROUTER_ABI,
    functionName: 'register',
    args: [],
    enabled: !!currentUserAddress && !isRegistered && !isRegistrationCheckError && (currentPhase === PHASES.REGISTRATION) && !!VOTING_ROUTER_ADDRESS && !isLoadingAdmin && !isAdmin,
  });
  
  useEffect(() => {
    if (isPrepareError && !isLoadingAdmin && !isAdmin) {
      console.error('[DEBUG] 準備註冊交易失敗 (prepareError object):', prepareError);
      setError('準備註冊時出錯: ' + (prepareError?.shortMessage || prepareError?.message || '未知準備錯誤'));
    }
  }, [prepareError, isPrepareError, isAdmin, isLoadingAdmin]);

  const { 
    write: registerVoter, 
    isLoading: isRegistering,
    isSuccess: registerSuccess,
  } = useContractWrite({
    ...registerConfig,
    onSuccess: () => {
      console.log('[DEBUG] useContractWrite onSuccess for register');
      setJustRegistered(true);
      setTimeout(() => {
        refetchRegistration(); 
      }, 2000);
    },
    onError: (error) => {
      console.error('[DEBUG] useContractWrite onError for register:', error);
      let detailedMessage = '註冊失敗';
      if (error && typeof error.message === 'string') {
        if (error.message.includes("VotingRouter__AlreadyRegistered")) {
          detailedMessage = '您已經註冊過了';
        } else if (error.message.includes("VotingRouter__InvalidPhase")) {
          detailedMessage = '非註冊階段，無法註冊';
        } else if (error.shortMessage) {
          detailedMessage = error.shortMessage;
        } else {
          detailedMessage = error.message;
        }
      }
      setError(detailedMessage);
    }
  });

  const handleRegister = async () => {
    setError('');
    if (!currentUserAddress) {
      setError('請先連接錢包');
      return;
    }
    if (isLoadingAdmin) {
        setError('正在確認管理員身份，請稍候...');
        return;
    }
    if (isAdmin) {
        setError('管理員無法在此註冊為選民。');
        console.log('管理員嘗試透過 handleRegister 註冊，已阻止。');
        return;
    }
    if (isLoadingPhase) {
        setError('正在讀取註冊階段，請稍候...');
        return;
    }
    if (isPhaseError) {
        setError('無法讀取註冊階段，請刷新。');
        return;
    }
    if (currentPhase !== PHASES.REGISTRATION) {
      setError(`註冊目前未開放。(階段: ${currentPhase})`);
      return;
    }
    if (isRegistrationCheckError) {
      setError('無法檢查選民註冊狀態，請重新載入頁面');
      return;
    }
    if (isRegistered) {
      setError('您已經註冊過了。');
      return;
    }
    if (isLoadingPrepare) {
        setError('正在準備註冊交易，請稍候...');
        return;
    }
    if (isPrepareError || !registerConfig?.request) {
        setError('註冊配置準備失敗，請刷新頁面或稍後再試。' + (prepareError?.shortMessage || ''));
        return;
    }
    try {
      await registerVoter?.();
    } catch (err) {
      setError(err.shortMessage || err.message || '註冊時捕獲到意外錯誤');
    }
  };

  useEffect(() => {
    setJustRegistered(false);
    setError('');
  }, [currentUserAddress]);

  useEffect(() => {
    if (registerSuccess && justRegistered) {
      const timer = setTimeout(() => setJustRegistered(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [registerSuccess, justRegistered]);

  const isRegistrationOpen = currentPhase === PHASES.REGISTRATION;

  let statusContent;
  if (!currentUserAddress) {
    statusContent = <p>請先連接錢包進行註冊</p>;
  } else if (isLoadingPhase || isLoadingAdmin) {
    statusContent = <p>正在載入資料，請稍候...</p>;
  } else if (isAdmin) {
    statusContent = <div className="admin-message" style={{ padding: '10px', border: '1px solid #007bff', borderRadius: '5px', backgroundColor: '#e7f3ff', color: '#004085' }}><p><strong>管理員身份已確認。</strong><br />您無需在此頁面進行選民註冊。</p></div>;
  } else if (isPhaseError) {
    statusContent = <div className="error"><p>無法讀取註冊階段，請刷新頁面。</p></div>;
  } else if (isRegistrationCheckError) {
    statusContent = <div className="error"><p>無法檢查選民註冊狀態，請重新載入頁面。</p></div>;
  } else if (!isRegistrationOpen) {
    statusContent = <div className="error"><p>註冊已關閉或目前非註冊階段。</p></div>;
  } else if (isRegistered && !justRegistered) {
    statusContent = <div className="success-message"><p>✅ 您已註冊</p></div>;
  } else {
    statusContent = (
      <div>
        <button 
          onClick={handleRegister}
          disabled={isRegistering || isLoadingPrepare || !registerVoter || isRegistered || !isRegistrationOpen }
        >
          {isRegistering ? '註冊中...' : (isLoadingPrepare ? '準備中...' : '註冊為選民')}
        </button>
        {justRegistered && <p className="success">🎉 註冊成功！</p>}
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="registration-container">
      <h2>選民註冊</h2>
      <ConnectWallet />
      {statusContent}
    </div>
  );
};

export default Registration;
