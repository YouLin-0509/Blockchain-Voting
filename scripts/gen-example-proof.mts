/*
 * Generate a single VeRange Type‑1 proof for ω = 5, N = 64 (J = K = 8)
 * Run with:  npx ts-node --esm scripts/gen-example-proof.ts
 * Output:    scripts/example_proof.json
 */

import fs from "fs";
import { generateProof } from "./lib/prover.mjs";

const omega = 5n;
console.log(`Generating proof for omega = ${omega}...`);

const proofJson = generateProof(omega);

fs.mkdirSync("scripts", { recursive: true });
fs.writeFileSync("scripts/example_proof.json", JSON.stringify(proofJson, null, 2));

console.log(`\n✅  example_proof.json for omega = ${omega} generated → scripts/example_proof.json`); 