import { useContractRead } from "wagmi";
import { VOTING_ROUTER_ADDRESS, VOTING_ROUTER_ABI } from "../config/contracts";

export function usePhase() {
  const { data } = useContractRead({
    address: VOTING_ROUTER_ADDRESS,
    abi: VOTING_ROUTER_ABI,
    functionName: "getPhase",
    watch: true,
  });
  // Phase enum: 0: Register, 1: Voting, 2: Ended
  // The contract returns a uint8, which wagmi might return as BigInt.
  return Number(data ?? 0);
} 