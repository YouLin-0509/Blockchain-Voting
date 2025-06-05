import React from 'react';
import { WagmiConfig, createConfig, configureChains } from 'wagmi';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Registration from './components/Registration';
import Voting from './components/Voting';
import AdminPanel from './components/AdminPanel';
import './App.css';

// 自定義 hardhat 鏈
const hardhatChain = {
  id: 31337,
  name: 'Hardhat',
  network: 'hardhat',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
    public: { http: ['http://127.0.0.1:8545'] },
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://etherscan.io' },
  },
  testnet: true,
};

// 配置 wagmi
const { chains, publicClient } = configureChains(
  [hardhatChain],
  [
    jsonRpcProvider({
      rpc: (chain) => {
        if (chain.id === hardhatChain.id) {
          return { http: chain.rpcUrls.default.http[0] };
        }
        return null; // 理論上不應該執行到這裡，因為只有 hardhatChain
      },
    }),
  ]
);

const config = createConfig({
  autoConnect: true,
  publicClient,
  connectors: [
    new MetaMaskConnector({ chains })
  ]
});

// 創建 React Query 客戶端
const queryClient = new QueryClient();

function App() {
  return (
    <WagmiConfig config={config}>
      <QueryClientProvider client={queryClient}>
        <div className="App">
          <header className="App-header">
            <h1>區塊鏈投票系統</h1>
          </header>
          <main>
            <div className="container">
              <section className="section">
                <Registration />
              </section>
              <section className="section">
                <Voting />
              </section>
              <section className="section">
                <AdminPanel />
              </section>
            </div>
          </main>
        </div>
      </QueryClientProvider>
    </WagmiConfig>
  );
}

export default App;
