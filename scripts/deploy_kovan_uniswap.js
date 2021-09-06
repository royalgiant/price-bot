async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const UniswapTradeBot = await ethers.getContractFactory("UniswapTradeBot", {
    libraries: {
      NetworkFeesAndConfigs: process.env.NETWORKFEECONFIGS_CONTRACT_ADDRESS
    }
  });
  const us_contract = await UniswapTradeBot.deploy('0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F');

  await hre.ethernal.push({
    name: "UniswapTradeBot",
    address: us_contract.address
  });

  console.log("Uniswap Token address:", us_contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });