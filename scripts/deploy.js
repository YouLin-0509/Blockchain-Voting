const { ethers } = require("hardhat");

async function main() {
  // 部署 ManagementContract
  const ManagementContract = await ethers.getContractFactory("ManagementContract");
  const management = await ManagementContract.deploy();
  await management.waitForDeployment();
  console.log("ManagementContract deployed to:", await management.getAddress());

  // 部署 CountingContract
  const CountingContract = await ethers.getContractFactory("CountingContract");
  const counting = await CountingContract.deploy();
  await counting.waitForDeployment();
  console.log("CountingContract deployed to:", await counting.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});