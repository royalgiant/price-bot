require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const http = require('http')
const Web3 = require('web3')
const HDWalletProvider = require('@truffle/hdwallet-provider')
const moment = require('moment-timezone')
const numeral = require('numeral')
const _ = require('lodash')
const axios = require('axios')
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const csvWriter = createCsvWriter({
    path: 'price_data.csv',
    header: [
        {id: 'inputtoken', title: 'Input Token'},
        {id: 'outputtoken', title: 'Output Token'},
        {id: 'inputamount', title: 'Input Amount'},
        {id: 'uniswapreturn', title: 'Uniswap Return'},
        {id: 'kyberexpectedreturn', title: 'Kyber Expected Rate'},
        {id: 'kyberminreturn', title: 'Kyber Min Return'},
        {id: 'timestamp', title: 'Timestamp'},
    ]
});

// SERVER CONFIG
const PORT = process.env.PORT || 5000
const app = express();
const server = http.createServer(app).listen(PORT, () => console.log(`Listening on ${ PORT }`))

// WEB3 CONFIG
const web3 = new Web3(process.env.RPC_URL)

// Uniswap Factory Contract: https://etherscan.io/address/0xc0a47dfe034b400b47bdad5fecda2621de6c4d95#code
const UNISWAP_FACTORY_ABI = [{"name":"NewExchange","inputs":[{"type":"address","name":"token","indexed":true},{"type":"address","name":"exchange","indexed":true}],"anonymous":false,"type":"event"},{"name":"initializeFactory","outputs":[],"inputs":[{"type":"address","name":"template"}],"constant":false,"payable":false,"type":"function","gas":35725},{"name":"createExchange","outputs":[{"type":"address","name":"out"}],"inputs":[{"type":"address","name":"token"}],"constant":false,"payable":false,"type":"function","gas":187911},{"name":"getExchange","outputs":[{"type":"address","name":"out"}],"inputs":[{"type":"address","name":"token"}],"constant":true,"payable":false,"type":"function","gas":715},{"name":"getToken","outputs":[{"type":"address","name":"out"}],"inputs":[{"type":"address","name":"exchange"}],"constant":true,"payable":false,"type":"function","gas":745},{"name":"getTokenWithId","outputs":[{"type":"address","name":"out"}],"inputs":[{"type":"uint256","name":"token_id"}],"constant":true,"payable":false,"type":"function","gas":736},{"name":"exchangeTemplate","outputs":[{"type":"address","name":"out"}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":633},{"name":"tokenCount","outputs":[{"type":"uint256","name":"out"}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":663}]
const UNISWAP_FACTORY_ADDRESS = '0xc0a47dfe034b400b47bdad5fecda2621de6c4d95'
const uniswapFactoryContract = new web3.eth.Contract(UNISWAP_FACTORY_ABI, UNISWAP_FACTORY_ADDRESS)

// Uniswap Exchange Template: https://etherscan.io/address/0x09cabec1ead1c0ba254b09efb3ee13841712be14#code
const UNISWAP_EXCHANGE_ABI = [{"name": "TokenPurchase", "inputs": [{"type": "address", "name": "buyer", "indexed": true}, {"type": "uint256", "name": "eth_sold", "indexed": true}, {"type": "uint256", "name": "tokens_bought", "indexed": true}], "anonymous": false, "type": "event"}, {"name": "EthPurchase", "inputs": [{"type": "address", "name": "buyer", "indexed": true}, {"type": "uint256", "name": "tokens_sold", "indexed": true}, {"type": "uint256", "name": "eth_bought", "indexed": true}], "anonymous": false, "type": "event"}, {"name": "AddLiquidity", "inputs": [{"type": "address", "name": "provider", "indexed": true}, {"type": "uint256", "name": "eth_amount", "indexed": true}, {"type": "uint256", "name": "token_amount", "indexed": true}], "anonymous": false, "type": "event"}, {"name": "RemoveLiquidity", "inputs": [{"type": "address", "name": "provider", "indexed": true}, {"type": "uint256", "name": "eth_amount", "indexed": true}, {"type": "uint256", "name": "token_amount", "indexed": true}], "anonymous": false, "type": "event"}, {"name": "Transfer", "inputs": [{"type": "address", "name": "_from", "indexed": true}, {"type": "address", "name": "_to", "indexed": true}, {"type": "uint256", "name": "_value", "indexed": false}], "anonymous": false, "type": "event"}, {"name": "Approval", "inputs": [{"type": "address", "name": "_owner", "indexed": true}, {"type": "address", "name": "_spender", "indexed": true}, {"type": "uint256", "name": "_value", "indexed": false}], "anonymous": false, "type": "event"}, {"name": "setup", "outputs": [], "inputs": [{"type": "address", "name": "token_addr"}], "constant": false, "payable": false, "type": "function", "gas": 175875}, {"name": "addLiquidity", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [{"type": "uint256", "name": "min_liquidity"}, {"type": "uint256", "name": "max_tokens"}, {"type": "uint256", "name": "deadline"}], "constant": false, "payable": true, "type": "function", "gas": 82616}, {"name": "removeLiquidity", "outputs": [{"type": "uint256", "name": "out"}, {"type": "uint256", "name": "out"}], "inputs": [{"type": "uint256", "name": "amount"}, {"type": "uint256", "name": "min_eth"}, {"type": "uint256", "name": "min_tokens"}, {"type": "uint256", "name": "deadline"}], "constant": false, "payable": false, "type": "function", "gas": 116814}, {"name": "__default__", "outputs": [], "inputs": [], "constant": false, "payable": true, "type": "function"}, {"name": "ethToTokenSwapInput", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [{"type": "uint256", "name": "min_tokens"}, {"type": "uint256", "name": "deadline"}], "constant": false, "payable": true, "type": "function", "gas": 12757}, {"name": "ethToTokenTransferInput", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [{"type": "uint256", "name": "min_tokens"}, {"type": "uint256", "name": "deadline"}, {"type": "address", "name": "recipient"}], "constant": false, "payable": true, "type": "function", "gas": 12965}, {"name": "ethToTokenSwapOutput", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [{"type": "uint256", "name": "tokens_bought"}, {"type": "uint256", "name": "deadline"}], "constant": false, "payable": true, "type": "function", "gas": 50463}, {"name": "ethToTokenTransferOutput", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [{"type": "uint256", "name": "tokens_bought"}, {"type": "uint256", "name": "deadline"}, {"type": "address", "name": "recipient"}], "constant": false, "payable": true, "type": "function", "gas": 50671}, {"name": "tokenToEthSwapInput", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [{"type": "uint256", "name": "tokens_sold"}, {"type": "uint256", "name": "min_eth"}, {"type": "uint256", "name": "deadline"}], "constant": false, "payable": false, "type": "function", "gas": 47503}, {"name": "tokenToEthTransferInput", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [{"type": "uint256", "name": "tokens_sold"}, {"type": "uint256", "name": "min_eth"}, {"type": "uint256", "name": "deadline"}, {"type": "address", "name": "recipient"}], "constant": false, "payable": false, "type": "function", "gas": 47712}, {"name": "tokenToEthSwapOutput", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [{"type": "uint256", "name": "eth_bought"}, {"type": "uint256", "name": "max_tokens"}, {"type": "uint256", "name": "deadline"}], "constant": false, "payable": false, "type": "function", "gas": 50175}, {"name": "tokenToEthTransferOutput", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [{"type": "uint256", "name": "eth_bought"}, {"type": "uint256", "name": "max_tokens"}, {"type": "uint256", "name": "deadline"}, {"type": "address", "name": "recipient"}], "constant": false, "payable": false, "type": "function", "gas": 50384}, {"name": "tokenToTokenSwapInput", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [{"type": "uint256", "name": "tokens_sold"}, {"type": "uint256", "name": "min_tokens_bought"}, {"type": "uint256", "name": "min_eth_bought"}, {"type": "uint256", "name": "deadline"}, {"type": "address", "name": "token_addr"}], "constant": false, "payable": false, "type": "function", "gas": 51007}, {"name": "tokenToTokenTransferInput", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [{"type": "uint256", "name": "tokens_sold"}, {"type": "uint256", "name": "min_tokens_bought"}, {"type": "uint256", "name": "min_eth_bought"}, {"type": "uint256", "name": "deadline"}, {"type": "address", "name": "recipient"}, {"type": "address", "name": "token_addr"}], "constant": false, "payable": false, "type": "function", "gas": 51098}, {"name": "tokenToTokenSwapOutput", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [{"type": "uint256", "name": "tokens_bought"}, {"type": "uint256", "name": "max_tokens_sold"}, {"type": "uint256", "name": "max_eth_sold"}, {"type": "uint256", "name": "deadline"}, {"type": "address", "name": "token_addr"}], "constant": false, "payable": false, "type": "function", "gas": 54928}, {"name": "tokenToTokenTransferOutput", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [{"type": "uint256", "name": "tokens_bought"}, {"type": "uint256", "name": "max_tokens_sold"}, {"type": "uint256", "name": "max_eth_sold"}, {"type": "uint256", "name": "deadline"}, {"type": "address", "name": "recipient"}, {"type": "address", "name": "token_addr"}], "constant": false, "payable": false, "type": "function", "gas": 55019}, {"name": "tokenToExchangeSwapInput", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [{"type": "uint256", "name": "tokens_sold"}, {"type": "uint256", "name": "min_tokens_bought"}, {"type": "uint256", "name": "min_eth_bought"}, {"type": "uint256", "name": "deadline"}, {"type": "address", "name": "exchange_addr"}], "constant": false, "payable": false, "type": "function", "gas": 49342}, {"name": "tokenToExchangeTransferInput", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [{"type": "uint256", "name": "tokens_sold"}, {"type": "uint256", "name": "min_tokens_bought"}, {"type": "uint256", "name": "min_eth_bought"}, {"type": "uint256", "name": "deadline"}, {"type": "address", "name": "recipient"}, {"type": "address", "name": "exchange_addr"}], "constant": false, "payable": false, "type": "function", "gas": 49532}, {"name": "tokenToExchangeSwapOutput", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [{"type": "uint256", "name": "tokens_bought"}, {"type": "uint256", "name": "max_tokens_sold"}, {"type": "uint256", "name": "max_eth_sold"}, {"type": "uint256", "name": "deadline"}, {"type": "address", "name": "exchange_addr"}], "constant": false, "payable": false, "type": "function", "gas": 53233}, {"name": "tokenToExchangeTransferOutput", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [{"type": "uint256", "name": "tokens_bought"}, {"type": "uint256", "name": "max_tokens_sold"}, {"type": "uint256", "name": "max_eth_sold"}, {"type": "uint256", "name": "deadline"}, {"type": "address", "name": "recipient"}, {"type": "address", "name": "exchange_addr"}], "constant": false, "payable": false, "type": "function", "gas": 53423}, {"name": "getEthToTokenInputPrice", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [{"type": "uint256", "name": "eth_sold"}], "constant": true, "payable": false, "type": "function", "gas": 5542}, {"name": "getEthToTokenOutputPrice", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [{"type": "uint256", "name": "tokens_bought"}], "constant": true, "payable": false, "type": "function", "gas": 6872}, {"name": "getTokenToEthInputPrice", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [{"type": "uint256", "name": "tokens_sold"}], "constant": true, "payable": false, "type": "function", "gas": 5637}, {"name": "getTokenToEthOutputPrice", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [{"type": "uint256", "name": "eth_bought"}], "constant": true, "payable": false, "type": "function", "gas": 6897}, {"name": "tokenAddress", "outputs": [{"type": "address", "name": "out"}], "inputs": [], "constant": true, "payable": false, "type": "function", "gas": 1413}, {"name": "factoryAddress", "outputs": [{"type": "address", "name": "out"}], "inputs": [], "constant": true, "payable": false, "type": "function", "gas": 1443}, {"name": "balanceOf", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [{"type": "address", "name": "_owner"}], "constant": true, "payable": false, "type": "function", "gas": 1645}, {"name": "transfer", "outputs": [{"type": "bool", "name": "out"}], "inputs": [{"type": "address", "name": "_to"}, {"type": "uint256", "name": "_value"}], "constant": false, "payable": false, "type": "function", "gas": 75034}, {"name": "transferFrom", "outputs": [{"type": "bool", "name": "out"}], "inputs": [{"type": "address", "name": "_from"}, {"type": "address", "name": "_to"}, {"type": "uint256", "name": "_value"}], "constant": false, "payable": false, "type": "function", "gas": 110907}, {"name": "approve", "outputs": [{"type": "bool", "name": "out"}], "inputs": [{"type": "address", "name": "_spender"}, {"type": "uint256", "name": "_value"}], "constant": false, "payable": false, "type": "function", "gas": 38769}, {"name": "allowance", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [{"type": "address", "name": "_owner"}, {"type": "address", "name": "_spender"}], "constant": true, "payable": false, "type": "function", "gas": 1925}, {"name": "name", "outputs": [{"type": "bytes32", "name": "out"}], "inputs": [], "constant": true, "payable": false, "type": "function", "gas": 1623}, {"name": "symbol", "outputs": [{"type": "bytes32", "name": "out"}], "inputs": [], "constant": true, "payable": false, "type": "function", "gas": 1653}, {"name": "decimals", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [], "constant": true, "payable": false, "type": "function", "gas": 1683}, {"name": "totalSupply", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [], "constant": true, "payable": false, "type": "function", "gas": 1713}]

// Kyber mainnet "Expected Rate": https://etherscan.io/address/0x9AAb3f75489902f3a48495025729a0AF77d4b11e#readContract
const KYBER_RATE_ABI = [{"inputs":[{"internalType":"address","name":"_admin","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"newAdmin","type":"address"},{"indexed":false,"internalType":"address","name":"previousAdmin","type":"address"}],"name":"AdminClaimed","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"newAlerter","type":"address"},{"indexed":false,"internalType":"bool","name":"isAdd","type":"bool"}],"name":"AlerterAdded","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"address","name":"sendTo","type":"address"}],"name":"EtherWithdraw","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"trader","type":"address"},{"indexed":false,"internalType":"contract IERC20","name":"src","type":"address"},{"indexed":false,"internalType":"contract IERC20","name":"dest","type":"address"},{"indexed":false,"internalType":"address","name":"destAddress","type":"address"},{"indexed":false,"internalType":"uint256","name":"actualSrcAmount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"actualDestAmount","type":"uint256"},{"indexed":false,"internalType":"address","name":"platformWallet","type":"address"},{"indexed":false,"internalType":"uint256","name":"platformFeeBps","type":"uint256"}],"name":"ExecuteTrade","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"contract IKyberHint","name":"kyberHintHandler","type":"address"}],"name":"KyberHintHandlerSet","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"contract IKyberNetwork","name":"newKyberNetwork","type":"address"},{"indexed":false,"internalType":"contract IKyberNetwork","name":"previousKyberNetwork","type":"address"}],"name":"KyberNetworkSet","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"newOperator","type":"address"},{"indexed":false,"internalType":"bool","name":"isAdd","type":"bool"}],"name":"OperatorAdded","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"contract IERC20","name":"token","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"address","name":"sendTo","type":"address"}],"name":"TokenWithdraw","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"pendingAdmin","type":"address"}],"name":"TransferAdminPending","type":"event"},{"inputs":[{"internalType":"address","name":"newAlerter","type":"address"}],"name":"addAlerter","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOperator","type":"address"}],"name":"addOperator","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"admin","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"claimAdmin","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"enabled","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getAlerters","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"contract ERC20","name":"src","type":"address"},{"internalType":"contract ERC20","name":"dest","type":"address"},{"internalType":"uint256","name":"srcQty","type":"uint256"}],"name":"getExpectedRate","outputs":[{"internalType":"uint256","name":"expectedRate","type":"uint256"},{"internalType":"uint256","name":"worstRate","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"contract IERC20","name":"src","type":"address"},{"internalType":"contract IERC20","name":"dest","type":"address"},{"internalType":"uint256","name":"srcQty","type":"uint256"},{"internalType":"uint256","name":"platformFeeBps","type":"uint256"},{"internalType":"bytes","name":"hint","type":"bytes"}],"name":"getExpectedRateAfterFee","outputs":[{"internalType":"uint256","name":"expectedRate","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getOperators","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"kyberHintHandler","outputs":[{"internalType":"contract IKyberHint","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"kyberNetwork","outputs":[{"internalType":"contract IKyberNetwork","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"maxGasPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"pendingAdmin","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"alerter","type":"address"}],"name":"removeAlerter","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"operator","type":"address"}],"name":"removeOperator","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"contract IKyberHint","name":"_kyberHintHandler","type":"address"}],"name":"setHintHandler","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"contract IKyberNetwork","name":"_kyberNetwork","type":"address"}],"name":"setKyberNetwork","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"contract IERC20","name":"token","type":"address"},{"internalType":"uint256","name":"minConversionRate","type":"uint256"}],"name":"swapEtherToToken","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"contract IERC20","name":"token","type":"address"},{"internalType":"uint256","name":"srcAmount","type":"uint256"},{"internalType":"uint256","name":"minConversionRate","type":"uint256"}],"name":"swapTokenToEther","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"contract IERC20","name":"src","type":"address"},{"internalType":"uint256","name":"srcAmount","type":"uint256"},{"internalType":"contract IERC20","name":"dest","type":"address"},{"internalType":"uint256","name":"minConversionRate","type":"uint256"}],"name":"swapTokenToToken","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"contract IERC20","name":"src","type":"address"},{"internalType":"uint256","name":"srcAmount","type":"uint256"},{"internalType":"contract IERC20","name":"dest","type":"address"},{"internalType":"address payable","name":"destAddress","type":"address"},{"internalType":"uint256","name":"maxDestAmount","type":"uint256"},{"internalType":"uint256","name":"minConversionRate","type":"uint256"},{"internalType":"address payable","name":"platformWallet","type":"address"}],"name":"trade","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"contract ERC20","name":"src","type":"address"},{"internalType":"uint256","name":"srcAmount","type":"uint256"},{"internalType":"contract ERC20","name":"dest","type":"address"},{"internalType":"address payable","name":"destAddress","type":"address"},{"internalType":"uint256","name":"maxDestAmount","type":"uint256"},{"internalType":"uint256","name":"minConversionRate","type":"uint256"},{"internalType":"address payable","name":"walletId","type":"address"},{"internalType":"bytes","name":"hint","type":"bytes"}],"name":"tradeWithHint","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"contract IERC20","name":"src","type":"address"},{"internalType":"uint256","name":"srcAmount","type":"uint256"},{"internalType":"contract IERC20","name":"dest","type":"address"},{"internalType":"address payable","name":"destAddress","type":"address"},{"internalType":"uint256","name":"maxDestAmount","type":"uint256"},{"internalType":"uint256","name":"minConversionRate","type":"uint256"},{"internalType":"address payable","name":"platformWallet","type":"address"},{"internalType":"uint256","name":"platformFeeBps","type":"uint256"},{"internalType":"bytes","name":"hint","type":"bytes"}],"name":"tradeWithHintAndFee","outputs":[{"internalType":"uint256","name":"destAmount","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"newAdmin","type":"address"}],"name":"transferAdmin","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newAdmin","type":"address"}],"name":"transferAdminQuickly","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"address payable","name":"sendTo","type":"address"}],"name":"withdrawEther","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"contract IERC20","name":"token","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"address","name":"sendTo","type":"address"}],"name":"withdrawToken","outputs":[],"stateMutability":"nonpayable","type":"function"}]
const KYBER_RATE_ADDRESS = '0x9AAb3f75489902f3a48495025729a0AF77d4b11e'
const kyberRateContract = new web3.eth.Contract(KYBER_RATE_ABI, KYBER_RATE_ADDRESS)

async function checkPair(args) {
  const { inputTokenSymbol, inputTokenAddress, outputTokenSymbol, outputTokenAddress, inputAmount } = args

  const exchangeAddress = await uniswapFactoryContract.methods.getExchange(outputTokenAddress).call()
  const exchangeContract = new web3.eth.Contract(UNISWAP_EXCHANGE_ABI, exchangeAddress)

  const uniswapResult = await exchangeContract.methods.getEthToTokenInputPrice(inputAmount).call()
  let kyberResult = await kyberRateContract.methods.getExpectedRate(inputTokenAddress, outputTokenAddress, inputAmount).call()
  var input_amount = web3.utils.fromWei(inputAmount, 'Ether')
  var uniswap_return = web3.utils.fromWei(uniswapResult, 'Ether')
  var ker = web3.utils.fromWei(kyberResult.expectedRate, 'Ether')
  var kmr = web3.utils.fromWei(kyberResult.worstRate, 'Ether')
  var now = moment().tz('America/Chicago').format()
  console.table([{
    'Input Token': inputTokenSymbol,
    'Output Token': outputTokenSymbol,
    'Input Amount': input_amount,
    'Uniswap Return': uniswap_return,
    'Kyber Expected Rate': ker,
    'Kyber Min Return': kmr,
    'Timestamp': now,
  }])
  var new_record = [{
	inputtoken: inputTokenSymbol, 
	outputtoken: outputTokenSymbol, 
	inputamount: input_amount,
	uniswapreturn: uniswap_return, 
	kyberexpectedreturn: ker,
	kyberminreturn: kmr,
	timestamp: now
  }]
  return new_record;
}

let priceMonitor
let monitoringPrice = false

async function monitorPrice() {
  if(monitoringPrice) {
    return
  }

  console.log("Checking prices...")
  monitoringPrice = true

  try {

    // ADD YOUR CUSTOM TOKEN PAIRS HERE!!!

    await checkPair({
      inputTokenSymbol: 'ETH',
      inputTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      outputTokenSymbol: 'MKR',
      outputTokenAddress: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
      inputAmount: web3.utils.toWei('1', 'ETHER')
    }).then(function(response) {
    	csvWriter.writeRecords(response).then(() => { console.log('Written to excel file.');});
    })

    await checkPair({
      inputTokenSymbol: 'ETH',
      inputTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      outputTokenSymbol: 'DAI',
      outputTokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
      inputAmount: web3.utils.toWei('1', 'ETHER')
    }).then(function(response) {
    	csvWriter.writeRecords(response).then(() => { console.log('Written to excel file.');});
    })

    await checkPair({
      inputTokenSymbol: 'ETH',
      inputTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      outputTokenSymbol: 'KNC',
      outputTokenAddress: '0xdd974d5c2e2928dea5f71b9825b8b646686bd200',
      inputAmount: web3.utils.toWei('1', 'ETHER')
    }).then(function(response) {
    	csvWriter.writeRecords(response).then(() => { console.log('Written to excel file.');});
    })

    await checkPair({
      inputTokenSymbol: 'ETH',
      inputTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      outputTokenSymbol: 'LINK',
      outputTokenAddress: '0x514910771af9ca656af840dff83e8264ecf986ca',
      inputAmount: web3.utils.toWei('1', 'ETHER')
    }).then(function(response) {
    	csvWriter.writeRecords(response).then(() => { console.log('Written to excel file.');});
    })

  } catch (error) {
    console.error(error)
    monitoringPrice = false
    clearInterval(priceMonitor)
    return
  }

  monitoringPrice = false
}

// Check markets every n seconds
const POLLING_INTERVAL = process.env.POLLING_INTERVAL || 3000 // 3 Seconds
priceMonitor = setInterval(async () => { await monitorPrice() }, POLLING_INTERVAL)
