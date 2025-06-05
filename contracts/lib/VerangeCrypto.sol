// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VerangeCrypto
 * @author Gemini
 * @notice Library for BN254 elliptic curve cryptography operations needed for VeRange Type-1 verification.
 * It uses Ethereum precompiled contracts for ecadd and ecmul.
 */
library VerangeCrypto {
    struct Point {
        uint256 x;
        uint256 y;
    }

    // Curve order of BN254 (alt_bn128)
    // n = 21888242871839275222246405745257275088548364400416034343698204186575808495617
    uint256 constant CURVE_ORDER = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    // Field modulus for BN254 (not directly used in CURVE_ORDER operations but good for context)
    // p = 21888242871839275222246405745257275088696311157297823661920176768983644918539
    // uint256 constant FIELD_MODULUS = 21888242871839275222246405745257275088696311157297823661920176768983644918539;

    // b parameter for the curve y^2 = x^3 + b (for BN254, b=3)
    uint256 constant CURVE_B = 3;

    /**
     * @notice Returns the point at infinity (identity element for EC addition).
     */
    function ecZero() internal pure returns (Point memory) {
        return Point(0, 0);
    }

    /**
     * @notice Adds two points on the BN254 curve.
     * @param p1 The first point.
     * @param p2 The second point.
     * @return result The sum of p1 and p2.
     * Reverts on error (e.g., if points are not on curve, though precompile might not check this explicitly).
     */
    function ecadd(Point memory p1, Point memory p2) internal view returns (Point memory result) {
        uint256[4] memory input;
        input[0] = p1.x;
        input[1] = p1.y;
        input[2] = p2.x;
        input[3] = p2.y;

        assembly {
            if iszero(staticcall(gas(), 0x06, input, 0x80, result, 0x40)) {
                revert(0, 0)
            }
        }
    }

    /**
     * @notice Multiplies a point on the BN254 curve by a scalar.
     * @param p The point.
     * @param s The scalar.
     * @return result The product p * s.
     * Reverts on error.
     */
    function ecmul(Point memory p, uint256 s) internal view returns (Point memory result) {
        // Precompile 0x07 expects scalar s to be modulo CURVE_ORDER.
        // If s is 0, it should return the point at infinity (0,0).
        if (s == 0 || s >= CURVE_ORDER) { // Handle s=0 or ensure s is in range.
                                        // If s is a multiple of CURVE_ORDER (and not 0), ecmul(P, N) = O.
            if (s % CURVE_ORDER == 0) {
                result.x = 0;
                result.y = 0;
                return result;
            }
            s = s % CURVE_ORDER;
        }
        
        uint256[3] memory input;
        input[0] = p.x;
        input[1] = p.y;
        input[2] = s;

        assembly {
            if iszero(staticcall(gas(), 0x07, input, 0x60, result, 0x40)) {
                revert(0, 0)
            }
        }
    }

    /**
     * @notice Checks if a point is on the BN254 curve (y^2 = x^3 + 3).
     * @param p The point to check.
     * @return bool True if the point is on the curve, false otherwise.
     * Note: Points are assumed to have coordinates < FIELD_MODULUS.
     */
    function isOnCurve(Point memory p) internal pure returns (bool) {
        if (p.x == 0 && p.y == 0) { // Point at infinity is on the curve.
            return true;
        }
        // y^2 = x^3 + 3 mod FIELD_MODULUS
        // For BN254, FIELD_MODULUS is 21888242871839275222246405745257275088696311157297823661920176768983644918539
        uint256 fieldModulus = 21888242871839275222246405745257275088696311157297823661920176768983644918539;
        if (p.x >= fieldModulus || p.y >= fieldModulus) {
            return false; // Coordinates out of field
        }

        uint256 y2 = mulmod(p.y, p.y, fieldModulus);
        uint256 x3 = mulmod(mulmod(p.x, p.x, fieldModulus), p.x, fieldModulus);
        uint256 x3plusB = addmod(x3, CURVE_B, fieldModulus);

        return y2 == x3plusB;
    }

    /**
     * @notice Calculates sum_i (points_i * scalars_i).
     * @param points An array of points.
     * @param scalars An array of scalars.
     * @return result The resulting point sum.
     * Reverts if arrays have different lengths or are empty.
     */
    function multiScalarMul(Point[] memory points, uint256[] memory scalars) internal view returns (Point memory result) {
        require(points.length == scalars.length, "VerangeCrypto: points and scalars arrays must have the same length.");
        // Allow empty arrays, in which case it returns point at infinity (0,0)
        if (points.length == 0) {
            return ecZero();
        }

        result = ecZero(); // Initialize with point at infinity

        for (uint256 i = 0; i < points.length; i++) {
            if (scalars[i] != 0) { // Optimization: skip if scalar is 0
                Point memory term = ecmul(points[i], scalars[i]);
                result = ecadd(result, term);
            }
        }
    }
} 