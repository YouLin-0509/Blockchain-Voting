const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CountingContract", function () {
  let countingContract;
  let owner;
  let voter;

  beforeEach(async function () {
    // 獲取測試帳戶
    [owner, voter] = await ethers.getSigners();

    // 部署合約
    const CountingContract = await ethers.getContractFactory("CountingContract");
    countingContract = await CountingContract.deploy();
    await countingContract.waitForDeployment();
  });

  describe("submitEncryptedBallot", function () {
    it("Should allow a user to submit an encrypted ballot and emit BallotAccepted event", async function () {
      const ballotCID = ethers.encodeBytes32String("QmTestBallotCID123");
      const veRangeProof = ethers.encodeBytes32String("0xTestProof123");

      const tx = await countingContract.connect(voter).submitEncryptedBallot(ballotCID, veRangeProof);
      const receipt = await tx.wait();

      // 驗證事件
      const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'BallotAccepted');
      expect(event).to.not.be.undefined;
      expect(event.args[0]).to.equal(voter.address);
      expect(event.args[1]).to.equal(ballotCID);

      // 驗證選票是否被正確記錄
      const storedBallotCID = await countingContract.submittedBallots(voter.address);
      expect(storedBallotCID).to.equal(ballotCID);
    });

    it("Should not allow a user to submit multiple ballots", async function () {
      const ballotCID1 = ethers.encodeBytes32String("QmTestBallotCID123");
      const ballotCID2 = ethers.encodeBytes32String("QmTestBallotCID456");
      const veRangeProof = ethers.encodeBytes32String("0xTestProof123");

      // 提交第一張選票
      await countingContract.connect(voter).submitEncryptedBallot(ballotCID1, veRangeProof);

      // 嘗試提交第二張選票應該失敗
      await expect(
        countingContract.connect(voter).submitEncryptedBallot(ballotCID2, veRangeProof)
      ).to.be.revertedWith("Ballot already submitted for this address");
    });
  });

  describe("publishResult", function () {
    const encSigma = ethers.encodeBytes32String("0xsigma");
    const encSorted = ethers.encodeBytes32String("0xsorted");

    it("Should allow publishing results and emit ResultPublished event", async function () {
      await expect(countingContract.connect(owner).publishResult(encSigma, encSorted))
        .to.emit(countingContract, "ResultPublished")
        .withArgs(encSigma, encSorted);

      expect(await countingContract.encryptedSigma()).to.equal(encSigma);
      expect(await countingContract.encryptedSortedBallots()).to.equal(encSorted);
    });
  });
});
