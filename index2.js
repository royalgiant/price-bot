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
        {id: 'uniswapreturn', title: 'Uniswap Return'},
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
const web3 = createAlchemyWeb3(process.env.RPC_URL)

// Exchanges
UNISWAP = "uniswap"
SUSHISWAP = "sushi"
KYBER = "kyber"

// Contracts
const uniswapV2 = new web3.eth.Contract(legos.uniswapV2.router02.abi, process.env.SUSHIV2_ROUTER_ADDRESS)
const kyber = new web3.eth.Contract(legos.kyber.network.abi, legos.kyber.network.address)

async function checkPair(args) {
  const { inputTokenSymbol, inputTokenAddress, outputTokenSymbol, outputTokenAddress, inputAmount } = args
  
  // calculate uniswap amount
  const path = [inputTokenAddress, outputTokenAddress];
  const amounts = await uniswapV2.methods.getAmountsOut(inputAmount, path).call();
  const uniswapAmount = amounts[1];
  
  // calculate kyber amount
  const { expectedRate, slippageRate } = await kyber.methods.getExpectedRate(inputTokenAddress, outputTokenAddress, inputAmount).call();
  const kyberExpectedAmount = expectedRate;
  const kyberSlippageAmount = slippageRate;
  var input_amount = web3.utils.fromWei(inputAmount, 'Ether')
  var uniswap_return = web3.utils.fromWei(uniswapAmount, 'Ether')
  var ker = web3.utils.fromWei(kyberExpectedAmount, 'Ether')
  var kmr = web3.utils.fromWei(kyberSlippageAmount, 'Ether')
  var now = moment().tz('America/Chicago').format()

  console.table([{
    'Input Token': inputTokenSymbol,
    'Output Token': outputTokenSymbol,
    'Input Token Address': inputTokenAddress,
    'Output Token Address': outputTokenAddress,
    'Input Amount': input_amount,
    'Uniswap Return': uniswap_return,
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

  const account = process.env.KOVAN_TEST_ACCOUNT_ADDRESS
  var aavev2FlashLoan = new web3.eth.Contract(AaveV2FlashLoan.abi, process.env.AAVE_CONTRACT_KOVAN_ADDRESS)
  // var uniswapTradeBot = new web3.eth.Contract(UniswapTradeBot.abi, process.env.UNISWAP_CONTRACT_ADDRESS)
  var nonce = await web3.eth.getTransactionCount(process.env.KOVAN_TEST_ACCOUNT_ADDRESS, 'latest'); // get latest nonce
  var gasEstimate = await aavev2FlashLoan.methods.myFlashLoanCall(token0, token1, amount0, amount1, exchangeOne, exchangeTwo).estimateGas(); // estimate gas
  // const gasEstimate = await uniswapTradeBot.methods.startArbitrage(token0, token1, amount0, amount1).call({from: account}).call({from: account}).estimateGas(); // estimate gas TODO: MAKE SURE EXCHANGES FOR SWAPPING ARE RIGHT
  var gasPrice = await web3.eth.getGasPrice();

  // Create the transaction
  const tx = {
    'from': account,
    'to':  process.env.AAVE_CONTRACT_KOVAN_ADDRESS,
    'nonce': nonce,
    'gas': gasEstimate, 
    'maxFeePerGas': 1000000108,
    'data': aavev2FlashLoan.methods.myFlashLoanCall(token0, token1, amount0, amount1, exchangeOne, exchangeTwo).send({from: accounts})
  };

  // Sign the transaction
    const signPromise = web3.eth.accounts.signTransaction(tx, process.env.KOVAN_TEST_ACCOUNT_PRIVATE_KEY);
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

}

function comparePrices(exchangePriceA, exchangePriceB, response, exchangeA, exchangeB) {
  // ExchangePriceB is greater than ExchangePriceA; buy from ExchangePriceA and sell on ExchangePriceB
  if (exchangePriceA < exchangePriceB) { 
    amount1 = web3.utils.toWei(response[0]["kyberexpectedreturn"], 'Ether') // Take the higher amount of the compared exchanges
    callFlashLoan(exchangeB, exchangeA, response, amount1)
    console.log("exchangePriceA < exchangePriceB. Buying from B and Selling on A")
  } else if(exchangePriceA > exchangePriceB) { // ExchangePriceA price is greater than ExchangePriceB; buy from ExchangePriceB and sell on ExchangePriceA
    amount1 = web3.utils.toWei(response[0]["uniswapreturn"], 'Ether')  // Take the higher amount of the compared exchanges
    callFlashLoan(exchangeA, exchangeB, response, amount1)
    console.log("exchangePriceA > exchangePriceB. Buying from A and Selling on B")
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
    await checkPair({
      inputTokenSymbol: 'WETH',
      inputTokenAddress: WETH_ADDRESS,
      outputTokenSymbol: 'BAT',
      outputTokenAddress: legos.erc20.bat.address,
      inputAmount: web3.utils.toWei('0.0001', 'ETHER')
    }).then(function(response) {
      comparePrices(response[0]["uniswapreturn"], response[0]["kyberexpectedreturn"], response, SUSHISWAP, KYBER)
    })

    await checkPair({
      inputTokenSymbol: 'WETH',
      inputTokenAddress: WETH_ADDRESS,
      outputTokenSymbol: 'DAI',
      outputTokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
      inputAmount: web3.utils.toWei('0.0001', 'ETHER')
    }).then(function(response) {
      comparePrices(response[0]["uniswapreturn"], response[0]["kyberexpectedreturn"], response, SUSHISWAP, KYBER)
    })

    await checkPair({
      inputTokenSymbol: 'WETH',
      inputTokenAddress: WETH_ADDRESS,
      outputTokenSymbol: 'KNC',
      outputTokenAddress: '0xdeFA4e8a7bcBA345F687a2f1456F5Edd9CE97202',
      inputAmount: web3.utils.toWei('0.0001', 'ETHER')
    }).then(function(response) {
      comparePrices(response[0]["uniswapreturn"], response[0]["kyberexpectedreturn"], response, SUSHISWAP, KYBER)
    })

    await checkPair({
      inputTokenSymbol: 'WETH',
      inputTokenAddress: WETH_ADDRESS,
      outputTokenSymbol: 'LINK',
      outputTokenAddress: '0x514910771af9ca656af840dff83e8264ecf986ca',
      inputAmount: web3.utils.toWei('0.0001', 'ETHER')
    }).then(function(response) {
      comparePrices(response[0]["uniswapreturn"], response[0]["kyberexpectedreturn"], response, SUSHISWAP, KYBER)
    })

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