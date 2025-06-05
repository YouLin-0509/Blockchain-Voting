const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("VotingRouter", function () {
    const candidates = ["Alice", "Bob", "Charlie"];
    const candidateCount = candidates.length;

    async function deployVotingRouterFixture() {
        const [owner, user1, user2, otherAccount] = await ethers.getSigners();

        // Deploy TallyBase as the ITally plugin
        const TallyBase = await ethers.getContractFactory("TallyBase");
        const tallyBase = await TallyBase.deploy(candidates);
        // await tallyBase.deployed(); // Not needed in ethers v6

        // Deploy VotingRouter
        const VotingRouter = await ethers.getContractFactory("VotingRouter");
        const votingRouter = await VotingRouter.deploy(
            candidates,
            await tallyBase.getAddress(),
            ethers.ZeroAddress // No verifier plugin for now
        );
        // await votingRouter.deployed(); // Not needed in ethers v6

        return { votingRouter, tallyBase, owner, user1, user2, otherAccount, candidates, candidateCount };
    }

    describe("Deployment and Initialization", function () {
        it("Should set the admin correctly", async function () {
            const { votingRouter, owner } = await loadFixture(deployVotingRouterFixture);
            expect(await votingRouter.admin()).to.equal(owner.address);
        });

        it("Should set the tallyPlugin correctly", async function () {
            const { votingRouter, tallyBase } = await loadFixture(deployVotingRouterFixture);
            expect(await votingRouter.tallyPlugin()).to.equal(await tallyBase.getAddress());
        });

        it("Should set the verifierPlugin to address(0) if none provided", async function () {
            const { votingRouter } = await loadFixture(deployVotingRouterFixture);
            expect(await votingRouter.verifierPlugin()).to.equal(ethers.ZeroAddress);
        });

        it("Should set candidates and candidateCount correctly", async function () {
            const { votingRouter, candidates, candidateCount } = await loadFixture(deployVotingRouterFixture);
            expect(await votingRouter.getCandidateCount()).to.equal(candidateCount);
            const fetchedCandidates = await votingRouter.getCandidates();
            expect(fetchedCandidates.length).to.equal(candidateCount);
            for (let i = 0; i < candidateCount; i++) {
                expect(fetchedCandidates[i]).to.equal(candidates[i]);
            }
        });

        it("Should initialize currentPhase to Register", async function () {
            const { votingRouter } = await loadFixture(deployVotingRouterFixture);
            expect(await votingRouter.currentPhase()).to.equal(0); // Phase.Register
        });

        // it("Should emit TallyPluginSet event on deployment", async function () {
        //     const TallyBase = await ethers.getContractFactory("TallyBase");
        //     const tallyBase = await TallyBase.deploy(candidates);
        //     const tallyBaseAddress = await tallyBase.getAddress();

        //     const VotingRouterFactory = await ethers.getContractFactory("VotingRouter");
            
        //     // Test TallyPluginSet event
        //     await expect(VotingRouterFactory.deploy(candidates, tallyBaseAddress, ethers.ZeroAddress))
        //         .to.emit(VotingRouterFactory, "TallyPluginSet") // Target the factory for constructor events
        //         .withArgs(tallyBaseAddress);
        // });

        // it("Should emit PhaseChanged event to Register on deployment", async function () {
        //     const TallyBase = await ethers.getContractFactory("TallyBase");
        //     const tallyBase = await TallyBase.deploy(candidates);
        //     const tallyBaseAddress = await tallyBase.getAddress();
        //     const VotingRouterFactory = await ethers.getContractFactory("VotingRouter");

        //     // Test PhaseChanged(Register, Register) event
        //     // Phase.Register is 0, Phase.Voting is 1, Phase.Ended is 2
        //     await expect(VotingRouterFactory.deploy(candidates, tallyBaseAddress, ethers.ZeroAddress))
        //         .to.emit(VotingRouterFactory, "PhaseChanged")
        //         .withArgs(0, 0); // oldPhase = Register (0), newPhase = Register (0)
        // });
    });

    describe("Admin Functions", function () {
        it("setAdmin: should allow current admin to change admin", async function () {
            const { votingRouter, owner, user1 } = await loadFixture(deployVotingRouterFixture);
            await expect(votingRouter.connect(owner).setAdmin(user1.address))
                .to.emit(votingRouter, "AdminChanged")
                .withArgs(owner.address, user1.address);
            expect(await votingRouter.admin()).to.equal(user1.address);
        });

        it("setAdmin: should revert if called by non-admin", async function () {
            const { votingRouter, user1 } = await loadFixture(deployVotingRouterFixture);
            await expect(votingRouter.connect(user1).setAdmin(user1.address))
                .to.be.revertedWithCustomError(votingRouter, "VotingRouter__NotAdmin")
                .withArgs(user1.address);
        });

        it("setAdmin: should revert if new admin is address zero", async function () {
            const { votingRouter, owner } = await loadFixture(deployVotingRouterFixture);
            await expect(votingRouter.connect(owner).setAdmin(ethers.ZeroAddress))
                .to.be.revertedWithCustomError(votingRouter, "VotingRouter__InvalidAddress")
                .withArgs(ethers.ZeroAddress);
        });

        it("setTallyPlugin: should allow admin to change tally plugin", async function () {
            const { votingRouter, owner, otherAccount } = await loadFixture(deployVotingRouterFixture);
            // Deploy a new dummy TallyBase for testing change
            const TallyBase = await ethers.getContractFactory("TallyBase");
            const newTallyPlugin = await TallyBase.deploy(candidates);
            const newTallyPluginAddress = await newTallyPlugin.getAddress();

            await expect(votingRouter.connect(owner).setTallyPlugin(newTallyPluginAddress))
                .to.emit(votingRouter, "TallyPluginSet")
                .withArgs(newTallyPluginAddress);
            expect(await votingRouter.tallyPlugin()).to.equal(newTallyPluginAddress);
        });

        it("setTallyPlugin: should revert if new tally plugin is address zero", async function () {
            const { votingRouter, owner } = await loadFixture(deployVotingRouterFixture);
            await expect(votingRouter.connect(owner).setTallyPlugin(ethers.ZeroAddress))
                .to.be.revertedWithCustomError(votingRouter, "VotingRouter__InvalidAddress")
                .withArgs(ethers.ZeroAddress);
        });

        it("setVerifierPlugin: should allow admin to set verifier plugin", async function () {
            const { votingRouter, owner, otherAccount } = await loadFixture(deployVotingRouterFixture);
            await expect(votingRouter.connect(owner).setVerifierPlugin(otherAccount.address))
                .to.emit(votingRouter, "VerifierPluginSet")
                .withArgs(otherAccount.address);
            expect(await votingRouter.verifierPlugin()).to.equal(otherAccount.address);
        });

        it("setVerifierPlugin: should allow admin to set verifier plugin to address(0)", async function () {
            const { votingRouter, owner } = await loadFixture(deployVotingRouterFixture);
            await expect(votingRouter.connect(owner).setVerifierPlugin(ethers.ZeroAddress))
                .to.emit(votingRouter, "VerifierPluginSet")
                .withArgs(ethers.ZeroAddress);
            expect(await votingRouter.verifierPlugin()).to.equal(ethers.ZeroAddress);
        });

        it("setVerifierPlugin: should revert if called by non-admin", async function () {
            const { votingRouter, user1, otherAccount } = await loadFixture(deployVotingRouterFixture);
            await expect(votingRouter.connect(user1).setVerifierPlugin(otherAccount.address))
                .to.be.revertedWithCustomError(votingRouter, "VotingRouter__NotAdmin")
                .withArgs(user1.address);
        });

        describe("Phase Transitions", function () {
            it("startVotingPeriod: admin can switch from Register to Voting", async function () {
                const { votingRouter, owner } = await loadFixture(deployVotingRouterFixture);
                await expect(votingRouter.connect(owner).startVotingPeriod())
                    .to.emit(votingRouter, "PhaseChanged")
                    .withArgs(0 /*Register*/, 1 /*Voting*/);
                expect(await votingRouter.currentPhase()).to.equal(1 /*Voting*/);
            });

            it("startVotingPeriod: should revert if not in Register phase", async function () {
                const { votingRouter, owner } = await loadFixture(deployVotingRouterFixture);
                await votingRouter.connect(owner).startVotingPeriod(); // Move to Voting phase
                await expect(votingRouter.connect(owner).startVotingPeriod())
                    .to.be.revertedWithCustomError(votingRouter, "VotingRouter__InvalidPhase")
                    .withArgs(1 /*Voting*/, 0 /*Register*/);
            });

            it("startVotingPeriod: should revert if called by non-admin", async function () {
                const { votingRouter, user1 } = await loadFixture(deployVotingRouterFixture);
                await expect(votingRouter.connect(user1).startVotingPeriod())
                    .to.be.revertedWithCustomError(votingRouter, "VotingRouter__NotAdmin")
                    .withArgs(user1.address);
            });

            it("endVotingPeriod: admin can switch from Voting to Ended", async function () {
                const { votingRouter, owner } = await loadFixture(deployVotingRouterFixture);
                await votingRouter.connect(owner).startVotingPeriod(); // Move to Voting
                await expect(votingRouter.connect(owner).endVotingPeriod())
                    .to.emit(votingRouter, "PhaseChanged")
                    .withArgs(1 /*Voting*/, 2 /*Ended*/);
                expect(await votingRouter.currentPhase()).to.equal(2 /*Ended*/);
            });

            it("endVotingPeriod: should revert if not in Voting phase", async function () {
                const { votingRouter, owner } = await loadFixture(deployVotingRouterFixture);
                // Still in Register phase
                await expect(votingRouter.connect(owner).endVotingPeriod())
                    .to.be.revertedWithCustomError(votingRouter, "VotingRouter__InvalidPhase")
                    .withArgs(0 /*Register*/, 1 /*Voting*/);
            });

            it("endVotingPeriod: should revert if called by non-admin", async function () {
                const { votingRouter, owner, user1 } = await loadFixture(deployVotingRouterFixture);
                await votingRouter.connect(owner).startVotingPeriod(); // Move to Voting
                await expect(votingRouter.connect(user1).endVotingPeriod())
                    .to.be.revertedWithCustomError(votingRouter, "VotingRouter__NotAdmin")
                    .withArgs(user1.address);
            });
        });

        describe("registerVoterByAdmin", function () {
            it("should allow admin to register a voter in Register phase", async function () {
                const { votingRouter, owner, user1 } = await loadFixture(deployVotingRouterFixture);
                await expect(votingRouter.connect(owner).registerVoterByAdmin(user1.address))
                    .to.emit(votingRouter, "VoterRegistered")
                    .withArgs(user1.address);
                expect(await votingRouter.isVoterRegistered(user1.address)).to.be.true;
            });

            it("should revert if admin tries to register an already registered voter", async function () {
                const { votingRouter, owner, user1 } = await loadFixture(deployVotingRouterFixture);
                await votingRouter.connect(owner).registerVoterByAdmin(user1.address);
                await expect(votingRouter.connect(owner).registerVoterByAdmin(user1.address))
                    .to.be.revertedWithCustomError(votingRouter, "VotingRouter__AlreadyRegistered")
                    .withArgs(user1.address);
            });

            it("should revert if called by non-admin", async function () {
                const { votingRouter, user1, user2 } = await loadFixture(deployVotingRouterFixture);
                await expect(votingRouter.connect(user1).registerVoterByAdmin(user2.address))
                    .to.be.revertedWithCustomError(votingRouter, "VotingRouter__NotAdmin")
                    .withArgs(user1.address);
            });

            it("should revert if not in Register phase", async function () {
                const { votingRouter, owner, user1 } = await loadFixture(deployVotingRouterFixture);
                await votingRouter.connect(owner).startVotingPeriod(); // Move to Voting phase
                await expect(votingRouter.connect(owner).registerVoterByAdmin(user1.address))
                    .to.be.revertedWithCustomError(votingRouter, "VotingRouter__InvalidPhase")
                    .withArgs(1 /*Voting*/, 0 /*Register*/);
            });
        });
    });

    describe("Public User Functions", function () {
        describe("register", function () {
            it("should allow a user to register in Register phase", async function () {
                const { votingRouter, user1 } = await loadFixture(deployVotingRouterFixture);
                await expect(votingRouter.connect(user1).register())
                    .to.emit(votingRouter, "VoterRegistered")
                    .withArgs(user1.address);
                expect(await votingRouter.isVoterRegistered(user1.address)).to.be.true;
            });

            it("should revert if admin tries to public register", async function () {
                const { votingRouter, owner } = await loadFixture(deployVotingRouterFixture);
                await expect(votingRouter.connect(owner).register())
                    .to.be.revertedWithCustomError(votingRouter, "VotingRouter__NotAdmin")
                    .withArgs(owner.address); // Checks admin is not allowed to use public register
            });

            it("should revert if not in Register phase", async function () {
                const { votingRouter, owner, user1 } = await loadFixture(deployVotingRouterFixture);
                await votingRouter.connect(owner).startVotingPeriod(); // Move to Voting
                await expect(votingRouter.connect(user1).register())
                    .to.be.revertedWithCustomError(votingRouter, "VotingRouter__InvalidPhase")
                    .withArgs(1 /*Voting*/, 0 /*Register*/);
            });

            it("should revert if user is already registered", async function () {
                const { votingRouter, user1 } = await loadFixture(deployVotingRouterFixture);
                await votingRouter.connect(user1).register();
                await expect(votingRouter.connect(user1).register())
                    .to.be.revertedWithCustomError(votingRouter, "VotingRouter__AlreadyRegistered")
                    .withArgs(user1.address);
            });
        });

        describe("vote", function () {
            let Fixture;
            beforeEach(async function() {
                Fixture = await loadFixture(deployVotingRouterFixture);
                // Register user1 and move to Voting phase for vote tests
                await Fixture.votingRouter.connect(Fixture.owner).registerVoterByAdmin(Fixture.user1.address);
                await Fixture.votingRouter.connect(Fixture.owner).startVotingPeriod();
            });

            it("should allow a registered voter to vote in Voting phase", async function () {
                const { votingRouter, tallyBase, user1, candidates } = Fixture;
                const candidateId = 0;
                
                await expect(votingRouter.connect(user1).vote(candidateId))
                    .to.emit(votingRouter, "VoteCast") // Event from VotingRouter
                    .withArgs(user1.address, candidateId)
                    .to.emit(tallyBase, "VoteCast") // Event from TallyBase
                    .withArgs(user1.address, candidateId);

                expect(await votingRouter.hasVoted(user1.address)).to.be.true;
                const results = await tallyBase.getResults(); // Check TallyBase results
                expect(results[candidateId]).to.equal(1);
            });

            it("should revert if voter is not registered", async function () {
                const { votingRouter, user2 } = Fixture;
                const candidateId = 0;
                await expect(votingRouter.connect(user2).vote(candidateId))
                    .to.be.revertedWithCustomError(votingRouter, "VotingRouter__NotRegistered")
                    .withArgs(user2.address);
            });

            it("should revert if voter has already voted", async function () {
                const { votingRouter, user1 } = Fixture;
                const candidateId = 0;
                await votingRouter.connect(user1).vote(candidateId);
                await expect(votingRouter.connect(user1).vote(candidateId))
                    .to.be.revertedWithCustomError(votingRouter, "VotingRouter__AlreadyVoted")
                    .withArgs(user1.address);
            });

            it("should revert if not in Voting phase", async function () {
                const { votingRouter, owner, user1 } = await loadFixture(deployVotingRouterFixture); // Fresh fixture, still in Register
                await votingRouter.connect(owner).registerVoterByAdmin(user1.address);
                const candidateId = 0;
                await expect(votingRouter.connect(user1).vote(candidateId)) // In Register phase
                    .to.be.revertedWithCustomError(votingRouter, "VotingRouter__InvalidPhase")
                    .withArgs(0 /*Register*/, 1 /*Voting*/);
            });

            it("should revert if candidateId is invalid", async function () {
                const { votingRouter, user1, candidateCount } = Fixture;
                const invalidCandidateId = candidateCount;
                await expect(votingRouter.connect(user1).vote(invalidCandidateId))
                    .to.be.revertedWithCustomError(votingRouter, "VotingRouter__InvalidCandidateId")
                    .withArgs(invalidCandidateId, candidateCount);
            });
        });
    });

    describe("View Functions", function () {
        it("getPhase: should return the current phase", async function () {
            const { votingRouter, owner } = await loadFixture(deployVotingRouterFixture);
            expect(await votingRouter.getPhase()).to.equal(0 /*Register*/);
            await votingRouter.connect(owner).startVotingPeriod();
            expect(await votingRouter.getPhase()).to.equal(1 /*Voting*/);
            await votingRouter.connect(owner).endVotingPeriod();
            expect(await votingRouter.getPhase()).to.equal(2 /*Ended*/);
        });

        it("getCandidates: should return the list of candidates", async function () {
            const { votingRouter, candidates } = await loadFixture(deployVotingRouterFixture);
            const fetchedCandidates = await votingRouter.getCandidates();
            expect(fetchedCandidates.length).to.equal(candidates.length);
            for (let i = 0; i < candidates.length; i++) {
                expect(fetchedCandidates[i]).to.equal(candidates[i]);
            }
        });

        it("getCandidateCount: should return the correct number of candidates", async function () {
            const { votingRouter, candidateCount } = await loadFixture(deployVotingRouterFixture);
            expect(await votingRouter.getCandidateCount()).to.equal(candidateCount);
        });

        it("isRegistered: should return true for a registered voter, false otherwise", async function () {
            const { votingRouter, owner, user1, user2 } = await loadFixture(deployVotingRouterFixture);
            await votingRouter.connect(owner).registerVoterByAdmin(user1.address);
            expect(await votingRouter.isRegistered(user1.address)).to.be.true;
            expect(await votingRouter.isRegistered(user2.address)).to.be.false;
        });

        it("checkHasVoted: should return true for a voter who has voted, false otherwise", async function () {
            const { votingRouter, owner, user1, user2 } = await loadFixture(deployVotingRouterFixture);
            await votingRouter.connect(owner).registerVoterByAdmin(user1.address);
            await votingRouter.connect(owner).startVotingPeriod();
            await votingRouter.connect(user1).vote(0);
            expect(await votingRouter.checkHasVoted(user1.address)).to.be.true;
            expect(await votingRouter.checkHasVoted(user2.address)).to.be.false; // user2 hasn't voted (and isn't registered here)
        });

        describe("getResults", function () {
            it("should return results from tallyPlugin if in Ended phase", async function () {
                const { votingRouter, tallyBase, owner, user1 } = await loadFixture(deployVotingRouterFixture);
                await votingRouter.connect(owner).registerVoterByAdmin(user1.address);
                await votingRouter.connect(owner).startVotingPeriod();
                await votingRouter.connect(user1).vote(0);
                await votingRouter.connect(owner).endVotingPeriod();

                const resultsFromRouter = await votingRouter.getResults();
                const resultsFromTallyBase = await tallyBase.getResults(); // Assuming TallyBase getResults is public for verification
                expect(resultsFromRouter.length).to.equal(resultsFromTallyBase.length);
                for (let i = 0; i < resultsFromRouter.length; i++) {
                    expect(resultsFromRouter[i]).to.equal(resultsFromTallyBase[i]);
                }
                expect(resultsFromRouter[0]).to.equal(1);
            });

            it("should revert if not in Ended phase", async function () {
                const { votingRouter, owner } = await loadFixture(deployVotingRouterFixture);
                // Still in Register phase
                await expect(votingRouter.getResults())
                    .to.be.revertedWithCustomError(votingRouter, "VotingRouter__InvalidPhase")
                    .withArgs(0 /*Register*/, 2 /*Ended*/);

                await votingRouter.connect(owner).startVotingPeriod(); // Move to Voting phase
                await expect(votingRouter.getResults())
                    .to.be.revertedWithCustomError(votingRouter, "VotingRouter__InvalidPhase")
                    .withArgs(1 /*Voting*/, 2 /*Ended*/);
            });
        });

        it("getTallyPluginCandidateCount: should return candidate count from tallyPlugin", async function () {
            const { votingRouter, tallyBase, candidateCount } = await loadFixture(deployVotingRouterFixture);
            expect(await votingRouter.getTallyPluginCandidateCount()).to.equal(candidateCount);
            // Also check directly from tallyBase to ensure consistency
            expect(await tallyBase.getCandidateCount()).to.equal(candidateCount);
        });
    });
}); 