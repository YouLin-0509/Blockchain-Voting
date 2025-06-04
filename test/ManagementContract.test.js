const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ManagementContract", function () {
  let managementContract;
  let owner;
  let voter;

  beforeEach(async function () {
    // 獲取測試帳戶
    [owner, voter] = await ethers.getSigners();

    // 部署合約
    const ManagementContract = await ethers.getContractFactory("ManagementContract");
    managementContract = await ManagementContract.deploy();
    await managementContract.waitForDeployment();
  });

  describe("Registration", function () {
    it("Should allow a user to register and emit Registered event", async function () {
      const ringSig = ethers.encodeBytes32String("0xTestRingSig123");
      const pkSet = ethers.encodeBytes32String("0xTestPKSet123");

      await expect(managementContract.connect(voter).register(ringSig, pkSet))
        .to.emit(managementContract, "Registered")
        .withArgs(voter.address, 1); // 第一個註冊的選民 ID 為 1

      expect(await managementContract.isVoterRegistered(voter.address)).to.be.true;
      expect(await managementContract.voterIdToAddress(1)).to.equal(voter.address);
    });

    it("Should not allow a user to register twice", async function () {
      const ringSig = ethers.encodeBytes32String("0xTestRingSig123");
      const pkSet = ethers.encodeBytes32String("0xTestPKSet123");

      await managementContract.connect(voter).register(ringSig, pkSet);

      await expect(
        managementContract.connect(voter).register(ringSig, pkSet)
      ).to.be.revertedWith("Voter already registered");
    });

    it("Should not allow registration if registration is closed", async function () {
      await managementContract.connect(owner).closeRegistration();
      await expect(
        managementContract.connect(voter).register(
          ethers.encodeBytes32String("0xTestRingSig123"),
          ethers.encodeBytes32String("0xTestPKSet123")
        )
      ).to.be.revertedWith("Registration is closed");
    });
  });

  describe("Registration Control", function () {
    it("Should allow owner to close registration", async function () {
      await managementContract.connect(owner).closeRegistration();
      expect(await managementContract.registrationClosed()).to.be.true;
    });

    it("Should not allow non-owner to close registration", async function () {
      await expect(
        managementContract.connect(voter).closeRegistration()
      ).to.be.revertedWithCustomError(managementContract, "OwnableUnauthorizedAccount");
    });
  });

  describe("MPC Dispatch", function () {
    it("Should allow owner to dispatch MPC task after registration is closed", async function () {
      const voters = 1; // 使用數字而不是地址數組
      const candidates = 1; // 使用數字而不是候選人數組

      await managementContract.connect(owner).closeRegistration();

      const tx = await managementContract.connect(owner).dispatchMPC(voters, candidates);
      const receipt = await tx.wait();

      const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'MPCDispatched');
      expect(event).to.not.be.undefined;
      expect(event.args[1]).to.equal(voters);
      expect(event.args[2]).to.equal(candidates);
    });

    it("Should not allow MPC dispatch before registration is closed", async function () {
      const voters = 1;
      const candidates = 1;

      await expect(
        managementContract.connect(owner).dispatchMPC(voters, candidates)
      ).to.be.revertedWith("Registration is not yet closed");
    });
  });

  describe("Result Viewing", function () {
    it("Should allow owner to view registered voters", async function () {
      const voterCount = await managementContract.getRegisteredVotersCount();
      expect(typeof voterCount).to.equal("bigint");
    });
  
    it("Should allow non-owner to view registered voters", async function () {
      const voterCount = await managementContract.connect(voter).getRegisteredVotersCount();
      expect(typeof voterCount).to.equal("bigint");
    });
  });

  describe("grantResultViewer", function () {
    it("Should allow the owner to grant result viewing permission", async function () {
      await expect(managementContract.connect(owner).grantResultViewer(voter.address))
        .to.emit(managementContract, "ResultViewerGranted")
        .withArgs(voter.address);
      expect(await managementContract.resultViewers(voter.address)).to.be.true;
    });

    it("Should not allow a non-owner to grant result viewing permission", async function () {
      await expect(
        managementContract.connect(voter).grantResultViewer(owner.address)
      ).to.be.revertedWithCustomError(managementContract, "OwnableUnauthorizedAccount");
    });
  });
});
