// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IVerifier
 * @notice Interface for a generic proof verifier plugin.
 * This interface will be used by VotingRouter to call an external verifier contract.
 */
interface IVerifier {
    /**
     * @notice Verifies a generic proof. The exact type and structure of the proof
     * and public inputs will depend on the specific implementation (e.g., VerangeVerifier).
     * @dev For VeRange Type-1, this would correspond to the verifyVeRange function.
     *
     * @param W_points_x Array of K x-coordinates of W_k points from the proof.
     * @param W_points_y Array of K y-coordinates of W_k points from the proof.
     * @param T_points_x Array of K x-coordinates of T_k points from the proof.
     * @param T_points_y Array of K y-coordinates of T_k points from the proof.
     * @param R_point_x X-coordinate of point R from the proof.
     * @param R_point_y Y-coordinate of point R from the proof.
     * @param S_point_x X-coordinate of point S from the proof.
     * @param S_point_y Y-coordinate of point S from the proof.
     * @param eta1 Scalar eta1 from the proof.
     * @param eta2 Scalar eta2 from the proof.
     * @param commitmentCmOmega_x X-coordinate of the Pedersen commitment Cm(omega) to the secret value.
     * @param commitmentCmOmega_y Y-coordinate of the Pedersen commitment Cm(omega) to the secret value.
     * @param v_prime_scalars Array of K scalars v'_k.
     * @param H_exponents Array of J scalars, exponents for H_j in the second verification equation.
     *
     * @return True if the proof is valid, false otherwise.
     */
    function verifyVeRange(
        uint256[] memory W_points_x,
        uint256[] memory W_points_y,
        uint256[] memory T_points_x,
        uint256[] memory T_points_y,
        uint256 R_point_x,
        uint256 R_point_y,
        uint256 S_point_x,
        uint256 S_point_y,
        uint256 eta1,
        uint256 eta2,
        uint256 commitmentCmOmega_x,
        uint256 commitmentCmOmega_y,
        uint256[] memory v_prime_scalars,
        uint256[] memory H_exponents
    ) external view returns (bool);

    // Future: Could add a function to get verifier-specific parameters like N, J, K
    // function getVerifierParameters() external view returns (uint256 N, uint256 J, uint256 K);
}
