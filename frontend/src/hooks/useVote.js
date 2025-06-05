import { useContractWrite } from "wagmi";
import { VOTING_ROUTER_ADDRESS, VOTING_ROUTER_ABI } from "../config/contracts";

/** 對外暴露 vote({ args: [candidateId] }) */
export function useVote() {
  const { writeAsync, isLoading, error, data } = useContractWrite({
    address: VOTING_ROUTER_ADDRESS,
    abi: VOTING_ROUTER_ABI,
    functionName: "vote",
  });
  return { vote: writeAsync, isLoading, error, data };
} 