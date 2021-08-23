// const path = require("path");
const HDWalletProvider = require("@truffle/hdwallet-provider")
require("dotenv").config()

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // for more about customizing your Truffle configuration!
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      // gas: 20000000,
      network_id: "*", // Match any network id
      websockets: true,
      skipDryRun: true
    },
    ropsten: {
      provider: new HDWalletProvider(process.env.DEPLOYMENT_ACCOUNT_KEY, "https://ropsten.infura.io/v3/" + process.env.INFURA_API_KEY),
      network_id: 3,
      gas: 5000000,
    gasPrice: 5000000000, // 5 Gwei
    skipDryRun: true
    },
    kovan: {
      provider: new HDWalletProvider(process.env.DEPLOYMENT_ACCOUNT_KEY, "https://kovan.infura.io/v3/" + process.env.INFURA_API_KEY),
      network_id: 42,
      gas: 5000000,
    gasPrice: 5000000000, // 5 Gwei
    skipDryRun: true
    },
    mainnet: {
      provider: new HDWalletProvider(process.env.DEPLOYMENT_ACCOUNT_KEY, "https://mainnet.infura.io/v3/" + process.env.INFURA_API_KEY),
      network_id: 1,
      gas: 5000000,
      gasPrice: 5000000000 // 5 Gwei
    },
    develop: {
      port: 8545
    }
  },
  compilers: {
    solc: { 
      version: "^0.6.6",
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  plugins: [
    'truffle-contract-size'
  ]
};
