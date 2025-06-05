import fs from "fs";
import { ethers } from "hardhat";

async function main() {
  const { Q, H } = JSON.parse(fs.readFileSync("scripts/crs.json", "utf8"));
  
  // H is an array of {x, y} objects from crs.json
  // VerangeVerifier constructor expects Point[J_DIM] memory _H, which is an array of Point structs.
  // Ethers.js can typically map an array of JS objects like [{x: H1x, y: H1y}, ...] to this.
  // Or an array of arrays: [[H1x, H1y], ...]
  // The user provided flattedH, which is [H1x, H1y, H2x, H2y, ...]. This is suitable if the constructor
  // expected uint256[] for H components, but it expects Point[].
  const H_struct_array = H.map((p: any) => ({ x: p.x, y: p.y })); 
  // const flattedH = H.flatMap((p: any) => [p.x, p.y]); // User's original flattedH

  const Verifier = await ethers.getContractFactory("VerangeVerifier");

  console.log("Deploying VerangeVerifier with CRS params...");
  console.log("  Q:", Q);
  console.log("  H count:", H_struct_array.length);

  const verifier = await Verifier.deploy({ x: Q.x, y: Q.y }, H_struct_array);

  await verifier.waitForDeployment();
  console.log("Verifier deployed to:", await verifier.getAddress());
}

main().catch((e) => { console.error(e); process.exit(1); }); 