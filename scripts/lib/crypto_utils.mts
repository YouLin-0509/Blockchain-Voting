import { bn254 } from '@noble/curves/bn254';
import { keccak_256 } from '@noble/hashes/sha3';
import { utf8ToBytes } from '@noble/hashes/utils';
import { bytesToNumberBE } from '@noble/curves/abstract/utils';

const Fp   = (bn254 as any).G1.CURVE.Fp; // prime field
const B    = 3n;                         // y² = x³ + 3
const p    = Fp.ORDER;                   // field prime

export function hashToCurve_TI(msg: Uint8Array, dst = 'VeRange-T1'): any {
  let ctr = 0;
  while (true) {
    const seed = new Uint8Array([...utf8ToBytes(dst), ...msg, ctr]);
    const h    = keccak_256(seed);
    const x    = bytesToNumberBE(h) % p;

    try {
      const y2   = Fp.add(Fp.pow(x, 3n), B);
      const y    = Fp.sqrt(y2);

      // choose lexicographically-smallest y
      const yFinal = y > p / 2n ? p - y : y;
      
      const point = (bn254 as any).G1.ProjectivePoint.fromAffine({ x, y: yFinal });
      // Cofactor for bn254.G1 is 1, so clearCofactor is a no-op but good practice
      return point.clearCofactor();
    } catch (e) {
      ctr++;
      continue;
    }
  }
} 