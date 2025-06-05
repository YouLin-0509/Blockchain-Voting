// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VerangeVerifier
 * @notice Provides functions to verify VeRange Type-1 range proofs.
 * @dev This contract will implement the verifier logic for VeRange Type-1.
 * The verifier checks if a given proof is valid for a commitment
 * and that the committed value lies within a specified range [0, 2^N - 1].
 */
contract VerangeVerifier {
    // Struct to represent a point on the alt_bn128 curve (G1 elements)
    struct Point {
        uint256 x;
        uint256 y;
    }

    // Curve parameters for alt_bn128 (BN254)
    // Prime field modulus
    uint256 internal constant FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Curve order (subgroup order)
    uint256 internal constant CURVE_ORDER = 21888242871839275222246405745257275088614511777268538073601725287587578984328;

    // Generator points (to be defined or set in constructor)
    Point internal G; // Main generator
    Point internal Q; // Secondary generator for Pedersen commitments
    Point[] internal H; // Generators H_j for the vector components

    // N: bit length of the range, e.g., N=64 for [0, 2^64-1]
    // J, K: dimensions for the proof, J*K >= N, J approx K approx sqrt(N)
    uint256 internal N_BITS;
    uint256 internal J_DIM;
    uint256 internal K_DIM;

    // Error messages
    string internal constant ERR_INVALID_PROOF = "VerangeVerifier: Invalid proof"; // Not directly used in this version after refactor, but good to keep
    string internal constant ERR_INVALID_POINT = "VerangeVerifier: Invalid point on curve";
    string internal constant ERR_DIMENSIONS_MISMATCH = "VerangeVerifier: Dimensions mismatch";
    string internal constant ERR_EPSILON_ZERO = "VerangeVerifier: Epsilon zero";

    /**
     * @notice Checks if a point is on the alt_bn128 curve (y^2 = x^3 + 3).
     * @param p The point to check.
     * @return True if the point is on the curve and coordinates are valid, false otherwise.
     */
    function isOnCurve(Point memory p) internal pure returns (bool) {
        if (p.x >= FIELD_MODULUS || p.y >= FIELD_MODULUS) {
            return false;
        }
        uint256 y_squared = mulmod(p.y, p.y, FIELD_MODULUS);
        uint256 x_cubed = mulmod(mulmod(p.x, p.x, FIELD_MODULUS), p.x, FIELD_MODULUS);
        return y_squared == addmod(x_cubed, 3, FIELD_MODULUS);
    }

    constructor(
        Point memory _G,
        Point memory _Q,
        Point[] memory _H_generators,
        uint256 _nBits
    ) {
        if (!isOnCurve(_G)) revert(ERR_INVALID_POINT);
        if (!isOnCurve(_Q)) revert(ERR_INVALID_POINT);
        for (uint i = 0; i < _H_generators.length; i++) {
            if (!isOnCurve(_H_generators[i])) revert(ERR_INVALID_POINT);
        }

        G = _G;
        Q = _Q;
        H = _H_generators;
        N_BITS = _nBits;

        if (_nBits == 0) {
            J_DIM = 0;
            K_DIM = 0;
        } else {
            uint256 sqrt_n = 0;
            uint256 temp_j = 1;
            // Calculate J = ceil(sqrt(N_BITS))
            while(temp_j * temp_j < _nBits) {
                temp_j++;
            }
            sqrt_n = temp_j;
            J_DIM = sqrt_n;
            // Calculate K = ceil(N_BITS / J_DIM)
            K_DIM = (_nBits + J_DIM - 1) / J_DIM; // Ensure K_DIM * J_DIM >= N_BITS
        }

        if (H.length != J_DIM) {
            // This check is crucial: H array must match J_DIM.
            // For N_BITS=0, J_DIM=0, so H.length must be 0.
            revert(ERR_DIMENSIONS_MISMATCH);
        }
    }

    /**
     * @notice Core verification logic for a single VeRange Type-1 proof.
     * @dev This internal function is called by verifyVeRange and potentially by batch verification logic.
     *      It assumes point validation (isOnCurve) and input array length checks have been done by the caller.
     *      It does not perform isOnCurve checks or array length checks against K_DIM/J_DIM itself
     *      to save gas when called internally by a trusted function.
     * @param W_points Array of K points W_k from the proof. Expected length K_DIM.
     * @param T_points Array of K points T_k from the proof. Expected length K_DIM.
     * @param R_point Point R from the proof.
     * @param S_point Point S from the proof.
     * @param eta1 Scalar eta1 from the proof.
     * @param eta2 Scalar eta2 from the proof.
     * @param commitmentCmOmega The Pedersen commitment Cm(omega) to the secret value.
     * @param v_prime_scalars Array of K scalars v'_k. Expected length K_DIM.
     * @param H_exponents For each H_j, the scalar exponent. Expected length J_DIM.
     * @return True if the proof is valid, false otherwise.
     */
    function _verifyCore(
        Point[] memory W_points,
        Point[] memory T_points,
        Point memory R_point,
        Point memory S_point,
        uint256 eta1,
        uint256 eta2,
        Point memory commitmentCmOmega,
        uint256[] memory v_prime_scalars,
        uint256[] memory H_exponents
    ) internal view returns (bool) {
        // Step 1: Compute Fiat-Shamir challenge epsilon_k
        // Transcript: commitmentCmOmega || W_1..W_K || T_1..T_K || R || S
        bytes memory transcript_data = abi.encodePacked(
            commitmentCmOmega.x, commitmentCmOmega.y,
            R_point.x, R_point.y,
            S_point.x, S_point.y
        );

        // K_DIM is used here; caller ensures W_points and T_points have this length.
        for (uint i = 0; i < K_DIM; ++i) {
            transcript_data = abi.encodePacked(transcript_data, W_points[i].x, W_points[i].y);
        }
        for (uint i = 0; i < K_DIM; ++i) {
            transcript_data = abi.encodePacked(transcript_data, T_points[i].x, T_points[i].y);
        }

        bytes32 e_hash = keccak256(transcript_data);
        uint256[] memory epsilon = new uint256[](K_DIM);

        if (K_DIM > 0) { // Only compute epsilon if K_DIM > 0
            for (uint k = 0; k < K_DIM; ++k) {
                epsilon[k] = uint256(keccak256(abi.encodePacked(e_hash, k))) % CURVE_ORDER;
                if (epsilon[k] == 0) {
                    epsilon[k] = uint256(keccak256(abi.encodePacked(e_hash, k, "retry"))) % CURVE_ORDER;
                    if (epsilon[k] == 0) revert(ERR_EPSILON_ZERO);
                }
            }
        }

        // Step 2: Perform verification checks (Equation 8 from paper, Fig 1 Verifier)

        // Check 1: (Prod_k W_k^epsilon_k) * R == G^(sum_k v'_k * epsilon_k) * Q^eta2
        // LHS1 = R + sum_k (epsilon_k * W_k)
        Point memory lhs1 = R_point; // Assumes R_point is on curve (checked by caller)
        // K_DIM is used here; caller ensures W_points and epsilon have this length.
        // v_prime_scalars also has K_DIM length.
        for (uint k = 0; k < K_DIM; ++k) {
            // W_points[k] is assumed on curve (checked by caller)
            Point memory term_W = ecmul(W_points[k], epsilon[k]);
            lhs1 = ecadd(lhs1, term_W);
        }

        // RHS1_G_exp = sum_k (v_prime_scalars[k] * epsilon_k)
        uint256 rhs1_G_exp = 0;
        for (uint k = 0; k < K_DIM; ++k) {
            // Ensure scalar arithmetic is modulo CURVE_ORDER
            uint256 term_prod = mulmod(v_prime_scalars[k], epsilon[k], CURVE_ORDER);
            rhs1_G_exp = addmod(rhs1_G_exp, term_prod, CURVE_ORDER);
        }
        // G and Q are assumed on curve (checked by constructor)
        Point memory rhs1_G_term = ecmul(G, rhs1_G_exp);
        Point memory rhs1_Q_term = ecmul(Q, eta2);
        Point memory rhs1 = ecadd(rhs1_G_term, rhs1_Q_term);

        if (lhs1.x != rhs1.x || lhs1.y != rhs1.y) {
            return false;
        }

        // Check 2: (Prod_k T_k^epsilon_k) * S == (Prod_j H_j^H_exponents[j]) * Q^eta1
        // LHS2 = S + sum_k (epsilon_k * T_k)
        Point memory lhs2 = S_point; // Assumes S_point is on curve (checked by caller)
        // K_DIM is used here; caller ensures T_points and epsilon have this length.
        for (uint k = 0; k < K_DIM; ++k) {
            // T_points[k] is assumed on curve (checked by caller)
            Point memory term_T = ecmul(T_points[k], epsilon[k]);
            lhs2 = ecadd(lhs2, term_T);
        }

        // RHS2_H_term = sum_j (H_exponents[j] * H_j)
        Point memory rhs2_H_term = Point(0,0); // Identity point for sum
        bool first_H_term = true;
        // J_DIM is used here; caller ensures H_exponents and H (state var) have this length.
        for (uint j = 0; j < J_DIM; ++j) {
            if (H_exponents[j] != 0) { // Only multiply if exponent is non-zero
                // H[j] is assumed on curve (checked by constructor)
                Point memory term_H_j = ecmul(H[j], H_exponents[j]);
                if (first_H_term) {
                    rhs2_H_term = term_H_j;
                    first_H_term = false;
                } else {
                    rhs2_H_term = ecadd(rhs2_H_term, term_H_j);
                }
            }
        }

        Point memory rhs2_Q_term = ecmul(Q, eta1); // Q assumed on curve
        Point memory rhs2;
        if (first_H_term) { // If rhs2_H_term remained identity (all H_exponents were 0 or J_DIM was 0)
            rhs2 = rhs2_Q_term;
        } else {
            rhs2 = ecadd(rhs2_H_term, rhs2_Q_term);
        }

        if (lhs2.x != rhs2.x || lhs2.y != rhs2.y) {
            return false;
        }

        // Eq. 9: Check sum_k W_k == Cm(omega)
        // Cm(omega) is assumed on curve (checked by caller)
        Point memory sum_W_k = Point(0, 0); // Initialize with identity point
        if (K_DIM > 0) {
            // K_DIM is used; caller ensures W_points has this length.
            for (uint k = 0; k < K_DIM; ++k) {
                // W_points[k] is assumed on curve (checked by caller)
                sum_W_k = ecadd(sum_W_k, W_points[k]);
            }
        }
        
        if (sum_W_k.x != commitmentCmOmega.x || sum_W_k.y != commitmentCmOmega.y) {
            return false; // Eq. 9 failed
        }

        return true; // All checks passed.
    }

    /**
     * @notice Verifies a VeRange Type-1 proof.
     * @param W_points Array of K points W_k from the proof.
     * @param T_points Array of K points T_k from the proof.
     * @param R_point Point R from the proof.
     * @param S_point Point S from the proof.
     * @param eta1 Scalar eta1 from the proof.
     * @param eta2 Scalar eta2 from the proof.
     * @param commitmentCmOmega The Pedersen commitment Cm(omega) to the secret value.
     * @param v_prime_scalars Array of K scalars v'_k.
     * @param H_exponents For each H_j, the scalar exponent.
     * @return True if the proof is valid, false otherwise.
     */
    function verifyVeRange(
        Point[] memory W_points,
        Point[] memory T_points,
        Point memory R_point,
        Point memory S_point,
        uint256 eta1,
        uint256 eta2,
        Point memory commitmentCmOmega,
        uint256[] memory v_prime_scalars,
        uint256[] memory H_exponents
    ) internal view returns (bool) {
        // --- Point Validation Checks ---
        if (!isOnCurve(commitmentCmOmega)) revert(ERR_INVALID_POINT);
        if (!isOnCurve(R_point)) revert(ERR_INVALID_POINT);
        if (!isOnCurve(S_point)) revert(ERR_INVALID_POINT);

        // Check array dimensions against contract's K_DIM and J_DIM
        if (W_points.length != K_DIM) revert(ERR_DIMENSIONS_MISMATCH);
        if (T_points.length != K_DIM) revert(ERR_DIMENSIONS_MISMATCH);
        if (v_prime_scalars.length != K_DIM) revert(ERR_DIMENSIONS_MISMATCH);
        if (H_exponents.length != J_DIM) revert(ERR_DIMENSIONS_MISMATCH);

        for (uint i = 0; i < K_DIM; i++) { // K_DIM is W_points.length and T_points.length
            if (!isOnCurve(W_points[i])) revert(ERR_INVALID_POINT);
            if (!isOnCurve(T_points[i])) revert(ERR_INVALID_POINT);
        }
        // --- End Point Validation & Dimension Checks ---

        // Call the core verification logic
        return _verifyCore(
            W_points,
            T_points,
            R_point,
            S_point,
            eta1,
            eta2,
            commitmentCmOmega,
            v_prime_scalars,
            H_exponents
        );
    }

    // Helper function for ecadd (y^2 = x^3 + 3 for alt_bn128 G1)
    // Address of precompile: 0x06
    function ecadd(Point memory p1, Point memory p2) internal view returns (Point memory r) {
        // Handle identity points explicitly to avoid precompile issues with (0,0)
        if (p1.x == 0 && p1.y == 0) return p2; // 0 + P = P
        if (p2.x == 0 && p2.y == 0) return p1; // P + 0 = P

        uint256[4] memory input = [p1.x, p1.y, p2.x, p2.y];
        bool success;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            success := staticcall(gas(), 0x06, input, 0x80, r, 0x40)
        }
        if (!success) {
            revert(ERR_INVALID_POINT); // Or a more specific ecadd error
        }
    }

    // Helper function for ecmul (scalar multiplication)
    // Address of precompile: 0x07
    function ecmul(Point memory p, uint256 s) internal view returns (Point memory r) {
        // Precompile 0x07 for ecmul.
        // Behavior for s=0: result is point at infinity (0,0).
        // Behavior for p=(0,0): result is point at infinity (0,0).
        
        if (s == 0 || (p.x == 0 && p.y == 0)) { 
            return Point(0, 0); // Point at infinity
        }

        // Ensure scalar s is within [1, CURVE_ORDER-1] if precompile requires it.
        // Solidity's % CURVE_ORDER on s would map it to [0, CURVE_ORDER-1].
        // If s % CURVE_ORDER is 0, then result is (0,0).
        uint256 scalar = s % CURVE_ORDER;
        if (scalar == 0) {
            return Point(0,0);
        }

        uint256[3] memory input = [p.x, p.y, scalar];
        bool success;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            success := staticcall(gas(), 0x07, input, 0x60, r, 0x40)
        }
        if (!success) {
            // This can happen if p is not on curve.
            revert(ERR_INVALID_POINT); // Or a more specific ecmul error
        }
    }
}