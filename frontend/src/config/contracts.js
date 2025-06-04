// 自動生成 - 2025/6/5 上午1:39:41
// 導入 ABI (從 src/abis 目錄)
import ManagementContractABI_JSON from '../abis/ManagementContract.json';
import CountingContractABI_JSON from '../abis/CountingContract.json';

export const CONTRACT_ADDRESSES = {
  MANAGEMENT: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  COUNTING: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
};

export const CONTRACT_OWNER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

export const NETWORK_INFO = {
  name: "localhost",
  deployer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  deployedAt: "2025-06-04T17:39:41.801Z"
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
