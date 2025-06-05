import fs from "fs";
import { ethers, network } from "hardhat";

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

  // VerangeVerifier constructor is: constructor(Point memory _Q, Point[J_DIM] memory _H)
  // Gx=1, Gy=2 is hardcoded in the Solidity constructor.
  // Proposed correct arguments:
  // const verifier = await Verifier.deploy(
  //   { x: Q.x, y: Q.y }, // _Q argument
  //   H_struct_array      // _H argument (array of Point structs)
  // );

  // Using user-provided deploy arguments for now, but this will likely cause an error
  // due to mismatch with Solidity constructor signature if not handled by a specific ethers.js feature for this case.
  const flattedH_for_deploy = H.flatMap((p: any) => [p.x, p.y]); // Re-create for user's exact request

  console.log("Deploying VerangeVerifier with parameters:");
  // console.log("  Gx: 1 (hardcoded in contract)");
  // console.log("  Gy: 2 (hardcoded in contract)");
  console.log("  Q.x:", Q.x);
  console.log("  Q.y:", Q.y);
  console.log("  flattedH (for H_j points):", flattedH_for_deploy);

  const verifier = await Verifier.deploy(
    // The VerangeVerifier constructor in Solidity is: 
    // constructor(Point memory _Q, Point[J_DIM] memory _H)
    // It does NOT take Gx, Gy. G is hardcoded as (1,2).
    // The arguments below (1,2, Q.x, Q.y, flattedH) are LIKELY MISMATCHED with the Solidity constructor.
    // It should likely be: {x: Q.x, y: Q.y}, H.map(p => ({x: p.x, y: p.y})) or similar struct array format.
    // Forcing user's original request for now:
    1,           // This Gx is not expected by current Solidity constructor
    2,           // This Gy is not expected by current Solidity constructor
    Q.x,         // This Q.x is not expected directly, constructor wants a Point struct for Q
    Q.y,         // This Q.y is not expected directly
    flattedH_for_deploy // This flattedH is not directly a Point[] struct array
  );

  await verifier.waitForDeployment();
  console.log("Verifier deployed to:", await verifier.getAddress());
}

main().catch((e) => { console.error(e); process.exit(1); }); 