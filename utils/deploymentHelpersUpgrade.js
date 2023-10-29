const {
  ethers,
  upgrades
} = require("hardhat");
const SortedTroves = artifacts.require("./SortedTroves.sol")
const TroveManager = artifacts.require("./TroveManager.sol")
const TroveManagerLiquidations = artifacts.require("./TroveManagerLiquidations.sol")
const TroveManagerRedemptions = artifacts.require("./TroveManagerRedemptions.sol")
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol")

const USDEToken = artifacts.require("./USDEToken.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const GasPool = artifacts.require("./GasPool.sol")
const CollSurplusPool = artifacts.require("./CollSurplusPool.sol")
const FunctionCaller = artifacts.require("./TestContracts/FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")
const HintHelpers = artifacts.require("./HintHelpers.sol")
const CollateralManager = artifacts.require("./CollateralManagerTester.sol")
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
const USDETokenTester = artifacts.require("./USDETokenTester.sol")

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
} = require('./proxyHelpers.js')

/* "ERD core" consists of all contracts in the core ERD system. */

const ZERO_ADDRESS = '0x' + '0'.repeat(40)
const maxBytes32 = '0x' + 'f'.repeat(64)

class DeploymentHelper {

  static async deployERDCore() {
    return this.deployERDCoreHardhat()
  }

  static async deployERDCoreHardhat() {
    const ActivePool = await ethers.getContractFactory("ActivePool");
    const activePool = await upgrades.deployProxy(ActivePool);
    await activePool.deployed();
    const BorrowerOperations = await ethers.getContractFactory("BorrowerOperations");
    const borrowerOperations = await upgrades.deployProxy(BorrowerOperations, [maxBytes32]);
    await borrowerOperations.deployed();
    const CollateralManager = await ethers.getContractFactory("CollateralManagerTester");
    const collateralManager = await upgrades.deployProxy(CollateralManager);
    await collateralManager.deployed();
    const CollSurplusPool = await ethers.getContractFactory("CollSurplusPool");
    const collSurplusPool = await upgrades.deployProxy(CollSurplusPool);
    await collSurplusPool.deployed();
    const DefaultPool = await ethers.getContractFactory("DefaultPool");
    const defaultPool = await upgrades.deployProxy(DefaultPool);
    await defaultPool.deployed();
    const GasPool = await ethers.getContractFactory("GasPool");
    const gasPool = await GasPool.deploy();
    await gasPool.deployed();
    const HintHelpers = await ethers.getContractFactory("HintHelpers");
    const hintHelpers = await upgrades.deployProxy(HintHelpers);
    await hintHelpers.deployed();
    const SortedTroves = await ethers.getContractFactory("SortedTrovesTester");
    const sortedTroves = await upgrades.deployProxy(SortedTroves);
    await sortedTroves.deployed();
    const StabilityPool = await ethers.getContractFactory("StabilityPool");
    const stabilityPool = await upgrades.deployProxy(StabilityPool);
    await stabilityPool.deployed();
    const TroveDebt = await ethers.getContractFactory("TroveDebt");
    const troveDebt = await upgrades.deployProxy(TroveDebt);
    await troveDebt.deployed();
    const OCR = ethers.utils.parseEther("2000000000"); // 200%
    const baseRate = ethers.utils.parseEther("7500000"); // 0.75%
    const slope1 = ethers.utils.parseEther("10000000"); // 1%
    const slope2 = ethers.utils.parseEther("20000000"); // 2%
    const TroveInterestRateStrategy = await ethers.getContractFactory("TroveInterestRateStrategy");
    const troveInterestRateStrategy = await upgrades.deployProxy(TroveInterestRateStrategy, [OCR, baseRate, slope1, slope2]);
    await troveInterestRateStrategy.deployed();
    const TroveManager = await ethers.getContractFactory("TroveManagerTester");
    const troveManager = await upgrades.deployProxy(TroveManager, [troveDebt.address, troveInterestRateStrategy.address]);
    await troveManager.deployed();
    const TroveManagerLiquidations = await ethers.getContractFactory("TroveManagerLiquidations");
    const troveManagerLiquidations = await upgrades.deployProxy(TroveManagerLiquidations);
    await troveManagerLiquidations.deployed();
    const TroveManagerRedemptions = await ethers.getContractFactory("TroveManagerRedemptions");
    const troveManagerRedemptions = await upgrades.deployProxy(TroveManagerRedemptions);
    await troveManagerRedemptions.deployed();
    const MultiTroveGetter = await ethers.getContractFactory("MultiTroveGetter");
    const multiTroveGetter = await upgrades.deployProxy(MultiTroveGetter, [troveManager.address, sortedTroves.address]);
    await multiTroveGetter.deployed();
    const functionCaller = await FunctionCaller.new()
    const EETH = await ethers.getContractFactory("EToken");
    const eTokenETH = await upgrades.deployProxy(EETH, ["ERD Wrapped ETH", "eETH"]);
    await eTokenETH.deployed();
    const ESTETH = await ethers.getContractFactory("EToken");
    const eTokenSTETH = await upgrades.deployProxy(ESTETH, ["ERD WErapped StETH", "eStETH"]);
    await eTokenSTETH.deployed();
    const LiquidityIncentive = await ethers.getContractFactory("LiquidityIncentive");
    const liquidityIncentive = await upgrades.deployProxy(LiquidityIncentive);
    await liquidityIncentive.deployed();
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await upgrades.deployProxy(Treasury);
    await treasury.deployed();
    const CommunityIssuance = await ethers.getContractFactory("CommunityIssuance");
    const communityIssuance = await upgrades.deployProxy(CommunityIssuance);
    await communityIssuance.deployed();
    const USDETokenTester = await ethers.getContractFactory("USDETokenTester");
    const usdeToken = await upgrades.deployProxy(USDETokenTester, [
      troveManager.address,
      troveManagerLiquidations.address,
      troveManagerRedemptions.address,
      stabilityPool.address,
      borrowerOperations.address,
      treasury.address,
      liquidityIncentive.address
    ]);
    // const weth = await WETH.new()
    // // const weth = await ERC20Token.new("WETH", "Wrapped Ether", 18)
    // // ERC20TokenETH.setAsDeployed(weth);
    // WETH.setAsDeployed(weth);

    // const steth = await ERC20Token.new("STETH", "Liquid staked Ether 2.0", 18)
    // ERC20Token.setAsDeployed(weth);

    const WETH = await ethers.getContractFactory("WETH");
    const weth = await WETH.deploy();
    await weth.deployed();
    const STETH = await ethers.getContractFactory("ERC20Token");
    const steth = await STETH.deploy("STETH", "Liquid staked Ether 2.0", 18);
    await steth.deployed();

    // const priceFeedSTETH = await PriceFeedTestnet.new();

    // const priceFeedETH = await PriceFeedTestnet.new();

    // PriceFeedTestnet.setAsDeployed(priceFeedSTETH);
    // PriceFeedTestnet.setAsDeployed(priceFeedETH);

    const PriceFeedTestnet = await ethers.getContractFactory("PriceFeedTestnet");
    const priceFeedETH = await PriceFeedTestnet.deploy();
    await priceFeedETH.deployed();
    const priceFeedSTETH = await PriceFeedTestnet.deploy();
    await priceFeedSTETH.deployed();

    // set TroveManager addr in SortedTroves
    await sortedTroves.setParams(
      maxBytes32,
      troveManager.address,
      troveManagerRedemptions.address,
      borrowerOperations.address
    )

    // set contract addresses in the FunctionCaller 
    await functionCaller.setTroveManagerAddress(troveManager.address)
    await functionCaller.setSortedTrovesAddress(sortedTroves.address)

    // set contracts in the Trove Manager
    await troveManager.setAddresses(
      borrowerOperations.address,
      activePool.address,
      defaultPool.address,
      stabilityPool.address,
      gasPool.address,
      collSurplusPool.address,
      priceFeedETH.address,
      usdeToken.address,
      sortedTroves.address,
      troveManagerLiquidations.address,
      troveManagerRedemptions.address,
      collateralManager.address,
    )

    await troveDebt.setAddress(
      troveManager.address
    )

    // await troveManager.initTrove(
    //   troveDebt.address,
    //   troveInterestRateStrategy.address
    // )

    await troveManagerRedemptions.setAddresses(
      borrowerOperations.address,
      activePool.address,
      defaultPool.address,
      stabilityPool.address,
      gasPool.address,
      collSurplusPool.address,
      priceFeedETH.address,
      usdeToken.address,
      sortedTroves.address,
      troveManager.address,
      collateralManager.address
    )

    await troveManagerRedemptions.init(
      troveDebt.address
    )

    await troveManagerLiquidations.setAddresses(
      borrowerOperations.address,
      activePool.address,
      defaultPool.address,
      stabilityPool.address,
      gasPool.address,
      collSurplusPool.address,
      priceFeedETH.address,
      usdeToken.address,
      sortedTroves.address,
      troveManager.address,
      collateralManager.address
    )

    await troveManagerLiquidations.init(
      troveDebt.address
    )

    // set contracts in BorrowerOperations 
    await borrowerOperations.setAddresses(
      troveManager.address,
      collateralManager.address,
      activePool.address,
      defaultPool.address,
      stabilityPool.address,
      gasPool.address,
      collSurplusPool.address,
      priceFeedETH.address,
      sortedTroves.address,
      usdeToken.address
    )

    await borrowerOperations.init(
      weth.address,
      treasury.address,
      troveDebt.address
    )

    // set contracts in the Pools
    await stabilityPool.setAddresses(
      borrowerOperations.address,
      troveManager.address,
      collateralManager.address,
      troveManagerLiquidations.address,
      activePool.address,
      usdeToken.address,
      sortedTroves.address,
      priceFeedETH.address,
      communityIssuance.address,
      weth.address
    )

    await activePool.setAddresses(
      borrowerOperations.address,
      troveManager.address,
      troveManagerLiquidations.address,
      troveManagerRedemptions.address,
      stabilityPool.address,
      defaultPool.address,
      treasury.address,
      liquidityIncentive.address,
      collSurplusPool.address,
      weth.address
    )

    await defaultPool.setAddresses(
      troveManager.address,
      activePool.address
    )

    await collSurplusPool.setAddresses(
      borrowerOperations.address,
      collateralManager.address,
      troveManager.address,
      troveManagerLiquidations.address,
      troveManagerRedemptions.address,
      activePool.address,
      weth.address,
    )

    // set contracts in HintHelpers
    await hintHelpers.setAddresses(
      sortedTroves.address,
      troveManager.address,
      collateralManager.address
    )

    // set contracts in CollateralManager
    await collateralManager.setAddresses(
      activePool.address,
      borrowerOperations.address,
      defaultPool.address,
      priceFeedETH.address,
      troveManager.address,
      troveManagerRedemptions.address,
      weth.address,
    )

    // set contracts in TroveInterestRateStrategy
    await troveInterestRateStrategy.setAddresses(
      troveManager.address,
      collateralManager.address,
      troveDebt.address,
      activePool.address,
      defaultPool.address,
      stabilityPool.address,
      priceFeedETH.address,
    )

    await eTokenETH.setAddresses(
      collateralManager.address,
      weth.address
    )

    await eTokenSTETH.setAddresses(
      collateralManager.address,
      steth.address
    )
    await collateralManager.addCollateral(weth.address, priceFeedETH.address, eTokenETH.address, web3.utils.toWei('1', 'ether'));
    // console.log(await collateralManager.getCollateralSupport())
    const coreContracts = {
      priceFeedSTETH,
      priceFeedETH,
      usdeToken,
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
      eTokenSTETH,
      communityIssuance,
      liquidityIncentive,
      treasury
    }
    return coreContracts
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
    const NewToken = await ethers.getContractFactory("ERC20Token")
    const newToken = await NewToken.deploy(symbol, name, decimals)
    await newToken.deployed();

    const PriceFeedTestnet = await ethers.getContractFactory("PriceFeedTestnet");
    const newPriceFeed = await PriceFeedTestnet.deploy();
    await newPriceFeed.deployed();

    const EToken = await ethers.getContractFactory("EToken");
    const newEToken = await upgrades.deployProxy(EToken, ["ERD Wrapped ".concat(name), "e".concat(symbol)]);
    await newEToken.deployed();
    await newEToken.setAddresses(contracts.collateralManager.address, newToken.address)

    await contracts.collateralManager.addCollateral(newToken.address, newPriceFeed.address, newEToken.address, ratio);
    await newPriceFeed.setPrice(price)

    return {
      token: newToken,
      priceFeed: newPriceFeed,
      eToken: newEToken
    }
  }
}
module.exports = DeploymentHelper