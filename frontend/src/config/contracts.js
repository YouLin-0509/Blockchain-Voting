// 自動生成 (Base-Voting-System) - 2025/6/5 上午5:40:39
// 導入 ABI (從 src/abis 目錄)
// 注意：這裡我們導入 _Base.json 檔案
import ManagementContractABI_JSON from '../abis/ManagementContract_Base.json'; 
import CountingContractABI_JSON from '../abis/CountingContract_Base.json';

export const CONTRACT_ADDRESSES = {
  MANAGEMENT: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0", // 指向 ManagementContract_Base
  COUNTING: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"   // 指向 CountingContract_Base
};

export const CONTRACT_OWNER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

export const NETWORK_INFO = {
  name: "localhost",
  systemType: "Base-Voting-System", // 添加系統類型標識
  deployer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  deployedAt: "2025-06-04T21:40:39.862Z"
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
