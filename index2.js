const AaveV2FlashLoan = require('./artifacts/contracts/AaveV2FlashLoan.sol/AaveV2FlashLoan.json');
const UniswapTradeBot = require('./artifacts/contracts/UniswapTradeBot.sol/UniswapTradeBot.json');

require('dotenv').config()

//http dependencies
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
        {id: 'inputTokenAddress', title: 'Input Token Address'},
        {id: 'outputTokenAddress', title: 'Output Token Address'},
        {id: 'inputamount', title: 'Input Amount'},
        {id: 'uniswapreturn', title: 'Uni Return'},
        {id: 'sushiswapreturn, title: Sushi Return'},
        {id: 'kyberexpectedreturn', title: 'Kyber Expected Rate'},
        {id: 'kyberminreturn', title: 'Kyber Min Return'},
        {id: 'timestamp', title: 'Timestamp'},
    ]
});

// ethereum dependencies
const { legos } = require('@studydefi/money-legos');

// SERVER CONFIG
const PORT = process.env.PORT || 5000
const app = express();
const server = http.createServer(app).listen(PORT, () => console.log(`Listening on ${ PORT }`))

// Web3 CONFIG
const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
const web3 = createAlchemyWeb3(process.env.ALCHEMY_RPC_URL);

// Exchanges
UNISWAP = "uniswap"
SUSHISWAP = "sushi"
KYBER = "kyber"

// Fees
UNISWAP_FEE = SUSHISWAP_FEE = 0.30
KYBER_FEE = 0.25

// Contracts
const uniswapV2 = new web3.eth.Contract(legos.uniswapV2.router02.abi, process.env.UNISWAPV2_ROUTER_ADDRESS)
const sushiswapV2 = new web3.eth.Contract(legos.uniswapV2.router02.abi, process.env.SUSHIV2_ROUTER_ADDRESS)
const kyber = new web3.eth.Contract(legos.kyber.network.abi, legos.kyber.network.address)

const delay = ms => new Promise(resolve => setTimeout(resolve, ms)) // Sleeper after doing an arbitrage for X seconds (i.e. 30 for block time of ETH)

function calcDstQty(srcQty, srcDecimals, dstDecimals, rate) {
  const PRECISION = (10 ** 18);
  if (dstDecimals >= srcDecimals) {
    return (srcQty * rate * (10**(dstDecimals - srcDecimals))) / PRECISION;
  } else {
    return (srcQty * rate) / (PRECISION * (10**(srcDecimals - dstDecimals)));
  }
}

async function checkPair(args) {
  const { inputTokenSymbol, inputTokenAddress, outputTokenSymbol, outputTokenAddress, inputAmount, inputTokenDecimals, outputTokenDecimals } = args
  
  // calculate uniswap amount
  const path = [inputTokenAddress, outputTokenAddress];
  const amounts = await uniswapV2.methods.getAmountsOut(inputAmount, path).call({}, process.env.BLOCK_NUMBER); // GET RID OF PARAMS IN CALL FOR MAINNET
  const uniswapAmount = amounts[1];

  // calculate sushiswap amount
  const sushi_amounts = await sushiswapV2.methods.getAmountsOut(inputAmount, path).call({}, process.env.BLOCK_NUMBER); // GET RID OF PARAMS IN CALL FOR MAINNET
  const sushiAmount = sushi_amounts[1];
  
  // calculate kyber amount
  const { expectedRate, slippageRate } = await kyber.methods.getExpectedRate(inputTokenAddress, outputTokenAddress, inputAmount).call({}, process.env.BLOCK_NUMBER); // GET RID OF PARAMS IN CALL FOR MAINNET
  const kyberExpectedAmount = calcDstQty(inputAmount, inputTokenDecimals, outputTokenDecimals, expectedRate) // Use Tokens that have 18 token decimals
  const kyberSlippageAmount = calcDstQty(inputAmount, inputTokenDecimals, outputTokenDecimals, slippageRate) // Use Tokens that have 18 token decimals
  var input_amount = web3.utils.fromWei(inputAmount, 'Ether')
  var uniswap_return = web3.utils.fromWei(uniswapAmount, 'Ether')
  var sushiswap_return = web3.utils.fromWei(sushiAmount, 'Ether')
  var ker = web3.utils.fromWei(String(kyberExpectedAmount), 'Ether')
  var kmr = web3.utils.fromWei(String(kyberSlippageAmount), 'Ether')
  var now = moment().tz('America/Chicago').format()

  console.table([{
    'Input Token': inputTokenSymbol,
    'Output Token': outputTokenSymbol,
    'Input Token Address': inputTokenAddress,
    'Output Token Address': outputTokenAddress,
    'Input Amount': input_amount,
    'Uni Return': uniswap_return,
    'Sushi Return': sushiswap_return,
    'Kyber Expected Rate': ker,
    'Kyber Min Return': kmr,
    'Timestamp': now,
  }])
  var new_record = [{
  inputtoken: inputTokenSymbol, 
  outputtoken: outputTokenSymbol, 
  inputTokenAddress: inputTokenAddress,
  outputTokenAddress: outputTokenAddress,
  inputamount: input_amount,
  uniswapreturn: uniswap_return,
  sushiswapreturn: sushiswap_return,
  kyberexpectedreturn: ker,
  kyberminreturn: kmr,
  timestamp: now
  }]
  return new_record;
}

let priceMonitor
let monitoringPrice = false

async function callFlashLoan(exchangeOne, exchangeTwo, response, amount1) {
  token0 = response[0]["inputTokenAddress"]
  token1 = response[0]["outputTokenAddress"]
  amount0 = web3.utils.toWei(response[0]["inputamount"], 'Ether')

  const account = process.env.BOTACCOUNT_ADDRESS
  var aavev2FlashLoan = new web3.eth.Contract(AaveV2FlashLoan.abi, process.env.AAVE_CONTRACT_MAINFORK_ADDRESS)
  // var uniswapTradeBot = new web3.eth.Contract(UniswapTradeBot.abi, process.env.UNISWAP_CONTRACT_ADDRESS)
  var nonce = await web3.eth.getTransactionCount(process.env.BOTACCOUNT_ADDRESS, 'latest'); // get latest nonce
  var gasEstimate = await aavev2FlashLoan.methods.myFlashLoanCall(token0, token1, amount0, amount1, exchangeOne, exchangeTwo).estimateGas(); // estimate gas
  // const gasEstimate = await uniswapTradeBot.methods.startArbitrage(token0, token1, amount0, amount1).call({from: account}).call({from: account}).estimateGas(); // estimate gas TODO: MAKE SURE EXCHANGES FOR SWAPPING ARE RIGHT
  var gasPrice = await web3.eth.getGasPrice();

  // Create the transaction
  const tx = {
    'from': account,
    'to':  process.env.AAVE_CONTRACT_MAINFORK_ADDRESS,
    'nonce': nonce,
    'gas': gasEstimate, 
    'maxFeePerGas': 194000000000,
    'data': aavev2FlashLoan.methods.myFlashLoanCall(token0, token1, amount0, amount1, exchangeOne, exchangeTwo).encodeABI()
  };

  // Sign the transaction
  const signPromise = web3.eth.accounts.signTransaction(tx, process.env.BOTACCOUNT_PRIVATE_KEY);
  signPromise.then((signedTx) => {
    web3.eth.sendSignedTransaction(signedTx.rawTransaction, function(err, hash) {
      if (!err) {
        console.log("The hash of your transaction is: ", hash, "\n Check Alchemy's Mempool to view the status of your transaction!");
      } else {
        console.log("Something went wrong when submitting your transaction:", err)
      }
    });
  }).catch((err) => {
    console.log("Promise failed:", err);
  });
  await delay(30000)
}

// Swapping tokenB from exchangeA (lower price) to B (higher price) incurs fees. 
// Simply, add those fees to tokenB's exchangePriceA and make sure exchangePriceB is still higher. Then we profit.
function priceAndFees(exchangePriceA, exchangePriceB, exchangeA, exchangeB) {
  var fee = 0.09; // Aave's Flash loan fee is always there.
  if(exchangeA == KYBER) {
    fee = fee + KYBER_FEE
  } else if(exchangeA == UNISWAP || exchangeA == SUSHISWAP) {
    fee = fee + UNISWAP_FEE // Uniswap and Sushiswap has the same fees.
  }

  if(exchangeB == KYBER) {
    fee = fee + KYBER_FEE
  } else if(exchangeB == UNISWAP || exchangeA == SUSHISWAP) {
    fee = fee + UNISWAP_FEE // Uniswap and Sushiswap has the same fees.
  }
  fee_cost = exchangePriceA * fee
  return exchangePriceA + fee_cost
}

function comparePrices(exchangePriceA, exchangePriceB, response, exchangeA, exchangeB) {
  // ExchangePriceB is greater than ExchangePriceA; buy from ExchangePriceA and sell on ExchangePriceB
  if (exchangePriceA < exchangePriceB) { 
    amount1 = web3.utils.toWei(exchangePriceB, 'Ether') // Take the higher amount of the compared exchanges
    exchangePriceAWithFees = priceAndFees(exchangePriceA, exchangePriceB, exchangeA, exchangeB)
    if (exchangePriceAWithFees < exchangePriceB) {
      callFlashLoan(exchangeB, exchangeA, response, amount1)
      console.log("exchangePriceAWithFees: "+exchangePriceAWithFees+" < exchangePriceB: "+exchangePriceB+". Buying from "+exchangeB+" and Selling on "+exchangeA)
    }
  } else if(exchangePriceA > exchangePriceB) { // ExchangePriceA price is greater than ExchangePriceB; buy from ExchangePriceB and sell on ExchangePriceA
    amount1 = web3.utils.toWei(exchangePriceA, 'Ether')  // Take the higher amount of the compared exchanges
    exchangePriceBWithFees = priceAndFees(exchangePriceB, exchangePriceA, exchangeB, exchangeA)
    if (exchangePriceA > exchangePriceBWithFees) {
      callFlashLoan(exchangeA, exchangeB, response, amount1)
      console.log("exchangePriceA: "+exchangePriceA+" > exchangePriceBWithFees: "+exchangePriceBWithFees+". Buying from "+exchangeA+" and Selling on "+exchangeB)
    }
  }
  // csvWriter.writeRecords(response).then(() => { console.log('Written to excel file.');});
}

async function monitorPrice() {
  if(monitoringPrice) {
    return
  }

  console.log("Checking prices...")
  monitoringPrice = true

  try {

    // ADD YOUR CUSTOM TOKEN PAIRS HERE!!!
    
    const WETH_ADDRESS = legos.erc20.weth.address; // Uniswap V2 uses wrapped eth
    
    // Kovan Level Pairs for Testing, Make Sure Tokens Exists in the Contract
    // var response = [{inputTokenAddress: process.env.WETH_KOVAN, outputTokenAddress: process.env.DAI_KOVAN, inputamount: "0.01"}]
    // await callFlashLoan(SUSHISWAP, KYBER, response, 0)

    // Production Level Pairs, Make Sure Tokens Exists in the Contract

    // await checkPair({
    //   inputTokenSymbol: 'WETH',
    //   inputTokenAddress: WETH_ADDRESS,
    //   outputTokenSymbol: 'DAI',
    //   outputTokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
    //   inputAmount: web3.utils.toWei('0.01', 'ETHER'),
    //   inputTokenDecimals: 18,
    //   outputTokenDecimals: 18
    // }).then(function(response) {
    //   comparePrices(response[0]["uniswapreturn"], response[0]["kyberexpectedreturn"], response, SUSHISWAP, KYBER)
    // })

    await checkPair({
      inputTokenSymbol: 'WETH',
      inputTokenAddress: WETH_ADDRESS,
      outputTokenSymbol: 'LINK',
      outputTokenAddress: '0x514910771af9ca656af840dff83e8264ecf986ca',
      inputAmount: web3.utils.toWei('0.01', 'ETHER'),
      inputTokenDecimals: 18,
      outputTokenDecimals: 18
    }).then(function(response) {
      comparePrices(response[0]["uniswapreturn"], response[0]["kyberexpectedreturn"], response, SUSHISWAP, KYBER)
    })

    // await checkPair({
    //   inputTokenSymbol: 'WETH',
    //   inputTokenAddress: WETH_ADDRESS,
    //   outputTokenSymbol: 'DAI',
    //   outputTokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
    //   inputAmount: web3.utils.toWei('0.01', 'ETHER'),
    //   inputTokenDecimals: 18,
    //   outputTokenDecimals: 18
    // }).then(function(response) {
    //   comparePrices(response[0]["uniswapreturn"], response[0]["sushiswapreturn"], response, UNISWAP, SUSHISWAP)
    // })

    // await checkPair({
    //   inputTokenSymbol: 'WETH',
    //   inputTokenAddress: WETH_ADDRESS,
    //   outputTokenSymbol: 'LINK',
    //   outputTokenAddress: '0x514910771af9ca656af840dff83e8264ecf986ca',
    //   inputAmount: web3.utils.toWei('0.01', 'ETHER'),
    //   inputTokenDecimals: 18,
    //   outputTokenDecimals: 18
    // }).then(function(response) {
    //   comparePrices(response[0]["uniswapreturn"], response[0]["sushiswapreturn"], response, UNISWAP, SUSHISWAP)
    // })

  } catch (error) { // If there's an error, we break out of the loop with clearInterval
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