async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const AaveV2FlashLoan = await ethers.getContractFactory("AaveV2FlashLoan", {
    libraries: {
      NetworkFeesAndConfigs: process.env.NETWORKFEECONFIGS_CONTRACT_ADDRESS
    }
  });
  const aave_contract = await AaveV2FlashLoan.deploy(process.env.KYBER_NETWORK_PROXY_MAIN,process.env.SUSHIV2_ROUTER_ADDRESS, process.env.UNISWAPV2_ROUTER_ADDRESS, process.env.AAVE_LENDING_POOL_ADDRESSES_PROVIDER);

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