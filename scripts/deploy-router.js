const hre = require("hardhat");

async function main() {
    const candidates = ["Candidate Alpha", "Candidate Beta", "Candidate Gamma"];
    console.log(`Deploying with candidates: ${candidates.join(', ')}`);

    // Deploy TallyBase
    const TallyBase = await hre.ethers.getContractFactory("TallyBase");
    const tallyBase = await TallyBase.deploy(candidates);
    await tallyBase.waitForDeployment(); // Wait for the deployment transaction to be mined
    const tallyBaseAddress = await tallyBase.getAddress();
    console.log(`TallyBase deployed to: ${tallyBaseAddress}`);

    // Deploy VotingRouter
    const VotingRouter = await hre.ethers.getContractFactory("VotingRouter");
    const votingRouter = await VotingRouter.deploy(
        candidates,
        tallyBaseAddress,
        hre.ethers.ZeroAddress // No verifier plugin for now
    );
    await votingRouter.waitForDeployment(); // Wait for the deployment transaction to be mined
    const votingRouterAddress = await votingRouter.getAddress();
    console.log(`VotingRouter deployed to: ${votingRouterAddress}`);

    console.log("\nDeployment complete.");
    console.log(`To interact with the VotingRouter, use address: ${votingRouterAddress}`);
    console.log(`TallyBase plugin is at: ${tallyBaseAddress}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}); 