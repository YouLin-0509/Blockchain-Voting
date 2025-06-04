import './App.css';
import { WagmiConfig, createConfig } from 'wagmi'; // Keep wagmi for wallet connect
import { ConnectKitProvider, ConnectKitButton, getDefaultConfig } from 'connectkit';
import { sepolia, mainnet, hardhat } from 'wagmi/chains';

import Registration from './components/Registration';
import Voting from './components/Voting';
import AdminPanel from './components/AdminPanel';

// Import the provider
import { MockBlockchainProvider } from './contexts/MockBlockchainContext';

const walletConnectProjectId = 'YOUR_WALLETCONNECT_PROJECT_ID';

const chains = [hardhat, sepolia, mainnet];

const config = createConfig(
  getDefaultConfig({
    appName: 'Blockchain E-Voting DApp',
    walletConnectProjectId,
    chains,
  })
);

function App() {
  return (
    <WagmiConfig config={config}> {/* Wagmi still needed for useAccount, ConnectKit */}
      <ConnectKitProvider>
        <MockBlockchainProvider> {/* Wrap main content with MockProvider */}
          <div className="App">
            <header className="App-header">
              <h1>Blockchain E-Voting System (Mocked Backend)</h1>
              <ConnectKitButton />
            </header>
            <main>
              <section>
                <Registration />
              </section>
              <section>
                <Voting />
              </section>
              <section>
                <AdminPanel />
              </section>
            </main>
          </div>
        </MockBlockchainProvider>
      </ConnectKitProvider>
    </WagmiConfig>
  );
}

export default App;
