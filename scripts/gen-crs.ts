import { bn254 } from "@noble/curves/bn254";
import { utf8ToBytes } from "@noble/hashes/utils";
const { ProjectivePoint } = bn254 as any; // Use 'as any' to avoid potential type issues with ProjectivePoint

const Q = ProjectivePoint.hashToCurve(utf8ToBytes("VeRange-Type1-Q"));
const H_arr = [...Array(8)].map((_, i) => // Renamed H to H_arr to avoid conflict if this script is imported elsewhere
  ProjectivePoint.hashToCurve(utf8ToBytes(`VeRange-Type1-H${i + 1}`))
);

function fmt(p: any) { // p type to any
  const [x, y] = p.toAffine();
  return { x: "0x" + x.toString(16), y: "0x" + y.toString(16) };
}
console.log(
  JSON.stringify(
    {
      Q: fmt(Q),
      H: H_arr.map(fmt), // Use H_arr
    },
    null,
    2
  )
); 