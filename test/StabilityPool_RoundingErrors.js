const deploymentHelper = require("../utils/deploymentHelpersUpgrade.js")
const testHelpers = require("../utils/testHelpersUpgrade.js")
const {
  ethers
} = require("hardhat")
const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN

const ZERO_ADDRESS = th.ZERO_ADDRESS

contract('Pool Manager: Sum-Product rounding errors', async accounts => {

  const whale = accounts[0]

  let contracts

  let priceFeed
  let usdeToken
  let stabilityPool
  let troveManager
  let borrowerOperations
  withProxy = false

  const openTrove = async (params) => th.openTrove(contracts, params)

  beforeEach(async () => {
    contracts = await deploymentHelper.deployERDCore()

    priceFeedSTETH = contracts.priceFeedSTETH
    priceFeedETH = contracts.priceFeedETH
    priceFeed = priceFeedETH
    usdeToken = contracts.usdeToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers
    collateralManager = contracts.collateralManager

    treasury = contracts.treasury
    liquidityIncentive = contracts.liquidityIncentive
    communityIssuance = contracts.communityIssuance

    USDE_GAS_COMPENSATION = await borrowerOperations.USDE_GAS_COMPENSATION()
    MIN_NET_DEBT = await collateralManager.getMinNetDebt()
    BORROWING_FEE_FLOOR = await collateralManager.getBorrowingFeeFloor()
  })

  // skipped to not slow down CI
  it("Rounding errors: 100 deposits of 100USDE into SP, then 200 liquidations of 49USDE", async () => {
    // it.skip("Rounding errors: 100 deposits of 100USDE into SP, then 200 liquidations of 49USDE", async () => {
    const signers = await ethers.getSigners()
    const owner = signers[0]
    // const depositors = accounts.slice(1, 101)
    // const defaulters = accounts.slice(101, 301)
    const depositors = signers.slice(1, 10)
    const defaulters = signers.slice(11, 30)

    for (let depositor of depositors) {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: depositor,
        extraParams: {
          from: depositor.address
        }
      })
      await stabilityPool.connect(depositor).provideToSP(dec(100, 18), ZERO_ADDRESS, {
        from: depositor.address
      })
    }

    // Defaulter opens trove with 200% ICR
    for (let defaulter of defaulters) {
      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: defaulter,
        extraParams: {
          from: defaulter.address
        }
      })
    }

    // price drops by 50%: defaulter ICR falls to 100%
    await priceFeed.setPrice(dec(105, 18));

    // Defaulters liquidated
    for (let defaulter of defaulters) {
      await troveManager.liquidate(defaulter.address);
    }

    const SP_TotalDeposits = await stabilityPool.getTotalUSDEDeposits()
    const SP_ETH = await stabilityPool.getCollateralAmount(contracts.weth.address)
    const compoundedDeposit = await stabilityPool.getCompoundedUSDEDeposit(depositors[0].address)
    const ETH_Gain = await stabilityPool.getDepositorCollateralGain(depositors[0].address)

    // Check depostiors receive their share without too much error
    assert.isAtMost(th.getDifference(SP_TotalDeposits.div(th.toBN(depositors.length)), compoundedDeposit), 100000)
    assert.isAtMost(th.getDifference(SP_ETH.div(th.toBN(depositors.length)), ETH_Gain[1][0]), 100000)
  })
})

contract('Reset chain state', async accounts => {})