// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./lib/VerangeCrypto.sol";

/**
 * @title VerangeVerifier
 * @author Gemini
 * @notice Verifies VeRange Type-1 proofs.
 */
contract VerangeVerifier {
    using VerangeCrypto for VerangeCrypto.Point;
    // No longer need `using VerangeCrypto for VerangeCrypto.Point[];` as multiScalarMul is a direct call

    struct Proof {
        VerangeCrypto.Point[] W;         // Array of K points
        VerangeCrypto.Point[] T;         // Array of K points
        VerangeCrypto.Point R;
        VerangeCrypto.Point S;
        uint256 eta1;
        uint256 eta2;
        uint256[] vMatrix; // Array of J*K scalars (v_{j,k} values flattened)
    }

    // --- Constants ---
    uint256 public constant J_DIM = 8; // Dimension J from VeRange spec
    uint256 public constant K_DIM = 8; // Dimension K from VeRange spec
    uint256 public constant N_BITS = J_DIM * K_DIM; // Total bits in range, also length of vMatrix

    uint256 private constant CURVE_ORDER = VerangeCrypto.CURVE_ORDER;

    VerangeCrypto.Point private G;          // Base point G, (1,2)
    VerangeCrypto.Point private Q;          // Generator Q
    VerangeCrypto.Point[J_DIM] private H; // Generators H_j

    uint256[N_BITS] private POWER_OF_2; // POWER_OF_2[i] = 2^i

    // --- Constructor --- 
    constructor(
        VerangeCrypto.Point memory _Q, 
        VerangeCrypto.Point[J_DIM] memory _H
    ) {
        G = VerangeCrypto.Point(1, 2);
        // Add isOnCurve checks for G, Q, H_j if desired for security and gas permits
        // require(VerangeCrypto.isOnCurve(G), "G not on curve");
        // require(VerangeCrypto.isOnCurve(_Q), "Q not on curve");
        // for(uint j=0; j < J_DIM; j++){
        //     require(VerangeCrypto.isOnCurve(_H[j]), "H_j not on curve");
        // }
        Q = _Q;
        H = _H;

        for (uint256 i = 0; i < N_BITS; i++) {
            POWER_OF_2[i] = (1 << i); // Values are 2^i, not mod CURVE_ORDER
        }
    }

    // --- Public Verification Function ---
    function verifyVeRange(
        VerangeCrypto.Point calldata Cm,
        Proof calldata prf
    ) external view returns (bool) {
        if (prf.W.length != K_DIM || 
            prf.T.length != K_DIM || 
            prf.vMatrix.length != N_BITS) { // N_BITS is J_DIM * K_DIM
            return false;
        }
        return _verifyCore(Cm, prf);
    }

    // --- Core Verification Logic ---
    function _verifyCore(
        VerangeCrypto.Point calldata Cm,
        Proof calldata prf
    ) private view returns (bool) {
        // Optional: isOnCurve checks for Cm, prf.R, prf.S, prf.W[], prf.T[]
        // Can be added here if necessary, e.g.:
        // if (!VerangeCrypto.isOnCurve(Cm)) { return false; }

        // 1. Re-derive Fiat-Shamir challenges eps_k
        uint256[] memory eps = new uint256[](K_DIM);

        // Manually pack points for hashing, as abi.encodePacked doesn't handle struct arrays directly.
        bytes memory wBytes;
        for (uint256 k_idx = 0; k_idx < K_DIM; k_idx++) { // loop var k_idx to avoid conflict with outer k
            wBytes = abi.encodePacked(wBytes, prf.W[k_idx].x, prf.W[k_idx].y);
        }
        bytes memory tBytes;
        for (uint256 k_idx = 0; k_idx < K_DIM; k_idx++) { // loop var k_idx to avoid conflict with outer k
            tBytes = abi.encodePacked(tBytes, prf.T[k_idx].x, prf.T[k_idx].y);
        }

        bytes32 eHash = keccak256(
            abi.encodePacked(
                Cm.x,
                Cm.y,
                prf.R.x,
                prf.R.y,
                prf.S.x,
                prf.S.y,
                wBytes,
                tBytes
            )
        );
        
        for (uint256 k = 0; k < K_DIM; k++) {
            bytes memory seed = abi.encodePacked(eHash, bytes1(uint8(k)));
            uint256 epsk = uint256(keccak256(seed)) % CURVE_ORDER;
            if (epsk == 0) {
                epsk = 1; // Ensure non-zero
            }
            eps[k] = epsk;
        }

        // --- Temporary arrays for Check-1 calculations ---
        uint256[J_DIM] memory hExp; // hExp[j]
        uint256[K_DIM] memory vPrime; // vPrime[k] = sum_j v_{j,k}

        // --- Calculation for hExp[j] and vPrime[k] (part of Check-1 preparation) ---
        // User formula: 
        // u_{j,k} = (2^(k*J+j)) * eps_k - v_{j,k}  (mod CURVE_ORDER)
        // hExp[j] = Sum_k (v_{j,k} * u_{j,k})       (mod CURVE_ORDER)
        // vPrime[k] = Sum_j v_{j,k}                 (mod CURVE_ORDER)
        for (uint256 j = 0; j < J_DIM; j++) {
            uint256 current_hExp_j = 0;
            for (uint256 k = 0; k < K_DIM; k++) {
                // vMatrix is flattened: index is k*J_DIM + j for (row j, col k) thinking,
                // or j*K_DIM + k if thinking (row k, col j) in typical matrix terms (rows first).
                // Given `scripts/gen-example-proof.ts` `b[j][k]` with `idx = k * J + j`,
                // and user suggestion `vMatrix[k*J_DIM + j]`, this means k is outer loop for vMatrix population.
                uint256 v_jk = prf.vMatrix[k*J_DIM + j]; // v_{j,k}
                uint256 power_of_2_term = POWER_OF_2[k*J_DIM + j];
                
                uint256 u_jk_term1 = mulmod(power_of_2_term, eps[k], CURVE_ORDER);
                uint256 u_jk = (u_jk_term1 + CURVE_ORDER - (v_jk % CURVE_ORDER)) % CURVE_ORDER;
                
                current_hExp_j = (current_hExp_j + mulmod(v_jk, u_jk, CURVE_ORDER)) % CURVE_ORDER;

                if (j == 0) { // Initialize vPrime[k] on the first iteration of j
                    vPrime[k] = 0;
                }
                vPrime[k] = (vPrime[k] + v_jk) % CURVE_ORDER;
            }
            hExp[j] = current_hExp_j;
        }

        // --- Perform the three group equation checks ---

        // Check-3 (論文式 11): Cm == sum(W_k)
        VerangeCrypto.Point memory sum_W_k = VerangeCrypto.ecZero();
        for(uint256 k=0; k < K_DIM; k++) {
            sum_W_k = VerangeCrypto.ecadd(sum_W_k, prf.W[k]);
        }
        if (sum_W_k.x != Cm.x || sum_W_k.y != Cm.y) {
            return false;
        }

        // Check-2 (論文式 6): sum(W_k * eps_k) + R == G * sum(vPrime_k) + Q * eta2
        VerangeCrypto.Point memory sum_W_eps = VerangeCrypto.multiScalarMul(prf.W, eps);
        VerangeCrypto.Point memory lhs_check2 = VerangeCrypto.ecadd(sum_W_eps, prf.R);

        uint256 sum_vPrime_for_check2 = 0;
        for (uint256 k = 0; k < K_DIM; k++) {
            sum_vPrime_for_check2 = (sum_vPrime_for_check2 + vPrime[k]) % CURVE_ORDER;
        }
        VerangeCrypto.Point memory G_sum_vPrime = VerangeCrypto.ecmul(G, sum_vPrime_for_check2);
        VerangeCrypto.Point memory Q_eta2 = VerangeCrypto.ecmul(Q, prf.eta2);
        VerangeCrypto.Point memory rhs_check2 = VerangeCrypto.ecadd(G_sum_vPrime, Q_eta2);

        if (lhs_check2.x != rhs_check2.x || lhs_check2.y != rhs_check2.y) {
            return false;
        }

        // Check-1 (論文式 5): sum(T_k * eps_k) + S == (sum_j H_j * hExp_j) + Q * eta1
        VerangeCrypto.Point memory sum_T_eps = VerangeCrypto.multiScalarMul(prf.T, eps);
        VerangeCrypto.Point memory lhs_check1 = VerangeCrypto.ecadd(sum_T_eps, prf.S);

        VerangeCrypto.Point memory sum_H_hExp = VerangeCrypto.ecZero();
        for(uint256 j=0; j < J_DIM; j++) {
             if (hExp[j] != 0) { 
                sum_H_hExp = VerangeCrypto.ecadd(sum_H_hExp, VerangeCrypto.ecmul(H[j], hExp[j]));
             }
        }
        VerangeCrypto.Point memory Q_eta1 = VerangeCrypto.ecmul(Q, prf.eta1);
        VerangeCrypto.Point memory rhs_check1 = VerangeCrypto.ecadd(sum_H_hExp, Q_eta1);

        if (lhs_check1.x != rhs_check1.x || lhs_check1.y != rhs_check1.y) {
            return false;
        }

        return true; // All checks passed
    }
} 