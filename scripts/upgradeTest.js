// scripts/upgrade-box.js
const { ethers, upgrades } = require("hardhat");

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
const _troveDebtAddress = deploy.troveDebt;
const _troveInterestRateStrategyAddress = deploy.troveInterestRateStrategy;
const _troveManagerAddress = deploy.troveManager;
const _troveManagerLiquidationsAddress = deploy.troveManagerLiquidations;
const _troveManagerRedemptionsAddress = deploy.troveManagerRedemptions;
const _multiTroveGetterAddress = deploy.multiTroveGetter;
const _eusdTokenAddress = deploy.eusdToken;

async function main() {
  const ActivePoolV2 = await ethers.getContractFactory("ActivePoolV2");
  const activePoolV2 = await upgrades.upgradeProxy(_activePoolAddress, ActivePoolV2);
  console.log("ActivePool upgraded");
  let version = await activePoolV2.version();
  console.log("version", version)

//   // code too large
//   const BorrowerOperationsV2 = await ethers.getContractFactory("BorrowerOperationsV2");
//   const borrowerOperationsV2 = await upgrades.upgradeProxy(_borrowerOperationsAddress, BorrowerOperationsV2);
//   console.log("BorrowerOperations upgraded");
//   version = await borrowerOperationsV2.version();
//   console.log("version", version)

  const CollateralManagerV2 = await ethers.getContractFactory("CollateralManagerV2");
  const collateralManagerV2 = await upgrades.upgradeProxy(_collateralManagerAddress, CollateralManagerV2);
  console.log("CollateralManager upgraded");
  version = await collateralManagerV2.version();
  console.log("version", version)

  const CollSurplusPoolV2 = await ethers.getContractFactory("CollSurplusPoolV2");
  const collSurplusPoolV2 = await upgrades.upgradeProxy(_collSurplusPoolAddress, CollSurplusPoolV2);
  console.log("CollSurplusPool upgraded");
  version = await collSurplusPoolV2.version();
  console.log("version", version)

  const DefaultPoolV2 = await ethers.getContractFactory("DefaultPoolV2");
  const defaultPoolV2 = await upgrades.upgradeProxy(_defaultPoolAddress, DefaultPoolV2);
  console.log("DefaultPool upgraded");
  version = await defaultPoolV2.version();
  console.log("version", version)

  const HintHelpersV2 = await ethers.getContractFactory("HintHelpersV2");
  const hintHelpersV2 = await upgrades.upgradeProxy(_hintHelpersAddress, HintHelpersV2);
  console.log("HintHelpers upgraded");
  version = await hintHelpersV2.version();
  console.log("version", version)

  const SortedTrovesV2 = await ethers.getContractFactory("SortedTrovesV2");
  const sortedTrovesV2 = await upgrades.upgradeProxy(_sortedTrovesAddress, SortedTrovesV2);
  console.log("SortedTroves upgraded");
  version = await sortedTrovesV2.version();
  console.log("version", version)

  const StabilityPoolV2 = await ethers.getContractFactory("StabilityPoolV2");
  const stabilityPoolV2 = await upgrades.upgradeProxy(_stabilityPoolAddress, StabilityPoolV2);
  console.log("StabilityPool upgraded");
  version = await stabilityPoolV2.version();
  console.log("version", version)

  const TroveDebtV2 = await ethers.getContractFactory("TroveDebtV2");
  const troveDebtV2 = await upgrades.upgradeProxy(_troveDebtAddress, TroveDebtV2);
  console.log("TroveDebt upgraded");
  version = await troveDebtV2.version();
  console.log("version", version)

  const TroveInterestRateStrategyV2 = await ethers.getContractFactory("TroveInterestRateStrategyV2");
  const troveInterestRateStrategyV2 = await upgrades.upgradeProxy(_troveInterestRateStrategyAddress, TroveInterestRateStrategyV2);
  console.log("TroveInterestRateStrategy upgraded");
  version = await troveInterestRateStrategyV2.version();
  console.log("version", version)

  const TroveManagerV2 = await ethers.getContractFactory("TroveManagerV2");
  const troveManagerV2 = await upgrades.upgradeProxy(_troveManagerAddress, TroveManagerV2);
  console.log("TroveManager upgraded");
  version = await troveManagerV2.version();
  console.log("version", version)

  const TroveManagerLiquidationsV2 = await ethers.getContractFactory("TroveManagerLiquidationsV2");
  const troveManagerLiquidationsV2 = await upgrades.upgradeProxy(_troveManagerLiquidationsAddress, TroveManagerLiquidationsV2);
  console.log("TroveManagerLiquidations upgraded");
  version = await troveManagerLiquidationsV2.version();
  console.log("version", version)

  const TroveManagerRedemptionsV2 = await ethers.getContractFactory("TroveManagerRedemptionsV2");
  const troveManagerRedemptionsV2 = await upgrades.upgradeProxy(_troveManagerRedemptionsAddress, TroveManagerRedemptionsV2);
  console.log("TroveManagerRedemptions upgraded");
  version = await troveManagerRedemptionsV2.version();
  console.log("version", version)

  const MultiTroveGetterV2 = await ethers.getContractFactory("MultiTroveGetterV2");
  const multiTroveGetterV2 = await upgrades.upgradeProxy(_multiTroveGetterAddress, MultiTroveGetterV2);
  console.log("MultiTroveGetter upgraded");
  version = await multiTroveGetterV2.version();
  console.log("version", version)

  const EUSDTokenV2 = await ethers.getContractFactory("EUSDTokenV2");
  const eusdTokenV2 = await upgrades.upgradeProxy(_eusdTokenAddress, EUSDTokenV2);
  console.log("EUSDToken upgraded");
  version = await eusdTokenV2.versionUp();
  console.log("version", version)

  const TreasuryV2 = await ethers.getContractFactory("TreasuryV2");
  const treasuryV2 = await upgrades.upgradeProxy(_treasuryAddress, TreasuryV2);
  console.log("Treasury upgraded");
  version = await treasuryV2.version();
  console.log("version", version)

  const CommunityIssuanceV2 = await ethers.getContractFactory("CommunityIssuanceV2");
  const communityIssuanceV2 = await upgrades.upgradeProxy(_communityIssuanceAddress, CommunityIssuanceV2);
  console.log("CommunityIssuance upgraded");
  version = await communityIssuanceV2.version();
  console.log("version", version)
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});