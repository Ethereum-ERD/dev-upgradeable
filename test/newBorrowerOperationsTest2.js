const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

// const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const NonPayable = artifacts.require('NonPayable.sol')
const TroveManagerTester = artifacts.require("TroveManagerTester")
const CollateralManagerTester = artifacts.require("CollateralManagerTester")
const EUSDTokenTester = artifacts.require("./EUSDTokenTester")

const th = testHelpers.TestHelper

const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const ZERO_ADDRESS = th.ZERO_ADDRESS
const assertRevert = th.assertRevert
const STETH_ADDRESS = ZERO_ADDRESS;

/* NOTE: Some of the borrowing tests do not test for specific EUSD fee values. They only test that the
 * fees are non-zero when they should occur, and that they decay over time.
 *
 * Specific EUSD fee values will depend on the final fee schedule used, and the final choice for
 *  the parameter MINUTE_DECAY_FACTOR in the TroveManager, which is still TBD based on economic
 * modelling.
 * 
 */

contract('BorrowerOperations', async accounts => {

  const [
    owner, alice, bob, carol, dennis, whale,
    A, B, C, D, E, F, G, H,
    // defaulter_1, defaulter_2,
    frontEnd_1, frontEnd_2, frontEnd_3
  ] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let priceFeed
  let eusdToken
  let sortedTroves
  let troveManager
  let collateralManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations
  let treasury

  let contracts

  const getOpenTroveEUSDAmount = async (totalDebt) => th.getOpenTroveEUSDAmount(contracts, totalDebt)
  const getNetBorrowingAmount = async (debtWithFee) => th.getNetBorrowingAmount(contracts, debtWithFee)
  const getActualDebtFromComposite = async (compositeDebt) => th.getActualDebtFromComposite(compositeDebt, contracts)
  const getTroveEntireColl = async (trove) => th.getTroveEntireColl(contracts, trove)
  const getTroveEntireDebt = async (trove) => th.getTroveEntireDebt(contracts, trove)
  const getTroveStake = async (trove) => th.getTroveStake(contracts, trove)

  let EUSD_GAS_COMPENSATION
  let MIN_NET_DEBT
  let BORROWING_FEE_FLOOR

  before(async () => {

  })

  const testCorpus = ({
    withProxy = false
  }) => {
    beforeEach(async () => {
      contracts = await deploymentHelper.deployERDCore()
      // contracts.borrowerOperations = await BorrowerOperationsTester.new()
      contracts.troveManager = await TroveManagerTester.new()
      contracts.collateralManager = await CollateralManagerTester.new()
      contracts = await deploymentHelper.deployEUSDTokenTester(contracts)
      const ERDContracts = await deploymentHelper.deployERDTesterContractsHardhat()

      await deploymentHelper.connectCoreContracts(contracts, ERDContracts)

      if (withProxy) {
        const users = [alice, bob, carol, dennis, whale, A, B, C, D, E]
        await deploymentHelper.deployProxyScripts(contracts, ERDContracts, owner, users)
      }

      priceFeedSTETH = contracts.priceFeedSTETH
      priceFeed = contracts.priceFeedETH
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


    it("addColl(): reverts when top-up would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      await th.openTrove(contracts, {
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await th.openTrove(contracts, {
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: bob
        }
      })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isTrue((await th.getCurrentICR(contracts, alice)).lt(toBN(dec(110, 16))))

      const collTopUp = toBN(dec(1, 18)) // 1 wei top up

      await assertRevert(borrowerOperations.addColl([], [], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
          from: alice,
          value: collTopUp
        }), //th.addColl(contracts, toBN(dec(collTopUp, 18), alice)),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })
  }
  describe('Without proxy', async () => {
    testCorpus({
      withProxy: false
    })
  })

  // describe('With proxy', async () => {
  //   testCorpus({ withProxy: true })
  // })
})

contract('Reset chain state', async accounts => {})