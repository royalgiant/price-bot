async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const AaveV2FlashLoan = await ethers.getContractFactory("AaveV2FlashLoan");
  const aave_contract = await AaveV2FlashLoan.deploy('0x9aab3f75489902f3a48495025729a0af77d4b11e','0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F','0x88757f2f99175387ab4c6a4b3067c77a695b0349');

  console.log("Aave Contract Token address:", aave_contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });