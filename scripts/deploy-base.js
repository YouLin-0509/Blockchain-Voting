const { ethers, run } = require("hardhat");

async function main() {
  const cand = ["Alice", "Bob", "Carol"];
  const VotingBase = await ethers.getContractFactory("VotingBase");
  const votingBase = await VotingBase.deploy(cand);
  await votingBase.waitForDeployment();

  console.log("VotingBase deployed to:", await votingBase.getAddress());
  // 可選 verify: await run("verify:verify", { address: await votingBase.getAddress(), constructorArguments:[cand]});
}
main().catch((e) => { console.error(e); process.exit(1); });
