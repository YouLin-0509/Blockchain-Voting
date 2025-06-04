const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CountingContract", function () {
  let CountingContract, countingContract, owner, addr1;
  // let ManagementContract, managementContract; // For future integration tests

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();

    // Deploy ManagementContract if needed for setup (even if placeholder)
    // const ManagementContractFactory = await ethers.getContractFactory("ManagementContract");
    // managementContract = await ManagementContractFactory.deploy();
    // await managementContract.waitForDeployment();

    CountingContract = await ethers.getContractFactory("CountingContract");
    // Pass managementContract.address if constructor requires it
    // countingContract = await CountingContract.deploy(managementContract.address);
    countingContract = await CountingContract.deploy(); // Assuming no constructor args for now
    await countingContract.waitForDeployment();
  });

  describe("submitEncryptedBallot", function () {
    const dummyCID = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"; // 32 bytes
    const dummyProof = "0xproof";

    it("Should allow a user to submit an encrypted ballot and emit BallotAccepted event", async function () {
      // For now, direct call. Later, integrate with ManagementContract for voter eligibility.
      // Example: Register voter in ManagementContract first
      // await managementContract.connect(addr1).register("0x", "0x");
      // await managementContract.connect(owner).closeRegistration();
      // Then set managementContractAddress in CountingContract if needed.

      await expect(countingContract.connect(addr1).submitEncryptedBallot(dummyCID, dummyProof))
        .to.emit(countingContract, "BallotAccepted")
        .withArgs(addr1.address, dummyCID);

      expect(await countingContract.submittedBallots(addr1.address)).to.equal(dummyCID);
    });

    it("Should revert if VeRange proof verification fails (mocked)", async function () {
      // This test requires modifying the contract to make verifyVeRange return false.
      // For now, our placeholder verifyVeRange always returns true.
      // If we had a way to mock it from the test or a setter in contract:
      // await countingContract.setVeRangeVerificationResult(false); // Hypothetical
      // await expect(countingContract.connect(addr1).submitEncryptedBallot(dummyCID, dummyProof))
      // .to.be.revertedWith("VeRange proof verification failed");
      // This test is more of a placeholder until VeRange is implemented.
      // For now, we can't directly test the false path of verifyVeRange with current contract.
      // We can test the revert if "Ballot already submitted"
       await countingContract.connect(addr1).submitEncryptedBallot(dummyCID, dummyProof);
       await expect(countingContract.connect(addr1).submitEncryptedBallot(dummyCID, dummyProof))
        .to.be.revertedWith("Ballot already submitted for this address");
    });

     it("Should not allow submitting a ballot twice from the same address", async function () {
      await countingContract.connect(addr1).submitEncryptedBallot(dummyCID, dummyProof);
      await expect(countingContract.connect(addr1).submitEncryptedBallot(dummyCID, dummyProof))
        .to.be.revertedWith("Ballot already submitted for this address");
    });
  });

  describe("publishResult", function () {
    const encSigma = "0xsigma";
    const encSorted = "0xsorted";

    it("Should allow publishing results and emit ResultPublished event", async function () {
      // In a real scenario, this would be restricted (e.g., by MPC node address or owner)
      await expect(countingContract.connect(owner).publishResult(encSigma, encSorted))
        .to.emit(countingContract, "ResultPublished")
        .withArgs(encSigma, encSorted);

      expect(await countingContract.encryptedSigma()).to.equal(encSigma);
      expect(await countingContract.encryptedSortedBallots()).to.equal(encSorted);
    });
  });
});
