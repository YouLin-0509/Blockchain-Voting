import { useContractRead } from "wagmi";
import { VOTING_ADDRESS, VOTING_ABI } from "../config/contracts";

export function usePhase() {
  const { data } = useContractRead({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "phase",
    watch: true,
  });
  // Phase enum to string helper
  return Number(data ?? 0); // 0: Register, 1: Voting, 2: Ended
} 