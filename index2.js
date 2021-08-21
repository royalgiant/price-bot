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
const web3 = new Web3(process.env.RPC_URL)

// Contracts
const uniswapV2 = new web3.eth.Contract(legos.uniswapV2.router02.abi, legos.uniswapV2.router02.address)
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

function comparePrices(exchangePriceA, exchangePriceB, response) {
  // ExchangePriceB is greater than ExchangePriceA; buy from ExchangePriceA and sell on ExchangePriceB
  if (exchangePriceA < exchangePriceB) { 
    // tradeBot.methods.performArbitrage
    console.log("exchangePriceA < exchangePriceB. Buying from A and Selling on B")
  } else if(exchangePriceA > exchangePriceB) { // ExchangePriceA price is greater than ExchangePriceB; buy from ExchangePriceB and sell on ExchangePriceA
    // tradeBot.methods.performArbitrage
    console.log("exchangePriceA > exchangePriceB. Buying from B and Selling on A")
  }
  csvWriter.writeRecords(response).then(() => { console.log('Written to excel file.');});
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
      inputAmount: web3.utils.toWei('1', 'ETHER')
    }).then(function(response) {
      comparePrices(response[0]["uniswapreturn"], response[0]["kyberexpectedreturn"], response)
    })

    await checkPair({
      inputTokenSymbol: 'WETH',
      inputTokenAddress: WETH_ADDRESS,
      outputTokenSymbol: 'DAI',
      outputTokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
      inputAmount: web3.utils.toWei('1', 'ETHER')
    }).then(function(response) {
      comparePrices(response[0]["uniswapreturn"], response[0]["kyberexpectedreturn"], response)
    })

    await checkPair({
      inputTokenSymbol: 'WETH',
      inputTokenAddress: WETH_ADDRESS,
      outputTokenSymbol: 'KNC',
      outputTokenAddress: '0xdd974d5c2e2928dea5f71b9825b8b646686bd200',
      inputAmount: web3.utils.toWei('1', 'ETHER')
    }).then(function(response) {
      comparePrices(response[0]["uniswapreturn"], response[0]["kyberexpectedreturn"], response)
    })

    await checkPair({
      inputTokenSymbol: 'WETH',
      inputTokenAddress: WETH_ADDRESS,
      outputTokenSymbol: 'LINK',
      outputTokenAddress: '0x514910771af9ca656af840dff83e8264ecf986ca',
      inputAmount: web3.utils.toWei('1', 'ETHER')
    }).then(function(response) {
      comparePrices(response[0]["uniswapreturn"], response[0]["kyberexpectedreturn"], response)
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