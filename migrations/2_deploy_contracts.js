var UniswapTradeBot = artifacts.require("./UniswapTradeBot.sol");
var AaveV2FlashLoan = artifacts.require("./AaveV2FlashLoan.sol");

const ether = (n) => new web3.utils.BN(web3.utils.toWei(n, 'ether'));

module.exports = function(deployer, network, accounts) {
	// Mainnet, Same on Ropsten
  	deployer.deploy(
  		UniswapTradeBot, 
  		'0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', //Uniswap factory; Uniswap Router V2 Address: 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
    	'0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', //Sushiswap router
    );
  	deployer.deploy(
  		AaveV2FlashLoan,
  		'0x9aab3f75489902f3a48495025729a0af77d4b11e', //Kyber Network Proxy; Proxy1 Address: 0x818E6FECD516Ecc3849DAf6845e3EC868087B755
  		'0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', //Sushiswap router
  	);
};