import { bn254 as rawBn254 } from '@noble/curves/bn254'; // For BN254 curve operations
import { keccak_256 } from 'js-sha3';
import { ethers } from 'ethers'; // For abi.encodePacked alternative and BigNumber

const bn254 = rawBn254 as any; // Assert to any to bypass typing issues

// const ProjectivePoint = bn254.ProjectivePoint; // Removed
// const CURVE = bn254.CURVE; // Removed

// --- Helper Types (adjust to your actual structures) ---
export interface Point { // Exporting for potential use elsewhere
    x: bigint;
    y: bigint;
}

export interface IndividualProof { // Exporting for potential use elsewhere
    commitmentCmOmega: Point;
    W_points: Point[]; // Array of K_DIM points
    T_points: Point[]; // Array of K_DIM points
    R_point: Point;
    S_point: Point;
    eta1: bigint;
    eta2: bigint;
    v_prime_scalars: bigint[]; // Array of K_DIM scalars
    H_exponents: bigint[];   // Array of J_DIM scalars
    // K_DIM and J_DIM should be consistent across all proofs being aggregated
}

export interface AggregatedProof extends Omit<IndividualProof, 'commitmentCmOmega' | 'W_points' | 'T_points' | 'R_point' | 'S_point' | 'eta1' | 'eta2' | 'v_prime_scalars' | 'H_exponents'> {
    // Redefine fields that are aggregated
    aggregatedCmOmega: Point;
    W_points: Point[];
    T_points: Point[];
    R_point: Point;
    S_point: Point;
    eta1: bigint;
    eta2: bigint;
    v_prime_scalars: bigint[];
    H_exponents: bigint[];
}


const CURVE_ORDER: bigint = bn254.CURVE.n; // Use bn254.CURVE and explicitly type as bigint

// Helper function to convert Noble point to our Point type and back
function toNoblePoint(p: Point): typeof bn254.ProjectivePoint { // Use bn254.ProjectivePoint
    if (p.x === 0n && p.y === 0n) return bn254.ProjectivePoint.ZERO; // Noble's representation of identity
    return new bn254.ProjectivePoint(p.x, p.y);
}

function fromNoblePoint(np: typeof bn254.ProjectivePoint): Point { // Use bn254.ProjectivePoint
    if (np.equals(bn254.ProjectivePoint.ZERO)) return { x: 0n, y: 0n };
    return { x: np.x, y: np.y };
}

// Helper for scalar operations
function addScalars(...args: bigint[]): bigint {
    let sum = 0n;
    for (const s of args) {
        sum = (sum + s); // Modulo CURVE_ORDER will be applied at the end or where necessary
    }
    return (sum % CURVE_ORDER + CURVE_ORDER) % CURVE_ORDER; // Ensure positive result
}

function multiplyScalars(...args: bigint[]): bigint {
    let prod = 1n;
    for (const s of args) {
        prod = (prod * s); // Modulo CURVE_ORDER will be applied at the end
    }
    // Ensure result is positive if CURVE_ORDER is added during intermediate negative results
    return (prod % CURVE_ORDER + CURVE_ORDER) % CURVE_ORDER;
}


export function aggregateProofs(
    proofs: IndividualProof[],
    kDim: number, // K_DIM
    jDim: number  // J_DIM
): AggregatedProof | null {
    if (!proofs || proofs.length === 0) {
        console.error("No proofs provided for aggregation.");
        return null;
    }

    const T = proofs.length; // Number of proofs to aggregate

    // 1. Generate random coefficients gamma_t
    const gammas: bigint[] = [];
    for (let t = 0; t < T; t++) {
        const cm_t = proofs[t].commitmentCmOmega;
        const packedData = ethers.solidityPacked(
            ["uint256", "uint256", "uint256"],
            [cm_t.x, cm_t.y, BigInt(t)] 
        );
        const hash = keccak_256(ethers.getBytes(packedData));
        let gamma_t = BigInt('0x' + hash) % CURVE_ORDER;
        if (gamma_t === 0n) {
            // Retry with a slightly different input if gamma_t is zero
            const packedDataRetry = ethers.solidityPacked(
                ["uint256", "uint256", "uint256", "string"],
                [cm_t.x, cm_t.y, BigInt(t), "retry"]
            );
            const hashRetry = keccak_256(ethers.getBytes(packedDataRetry));
            gamma_t = BigInt('0x' + hashRetry) % CURVE_ORDER;
            if (gamma_t === 0n) {
                 console.error(`Gamma_t for proof ${t} is zero even after retry. This is highly unlikely.`);
                 return null; // Or throw an error
            }
        }
        gammas.push(gamma_t);
    }

    // Initialize aggregated components
    let aggregatedCmOmega_noble = bn254.ProjectivePoint.ZERO;
    const aggregatedW_points_noble: (typeof bn254.ProjectivePoint)[] = Array(kDim).fill(null).map(() => bn254.ProjectivePoint.ZERO);
    const aggregatedT_points_noble: (typeof bn254.ProjectivePoint)[] = Array(kDim).fill(null).map(() => bn254.ProjectivePoint.ZERO);
    let aggregatedR_point_noble = bn254.ProjectivePoint.ZERO;
    let aggregatedS_point_noble = bn254.ProjectivePoint.ZERO;
    
    let aggregatedEta1 = 0n;
    let aggregatedEta2 = 0n;
    const aggregatedV_prime_scalars: bigint[] = Array(kDim).fill(0n);
    const aggregatedH_exponents: bigint[] = Array(jDim).fill(0n);

    // 2. Aggregate each component
    for (let t = 0; t < T; t++) {
        const proof = proofs[t];
        const gamma_t = gammas[t];

        // Validate dimensions for each proof
        if (proof.W_points.length !== kDim || 
            proof.T_points.length !== kDim || 
            proof.v_prime_scalars.length !== kDim) {
            console.error(`Proof ${t} has incorrect K_DIM for W_points, T_points, or v_prime_scalars. Expected ${kDim}, got ${proof.W_points.length}, ${proof.T_points.length}, ${proof.v_prime_scalars.length}`);
            return null;
        }
        if (proof.H_exponents.length !== jDim) {
            console.error(`Proof ${t} has incorrect J_DIM for H_exponents. Expected ${jDim}, got ${proof.H_exponents.length}`);
            return null;
        }

        // Aggregate points: P_agg = sum(gamma_t * P_t)
        aggregatedCmOmega_noble = aggregatedCmOmega_noble.add(toNoblePoint(proof.commitmentCmOmega).multiply(gamma_t));
        aggregatedR_point_noble = aggregatedR_point_noble.add(toNoblePoint(proof.R_point).multiply(gamma_t));
        aggregatedS_point_noble = aggregatedS_point_noble.add(toNoblePoint(proof.S_point).multiply(gamma_t));

        for (let k = 0; k < kDim; k++) {
            aggregatedW_points_noble[k] = aggregatedW_points_noble[k].add(toNoblePoint(proof.W_points[k]).multiply(gamma_t));
            aggregatedT_points_noble[k] = aggregatedT_points_noble[k].add(toNoblePoint(proof.T_points[k]).multiply(gamma_t));
            // Aggregate scalars: s_agg = sum(gamma_t * s_t) mod CURVE_ORDER
            aggregatedV_prime_scalars[k] = addScalars(aggregatedV_prime_scalars[k], multiplyScalars(proof.v_prime_scalars[k], gamma_t));
        }

        for (let j = 0; j < jDim; j++) {
            aggregatedH_exponents[j] = addScalars(aggregatedH_exponents[j], multiplyScalars(proof.H_exponents[j], gamma_t));
        }
        
        aggregatedEta1 = addScalars(aggregatedEta1, multiplyScalars(proof.eta1, gamma_t));
        aggregatedEta2 = addScalars(aggregatedEta2, multiplyScalars(proof.eta2, gamma_t));
    }

    return {
        aggregatedCmOmega: fromNoblePoint(aggregatedCmOmega_noble),
        W_points: aggregatedW_points_noble.map(p => fromNoblePoint(p)),
        T_points: aggregatedT_points_noble.map(p => fromNoblePoint(p)),
        R_point: fromNoblePoint(aggregatedR_point_noble),
        S_point: fromNoblePoint(aggregatedS_point_noble),
        eta1: aggregatedEta1,
        eta2: aggregatedEta2,
        v_prime_scalars: aggregatedV_prime_scalars,
        H_exponents: aggregatedH_exponents,
    };
}

// --- Example Usage (Conceptual - for testing this file if run directly) ---
/*
async function testAggregation() {
    // Assume K_DIM and J_DIM are known (e.g., from contract or config)
    const K_DIM_EXAMPLE = 2; // Example: sqrt(N_BITS) e.g. N_BITS=4 -> J=K=2
    const J_DIM_EXAMPLE = 2; // Example

    // Create some dummy individual proofs for testing
    const dummyProof1: IndividualProof = {
        commitmentCmOmega: { x: 1n, y: 2n },
        W_points: Array(K_DIM_EXAMPLE).fill(null).map((_,i) => ({ x: BigInt(i+10), y: BigInt(i+11) })),
        T_points: Array(K_DIM_EXAMPLE).fill(null).map((_,i) => ({ x: BigInt(i+20), y: BigInt(i+21) })),
        R_point: { x: 3n, y: 4n },
        S_point: { x: 5n, y: 6n },
        eta1: 123n,
        eta2: 456n,
        v_prime_scalars: Array(K_DIM_EXAMPLE).fill(null).map((_,i) => BigInt(i+100)),
        H_exponents: Array(J_DIM_EXAMPLE).fill(null).map((_,i) => BigInt(i+200)),
    };

    const dummyProof2: IndividualProof = {
        commitmentCmOmega: { x: 7n, y: 8n },
        W_points: Array(K_DIM_EXAMPLE).fill(null).map((_,i) => ({ x: BigInt(i+30), y: BigInt(i+31) })),
        T_points: Array(K_DIM_EXAMPLE).fill(null).map((_,i) => ({ x: BigInt(i+40), y: BigInt(i+41) })),
        R_point: { x: 9n, y: 10n },
        S_point: { x: 11n, y: 12n },
        eta1: 789n,
        eta2: 101n,
        v_prime_scalars: Array(K_DIM_EXAMPLE).fill(null).map((_,i) => BigInt(i+300)),
        H_exponents: Array(J_DIM_EXAMPLE).fill(null).map((_,i) => BigInt(i+400)),
    };
    
    const individualProofs: IndividualProof[] = [dummyProof1, dummyProof2];

    if (individualProofs.length > 0) {
        console.log("Aggregating", individualProofs.length, "proofs...");
        console.log("K_DIM:", K_DIM_EXAMPLE, "J_DIM:", J_DIM_EXAMPLE);

        const aggregatedProof = aggregateProofs(individualProofs, K_DIM_EXAMPLE, J_DIM_EXAMPLE);

        if (aggregatedProof) {
            console.log("Aggregated Proof:", JSON.stringify(aggregatedProof, (_, v) =>
                typeof v === 'bigint' ? v.toString() + "n" : v, // BigInt JSON serialization for display
                2
            ));
        } else {
            console.error("Aggregation returned null.");
        }
    } else {
        console.log("No proofs to aggregate.");
    }
}

// To run this test, you would typically compile this TS to JS and run with Node.
// e.g., if this file is in src/utils/verangeAggregation.ts
// you might have a script in package.json: "test:agg": "tsc && node dist/utils/verangeAggregation.js"
// and then call testAggregation() at the end of the file if no other module is importing it.
// For now, this is commented out as it's primarily a library function.
// testAggregation(); 
*/ 