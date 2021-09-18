async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const AaveV2FlashLoan = await ethers.getContractFactory("AaveV2FlashLoan", {
    libraries: {
      NetworkFeesAndConfigs: process.env.NETWORKFEECONFIGS_CONTRACT_ADDRESS
    }
  });
  const aave_contract = await AaveV2FlashLoan.deploy('0xc153eeAD19e0DBbDb3462Dcc2B703cC6D738A37c','0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', '0x88757f2f99175387ab4c6a4b3067c77a695b0349');

  await hre.ethernal.push({
    name: "AaveV2FlashLoan",
    address: aave_contract.address
  });

  console.log("Aave Contract Token address:", aave_contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });