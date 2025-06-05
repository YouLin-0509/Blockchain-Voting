/*
 * Generate a single VeRange Type‑1 proof for ω = 5, N = 64 (J = K = 8)
 * Run with:  npx ts-node --esm scripts/gen-example-proof.ts
 * Output:    scripts/example_proof.json
 */

import { bn254 as rawBn254 } from "@noble/curves/bn254";
import { bytesToNumberBE } from "@noble/curves/abstract/utils";
import { utf8ToBytes } from "@noble/hashes/utils";
import { keccak_256 } from "@noble/hashes/sha3";
import { randomBytes } from "crypto";
import fs from "fs";

const bn254 = rawBn254 as any;

// ---------------------------------------------------------------------------
//  A. curve helpers & constants
// ---------------------------------------------------------------------------
const { ProjectivePoint, CURVE } = bn254;
const n = CURVE.n;                                   // subgroup order

const randScalar = (): bigint => (bytesToNumberBE(randomBytes(32)) % n + n) % n;

// ---------------------------------------------------------------------------
//  B. Common Reference String (transparent setup)
// ---------------------------------------------------------------------------
const G = ProjectivePoint.BASE;                      // (1, 2)
const Q_gen = ProjectivePoint.hashToCurve(utf8ToBytes("VeRange-Type1-Q")); // Renamed Q to Q_gen to avoid conflict with variable Q in pedersen context if any

const J = 8, K = 8;
const H_gen: any[] = Array.from({ length: J }, (_, i) => // Renamed H to H_gen, type to any[]
  ProjectivePoint.hashToCurve(utf8ToBytes(`VeRange-Type1-H${i + 1}`))
);

// ---------------------------------------------------------------------------
//  C. secret value & bit matrix
// ---------------------------------------------------------------------------
const N_val = 64n; // Renamed N to N_val
const omega = 5n;                                    // ω = 5

const bits = [...omega.toString(2).padStart(Number(N_val), "0")]
  .reverse()
  .map(Number);

const b: number[][] = Array.from({ length: J }, (_, j) =>
  Array.from({ length: K }, (_, k) => {
    const idx = k * J + j;
    return idx < bits.length ? bits[idx] : 0;
  })
);

// ---------------------------------------------------------------------------
//  D. randomizers
// ---------------------------------------------------------------------------
const r_w: bigint[] = Array.from({ length: K }, randScalar);
const r_omega = r_w.reduce((a, x) => (a + x % n + n) % n, 0n);

const r_t: bigint[] = Array.from({ length: K }, randScalar);
const r_jk: bigint[] = Array.from({ length: J * K }, randScalar); // This is vMatrix source
const r_R = randScalar();

// ---------------------------------------------------------------------------
//  E. helper to build Pedersen‑like commitments
// ---------------------------------------------------------------------------
function pedersen(base: any, q_param: any, m: bigint, r: bigint) { // Renamed q to q_param, base and q_param to any
  return base.multiply(m).add(q_param.multiply(r));
}

// ---------------------------------------------------------------------------
//  F. commitments W_k & Cm(ω)
// ---------------------------------------------------------------------------
const W_points_gen: any[] = Array.from({ length: K }, (_, k) => { // Renamed W to W_points_gen, type to any[]
  let wk = 0n;
  for (let j_idx = 0; j_idx < J; j_idx++) { // Renamed j to j_idx
    if (b[j_idx][k] === 1) {
      const exp = BigInt(k * J + j_idx);
      wk = (wk + (1n << exp) % n + n) % n;
    }
  }
  return pedersen(G, Q_gen, wk, r_w[k]);
});

const Cm_gen = pedersen(G, Q_gen, omega, r_omega); // Renamed Cm to Cm_gen

// ---------------------------------------------------------------------------
//  G. T_k
// ---------------------------------------------------------------------------
const T_points_gen: any[] = Array.from({ length: K }, (_, k) => Q_gen.multiply(r_t[k])); // Renamed T to T_points_gen, type to any[]

// ---------------------------------------------------------------------------
//  H. R, S
// ---------------------------------------------------------------------------
const sum_rj = r_jk.reduce((a, x) => (a + x % n + n) % n, 0n);
const R_point_gen = G.multiply(sum_rj).add(Q_gen.multiply(r_R)); // Renamed R_point
const S_point_gen = ProjectivePoint.ZERO; // Renamed S_point

// ---------------------------------------------------------------------------
//  I. Fiat–Shamir ε_k
// ---------------------------------------------------------------------------
const fsBytes = Buffer.concat([
  Cm_gen.toRawBytes(true),
  R_point_gen.toRawBytes(true),
  S_point_gen.toRawBytes(true),
  ...W_points_gen.map(p => p.toRawBytes(true)),
  ...T_points_gen.map(p => p.toRawBytes(true)),
]);
const eHash = keccak_256(fsBytes);
// Keep this derivation as it matches the agreed Solidity side (hash of 33-byte seed)
const eps: bigint[] = Array.from({ length: K }, (_, k_idx) => // Renamed k to k_idx
  (bytesToNumberBE(keccak_256(Buffer.concat([eHash, Buffer.from([k_idx])]))) % n + n) % n || 1n
);

// ---------------------------------------------------------------------------
//  J. vMatrix (replaces v_prime direct calculation for proof, v_prime is for local use if needed)
// ---------------------------------------------------------------------------
const vMatrix: bigint[] = r_jk; // vMatrix is r_jk, as per user instruction

// For convenience (e.g. if eta2 calculation still uses vPrime), calculate vPrime from vMatrix
// This vPrime matches the old v_prime calculation based on r_jk.
const vPrime: bigint[] = Array.from({ length: K }, (_, k_idx) => { // Renamed k to k_idx
    let acc = 0n;
    for (let j_idx = 0; j_idx < J; j_idx++) { // Renamed j to j_idx
        acc = (acc + vMatrix[k_idx * J + j_idx] % n + n) % n; // Access vMatrix correctly: k is outer, j is inner for this sum
    }
    return acc;
});

let eta2 = r_R;
for (let k_idx = 0; k_idx < K; k_idx++) { // Renamed k to k_idx
    const term = (vPrime[k_idx] * eps[k_idx]) % n;
    eta2 = (eta2 + (term + n)%n ) %n;
}

// ---------------------------------------------------------------------------
//  K. η₁ (H_exponents are implicitly zero and not part of the proof)
// ---------------------------------------------------------------------------
let eta1 = 0n;
for (let k_idx = 0; k_idx < K; k_idx++) { // Renamed k to k_idx
    const term = (r_t[k_idx] * eps[k_idx]) % n;
    eta1 = (eta1 + (term + n)%n ) %n;
}

// ---------------------------------------------------------------------------
//  L. output JSON
// ---------------------------------------------------------------------------
function pt_func(p: any) { // Renamed pt to pt_func, type to any
  const [x, y_coord] = p.toAffine(); // Renamed y to y_coord
  return { x: "0x" + x.toString(16), y: "0x" + y_coord.toString(16) };
}

const proofJson = {
  commitmentCmOmega: pt_func(Cm_gen),
  R_point: pt_func(R_point_gen),
  S_point: pt_func(S_point_gen),
  W_points: W_points_gen.map(pt_func),
  T_points: T_points_gen.map(pt_func),
  eta1: "0x" + eta1.toString(16),
  eta2: "0x" + eta2.toString(16),
  vMatrix: vMatrix.map((v) => "0x" + v.toString(16)), // Add vMatrix
  // v_prime_scalars and H_exponents are removed
};

fs.mkdirSync("scripts", { recursive: true });
fs.writeFileSync("scripts/example_proof.json", JSON.stringify(proofJson, null, 2));
console.log("\u2705  example_proof.json generated → scripts/example_proof.json (with vMatrix)");

// Original calculation of v_prime (for reference, should match vPrime above)
/*
const original_v_prime: bigint[] = Array.from({ length: K }, (_, k) => {
  let acc = 0n;
  for (let j = 0; j < J; j++) acc = (acc + r_jk[k * J + j] % n + n) % n;
  return acc;
});
*/ 