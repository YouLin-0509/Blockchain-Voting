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
const n_raw = CURVE.n;
const N_ORDER = BigInt(n_raw);

const randScalar = (): bigint => (bytesToNumberBE(randomBytes(32)) % N_ORDER + N_ORDER) % N_ORDER;

// ---------------------------------------------------------------------------
//  B. Common Reference String (transparent setup)
// ---------------------------------------------------------------------------
const G = ProjectivePoint.BASE;
const Q = ProjectivePoint.hashToCurve(utf8ToBytes("VeRange-Type1-Q"));

const J = 8, K = 8;
const H: any[] = Array.from({ length: J }, (_, i) =>
  ProjectivePoint.hashToCurve(utf8ToBytes(`VeRange-Type1-H${i + 1}`))
);

// ---------------------------------------------------------------------------
//  C. secret value & bit matrix
// ---------------------------------------------------------------------------
const N = 64n;
const omega = 5n;                                    // ω = 5

// little‑endian bit array of length N
const bits = [...omega.toString(2).padStart(Number(N), "0")]
  .reverse()
  .map(Number);

// b[j][k] : J × K
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
const r_omega = r_w.reduce((a, x) => (a + x % N_ORDER + N_ORDER) % N_ORDER, 0n);

const r_t: bigint[] = Array.from({ length: K }, randScalar);
const r_jk: bigint[] = Array.from({ length: J * K }, randScalar);
const r_R = randScalar();                                // extra blinding for R

// ---------------------------------------------------------------------------
//  E. helper to build Pedersen‑like commitments
// ---------------------------------------------------------------------------
function pedersen(base: any, q: any, m: bigint, r: bigint) {
  return base.multiply(m).add(q.multiply(r));
}

// ---------------------------------------------------------------------------
//  F. commitments W_k & Cm(ω)
// ---------------------------------------------------------------------------
const W: any[] = Array.from({ length: K }, (_, k) => {
  let wk = 0n;
  for (let j = 0; j < J; j++) {
    if (b[j][k] === 1) {
      const exp = BigInt(k * J + j);
      wk = (wk + (1n << exp) % N_ORDER + N_ORDER) % N_ORDER;
    }
  }
  return pedersen(G, Q, wk, r_w[k]);
});

const Cm = pedersen(G, Q, omega, r_omega);

// ---------------------------------------------------------------------------
//  G. T_k
// ---------------------------------------------------------------------------
const T: any[] = Array.from({ length: K }, (_, k) => Q.multiply(r_t[k]));

// ---------------------------------------------------------------------------
//  H. R, S
// ---------------------------------------------------------------------------
const sum_rj = r_jk.reduce((a, x) => (a + x % N_ORDER + N_ORDER) % N_ORDER, 0n);
const R_point = G.multiply(sum_rj).add(Q.multiply(r_R));
const S_point = ProjectivePoint.ZERO;                  // A_hat_j = 0 ⇒ identity

// ---------------------------------------------------------------------------
//  I. Fiat–Shamir ε_k
// ---------------------------------------------------------------------------
const fsBytes = Buffer.concat([
  Cm.toRawBytes(true),
  R_point.toRawBytes(true),
  S_point.toRawBytes(true),
  ...W.map(p => p.toRawBytes(true)),
  ...T.map(p => p.toRawBytes(true)),
]);
const eHash = keccak_256(fsBytes);
const eps: bigint[] = Array.from({ length: K }, (_, k) =>
  (bytesToNumberBE(Buffer.concat([eHash, Buffer.from([k])])) % N_ORDER + N_ORDER) % N_ORDER || 1n
);

// ---------------------------------------------------------------------------
//  J. v'_k   &   η₂
// ---------------------------------------------------------------------------
const v_prime: bigint[] = Array.from({ length: K }, (_, k) => {
  let acc = 0n;
  for (let j = 0; j < J; j++) acc = (acc + r_jk[k * J + j] % N_ORDER + N_ORDER) % N_ORDER;
  return acc;
});

let eta2 = r_R;
for (let k = 0; k < K; k++) {
    const term = (v_prime[k] * eps[k]) % N_ORDER;
    eta2 = (eta2 + (term + N_ORDER) % N_ORDER) % N_ORDER;
}

// ---------------------------------------------------------------------------
//  K. η₁  &  (trivial) H_exponents = 0
// ---------------------------------------------------------------------------
let eta1 = 0n;
for (let k = 0; k < K; k++) {
    const term = (r_t[k] * eps[k]) % N_ORDER;
    eta1 = (eta1 + (term + N_ORDER) % N_ORDER) % N_ORDER;
}
const H_exponents: bigint[] = Array(J).fill(0n);

// ---------------------------------------------------------------------------
//  L. output JSON
// ---------------------------------------------------------------------------
function pt(p: any) {
  const [x, y] = p.toAffine();
  return { x: "0x" + x.toString(16), y: "0x" + y.toString(16) };
}

const proofJson = {
  commitmentCmOmega: pt(Cm),
  R_point: pt(R_point),
  S_point: pt(S_point),
  W_points: W.map(pt),
  T_points: T.map(pt),
  eta1: "0x" + eta1.toString(16),
  eta2: "0x" + eta2.toString(16),
  v_prime_scalars: v_prime.map(v => "0x" + v.toString(16)),
  H_exponents: H_exponents.map(() => "0x0"),
};

fs.mkdirSync("scripts", { recursive: true });
fs.writeFileSync("scripts/example_proof.json", JSON.stringify(proofJson, null, 2));
console.log("\u2705  example_proof.json generated → scripts/example_proof.json"); 