const fs = require("fs");
const { expect } = require("chai");
const { ethers } = require("hardhat"); // This might need adjustment based on Hardhat version/setup

describe("VeRange — single proof", () => {
  let verifier, proofData; // Renamed proof to proofData to avoid conflict with it block variable

  before(async () => {
    const crs = JSON.parse(fs.readFileSync("scripts/crs.json", "utf8"));
    const H_struct_array_for_deploy = crs.H.map((p_val) => ({ x: p_val.x, y: p_val.y }));

    const Verifier = await ethers.getContractFactory("VerangeVerifier");
    verifier = await Verifier.deploy({ x: crs.Q.x, y: crs.Q.y }, H_struct_array_for_deploy);
    await verifier.waitForDeployment();

    proofData = JSON.parse(fs.readFileSync("scripts/example_proof.json", "utf8"));
  });

  // Helper function to format points for the contract call if needed for Point[] structs.
  // If flatPts is used as in user example, it flattens to [x1,y1,x2,y2...]
  // For Point[] struct array, it should be [{x,y}, {x,y}, ...] or [[x,y], [x,y], ...]
  function formatPointArrayForSolidity(points) {
    return points.map(p_val => ({ x: p_val.x, y: p_val.y })); // Renamed p to p_val
  }

  it("accepts a valid proof", async () => {
    const W_formatted = formatPointArrayForSolidity(proofData.W_points);
    const T_formatted = formatPointArrayForSolidity(proofData.T_points);

    const ok = await verifier.verifyVeRange(
      { x: proofData.commitmentCmOmega.x, y: proofData.commitmentCmOmega.y }, // Cm Point struct
      {
        W: W_formatted,       // Correctly formatted Point[]
        T: T_formatted,       // Correctly formatted Point[]
        R: { x: proofData.R_point.x, y: proofData.R_point.y }, // R Point struct
        S: { x: proofData.S_point.x, y: proofData.S_point.y }, // S Point struct
        eta1: proofData.eta1,
        eta2: proofData.eta2,
        vMatrix: proofData.vMatrix,
      }
    );
    expect(ok).to.equal(true);
  });

  it("rejects a tampered proof (e.g., modified eta2)", async () => {
    const badEta2 = (ethers.toBigInt(proofData.eta2) ^ 1n).toString(); // Ensure it's a string if original is hex string
    
    const W_formatted = formatPointArrayForSolidity(proofData.W_points);
    const T_formatted = formatPointArrayForSolidity(proofData.T_points);

    const ok = await verifier.verifyVeRange(
      { x: proofData.commitmentCmOmega.x, y: proofData.commitmentCmOmega.y },
      {
        W: W_formatted,
        T: T_formatted,
        R: { x: proofData.R_point.x, y: proofData.R_point.y },
        S: { x: proofData.S_point.x, y: proofData.S_point.y },
        eta1: proofData.eta1,
        eta2: badEta2, // Tampered eta2
        vMatrix: proofData.vMatrix,
      }
    );
    expect(ok).to.equal(false);
  });
}); 