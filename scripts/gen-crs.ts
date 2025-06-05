import { bn254 } from "@noble/curves/bn254";
import { utf8ToBytes } from "@noble/hashes/utils";
import { hashToCurve_TI } from "./lib/crypto_utils.mjs"; // Assuming .mjs output, will be handled by ts-node
import * as fs from 'fs';
import * as path from 'path';
const { ProjectivePoint } = bn254 as any; // Use 'as any' to avoid potential type issues with ProjectivePoint

const Q = hashToCurve_TI(utf8ToBytes("VeRange-Type1-Q"), "VeRange-T1-Q");
const H_arr = [...Array(8)].map((_, i) => // Renamed H to H_arr to avoid conflict if this script is imported elsewhere
  hashToCurve_TI(utf8ToBytes(`VeRange-Type1-H${i + 1}`), `VeRange-T1-H${i+1}`)
);

function fmt(p: any) { // p type to any
  const { x, y } = p.toAffine(); // Correctly destructure the affine point object
  return { x: "0x" + x.toString(16), y: "0x" + y.toString(16) };
}

const crsJson = {
  Q: fmt(Q),
  H: H_arr.map(fmt), // Use H_arr
};

const outputDir = 'scripts';
const outputPath = path.join(outputDir, 'crs.json');

// Ensure the directory exists
fs.mkdirSync(outputDir, { recursive: true });

// Write the file
fs.writeFileSync(outputPath, JSON.stringify(crsJson, null, 2), 'utf8');

console.log(`✅ CRS generated successfully at ${outputPath}`); 