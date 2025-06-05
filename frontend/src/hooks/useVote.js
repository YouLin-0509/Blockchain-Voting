import { useContractWrite } from "wagmi";
import { VOTING_ADDRESS, VOTING_ABI } from "../config/contracts";

/** 對外暴露 vote(candidateId) */
export function useVote() {
  const { writeAsync, isLoading, error, data } = useContractWrite({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "vote",
  });
  return { vote: writeAsync, isLoading, error, data };
} 