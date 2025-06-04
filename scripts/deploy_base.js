const { ethers, artifacts, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Hardhat 預設私鑰列表 (與 deploy.js 相同，僅為演示目的，實際應用中應妥善管理)
const HARDHAT_PRIVATE_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  // ... (可以省略其餘私鑰以節省空間，假設 deployer 是第一個帳號)
];

async function main() {
  console.log("🚀 開始部署 Base-Voting-System 智能合約...");

  const deploymentsDir = "deployments";
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const [deployer] = await ethers.getSigners();
  console.log("\n👤 使用部署者地址:", deployer.address);

  // 收集帳號信息 (與 deploy.js 類似，簡化版)
  const signers = await ethers.getSigners();
  const accounts = [];
  for (let i = 0; i < Math.min(signers.length, 5); i++) { // 只顯示前5個
    const signer = signers[i];
    const balance = await ethers.provider.getBalance(signer.address);
    accounts.push({
      index: i,
      address: signer.address,
      balance: ethers.formatEther(balance) + " ETH",
      role: i === 0 ? "合約擁有者 (部署者)" : "一般用戶"
    });
  }

  console.log("\n🧱 部署 ManagementContract_Base...");
  const ManagementContract_BaseFactory = await ethers.getContractFactory("ManagementContract_Base");
  const managementContract_Base = await ManagementContract_BaseFactory.deploy();
  await managementContract_Base.waitForDeployment();
  const managementBaseAddress = await managementContract_Base.getAddress();
  console.log("✅ ManagementContract_Base 已部署至:", managementBaseAddress);

  console.log("\n🧱 部署 CountingContract_Base...");
  const CountingContract_BaseFactory = await ethers.getContractFactory("CountingContract_Base");
  // 將 ManagementContract_Base 的地址傳遞給 CountingContract_Base 的建構函數
  const countingContract_Base = await CountingContract_BaseFactory.deploy(managementBaseAddress);
  await countingContract_Base.waitForDeployment();
  const countingBaseAddress = await countingContract_Base.getAddress();
  console.log("✅ CountingContract_Base 已部署至:", countingBaseAddress);

  console.log("\n📄 ABI 檔案複製中 (基礎版本)...");
  const frontendAbisDir = path.join(__dirname, "../frontend/src/abis");
  if (!fs.existsSync(frontendAbisDir)) {
    fs.mkdirSync(frontendAbisDir, { recursive: true });
    console.log(`目錄已創建: ${frontendAbisDir}`);
  }

  const managementBaseArtifact = artifacts.readArtifactSync("ManagementContract_Base");
  fs.writeFileSync(
    path.join(frontendAbisDir, "ManagementContract_Base.json"), // 保存為 _Base.json
    JSON.stringify(managementBaseArtifact, null, 2)
  );
  console.log(`✅ ManagementContract_Base ABI 已複製至: ${path.join(frontendAbisDir, "ManagementContract_Base.json")}`);

  const countingBaseArtifact = artifacts.readArtifactSync("CountingContract_Base");
  fs.writeFileSync(
    path.join(frontendAbisDir, "CountingContract_Base.json"), // 保存為 _Base.json
    JSON.stringify(countingBaseArtifact, null, 2)
  );
  console.log(`✅ CountingContract_Base ABI 已複製至: ${path.join(frontendAbisDir, "CountingContract_Base.json")}`);
  console.log(" ABI 檔案複製完成。");

  const deploymentTimestamp = new Date();
  const deploymentInfo = {
    systemType: "Base-Voting-System",
    network: network.name,
    deployer: deployer.address,
    contracts: {
      ManagementContract_Base: managementBaseAddress,
      CountingContract_Base: countingBaseAddress
    },
    accounts: accounts.map(acc => ({ index: acc.index, address: acc.address, balance: acc.balance, role: acc.role })),
    timestamp: deploymentTimestamp.toISOString()
  };

  const deploymentPath = path.join(deploymentsDir, `${network.name}-deployment-base-${deploymentTimestamp.getTime()}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n💾 基礎系統部署資訊已保存至: ${deploymentPath}`);

  // 更新前端設定檔
  const frontendConfigPath = path.join(__dirname, "../frontend/src/config/contracts.js");
  const configContent = `// 自動生成 (Base-Voting-System) - ${deploymentTimestamp.toLocaleString()}
// 導入 ABI (從 src/abis 目錄)
// 注意：這裡我們導入 _Base.json 檔案
import ManagementContractABI_JSON from '../abis/ManagementContract_Base.json'; 
import CountingContractABI_JSON from '../abis/CountingContract_Base.json';

export const CONTRACT_ADDRESSES = {
  MANAGEMENT: "${managementBaseAddress}", // 指向 ManagementContract_Base
  COUNTING: "${countingBaseAddress}"   // 指向 CountingContract_Base
};

export const CONTRACT_OWNER = "${deployer.address}";

export const NETWORK_INFO = {
  name: "${network.name || 'hardhat'}",
  systemType: "Base-Voting-System", // 添加系統類型標識
  deployer: "${deployer.address}",
  deployedAt: "${deploymentTimestamp.toISOString()}"
};

export const CONTRACT_ABIS = {
  // ABI 鍵名保持不變，但內容來自 _Base.json
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
  console.log(`\n⚙️ 前端配置已更新以使用基礎系統: ${frontendConfigPath}`);
  
  const deploymentStatusPath = path.join(__dirname, "../frontend/public/deployment-status.json");
  const statusInfo = {
    isDeployed: true,
    systemType: "Base-Voting-System",
    lastDeployment: deploymentTimestamp.toISOString(),
    contracts: {
      management: managementBaseAddress,
      counting: countingBaseAddress
    },
    owner: deployer.address,
    network: network.name || 'hardhat',
    accountsCount: accounts.length
  };
  fs.writeFileSync(deploymentStatusPath, JSON.stringify(statusInfo, null, 2));
  console.log(`📊 部署狀態已更新 (基礎系統): ${deploymentStatusPath}`);

  console.log("\n📋 Base-Voting-System 部署摘要:");
  console.log("----------------------------------------");
  console.log("系統類型:", "Base-Voting-System");
  console.log("網路:", network.name || 'hardhat');
  console.log("部署者:", deployer.address);
  console.log("ManagementContract_Base:", managementBaseAddress);
  console.log("CountingContract_Base:", countingBaseAddress);
  console.log("部署時間:", deploymentTimestamp.toLocaleString());
  console.log("----------------------------------------");

  console.log("\n💰 Hardhat 帳號摘要 (前5個):");
  console.log("----------------------------------------");
  accounts.forEach(acc => {
    console.log(`Account #${acc.index}: ${acc.address} (${acc.balance})`);
  });
  console.log("----------------------------------------");

  console.log("\n🎉 Base-Voting-System 部署完成！ 🎉");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 部署基礎系統過程中發生錯誤:", error);
    process.exit(1);
  }); 