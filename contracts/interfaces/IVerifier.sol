// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVerifier {
    /**
     * @notice Verifies a proof with its public inputs.
     * @param proof The zk-SNARK proof.
     * @param publicInputs The public inputs настроение associated with the proof.
     * @return True if the proof is valid, false otherwise.
     */
    function verify(bytes calldata proof, bytes calldata publicInputs) external view returns (bool);
}
