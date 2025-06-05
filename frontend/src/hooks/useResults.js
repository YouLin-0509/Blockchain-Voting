import { useContractRead } from "wagmi";
import { VOTING_ADDRESS, VOTING_ABI } from "../config/contracts";

export function useResults(enabled) {
  return useContractRead({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "allResults",
    enabled,
    watch: false,
  });
} 