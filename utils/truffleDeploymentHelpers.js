const BN = require('bn.js')
const SortedTroves = artifacts.require("./SortedTroves.sol")
const TroveManager = artifacts.require("./TroveManager.sol")
const TroveManagerLiquidations = artifacts.require("./TroveManagerLiquidations.sol")
const TroveManagerRedemptions = artifacts.require("./TroveManagerRedemptions.sol")
const CollateralManager = artifacts.require("./CollateralManager.sol")
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol")
const USDEToken = artifacts.require("./USDEToken.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")
const TroveInterestRateStrategy = artifacts.require("./TroveInterestRateStrategy.sol")
const TroveDebt = artifacts.require("./TroveDebt.sol")

const Ray = web3.utils.toWei('1000000000', 'ether')
const OCR = web3.utils.toWei('2000000000', 'ether')   // 200%
const baseRate = web3.utils.toWei('7500000', 'ether') // 0.75%
const slope1 = web3.utils.toWei('10000000', 'ether') // 1%
const slope2 = web3.utils.toWei('20000000', 'ether') // 2%

const deployERD = async () => {
  const priceFeedTestnet = await PriceFeedTestnet.new()
  const sortedTroves = await SortedTroves.new()
  const troveManager = await TroveManager.new()
  const troveManagerLiquidations = await TroveManagerLiquidations.new()
  const troveManagerRedemptions = await TroveManagerRedemptions.new()
  const collateralManager = await CollateralManager.new()
  const activePool = await ActivePool.new()
  const stabilityPool = await StabilityPool.new()
  const defaultPool = await DefaultPool.new()
  const functionCaller = await FunctionCaller.new()
  const borrowerOperations = await BorrowerOperations.new()
  const usdeToken = await USDEToken.new(
    troveManager.address,
    troveManagerLiquidations.address,
    troveManagerRedemptions.address,
    stabilityPool.address,
    borrowerOperations.address
  )
  const troveInterestRateStrategy = await TroveInterestRateStrategy.new(OCR, baseRate, slope1, slope2)
  const troveDebt = await TroveDebt.new()
  DefaultPool.setAsDeployed(defaultPool)
  PriceFeedTestnet.setAsDeployed(priceFeedTestnet)
  USDEToken.setAsDeployed(usdeToken)
  SortedTroves.setAsDeployed(sortedTroves)
  TroveManager.setAsDeployed(troveManager)
  TroveManagerLiquidations.setAsDeployed(troveManagerLiquidations)
  TroveManagerRedemptions.setAsDeployed(troveManagerRedemptions)
  CollateralManager.setAsDeployed(collateralManager)
  ActivePool.setAsDeployed(activePool)
  StabilityPool.setAsDeployed(stabilityPool)
  FunctionCaller.setAsDeployed(functionCaller)
  BorrowerOperations.setAsDeployed(borrowerOperations)
  TroveInterestRateStrategy.setAsDeployed(troveInterestRateStrategy)
  TroveDebt.setAsDeployed(troveDebt)

  const contracts = {
    priceFeedTestnet,
    usdeToken,
    sortedTroves,
    troveManager,
    troveManagerLiquidations,
    troveManagerRedemptions,
    collateralManager,
    activePool,
    stabilityPool,
    defaultPool,
    functionCaller,
    borrowerOperations,
    troveInterestRateStrategy,
    troveDebt
  }
  return contracts
}

const getAddresses = (contracts) => {
  return {
    BorrowerOperations: contracts.borrowerOperations.address,
    PriceFeedTestnet: contracts.priceFeedTestnet.address,
    USDEToken: contracts.usdeToken.address,
    SortedTroves: contracts.sortedTroves.address,
    TroveManager: contracts.troveManager.address,
    TroveManagerLiquidations: contracts.troveManagerLiquidations.address,
    TroveManagerRedemptions: contracts.troveManagerRedemptions.address,
    CollateralManager: contracts.collateralManager.address,
    StabilityPool: contracts.stabilityPool.address,
    ActivePool: contracts.activePool.address,
    DefaultPool: contracts.defaultPool.address,
    FunctionCaller: contracts.functionCaller.address,
    TroveInterestRateStrategy: contracts.troveInterestRateStrategy.address,
    TroveDebt: contracts.troveDebt.address,
  }
}

// Connect contracts to their dependencies
const connectContracts = async (contracts, addresses) => {
  // set TroveManager addr in SortedTroves
  await contracts.sortedTroves.setTroveManager(addresses.TroveManager)

  // set contract addresses in the FunctionCaller 
  await contracts.functionCaller.setTroveManagerAddress(addresses.TroveManager)
  await contracts.functionCaller.setSortedTrovesAddress(addresses.SortedTroves)

  // set TroveManager addr in PriceFeed
  await contracts.priceFeedTestnet.setTroveManagerAddress(addresses.TroveManager)

  // set contracts in the Trove Manager
  await contracts.troveManager.setUSDEToken(addresses.USDEToken)
  await contracts.troveManager.setSortedTroves(addresses.SortedTroves)
  await contracts.troveManager.setPriceFeed(addresses.PriceFeedTestnet)
  await contracts.troveManager.setActivePool(addresses.ActivePool)
  await contracts.troveManager.setDefaultPool(addresses.DefaultPool)
  await contracts.troveManager.setStabilityPool(addresses.StabilityPool)
  await contracts.troveManager.setBorrowerOperations(addresses.BorrowerOperations)

  // set contracts in BorrowerOperations 
  await contracts.borrowerOperations.setSortedTroves(addresses.SortedTroves)
  await contracts.borrowerOperations.setPriceFeed(addresses.PriceFeedTestnet)
  await contracts.borrowerOperations.setActivePool(addresses.ActivePool)
  await contracts.borrowerOperations.setDefaultPool(addresses.DefaultPool)
  await contracts.borrowerOperations.setTroveManager(addresses.TroveManager)

  // set contracts in the Pools
  await contracts.stabilityPool.setActivePoolAddress(addresses.ActivePool)
  await contracts.stabilityPool.setDefaultPoolAddress(addresses.DefaultPool)

  await contracts.activePool.setStabilityPoolAddress(addresses.StabilityPool)
  await contracts.activePool.setDefaultPoolAddress(addresses.DefaultPool)

  await contracts.defaultPool.setStabilityPoolAddress(addresses.StabilityPool)
  await contracts.defaultPool.setActivePoolAddress(addresses.ActivePool)
}

const connectEchidnaProxy = async (echidnaProxy, addresses) => {
  echidnaProxy.setTroveManager(addresses.TroveManager)
  echidnaProxy.setBorrowerOperations(addresses.BorrowerOperations)
}

module.exports = {
  connectEchidnaProxy: connectEchidnaProxy,
  getAddresses: getAddresses,
  deployERD: deployERD,
  connectContracts: connectContracts
}
