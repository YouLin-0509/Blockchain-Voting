const hre = require("hardhat");

async function main() {
  try {
    await hre.run("compile");
    console.log("Compilation successful.");
  } catch (error) {
    console.error("Compilation failed:", error);
    process.exitCode = 1;
  }
}

main();
