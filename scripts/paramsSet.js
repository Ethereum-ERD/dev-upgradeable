// deploy token folder contracts
const {
    ethers,
    upgrades
} = require("hardhat");
const fs = require('fs');
const deployJson = fs.readFileSync('./deploy.json');
const deploy = JSON.parse(deployJson);

const _activePoolAddress = deploy.activePool;
const _borrowerOperationsAddress = deploy.borrowerOperations;
const _collateralManagerAddress = deploy.collateralManager;
const _collSurplusPoolAddress = deploy.collSurplusPool;
const _communityIssuanceAddress = deploy.communityIssuance;
const _defaultPoolAddress = deploy.defaultPool;
const _gasPoolAddress = deploy.gasPool;
const _hintHelpersAddress = deploy.hintHelpers;
const _sortedTrovesAddress = deploy.sortedTroves;
const _stabilityPoolAddress = deploy.stabilityPool;
const _treasuryAddress = deploy.treasury;
const _liquidityIncentiveAddress = deploy.liquidityIncentive;
const _troveDebtAddress = deploy.troveDebt;
const _troveInterestRateStrategyAddress = deploy.troveInterestRateStrategy;
const _troveManagerAddress = deploy.troveManager;
const _troveManagerLiquidationsAddress = deploy.troveManagerLiquidations;
const _troveManagerRedemptionsAddress = deploy.troveManagerRedemptions;
const _multiTroveGetterAddress = deploy.multiTroveGetter;
const _usdeTokenAddress = deploy.usdeToken;
const _priceFeedAddress = deploy.priceFeed;
const _stETHOracleAddress = deploy.stETHOracle;
const _eETHAddress = deploy.eETH;
const _eStETHAddress = deploy.eSTETH;
const _wethAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const _stETHAddress = '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84';
const _priceAggregatorAddress = '0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419';
const _tellorCallerAddress = '0xad430500ecda11e38c9bcb08a702274b94641112';

const maxBytes32 = '0x' + 'f'.repeat(64)

async function main() {
    // ActivePool set params
    const ActivePool = await ethers.getContractFactory("ActivePool");
    const activePool = await ActivePool.attach(_activePoolAddress);
    var tx = await activePool.setAddresses(
        _borrowerOperationsAddress,
        _troveManagerAddress,
        _troveManagerLiquidationsAddress,
        _troveManagerRedemptionsAddress,
        _stabilityPoolAddress,
        _defaultPoolAddress,
        _treasuryAddress,
        _liquidityIncentiveAddress,
        _collSurplusPoolAddress,
        _wethAddress
    );
    await tx.wait(); // wait mining
    console.log("ActivePool set params success.");

    // BorrowerOperations set params
    const BorrowerOperations = await ethers.getContractFactory("BorrowerOperations");
    const borrowerOperations = await BorrowerOperations.attach(_borrowerOperationsAddress);
    var tx = await borrowerOperations.setAddresses(
        _troveManagerAddress,
        _collateralManagerAddress,
        _activePoolAddress,
        _defaultPoolAddress,
        _stabilityPoolAddress,
        _gasPoolAddress,
        _collSurplusPoolAddress,
        _priceFeedAddress,
        _sortedTrovesAddress,
        _usdeTokenAddress
    );
    await tx.wait(); // wait mining
    var txInit = await borrowerOperations.init(
        _wethAddress,
        _treasuryAddress,
        _troveDebtAddress
    );
    await txInit.wait(); // wait mining
    console.log("BorrowerOperations set params success.");

    // CollateralManager set params
    const CollateralManager = await ethers.getContractFactory("CollateralManager");
    const collateralManager = await CollateralManager.attach(_collateralManagerAddress);
    var tx = await collateralManager.setAddresses(
        _activePoolAddress,
        _borrowerOperationsAddress,
        _defaultPoolAddress,
        _priceFeedAddress,
        _troveManagerAddress,
        _troveManagerRedemptionsAddress,
        _wethAddress
    );
    await tx.wait(); // wait mining
    console.log("CollateralManager set params success.");
    console.log("CollateralManager add collateral WETH.");
    var addTx1 = await collateralManager.addCollateral(_wethAddress, _priceFeedAddress);
    await addTx1.wait();
    console.log("CollateralManager add collateral WETH success.");
    console.log("CollateralManager add collateral stETH.");
    var addTx2 = await collateralManager.addCollateral(_stETHAddress, _stETHOracleAddress);
    await addTx2.wait();
    console.log("CollateralManager add collateral stETH success.");

    // CollSurplusPool set params
    const CollSurplusPool = await ethers.getContractFactory("CollSurplusPool");
    const collSurplusPool = await CollSurplusPool.attach(_collSurplusPoolAddress);
    var tx = await collSurplusPool.setAddresses(
        _borrowerOperationsAddress,
        _troveManagerAddress,
        _troveManagerLiquidationsAddress,
        _troveManagerRedemptionsAddress,
        _activePoolAddress,
        _wethAddress
    );
    await tx.wait(); // wait mining
    console.log("CollSurplusPool set params success.");

    // DefaultPool set params
    const DefaultPool = await ethers.getContractFactory("DefaultPool");
    const defaultPool = await DefaultPool.attach(_defaultPoolAddress);
    var tx = await defaultPool.setAddresses(_troveManagerAddress, _activePoolAddress);
    await tx.wait(); // wait mining
    console.log("DefaultPool set params success.");

    // HintHelpers set params
    const HintHelpers = await ethers.getContractFactory("HintHelpers");
    const hintHelpers = await HintHelpers.attach(_hintHelpersAddress);
    var tx = await hintHelpers.setAddresses(
        _sortedTrovesAddress,
        _troveManagerAddress,
        _collateralManagerAddress
    );
    await tx.wait(); // wait mining
    console.log("HintHelpers set params success.");

    // // PriceFeed set params
    // const PriceFeed = await ethers.getContractFactory("PriceFeed");
    // const priceFeed = await PriceFeed.attach(_priceFeedAddress);
    // var tx = await priceFeed.setAddresses(
    //     _priceAggregatorAddress,
    //     _tellorCallerAddress
    // );
    // await tx.wait();    // wait mining
    // console.log("PriceFeed set params success.");

    // SortedTroves set params
    const SortedTroves = await ethers.getContractFactory("SortedTroves");
    const sortedTroves = await SortedTroves.attach(_sortedTrovesAddress);
    var tx = await sortedTroves.setParams(
        maxBytes32,
        _troveManagerAddress,
        _troveManagerRedemptionsAddress,
        _borrowerOperationsAddress
    );
    await tx.wait(); // wait mining
    console.log("SortedTroves set params success.");


    // StabilityPool set params
    const StabilityPool = await ethers.getContractFactory("StabilityPool");
    const stabilityPool = await StabilityPool.attach(_stabilityPoolAddress);
    var tx = await stabilityPool.setAddresses(
        _borrowerOperationsAddress,
        _troveManagerAddress,
        _collateralManagerAddress,
        _troveManagerLiquidationsAddress,
        _activePoolAddress,
        _usdeTokenAddress,
        _sortedTrovesAddress,
        _priceFeedAddress,
        _communityIssuanceAddress,
        _wethAddress
    );
    await tx.wait(); // wait mining
    console.log("StabilityPool set params success.");

    // TroveDebt set params
    const TroveDebt = await ethers.getContractFactory("TroveDebt");
    const troveDebt = await TroveDebt.attach(_troveDebtAddress);
    var tx = await troveDebt.setAddress(
        _troveManagerAddress
    );
    await tx.wait(); // wait mining
    console.log("TroveDebt set params success.");

    // TroveInterestRateStrategy set params
    const TroveInterestRateStrategy = await ethers.getContractFactory("TroveInterestRateStrategy");
    const troveInterestRateStrategy = await TroveInterestRateStrategy.attach(_troveInterestRateStrategyAddress);
    var tx = await troveInterestRateStrategy.setAddresses(
        _troveManagerAddress,
        _collateralManagerAddress,
        _troveDebtAddress,
        _activePoolAddress,
        _defaultPoolAddress,
        _stabilityPoolAddress,
        _priceFeedAddress
    );
    await tx.wait(); // wait mining
    console.log("TroveInterestRateStrategy set params success.");


    // TroveManager set params
    const TroveManager = await ethers.getContractFactory("TroveManager");
    const troveManager = await TroveManager.attach(_troveManagerAddress);
    var tx = await troveManager.setAddresses(
        _borrowerOperationsAddress,
        _activePoolAddress,
        _defaultPoolAddress,
        _stabilityPoolAddress,
        _gasPoolAddress,
        _collSurplusPoolAddress,
        _priceFeedAddress,
        _usdeTokenAddress,
        _sortedTrovesAddress,
        _troveManagerLiquidationsAddress,
        _troveManagerRedemptionsAddress,
        _collateralManagerAddress
    );
    await tx.wait(); // wait mining
    console.log("troveManager set params success.");

    // TroveManagerLiquidations set params
    const TroveManagerLiquidations = await ethers.getContractFactory("TroveManagerLiquidations");
    const troveManagerLiquidations = await TroveManagerLiquidations.attach(_troveManagerLiquidationsAddress);
    var tx = await troveManagerLiquidations.setAddresses(
        _borrowerOperationsAddress,
        _activePoolAddress,
        _defaultPoolAddress,
        _stabilityPoolAddress,
        _gasPoolAddress,
        _collSurplusPoolAddress,
        _priceFeedAddress,
        _usdeTokenAddress,
        _sortedTrovesAddress,
        _troveManagerAddress,
        _collateralManagerAddress
    );
    await tx.wait(); // wait mining
    var initTx = await troveManagerLiquidations.init(
        _troveDebtAddress
    );
    await initTx.wait();
    console.log("troveManagerLiquidations set params success.");

    // TroveManagerRedemptions set params
    const TroveManagerRedemptions = await ethers.getContractFactory("TroveManagerRedemptions");
    const troveManagerRedemptions = await TroveManagerRedemptions.attach(_troveManagerRedemptionsAddress);
    var tx = await troveManagerRedemptions.setAddresses(
        _borrowerOperationsAddress,
        _activePoolAddress,
        _defaultPoolAddress,
        _stabilityPoolAddress,
        _gasPoolAddress,
        _collSurplusPoolAddress,
        _priceFeedAddress,
        _usdeTokenAddress,
        _sortedTrovesAddress,
        _troveManagerAddress,
        _collateralManagerAddress
    );
    await tx.wait(); // wait mining
    var initTx = await troveManagerRedemptions.init(
        _troveDebtAddress
    );
    await initTx.wait();
    console.log("troveManagerRedemptions set params success.");

    // steth set testnet price
    const StETHOracleTestnet = await ethers.getContractFactory("StETHOracleTestnet");
    const stETHOracle = await StETHOracleTestnet.attach(_stETHOracleAddress);
    var tx = await stETHOracle.setPrice(ethers.utils.parseEther("1"));
    await tx.wait(); // wait mining

    const EETH = await ethers.getContractFactory("EToken");
    const eETH = await EETH.attach(_eETHAddress);
    var tx = await eETH.setAddresses(
        _collateralManagerAddress,
        _wethAddress
    );
    await tx.wait(); // wait mining

    const ESTETH = await ethers.getContractFactory("EToken");
    const eStETH = await ESTETH.attach(_eStETHAddress);
    var tx = await eStETH.setAddresses(
        _collateralManagerAddress,
        _stETHAddress
    );
    await tx.wait(); // wait mining

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});