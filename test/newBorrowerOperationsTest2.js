const deploymentHelper = require("../utils/deploymentHelpersUpgrade.js")
const testHelpers = require("../utils/testHelpersUpgrade.js")

const th = testHelpers.TestHelper

const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const ZERO_ADDRESS = th.ZERO_ADDRESS
const assertRevert = th.assertRevert
const STETH_ADDRESS = ZERO_ADDRESS;

/* NOTE: Some of the borrowing tests do not test for specific USDE fee values. They only test that the
 * fees are non-zero when they should occur, and that they decay over time.
 *
 * Specific USDE fee values will depend on the final fee schedule used, and the final choice for
 *  the parameter MINUTE_DECAY_FACTOR in the TroveManager, which is still TBD based on economic
 * modelling.
 * 
 */

contract('BorrowerOperations', async accounts => {

  const [
    owner, alice, bob
  ] = accounts
  let
    Owner, Alice, Bob

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let priceFeed
  let usdeToken
  let sortedTroves
  let troveManager
  let collateralManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations
  let treasury
  let liquidityIncentive

  let contracts

  const getOpenTroveUSDEAmount = async (totalDebt) => th.getOpenTroveUSDEAmount(contracts, totalDebt)
  const getNetBorrowingAmount = async (debtWithFee) => th.getNetBorrowingAmount(contracts, debtWithFee)
  const getActualDebtFromComposite = async (compositeDebt) => th.getActualDebtFromComposite(compositeDebt, contracts)
  const getTroveEntireColl = async (trove) => th.getTroveEntireColl(contracts, trove)
  const getTroveEntireDebt = async (trove) => th.getTroveEntireDebt(contracts, trove)
  const getTroveStake = async (trove) => th.getTroveStake(contracts, trove)

  let USDE_GAS_COMPENSATION
  let MIN_NET_DEBT
  let BORROWING_FEE_FLOOR

  before(async () => {

  })

  const testCorpus = ({
    withProxy = false
  }) => {
    beforeEach(async () => {
      contracts = await deploymentHelper.deployERDCore()

      priceFeedSTETH = contracts.priceFeedSTETH
      priceFeed = contracts.priceFeedETH
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
      const signers = await ethers.getSigners()
      Owner = signers[0]
      Alice = signers[1]
      Bob = signers[2]
    })


    it("addColl(): reverts when top-up would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      await th.openTrove(contracts, {
        ICR: toBN(dec(2, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })
      await th.openTrove(contracts, {
        ICR: toBN(dec(10, 18)),
        signer: Bob,
        extraParams: {
          from: bob
        }
      })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isTrue((await th.getCurrentICR(contracts, alice)).lt(toBN(dec(110, 16))))

      const collTopUp = toBN(dec(1, 18)) // 1 wei top up
      // An operation that would result in ICR < MCR is not permitted
      await assertRevert(borrowerOperations.connect(Alice).addColl([], [], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
          from: alice,
          value: collTopUp
        }), //th.addColl(contracts, toBN(dec(collTopUp, 18), alice)),
        "ICRLessThanMCR")
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