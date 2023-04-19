const {
    ethers,
    upgrades
} = require("hardhat");
const saveData = require('../fsUtil');

const OCR = ethers.utils.parseEther("2000000000"); // 200%
const baseRate = ethers.utils.parseEther("7500000"); // 0.75%
const slope1 = ethers.utils.parseEther("10000000"); // 1%
const slope2 = ethers.utils.parseEther("20000000"); // 2%


async function main() {
    // deploy ActivePool
    const ActivePool = await ethers.getContractFactory("ActivePool");
    const activePool = await upgrades.deployProxy(ActivePool);
    await activePool.deployed();
    console.log("activePool deployed to:", activePool.address);
    saveData("activePool", activePool.address);

    // deploy BorrowerOperations
    const BorrowerOperations = await ethers.getContractFactory("BorrowerOperations");
    const borrowerOperations = await upgrades.deployProxy(BorrowerOperations);
    await borrowerOperations.deployed();
    console.log("borrowerOperations deployed to:", borrowerOperations.address);
    saveData("borrowerOperations", borrowerOperations.address);

    // deploy ColalteralManager
    const CollateralManager = await ethers.getContractFactory("CollateralManager");
    const collateralManager = await upgrades.deployProxy(CollateralManager);
    await collateralManager.deployed();
    console.log("collateralManager deployed to:", collateralManager.address);
    saveData("collateralManager", collateralManager.address);

    // deploy CollSurplusPool
    const CollSurplusPool = await ethers.getContractFactory("CollSurplusPool");
    const collSurplusPool = await upgrades.deployProxy(CollSurplusPool);
    await collSurplusPool.deployed();
    console.log("collSurplusPool deployed to:", collSurplusPool.address);
    saveData("collSurplusPool", collSurplusPool.address);

    // deploy CommunityIssuance
    const CommunityIssuance = await ethers.getContractFactory("CommunityIssuance");
    const communityIssuance = await upgrades.deployProxy(CommunityIssuance);
    await communityIssuance.deployed();
    console.log("communityIssuance deployed to:", communityIssuance.address);
    saveData("communityIssuance", communityIssuance.address);


    // deploy DefaultPool
    const DefaultPool = await ethers.getContractFactory("DefaultPool");
    const defaultPool = await upgrades.deployProxy(DefaultPool);
    await defaultPool.deployed();
    console.log("defaultPool deployed to:", defaultPool.address);
    saveData("defaultPool", defaultPool.address);

    // deploy GasPool
    const GasPool = await ethers.getContractFactory("GasPool");
    const gasPool = await GasPool.deploy();
    await gasPool.deployed();
    console.log("gasPool deployed to:", gasPool.address);
    saveData("gasPool", gasPool.address);

    // deploy HintHelpers
    const HintHelpers = await ethers.getContractFactory("HintHelpers");
    const hintHelpers = await upgrades.deployProxy(HintHelpers);
    await hintHelpers.deployed();
    console.log("hintHelpers deployed to:", hintHelpers.address);
    saveData("hintHelpers", hintHelpers.address);


    // deploy SortedTroves
    const SortedTroves = await ethers.getContractFactory("SortedTroves");
    const sortedTroves = await upgrades.deployProxy(SortedTroves);
    await sortedTroves.deployed();
    console.log("sortedTroves deployed to:", sortedTroves.address);
    saveData("sortedTroves", sortedTroves.address);

    // deploy StabilityPool
    const StabilityPool = await ethers.getContractFactory("StabilityPool");
    const stabilityPool = await upgrades.deployProxy(StabilityPool);
    await stabilityPool.deployed();
    console.log("stabilityPool deployed to:", stabilityPool.address);
    saveData("stabilityPool", stabilityPool.address);

    // deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await upgrades.deployProxy(Treasury);
    await treasury.deployed();
    console.log("treasury deployed to:", treasury.address);
    saveData("treasury", treasury.address);

    // deploy TroveDebt
    const TroveDebt = await ethers.getContractFactory("TroveDebt");
    const troveDebt = await upgrades.deployProxy(TroveDebt);
    await troveDebt.deployed();
    console.log("troveDebt deployed to:", troveDebt.address);
    saveData("troveDebt", troveDebt.address);

    // deploy TroveInterestRateStrategy
    const TroveInterestRateStrategy = await ethers.getContractFactory("TroveInterestRateStrategy");
    const troveInterestRateStrategy = await upgrades.deployProxy(TroveInterestRateStrategy, [OCR, baseRate, slope1, slope2]);
    await troveInterestRateStrategy.deployed();
    console.log("troveInterestRateStrategy deployed to:", troveInterestRateStrategy.address);
    saveData("troveInterestRateStrategy", troveInterestRateStrategy.address);


    // deploy TroveManager
    const TroveManager = await ethers.getContractFactory("TroveManager");
    const troveManager = await upgrades.deployProxy(TroveManager, [troveDebt.address, troveInterestRateStrategy.address]);
    await troveManager.deployed();
    console.log("troveManager deployed to:", troveManager.address);
    saveData("troveManager", troveManager.address);

    // deploy TroveManagerLiquidations
    const TroveManagerLiquidations = await ethers.getContractFactory("TroveManagerLiquidations");
    const troveManagerLiquidations = await upgrades.deployProxy(TroveManagerLiquidations);
    await troveManagerLiquidations.deployed();
    console.log("troveManagerLiquidations deployed to:", troveManagerLiquidations.address);
    saveData("troveManagerLiquidations", troveManagerLiquidations.address);

    // deploy TroveManagerRedemptions
    const TroveManagerRedemptions = await ethers.getContractFactory("TroveManagerRedemptions");
    const troveManagerRedemptions = await upgrades.deployProxy(TroveManagerRedemptions);
    await troveManagerRedemptions.deployed();
    console.log("troveManagerRedemptions deployed to:", troveManagerRedemptions.address);
    saveData("troveManagerRedemptions", troveManagerRedemptions.address);

    // deploy MultiTroveGetter
    const MultiTroveGetter = await ethers.getContractFactory("MultiTroveGetter");
    const multiTroveGetter = await upgrades.deployProxy(MultiTroveGetter, [troveManager.address, sortedTroves.address]);
    await multiTroveGetter.deployed();
    console.log("multiTroveGetter deployed to:", multiTroveGetter.address);
    saveData("multiTroveGetter", multiTroveGetter.address);

    // deploy EUSDToken
    const EUSDToken = await ethers.getContractFactory("EUSDToken");
    const eusdToken = await upgrades.deployProxy(EUSDToken, [
        troveManager.address,
        troveManagerLiquidations.address,
        troveManagerRedemptions.address,
        stabilityPool.address,
        borrowerOperations.address
    ]);
    await eusdToken.deployed();
    console.log("eusdToken deployed to:", eusdToken.address);
    saveData("eusdToken", eusdToken.address);

    // deploy PriceFeed
    // Testnet
    const PriceFeedTestnet = await ethers.getContractFactory("PriceFeedTestnet");
    const priceFeed = await PriceFeedTestnet.deploy();
    await priceFeed.deployed();
    console.log("priceFeed deployed to:", priceFeed.address);
    saveData("priceFeed", priceFeed.address);
    // // mainnet
    // const PriceFeed = await ethers.getContractFactory("PriceFeed");
    // const priceFeed = await upgrades.deployProxy(PriceFeed);
    // await priceFeed.deployed();
    // console.log("priceFeed deployed to:", priceFeed.address);
    // saveData("priceFeed", priceFeed.address);

    // deploy StETHOracle
    // Testnet
    const StETHOracleTestnet = await ethers.getContractFactory("StETHOracleTestnet");
    const stETHOracle = await StETHOracleTestnet.deploy();
    await stETHOracle.deployed();
    console.log("stETHOracle deployed to:", stETHOracle.address);
    saveData("stETHOracle", stETHOracle.address);
    // // mainnet
    // const StETHOracle = await ethers.getContractFactory("StETHOracle");
    // const stETHOracle = await upgrades.deployProxy(StETHOracle);
    // await stETHOracle.deployed();
    // console.log("stETHOracle deployed to:", stETHOracle.address);
    // saveData("stETHOracle", stETHOracle.address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});