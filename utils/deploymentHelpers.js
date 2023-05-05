const SortedTroves = artifacts.require("./SortedTroves.sol")
const TroveManager = artifacts.require("./TroveManager.sol")
const TroveManagerLiquidations = artifacts.require("./TroveManagerLiquidations.sol")
const TroveManagerRedemptions = artifacts.require("./TroveManagerRedemptions.sol")
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol")

const EUSDToken = artifacts.require("./EUSDToken.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const GasPool = artifacts.require("./GasPool.sol")
const CollSurplusPool = artifacts.require("./CollSurplusPool.sol")
const FunctionCaller = artifacts.require("./TestContracts/FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")
const HintHelpers = artifacts.require("./HintHelpers.sol")
const CollateralManager = artifacts.require("./CollateralManager.sol")
const TroveInterestRateStrategy = artifacts.require("./TroveInterestRateStrategy.sol")
const TroveDebt = artifacts.require("./TroveDebt.sol")
const EToken = artifacts.require("./EToken.sol")

// const ERC20TokenETH = artifacts.require("./TestContracts/TestAssets/ERC20Token.sol")
// const ERC20TokenAVAX = artifacts.require("./TestContracts/TestAssets/ERC20Token.sol")
// const ERC20TokenBTC = artifacts.require("./TestContracts/TestAssets/ERC20Token.sol")

const ERC20Token = artifacts.require("./TestContracts/TestAssets/ERC20Token.sol")
const WETH = artifacts.require("./TestContracts/TestAssets/WETH.sol")

const CommunityIssuance = artifacts.require("./CommunityIssuance.sol")
const Treasury = artifacts.require("./Treasury.sol")
const LiquidityIncentive = artifacts.require("./LiquidityIncentive.sol")

const CommunityIssuanceTester = artifacts.require("./CommunityIssuanceTester.sol")
const StabilityPoolTester = artifacts.require("./StabilityPoolTester.sol")
const ActivePoolTester = artifacts.require("./ActivePoolTester.sol")
const DefaultPoolTester = artifacts.require("./DefaultPoolTester.sol")
const ERDMathTester = artifacts.require("./ERDMathTester.sol")
// const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol")
const EUSDTokenTester = artifacts.require("./EUSDTokenTester.sol")

// Proxy scripts
const BorrowerOperationsScript = artifacts.require('BorrowerOperationsScript')
const BorrowerWrappersScript = artifacts.require('BorrowerWrappersScript')
const TroveManagerScript = artifacts.require('TroveManagerScript')
const StabilityPoolScript = artifacts.require('StabilityPoolScript')
const TokenScript = artifacts.require('TokenScript')

// const { artifacts } = require('hardhat')
const {
  contractSizer
} = require('../hardhat.config.js')
const {
  buildUserProxies,
  BorrowerOperationsProxy,
  BorrowerWrappersProxy,
  TroveManagerProxy,
  StabilityPoolProxy,
  SortedTrovesProxy,
  TokenProxy
} = require('../utils/proxyHelpers.js')

/* "ERD core" consists of all contracts in the core ERD system. */

const ZERO_ADDRESS = '0x' + '0'.repeat(40)
const maxBytes32 = '0x' + 'f'.repeat(64)

class DeploymentHelper {

  static async deployERDCore() {
    const cmdLineArgs = process.argv
    const frameworkPath = cmdLineArgs[1]
    return this.deployERDCoreHardhat()

    if (frameworkPath.includes("hardhat")) {
      return this.deployERDCoreHardhat()
    } else if (frameworkPath.includes("truffle")) {
      return this.deployERDCoreTruffle()
    }
  }

  static async deployERDContracts() {
    return this.deployERDContractsHardhat()
    if (frameworkPath.includes("hardhat")) {
      return this.deployERDContractsHardhat()
    } else if (frameworkPath.includes("truffle")) {
      return this.deployERDContractsTruffle()
    }
  }

  static async deployERDCoreHardhat() {
    const sortedTroves = await SortedTroves.new()
    const troveManager = await TroveManager.new()
    const troveManagerLiquidations = await TroveManagerLiquidations.new()
    const troveManagerRedemptions = await TroveManagerRedemptions.new()
    const activePool = await ActivePool.new()
    const stabilityPool = await StabilityPool.new()
    const gasPool = await GasPool.new()
    const defaultPool = await DefaultPool.new()
    const collSurplusPool = await CollSurplusPool.new()
    const functionCaller = await FunctionCaller.new()
    const borrowerOperations = await BorrowerOperations.new()
    const hintHelpers = await HintHelpers.new()
    const eusdToken = await EUSDToken.new()
    const collateralManager = await CollateralManager.new()

    const troveInterestRateStrategy = await TroveInterestRateStrategy.new()

    const troveDebt = await TroveDebt.new()

    const eTokenETH = await EToken.new()
    const eTokenSTETH = await EToken.new()


    const weth = await WETH.new()
    // const weth = await ERC20Token.new("WETH", "Wrapped Ether", 18)
    // ERC20TokenETH.setAsDeployed(weth);
    WETH.setAsDeployed(weth);

    const steth = await ERC20Token.new("STETH", "Liquid staked Ether 2.0", 18)
    ERC20Token.setAsDeployed(weth);

    const priceFeedSTETH = await PriceFeedTestnet.new();

    const priceFeedETH = await PriceFeedTestnet.new();

    PriceFeedTestnet.setAsDeployed(priceFeedSTETH);
    PriceFeedTestnet.setAsDeployed(priceFeedETH);

    CollateralManager.setAsDeployed(collateralManager)
    EUSDToken.setAsDeployed(eusdToken)
    DefaultPool.setAsDeployed(defaultPool)
    SortedTroves.setAsDeployed(sortedTroves)
    TroveManager.setAsDeployed(troveManager)
    TroveManagerLiquidations.setAsDeployed(troveManagerLiquidations)
    TroveManagerRedemptions.setAsDeployed(troveManagerRedemptions)
    ActivePool.setAsDeployed(activePool)
    StabilityPool.setAsDeployed(stabilityPool)
    GasPool.setAsDeployed(gasPool)
    CollSurplusPool.setAsDeployed(collSurplusPool)
    FunctionCaller.setAsDeployed(functionCaller)
    BorrowerOperations.setAsDeployed(borrowerOperations)
    HintHelpers.setAsDeployed(hintHelpers)
    TroveInterestRateStrategy.setAsDeployed(troveInterestRateStrategy)
    TroveDebt.setAsDeployed(troveDebt)
    EToken.setAsDeployed(eTokenETH)
    EToken.setAsDeployed(eTokenSTETH)

    const coreContracts = {
      priceFeedSTETH,
      priceFeedETH,
      eusdToken,
      sortedTroves,
      troveManager,
      activePool,
      stabilityPool,
      gasPool,
      defaultPool,
      collSurplusPool,
      functionCaller,
      borrowerOperations,
      hintHelpers,
      collateralManager,
      weth,
      steth,
      troveManagerLiquidations,
      troveManagerRedemptions,
      troveDebt,
      troveInterestRateStrategy,
      eTokenETH,
      eTokenSTETH
    }
    return coreContracts
  }

  static async deployTesterContractsHardhat(ERDContracts) {
    const testerContracts = {}

    // Contract without testers (yet)
    testerContracts.priceFeedTestnet = await PriceFeedTestnet.new()
    testerContracts.sortedTroves = await SortedTroves.new()
    testerContracts.collateralManager = await CollateralManager.new()
    // Actual tester contracts
    testerContracts.communityIssuance = await CommunityIssuanceTester.new()
    testerContracts.activePool = await ActivePoolTester.new()
    testerContracts.defaultPool = await DefaultPoolTester.new()
    testerContracts.stabilityPool = await StabilityPoolTester.new()
    testerContracts.gasPool = await GasPool.new()
    testerContracts.collSurplusPool = await CollSurplusPool.new()
    testerContracts.math = await ERDMathTester.new()
    testerContracts.borrowerOperations = await BorrowerOperations.new()
    testerContracts.troveManager = await TroveManagerTester.new()
    testerContracts.functionCaller = await FunctionCaller.new()
    testerContracts.hintHelpers = await HintHelpers.new()
    testerContracts.troveManagerLiquidations = await TroveManagerLiquidations.new()
    testerContracts.troveManagerRedemptions = await TroveManagerRedemptions.new()
    testerContracts.eusdToken = await EUSDTokenTester.new(
      testerContracts.troveManager.address,
      testerContracts.troveManagerLiquidations.address,
      testerContracts.troveManagerRedemptions.address,
      testerContracts.stabilityPool.address,
      testerContracts.borrowerOperations.address,
      ERDContracts.treasury.address,
      ERDContracts.liquidityIncentive.address
    )

    testerContracts.troveInterestRateStrategy = await TroveInterestRateStrategy.new(
      web3.utils.toWei('2000000000', 'ether'), // 200%
      web3.utils.toWei('7500000', 'ether'), // 0.75%
      web3.utils.toWei('10000000', 'ether'), // 1%
      web3.utils.toWei('20000000', 'ether') // 2%
    )

    testerContracts.troveDebt = await TroveDebt.new()
    testerContracts.eTokenETH = await EToken.new()
    testerContracts.eTokenSTETH = await EToken.new()

    testerContracts.weth = await WETH.new()

    testerContracts.steth = await ERC20Token.new("stETH", "Liquid staked Ether 2.0", 18)

    testerContracts.priceFeedSTETH = await PriceFeedTestnet.new();

    testerContracts.priceFeedETH = await PriceFeedTestnet.new();

    return testerContracts
  }

  static async deployERDContractsHardhat() {
    const communityIssuance = await CommunityIssuance.new()
    const treasury = await Treasury.new()
    const liquidityIncentive = await LiquidityIncentive.new()
    CommunityIssuance.setAsDeployed(communityIssuance)
    Treasury.setAsDeployed(treasury)
    LiquidityIncentive.setAsDeployed(liquidityIncentive)

    const ERDContracts = {
      treasury,
      liquidityIncentive,
      communityIssuance
    }
    return ERDContracts
  }

  static async deployERDTesterContractsHardhat() {
    const communityIssuance = await CommunityIssuanceTester.new()
    const treasury = await Treasury.new()
    const liquidityIncentive = await LiquidityIncentive.new()

    CommunityIssuanceTester.setAsDeployed(communityIssuance)
    Treasury.setAsDeployed(treasury)
    LiquidityIncentive.setAsDeployed(liquidityIncentive)

    const ERDContracts = {
      treasury,
      liquidityIncentive,
      communityIssuance
    }
    return ERDContracts
  }

  static async deployERDCoreTruffle() {
    const priceFeedSTETH = await PriceFeedTestnet.new()
    const priceFeedETH = await PriceFeedTestnet.new()
    const sortedTroves = await SortedTroves.new()
    const troveManager = await TroveManager.new()
    const troveManagerLiquidations = await TroveManagerLiquidations.new()
    const troveManagerRedemptions = await TroveManagerRedemptions.new()
    const activePool = await ActivePool.new()
    const stabilityPool = await StabilityPool.new()
    const gasPool = await GasPool.new()
    const defaultPool = await DefaultPool.new()
    const collSurplusPool = await CollSurplusPool.new()
    const functionCaller = await FunctionCaller.new()
    const borrowerOperations = await BorrowerOperations.new()
    const hintHelpers = await HintHelpers.new()
    const eusdToken = await EUSDToken.new(
      troveManager.address,
      troveManagerLiquidations.address,
      troveManagerRedemptions.address,
      stabilityPool.address,
      borrowerOperations.address
    )
    const collateralManager = await CollateralManager.new()
    const troveInterestRateStrategy = await TroveInterestRateStrategy.new(
      web3.utils.toWei('2000000000', 'ether'), // 200%
      web3.utils.toWei('7500000', 'ether'), // 0.75%
      web3.utils.toWei('10000000', 'ether'), // 1%
      web3.utils.toWei('20000000', 'ether') // 2%
    )
    const troveDebt = await TroveDebt.new()
    const eTokenETH = await EToken.new()
    const eTokenSTETH = await EToken.new()
    const coreContracts = {
      priceFeedSTETH,
      priceFeedETH,
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
      functionCaller,
      borrowerOperations,
      hintHelpers,
      collateralManager,
      troveDebt,
      troveInterestRateStrategy,
      eTokenETH,
      eTokenSTETH
    }
    return coreContracts
  }

  static async deployERDContractsTruffle() {
    const communityIssuance = await CommunityIssuance.new()
    const treasury = await Treasury.new()
    const liquidityIncentive = await LiquidityIncentive.new()

    const ERDContracts = {
      treasury,
      liquidityIncentive,
      communityIssuance
    }
    return ERDContracts
  }

  static async deployEUSDToken(contracts) {
    contracts.eusdToken = await EUSDToken.new()
    return contracts
  }

  static async deployEUSDTokenTester(contracts, ERDContracts) {
    contracts.eusdToken = await EUSDTokenTester.new(
      contracts.troveManager.address,
      contracts.troveManagerLiquidations.address,
      contracts.troveManagerRedemptions.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address,
      ERDContracts.treasury.address,
      ERDContracts.liquidityIncentive.address
    )
    return contracts
  }

  static async deployProxyScripts(contracts, ERDContracts, owner, users) {
    const proxies = await buildUserProxies(users)

    const borrowerWrappersScript = await BorrowerWrappersScript.new(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.eusdToken.address,
      contracts.collateralManager.address
    )
    contracts.borrowerWrappers = new BorrowerWrappersProxy(owner, proxies, borrowerWrappersScript.address)

    const borrowerOperationsScript = await BorrowerOperationsScript.new(contracts.borrowerOperations.address)
    contracts.borrowerOperations = new BorrowerOperationsProxy(owner, proxies, borrowerOperationsScript.address, contracts.borrowerOperations)

    const troveManagerScript = await TroveManagerScript.new(contracts.troveManager.address)
    contracts.troveManager = new TroveManagerProxy(owner, proxies, troveManagerScript.address, contracts.troveManager)

    const stabilityPoolScript = await StabilityPoolScript.new(contracts.stabilityPool.address)
    contracts.stabilityPool = new StabilityPoolProxy(owner, proxies, stabilityPoolScript.address, contracts.stabilityPool)

    contracts.sortedTroves = new SortedTrovesProxy(owner, proxies, contracts.sortedTroves)

    const eusdTokenScript = await TokenScript.new(contracts.eusdToken.address)
    contracts.eusdToken = new TokenProxy(owner, proxies, eusdTokenScript.address, contracts.eusdToken)
  }

  // Connect contracts to their dependencies
  static async connectCoreContracts(contracts, ERDContracts) {
    await ERDContracts.communityIssuance.initialize()
    await ERDContracts.treasury.initialize()
    await ERDContracts.liquidityIncentive.initialize()
    await contracts.sortedTroves.initialize()
    await contracts.troveManager.initialize(
      contracts.troveDebt.address,
      contracts.troveInterestRateStrategy.address
    )
    await contracts.troveManagerLiquidations.initialize()
    await contracts.troveManagerRedemptions.initialize()
    await contracts.activePool.initialize()
    await contracts.stabilityPool.initialize()
    await contracts.defaultPool.initialize()
    await contracts.collSurplusPool.initialize()
    await contracts.borrowerOperations.initialize()
    await contracts.hintHelpers.initialize()
    await contracts.collateralManager.initialize()
    await contracts.troveDebt.initialize()
    try {
      await contracts.eusdToken.initialize(
        contracts.troveManager.address,
        contracts.troveManagerLiquidations.address,
        contracts.troveManagerRedemptions.address,
        contracts.stabilityPool.address,
        contracts.borrowerOperations.address,
        ERDContracts.treasury.address,
        ERDContracts.liquidityIncentive.address
      )
    } catch (err) {}

    await contracts.troveInterestRateStrategy.initialize(
      web3.utils.toWei('2000000000', 'ether'), // 200%
      web3.utils.toWei('7500000', 'ether'), // 0.75%
      web3.utils.toWei('10000000', 'ether'), // 1%
      web3.utils.toWei('20000000', 'ether') // 2%
    )

    await contracts.eTokenETH.initialize(
      "ERD Wrapped ETH",
      "eETH"
    )

    await contracts.eTokenSTETH.initialize(
      "ERD Wrapped STETH",
      "eSTETH"
    )
    // set TroveManager addr in SortedTroves
    await contracts.sortedTroves.setParams(
      maxBytes32,
      contracts.troveManager.address,
      contracts.troveManagerRedemptions.address,
      contracts.borrowerOperations.address
    )

    // set contract addresses in the FunctionCaller 
    await contracts.functionCaller.setTroveManagerAddress(contracts.troveManager.address)
    await contracts.functionCaller.setSortedTrovesAddress(contracts.sortedTroves.address)

    // set contracts in the Trove Manager
    await contracts.troveManager.setAddresses(
      contracts.borrowerOperations.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.priceFeedETH.address,
      contracts.eusdToken.address,
      contracts.sortedTroves.address,
      contracts.troveManagerLiquidations.address,
      contracts.troveManagerRedemptions.address,
      contracts.collateralManager.address,
    )

    await contracts.troveDebt.setAddress(
      contracts.troveManager.address
    )

    // await contracts.troveManager.initTrove(
    //   contracts.troveDebt.address,
    //   contracts.troveInterestRateStrategy.address
    // )

    await contracts.troveManagerRedemptions.setAddresses(
      contracts.borrowerOperations.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.priceFeedETH.address,
      contracts.eusdToken.address,
      contracts.sortedTroves.address,
      contracts.troveManager.address,
      contracts.collateralManager.address
    )

    await contracts.troveManagerRedemptions.init(
      contracts.troveDebt.address
    )

    await contracts.troveManagerLiquidations.setAddresses(
      contracts.borrowerOperations.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.priceFeedETH.address,
      contracts.eusdToken.address,
      contracts.sortedTroves.address,
      contracts.troveManager.address,
      contracts.collateralManager.address
    )

    await contracts.troveManagerLiquidations.init(
      contracts.troveDebt.address
    )

    // set contracts in BorrowerOperations 
    await contracts.borrowerOperations.setAddresses(
      contracts.troveManager.address,
      contracts.collateralManager.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.priceFeedETH.address,
      contracts.sortedTroves.address,
      contracts.eusdToken.address
    )

    await contracts.borrowerOperations.init(
      contracts.weth.address,
      ERDContracts.treasury.address,
      contracts.troveDebt.address
    )

    // set contracts in the Pools
    await contracts.stabilityPool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.collateralManager.address,
      contracts.troveManagerLiquidations.address,
      contracts.activePool.address,
      contracts.eusdToken.address,
      contracts.sortedTroves.address,
      contracts.priceFeedETH.address,
      ERDContracts.communityIssuance.address,
      contracts.weth.address
    )

    await contracts.activePool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.troveManagerLiquidations.address,
      contracts.troveManagerRedemptions.address,
      contracts.stabilityPool.address,
      contracts.defaultPool.address,
      ERDContracts.treasury.address,
      ERDContracts.liquidityIncentive.address,
      contracts.collSurplusPool.address,
      contracts.weth.address
    )

    await contracts.defaultPool.setAddresses(
      contracts.troveManager.address,
      contracts.activePool.address
    )

    await contracts.collSurplusPool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.troveManagerLiquidations.address,
      contracts.troveManagerRedemptions.address,
      contracts.activePool.address,
      contracts.weth.address,
    )

    // set contracts in HintHelpers
    await contracts.hintHelpers.setAddresses(
      contracts.sortedTroves.address,
      contracts.troveManager.address,
      contracts.collateralManager.address
    )

    // set contracts in CollateralManager
    await contracts.collateralManager.setAddresses(
      contracts.activePool.address,
      contracts.borrowerOperations.address,
      contracts.defaultPool.address,
      contracts.priceFeedETH.address,
      contracts.troveManager.address,
      contracts.troveManagerRedemptions.address,
      contracts.weth.address,
    )

    // set contracts in TroveInterestRateStrategy
    await contracts.troveInterestRateStrategy.setAddresses(
      contracts.troveManager.address,
      contracts.collateralManager.address,
      contracts.troveDebt.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.priceFeedETH.address,
    )

    await contracts.eTokenETH.setAddresses(
      contracts.collateralManager.address,
      contracts.weth.address
    )

    await contracts.eTokenSTETH.setAddresses(
      contracts.collateralManager.address,
      contracts.steth.address
    )

    //   console.log("init")
    // console.log(await contracts.collateralManager.getCollateralSupport())
    // console.log(await contracts.collateralManager.getIsActive(contracts.weth.address))

    await contracts.collateralManager.addCollateral(contracts.weth.address, contracts.priceFeedETH.address, contracts.eTokenETH.address, web3.utils.toWei('1', 'ether'));
    // await contracts.collateralManager.addCollateral(contracts.steth.address, contracts.priceFeedSTETH.address);
  }

  // Deploys a new whitelist collateral. 
  // Creates a corresponding price feed, price curve, adjusts the params, and adds it to the whitelist.
  // Call this function after the normal connect core contracts.  
  static async deployExtraCollateral(contracts, params) {

    const {
      name,
      symbol,
      decimals,
      price,
      ratio
    } = params

    const newToken = await ERC20Token.new(symbol, name, decimals);

    const newPriceFeed = await PriceFeedTestnet.new();

    const newEToken = await EToken.new();
    await newEToken.initialize("ERD Wrapped ".concat(name), "e".concat(symbol))
    await newEToken.setAddresses(contracts.collateralManager.address, newToken.address)
    // TODO: Adjust & Oracle solidity script
    await contracts.collateralManager.addCollateral(newToken.address, newPriceFeed.address, newEToken.address, ratio);
    await newPriceFeed.setPrice(price)
    // console.log(name, (await newPriceFeed.getPrice()).toString())
    return {
      token: newToken,
      priceFeed: newPriceFeed,
      eToken: newEToken
    }
  }
}
module.exports = DeploymentHelper