/* test/votingBase.test.js
 * Baseline VotingBase 合約完整測試
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VotingBase (stand-alone)", () => {
  let voting, owner, voter1, voter2, stranger;

  beforeEach(async () => {
    [owner, voter1, voter2, stranger] = await ethers.getSigners();
    const VotingBase = await ethers.getContractFactory("VotingBase");
    voting = await VotingBase.deploy(["Alice", "Bob"]);
    await voting.waitForDeployment();
  });

  /* --------------------------------------------------------------------- */
  /*  Phase + Admin controls                                               */
  /* --------------------------------------------------------------------- */

  describe("Registration phase (admin only)", () => {
    it("owner can add voter; non-owner cannot", async () => {
      // owner OK
      await expect(voting.addVoter(voter1.address))
        .to.emit(voting, "VoterRegistered").withArgs(voter1.address);

      // stranger NG
      await expect(
        voting.connect(stranger).addVoter(voter2.address)
      ).to.be.revertedWith("NOT_ADMIN");
    });

    it("cannot add voter after phase moves to Voting", async () => {
      await voting.startVoting();                                   // Phase → Voting
      await expect(
        voting.addVoter(voter2.address)
      ).to.be.revertedWith("BAD_PHASE");
    });

    it("only owner can switch phases, and順序必須正確", async () => {
      // non-owner 不能 startVoting
      await expect(
        voting.connect(stranger).startVoting()
      ).to.be.revertedWith("NOT_ADMIN");

      // 正常流程: Register → Voting → Ended
      await voting.startVoting();
      await voting.endVoting();

      // 已 Ended，不可再次切換
      await expect(voting.startVoting()).to.be.revertedWith("BAD_PHASE");
      await expect(voting.endVoting()).to.be.revertedWith("BAD_PHASE");
    });
  });

  /* --------------------------------------------------------------------- */
  /*  Voting behaviour                                                     */
  /* --------------------------------------------------------------------- */

  describe("Voting phase 行為", () => {
    beforeEach(async () => {
      await voting.addVoter(voter1.address);
      await voting.addVoter(voter2.address);
      await voting.startVoting();                                   // 進入 Voting phase
    });

    it("registered voter can vote exactly once (duplicate prevented)", async () => {
      await voting.connect(voter1).vote(0);
      await expect(
        voting.connect(voter1).vote(0)
      ).to.be.revertedWith("ALREADY");
    });

    it("unregistered address cannot vote", async () => {
      await expect(
        voting.connect(stranger).vote(0)
      ).to.be.revertedWith("NOT_VOTER");
    });

    it("cannot vote with candidateId out of range", async () => {
      await expect(
        voting.connect(voter1).vote(5)
      ).to.be.revertedWith("BAD_ID");
    });
  });

  /* --------------------------------------------------------------------- */
  /*  Tally & Results                                                      */
  /* --------------------------------------------------------------------- */

  describe("End phase 計票結果", () => {
    it("returns correct tally after voting ends", async () => {
      await voting.addVoter(voter1.address);
      await voting.addVoter(voter2.address);

      await voting.startVoting();
      await voting.connect(voter1).vote(0);                          // Alice 1 票
      await voting.connect(voter2).vote(1);                          // Bob   1 票
      await voting.endVoting();

      const res = await voting.allResults();                         // uint256[]
      expect(res.map(n => Number(n))).to.deep.equal([1, 1]);
    });

    it("cannot read results before phase Ended", async () => {
      await expect(voting.result(0)).to.be.revertedWith("NOT_ENDED");
      await expect(voting.allResults()).to.be.revertedWith("NOT_ENDED");
    });
  });
});
