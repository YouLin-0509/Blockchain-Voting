const { ethers, artifacts } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Hardhat 預設私鑰列表
const HARDHAT_PRIVATE_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
  "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
  "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97",
  "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6",
  "0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897",
  "0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82",
  "0xa267530f49f8280200edf313ee7af6b827f2a8bce2897751d06a843f644967b1",
  "0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd",
  "0xc526ee95bf44d8fc405a158bb884d9d1238d99f0612e9f33d006bb0789009aaa",
  "0x8166f546bab6da521a8369cab06c5d2b9e46670292d85c875ee9ec20e84ffb61",
  "0xea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0",
  "0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd",
  "0xde9be858da4a475276426320d5e9262ecfc3ba460bfac56360bfa6c4c28b4ee0",
  "0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e"
];

async function main() {
  console.log("開始部署智能合約...");

  console.log("\n🗑️ 清除舊的部署檔案...");
  const deploymentsDir = "deployments";
  if (fs.existsSync(deploymentsDir)) {
    const files = fs.readdirSync(deploymentsDir);
    const oldFiles = files.filter(file => file.endsWith('.json'));
    oldFiles.forEach(file => {
      fs.unlinkSync(path.join(deploymentsDir, file));
      console.log(`已刪除: ${file}`);
    });
    console.log(`共清除 ${oldFiles.length} 個舊檔案`);
  }

  const [deployer] = await ethers.getSigners();
  console.log("\n使用部署者地址:", deployer.address);

  const signers = await ethers.getSigners();
  const accounts = [];
  console.log("\n📋 收集Hardhat預設帳號信息...");
  for (let i = 0; i < Math.min(signers.length, 20); i++) {
    const signer = signers[i];
    const balance = await ethers.provider.getBalance(signer.address);
    accounts.push({
      index: i,
      address: signer.address,
      privateKey: i < HARDHAT_PRIVATE_KEYS.length ? HARDHAT_PRIVATE_KEYS[i] : "未知",
      balance: ethers.formatEther(balance) + " ETH",
      role: i === 0 ? "合約擁有者" : "一般用戶"
    });
  }

  console.log("\n部署 ManagementContract...");
  const ManagementContractFactory = await ethers.getContractFactory("ManagementContract");
  const managementContract = await ManagementContractFactory.deploy();
  await managementContract.waitForDeployment();
  const managementAddress = await managementContract.getAddress();
  console.log("ManagementContract 已部署至:", managementAddress);

  try {
    console.log("\n🔍 測試 ManagementContract.isRegistrationOpen()...");
    const isOpen = await managementContract.isRegistrationOpen();
    console.log(`➡️ isRegistrationOpen() 返回: ${isOpen}`);
    if (isOpen === undefined) {
        console.error("❌ isRegistrationOpen() 返回 undefined，這不應該發生！");
    } else if (isOpen) {
        console.log("✅ 註冊應為開放狀態 (true)。");
    } else {
        console.log("⚠️ 註冊應為開放狀態，但返回 false。請檢查合約初始狀態。");
    }
  } catch (e) {
    console.error("❌ 測試 isRegistrationOpen() 時發生錯誤:", e);
  }

  console.log("\n部署 CountingContract...");
  const CountingContractFactory = await ethers.getContractFactory("CountingContract");
  const countingContract = await CountingContractFactory.deploy();
  await countingContract.waitForDeployment();
  const countingAddress = await countingContract.getAddress();
  console.log("CountingContract 已部署至:", countingAddress);

  console.log("\n ABI 檔案複製中...");
  const frontendAbisDir = path.join(__dirname, "../frontend/src/abis");
  if (!fs.existsSync(frontendAbisDir)) {
    fs.mkdirSync(frontendAbisDir, { recursive: true });
    console.log(`已創建目錄: ${frontendAbisDir}`);
  }

  const managementArtifact = artifacts.readArtifactSync("ManagementContract");
  fs.writeFileSync(
    path.join(frontendAbisDir, "ManagementContract.json"),
    JSON.stringify(managementArtifact, null, 2)
  );
  console.log(`ManagementContract ABI 已複製至: ${path.join(frontendAbisDir, "ManagementContract.json")}`);

  const countingArtifact = artifacts.readArtifactSync("CountingContract");
  fs.writeFileSync(
    path.join(frontendAbisDir, "CountingContract.json"),
    JSON.stringify(countingArtifact, null, 2)
  );
  console.log(`CountingContract ABI 已複製至: ${path.join(frontendAbisDir, "CountingContract.json")}`);
  console.log("ABI 檔案複製完成。");

  const deploymentTimestamp = new Date();
  const deploymentInfo = {
    network: network.name,
    deployer: deployer.address,
    contracts: {
      ManagementContract: managementAddress,
      CountingContract: countingAddress
    },
    accounts: accounts.map(acc => ({ index: acc.index, address: acc.address, balance: acc.balance, role: acc.role })),
    timestamp: deploymentTimestamp.toISOString()
  };

  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  const deploymentPath = path.join(deploymentsDir, `${network.name}-deployment-${deploymentTimestamp.getTime()}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n部署資訊已保存至: ${deploymentPath}`);

  const accountsInfo = {
    network: network.name,
    deploymentTime: deploymentTimestamp.toISOString(),
    note: "Hardhat 本地開發網路預設帳號",
    warning: "⚠️ 這些帳號和私鑰是公開的，僅用於開發測試！",
    totalAccounts: accounts.length,
    accounts: accounts // 包含私鑰
  };
  const accountsPath = path.join(deploymentsDir, `hardhat-accounts-${deploymentTimestamp.getTime()}.json`);
  fs.writeFileSync(accountsPath, JSON.stringify(accountsInfo, null, 2));
  console.log(`帳號資訊已保存至: ${accountsPath}`);

  const frontendConfigPath = path.join(__dirname, "../frontend/src/config/contracts.js");
  const configContent = `// 自動生成 - ${deploymentTimestamp.toLocaleString()}
// 導入 ABI (從 src/abis 目錄)
import ManagementContractABI_JSON from '../abis/ManagementContract.json';
import CountingContractABI_JSON from '../abis/CountingContract.json';

export const CONTRACT_ADDRESSES = {
  MANAGEMENT: "${managementAddress}",
  COUNTING: "${countingAddress}"
};

export const CONTRACT_OWNER = "${deployer.address}";

export const NETWORK_INFO = {
  name: "${network.name || 'hardhat'}",
  deployer: "${deployer.address}",
  deployedAt: "${deploymentTimestamp.toISOString()}"
};

export const CONTRACT_ABIS = {
  MANAGEMENT: ManagementContractABI_JSON.abi,
  COUNTING: CountingContractABI_JSON.abi
};

export const CONTRACT_CONFIGS = {
  MANAGEMENT: {
    address: CONTRACT_ADDRESSES.MANAGEMENT,
    abi: CONTRACT_ABIS.MANAGEMENT
  },
  COUNTING: {
    address: CONTRACT_ADDRESSES.COUNTING,
    abi: CONTRACT_ABIS.COUNTING
  }
};
`;
  fs.writeFileSync(frontendConfigPath, configContent);
  console.log(`\n前端配置已更新: ${frontendConfigPath}`);
  
  const deploymentStatusPath = path.join(__dirname, "../frontend/public/deployment-status.json");
  const statusInfo = {
    isDeployed: true,
    lastDeployment: deploymentTimestamp.toISOString(),
    contracts: {
      management: managementAddress,
      counting: countingAddress
    },
    owner: deployer.address,
    network: network.name || 'hardhat',
    accountsCount: accounts.length
  };
  fs.writeFileSync(deploymentStatusPath, JSON.stringify(statusInfo, null, 2));
  console.log(`部署狀態已更新: ${deploymentStatusPath}`);

  console.log("\n部署摘要:");
  console.log("----------------------------------------");
  console.log("網路:", network.name || 'hardhat');
  console.log("部署者:", deployer.address);
  console.log("ManagementContract:", managementAddress);
  console.log("CountingContract:", countingAddress);
  console.log("部署時間:", deploymentTimestamp.toLocaleString());
  console.log("----------------------------------------");

  console.log("\n💰 Hardhat 帳號摘要 (前5個):");
  console.log("----------------------------------------");
  accounts.slice(0, 5).forEach(acc => {
    console.log(`Account #${acc.index}: ${acc.address} (${acc.balance})`);
  });
  if (accounts.length > 5) {
    console.log(`... 還有 ${accounts.length - 5} 個帳號`);
  }
  console.log("----------------------------------------");
  console.log(`📁 完整帳號信息（含私鑰）已保存至: ${accountsPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("部署過程中發生錯誤:", error);
    process.exit(1);
  });
