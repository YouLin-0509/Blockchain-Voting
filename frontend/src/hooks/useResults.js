import { useContractRead } from "wagmi";
import { VOTING_ROUTER_ADDRESS, VOTING_ROUTER_ABI } from "../config/contracts";

export function useResults(enabled) {
  return useContractRead({
    address: VOTING_ROUTER_ADDRESS,
    abi: VOTING_ROUTER_ABI,
    functionName: "getResults",
    enabled,
    watch: false,
  });
} 