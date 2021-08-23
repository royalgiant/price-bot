var UniswapTradeBot = artifacts.require("./UniswapTradeBot.sol");
var AaveV2FlashLoan = artifacts.require("./AaveV2FlashLoan.sol");

const ether = (n) => new web3.utils.BN(web3.utils.toWei(n, 'ether'));

module.exports = function(deployer, network, accounts) {

	// Mainnet, Same on Ropsten, and other test networks
  	deployer.deploy(
  		UniswapTradeBot, 
  		'0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', //Uniswap factory; Uniswap Router V2 Address: 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
    	'0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', // Sushiswap router
    );

    try {

        let lendingPoolAddressesProviderAddress;
        switch(network) {
            case "mainnet":
            	lendingPoolAddressesProviderAddress = "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5"; break
            case "mainnet-fork":
            	lendingPoolAddressesProviderAddress = "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5"; break
            case "development": // For Ganache mainnet forks
                lendingPoolAddressesProviderAddress = "0x24a42fD28C976A61Df5D00D0599C34c4f90748c8"; break
            case "ropsten":
            	lendingPoolAddressesProviderAddress = "0x1c8756FD2B28e9426CDBDcC7E3c4d64fa9A54728"; break
            case "ropsten-fork":
                lendingPoolAddressesProviderAddress = "0x1c8756FD2B28e9426CDBDcC7E3c4d64fa9A54728"; break
            case "kovan":
                lendingPoolAddressesProviderAddress = "0x88757f2f99175387ab4c6a4b3067c77a695b0349"; break
            case "kovan-fork":
                lendingPoolAddressesProviderAddress = "0x88757f2f99175387ab4c6a4b3067c77a695b0349"; break
            default:
                lendingPoolAddressesProviderAddress = "0x24a42fD28C976A61Df5D00D0599C34c4f90748c8"; break
        }

        deployer.deploy(
	  		AaveV2FlashLoan,
	  		'0x9aab3f75489902f3a48495025729a0af77d4b11e', //Kyber Network Proxy; Proxy1 Address: 0x818E6FECD516Ecc3849DAf6845e3EC868087B755
	  		'0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', //Sushiswap router
	  		lendingPoolAddressesProviderAddress, // Aave Lending Pool Addresses MAINNET, for other addresses: https://docs.aave.com/developers/deployed-contracts/deployed-contracts
	  		{ from: accounts[0], overwrite: true }
	  	);
    } catch (e) {
        console.log(`Error in migration: ${e.message}`)
    }
  	// Uncomment for Test Network Kovan
  	// deployer.deploy(
  	// 	AaveV2FlashLoan,
  	// 	'0x9aab3f75489902f3a48495025729a0af77d4b11e', //Kyber Network Proxy; Proxy1 Address: 0x818E6FECD516Ecc3849DAf6845e3EC868087B755
  	// 	'0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', //Sushiswap router
  	// 	'0x88757f2f99175387ab4c6a4b3067c77a695b0349', // Aave Lending Pool Addresses KOVAN, for other addresses: https://docs.aave.com/developers/deployed-contracts/deployed-contracts
  	// );
};