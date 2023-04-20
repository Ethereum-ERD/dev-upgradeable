require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-vyper");
require('@openzeppelin/hardhat-upgrades');
require('hardhat-gas-reporter');
require("@nomiclabs/hardhat-truffle5");
require('hardhat-contract-sizer');
const fs = require('fs');

const accounts = require("./hardhatAccountsList2k.js");
const accountsList = accounts.accountsList

// const INFURA_KEY = fs.readFileSync(".infuraKey").toString().trim();
// const MNEMONIC = fs.readFileSync(".mnemonic").toString().trim();
// const etherscanApiKey = fs.readFileSync(".etherscanApiKey").toString().trim();
const INFURA_KEY = "";
const MNEMONIC = "";
const etherscanApiKey = "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [{
        version: "0.4.23",
        settings: {
          optimizer: {
            enabled: true,
            runs: 10
          }
        }
      },
      {
        version: "0.8.7",
        settings: {
          optimizer: {
            enabled: true,
            runs: 10,
          },
        }
      },

    ]
  },
  // contractSizer: {
  //   alphaSort: true,
  //   runOnCompile: true,
  //   disambiguatePaths: false,
  // },
  vyper: {
    version: "0.2.15",
  },
  networks: {
    hardhat: {
      accounts: accountsList,
      gas: 10000000, // tx gas limit
      blockGasLimit: 15000000,
      gasPrice: 20000000000,
      initialBaseFeePerGas: 0,
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${INFURA_KEY}`,
      accounts: {
        mnemonic: `${MNEMONIC}`,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
        passphrase: "",
      }
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
      accounts: {
        mnemonic: `${MNEMONIC}`,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
        passphrase: "",
      }
    }
  },
  etherscan: {
    apiKey: `${etherscanApiKey}`,
  },
  // gasReporter: {
  //   enabled: true,
  //   currency: 'USD',
  // }
};


task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});