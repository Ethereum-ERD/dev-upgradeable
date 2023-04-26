const deploymentHelpers = require("../utils/truffleDeploymentHelpers.js")
const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

// const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const TroveManagerTester = artifacts.require("TroveManagerTester")
const CollateralManagerTester = artifacts.require("CollateralManagerTester")

const deployERD = deploymentHelpers.deployERD
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN

const ZERO_ADDRESS = th.ZERO_ADDRESS

contract('Pool Manager: Sum-Product rounding errors', async accounts => {

  const whale = accounts[0]

  let contracts

  let priceFeed
  let eusdToken
  let stabilityPool
  let troveManager
  let borrowerOperations
  withProxy = false

  const openTrove = async (params) => th.openTrove(contracts, params)

  beforeEach(async () => {
    contracts = await deploymentHelper.deployERDCore()
    // contracts.borrowerOperations = await BorrowerOperationsTester.new()
    contracts.troveManager = await TroveManagerTester.new()
    contracts.collateralManager = await CollateralManagerTester.new()
    const ERDContracts = await deploymentHelper.deployERDTesterContractsHardhat()
    contracts = await deploymentHelper.deployEUSDTokenTester(contracts, ERDContracts)

    await deploymentHelper.connectCoreContracts(contracts, ERDContracts)

    if (withProxy) {
      const users = [alice, bob, carol, dennis, whale, A, B, C, D, E]
      await deploymentHelper.deployProxyScripts(contracts, ERDContracts, owner, users)
    }

    priceFeedSTETH = contracts.priceFeedSTETH
    priceFeedETH = contracts.priceFeedETH
    priceFeed = priceFeedETH
    eusdToken = contracts.eusdToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers
    collateralManager = contracts.collateralManager

    treasury = ERDContracts.treasury
    communityIssuance = ERDContracts.communityIssuance

    EUSD_GAS_COMPENSATION = await borrowerOperations.EUSD_GAS_COMPENSATION()
    MIN_NET_DEBT = await borrowerOperations.MIN_NET_DEBT()
    BORROWING_FEE_FLOOR = await collateralManager.getBorrowingFeeFloor()
  })

  // skipped to not slow down CI
  it("Rounding errors: 100 deposits of 100EUSD into SP, then 200 liquidations of 49EUSD", async () => {
    // it.skip("Rounding errors: 100 deposits of 100EUSD into SP, then 200 liquidations of 49EUSD", async () => {
    const owner = accounts[0]
    // const depositors = accounts.slice(1, 101)
    // const defaulters = accounts.slice(101, 301)
    const depositors = accounts.slice(1, 10)
    const defaulters = accounts.slice(11, 30)

    for (let account of depositors) {
      await openTrove({
        extraEUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: account
        }
      })
      await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, {
        from: account
      })
    }

    // Defaulter opens trove with 200% ICR
    for (let defaulter of defaulters) {
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: defaulter
        }
      })
    }

    // price drops by 50%: defaulter ICR falls to 100%
    await priceFeed.setPrice(dec(105, 18));

    // Defaulters liquidated
    for (let defaulter of defaulters) {
      await troveManager.liquidate(defaulter, {
        from: owner
      });
    }

    const SP_TotalDeposits = await stabilityPool.getTotalEUSDDeposits()
    const SP_ETH = await stabilityPool.getCollateralAmount(contracts.weth.address)
    const compoundedDeposit = await stabilityPool.getCompoundedEUSDDeposit(depositors[0])
    const ETH_Gain = await stabilityPool.getDepositorCollateralGain(depositors[0])

    // Check depostiors receive their share without too much error
    assert.isAtMost(th.getDifference(SP_TotalDeposits.div(th.toBN(depositors.length)), compoundedDeposit), 100000)
    assert.isAtMost(th.getDifference(SP_ETH.div(th.toBN(depositors.length)), ETH_Gain[1][0]), 100000)
  })
})

contract('Reset chain state', async accounts => {})