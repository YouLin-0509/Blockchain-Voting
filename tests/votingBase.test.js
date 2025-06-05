const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VotingBase", () => {
  let voting, owner, voter1, voter2, stranger;
  beforeEach(async () => {
    [owner, voter1, voter2, stranger] = await ethers.getSigners();
    const VotingBase = await ethers.getContractFactory("VotingBase");
    voting = await VotingBase.deploy(["A", "B"]);
    await voting.waitForDeployment();
  });

  it("should register voter and prevent duplicate vote", async () => {
    await voting.addVoter(voter1.address);
    await voting.startVoting();
    await voting.connect(voter1).vote(0);
    await expect(voting.connect(voter1).vote(0)).to.be.revertedWith("ALREADY");
  });

  it("stranger cannot vote", async () => {
    await voting.startVoting();
    await expect(voting.connect(stranger).vote(0)).to.be.revertedWith("NOT_VOTER");
  });

  it("tally correct", async () => {
    await voting.addVoter(voter1.address);
    await voting.addVoter(voter2.address);
    await voting.startVoting();
    await voting.connect(voter1).vote(0);
    await voting.connect(voter2).vote(1);
    await voting.endVoting();
    const res = await voting.allResults();
    expect(res.map(x=>x.toNumber())).to.deep.equal([1,1]);
  });
}); 