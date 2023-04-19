const fs = require('fs')

const ZERO_ADDRESS = '0x' + '0'.repeat(40)
const maxBytes32 = '0x' + 'f'.repeat(64)

class MainnetDeploymentHelper {
  constructor(configParams, deployerWallet) {
    this.configParams = configParams
    this.deployerWallet = deployerWallet
    this.hre = require("hardhat")
  }

  loadPreviousDeployment() {
    let previousDeployment = {}
    if (fs.existsSync(this.configParams.OUTPUT_FILE)) {
      console.log(`Loading previous deployment...`)
      previousDeployment = require('../' + this.configParams.OUTPUT_FILE)
    }

    return previousDeployment
  }

  saveDeployment(deploymentState) {
    const deploymentStateJSON = JSON.stringify(deploymentState, null, 2)

    // console.log("Output Filepath", this.configParams.OUTPUT_FILE);
    // fs.writeFileSync(this.configParams.OUTPUT_FILE, deploymentStateJSON)
    fs.writeFileSync(this.configParams.TO_SAVE_FILENAME, deploymentStateJSON)

  }
  // --- Deployer methods ---

  async getFactory(name) {
    const factory = await ethers.getContractFactory(name, this.deployerWallet)
    return factory
  }

  async sendAndWaitForTransaction(txPromise) {
    const tx = await txPromise
    const minedTx = await ethers.provider.waitForTransaction(tx.hash, this.configParams.TX_CONFIRMATIONS)

    return minedTx
  }

  async loadOrDeploy(factory, name, deploymentState, params = []) {
    if (deploymentState[name] && deploymentState[name].address) {
      console.log(`Using previously deployed ${name} contract at address ${deploymentState[name].address}`)
      return new ethers.Contract(
        deploymentState[name].address,
        factory.interface,
        this.deployerWallet
      );
    }

    const contract = await factory.deploy(...params, {
      gasPrice: this.configParams.GAS_PRICE
    })
    await this.deployerWallet.provider.waitForTransaction(contract.deployTransaction.hash, this.configParams.TX_CONFIRMATIONS)

    deploymentState[name] = {
      address: contract.address,
      txHash: contract.deployTransaction.hash
    }

    this.saveDeployment(deploymentState)

    return contract
  }

  async deployERDCoreMainnet(deploymentState) {
    console.log("========================== 1 ==========================")
    // Get contract factories
    const priceFeedFactory = await this.getFactory("PriceFeed")
    const stETHOracleFactory = await this.getFactory("StETHOracle")
    const sortedTrovesFactory = await this.getFactory("SortedTroves")
    const troveManagerFactory = await this.getFactory("TroveManager")
    const activePoolFactory = await this.getFactory("ActivePool")
    const stabilityPoolFactory = await this.getFactory("StabilityPool")
    const gasPoolFactory = await this.getFactory("GasPool")
    const defaultPoolFactory = await this.getFactory("DefaultPool")
    const collSurplusPoolFactory = await this.getFactory("CollSurplusPool")
    const borrowerOperationsFactory = await this.getFactory("BorrowerOperations")
    const hintHelpersFactory = await this.getFactory("HintHelpers")
    const eusdTokenFactory = await this.getFactory("EUSDToken")
    const tellorCallerFactory = await this.getFactory("TellorCaller")
    const troveManagerLiquidationsFactory = await this.getFactory("TroveManagerLiquidations")
    const troveManagerRedemptionsFactory = await this.getFactory("TroveManagerRedemptions")
    const collateralManagerFactory = await this.getFactory("CollateralManager")
    const troveInterestRateStrategyFactory = await this.getFactory("TroveInterestRateStrategy")
    const troveDebtFactory = await this.getFactory("TroveDebt")

    // Deploy txs
    const priceFeed = await this.loadOrDeploy(priceFeedFactory, 'priceFeed', deploymentState)
    const stETHOracle = await this.loadOrDeploy(stETHOracleFactory, 'stETHOracle', deploymentState)

    const sortedTroves = await this.loadOrDeploy(sortedTrovesFactory, 'sortedTroves', deploymentState)
    const troveManager = await this.loadOrDeploy(troveManagerFactory, 'troveManager', deploymentState)
    const activePool = await this.loadOrDeploy(activePoolFactory, 'activePool', deploymentState)
    const stabilityPool = await this.loadOrDeploy(stabilityPoolFactory, 'stabilityPool', deploymentState)
    const gasPool = await this.loadOrDeploy(gasPoolFactory, 'gasPool', deploymentState)
    const defaultPool = await this.loadOrDeploy(defaultPoolFactory, 'defaultPool', deploymentState)
    const collSurplusPool = await this.loadOrDeploy(collSurplusPoolFactory, 'collSurplusPool', deploymentState)
    const borrowerOperations = await this.loadOrDeploy(borrowerOperationsFactory, 'borrowerOperations', deploymentState)
    const hintHelpers = await this.loadOrDeploy(hintHelpersFactory, 'hintHelpers', deploymentState)
    const tellorCaller = await this.loadOrDeploy(tellorCallerFactory, 'tellorCaller', deploymentState, [tellorMasterAddr])
    const troveManagerLiquidations = await this.loadOrDeploy(troveManagerLiquidationsFactory, 'troveManagerLiquidations', deploymentState)
    const troveManagerRedemptions = await this.loadOrDeploy(troveManagerRedemptionsFactory, 'troveManagerRedemptions', deploymentState)
    const collateralManager = await this.loadOrDeploy(collateralManagerFactory, 'collateralManager', deploymentState)

    const eusdTokenParams = [
      troveManager.address,
      troveManagerLiquidations.address,
      troveManagerRedemptions.address,
      stabilityPool.address,
      borrowerOperations.address
    ]
    const eusdToken = await this.loadOrDeploy(
      eusdTokenFactory,
      'eusdToken',
      deploymentState,
      eusdTokenParams
    )

    const rateParams = [
      web3.utils.toWei('2000000000', 'ether'), // 200%
      web3.utils.toWei('7500000', 'ether'), // 0.75%
      web3.utils.toWei('10000000', 'ether'), // 1%
      web3.utils.toWei('20000000', 'ether') // 2%
    ]
    const troveInterestRateStrategy = await this.loadOrDeploy(
      troveInterestRateStrategyFactory,
      'troveInterestRateStrategy',
      deploymentState,
      rateParams
    )

    const troveDebt = await this.loadOrDeploy(troveDebtFactory, 'troveDebt', deploymentState)

    if (!this.configParams.ETHERSCAN_BASE_URL) {
      console.log('No Etherscan Url defined, skipping verification')
    } else {
      console.log("Contract Verification Removed From mainnetDeploymentHelpers.js")
      // await this.verifyContract('priceFeed', deploymentState)
      // await this.verifyContract('stETHOracle', deploymentState)
      // await this.verifyContract('collateralManager', deploymentState)
      // await this.verifyContract('sortedTroves', deploymentState)
      // await this.verifyContract('troveManager', deploymentState)
      // await this.verifyContract('troveManagerLiquidations', deploymentState)
      // await this.verifyContract('troveManagerRedemptions', deploymentState)
      // await this.verifyContract('activePool', deploymentState)
      // await this.verifyContract('stabilityPool', deploymentState)
      // await this.verifyContract('gasPool', deploymentState)
      // await this.verifyContract('defaultPool', deploymentState)
      // await this.verifyContract('collSurplusPool', deploymentState)
      // await this.verifyContract('borrowerOperations', deploymentState)
      // await this.verifyContract('hintHelpers', deploymentState)
      // await this.verifyContract('tellorCaller', deploymentState, [tellorMasterAddr])
      // await this.verifyContract('eusdToken', deploymentState, eusdTokenParams)
      // await this.verifyContract('collateralManager', deploymentState)
      // await this.verifyContract('troveInterestRateStrategy', deploymentState)
      // await this.verifyContract('troveDebt', deploymentState)
    }

    const coreContracts = {
      priceFeed,
      stETHOracle,
      collateralManager,
      eusdToken,
      sortedTroves,
      troveManager,
      troveManagerLiquidations,
      troveManagerRedemptions,
      activePool,
      stabilityPool,
      gasPool,
      defaultPool,
      collSurplusPool,
      borrowerOperations,
      hintHelpers,
      tellorCaller,
      collateralManager,
      troveInterestRateStrategy,
      troveDebt
    }
    return coreContracts
  }

  async deployERDContractsMainnet(deploymentState) {
    const treasuryFactory = await this.getFactory("Treasury")
    const communityIssuanceFactory = await this.getFactory("CommunityIssuance")

    const treasury = await this.loadOrDeploy(treasuryFactory, 'treasury', deploymentState)
    const communityIssuance = await this.loadOrDeploy(communityIssuanceFactory, 'communityIssuance', deploymentState)

    if (!this.configParams.ETHERSCAN_BASE_URL) {
      console.log('No Etherscan Url defined, skipping verification')
    } else {
      // await this.verifyContract('treasury', deploymentState)
      // await this.verifyContract('communityIssuance', deploymentState)
    }

    const ERDContracts = {
      treasury,
      communityIssuance
    }
    return ERDContracts
  }

  async deployUnipoolMainnet(deploymentState) {
    const unipoolFactory = await this.getFactory("Unipool")
    const unipool = await this.loadOrDeploy(unipoolFactory, 'unipool', deploymentState)

    if (!this.configParams.ETHERSCAN_BASE_URL) {
      console.log('No Etherscan Url defined, skipping verification')
    } else {
      // await this.verifyContract('unipool', deploymentState)
    }

    return unipool
  }

  async deployPool2UnipoolMainnet(deploymentState, dexName) {
    const unipoolFactory = await this.getFactory("Pool2Unipool")
    const contractName = `${dexName}Unipool`
    const pool2Unipool = await this.loadOrDeploy(unipoolFactory, contractName, deploymentState)

    if (!this.configParams.ETHERSCAN_BASE_URL) {
      console.log('No Etherscan Url defined, skipping verification')
    } else {
      // await this.verifyContract(contractName, deploymentState)
    }

    return pool2Unipool;
  }

  async deployMultiTroveGetterMainnet(ERDCore, deploymentState, wethAddress) {
    const multiTroveGetterFactory = await this.getFactory("MultiTroveGetter")
    const multiTroveGetterParams = [
      ERDCore.troveManager.address,
      ERDCore.sortedTroves.address
    ]

    const multiTroveGetter = await this.loadOrDeploy(
      multiTroveGetterFactory,
      'multiTroveGetter',
      deploymentState,
      multiTroveGetterParams
    )

    if (!this.configParams.ETHERSCAN_BASE_URL) {
      console.log('No Etherscan Url defined, skipping verification')
    } else {
      // await this.verifyContract('multiTroveGetter', deploymentState, multiTroveGetterParams)
    }

    return multiTroveGetter
  }
  // --- Connector methods ---

  async isOwnershipRenounced(contract) {
    const owner = await contract.owner()
    return owner == ZERO_ADDRESS
  }
  // Connect contracts to their dependencies
  async connectCoreContractsMainnet(contracts, ERDContracts, chainlinkProxyAddress, wethAddress) {
    const gasPrice = this.configParams.GAS_PRICE
    // Set ChainlinkAggregatorProxy and TellorCaller in the PriceFeed
    await this.isOwnershipRenounced(contracts.priceFeed) ||
      await this.sendAndWaitForTransaction(contracts.priceFeed.setAddresses(chainlinkProxyAddress, contracts.tellorCaller.address, {
        gasPrice
      }))

    // set TroveManager addr in SortedTroves
    await this.isOwnershipRenounced(contracts.sortedTroves) ||
      await this.sendAndWaitForTransaction(contracts.sortedTroves.setParams(
        maxBytes32,
        contracts.troveManager.address,
        contracts.troveManagerRedemptions.address,
        contracts.borrowerOperations.address, {
          gasPrice
        }
      ))

    // set contracts in the Trove Manager
    await this.sendAndWaitForTransaction(contracts.troveManager.setAddresses(
      contracts.borrowerOperations.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.priceFeed.address,
      contracts.eusdToken.address,
      contracts.sortedTroves.address,
      contracts.troveManagerRedemptions.address,
      contracts.troveManagerLiquidations.address,
      contracts.collateralManager.address, {
        gasPrice
      }
    ))

    await this.isOwnershipRenounced(contracts.troveDebt) ||
      await this.sendAndWaitForTransaction(contracts.troveDebt.setAddress(
        contracts.troveManager.address, {
          gasPrice
        }
      ))

    await this.sendAndWaitForTransaction(contracts.troveManager.initTrove(
      contracts.troveDebt.address,
      contracts.troveInterestRateStrategy.address, {
        gasPrice
      }
    ))

    // set contracts in the Trove Manager Liquidations
    await this.sendAndWaitForTransaction(contracts.troveManagerLiquidations.setAddresses(
      contracts.borrowerOperations.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.priceFeed.address,
      contracts.eusdToken.address,
      contracts.sortedTroves.address,
      contracts.troveManager.address,
      contracts.collateralManager.address, {
        gasPrice
      }
    ))
    await this.isOwnershipRenounced(contracts.troveManagerLiquidations) ||
      await this.sendAndWaitForTransaction(contracts.troveManagerLiquidations.init(
        ERDContracts.treasury.address,
        contracts.troveDebt.address, {
          gasPrice
        }
      ))

    // set contracts in the Trove Manager Redemptions
    await this.sendAndWaitForTransaction(contracts.troveManagerRedemptions.setAddresses(
      contracts.borrowerOperations.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.priceFeed.address,
      contracts.eusdToken.address,
      contracts.sortedTroves.address,
      contracts.troveManager.address,
      contracts.collateralManager.address,
      ERDContracts.treasury.address, {
        gasPrice
      }
    ))

    await this.isOwnershipRenounced(contracts.troveManagerRedemptions) ||
      await this.sendAndWaitForTransaction(contracts.troveManagerRedemptions.init(
        ERDContracts.treasury.address,
        contracts.troveDebt.address, {
          gasPrice
        }
      ))

    // set contracts in BorrowerOperations
    await this.sendAndWaitForTransaction(contracts.borrowerOperations.setAddresses(
      contracts.troveManager.address,
      contracts.collateralManager.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.priceFeed.address,
      contracts.sortedTroves.address,
      contracts.eusdToken.address, {
        gasPrice
      }
    ))

    await this.isOwnershipRenounced(contracts.borrowerOperations) ||
      await this.sendAndWaitForTransaction(contracts.borrowerOperations.init(
        wethAddress,
        ERDContracts.treasury.address,
        contracts.troveDebt.address, {
          gasPrice
        }
      ))

    // set contracts in the Pools
    await this.isOwnershipRenounced(contracts.stabilityPool) ||
      await this.sendAndWaitForTransaction(contracts.stabilityPool.setAddresses(
        contracts.borrowerOperations.address,
        contracts.troveManager.address,
        contracts.collateralManager.address,
        contracts.troveManagerLiquidations.address,
        contracts.activePool.address,
        contracts.eusdToken.address,
        contracts.sortedTroves.address,
        contracts.priceFeed.address,
        ERDContracts.communityIssuance.address,
        wethAddress, {
          gasPrice
        }
      ))

    await this.isOwnershipRenounced(contracts.activePool) ||
      await this.sendAndWaitForTransaction(contracts.activePool.setAddresses(
        contracts.borrowerOperations.address,
        contracts.troveManager.address,
        contracts.troveManagerLiquidations.address,
        contracts.troveManagerRedemptions.address,
        contracts.stabilityPool.address,
        contracts.defaultPool.address,
        ERDContracts.treasury.address,
        contracts.collSurplusPool.address,
        wethAddress, {
          gasPrice
        }
      ))

    await this.isOwnershipRenounced(contracts.defaultPool) ||
      await this.sendAndWaitForTransaction(contracts.defaultPool.setAddresses(
        contracts.troveManager.address,
        contracts.activePool.address, {
          gasPrice
        }
      ))

    await this.isOwnershipRenounced(contracts.collSurplusPool) ||
      await this.sendAndWaitForTransaction(contracts.collSurplusPool.setAddresses(
        contracts.borrowerOperations.address,
        contracts.troveManager.address,
        contracts.troveManagerLiquidations.address,
        contracts.troveManagerRedemptions.address,
        contracts.activePool.address,
        wethAddress, {
          gasPrice
        }
      ))

    // set contracts in HintHelpers
    await this.isOwnershipRenounced(contracts.hintHelpers) ||
      await this.sendAndWaitForTransaction(contracts.hintHelpers.setAddresses(
        contracts.sortedTroves.address,
        contracts.troveManager.address,
        contracts.collateralManager.address, {
          gasPrice
        }
      ))

    // set contracts in TroveInterestRateStrategy
    await this.sendAndWaitForTransaction(contracts.troveInterestRateStrategy.setAddresses(
      contracts.troveManager.address,
      contracts.collateralManager.address,
      contracts.troveDebt.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.priceFeed.address, {
        gasPrice
      }
    ))

    // set contracts in CollateralManager
    await this.sendAndWaitForTransaction(contracts.collateralManager.setAddresses(
      contracts.borrowerOperations.address,
      contracts.priceFeed.address,
      contracts.troveManager.address,
      wethAddress, {
        gasPrice
      }
    ))
    await contracts.collateralManager.setAddresses(
      contracts.borrowerOperations.address,
      contracts.priceFeedETH.address,
      contracts.troveManager.address,
      contracts.weth.address,
    )
  }

  // --- Verify on Ethrescan ---
  async verifyContract(name, deploymentState, constructorArguments = []) {
    s
    if (!deploymentState[name] || !deploymentState[name].address) {
      console.error(`  --> No deployment state for contract ${name}!!`)
      return
    }
    if (deploymentState[name].verification) {
      console.log(`Contract ${name} already verified`)
      return
    }

    try {
      await this.hre.run("verify:verify", {
        address: deploymentState[name].address,
        constructorArguments,
      })
    } catch (error) {
      // if it was already verified, it’s like a success, so let’s move forward and save it
      if (error.name != 'NomicLabsHardhatPluginError') {
        console.error(`Error verifying: ${error.name}`)
        console.error(error)
        return
      }
    }

    deploymentState[name].verification = `${this.configParams.ETHERSCAN_BASE_URL}/${deploymentState[name].address}#code`

    this.saveDeployment(deploymentState)
  }

  // --- Helpers ---

  async logContractObjects(contracts) {
    console.log(`Contract objects addresses:`)
    for (const contractName of Object.keys(contracts)) {
      console.log(`${contractName}: ${contracts[contractName].address}`);
    }
  }
}

module.exports = MainnetDeploymentHelper