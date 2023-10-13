const {
  web3
} = require("hardhat")
const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const NonPayable = artifacts.require('NonPayable.sol')

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const TroveManagerTester = artifacts.require("TroveManagerTester")
const CollateralManagerTester = artifacts.require("CollateralManagerTester")
const USDEToken = artifacts.require("USDEToken")

contract('CollSurplusPool', async accounts => {
  const [
    owner,
    A, B, C, D, E
  ] = accounts;

  let borrowerOperations
  let collateralManager
  let priceFeed
  let collSurplusPool
  let weth
  let treasury
  let liquidityIncentive

  let contracts

  const getOpenTroveUSDEAmount = async (totalDebt) => th.getOpenTroveUSDEAmount(contracts, totalDebt)
  const openTrove = async (params) => th.openTrove(contracts, params)

  beforeEach(async () => {
    contracts = await deploymentHelper.deployERDCore()
    contracts.troveManager = await TroveManagerTester.new()
    contracts.collateralManager = await CollateralManagerTester.new()
    contracts.usdeToken = await USDEToken.new(
      contracts.troveManager.address,
      contracts.troveManagerLiquidations.address,
      contracts.troveManagerRedemptions.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address
    )
    const ERDContracts = await deploymentHelper.deployERDContracts()

    priceFeed = contracts.priceFeedETH
    collSurplusPool = contracts.collSurplusPool
    borrowerOperations = contracts.borrowerOperations
    weth = contracts.weth;
    collateralManager = contracts.collateralManager
    treasury = ERDContracts.treasury
    liquidityIncentive = ERDContracts.liquidityIncentive

    await deploymentHelper.connectCoreContracts(contracts, ERDContracts)
  })

  it("CollSurplusPool::getETH(): Returns the ETH balance of the CollSurplusPool after redemption", async () => {
    const ETH_1 = await collSurplusPool.getCollateralAmount(weth.address)
    assert.equal(ETH_1, '0')

    const price = toBN(dec(100, 18))
    await priceFeed.setPrice(price)

    const {
      collateral: B_coll,
      netDebt: B_netDebt
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraParams: {
        from: B
      }
    })

    await openTrove({
      extraUSDEAmount: B_netDebt.add(toBN(dec(500, 18))),
      extraParams: {
        from: A,
        value: dec(3000, 'ether')
      }
    })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)
    await contracts.troveManager.setBaseRate(toBN(dec(1, 16)))
    const debt_B = await contracts.troveDebt.balanceOf(B)
    // At ETH:USD = 100, this redemption should leave 1 ether of coll surplus
    await th.redeemCollateralAndGetTxObject(A, contracts, B_netDebt.add(toBN(dec(500, 18))))
    const fee = toBN(await contracts.weth.balanceOf(treasury.address))
    const ETH_2 = await collSurplusPool.getCollateralAmount(weth.address)
    th.assertIsApproximatelyEqual(ETH_2, B_coll.sub(debt_B.mul(mv._1e18BN).div(price)), toBN(dec(1, 12)))
  })

  it("CollSurplusPool: claimColl(): Reverts if caller is not Borrower Operations", async () => {
    // Caller is not Borrower Operations
    await th.assertRevert(collSurplusPool.claimColl(A, {
      from: A
    }), 'Caller_NotBO')
  })

  it("CollSurplusPool: claimColl(): Reverts if nothing to claim", async () => {
    // No collateral available to claim
    await th.assertRevert(borrowerOperations.claimCollateral({
      from: A
    }), 'CannotClaim')
  })

  it('CollSurplusPool: accountSurplus: reverts if caller is not Trove Manager', async () => {
    // Caller is not TML nor TMR
    await th.assertRevert(collSurplusPool.accountSurplus(A, [1]), 'Caller_NotTMLOrTMR')
  })
})

contract('Reset chain state', async accounts => {})