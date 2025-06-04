const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ManagementContract", function () {
  let ManagementContract, managementContract, owner, addr1, addr2;

  beforeEach(async function () {
    ManagementContract = await ethers.getContractFactory("ManagementContract");
    [owner, addr1, addr2] = await ethers.getSigners();
    managementContract = await ManagementContract.deploy();
    // await managementContract.deployed(); // deprecated
    await managementContract.waitForDeployment();
  });

  describe("Registration", function () {
    it("Should allow a user to register and emit a Registered event", async function () {
      await expect(managementContract.connect(addr1).register("0x", "0x"))
        .to.emit(managementContract, "Registered")
        .withArgs(addr1.address, 1); // Assuming voterId starts at 1

      expect(await managementContract.isVoterRegistered(addr1.address)).to.be.true;
      expect(await managementContract.getRegisteredVotersCount()).to.equal(1);
      expect(await managementContract.voterIdToAddress(1)).to.equal(addr1.address);
    });

    it("Should not allow a user to register twice", async function () {
      await managementContract.connect(addr1).register("0x", "0x");
      await expect(managementContract.connect(addr1).register("0x", "0x"))
        .to.be.revertedWith("Voter already registered");
    });

    it("Should not allow registration if registration is closed", async function () {
      await managementContract.connect(owner).closeRegistration();
      await expect(managementContract.connect(addr1).register("0x", "0x"))
        .to.be.revertedWith("Registration is closed");
    });
  });

  describe("closeRegistration", function () {
    it("Should allow the owner to close registration and emit RegistrationClosed event", async function () {
      await managementContract.connect(addr1).register("0x", "0x");
      await managementContract.connect(addr2).register("0x", "0x");

      await expect(managementContract.connect(owner).closeRegistration())
        .to.emit(managementContract, "RegistrationClosed")
        .withArgs(2); // Total voters

      expect(await managementContract.registrationClosed()).to.be.true;
    });

    it("Should not allow a non-owner to close registration", async function () {
      await expect(managementContract.connect(addr1).closeRegistration())
        .to.be.revertedWithCustomError(managementContract, "OwnableUnauthorizedAccount")
        .withArgs(addr1.address);
    });
  });

  describe("dispatchMPC", function () {
    it("Should allow the owner to dispatch MPC and emit MPCDispatched event after registration is closed", async function () {
      await managementContract.connect(owner).closeRegistration();
      const numVoters = 0; // Or some expected number based on registrations
      const numCandidates = 2; // Example

      await expect(managementContract.connect(owner).dispatchMPC(numVoters, numCandidates))
        .to.emit(managementContract, "MPCDispatched")
        .withArgs("QmPlaceholderTaskSpecCID1234567890", numVoters, numCandidates);

      expect(await managementContract.taskSpecCID()).to.equal("QmPlaceholderTaskSpecCID1234567890");
    });

    it("Should not allow dispatching MPC if registration is not closed", async function () {
      await expect(managementContract.connect(owner).dispatchMPC(0, 2))
        .to.be.revertedWith("Registration is not yet closed");
    });
  });

  describe("grantResultViewer", function () {
    it("Should allow the owner to grant result viewing permission", async function () {
      await expect(managementContract.connect(owner).grantResultViewer(addr1.address))
        .to.emit(managementContract, "ResultViewerGranted")
        .withArgs(addr1.address);
      expect(await managementContract.resultViewers(addr1.address)).to.be.true;
    });

    it("Should not allow a non-owner to grant result viewing permission", async function () {
       await expect(managementContract.connect(addr1).grantResultViewer(addr2.address))
        .to.be.revertedWithCustomError(managementContract, "OwnableUnauthorizedAccount")
        .withArgs(addr1.address);
    });
  });
});
