const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TallyBase", function () {
    let TallyBase;
    let tallyBase;
    let owner, voter1, voter2;
    const candidates = ["Candidate A", "Candidate B", "Candidate C"];
    const candidateCount = candidates.length;

    beforeEach(async function () {
        [owner, voter1, voter2] = await ethers.getSigners();
        TallyBase = await ethers.getContractFactory("TallyBase");
        tallyBase = await TallyBase.deploy(candidates);
        // await tallyBase.deployed(); // Not needed in ethers v6, waitForDeployment is used if tx is needed
    });

    describe("Deployment and Initialization", function () {
        it("Should set the candidates correctly", async function () {
            for (let i = 0; i < candidateCount; i++) {
                expect(await tallyBase.candidates(i)).to.equal(candidates[i]);
            }
        });

        it("Should return the correct candidate count", async function () {
            expect(await tallyBase.getCandidateCount()).to.equal(candidateCount);
        });

        it("Should initialize results to all zeros", async function () {
            const results = await tallyBase.getResults();
            expect(results.length).to.equal(candidateCount);
            for (let i = 0; i < candidateCount; i++) {
                expect(results[i]).to.equal(0);
            }
        });
    });

    describe("tallyVote", function () {
        it("Should allow a voter to cast a vote and emit VoteCast event", async function () {
            const candidateId = 0;
            // In TallyBase, any address can call tallyVote if the interface is public.
            // The restriction to VotingRouter is a design convention, not enforced by TallyBase's onlyRole modifier.
            // Here, voter1 directly calls tallyVote, representing the router passing the voter's address.
            await expect(tallyBase.connect(voter1).tallyVote(voter1.address, candidateId))
                .to.emit(tallyBase, "VoteCast")
                .withArgs(voter1.address, candidateId);

            const results = await tallyBase.getResults();
            expect(results[candidateId]).to.equal(1);
            expect(await tallyBase.hasVoted(voter1.address)).to.be.true;
        });

        it("Should revert if candidateId is out of bounds", async function () {
            const invalidCandidateId = candidateCount;
            await expect(tallyBase.connect(voter1).tallyVote(voter1.address, invalidCandidateId))
                .to.be.revertedWithCustomError(tallyBase, "TallyBase__InvalidCandidateId")
                .withArgs(invalidCandidateId, candidateCount);
        });

        it("Should revert if voter has already voted", async function () {
            const candidateId = 0;
            await tallyBase.connect(voter1).tallyVote(voter1.address, candidateId);

            await expect(tallyBase.connect(voter1).tallyVote(voter1.address, candidateId + 1)) // Try voting again for another candidate
                .to.be.revertedWithCustomError(tallyBase, "TallyBase__AlreadyVoted")
                .withArgs(voter1.address);
        });

        it("Should allow multiple voters to cast votes", async function () {
            const candidateId1 = 0;
            const candidateId2 = 1;

            await tallyBase.connect(voter1).tallyVote(voter1.address, candidateId1);
            await tallyBase.connect(voter2).tallyVote(voter2.address, candidateId2);

            const results = await tallyBase.getResults();
            expect(results[candidateId1]).to.equal(1);
            expect(results[candidateId2]).to.equal(1);
            expect(await tallyBase.hasVoted(voter1.address)).to.be.true;
            expect(await tallyBase.hasVoted(voter2.address)).to.be.true;
        });

        it("Should correctly tally multiple votes for the same candidate", async function () {
            const candidateId = 0;
            await tallyBase.connect(voter1).tallyVote(voter1.address, candidateId);
            await tallyBase.connect(voter2).tallyVote(voter2.address, candidateId);

            const results = await tallyBase.getResults();
            expect(results[candidateId]).to.equal(2);
        });
    });

    describe("getResults", function () {
        it("Should return all zeros if no votes are cast", async function () {
            const results = await tallyBase.getResults();
            expect(results.length).to.equal(candidateCount);
            results.forEach(result => expect(result).to.equal(0));
        });

        it("Should return correct results after votes", async function () {
            await tallyBase.connect(voter1).tallyVote(voter1.address, 0);
            await tallyBase.connect(voter2).tallyVote(voter2.address, 1);
            // Simulating a third vote, perhaps from the 'owner' account acting as a distinct voter
            await tallyBase.connect(owner).tallyVote(owner.address, 0);

            const results = await tallyBase.getResults();
            expect(results[0]).to.equal(2);
            expect(results[1]).to.equal(1);
            if (candidateCount > 2) {
                expect(results[2]).to.equal(0);
            }
        });
    });
}); 