var UniswapTradeBot = artifacts.require("./UniswapTradeBot.sol");
var AaveV2FlashLoan = artifacts.require("./AaveV2FlashLoan.sol");

const ether = (n) => new web3.utils.BN(web3.utils.toWei(n, 'ether'));

module.exports = function(deployer, network, accounts) {
  	deployer.deploy(UniswapTradeBot);
  	deployer.deploy(AaveV2FlashLoan);
};