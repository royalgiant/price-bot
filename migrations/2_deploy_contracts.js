var TradeBot = artifacts.require("./TradeBot.sol");

const ether = (n) => new web3.utils.BN(web3.utils.toWei(n, 'ether'));

module.exports = function(deployer, network, accounts) {
  	deployer.deploy(TradeBot);
};