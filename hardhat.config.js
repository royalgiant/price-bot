/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-ethers");
require("dotenv").config()

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
      forking: {
        url: "https://eth-mainnet.alchemyapi.io/v2/"+process.env.ALCHEMY_API_KEY,
        blockNumber: 13143229
      }
    },
    kovan: {
      chainid: 42,
      url: "https://eth-kovan.alchemyapi.io/v2/"+process.env.ALCHEMY_API_KEY,
      accounts: [`0x${process.env.KOVAN_TEST_ACCOUNT_PRIVATE_KEY}`]
    }
  },
  solidity: {
    version: "0.6.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
};
