/*
 * Generate a single VeRange Type‑1 proof for ω = 5, N = 64 (J = K = 8)
 * Run with:  npx ts-node --esm scripts/gen-example-proof.ts
 * Output:    scripts/example_proof.json
 */

import * as nobleCurvesBn254Module from "@noble/curves/bn254";
import { bytesToNumberBE } from "@noble/curves/abstract/utils";
import { utf8ToBytes } from "@noble/hashes/utils";
import { keccak_256 } from "@noble/hashes/sha3";
import { randomBytes } from "crypto";
import fs from "fs";

console.log("Inspecting keccak_256 (still present for context):", keccak_256);

const bn254 = (nobleCurvesBn254Module.bn254 as any);

// ---------------------------------------------------------------------------
//  A. curve helpers & constants
// ---------------------------------------------------------------------------
const N_CURVE_ORDER: bigint = bn254.G1.CURVE.n;

const randScalar = (): bigint => (bytesToNumberBE(randomBytes(32)) % N_CURVE_ORDER + N_CURVE_ORDER) % N_CURVE_ORDER;

// ---------------------------------------------------------------------------
//  B. Common Reference String (transparent setup)
// ---------------------------------------------------------------------------
const G = bn254.G1.ProjectivePoint.BASE;
const Q_gen = bn254.G1.hashToCurve(utf8ToBytes("VeRange-Type1-Q"), { DST: "VERANGE_TYPE1_BN254_G1_Q" });

const J = 8, K = 8;
const H_gen: any[] = Array.from({ length: J }, (_, i) =>
  bn254.G1.hashToCurve(utf8ToBytes(`VeRange-Type1-H${i + 1}`), { DST: `VERANGE_TYPE1_BN254_G1_H${i+1}` })
);

// ---------------------------------------------------------------------------
//  C. secret value & bit matrix
// ---------------------------------------------------------------------------
const N_val = 64n;
const omega = 5n;

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
const r_omega = r_w.reduce((a, x) => (a + x % N_CURVE_ORDER + N_CURVE_ORDER) % N_CURVE_ORDER, 0n);

const r_t: bigint[] = Array.from({ length: K }, randScalar);
const r_jk: bigint[] = Array.from({ length: J * K }, randScalar);
const r_R = randScalar();

// ---------------------------------------------------------------------------
//  E. helper to build Pedersen‑like commitments
// ---------------------------------------------------------------------------
function pedersen(base: any, q_param: any, m: bigint, r: bigint) {
  return base.multiply(m).add(q_param.multiply(r));
}

// ---------------------------------------------------------------------------
//  F. commitments W_k & Cm(ω)
// ---------------------------------------------------------------------------
const W_points_gen: any[] = Array.from({ length: K }, (_, k) => {
  let wk = 0n;
  for (let j_idx = 0; j_idx < J; j_idx++) {
    if (b[j_idx][k] === 1) {
      const exp = BigInt(k * J + j_idx);
      wk = (wk + (1n << exp) % N_CURVE_ORDER + N_CURVE_ORDER) % N_CURVE_ORDER;
    }
  }
  return pedersen(G, Q_gen, wk, r_w[k]);
});

const Cm_gen = pedersen(G, Q_gen, omega, r_omega);

// ---------------------------------------------------------------------------
//  G. T_k
// ---------------------------------------------------------------------------
const T_points_gen: any[] = Array.from({ length: K }, (_, k) => Q_gen.multiply(r_t[k]));

// ---------------------------------------------------------------------------
//  H. R, S
// ---------------------------------------------------------------------------
const sum_rj = r_jk.reduce((a, x) => (a + x % N_CURVE_ORDER + N_CURVE_ORDER) % N_CURVE_ORDER, 0n);
const R_point_gen = G.multiply(sum_rj).add(Q_gen.multiply(r_R));
const S_point_gen = bn254.G1.ProjectivePoint.ZERO;

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
const eps: bigint[] = Array.from({ length: K }, (_, k_idx) =>
  (bytesToNumberBE(keccak_256(Buffer.concat([eHash, Buffer.from([k_idx])]))) % N_CURVE_ORDER + N_CURVE_ORDER) % N_CURVE_ORDER || 1n
);

// ---------------------------------------------------------------------------
//  J. vMatrix (replaces v_prime direct calculation for proof, v_prime is for local use if needed)
// ---------------------------------------------------------------------------
const vMatrix: bigint[] = r_jk;

const vPrime: bigint[] = Array.from({ length: K }, (_, k_idx) => {
    let acc = 0n;
    for (let j_idx = 0; j_idx < J; j_idx++) {
        acc = (acc + vMatrix[k_idx * J + j_idx] % N_CURVE_ORDER + N_CURVE_ORDER) % N_CURVE_ORDER;
    }
    return acc;
});

let eta2 = r_R;
for (let k_idx = 0; k_idx < K; k_idx++) {
    const term = (vPrime[k_idx] * eps[k_idx]) % N_CURVE_ORDER;
    eta2 = (eta2 + (term + N_CURVE_ORDER)%N_CURVE_ORDER ) %N_CURVE_ORDER;
}

let eta1 = 0n;
for (let k_idx = 0; k_idx < K; k_idx++) {
    const term = (r_t[k_idx] * eps[k_idx]) % N_CURVE_ORDER;
    eta1 = (eta1 + (term + N_CURVE_ORDER)%N_CURVE_ORDER ) %N_CURVE_ORDER;
}

// ---------------------------------------------------------------------------
//  K. output JSON
// ---------------------------------------------------------------------------
function pt_func(p: any) {
  const [x, y_coord] = p.toAffine();
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
  vMatrix: vMatrix.map((v) => "0x" + v.toString(16)),
};

fs.mkdirSync("scripts", { recursive: true });
fs.writeFileSync("scripts/example_proof.json", JSON.stringify(proofJson, null, 2));
console.log("\u2705  example_proof.json generated → scripts/example_proof.json (with vMatrix)");

// Original calculation of v_prime (for reference, should match vPrime above)
/*
const original_v_prime: bigint[] = Array.from({ length: K }, (_, k) => {
  let acc = 0n;
  for (let j = 0; j < J; j++) acc = (acc + r_jk[k * J + j] % N_CURVE_ORDER + N_CURVE_ORDER) % N_CURVE_ORDER;
  return acc;
});
*/ 