const { ethers, run } = require("hardhat");

async function main() {
  const cand = ["Alice", "Bob", "Carol"];
  const VotingBase = await ethers.getContractFactory("VotingBase");
  const votingBase = await VotingBase.deploy(cand);
  await votingBase.deployed();

  console.log("VotingBase deployed to:", votingBase.address);
  // 可選 verify: await run("verify:verify", { address: votingBase.address, constructorArguments:[cand]});
}
main().catch((e) => { console.error(e); process.exit(1); });
