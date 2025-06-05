/*
 * Reusable Prover library for VeRange Type-1
 */
import * as nobleCurvesBn254Module from "@noble/curves/bn254";
import { bytesToNumberBE } from "@noble/curves/abstract/utils";
import { utf8ToBytes } from "@noble/hashes/utils";
import { keccak_256 } from "@noble/hashes/sha3";
import { randomBytes } from "crypto";

const bn254 = (nobleCurvesBn254Module.bn254);

// A. curve helpers & constants
const N_CURVE_ORDER = bn254.G1.CURVE.n;

// (e) Secure random scalar generation in [1, r-1]
function randScalar() {
    let r;
    do {
        // Generate 32 random bytes and convert to a BigInt
        r = bytesToNumberBE(randomBytes(32));
        // Retry if number is out of range [1, n-1] to ensure uniform distribution
    } while (r >= N_CURVE_ORDER || r === 0n);
    return r;
}

function hashToCurve_TI(msg, domain) {
    let point = null;
    let i = 0;
    while (point === null) {
        const hash = keccak_256(Buffer.concat([Buffer.from(domain), msg, Buffer.from([i])]));
        try {
            point = bn254.G1.fromBytes(Buffer.concat([Buffer.from([0x02]), hash]));
        } catch (e) {
            i++;
        }
    }
    return point;
}

// B. Common Reference String (transparent setup)
const G = bn254.G1.ProjectivePoint.BASE;
const Q_gen = hashToCurve_TI(utf8ToBytes("VeRange-Type1-Q"), "VeRange-T1-Q");
const J = 8, K = 8;
const H_gen = Array.from({ length: J }, (_, i) =>
  hashToCurve_TI(utf8ToBytes(`VeRange-Type1-H${i + 1}`), `VeRange-T1-H${i+1}`)
);

function pedersen(base, q_param, m, r) {
  const mTerm = (m === 0n) ? bn254.G1.ProjectivePoint.ZERO : base.multiply(m);
  const rTerm = q_param.multiply(r);
  return mTerm.add(rTerm);
}

function pointToBytes(p) {
  const { x, y } = p.toAffine();
  if (p.equals(bn254.G1.ProjectivePoint.ZERO)) {
      return Buffer.alloc(64, 0);
  }
  const xBytes = Buffer.from(x.toString(16).padStart(64, '0'), 'hex');
  const yBytes = Buffer.from(y.toString(16).padStart(64, '0'), 'hex');
  return Buffer.concat([xBytes, yBytes]);
}

function pt_func(p) {
    const { x, y } = p.toAffine();
    return { x: "0x" + x.toString(16), y: "0x" + y.toString(16) };
}

export function generateProof(omega) {
    const N_val = 64n;
    if (omega < 0n || omega >= (1n << N_val)) {
        throw new Error(`omega must be in the range [0, 2^${N_val}-1]`);
    }

    const bits = [...omega.toString(2).padStart(Number(N_val), "0")]
      .reverse()
      .map(Number);
    const b = Array.from({ length: J }, (_, j) =>
      Array.from({ length: K }, (_, k) => {
        const idx = k * J + j;
        return idx < bits.length ? bits[idx] : 0;
      })
    );

    const r_w = Array.from({ length: K }, randScalar);
    const r_omega = r_w.reduce((a, x) => (a + x % N_CURVE_ORDER + N_CURVE_ORDER) % N_CURVE_ORDER, 0n);
    const r_t = Array.from({ length: K }, randScalar);
    const r_jk = Array.from({ length: J * K }, randScalar);
    const r_R = randScalar();

    const W_points_gen = Array.from({ length: K }, (_, k) => {
      let wk = 0n;
      for (let j_idx = 0; j_idx < J; j_idx++) {
        if (b[j_idx][k] === 1) {
          const exp = BigInt(k * J + j_idx);
          wk = (wk + (1n << exp));
        }
      }
      return pedersen(G, Q_gen, wk % N_CURVE_ORDER, r_w[k]);
    });
    const Cm_gen = pedersen(G, Q_gen, omega, r_omega);

    const T_points_gen = Array.from({ length: K }, (_, k) => Q_gen.multiply(r_t[k]));

    const fsBytes = Buffer.concat([
      Buffer.from("VeRange_ty1_eps_v1"),
      pointToBytes(Cm_gen),
      ...W_points_gen.map(pointToBytes),
      ...T_points_gen.map(pointToBytes),
    ]);
    const eHash = keccak_256(fsBytes);
    const eps = Array.from({ length: K }, (_, k_idx) => {
      const seed = Buffer.concat([eHash, Buffer.from([k_idx])]);
      const epsk = bytesToNumberBE(keccak_256(seed)) % N_CURVE_ORDER;
      return epsk === 0n ? 1n : epsk;
    });

    const vMatrix = r_jk;
    const vPrime = Array.from({ length: K }, (_, k_idx) => {
        let acc = 0n;
        for (let j_idx = 0; j_idx < J; j_idx++) {
            acc = (acc + vMatrix[k_idx * J + j_idx] % N_CURVE_ORDER + N_CURVE_ORDER) % N_CURVE_ORDER;
        }
        return acc;
    });

    const w_k_vals = Array.from({ length: K }, (_, k) => {
      let wk = 0n;
      for (let j_idx = 0; j_idx < J; j_idx++) {
        if (b[j_idx][k] === 1) {
          const exp = BigInt(k * J + j_idx);
          wk = (wk + (1n << exp));
        }
      }
      return wk % N_CURVE_ORDER;
    });
    const sum_w_k_eps_k = w_k_vals.reduce((acc, wk, k) => (acc + wk * eps[k]) % N_CURVE_ORDER, 0n);
    const sum_vPrime = vPrime.reduce((acc, vp) => (acc + vp) % N_CURVE_ORDER, 0n);
    const delta_R = (sum_vPrime - sum_w_k_eps_k + N_CURVE_ORDER) % N_CURVE_ORDER;
    const R_point_gen = G.multiply(delta_R).add(Q_gen.multiply(r_R));

    const hExp_j_vals = Array.from({ length: J }, (_, j) => {
        let current_hExp_j = 0n;
        for (let k = 0; k < K; k++) {
            const v_jk = vMatrix[k * J + j];
            const power_of_2_term = 1n << BigInt(k * J + j);
            const u_jk_term1 = (power_of_2_term * eps[k]) % N_CURVE_ORDER;
            const u_jk = (u_jk_term1 - v_jk + N_CURVE_ORDER) % N_CURVE_ORDER;
            current_hExp_j = (current_hExp_j + v_jk * u_jk) % N_CURVE_ORDER;
        }
        return current_hExp_j;
    });
    const S_point_gen = hExp_j_vals.reduce(
        (acc, hExp, j) => acc.add(H_gen[j].multiply(hExp)),
        bn254.G1.ProjectivePoint.ZERO
    );

    let eta2 = r_R;
    for (let k_idx = 0; k_idx < K; k_idx++) {
        const term = (r_w[k_idx] * eps[k_idx]) % N_CURVE_ORDER;
        eta2 = (eta2 + term + N_CURVE_ORDER) % N_CURVE_ORDER;
    }

    let eta1 = 0n;
    for (let k_idx = 0; k_idx < K; k_idx++) {
        const term = (r_t[k_idx] * eps[k_idx]) % N_CURVE_ORDER;
        eta1 = (eta1 + (term + N_CURVE_ORDER)%N_CURVE_ORDER ) %N_CURVE_ORDER;
    }

    return {
      commitmentCmOmega: pt_func(Cm_gen),
      R_point: pt_func(R_point_gen),
      S_point: pt_func(S_point_gen),
      W_points: W_points_gen.map(pt_func),
      T_points: T_points_gen.map(pt_func),
      eta1: "0x" + eta1.toString(16),
      eta2: "0x" + eta2.toString(16),
      vMatrix: vMatrix.map((v) => "0x" + v.toString(16)),
    };
} 