async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const NetworkFeesAndConfigs = await ethers.getContractFactory("NetworkFeesAndConfigs");
  const network_fees_configs_contract = await NetworkFeesAndConfigs.deploy();

  console.log("NetworkFeesAndConfigs Library Token address:", network_fees_configs_contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });