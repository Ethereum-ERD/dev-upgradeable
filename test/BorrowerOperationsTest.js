const {
  assert
} = require("chai")
const {
  web3
} = require("hardhat")
const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

// const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const NonPayable = artifacts.require('NonPayable.sol')
const TroveManagerTester = artifacts.require("TroveManagerTester")
const CollateralManagerTester = artifacts.require("CollateralManagerTester")
const USDETokenTester = artifacts.require("./USDETokenTester")

const th = testHelpers.TestHelper

const dec = th.dec
const toBN = th.toBN
const toEther = th.makeEther
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const _1e14BN = toBN(dec(1, 14))
const _1e10BN = toBN(dec(1, 10))
const ZERO_ADDRESS = th.ZERO_ADDRESS
const assertRevert = th.assertRevert

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
    owner, alice, bob, carol, dennis, whale,
    A, B, C, D, E, F, G, H,
    // defaulter_1, defaulter_2,
    frontEnd_1, frontEnd_2, frontEnd_3
  ] = accounts;

  let priceFeed
  let usdeToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations
  let treasury
  let liquidityIncentive
  let collateralManager

  let contracts

  const getOpenTroveUSDEAmount = async (totalDebt) => th.getOpenTroveUSDEAmount(contracts, totalDebt)
  const getNetBorrowingAmount = async (debtWithFee) => th.getNetBorrowingAmount(contracts, debtWithFee)
  const getActualDebtFromComposite = async (compositeDebt) => th.getActualDebtFromComposite(compositeDebt, contracts)
  const openTrove = async (params) => th.openTrove(contracts, params)
  const getTroveEntireColl = async (trove) => th.getTroveEntireColl(contracts, trove)
  const getTroveEntireDebt = async (trove) => th.getTroveEntireDebt(contracts, trove)
  const getTroveStake = async (trove) => th.getTroveStake(contracts, trove)
  const getScaledDebt = async (trove) => th.getScaledDebt(contracts, trove)

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
      // contracts.borrowerOperations = await BorrowerOperationsTester.new()
      contracts.troveManager = await TroveManagerTester.new()
      contracts.collateralManager = await CollateralManagerTester.new()
      const ERDContracts = await deploymentHelper.deployERDTesterContractsHardhat()
      contracts = await deploymentHelper.deployUSDETokenTester(contracts, ERDContracts)

      await deploymentHelper.connectCoreContracts(contracts, ERDContracts)

      if (withProxy) {
        const users = [alice, bob, carol, dennis, whale, A, B, C, D, E]
        await deploymentHelper.deployProxyScripts(contracts, ERDContracts, owner, users)
      }

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

      treasury = ERDContracts.treasury
      liquidityIncentive = ERDContracts.liquidityIncentive
      communityIssuance = ERDContracts.communityIssuance

      USDE_GAS_COMPENSATION = await borrowerOperations.USDE_GAS_COMPENSATION()
      MIN_NET_DEBT = await collateralManager.getMinNetDebt()
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

      const collTopUp = toBN(dec(1, 18)) // 1 ether top up
      
      await assertRevert(borrowerOperations.addColl([], [], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
          from: alice,
          value: collTopUp
        }),
        "18") // An operation that would result in ICR < MCR is not permitted
    })

    it("addColl(): Increases the activePool ETH and raw ether balance by correct amount", async () => {
      const {
        collateral: aliceColl
      } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })

      const activePool_ETH_Before = await activePool.getCollateralAmount(contracts.weth.address)
      const activePool_RawEther_Before = toBN(await contracts.weth.balanceOf(activePool.address))

      assert.isTrue(activePool_ETH_Before.eq(aliceColl))
      assert.isTrue(activePool_RawEther_Before.eq(aliceColl))

      const collTopUp = toBN(dec(1, 18)) // 1 ether top up
      await borrowerOperations.addColl([], [], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
        from: alice,
        value: collTopUp
      })

      const activePool_ETH_After = await activePool.getCollateralAmount(contracts.weth.address)
      const activePool_RawEther_After = toBN(await contracts.weth.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_After.eq(aliceColl.add(toBN(dec(1, 'ether')))))
      assert.isTrue(activePool_RawEther_After.eq(aliceColl.add(toBN(dec(1, 'ether')))))
    })

    it("addColl(), active Trove: adds the correct collateral amount to the Trove", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      const coll_before = await troveManager.getTroveColls(alice)
      const status_Before = await troveManager.getTroveStatus(alice)

      // check status before
      assert.equal(status_Before, 1)

      // Alice adds second collateral
      const collTopUp = toBN(dec(1, 18)) // 1 ether top up

      await borrowerOperations.addColl([], [], alice, alice, {
        from: alice,
        value: collTopUp
      })

      const coll_After = await troveManager.getTroveColls(alice)
      const status_After = await troveManager.getTroveStatus(alice)
      // check coll increases by correct amount,and status remains active
      assert.isTrue(coll_After[0][0].eq(coll_before[0][0].add(toBN(dec(1, 'ether')))))
      assert.equal(status_After, 1)
    })

    it("addColl(), active Trove: Trove is in sortedList before and after", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })

      // check Alice is in list before
      const aliceTroveInList_Before = await sortedTroves.contains(alice)
      const listIsEmpty_Before = await sortedTroves.isEmpty()
      assert.equal(aliceTroveInList_Before, true)
      assert.equal(listIsEmpty_Before, false)

      const collTopUp = toBN(dec(1, 18)) // 1 wei top up

      await borrowerOperations.addColl([], [], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
        from: alice,
        value: collTopUp
      })

      // check Alice is still in list after
      const aliceTroveInList_After = await sortedTroves.contains(alice)
      const listIsEmpty_After = await sortedTroves.isEmpty()
      assert.equal(aliceTroveInList_After, true)
      assert.equal(listIsEmpty_After, false)
    })

    it("addColl(), active Trove: updates the stake and updates the total stakes", async () => {
      //  Alice creates initial Trove with 1 ether
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })

      const alice_Stake_Before = await troveManager.getTroveStake(alice, contracts.weth.address)
      const totalStakes_Before = (await troveManager.totalStakes(contracts.weth.address))

      assert.isTrue(totalStakes_Before.eq(alice_Stake_Before))

      // Alice tops up Trove collateral with 2 ether
      const collTopUp = toBN(dec(2, 18)) // 1 wei top up

      await borrowerOperations.addColl([], [], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
        from: alice,
        value: collTopUp
      })

      // Check stake and total stakes get updated
      const alice_Stake_After = await troveManager.getTroveStake(alice, contracts.weth.address)
      const totalStakes_After = (await troveManager.totalStakes(contracts.weth.address))

      assert.isTrue(alice_Stake_After.eq(alice_Stake_Before.add(toBN(dec(2, 'ether')))))
      assert.isTrue(totalStakes_After.eq(totalStakes_Before.add(toBN(dec(2, 'ether')))))
    })

    it("addColl(), active Trove: applies pending rewards and updates user's E_ETH, E_USDEDebt snapshots", async () => {
      // --- SETUP ---
      const {
        collateral: bobCollBefore,
        totalDebt: bobDebtBefore
      } = await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })
      const {
        collateral: aliceCollBefore,
        totalDebt: aliceDebtBefore
      } = await openTrove({
        extraUSDEAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: carol
        }
      })

      // --- TEST ---

      // price drops to 1ETH:100USDE, reducing Carol's ICR below MCR
      await priceFeed.setPrice('100000000000000000000');

      // Liquidate Carol's Trove,
      const tx = await troveManager.liquidate(carol, {
        from: owner
      });

      assert.isFalse(await sortedTroves.contains(carol))

      const E_ETH = await troveManager.E_Coll(contracts.weth.address)
      const E_USDEDebt = await troveManager.E_USDEDebt(contracts.weth.address)

      const alice_ETHrewardSnapshot_Before = await troveManager.getRewardSnapshotColl(alice, contracts.weth.address)
      const alice_USDEDebtRewardSnapshot_Before = await troveManager.getRewardSnapshotUSDE(alice, contracts.weth.address)

      const bob_ETHrewardSnapshot_Before = await troveManager.getRewardSnapshotColl(bob, contracts.weth.address)
      const bob_USDEDebtRewardSnapshot_Before = await troveManager.getRewardSnapshotUSDE(bob, contracts.weth.address)

      assert.equal(alice_ETHrewardSnapshot_Before, 0)
      assert.equal(alice_USDEDebtRewardSnapshot_Before, 0)
      assert.equal(bob_ETHrewardSnapshot_Before, 0)
      assert.equal(bob_USDEDebtRewardSnapshot_Before, 0)

      const alicePendingETHReward = (await troveManager.getPendingCollReward(alice))[1][0]
      const bobPendingETHReward = (await troveManager.getPendingCollReward(bob))[1][0]
      const alicePendingUSDEDebtReward = await troveManager.getPendingUSDEDebtReward(alice)
      const bobPendingUSDEDebtReward = await troveManager.getPendingUSDEDebtReward(bob)
      for (reward of [alicePendingETHReward, bobPendingETHReward, alicePendingUSDEDebtReward, bobPendingUSDEDebtReward]) {
        assert.isTrue(reward.gt(toBN('0')))
      }

      // Alice and Bob top up their Troves
      const aliceTopUp = toBN(dec(5, 'ether'))

      await borrowerOperations.addColl([], [], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
        from: alice,
        value: aliceTopUp
      })

      const bobTopUp = toBN(dec(1, 'ether'))

      await borrowerOperations.addColl([], [], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
        from: bob,
        value: bobTopUp
      })

      const aliceNewColl = toBN((await getTroveEntireColl(alice))[0])
      const aliceNewDebt = await getTroveEntireDebt(alice)
      const bobNewColl = toBN((await getTroveEntireColl(bob))[0])
      const bobNewDebt = await getTroveEntireDebt(bob)

      assert.isTrue(aliceNewColl.eq(aliceCollBefore.add(alicePendingETHReward).add(aliceTopUp)))
      assert.isTrue(aliceNewDebt.gt(aliceDebtBefore.add(alicePendingUSDEDebtReward)))
      assert.isTrue(bobNewColl.eq(bobCollBefore.add(bobPendingETHReward).add(bobTopUp)))
      assert.isTrue(bobNewDebt.gt(bobDebtBefore.add(bobPendingUSDEDebtReward)))


      /* Check that both Alice and Bob's snapshots of the rewards-per-unit-staked metrics should be updated
       to the latest values of E_ETH and E_USDEDebt */
      const alice_ETHrewardSnapshot_After = await troveManager.getRewardSnapshotColl(alice, contracts.weth.address)
      const alice_USDEDebtRewardSnapshot_After = await troveManager.getRewardSnapshotUSDE(alice, contracts.weth.address)

      const bob_ETHrewardSnapshot_After = await troveManager.getRewardSnapshotColl(bob, contracts.weth.address)
      const bob_USDEDebtRewardSnapshot_After = await troveManager.getRewardSnapshotUSDE(bob, contracts.weth.address)

      assert.isAtMost(th.getDifference(alice_ETHrewardSnapshot_After, E_ETH), 100)
      assert.isAtMost(th.getDifference(alice_USDEDebtRewardSnapshot_After, E_USDEDebt), 100)
      assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot_After, E_ETH), 100)
      assert.isAtMost(th.getDifference(bob_USDEDebtRewardSnapshot_After, E_USDEDebt), 100)
    })

    it("addColl(), active Trove: adds the right corrected stake after liquidations have occured", async () => {
      // --- SETUP ---
      // A,B,C add 15/5/5 ETH, withdraw 100/100/900 USDE
      await borrowerOperations.openTrove([], [], th._100pct, dec(2000, 18), alice, alice, {
        from: alice,
        value: dec(150, 'ether')
      })
      await borrowerOperations.openTrove([], [], th._100pct, dec(2000, 18), bob, bob, {
        from: bob,
        value: dec(40, 'ether')
      })
      await borrowerOperations.openTrove([], [], th._100pct, dec(5000, 18), carol, carol, {
        from: carol,
        value: dec(50, 'ether')
      })

      await borrowerOperations.openTrove([], [], th._100pct, dec(5000, 18), dennis, dennis, {
        from: dennis,
        value: dec(100, 'ether')
      })
      // --- TEST ---

      // price drops to 1ETH:100USDE, reducing Carol's ICR below MCR
      await priceFeed.setPrice('100000000000000000000');

      const troveAmounts = await troveManager.getCurrentTroveAmounts(carol)

      const debtAndColl = await troveManager.getEntireDebtAndColl(carol)
      const dennis_stake_before = await troveManager.getTroveStake(dennis, contracts.weth.address)
      // close Carol's Trove, liquidating her 5 ether and 900USDE.
      await troveManager.liquidate(carol, {
        from: owner
      });

      // dennis tops up his trove by 1 ETH
      await borrowerOperations.addColl([], [], dennis, dennis, {
        from: dennis,
        value: dec(1, 'ether')
      })

      /* Check that Dennis's recorded stake is the right corrected stake, less than his collateral. A corrected 
      stake is given by the formula: 

      s = totalStakesSnapshot / totalCollateralSnapshot 

      where snapshots are the values immediately after the last liquidation.  After Carol's liquidation, 
      the ETH from her Trove has now become the totalPendingETHReward. So:

      totalStakes = (alice_Stake + bob_Stake + dennis_orig_stake ) = (15 + 4 + 1) =  20 ETH.
      totalCollateral = (alice_Collateral + bob_Collateral + dennis_orig_coll + totalPendingETHReward) = (15 + 4 + 1 + 5)  = 25 ETH.

      Therefore, as Dennis adds 1 ether collateral, his corrected stake should be:  s = 2 * (20 / 25 ) = 1.6 ETH */
      const dennis_stake_after = await troveManager.getTroveStake(dennis, contracts.weth.address)

      assert.isTrue(dennis_stake_after.gt(dennis_stake_before))
    })

    it("addColl(), reverts if trove is non-existent or closed", async () => {
      // A, B open troves
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })

      // Carol attempts to add collateral to her non-existent trove
      try {
        const collTopUp = toBN(dec(1, 18))
        let txCarol = await borrowerOperations.addColl([], [], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
          from: carol,
          value: collTopUp
        })
        assert.isFalse(txCarol.receipt.status)
      } catch (error) {
        // Trove does not exist or is closed
        assert.include(error.message, "revert")
        assert.include(error.message, "15")
      }

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      // Bob gets liquidated
      await troveManager.liquidate(bob)

      assert.isFalse(await sortedTroves.contains(bob))

      // Bob attempts to add collateral to his closed trove
      try {
        const collTopUp = toBN(dec(1, 18))
        let txBob = await borrowerOperations.addColl([], [], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
          from: bob,
          value: collTopUp
        })
        assert.isFalse(txBob.receipt.status)
      } catch (error) {
        // Trove does not exist or is closed
        assert.include(error.message, "revert")
        assert.include(error.message, "15")
      }
    })

    it('addColl(): can add collateral in Recovery Mode', async () => {
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      const coll_before = toBN((await (getTroveEntireColl(alice)))[0])
      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice('105000000000000000000')
      assert.isTrue(await th.checkRecoveryMode(contracts))

      const collTopUp = toBN(dec(1, 18))
      let txCarol = await borrowerOperations.addColl([], [], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
        from: alice,
        value: collTopUp
      })

      // Check Alice's collateral
      const coll_After = await troveManager.getTroveColl(alice, contracts.weth.address)
      assert.isTrue(coll_After[0].eq(coll_before.add(toBN(dec(1, 'ether')))))
    })

    // --- withdrawColl() ---

    it("withdrawColl(): reverts when withdrawal would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: bob
        }
      })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isTrue((await th.getCurrentICR(contracts, alice)).lt(toBN(dec(110, 16))))

      const collWithdrawal = toBN(dec(1, 1)) // 1 wei withdrawal

      await assertRevert(borrowerOperations.withdrawColl([contracts.weth.address], [collWithdrawal], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
          from: alice
        }),
        "18") // An operation that would result in ICR < MCR is not permitted
    })

    // // reverts when calling address does not have active trove  
    // it("withdrawColl(): reverts when calling address does not have active trove", async () => {
    //   await openTrove({
    //     extraUSDEAmount: toBN(dec(10000, 18)),
    //     ICR: toBN(dec(2, 18)),
    //     extraParams: {
    //       from: alice
    //     }
    //   })
    //   await openTrove({
    //     extraUSDEAmount: toBN(dec(10000, 18)),
    //     ICR: toBN(dec(2, 18)),
    //     extraParams: {
    //       from: bob
    //     }
    //   })

    //   // Bob successfully withdraws some coll
    //   const txBob = await borrowerOperations.withdrawColl([contracts.weth.address], [toBN(dec(1, 'finney'))], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
    //     from: bob
    //   })
    //   assert.isTrue(txBob.receipt.status)
    //   // Carol with no active trove attempts to withdraw
    //   try {
    //     const txCarol = await borrowerOperations.withdrawColl([contracts.weth.address], [dec(100, 'ether')], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
    //       from: carol
    //     })
    //     assert.isFalse(txCarol.receipt.status)
    //   } catch (err) {
    //     assert.include(err.message, "revert")
    //   }
    // })

    // it("withdrawColl(): reverts when system is in Recovery Mode", async () => {
    //   await openTrove({
    //     ICR: toBN(dec(2, 18)),
    //     extraParams: {
    //       from: alice
    //     }
    //   })
    //   await openTrove({
    //     ICR: toBN(dec(2, 18)),
    //     extraParams: {
    //       from: bob
    //     }
    //   })

    //   assert.isFalse(await th.checkRecoveryMode(contracts))

    //   // Withdrawal possible when recoveryMode == false
    //   const txAlice = await borrowerOperations.withdrawColl([contracts.weth.address], [toBN(1000)], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
    //     from: alice
    //   })
    //   assert.isTrue(txAlice.receipt.status)

    //   await priceFeed.setPrice('105000000000000000000')

    //   assert.isTrue(await th.checkRecoveryMode(contracts))

    //   //Check withdrawal impossible when recoveryMode == true
    //   try {
    //     const txBob = await borrowerOperations.withdrawColl([contracts.weth.address], [toBN(1000)], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
    //       from: bob
    //     })
    //     assert.isFalse(txBob.receipt.status)
    //   } catch (err) {
    //     assert.include(err.message, "revert")
    //   }
    // })

    it("withdrawColl(): reverts when requested ETH withdrawal is > the trove's collateral", async () => {
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: carol
        }
      })

      const carolColl = (await getTroveEntireColl(carol))[0]
      const bobColl = (await getTroveEntireColl(bob))[0]
      // Carol withdraws exactly all her collateral
      await assertRevert(
        borrowerOperations.withdrawColl([contracts.weth.address], [toBN(carolColl)], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
          from: carol
        }),
        '18'
      ) // An operation that would result in ICR < MCR is not permitted

      // Bob attempts to withdraw 1 wei more than his collateral
      try {
        const txBob = await borrowerOperations.withdrawColl([contracts.weth.address], [bobColl.add(toBN(1))], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
          from: bob
        })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    // it("withdrawColl(): reverts when withdrawal would bring the user's ICR < MCR", async () => {
    //   await openTrove({
    //     ICR: toBN(dec(10, 18)),
    //     extraParams: {
    //       from: whale
    //     }
    //   })

    //   await openTrove({
    //     ICR: toBN(dec(11, 17)),
    //     extraParams: {
    //       from: bob
    //     }
    //   }) // 110% ICR

    //   // Bob attempts to withdraws 1 wei, Which would leave him with < 110% ICR.

    //   try {
    //     const txBob = await borrowerOperations.withdrawColl([contracts.weth.address], [toBN(1)], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
    //       from: bob
    //     })
    //     assert.isFalse(txBob.receipt.status)
    //   } catch (err) {
    //     assert.include(err.message, "revert")
    //   }
    // })

    // it("withdrawColl(): reverts if system is in Recovery Mode", async () => {
    //   // --- SETUP ---

    //   // A and B open troves at 130% ICR
    //   await openTrove({
    //     ICR: toBN(dec(131, 17)),
    //     extraParams: {
    //       from: bob
    //     }
    //   })
    //   await openTrove({
    //     ICR: toBN(dec(131, 17)),
    //     extraParams: {
    //       from: alice
    //     }
    //   })

    //   const TCR = await th.getTCR(contracts)
    //   // console.log(TCR)
    //   assert.isTrue(TCR.gt(toBN(dec(130, 16))))

    //   // --- TEST ---

    //   // price drops to 1ETH:190USDE, reducing TCR below 130%
    //   await priceFeed.setPrice('19000000000000000000');
    //   // Alice tries to withdraw collateral during Recovery Mode
    //   try {
    //     const txData = await borrowerOperations.withdrawColl([contracts.weth.address], [toBN(1)], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
    //       from: alice
    //     })
    //     assert.isFalse(txData.receipt.status)
    //   } catch (err) {
    //     assert.include(err.message, 'revert')
    //   }
    // })

    it("withdrawColl(): doesn't allow a user to completely withdraw all collateral from their Trove (due to gas compensation)", async () => {
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })

      const aliceColls = await th.getTroveEntireColl(contracts, alice)
      const aliceDebt = await th.getTroveEntireDebt(contracts, alice)

      const aliceColl = aliceColls[0]

      // Check Trove is active
      const status_Before = await troveManager.getTroveStatus(alice)
      assert.equal(status_Before, 1)
      assert.isTrue(await sortedTroves.contains(alice))

      // Alice attempts to withdraw all collateral
      await assertRevert(
        borrowerOperations.withdrawColl([contracts.weth.address], [toBN(aliceColl)], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
          from: alice
        }),
        '18'
      ) // An operation that would result in ICR < MCR is not permitted
    })

    // it("withdrawColl(): leaves the Trove active when the user withdraws less than all the collateral", async () => {
    //   // Open Trove 
    //   await openTrove({
    //     ICR: toBN(dec(2, 18)),
    //     extraParams: {
    //       from: alice
    //     }
    //   })

    //   // Check Trove is active
    //   const status_Before = await troveManager.getTroveStatus(alice)
    //   assert.equal(status_Before, 1)
    //   assert.isTrue(await sortedTroves.contains(alice))

    //   // Withdraw some collateral
    //   await borrowerOperations.withdrawColl([contracts.weth.address], [toBN(dec(100, 'finney'))], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
    //     from: alice
    //   })

    //   // Check Trove is still active
    //   const status_After = await troveManager.getTroveStatus(alice)
    //   assert.equal(status_After, 1)
    //   assert.isTrue(await sortedTroves.contains(alice))
    // })

    // it("withdrawColl(): reduces the Trove's collateral by the correct amount", async () => {
    //   await openTrove({
    //     ICR: toBN(dec(2, 18)),
    //     extraParams: {
    //       from: alice
    //     }
    //   })
    //   const aliceCollBefore = (await getTroveEntireColl(alice))[0]

    //   // Alice withdraws 1 ether
    //   await borrowerOperations.withdrawColl([contracts.weth.address], [toBN(dec(1, 'ether'))], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
    //     from: alice
    //   })

    //   // Check 1 ether remaining
    //   const aliceCollAfter = (await getTroveEntireColl(alice))[0]

    //   assert.isTrue(toBN(aliceCollAfter).eq(toBN(aliceCollBefore).sub(toBN(dec(1, 'ether')))))
    // })

    // it("withdrawColl(): reduces ActivePool ETH and raw ether by correct amount", async () => {
    //   await openTrove({
    //     ICR: toBN(dec(2, 18)),
    //     extraParams: {
    //       from: alice
    //     }
    //   })
    //   const aliceCollBefore = (await getTroveEntireColl(alice))[0]

    //   // check before
    //   const activePool_ETH_before = await activePool.getCollateralAmount(contracts.weth.address)
    //   const activePool_RawEther_before = toBN(await contracts.weth.balanceOf(activePool.address))

    //   await borrowerOperations.withdrawColl([contracts.weth.address], [toBN(dec(1, 'ether'))], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
    //     from: alice
    //   })

    //   // check after
    //   const activePool_ETH_After = await activePool.getCollateralAmount(contracts.weth.address)
    //   const activePool_RawEther_After = toBN(await contracts.weth.balanceOf(activePool.address))
    //   assert.isTrue(activePool_ETH_After.eq(activePool_ETH_before.sub(toBN(dec(1, 'ether')))))
    //   assert.isTrue(activePool_RawEther_After.eq(activePool_RawEther_before.sub(toBN(dec(1, 'ether')))))
    // })

    // it("withdrawColl(): updates the stake and updates the total stakes", async () => {
    //   //  Alice creates initial Trove with 2 ether
    //   await openTrove({
    //     ICR: toBN(dec(2, 18)),
    //     extraParams: {
    //       from: alice,
    //       value: toBN(dec(5, 'ether'))
    //     }
    //   })
    //   const aliceColl = (await getTroveEntireColl(alice))[0]
    //   assert.isTrue(toBN(aliceColl).gt(toBN('0')))

    //   const alice_Stake_Before = await troveManager.getTroveStake(alice, contracts.weth.address)
    //   const totalStakes_Before = (await troveManager.totalStakes(contracts.weth.address))

    //   assert.isTrue(alice_Stake_Before.eq(aliceColl))
    //   assert.isTrue(totalStakes_Before.eq(aliceColl))

    //   // Alice withdraws 1 ether
    //   await borrowerOperations.withdrawColl([contracts.weth.address], [toBN(dec(1, 'ether'))], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
    //     from: alice
    //   })

    //   // Check stake and total stakes get updated
    //   const alice_Stake_After = await troveManager.getTroveStake(alice, contracts.weth.address)
    //   const totalStakes_After = (await troveManager.totalStakes(contracts.weth.address))

    //   assert.isTrue(alice_Stake_After.eq(alice_Stake_Before.sub(toBN(dec(1, 'ether')))))
    //   assert.isTrue(totalStakes_After.eq(totalStakes_Before.sub(toBN(dec(1, 'ether')))))
    // })

    // it("withdrawColl(): sends the correct amount of ETH to the user", async () => {
    //   await openTrove({
    //     ICR: toBN(dec(2, 18)),
    //     extraParams: {
    //       from: alice
    //     }
    //   })
    //   const aliceColl = await troveManager.getTroveColl(alice, contracts.weth.address)
    //   const alice_ETHBalance_Before = toBN(await web3.eth.getBalance(alice))
    //   let tx = await borrowerOperations.withdrawColl([contracts.weth.address], [toBN(dec(1, 'ether'))], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
    //     from: alice
    //   })
    //   let gasFee = th.getGasFee(tx)

    //   const alice_ETHBalance_After = toBN(await web3.eth.getBalance(alice))
    //   const balanceDiff = alice_ETHBalance_After.sub(alice_ETHBalance_Before).add(toBN(gasFee.toString()))
    //   assert.isTrue(balanceDiff.eq(toBN(dec(1, 'ether'))))
    // })

    // it("withdrawColl(): applies pending rewards and updates user's E_Coll, E_USDEDebt snapshots", async () => {
    //   // --- SETUP ---
    //   // Alice adds 15 ether, Bob adds 5 ether, Carol adds 1 ether
    //   await openTrove({
    //     ICR: toBN(dec(10, 18)),
    //     extraParams: {
    //       from: whale
    //     }
    //   })
    //   await openTrove({
    //     ICR: toBN(dec(3, 18)),
    //     extraParams: {
    //       from: alice,
    //       value: toBN(dec(100, 'ether'))
    //     }
    //   })
    //   await openTrove({
    //     ICR: toBN(dec(3, 18)),
    //     extraParams: {
    //       from: bob,
    //       value: toBN(dec(100, 'ether'))
    //     }
    //   })
    //   await openTrove({
    //     ICR: toBN(dec(2, 18)),
    //     extraParams: {
    //       from: carol,
    //       value: toBN(dec(10, 'ether'))
    //     }
    //   })

    //   const troveAmounts1 = await troveManager.getCurrentTroveAmounts(alice)
    //   const troveAmounts2 = await troveManager.getCurrentTroveAmounts(bob)
    //   const aliceCollBefore = troveAmounts1[0][0]
    //   const aliceDebtBefore = troveAmounts1[2]
    //   const bobCollBefore = troveAmounts2[0][0]
    //   const bobDebtBefore = troveAmounts2[2]

    //   // --- TEST ---

    //   // price drops to 1ETH:100USDE, reducing Carol's ICR below MCR
    //   await priceFeed.setPrice('100000000000000000000');

    //   // close Carol's Trove, liquidating her 1 ether and 180USDE.
    //   await troveManager.liquidate(carol, {
    //     from: owner
    //   });

    //   const E_ETH = await troveManager.E_Coll(contracts.weth.address)
    //   const E_USDEDebt = await troveManager.E_USDEDebt(contracts.weth.address)

    //   const alice_ETHrewardSnapshot_Before = await troveManager.getRewardSnapshotColl(alice, contracts.weth.address)
    //   const alice_USDEDebtRewardSnapshot_Before = await troveManager.getRewardSnapshotUSDE(alice, contracts.weth.address)

    //   const bob_ETHrewardSnapshot_Before = await troveManager.getRewardSnapshotColl(bob, contracts.weth.address)
    //   const bob_USDEDebtRewardSnapshot_Before = await troveManager.getRewardSnapshotUSDE(bob, contracts.weth.address)

    //   assert.equal(alice_ETHrewardSnapshot_Before, 0)
    //   assert.equal(alice_USDEDebtRewardSnapshot_Before, 0)
    //   assert.equal(bob_ETHrewardSnapshot_Before, 0)
    //   assert.equal(bob_USDEDebtRewardSnapshot_Before, 0)

    //   // Check A and B have pending rewards
    //   const pendingCollReward_A = (await troveManager.getPendingCollReward(alice))[0][0]
    //   const pendingDebtReward_A = await troveManager.getPendingUSDEDebtReward(alice)
    //   const pendingCollReward_B = (await troveManager.getPendingCollReward(bob))[0][0]
    //   const pendingDebtReward_B = await troveManager.getPendingUSDEDebtReward(bob)

    //   for (reward of [pendingCollReward_A, pendingDebtReward_A, pendingCollReward_B, pendingDebtReward_B]) {
    //     assert.isTrue(reward.gt(toBN('0')))
    //   }

    //   // Alice and Bob withdraw from their Troves
    //   const aliceCollWithdrawal = toBN(dec(5, 'ether'))
    //   const bobCollWithdrawal = toBN(dec(1, 'ether'))

    //   await borrowerOperations.withdrawColl([contracts.weth.address], [aliceCollWithdrawal], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
    //     from: alice
    //   })
    //   await borrowerOperations.withdrawColl([contracts.weth.address], [bobCollWithdrawal], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
    //     from: bob
    //   })

    //   // Check that both alice and Bob have had pending rewards applied in addition to their top-ups. 
    //   const troveAmounts3 = await troveManager.getCurrentTroveAmounts(alice)
    //   const troveAmounts4 = await troveManager.getCurrentTroveAmounts(bob)
    //   const aliceCollAfter = troveAmounts3[0][0]
    //   const aliceDebtAfter = troveAmounts3[2]
    //   const bobCollAfter = troveAmounts4[0][0]
    //   const bobDebtAfter = troveAmounts4[2]

    //   // Check rewards have been applied to troves
    //   th.assertIsApproximatelyEqual(aliceCollAfter, aliceCollBefore.add(pendingCollReward_A).sub(aliceCollWithdrawal), 10000)
    //   th.assertIsApproximatelyEqual(aliceDebtAfter, aliceDebtBefore.add(pendingDebtReward_A), toBN(dec(1, 13)))
    //   th.assertIsApproximatelyEqual(bobCollAfter, bobCollBefore.add(pendingCollReward_B).sub(bobCollWithdrawal), 10000)
    //   th.assertIsApproximatelyEqual(bobDebtAfter, bobDebtBefore.add(pendingDebtReward_B), toBN(dec(1, 13)))

    //   /* After top up, both Alice and Bob's snapshots of the rewards-per-unit-staked metrics should be updated
    //    to the latest values of E_ETH and E_USDEDebt */
    //   const alice_ETHrewardSnapshot_After = await troveManager.getRewardSnapshotColl(alice, contracts.weth.address)
    //   const alice_USDEDebtRewardSnapshot_After = await troveManager.getRewardSnapshotUSDE(alice, contracts.weth.address)

    //   const bob_ETHrewardSnapshot_After = await troveManager.getRewardSnapshotColl(bob, contracts.weth.address)
    //   const bob_USDEDebtRewardSnapshot_After = await troveManager.getRewardSnapshotUSDE(bob, contracts.weth.address)

    //   assert.isAtMost(th.getDifference(alice_ETHrewardSnapshot_After, E_ETH), 100)
    //   assert.isAtMost(th.getDifference(alice_USDEDebtRewardSnapshot_After, E_USDEDebt), 100)
    //   assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot_After, E_ETH), 100)
    //   assert.isAtMost(th.getDifference(bob_USDEDebtRewardSnapshot_After, E_USDEDebt), 100)
    // })

    // // --- withdrawUSDE() ---

    it("withdrawUSDE(): reverts when withdrawal would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: bob
        }
      })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isTrue((await th.getCurrentICR(contracts, alice)).lt(toBN(dec(110, 16))))

      const USDEwithdrawal = 1 // withdraw 1 wei USDE

      await assertRevert(borrowerOperations.withdrawUSDE(USDEwithdrawal, alice, alice, th._100pct, {
          from: alice
        }),
        "18") // An operation that would result in ICR < MCR is not permitted
    })

    it("withdrawUSDE(): decays a non-zero base rate", async () => {
      await openTrove({
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })

      await openTrove({
        extraUSDEAmount: toBN(dec(20, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: D
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: E
        }
      })

      const A_USDEBal = await usdeToken.balanceOf(A)

      // Artificially set base rate to 5%
      await troveManager.setBaseRate(dec(5, 16))

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)
      const treasury_before_withdraw = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentive_before_withdraw = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_before_withdraw = treasury_before_withdraw.add(liquidityIncentive_before_withdraw)
      // D withdraws USDE
      await borrowerOperations.withdrawUSDE(dec(1, 18), A, A, th._100pct, {
        from: D
      })
      const treasury_after_withdraw = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentive_after_withdraw = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_after_withdraw = treasury_after_withdraw.add(liquidityIncentive_after_withdraw)
      assert.isTrue(fee_after_withdraw.gt(fee_before_withdraw))
      // Check baseRate has decreased
      const baseRate_2 = await troveManager.baseRate()
      assert.isTrue(baseRate_2.lt(baseRate_1))

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E withdraws USDE
      await borrowerOperations.withdrawUSDE(dec(1, 18), A, A, th._100pct, {
        from: E
      })
      const treasury_after_withdraw_E = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentive_after_withdraw_E = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_after_withdraw_E = treasury_after_withdraw_E.add(liquidityIncentive_after_withdraw_E)
      assert.isTrue(fee_after_withdraw_E.gt(fee_after_withdraw))
      const baseRate_3 = await troveManager.baseRate()
      assert.isTrue(baseRate_3.lt(baseRate_2))
    })

    it("withdrawUSDE(): reverts if max fee > 100%", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: C
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: D
        }
      })
      // Max fee percentage must be between 0.25% and 100%
      await assertRevert(borrowerOperations.withdrawUSDE(dec(1, 18), A, A, dec(2, 18), {
        from: A
      }), "24")
      await assertRevert(borrowerOperations.withdrawUSDE(dec(1, 18), A, A, '1000000000000000001', {
        from: A
      }), "24")
    })

    it("withdrawUSDE(): reverts if max fee < 0.25% in Normal mode", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: C
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: D
        }
      })
      // Max fee percentage must be between 0.25% and 100%
      await assertRevert(borrowerOperations.withdrawUSDE(dec(1, 18), A, A, 0, {
        from: A
      }), "24")
      await assertRevert(borrowerOperations.withdrawUSDE(dec(1, 18), A, A, 1, {
        from: A
      }), "24")
      await assertRevert(borrowerOperations.withdrawUSDE(dec(1, 18), A, A, '1999999999999999', {
        from: A
      }), "24")
    })

    it("withdrawUSDE(): reverts if fee exceeds max fee percentage", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(60, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(60, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(70, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: C
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(80, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: D
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(180, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: E
        }
      })

      // Artificially make baseRate 8%
      await troveManager.setBaseRate(dec(8, 16))
      await troveManager.setLastFeeOpTimeToNow()

      let baseRate = await troveManager.baseRate() // expect 8% base rate
      assert.equal(baseRate.toString(), dec(8, 16))

      // 100%: 1e18,  10%: 1e17,  1%: 1e16,  0.1%: 1e15
      // 5%: 5e16
      // 0.5%: 5e15
      // actual: 0.5%, 5e15


      // USDEFee:                  15000000558793542
      // absolute _fee:            15000000558793542
      // actual feePercentage:      5000000186264514
      // user's _maxFeePercentage: 7999999999999999

      const lessThan8pct = '7999999999999999'
      await assertRevert(borrowerOperations.withdrawUSDE(dec(3, 18), A, A, lessThan8pct, {
        from: A
      }), "Fee exceeded provided maximum")

      baseRate = await troveManager.baseRate() // expect 8% base rate
      assert.equal(baseRate, dec(8, 16))
      // Attempt with maxFee 1%
      await assertRevert(borrowerOperations.withdrawUSDE(dec(1, 18), A, A, dec(1, 16), {
        from: B
      }), "Fee exceeded provided maximum")

      baseRate = await troveManager.baseRate() // expect 8% base rate
      assert.equal(baseRate, dec(8, 16))
      // // Attempt with maxFee 3.754%
      // await assertRevert(borrowerOperations.withdrawUSDE(dec(1, 18), A, A, dec(3754, 13), {
      //   from: C
      // }), "Fee exceeded provided maximum")

      baseRate = await troveManager.baseRate() // expect 8% base rate
      assert.equal(baseRate, dec(8, 16))
      // Attempt with maxFee 0.25%%
      await assertRevert(borrowerOperations.withdrawUSDE(dec(1, 18), A, A, dec(25, 14), {
        from: D
      }), "Fee exceeded provided maximum")
    })

    it("withdrawUSDE(): succeeds when fee is less than max fee percentage", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(60, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(60, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(70, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: C
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(80, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: D
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(180, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: E
        }
      })

      // const totalSupply = await usdeToken.totalSupply()

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      let baseRate = await troveManager.baseRate() // expect 5% base rate
      assert.isTrue(baseRate.eq(toBN(dec(5, 16))))
      const treasury_before_withdraw = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentive_before_withdraw = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_before_withdraw = treasury_before_withdraw.add(liquidityIncentive_before_withdraw)
      // Attempt with maxFee > 5%
      const moreThan5pct = '50000000000000001'
      const tx1 = await borrowerOperations.withdrawUSDE(dec(1, 18), A, A, moreThan5pct, {
        from: A
      })
      assert.isTrue(tx1.receipt.status)
      const treasury_after_withdraw = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentive_after_withdraw = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_after_withdraw = treasury_after_withdraw.add(liquidityIncentive_after_withdraw)
      assert.isTrue(fee_after_withdraw.gt(fee_before_withdraw))

      baseRate = await troveManager.baseRate() // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))

      // Attempt with maxFee = 5%
      const tx2 = await borrowerOperations.withdrawUSDE(dec(1, 18), A, A, dec(5, 16), {
        from: B
      })
      assert.isTrue(tx2.receipt.status)
      const treasury_after_withdraw_B = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentive_after_withdraw_B = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_after_withdraw_B = treasury_after_withdraw_B.add(liquidityIncentive_after_withdraw_B)
      assert.isTrue(fee_after_withdraw_B.gt(fee_after_withdraw))

      baseRate = await troveManager.baseRate() // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))

      // Attempt with maxFee 10%
      const tx3 = await borrowerOperations.withdrawUSDE(dec(1, 18), A, A, dec(1, 17), {
        from: C
      })
      assert.isTrue(tx3.receipt.status)

      baseRate = await troveManager.baseRate() // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))

      // Attempt with maxFee 37.659%
      const tx4 = await borrowerOperations.withdrawUSDE(dec(1, 18), A, A, dec(37659, 13), {
        from: D
      })
      assert.isTrue(tx4.receipt.status)

      // Attempt with maxFee 100%
      const tx5 = await borrowerOperations.withdrawUSDE(dec(1, 18), A, A, dec(1, 18), {
        from: E
      })
      assert.isTrue(tx5.receipt.status)

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(A)
      const B_USDE = await usdeToken.balanceOf(B)
      const C_USDE = await usdeToken.balanceOf(C)
      const D_USDE = await usdeToken.balanceOf(D)
      const E_USDE = await usdeToken.balanceOf(E)
      const expectedTotalSupply = A_USDE.add(B_USDE).add(C_USDE).add(D_USDE).add(E_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("5"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("withdrawUSDE(): doesn't change base rate if it is already zero", async () => {
      await openTrove({
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })

      await openTrove({
        extraUSDEAmount: toBN(dec(30, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(50, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: C
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(50, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: D
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(50, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: E
        }
      })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D withdraws USDE
      await borrowerOperations.withdrawUSDE(dec(37, 18), A, A, th._100pct, {
        from: D
      })

      // Check baseRate is still 0
      const baseRate_2 = await troveManager.baseRate()
      assert.equal(baseRate_2, '0')

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E opens trove 
      await borrowerOperations.withdrawUSDE(dec(12, 18), A, A, th._100pct, {
        from: E
      })

      const baseRate_3 = await troveManager.baseRate()
      assert.equal(baseRate_3, '0')

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(A)
      const B_USDE = await usdeToken.balanceOf(B)
      const C_USDE = await usdeToken.balanceOf(C)
      const D_USDE = await usdeToken.balanceOf(D)
      const E_USDE = await usdeToken.balanceOf(E)
      const W_USDE = await usdeToken.balanceOf(whale)
      const expectedTotalSupply = A_USDE.add(B_USDE).add(C_USDE).add(D_USDE).add(E_USDE).add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("6"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("withdrawUSDE(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
      await openTrove({
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })

      await openTrove({
        extraUSDEAmount: toBN(dec(30, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(50, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: C
        }
      })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      const lastFeeOpTime_1 = await troveManager.lastFeeOperationTime()

      // 10 seconds pass
      th.fastForwardTime(10, web3.currentProvider)

      // Borrower C triggers a fee
      await borrowerOperations.withdrawUSDE(dec(1, 18), C, C, th._100pct, {
        from: C
      })

      const lastFeeOpTime_2 = await troveManager.lastFeeOperationTime()

      // Check that the last fee operation time did not update, as borrower D's debt issuance occured
      // since before minimum interval had passed 
      assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

      // 60 seconds passes
      th.fastForwardTime(60, web3.currentProvider)

      // Check that now, at least one minute has passed since lastFeeOpTime_1
      const timeNow = await th.getLatestBlockTimestamp(web3)
      assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(60))

      // Borrower C triggers a fee
      await borrowerOperations.withdrawUSDE(dec(1, 18), C, C, th._100pct, {
        from: C
      })

      const lastFeeOpTime_3 = await troveManager.lastFeeOperationTime()

      // Check that the last fee operation time DID update, as borrower's debt issuance occured
      // after minimum interval had passed 
      assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(A)
      const B_USDE = await usdeToken.balanceOf(B)
      const C_USDE = await usdeToken.balanceOf(C)
      const W_USDE = await usdeToken.balanceOf(whale)
      const expectedTotalSupply = A_USDE.add(B_USDE).add(C_USDE).add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("4"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })


    it("withdrawUSDE(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity", async () => {
      await openTrove({
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(50, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: C
        }
      })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 30 seconds pass
      th.fastForwardTime(30, web3.currentProvider)

      // Borrower C triggers a fee, before decay interval has passed
      await borrowerOperations.withdrawUSDE(dec(1, 18), C, C, th._100pct, {
        from: C
      })

      // 30 seconds pass
      th.fastForwardTime(30, web3.currentProvider)

      // Borrower C triggers another fee
      await borrowerOperations.withdrawUSDE(dec(1, 18), C, C, th._100pct, {
        from: C
      })

      // Check base rate has decreased even though Borrower tried to stop it decaying
      const baseRate_2 = await troveManager.baseRate()
      assert.isTrue(baseRate_2.lt(baseRate_1))

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(A)
      const B_USDE = await usdeToken.balanceOf(B)
      const C_USDE = await usdeToken.balanceOf(C)
      const W_USDE = await usdeToken.balanceOf(whale)
      const expectedTotalSupply = A_USDE.add(B_USDE).add(C_USDE).add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("4"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    if (!withProxy) { // TODO: use rawLogs instead of logs
      it("withdrawUSDE(): borrowing at non-zero base records the (drawn debt + fee) on the Trove struct", async () => {
        // time fast-forwards 1 year
        await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

        await openTrove({
          ICR: toBN(dec(10, 18)),
          extraParams: {
            from: whale
          }
        })
        await openTrove({
          extraUSDEAmount: toBN(dec(30, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: {
            from: A
          }
        })
        await openTrove({
          extraUSDEAmount: toBN(dec(40, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: {
            from: B
          }
        })
        await openTrove({
          extraUSDEAmount: toBN(dec(50, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: {
            from: C
          }
        })
        await openTrove({
          extraUSDEAmount: toBN(dec(50, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: {
            from: D
          }
        })
        const D_debtBefore = await getTroveEntireDebt(D)

        // Artificially make baseRate 5%
        await troveManager.setBaseRate(dec(5, 16))
        await troveManager.setLastFeeOpTimeToNow()

        // Check baseRate is now non-zero
        const baseRate_1 = await troveManager.baseRate()
        assert.isTrue(baseRate_1.gt(toBN('0')))

        // 2 hours pass
        th.fastForwardTime(7200, web3.currentProvider)

        // D withdraws USDE
        const withdrawal_D = toBN(dec(37, 18))
        const withdrawalTx = await borrowerOperations.withdrawUSDE(toBN(dec(37, 18)), D, D, th._100pct, {
          from: D
        })

        const emittedFee = toBN(th.getUSDEFeeFromUSDEBorrowingEvent(withdrawalTx))
        assert.isTrue(emittedFee.gt(toBN('0')))

        const newDebt = await getTroveEntireDebt(D)

        // Check debt on Trove struct equals initial debt + withdrawal + emitted fee
        th.assertIsApproximatelyEqual(newDebt.div(toBN(dec(1, 17))), (D_debtBefore.add(withdrawal_D).add(emittedFee)).div(toBN(dec(1, 17))), 1)

        const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
        const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
        const A_USDE = await usdeToken.balanceOf(A)
        const B_USDE = await usdeToken.balanceOf(B)
        const C_USDE = await usdeToken.balanceOf(C)
        const D_USDE = await usdeToken.balanceOf(D)
        const W_USDE = await usdeToken.balanceOf(whale)
        const expectedTotalSupply = A_USDE.add(B_USDE).add(C_USDE).add(D_USDE).add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("5"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

        // Check total USDE supply
        const totalSupply = await usdeToken.totalSupply()
        th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
      })
    }

    it("withdrawUSDE(): Borrowing at non-zero base rate sends requested amount to the user", async () => {
      await openTrove({
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(50, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: C
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(50, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: D
        }
      })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      const D_USDEBalanceBefore = await usdeToken.balanceOf(D)

      // D withdraws USDE
      const D_USDERequest = toBN(dec(37, 18))
      await borrowerOperations.withdrawUSDE(D_USDERequest, D, D, th._100pct, {
        from: D
      })

      // Check D's USDE balance now equals their initial balance plus request USDE
      const D_USDEBalanceAfter = await usdeToken.balanceOf(D)
      assert.isTrue(D_USDEBalanceAfter.eq(D_USDEBalanceBefore.add(D_USDERequest)))

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(A)
      const B_USDE = await usdeToken.balanceOf(B)
      const C_USDE = await usdeToken.balanceOf(C)
      const W_USDE = await usdeToken.balanceOf(whale)
      const expectedTotalSupply = A_USDE.add(B_USDE).add(C_USDE).add(D_USDEBalanceAfter).add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("5"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("withdrawUSDE(): Borrowing at zero base rate sends debt request to user", async () => {
      await openTrove({
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(50, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: C
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(50, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: D
        }
      })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      const D_USDEBalanceBefore = await usdeToken.balanceOf(D)

      // D withdraws USDE
      const D_USDERequest = toBN(dec(37, 18))
      await borrowerOperations.withdrawUSDE(dec(37, 18), D, D, th._100pct, {
        from: D
      })

      // Check D's USDE balance now equals their requested USDE
      const D_USDEBalanceAfter = await usdeToken.balanceOf(D)

      // Check D's trove debt == D's USDE balance + liquidation reserve
      assert.isTrue(D_USDEBalanceAfter.eq(D_USDEBalanceBefore.add(D_USDERequest)))

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(A)
      const B_USDE = await usdeToken.balanceOf(B)
      const C_USDE = await usdeToken.balanceOf(C)
      const W_USDE = await usdeToken.balanceOf(whale)
      const expectedTotalSupply = A_USDE.add(B_USDE).add(C_USDE).add(D_USDEBalanceAfter).add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("5"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("withdrawUSDE(): reverts when calling address does not have active trove", async () => {
      await openTrove({
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })

      // Bob successfully withdraws USDE
      const txBob = await borrowerOperations.withdrawUSDE(dec(100, 18), bob, bob, th._100pct, {
        from: bob
      })
      assert.isTrue(txBob.receipt.status)

      // Carol with no active trove attempts to withdraw USDE
      try {
        const txCarol = await borrowerOperations.withdrawUSDE(dec(100, 18), carol, carol, th._100pct, {
          from: carol
        })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawUSDE(): reverts when requested withdrawal amount is zero USDE", async () => {
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })

      // Bob successfully withdraws 1e-18 USDE
      const txBob = await borrowerOperations.withdrawUSDE(1, bob, bob, th._100pct, {
        from: bob
      })
      assert.isTrue(txBob.receipt.status)

      // Alice attempts to withdraw 0 USDE
      try {
        const txAlice = await borrowerOperations.withdrawUSDE(0, alice, alice, th._100pct, {
          from: alice
        })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawUSDE(): reverts when system is in Recovery Mode", async () => {
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: carol
        }
      })

      assert.isFalse(await th.checkRecoveryMode(contracts))

      // Withdrawal possible when recoveryMode == false
      const txAlice = await borrowerOperations.withdrawUSDE(dec(100, 18), alice, alice, th._100pct, {
        from: alice
      })
      assert.isTrue(txAlice.receipt.status)

      await priceFeed.setPrice('50000000000000000000')

      assert.isTrue(await th.checkRecoveryMode(contracts))

      //Check USDE withdrawal impossible when recoveryMode == true
      try {
        const txBob = await borrowerOperations.withdrawUSDE(1, bob, bob, th._100pct, {
          from: bob
        })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawUSDE(): reverts when withdrawal would bring the trove's ICR < MCR", async () => {
      await openTrove({
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        ICR: toBN(dec(11, 17)),
        extraParams: {
          from: bob
        }
      })

      // Bob tries to withdraw USDE that would bring his ICR < MCR
      try {
        const txBob = await borrowerOperations.withdrawUSDE(1, bob, bob, th._100pct, {
          from: bob
        })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawUSDE(): reverts when a withdrawal would cause the TCR of the system to fall below the CCR", async () => {
      // Alice and Bob creates troves with 130% ICR.  System TCR = 130%.
      await openTrove({
        ICR: toBN(dec(131, 16)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        ICR: toBN(dec(130, 16)),
        extraParams: {
          from: bob
        }
      })

      var TCR = await th.getTCR(contracts)

      assert.isTrue(TCR.gt(toBN(dec(130, 16))))

      // Bob attempts to withdraw 20 USDE.
      // System TCR would be: ((13.1+3) * 200 ) / (2000+2020) = 5220/4020 = 129.85%, i.e. below CCR of 130%.
      try {
        const txBob = await borrowerOperations.withdrawUSDE(dec(20, 18), bob, bob, th._100pct, {
          from: bob
        })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawUSDE(): reverts if system is in Recovery Mode", async () => {
      // --- SETUP ---
      await openTrove({
        ICR: toBN(dec(131, 16)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        ICR: toBN(dec(130, 16)),
        extraParams: {
          from: bob
        }
      })

      // --- TEST ---

      // price drops to 1ETH:190USDE, reducing TCR below 130%
      await priceFeed.setPrice('190000000000000000000');
      assert.isTrue((await th.getTCR(contracts)).lt(toBN(dec(13, 17))))

      try {
        const txData = await borrowerOperations.withdrawUSDE('200', alice, alice, th._100pct, {
          from: alice
        })
        assert.isFalse(txData.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }
    })

    it("withdrawUSDE(): increases the Trove's USDE debt by the correct amount", async () => {
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })

      // check before
      const aliceDebtBefore = (await getTroveEntireDebt(alice))
      assert.isTrue(aliceDebtBefore.gt(toBN(0)))

      await borrowerOperations.withdrawUSDE(await getNetBorrowingAmount(toBN(dec(1, 18))), alice, alice, th._100pct, {
        from: alice
      })

      // check after
      const aliceDebtAfter = (await getTroveEntireDebt(alice))

      th.assertIsApproximatelyEqual(toEther(aliceDebtAfter), toEther(aliceDebtBefore).add(toBN(1)))

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(alice)
      const expectedTotalSupply = A_USDE.add(USDE_GAS_COMPENSATION.mul(toBN("1"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("withdrawUSDE(): increases USDE debt in ActivePool by correct amount", async () => {
      await openTrove({
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: alice,
          value: toBN(dec(100, 'ether'))
        }
      })

      const aliceDebtBefore = (await getTroveEntireDebt(alice))
      assert.isTrue(aliceDebtBefore.gt(toBN(0)))

      // check before
      const activePool_USDE_Before = await activePool.getUSDEDebt()
      assert.isTrue(activePool_USDE_Before.eq(aliceDebtBefore))

      await borrowerOperations.withdrawUSDE(await getNetBorrowingAmount(dec(10000, 18)), alice, alice, th._100pct, {
        from: alice
      })

      // check after
      const activePool_USDE_After = await activePool.getUSDEDebt()
      th.assertIsApproximatelyEqual(toEther(activePool_USDE_After), toEther(activePool_USDE_Before).add(toBN(10000)))

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(alice)
      const expectedTotalSupply = A_USDE.add(USDE_GAS_COMPENSATION.mul(toBN("1"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("withdrawUSDE(): increases user USDEToken balance by correct amount", async () => {
      await openTrove({
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: alice,
          value: toBN(dec(100, 'ether'))
        }
      })

      // check before
      const alice_USDETokenBalance_Before = await usdeToken.balanceOf(alice)
      assert.isTrue(alice_USDETokenBalance_Before.gt(toBN('0')))

      await borrowerOperations.withdrawUSDE(dec(10000, 18), alice, alice, th._100pct, {
        from: alice
      })

      // check after
      const alice_USDETokenBalance_After = await usdeToken.balanceOf(alice)
      assert.isTrue(toEther(alice_USDETokenBalance_After).eq(toEther(alice_USDETokenBalance_Before).add(toBN(10000))))

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(alice)
      const expectedTotalSupply = A_USDE.add(USDE_GAS_COMPENSATION.mul(toBN("1"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    // --- repayUSDE() ---
    it("repayUSDE(): reverts when repayment would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: bob
        }
      })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isTrue((await th.getCurrentICR(contracts, alice)).lt(toBN(dec(110, 16))))

      const USDERepayment = 1 // 1 wei repayment

      await assertRevert(borrowerOperations.repayUSDE(USDERepayment, alice, alice, {
          from: alice
        }),
        "18") // An operation that would result in ICR < MCR is not permitted
    })

    it("repayUSDE(): Succeeds when it would leave trove with net debt >= minimum net debt", async () => {
      // Make the USDE request 2 wei above min net debt to correct for floor division, and make net debt = min net debt + 1 wei

      await borrowerOperations.openTrove([], [], th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN('2'))), A, A, {
        from: A,
        value: dec(100, 18)
      })

      const repayTxA = await borrowerOperations.repayUSDE(1, A, A, {
        from: A
      })
      assert.isTrue(repayTxA.receipt.status)

      await borrowerOperations.openTrove([], [], th._100pct, dec(20, 20), B, B, {
        from: B,
        value: dec(100, 18)
      })

      const repayTxB = await borrowerOperations.repayUSDE(dec(19, 19), B, B, {
        from: B
      })
      assert.isTrue(repayTxB.receipt.status)

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(A)
      const B_USDE = await usdeToken.balanceOf(B)
      const expectedTotalSupply = A_USDE.add(B_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("2"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("repayUSDE(): reverts when it would leave trove with net debt < minimum net debt", async () => {
      // Make the USDE request 2 wei above min net debt to correct for floor division, and make net debt = min net debt - 1 wei

      await borrowerOperations.openTrove([], [], th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN('1'))), A, A, {
        from: A,
        value: dec(100, 18)
      })

      // console.log("This is the repaid amount ", (await getTroveEntireDebt(A)).toString())

      const repayTxAPromise = borrowerOperations.repayUSDE(toBN(dec(1, 13)), A, A, {
        from: A
      })
      await assertRevert(repayTxAPromise, "21") // Trove's net debt must be greater than minimum
    })

    it("repayUSDE(): reverts when calling address does not have active trove", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })
      // Bob successfully repays some USDE
      const txBob = await borrowerOperations.repayUSDE(dec(10, 18), bob, bob, {
        from: bob
      })
      assert.isTrue(txBob.receipt.status)

      // Carol with no active trove attempts to repayUSDE
      try {
        const txCarol = await borrowerOperations.repayUSDE(dec(10, 18), carol, carol, {
          from: carol
        })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("repayUSDE(): reverts when attempted repayment is > the debt of the trove", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })
      const aliceDebt = await getTroveEntireDebt(alice)

      // Bob successfully repays some USDE
      const txBob = await borrowerOperations.repayUSDE(dec(10, 18), bob, bob, {
        from: bob
      })
      assert.isTrue(txBob.receipt.status)

      // Alice attempts to repay more than her debt
      try {
        const txAlice = await borrowerOperations.repayUSDE(aliceDebt.add(toBN(dec(1, 18))), alice, alice, {
          from: alice
        })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    // repayUSDE: reduces USDE debt in Trove
    it("repayUSDE(): reduces the Trove's USDE debt by the correct amount", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })
      const aliceDebtBefore = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))

      await borrowerOperations.repayUSDE(aliceDebtBefore.div(toBN(10)), alice, alice, {
        from: alice
      }) // Repays 1/10 her debt

      const aliceDebtAfter = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebtAfter.gt(toBN('0')))

      th.assertIsApproximatelyEqual(aliceDebtAfter, aliceDebtBefore.mul(toBN(9)).div(toBN(10)), toBN(dec(1, 13))) // check 9/10 debt remaining

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(alice)
      const B_USDE = await usdeToken.balanceOf(bob)
      const expectedTotalSupply = A_USDE.add(B_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("2"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("repayUSDE(): decreases USDE debt in ActivePool by correct amount", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })
      const aliceDebtBefore = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))

      // Check before
      const activePool_USDE_Before = await activePool.getUSDEDebt()
      assert.isTrue(activePool_USDE_Before.gt(toBN('0')))

      await borrowerOperations.repayUSDE(aliceDebtBefore.div(toBN(10)), alice, alice, {
        from: alice
      }) // Repays 1/10 her debt

      // check after
      const activePool_USDE_After = await activePool.getUSDEDebt()
      th.assertIsApproximatelyEqual(activePool_USDE_After, activePool_USDE_Before.sub(aliceDebtBefore.div(toBN(10))))

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(alice)
      const B_USDE = await usdeToken.balanceOf(bob)
      const expectedTotalSupply = A_USDE.add(B_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("2"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("repayUSDE(): decreases user USDEToken balance by correct amount", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })
      const aliceDebtBefore = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))

      // check before
      const alice_USDETokenBalance_Before = await usdeToken.balanceOf(alice)
      assert.isTrue(alice_USDETokenBalance_Before.gt(toBN('0')))

      await borrowerOperations.repayUSDE(aliceDebtBefore.div(toBN(10)), alice, alice, {
        from: alice
      }) // Repays 1/10 her debt

      // check after
      const alice_USDETokenBalance_After = await usdeToken.balanceOf(alice)
      th.assertIsApproximatelyEqual(alice_USDETokenBalance_After, alice_USDETokenBalance_Before.sub(aliceDebtBefore.div(toBN(10))))

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(alice)
      const B_USDE = await usdeToken.balanceOf(bob)
      const expectedTotalSupply = A_USDE.add(B_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("2"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("repayUSDE(): can repay debt in Recovery Mode", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })
      const aliceDebtBefore = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice('105000000000000000000')

      assert.isTrue(await th.checkRecoveryMode(contracts))

      const tx = await borrowerOperations.repayUSDE(aliceDebtBefore.div(toBN(10)), alice, alice, {
        from: alice
      })
      assert.isTrue(tx.receipt.status)

      // Check Alice's debt: 12075 (initial) - 1207.5 (repaid)
      const aliceDebtAfter = await getTroveEntireDebt(alice)
      th.assertIsApproximatelyEqual(aliceDebtAfter, aliceDebtBefore.mul(toBN(9)).div(toBN(10)), toBN(dec(1, 14)))

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(alice)
      const B_USDE = await usdeToken.balanceOf(bob)
      const expectedTotalSupply = A_USDE.add(B_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("2"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("repayUSDE(): Reverts if borrower has insufficient USDE balance to cover his debt repayment", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      const bobBalBefore = await usdeToken.balanceOf(B)
      assert.isTrue(bobBalBefore.gt(toBN('0')))

      // Bob transfers all but 5 of his USDE to Carol
      await usdeToken.transfer(C, bobBalBefore.sub((toBN(dec(5, 18)))), {
        from: B
      })

      //Confirm B's USDE balance has decreased to 5 USDE
      const bobBalAfter = await usdeToken.balanceOf(B)

      assert.isTrue(bobBalAfter.eq(toBN(dec(5, 18))))

      // Bob tries to repay 6 USDE
      const repayUSDEPromise_B = borrowerOperations.repayUSDE(toBN(dec(6, 18)), B, B, {
        from: B
      })
      // Caller doesnt have enough USDE to make repayment
      await assertRevert(repayUSDEPromise_B, "22")
    })

    // --- adjustTrove() ---

    it("adjustTrove(): reverts when adjustment would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: bob
        }
      })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isTrue((await th.getCurrentICR(contracts, alice, )).lt(toBN(dec(110, 16))))

      const USDERepayment = 1 // 1 wei repayment
      const collTopUp = 1

      await assertRevert(
        borrowerOperations.adjustTrove([], [], [], [], th._100pct, USDERepayment, false, th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
          from: alice,
          value: toBN(collTopUp)
        }),
        "18") // An operation that would result in ICR < MCR is not permitted
    })

    it("adjustTrove(): reverts if max fee < 0.25% in Normal mode", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      // Max fee percentage must be between 0.25% and 100%
      await assertRevert(
        borrowerOperations.adjustTrove([], [], [], [], 0, toBN(dec(1, 18)), true, th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
          from: A,
          value: toBN(dec(2, 16))
        }),
        "24"
      )
      await assertRevert(
        borrowerOperations.adjustTrove([], [], [], [], 1, toBN(dec(1, 18)), true, th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
          from: A,
          value: toBN(dec(2, 16))
        }),
        "24"
      )
      await assertRevert(
        borrowerOperations.adjustTrove([], [], [], [], '2499999999999999', toBN(dec(1, 18)), true, th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
          from: A,
          value: toBN(dec(2, 16))
        }),
        "24"
      )
      await assertRevert(
        borrowerOperations.adjustTrove([], [], [], [], toBN(dec(1, 19)), toBN(dec(1, 18)), true, th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
          from: A,
          value: toBN(dec(2, 16))
        }),
        "24"
      )
      // allow normal fee ceiling between 0.75% and 100%
      const tx = await borrowerOperations.adjustTrove([], [], [], [], toBN(dec(1, 17)), toBN(dec(1, 18)), true, th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
        from: A,
        value: toBN(dec(2, 16))
      })
      assert.isTrue(tx.receipt.status)
    })

    it("adjustTrove(): decays a non-zero base rate", async () => {
      await openTrove({
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(50, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: C
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: D
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(50, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: E
        }
      })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      await borrowerOperations.adjustTrove([], [], [], [], th._100pct, toBN(dec(37, 18)), true, D, D, {
        from: D
      })

      // Check baseRate has decreased
      const baseRate_2 = await troveManager.baseRate()
      assert.isTrue(baseRate_2.lt(baseRate_1))

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E adjusts trove
      await borrowerOperations.adjustTrove([], [], [], [], th._100pct, toBN(dec(37, 15)), true, E, E, {
        from: E
      })

      const baseRate_3 = await troveManager.baseRate()
      assert.isTrue(baseRate_3.lt(baseRate_2))

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(A)
      const B_USDE = await usdeToken.balanceOf(B)
      const C_USDE = await usdeToken.balanceOf(C)
      const D_USDE = await usdeToken.balanceOf(D)
      const E_USDE = await usdeToken.balanceOf(E)
      const W_USDE = await usdeToken.balanceOf(whale)
      const expectedTotalSupply = A_USDE.add(B_USDE).add(C_USDE).add(D_USDE).add(E_USDE).add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("6"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("adjustTrove(): doesn't decay a non-zero base rate when user issues 0 debt", async () => {
      await openTrove({
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(50, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: C
        }
      })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // D opens trove 
      await openTrove({
        extraUSDEAmount: toBN(dec(50, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: D
        }
      })

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove with 0 debt
      await borrowerOperations.adjustTrove([], [], [], [], th._100pct, 0, false, D, D, {
        from: D,
        value: toBN(dec(1, 'ether'))
      })

      // Check baseRate has not decreased 
      const baseRate_2 = await troveManager.baseRate()
      assert.isTrue(baseRate_2.eq(baseRate_1))
    })

    it("adjustTrove(): doesn't change base rate if it is already zero", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(40, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: E
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(50, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: D
        }
      })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      await borrowerOperations.adjustTrove([], [], [], [], th._100pct, toBN(dec(37, 18)), true, D, D, {
        from: D
      })

      // Check baseRate is still 0
      const baseRate_2 = await troveManager.baseRate()
      assert.equal(baseRate_2, '0')

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E adjusts trove
      await borrowerOperations.adjustTrove([], [], [], [], th._100pct, toBN(dec(37, 15)), true, E, E, {
        from: E
      })

      const baseRate_3 = await troveManager.baseRate()
      assert.equal(baseRate_3, '0')

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const D_USDE = await usdeToken.balanceOf(D)
      const E_USDE = await usdeToken.balanceOf(E)
      const expectedTotalSupply = D_USDE.add(E_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("2"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("adjustTrove(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
      await openTrove({
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(50, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: C
        }
      })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      const lastFeeOpTime_1 = await troveManager.lastFeeOperationTime()

      // 10 seconds pass
      th.fastForwardTime(10, web3.currentProvider)

      // Borrower C triggers a fee
      await borrowerOperations.adjustTrove([], [], [], [], th._100pct, toBN(dec(1, 18)), true, C, C, {
        from: C
      })

      const lastFeeOpTime_2 = await troveManager.lastFeeOperationTime()

      // Check that the last fee operation time did not update, as borrower D's debt issuance occured
      // since before minimum interval had passed 
      assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

      // 60 seconds passes
      th.fastForwardTime(60, web3.currentProvider)

      // Check that now, at least one minute has passed since lastFeeOpTime_1
      const timeNow = await th.getLatestBlockTimestamp(web3)
      assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(60))

      // Borrower C triggers a fee
      await borrowerOperations.adjustTrove([], [], [], [], th._100pct, toBN(dec(1, 18)), true, C, C, {
        from: C
      })

      const lastFeeOpTime_3 = await troveManager.lastFeeOperationTime()

      // Check that the last fee operation time DID update, as borrower's debt issuance occured
      // after minimum interval had passed 
      assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(A)
      const B_USDE = await usdeToken.balanceOf(B)
      const C_USDE = await usdeToken.balanceOf(C)
      const W_USDE = await usdeToken.balanceOf(whale)
      const expectedTotalSupply = A_USDE.add(B_USDE).add(C_USDE).add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("4"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("adjustTrove(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity", async () => {
      await openTrove({
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(50, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: C
        }
      })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // Borrower C triggers a fee, before decay interval of 1 minute has passed
      await borrowerOperations.adjustTrove([], [], [], [], th._100pct, toBN(dec(1, 18)), true, C, C, {
        from: C
      })

      // 1 minute passes
      th.fastForwardTime(60, web3.currentProvider)

      // Borrower C triggers another fee
      await borrowerOperations.adjustTrove([], [], [], [], th._100pct, toBN(dec(1, 18)), true, C, C, {
        from: C
      })

      // Check base rate has decreased even though Borrower tried to stop it decaying
      const baseRate_2 = await troveManager.baseRate()
      assert.isTrue(baseRate_2.lt(baseRate_1))

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(A)
      const B_USDE = await usdeToken.balanceOf(B)
      const C_USDE = await usdeToken.balanceOf(C)
      const W_USDE = await usdeToken.balanceOf(whale)
      const expectedTotalSupply = A_USDE.add(B_USDE).add(C_USDE).add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("4"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    if (!withProxy) { // TODO: use rawLogs instead of logs
      it("adjustTrove(): borrowing at non-zero base records the (drawn debt + fee) on the Trove struct", async () => {
        // time fast-forwards 1 year
        await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

        await openTrove({
          ICR: toBN(dec(10, 18)),
          extraParams: {
            from: whale
          }
        })
        await openTrove({
          extraUSDEAmount: toBN(dec(30, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: {
            from: A
          }
        })
        await openTrove({
          extraUSDEAmount: toBN(dec(40, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: {
            from: B
          }
        })
        await openTrove({
          extraUSDEAmount: toBN(dec(50, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: {
            from: C
          }
        })
        await openTrove({
          extraUSDEAmount: toBN(dec(50, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: {
            from: D
          }
        })
        const D_debtBefore = await getTroveEntireDebt(D)

        // Artificially make baseRate 5%
        await troveManager.setBaseRate(dec(5, 16))
        await troveManager.setLastFeeOpTimeToNow()

        // Check baseRate is now non-zero
        const baseRate_1 = await troveManager.baseRate()
        assert.isTrue(baseRate_1.gt(toBN('0')))

        // 2 hours pass
        th.fastForwardTime(7200, web3.currentProvider)

        const withdrawal_D = toBN(dec(37, 18))

        // D withdraws USDE
        const adjustmentTx = await borrowerOperations.adjustTrove([], [], [], [], th._100pct, toBN(withdrawal_D), true, D, D, {
          from: D
        })

        const emittedFee = toBN(th.getUSDEFeeFromUSDEBorrowingEvent(adjustmentTx))
        assert.isTrue(emittedFee.gt(toBN('0')))

        const D_newDebt = await getTroveEntireDebt(D)

        // Check debt on Trove struct equals initila debt plus drawn debt plus emitted fee
        assert.isTrue(toEther(D_newDebt).eq(toEther(D_debtBefore.add(emittedFee).add(withdrawal_D))))

        const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
        const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
        const A_USDE = await usdeToken.balanceOf(A)
        const B_USDE = await usdeToken.balanceOf(B)
        const C_USDE = await usdeToken.balanceOf(C)
        const D_USDE = await usdeToken.balanceOf(D)
        const W_USDE = await usdeToken.balanceOf(whale)
        const expectedTotalSupply = A_USDE.add(B_USDE).add(C_USDE).add(D_USDE).add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("5"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

        // Check total USDE supply
        const totalSupply = await usdeToken.totalSupply()
        th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
      })
    }

    it("adjustTrove(): Borrowing at non-zero base rate sends requested amount to the user", async () => {
      // time fast-forwards 1 year
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      await openTrove({
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(50, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: C
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(50, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: D
        }
      })

      const D_USDEBalanceBefore = await usdeToken.balanceOf(D)

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      const USDERequest_D = toBN(dec(40, 18))
      await borrowerOperations.adjustTrove([], [], [], [], th._100pct, toBN(USDERequest_D), true, D, D, {
        from: D
      })

      // Check D's USDE balance has increased by their requested USDE
      const D_USDEBalanceAfter = await usdeToken.balanceOf(D)
      assert.isTrue(D_USDEBalanceAfter.eq(D_USDEBalanceBefore.add(USDERequest_D)))

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(A)
      const B_USDE = await usdeToken.balanceOf(B)
      const C_USDE = await usdeToken.balanceOf(C)
      const W_USDE = await usdeToken.balanceOf(whale)
      const expectedTotalSupply = A_USDE.add(B_USDE).add(C_USDE).add(D_USDEBalanceAfter).add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("5"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("adjustTrove(): Borrowing at zero base rate sends total requested USDE to the user", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: whale,
          value: toBN(dec(100, 'ether'))
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: C
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: D
        }
      })

      const D_USDEBalBefore = await usdeToken.balanceOf(D)
      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      const USDERequest_D = toBN(dec(40, 18))
      await borrowerOperations.adjustTrove([], [], [], [], th._100pct, toBN(USDERequest_D), true, D, D, {
        from: D
      })

      // Check D's USDE balance increased by their requested USDE
      const USDEBalanceAfter = await usdeToken.balanceOf(D)
      assert.isTrue(USDEBalanceAfter.eq(D_USDEBalBefore.add(USDERequest_D)))

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(A)
      const B_USDE = await usdeToken.balanceOf(B)
      const C_USDE = await usdeToken.balanceOf(C)
      const W_USDE = await usdeToken.balanceOf(whale)
      const expectedTotalSupply = A_USDE.add(B_USDE).add(C_USDE).add(USDEBalanceAfter).add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("5"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("adjustTrove(): reverts when calling address has no active trove", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })

      // Alice coll and debt increase(+1 ETH, +50USDE)
      await borrowerOperations.adjustTrove([], [], [], [], th._100pct, toBN(dec(50, 18)), true, D, D, {
        from: alice,
        value: toBN(dec(1, 'ether'))
      })

      try {
        const txCarol = await borrowerOperations.adjustTrove([], [], [], [], th._100pct, toBN(dec(50, 18)), true, D, D, {
          from: carol,
          value: toBN(dec(1, 'ether'))
        })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustTrove(): reverts in Recovery Mode when the adjustment would reduce the TCR", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })

      assert.isFalse(await th.checkRecoveryMode(contracts))

      const txAlice = await borrowerOperations.adjustTrove([], [], [], [], th._100pct, toBN(dec(50, 18)), true, alice, alice, {
        from: alice,
        value: toBN(dec(1, 'ether'))
      })
      assert.isTrue(txAlice.receipt.status)

      await priceFeed.setPrice(dec(120, 18)) // trigger drop in ETH price

      assert.isTrue(await th.checkRecoveryMode(contracts))

      try { // collateral withdrawal should also fail
        const txAlice = await borrowerOperations.adjustTrove([], [], [contracts.weth.address], [toBN(dec(1, 'ether'))], th._100pct, 0, false, alice, alice, {
          from: alice
        })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try { // debt increase should fail
        const txBob = await borrowerOperations.adjustTrove([], [], [], [], th._100pct, toBN(dec(50, 18)), true, bob, bob, {
          from: bob
        })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try { // debt increase that's also a collateral increase should also fail, if ICR will be worse off
        const txBob = await borrowerOperations.adjustTrove([], [], [], [], th._100pct, toBN(dec(111, 18)), true, bob, bob, {
          from: bob,
          value: toBN(dec(1, 'ether'))
        })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustTrove(): collateral withdrawal reverts in Recovery Mode", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(120, 18)) // trigger drop in ETH price

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Alice attempts an adjustment that repays half her debt BUT withdraws 1 wei collateral, and fails
      await assertRevert(
        borrowerOperations.adjustTrove([], [], [contracts.weth.address], [toBN(1)], th._100pct, dec(5000, 18), false, alice, alice, {
          from: alice
        }),
        "16") // Collateral withdrawal not permitted Recovery Mode
    })

    it("adjustTrove(): debt increase that would leave ICR < 150% reverts in Recovery Mode", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })
      const CCR = await collateralManager.getCCR()

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(120, 18)) // trigger drop in ETH price

      assert.isTrue(await th.checkRecoveryMode(contracts))

      const ICR_A = await th.getCurrentICR(contracts, alice)

      const aliceDebt = await getTroveEntireDebt(alice)
      const aliceColl = await getTroveEntireColl(alice)
      const debtIncrease = toBN(dec(50, 18))
      const collIncrease = toBN(dec(1, 'ether'))

      // Check the new ICR would be an improvement, but less than the CCR (150%)
      const newICR = await collateralManager.computeICR([contracts.weth.address], [aliceColl[0].add(collIncrease)], aliceDebt.add(debtIncrease))

      assert.isTrue(newICR.gt(ICR_A) && newICR.lt(CCR))

      await assertRevert(
        borrowerOperations.adjustTrove([], [], [], [], th._100pct, debtIncrease, true, alice, alice, {
          from: alice,
          value: collIncrease
        }),
        "19") // Operation must leave trove with ICR >= CCR
    })

    it("adjustTrove(): debt increase that would reduce the ICR reverts in Recovery Mode", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(3, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })
      const CCR = await collateralManager.getCCR()

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(103, 18)) // trigger drop in ETH price

      assert.isTrue(await th.checkRecoveryMode(contracts))

      //--- Alice with ICR > 150% tries to reduce her ICR ---

      const ICR_A = await th.getCurrentICR(contracts, alice)

      // Check Alice's initial ICR is above 150%
      assert.isTrue(ICR_A.gt(CCR))

      const aliceDebt = await getTroveEntireDebt(alice)
      const aliceColl = await getTroveEntireColl(alice)
      const aliceDebtIncrease = toBN(dec(150, 18))
      const aliceCollIncrease = toBN(dec(1, 'ether'))

      const newICR_A = await collateralManager.computeICR([contracts.weth.address], [aliceColl[0].add(aliceCollIncrease)], aliceDebt.add(aliceDebtIncrease))

      // Check Alice's new ICR would reduce but still be greater than 150%
      assert.isTrue(newICR_A.lt(ICR_A) && newICR_A.gt(CCR))

      await assertRevert(
        borrowerOperations.adjustTrove([], [], [], [], th._100pct, aliceDebtIncrease, true, alice, alice, {
          from: alice,
          value: aliceCollIncrease
        }),
        "17") // Cannot decrease your Trove's ICR in Recovery Mode

      //--- Bob with ICR < 130% tries to reduce his ICR ---

      const ICR_B = await th.getCurrentICR(contracts, bob)

      // Check Bob's initial ICR is below 150%
      assert.isTrue(ICR_B.lt(CCR))

      const bobDebt = await getTroveEntireDebt(bob)
      const bobColl = await getTroveEntireColl(bob)
      const bobDebtIncrease = toBN(dec(450, 18))
      const bobCollIncrease = toBN(dec(1, 'ether'))

      const newICR_B = await collateralManager.computeICR([contracts.weth.address], [bobColl[0].add(bobCollIncrease)], bobDebt.add(bobDebtIncrease))

      // Check Bob's new ICR would reduce 
      assert.isTrue(newICR_B.lt(ICR_B))

      await assertRevert(
        borrowerOperations.adjustTrove([], [], [], [], th._100pct, bobDebtIncrease, true, bob, bob, {
          from: bob,
          bobCollIncrease
        }),
        "19") // Operation must leave trove with ICR >= CCR
    })

    it("adjustTrove(): A trove with ICR < CCR in Recovery Mode can adjust their trove to ICR > CCR", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })
      const CCR = await collateralManager.getCCR()

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(100, 18)) // trigger drop in ETH price

      assert.isTrue(await th.checkRecoveryMode(contracts))

      const ICR_A = await th.getCurrentICR(contracts, alice)
      // Check initial ICR is below 130%
      assert.isTrue(ICR_A.lt(CCR))

      const aliceDebt = await getTroveEntireDebt(alice)
      const aliceColl = await getTroveEntireColl(alice)
      const debtIncrease = toBN(dec(5000, 18))
      const collIncrease = toBN(dec(150, 'ether'))

      const newICR = await collateralManager.computeICR([contracts.weth.address], [aliceColl[0].add(collIncrease)], aliceDebt.add(debtIncrease))

      // Check new ICR would be > 150%
      assert.isTrue(newICR.gt(CCR))

      const tx = await borrowerOperations.adjustTrove([], [], [], [], th._100pct, debtIncrease, true, alice, alice, {
        from: alice,
        value: collIncrease
      })
      assert.isTrue(tx.receipt.status)

      const actualNewICR = await th.getCurrentICR(contracts, alice)
      assert.isTrue(actualNewICR.gt(CCR))

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(alice)
      const B_USDE = await usdeToken.balanceOf(bob)
      const expectedTotalSupply = A_USDE.add(B_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("2"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("adjustTrove(): A trove with ICR > CCR in Recovery Mode can improve their ICR", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(3, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })
      const CCR = await collateralManager.getCCR()

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(103, 18)) // trigger drop in ETH price

      assert.isTrue(await th.checkRecoveryMode(contracts))

      const initialICR = await th.getCurrentICR(contracts, alice)
      // Check initial ICR is above 130%
      assert.isTrue(initialICR.gt(CCR))

      const aliceColl = await getTroveEntireColl(alice)
      const aliceDebt = await getTroveEntireDebt(alice)
      const debtIncrease = toBN(dec(5000, 18))
      const collIncrease = toBN(dec(150, 'ether'))

      const newICR = await collateralManager.computeICR([contracts.weth.address], [aliceColl[0].add(collIncrease)], aliceDebt.add(debtIncrease))

      // Check new ICR would be > old ICR
      assert.isTrue(newICR.gt(initialICR))
      const treasuryUSDE_before = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE_before = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_before = treasuryUSDE_before.add(liquidityIncentiveUSDE_before)
      const tx = await borrowerOperations.adjustTrove([], [], [], [], th._100pct, debtIncrease, true, alice, alice, {
        from: alice,
        value: collIncrease
      })
      assert.isTrue(tx.receipt.status)

      const actualNewICR = await th.getCurrentICR(contracts, alice)
      assert.isTrue(actualNewICR.gt(initialICR))

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_after = treasuryUSDE.add(liquidityIncentiveUSDE)
      assert.isTrue(fee_after.gt(fee_before))
      const A_USDE = await usdeToken.balanceOf(alice)
      const B_USDE = await usdeToken.balanceOf(bob)
      const expectedTotalSupply = A_USDE.add(B_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("2"))).add(fee_after)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("adjustTrove(): debt increase in Recovery Mode charges 0.25% fee", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(200000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(120, 18)) // trigger drop in ETH price

      assert.isTrue(await th.checkRecoveryMode(contracts))
      const treasuryUSDEBalanceBefore = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDEBefore = await usdeToken.balanceOf(liquidityIncentive.address)
      const feeBefore = treasuryUSDEBalanceBefore.add(liquidityIncentiveUSDEBefore)
      assert.isTrue(feeBefore.gt(toBN('0')))

      const txAlice = await borrowerOperations.adjustTrove([], [], [], [], th._100pct, toBN(dec(50, 18)), true, alice, alice, {
        from: alice,
        value: toBN(dec(100, 'ether'))
      })
      assert.isTrue(txAlice.receipt.status)

      // Check emitted fee = 0
      const emittedFee = toBN(await th.getEventArgByName(txAlice, 'USDEBorrowingFeePaid', '_USDEFee'))
      assert.isTrue(emittedFee.gt(toBN('0')))
      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Check no fee was sent to staking contract
      const treasuryUSDEBalanceAfter = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDEAfter = await usdeToken.balanceOf(liquidityIncentive.address)
      const feeAfter = treasuryUSDEBalanceAfter.add(liquidityIncentiveUSDEAfter)

      th.assertIsApproximatelyEqual(feeAfter, feeBefore.add(emittedFee), toBN(dec(1, 15)))

      const A_USDE = await usdeToken.balanceOf(alice)
      const B_USDE = await usdeToken.balanceOf(bob)
      const expectedTotalSupply = A_USDE.add(B_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("2"))).add(feeAfter)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("adjustTrove(): reverts when change would cause the TCR of the system to fall below the CCR", async () => {
      await openTrove({
        ICR: toBN(dec(131, 16)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        ICR: toBN(dec(130, 16)),
        extraParams: {
          from: bob
        }
      })

      // Check TCR and Recovery Mode
      const TCR = await th.getTCR(contracts)
      assert.isTrue(TCR.gt(toBN(dec(130, 16))))
      assert.isFalse(await th.checkRecoveryMode(contracts))

      // Bob attempts an operation that would bring the TCR below the CCR
      try {
        const txBob = await borrowerOperations.adjustTrove([], [], [], [], th._100pct, toBN(dec(20, 18)), true, bob, bob, {
          from: bob
        })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustTrove(): reverts when USDE repaid is > debt of the trove", async () => {
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      const bobOpenTx = (await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })).tx

      const bobDebt = await getTroveEntireDebt(bob)
      assert.isTrue(bobDebt.gt(toBN('0')))

      const bobFee = toBN(await th.getEventArgByIndex(bobOpenTx, 'USDEBorrowingFeePaid', 1))
      assert.isTrue(bobFee.gt(toBN('0')))

      // Alice transfers USDE to bob to compensate borrowing fees
      await usdeToken.transfer(bob, bobFee, {
        from: alice
      })

      const remainingDebt = (await getTroveEntireDebt(bob)).sub(USDE_GAS_COMPENSATION)

      // Bob attempts an adjustment that would repay 1 wei more than his debt
      await assertRevert(
        borrowerOperations.adjustTrove([], [], [], [], th._100pct, remainingDebt.add(toBN(1)), false, bob, bob, {
          from: bob,
          value: toBN(dec(1, 'ether'))
        }),
        "revert"
      )
    })

    it("adjustTrove(): reverts when attempted ETH withdrawal is >= the trove's collateral", async () => {
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: carol
        }
      })

      const carolColl = await getTroveEntireColl(carol)

      // Carol attempts an adjustment that would withdraw 1 wei more than her ETH
      try {
        const txCarol = await borrowerOperations.adjustTrove([], [], [contracts.weth.address], [carolColl[0].add(toBN(1))], th._100pct, 0, false, carol, carol, {
          from: carol
        })
        //borrowerOperations.adjustTrove(th._100pct, carolColl.add(toBN(1)), 0, true, carol, carol, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustTrove(): reverts when change would cause the ICR of the trove to fall below the MCR", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(100, 18)),
        extraParams: {
          from: whale
        }
      })

      await priceFeed.setPrice(dec(100, 18))

      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(11, 17)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(11, 17)),
        extraParams: {
          from: bob
        }
      })

      // Bob attempts to increase debt by 100 USDE and 1 ether, i.e. a change that constitutes a 100% ratio of coll:debt.
      // Since his ICR prior is 110%, this change would reduce his ICR below MCR.
      try {
        const txBob = await borrowerOperations.adjustTrove([], [], [], [], th._100pct, dec(100, 18), true, bob, bob, {
          from: bob,
          value: toBN(dec(1, 'ether'))
        })
        //borrowerOperations.adjustTrove(th._100pct, 0, dec(100, 18), true, bob, bob, { from: bob, value: dec(1, 'ether') })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustTrove(): With 0 coll change, doesnt change borrower's coll or ActivePool coll", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })

      const aliceCollBefore = await getTroveEntireColl(alice)
      const activePoolCollBefore = await activePool.getCollateralAmount(contracts.weth.address)

      assert.isTrue(aliceCollBefore[0].gt(toBN('0')))
      assert.isTrue(aliceCollBefore[0].eq(activePoolCollBefore))

      // Alice adjusts trove. No coll change, and a debt increase (+50USDE)
      await borrowerOperations.adjustTrove([], [], [], [], th._100pct, dec(50, 18), true, alice, alice, {
        from: alice
      })

      const aliceCollAfter = await getTroveEntireColl(alice)
      const activePoolCollAfter = await activePool.getCollateralAmount(contracts.weth.address)

      assert.isTrue(aliceCollAfter[0].eq(activePoolCollAfter))
      assert.isTrue(activePoolCollAfter.eq(activePoolCollAfter))
    })

    it("adjustTrove(): With 0 debt change, doesnt change borrower's debt or ActivePool debt", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })

      const aliceDebtBefore = await getTroveEntireDebt(alice)
      const activePoolDebtBefore = await activePool.getUSDEDebt()

      assert.isTrue(aliceDebtBefore.gt(toBN('0')))
      assert.isTrue(aliceDebtBefore.eq(activePoolDebtBefore))
      const treasuryUSDE_before = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE_before = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_before = treasuryUSDE_before.add(liquidityIncentiveUSDE_before)
      // Alice adjusts trove. Coll change, no debt change
      await borrowerOperations.adjustTrove([], [], [], [], th._100pct, 0, false, alice, alice, {
        from: alice,
        value: toBN(dec(1, 'ether'))
      })
      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_after = treasuryUSDE.add(liquidityIncentiveUSDE)
      assert.isTrue(fee_before.lt(fee_after))
      const aliceDebtAfter = await getTroveEntireDebt(alice)
      const activePoolDebtAfter = await activePool.getUSDEDebt()
      // switch to Ether because of variable borrow rate
      assert.isTrue(toEther(aliceDebtAfter).eq(toEther(aliceDebtBefore)))
      assert.isTrue(activePoolDebtAfter.eq(activePoolDebtBefore))
    })

    it("adjustTrove(): updates borrower's debt and coll with an increase in both", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })

      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: alice
        }
      })

      const debtBefore = await getTroveEntireDebt(alice)
      const collBefore = await getTroveEntireColl(alice)
      assert.isTrue(debtBefore.gt(toBN('0')))
      assert.isTrue(collBefore[0].gt(toBN('0')))

      // Alice adjusts trove. Coll and debt increase(+1 ETH, +50USDE)
      await borrowerOperations.adjustTrove([], [], [], [], th._100pct, await getNetBorrowingAmount(dec(50, 18)), true, alice, alice, {
        from: alice,
        value: toBN(dec(1, 'ether'))
      })

      const debtAfter = await getTroveEntireDebt(alice)
      const collAfter = await getTroveEntireColl(alice)

      th.assertIsApproximatelyEqual(debtAfter, debtBefore.add(toBN(dec(50, 18))), toBN(dec(1, 14)))
      th.assertIsApproximatelyEqual(collAfter[0], collBefore[0].add(toBN(dec(1, 18))), 10000)

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(alice)
      const W_USDE = await usdeToken.balanceOf(whale)
      const expectedTotalSupply = A_USDE.add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("2"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("adjustTrove(): updates borrower's debt and coll with a decrease in both", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })

      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: alice
        }
      })

      const debtBefore = await getTroveEntireDebt(alice)
      const collBefore = await getTroveEntireColl(alice)
      assert.isTrue(debtBefore.gt(toBN('0')))
      assert.isTrue(collBefore[0].gt(toBN('0')))
      const treasuryUSDE_before = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE_before = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_before = treasuryUSDE_before.add(liquidityIncentiveUSDE_before)
      // Alice adjusts trove coll and debt decrease (-0.5 ETH, -50USDE)
      await borrowerOperations.adjustTrove([], [], [contracts.weth.address], [toBN(dec(500, 'finney'))], th._100pct, toBN(dec(50, 18)), false, alice, alice, {
        from: alice
      })
      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_after = treasuryUSDE.add(liquidityIncentiveUSDE)
      assert.isTrue(fee_after.gt(fee_before))

      const debtAfter = await getTroveEntireDebt(alice)
      const collAfter = await getTroveEntireColl(alice)
      assert.isTrue(toEther(debtAfter).eq(toEther(debtBefore).sub(toBN(50))))
      assert.isTrue(collAfter[0].eq(collBefore[0].sub(toBN(dec(5, 17)))))

      const A_USDE = await usdeToken.balanceOf(alice)
      const W_USDE = await usdeToken.balanceOf(whale)
      const expectedTotalSupply = A_USDE.add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("2"))).add(fee_after)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("adjustTrove(): updates borrower's  debt and coll with coll increase, debt decrease", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })

      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: alice
        }
      })

      const debtBefore = await getTroveEntireDebt(alice)
      const collBefore = await getTroveEntireColl(alice)
      assert.isTrue(debtBefore.gt(toBN('0')))
      assert.isTrue(collBefore[0].gt(toBN('0')))

      const treasuryUSDE_before = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE_before = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_before = treasuryUSDE_before.add(liquidityIncentiveUSDE_before)

      // Alice adjusts trove - coll increase and debt decrease (+0.5 ETH, -50USDE)
      await borrowerOperations.adjustTrove([], [], [], [], th._100pct, toBN(dec(50, 18)), false, alice, alice, {
        from: alice,
        value: toBN(dec(500, 'finney'))
      })
      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_after = treasuryUSDE.add(liquidityIncentiveUSDE)
      assert.isTrue(fee_after.gt(fee_before))

      const debtAfter = await getTroveEntireDebt(alice)
      const collAfter = await getTroveEntireColl(alice)

      th.assertIsApproximatelyEqual(debtAfter, debtBefore.sub(toBN(dec(50, 18))), toBN(dec(1, 14)))
      th.assertIsApproximatelyEqual(collAfter[0], collBefore[0].add(toBN(dec(5, 17))), 10000)

      const A_USDE = await usdeToken.balanceOf(alice)
      const W_USDE = await usdeToken.balanceOf(whale)
      const expectedTotalSupply = A_USDE.add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("2"))).add(fee_after)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("adjustTrove(): updates borrower's debt and coll with coll decrease, debt increase", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })

      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: alice
        }
      })

      const debtBefore = await getTroveEntireDebt(alice)
      const collBefore = await getTroveEntireColl(alice)
      assert.isTrue(debtBefore.gt(toBN('0')))
      assert.isTrue(collBefore[0].gt(toBN('0')))

      // Alice adjusts trove - coll decrease and debt increase (0.1 ETH, 10USDE)
      await borrowerOperations.adjustTrove([], [], [contracts.weth.address], [toBN(dec(1, 17))], th._100pct, await getNetBorrowingAmount(dec(1, 18)), true, alice, alice, {
        from: alice
      })

      const debtAfter = await getTroveEntireDebt(alice)
      const collAfter = await getTroveEntireColl(alice)

      th.assertIsApproximatelyEqual(debtAfter, debtBefore.add(toBN(dec(1, 18))), toBN(dec(1, 14)))
      th.assertIsApproximatelyEqual(collAfter[0], collBefore[0].sub(toBN(dec(1, 17))), 10000)

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(alice)
      const W_USDE = await usdeToken.balanceOf(whale)
      const expectedTotalSupply = A_USDE.add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("2"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("adjustTrove(): updates borrower's stake and totalStakes with a coll increase", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })

      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: alice
        }
      })

      const stakeBefore = await troveManager.getTroveStake(alice, contracts.weth.address)
      const totalStakesBefore = await th.getTotalStake(contracts, contracts.weth.address)
      assert.isTrue(stakeBefore.gt(toBN('0')))
      assert.isTrue(totalStakesBefore.gt(toBN('0')))

      // Alice adjusts trove - coll and debt increase (+1 ETH, +50 USDE)
      await borrowerOperations.adjustTrove([], [], [], [], th._100pct, toBN(dec(50, 18)), true, alice, alice, {
        from: alice,
        value: toBN(dec(1, 'ether'))
      })

      const stakeAfter = await troveManager.getTroveStake(alice, contracts.weth.address)
      const totalStakesAfter = await th.getTotalStake(contracts, contracts.weth.address)

      assert.isTrue(stakeAfter.eq(stakeBefore.add(toBN(dec(1, 18)))))
      assert.isTrue(totalStakesAfter.eq(totalStakesBefore.add(toBN(dec(1, 18)))))

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(alice)
      const W_USDE = await usdeToken.balanceOf(whale)
      const expectedTotalSupply = A_USDE.add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("2"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("adjustTrove():  updates borrower's stake and totalStakes with a coll decrease", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })

      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: alice
        }
      })

      const stakeBefore = await troveManager.getTroveStake(alice, contracts.weth.address)
      const totalStakesBefore = await th.getTotalStake(contracts, contracts.weth.address)
      assert.isTrue(stakeBefore.gt(toBN('0')))
      assert.isTrue(totalStakesBefore.gt(toBN('0')))

      const treasuryUSDE_before = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE_before = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_before = treasuryUSDE_before.add(liquidityIncentiveUSDE_before)
      // Alice adjusts trove - coll decrease and debt decrease
      await borrowerOperations.adjustTrove([], [], [contracts.weth.address], [toBN(dec(500, 'finney'))], th._100pct, toBN(dec(50, 18)), false, alice, alice, {
        from: alice
      })
      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_after = treasuryUSDE.add(liquidityIncentiveUSDE)
      assert.isTrue(fee_after.gt(fee_before))

      const stakeAfter = await troveManager.getTroveStake(alice, contracts.weth.address)
      const totalStakesAfter = await th.getTotalStake(contracts, contracts.weth.address)

      assert.isTrue(stakeAfter.eq(stakeBefore.sub(toBN(dec(5, 17)))))
      assert.isTrue(totalStakesAfter.eq(totalStakesBefore.sub(toBN(dec(5, 17)))))

      const A_USDE = await usdeToken.balanceOf(alice)
      const W_USDE = await usdeToken.balanceOf(whale)
      const expectedTotalSupply = A_USDE.add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("2"))).add(fee_after)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("adjustTrove(): changes USDEToken balance by the requested decrease", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })

      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: alice
        }
      })

      const alice_USDETokenBalance_Before = await usdeToken.balanceOf(alice)
      assert.isTrue(alice_USDETokenBalance_Before.gt(toBN('0')))
      const treasuryUSDE_before = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE_before = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_before = treasuryUSDE_before.add(liquidityIncentiveUSDE_before)

      // Alice adjusts trove - coll decrease and debt decrease
      await borrowerOperations.adjustTrove([], [], [contracts.weth.address], [toBN(dec(100, 'finney'))], th._100pct, toBN(dec(10, 18)), false, alice, alice, {
        from: alice
      })
      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_after = treasuryUSDE.add(liquidityIncentiveUSDE)
      assert.isTrue(fee_after.gt(fee_before))

      // check after
      const alice_USDETokenBalance_After = await usdeToken.balanceOf(alice)
      assert.isTrue(alice_USDETokenBalance_After.eq(alice_USDETokenBalance_Before.sub(toBN(dec(10, 18)))))

      const A_USDE = await usdeToken.balanceOf(alice)
      const W_USDE = await usdeToken.balanceOf(whale)
      const expectedTotalSupply = A_USDE.add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("2"))).add(fee_after)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("adjustTrove(): changes USDEToken balance by the requested increase", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })

      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: alice
        }
      })

      const alice_USDETokenBalance_Before = await usdeToken.balanceOf(alice)
      assert.isTrue(alice_USDETokenBalance_Before.gt(toBN('0')))

      // Alice adjusts trove - coll increase and debt increase
      await borrowerOperations.adjustTrove([], [], [], [], th._100pct, toBN(dec(100, 18)), true, alice, alice, {
        from: alice,
        value: toBN(dec(1, 'ether'))
      })

      // check after
      const alice_USDETokenBalance_After = await usdeToken.balanceOf(alice)
      assert.isTrue(alice_USDETokenBalance_After.eq(alice_USDETokenBalance_Before.add(toBN(dec(100, 18)))))

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const W_USDE = await usdeToken.balanceOf(whale)
      const expectedTotalSupply = alice_USDETokenBalance_After.add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("2"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("adjustTrove(): Changes the activePool ETH and raw ether balance by the requested decrease", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })

      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: alice
        }
      })

      const activePool_ETH_Before = await activePool.getCollateralAmount(contracts.weth.address)
      const activePool_RawEther_Before = toBN(await contracts.weth.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_Before.gt(toBN('0')))
      assert.isTrue(activePool_RawEther_Before.gt(toBN('0')))
      const treasuryUSDE_before = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE_before = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_before = treasuryUSDE_before.add(liquidityIncentiveUSDE_before)

      // Alice adjusts trove - coll decrease and debt decrease
      await borrowerOperations.adjustTrove([], [], [contracts.weth.address], [toBN(dec(100, 'finney'))], th._100pct, toBN(dec(10, 18)), false, alice, alice, {
        from: alice
      })
      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_after = treasuryUSDE.add(liquidityIncentiveUSDE)
      assert.isTrue(fee_after.gt(fee_before))

      const activePool_ETH_After = await activePool.getCollateralAmount(contracts.weth.address)
      const activePool_RawEther_After = toBN(await contracts.weth.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_After.eq(activePool_ETH_Before.sub(toBN(dec(1, 17)))))
      assert.isTrue(activePool_RawEther_After.eq(activePool_ETH_Before.sub(toBN(dec(1, 17)))))

      const A_USDE = await usdeToken.balanceOf(alice)
      const W_USDE = await usdeToken.balanceOf(whale)
      const expectedTotalSupply = A_USDE.add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("2"))).add(fee_after)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("adjustTrove(): Changes the activePool ETH and raw ether balance by the amount of ETH sent", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })

      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: alice
        }
      })

      const activePool_ETH_Before = await activePool.getCollateralAmount(contracts.weth.address)
      const activePool_RawEther_Before = toBN(await contracts.weth.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_Before.gt(toBN('0')))
      assert.isTrue(activePool_RawEther_Before.gt(toBN('0')))

      // Alice adjusts trove - coll increase and debt increase
      await borrowerOperations.adjustTrove([], [], [], [], th._100pct, toBN(dec(100, 18)), true, alice, alice, {
        from: alice,
        value: toBN(dec(1, 'ether'))
      })

      const activePool_ETH_After = await activePool.getCollateralAmount(contracts.weth.address)
      const activePool_RawEther_After = toBN(await contracts.weth.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_After.eq(activePool_ETH_Before.add(toBN(dec(1, 18)))))
      assert.isTrue(activePool_RawEther_After.eq(activePool_ETH_Before.add(toBN(dec(1, 18)))))

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(alice)
      const W_USDE = await usdeToken.balanceOf(whale)
      const expectedTotalSupply = A_USDE.add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("2"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("adjustTrove(): Changes the USDE debt in ActivePool by requested decrease", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })

      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: alice
        }
      })

      const activePool_USDEDebt_Before = await activePool.getUSDEDebt()
      assert.isTrue(activePool_USDEDebt_Before.gt(toBN('0')))
      const treasuryUSDE_before = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE_before = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_before = treasuryUSDE_before.add(liquidityIncentiveUSDE_before)

      // Alice adjusts trove - coll increase and debt decrease
      await borrowerOperations.adjustTrove([], [], [], [], th._100pct, toBN(dec(30, 18)), false, alice, alice, {
        from: alice,
        value: toBN(dec(1, 'ether'))
      })
      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_after = treasuryUSDE.add(liquidityIncentiveUSDE)
      assert.isTrue(fee_after.gt(fee_before))

      const activePool_USDEDebt_After = await activePool.getUSDEDebt()
      assert.isTrue(activePool_USDEDebt_After.eq(activePool_USDEDebt_Before.sub(toBN(dec(30, 18)))))

      const A_USDE = await usdeToken.balanceOf(alice)
      const W_USDE = await usdeToken.balanceOf(whale)
      const expectedTotalSupply = A_USDE.add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("2"))).add(fee_after)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("adjustTrove(): Changes the USDE debt in ActivePool by requested increase", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: alice
        }
      })

      const activePool_USDEDebt_Before = await activePool.getUSDEDebt()
      assert.isTrue(activePool_USDEDebt_Before.gt(toBN('0')))

      // Alice adjusts trove - coll increase and debt increase
      await borrowerOperations.adjustTrove([], [], [], [], th._100pct, toBN(await getNetBorrowingAmount(dec(100, 18))), true, alice, alice, {
        from: alice,
        value: toBN(dec(1, 'ether'))
      })

      const activePool_USDEDebt_After = await activePool.getUSDEDebt()

      th.assertIsApproximatelyEqual(activePool_USDEDebt_After, activePool_USDEDebt_Before.add(toBN(dec(100, 18))))

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const A_USDE = await usdeToken.balanceOf(alice)
      const W_USDE = await usdeToken.balanceOf(whale)
      const expectedTotalSupply = A_USDE.add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("2"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("adjustTrove(): new coll = 0 and new debt = 0 is not allowed, as gas compensation still counts toward ICR", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })

      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: alice
        }
      })
      const aliceColl = await getTroveEntireColl(alice)
      const aliceDebt = await getTroveEntireDebt(alice)
      const status_Before = await troveManager.getTroveStatus(alice)
      const isInSortedList_Before = await sortedTroves.contains(alice)

      assert.equal(status_Before, 1) // 1: Active
      assert.isTrue(isInSortedList_Before)

      await assertRevert(
        borrowerOperations.adjustTrove([], [], [contracts.weth.address], [aliceColl[0]], th._100pct, aliceDebt, true, alice, alice, {
          from: alice
        }),
        '18'
      ) // An operation that would result in ICR < MCR is not permitted
    })

    it("adjustTrove(): Reverts if requested debt increase and amount is zero", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: alice
        }
      })

      await assertRevert(
        borrowerOperations.adjustTrove([], [], [], [], th._100pct, 0, true, alice, alice, {
          from: alice
        }),
        '2')  // Debt increase requires non-zero debtChange
    })

    it("adjustTrove(): Reverts if requested coll withdrawal and ether is sent", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: alice
        }
      })

      await assertRevert(
        borrowerOperations.adjustTrove([], [], [contracts.weth.address], [dec(3, 'ether')], th._100pct, dec(100, 18), true, alice, alice, {
          from: alice,
          value: dec(3, 'ether')
        }),
        '13') // Cannot withdraw and add Coll
    })

    it("adjustTrove(): Reverts if it's zero adjustment", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: alice
        }
      })

      await assertRevert(
        borrowerOperations.adjustTrove([], [], [], [], th._100pct, 0, false, alice, alice, {
          from: alice
        }),
        '14') // There must be either a collateral change or a debt change
    })

    it("adjustTrove(): Reverts if requested coll withdrawal is greater than trove's collateral", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: alice
        }
      })

      const aliceColl = await getTroveEntireColl(alice)

      // Requested coll withdrawal > coll in the trove
      await assertRevert(
        borrowerOperations.adjustTrove([], [], [contracts.weth.address], [aliceColl[0].add(toBN(1))], th._100pct, 0, false, alice, alice, {
          from: alice
        })
      )
      await assertRevert(
        borrowerOperations.adjustTrove([], [], [contracts.weth.address], [aliceColl[0].add(toBN(dec(37, 'ether')))], th._100pct, 0, false, bob, bob, {
          from: bob
        })
      )
    })

    it("adjustTrove(): Reverts if borrower has insufficient USDE balance to cover his debt repayment", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: B
        }
      })
      const bobDebt = await getTroveEntireDebt(B)

      // Bob transfers some USDE to carol
      await usdeToken.transfer(C, dec(10, 18), {
        from: B
      })

      //Confirm B's USDE balance is less than 50 USDE
      const B_USDEBal = await usdeToken.balanceOf(B)
      assert.isTrue(B_USDEBal.lt(bobDebt))

      const repayUSDEPromise_B = borrowerOperations.adjustTrove([], [], [], [], th._100pct, bobDebt, false, B, B, {
        from: B
      })

      // B attempts to repay all his debt
      await assertRevert(repayUSDEPromise_B, "revert")
    })

    // --- closeTrove() ---

    it("closeTrove(): reverts when it would lower the TCR below CCR", async () => {
      await openTrove({
        ICR: toBN(dec(300, 16)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        ICR: toBN(dec(120, 16)),
        extraUSDEAmount: toBN(dec(300, 18)),
        extraParams: {
          from: bob
        }
      })

      // to compensate borrowing fees
      await usdeToken.transfer(alice, dec(300, 18), {
        from: bob
      })
      console.log("TCR", (await th.getTCR(contracts)).toString())
      assert.isFalse(await th.checkRecoveryMode(contracts))

      await assertRevert(
        borrowerOperations.closeTrove({
          from: alice
        }),
        "20"
      ) // An operation that would result in TCR < CCR is not permitted
    })

    it("closeTrove(): reverts when calling address does not have active trove", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: bob
        }
      })

      // Carol with no active trove attempts to close her trove
      try {
        const txCarol = await borrowerOperations.closeTrove({
          from: carol
        })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("closeTrove(): reverts when system is in Recovery Mode", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(100000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: carol
        }
      })

      // Alice transfers her USDE to Bob and Carol so they can cover fees
      const aliceBal = await usdeToken.balanceOf(alice)
      await usdeToken.transfer(bob, aliceBal.div(toBN(2)), {
        from: alice
      })
      await usdeToken.transfer(carol, aliceBal.div(toBN(2)), {
        from: alice
      })

      // check Recovery Mode 
      assert.isFalse(await th.checkRecoveryMode(contracts))

      // Bob successfully closes his trove
      const txBob = await borrowerOperations.closeTrove({
        from: bob
      })
      assert.isTrue(txBob.receipt.status)

      await priceFeed.setPrice(dec(100, 18))

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Carol attempts to close her trove during Recovery Mode
      await assertRevert(borrowerOperations.closeTrove({
        from: carol
      }), "4")  // Operation not permitted during Recovery Mode
    })

    it("closeTrove(): reverts when trove is the only one in the system", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(100000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })

      // Artificially mint to Alice so she has enough to close her trove
      await usdeToken.unprotectedMint(alice, dec(100000, 18))

      // Check she has more USDE than her trove debt
      const aliceBal = await usdeToken.balanceOf(alice)
      const aliceDebt = await getTroveEntireDebt(alice)
      assert.isTrue(aliceBal.gt(aliceDebt))

      // check Recovery Mode
      assert.isFalse(await th.checkRecoveryMode(contracts))

      // Alice attempts to close her trove
      // Only one trove in the system
      await assertRevert(borrowerOperations.closeTrove({
        from: alice
      }), "84")
    })

    it("closeTrove(): reduces a Trove's collateral to zero", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: dennis
        }
      })

      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })

      const aliceCollBefore = toBN((await (getTroveEntireColl(alice)))[0])
      const dennisUSDE = await usdeToken.balanceOf(dennis)
      assert.isTrue(aliceCollBefore.gt(toBN('0')))
      assert.isTrue(dennisUSDE.gt(toBN('0')))

      // To compensate borrowing fees
      await usdeToken.transfer(alice, dennisUSDE.div(toBN(2)), {
        from: dennis
      })
      const treasuryUSDE_before = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE_before = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_before = treasuryUSDE_before.add(liquidityIncentiveUSDE_before)
      const A_debt = await troveManager.getTroveDebt(alice)
      // Alice attempts to close trove
      await borrowerOperations.closeTrove({
        from: alice
      })
      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_after = treasuryUSDE.add(liquidityIncentiveUSDE)
      assert.isTrue(fee_after.gt(fee_before))

      const aliceCollAfter = await getTroveEntireColl(alice)
      assert.isTrue(aliceCollAfter.length == 0)

      const A_USDE = await usdeToken.balanceOf(alice)
      const D_USDE = await usdeToken.balanceOf(dennis)
      const expectedTotalSupply = A_USDE.add(D_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("1"))).add(fee_after)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("closeTrove(): reduces a Trove's debt to zero", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: dennis
        }
      })

      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })

      const aliceDebtBefore = await getTroveEntireDebt(alice)
      const dennisUSDE = await usdeToken.balanceOf(dennis)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))
      assert.isTrue(dennisUSDE.gt(toBN('0')))

      // To compensate borrowing fees
      await usdeToken.transfer(alice, dennisUSDE.div(toBN(2)), {
        from: dennis
      })
      const treasuryUSDE_before = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE_before = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_before = treasuryUSDE_before.add(liquidityIncentiveUSDE_before)

      // Alice attempts to close trove
      await borrowerOperations.closeTrove({
        from: alice
      })
      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_after = treasuryUSDE.add(liquidityIncentiveUSDE)
      assert.isTrue(fee_after.gt(fee_before))

      const aliceCollAfter = await getTroveEntireColl(alice)
      assert.isTrue(th.isZeroArray(aliceCollAfter))
      assert.equal(aliceCollAfter, 0)

      const A_USDE = await usdeToken.balanceOf(alice)
      const D_USDE = await usdeToken.balanceOf(dennis)
      const expectedTotalSupply = A_USDE.add(D_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("1"))).add(fee_after)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("closeTrove(): sets Trove's stake to zero", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: dennis
        }
      })

      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      const aliceStakeBefore = await troveManager.getTroveStake(alice, contracts.weth.address)
      assert.isTrue(aliceStakeBefore.gt(toBN('0')))

      const dennisUSDE = await usdeToken.balanceOf(dennis)
      assert.isTrue(aliceStakeBefore.gt(toBN('0')))
      assert.isTrue(dennisUSDE.gt(toBN('0')))

      // To compensate borrowing fees
      await usdeToken.transfer(alice, dennisUSDE.div(toBN(2)), {
        from: dennis
      })
      const treasuryUSDE_before = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE_before = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_before = treasuryUSDE_before.add(liquidityIncentiveUSDE_before)

      // Alice attempts to close trove
      await borrowerOperations.closeTrove({
        from: alice
      })
      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_after = treasuryUSDE.add(liquidityIncentiveUSDE)
      assert.isTrue(fee_after.gt(fee_before))

      const stakeAfter = ((await troveManager.getTroveStake(alice, contracts.weth.address))).toString()
      assert.equal(stakeAfter, '0')
      // check withdrawal was successful

      const A_USDE = await usdeToken.balanceOf(alice)
      const D_USDE = await usdeToken.balanceOf(dennis)
      const expectedTotalSupply = A_USDE.add(D_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("1"))).add(fee_after)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("closeTrove(): zero's the troves reward snapshots", async () => {
      // Dennis opens trove and transfers tokens to alice
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: dennis
        }
      })

      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })

      // Price drops
      // console.log("price drops to 100")
      await priceFeed.setPrice(dec(100, 18))

      // Liquidate Bob
      await troveManager.liquidate(bob)
      assert.isFalse(await sortedTroves.contains(bob))

      // console.log("price bounces back to 200")
      // Price bounces back
      await priceFeed.setPrice(dec(200, 18))

      // Alice and Carol open troves
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: carol
        }
      })

      // Price drops ...again
      // console.log("Price drops again to 100")
      await priceFeed.setPrice(dec(100, 18))

      // Get Alice's pending reward snapshots 

      const E_ETH_A_Snapshot = await troveManager.getRewardSnapshotColl(alice, contracts.weth.address)
      const E_USDEDebt_A_Snapshot = await troveManager.getRewardSnapshotUSDE(alice, contracts.weth.address)

      assert.isTrue(E_ETH_A_Snapshot.gt(toBN('0')))
      assert.isTrue(E_USDEDebt_A_Snapshot.gt(toBN('0')))

      // Liquidate Carol
      await troveManager.liquidate(carol)
      assert.isFalse(await sortedTroves.contains(carol))

      // Get Alice's pending reward snapshots after Carol's liquidation. Check above 0
      const E_ETH_Snapshot_A_AfterLiquidation = await troveManager.getRewardSnapshotColl(alice, contracts.weth.address)
      const E_USDEDebt_Snapshot_A_AfterLiquidation = await troveManager.getRewardSnapshotUSDE(alice, contracts.weth.address)

      assert.isTrue(E_ETH_Snapshot_A_AfterLiquidation.gt(toBN('0')))
      assert.isTrue(E_USDEDebt_Snapshot_A_AfterLiquidation.gt(toBN('0')))

      // to compensate borrowing fees
      await usdeToken.transfer(alice, await usdeToken.balanceOf(dennis), {
        from: dennis
      })

      // console.log("Price raised to 200")
      await priceFeed.setPrice(dec(200, 18))

      const treasuryUSDE_before = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE_before = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_before = treasuryUSDE_before.add(liquidityIncentiveUSDE_before)

      // Alice closes trove
      await borrowerOperations.closeTrove({
        from: alice
      })
      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_after = treasuryUSDE.add(liquidityIncentiveUSDE)
      assert.isTrue(fee_after.gt(fee_before))

      // Check Alice's pending reward snapshots are zero
      const E_ETH_Snapshot_A_afterAliceCloses = await troveManager.getRewardSnapshotColl(alice, contracts.weth.address)
      const E_USDEDebt_Snapshot_A_afterAliceCloses = await troveManager.getRewardSnapshotUSDE(alice, contracts.weth.address)

      assert.equal(E_ETH_Snapshot_A_afterAliceCloses, '0')
      assert.equal(E_USDEDebt_Snapshot_A_afterAliceCloses, '0')

      const A_USDE = await usdeToken.balanceOf(alice)
      const B_USDE = await usdeToken.balanceOf(bob)
      const C_USDE = await usdeToken.balanceOf(carol)
      const D_USDE = await usdeToken.balanceOf(dennis)
      const expectedTotalSupply = A_USDE.add(B_USDE).add(C_USDE).add(D_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("3"))).add(fee_after)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("closeTrove(): sets trove's status to closed and removes it from sorted troves list", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: dennis
        }
      })

      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })

      // Check Trove is active
      const status_Before = await troveManager.getTroveStatus(alice)

      assert.equal(status_Before, 1)
      assert.isTrue(await sortedTroves.contains(alice))

      // to compensate borrowing fees
      await usdeToken.transfer(alice, await usdeToken.balanceOf(dennis), {
        from: dennis
      })
      const treasuryUSDE_before = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE_before = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_before = treasuryUSDE_before.add(liquidityIncentiveUSDE_before)

      // Close the trove
      await borrowerOperations.closeTrove({
        from: alice
      })

      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_after = treasuryUSDE.add(liquidityIncentiveUSDE)
      assert.isTrue(fee_after.gt(fee_before))

      const status_After = await troveManager.getTroveStatus(alice)

      assert.equal(status_After, 2)
      assert.isFalse(await sortedTroves.contains(alice))

      const A_USDE = await usdeToken.balanceOf(alice)
      const D_USDE = await usdeToken.balanceOf(dennis)
      const expectedTotalSupply = A_USDE.add(D_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("1"))).add(fee_after)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("closeTrove(): reduces ActivePool ETH and raw ether by correct amount", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: dennis
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })

      const dennisColl = await getTroveEntireColl(dennis)
      const aliceColl = await getTroveEntireColl(alice)
      assert.isTrue(dennisColl[0].gt('0'))
      assert.isTrue(aliceColl[0].gt('0'))

      // Check active Pool ETH before
      const activePool_ETH_before = await activePool.getCollateralAmount(contracts.weth.address)
      const activePool_RawEther_before = toBN(await contracts.weth.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_before.eq(aliceColl[0].add(dennisColl[0])))
      assert.isTrue(activePool_ETH_before.gt(toBN('0')))
      assert.isTrue(activePool_RawEther_before.eq(activePool_ETH_before))

      // to compensate borrowing fees
      await usdeToken.transfer(alice, await usdeToken.balanceOf(dennis), {
        from: dennis
      })

      const treasuryUSDE_before = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE_before = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_before = treasuryUSDE_before.add(liquidityIncentiveUSDE_before)

      // Close the trove
      await borrowerOperations.closeTrove({
        from: alice
      })
      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_after = treasuryUSDE.add(liquidityIncentiveUSDE)
      assert.isTrue(fee_after.gt(fee_before))

      // Check after
      const activePool_ETH_After = await activePool.getCollateralAmount(contracts.weth.address)
      const activePool_RawEther_After = toBN(await contracts.weth.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_After.eq(dennisColl[0]))
      assert.isTrue(activePool_RawEther_After.eq(dennisColl[0]))

      const A_USDE = await usdeToken.balanceOf(alice)
      const D_USDE = await usdeToken.balanceOf(dennis)
      const expectedTotalSupply = A_USDE.add(D_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("1"))).add(fee_after)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("closeTrove(): reduces ActivePool debt by correct amount", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: dennis
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })

      const dennisDebt = await getTroveEntireDebt(dennis)
      const aliceDebt = await getTroveEntireDebt(alice)
      assert.isTrue(dennisDebt.gt('0'))
      assert.isTrue(aliceDebt.gt('0'))

      // Check before, activePool's record does not include the interests
      const activePool_Debt_before = await activePool.getUSDEDebt()
      const totalDebt = await contracts.troveDebt.totalSupply()
      assert.isTrue(totalDebt.eq(aliceDebt.add(dennisDebt).sub(USDE_GAS_COMPENSATION).sub(USDE_GAS_COMPENSATION)))
      assert.isTrue(activePool_Debt_before.gt(toBN('0')))

      // to compensate borrowing fees
      await usdeToken.transfer(alice, await usdeToken.balanceOf(dennis), {
        from: dennis
      })
      const treasuryUSDE_before = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE_before = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_before = treasuryUSDE_before.add(liquidityIncentiveUSDE_before)

      // Close the trove
      await borrowerOperations.closeTrove({
        from: alice
      })
      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_after = treasuryUSDE.add(liquidityIncentiveUSDE)
      assert.isTrue(fee_after.gt(fee_before))

      // Check after
      const activePool_Debt_After = (await activePool.getUSDEDebt()).toString()
      th.assertIsApproximatelyEqual(activePool_Debt_After, dennisDebt, _1e14BN)

      const A_USDE = await usdeToken.balanceOf(alice)
      const D_USDE = await usdeToken.balanceOf(dennis)
      const expectedTotalSupply = A_USDE.add(D_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("1"))).add(fee_after)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("closeTrove(): updates the the total stakes", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: dennis
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })

      // Get individual stakes
      const aliceStakeBefore = await troveManager.getTroveStake(alice, contracts.weth.address)
      const bobStakeBefore = await troveManager.getTroveStake(bob, contracts.weth.address)
      const dennisStakeBefore = await troveManager.getTroveStake(dennis, contracts.weth.address)
      assert.isTrue(aliceStakeBefore.gt('0'))
      assert.isTrue(bobStakeBefore.gt('0'))
      assert.isTrue(dennisStakeBefore.gt('0'))

      const totalStakesBefore = await th.getTotalStake(contracts, contracts.weth.address)

      assert.isTrue(totalStakesBefore.eq(aliceStakeBefore.add(bobStakeBefore).add(dennisStakeBefore)))

      // to compensate borrowing fees
      await usdeToken.transfer(alice, await usdeToken.balanceOf(dennis), {
        from: dennis
      })
      const treasuryUSDE_before = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE_before = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_before = treasuryUSDE_before.add(liquidityIncentiveUSDE_before)

      // Alice closes trove
      await borrowerOperations.closeTrove({
        from: alice
      })
      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_after = treasuryUSDE.add(liquidityIncentiveUSDE)
      assert.isTrue(fee_after.gt(fee_before))

      // Check stake and total stakes get updated
      const aliceStakeAfter = await troveManager.getTroveStake(alice, contracts.weth.address)
      const totalStakesAfter = await th.getTotalStake(contracts, contracts.weth.address)

      assert.equal(aliceStakeAfter, 0)
      assert.isTrue(totalStakesAfter.eq(totalStakesBefore.sub(aliceStakeBefore)))

      const A_USDE = await usdeToken.balanceOf(alice)
      const B_USDE = await usdeToken.balanceOf(bob)
      const D_USDE = await usdeToken.balanceOf(dennis)
      const expectedTotalSupply = A_USDE.add(B_USDE).add(D_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("2"))).add(fee_after)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    if (!withProxy) { // TODO: wrap contracts.weth.balanceOf to be able to go through proxies
      it("closeTrove(): sends the correct amount of ETH to the user", async () => {
        await openTrove({
          extraUSDEAmount: toBN(dec(10000, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: {
            from: dennis
          }
        })
        await openTrove({
          extraUSDEAmount: toBN(dec(10000, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: {
            from: alice
          }
        })

        const aliceColl = await getTroveEntireColl(alice)
        assert.isTrue(aliceColl[0].gt(toBN('0')))

        const alice_ETHBalance_Before = toBN(await web3.eth.getBalance(alice))

        // to compensate borrowing fees
        await usdeToken.transfer(alice, await usdeToken.balanceOf(dennis), {
          from: dennis
        })
        const treasuryUSDE_before = await usdeToken.balanceOf(treasury.address)
        const liquidityIncentiveUSDE_before = await usdeToken.balanceOf(liquidityIncentive.address)
        const fee_before = treasuryUSDE_before.add(liquidityIncentiveUSDE_before)

        let tx = await borrowerOperations.closeTrove({
          from: alice
        })
        const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
        const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
        const fee_after = treasuryUSDE.add(liquidityIncentiveUSDE)
        assert.isTrue(fee_after.gt(fee_before))

        const alice_ETHBalance_After = toBN(await web3.eth.getBalance(alice))
        const balanceDiff = alice_ETHBalance_After.sub(alice_ETHBalance_Before).add(th.getGasFee(tx))
        assert.isTrue(balanceDiff.eq(aliceColl[0]))

        const A_USDE = await usdeToken.balanceOf(alice)
        const D_USDE = await usdeToken.balanceOf(dennis)
        const expectedTotalSupply = A_USDE.add(D_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("1"))).add(fee_after)

        // Check total USDE supply
        const totalSupply = await usdeToken.totalSupply()
        th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
      })
    }

    it("closeTrove(): subtracts the debt of the closed Trove from the Borrower's USDEToken balance", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: dennis
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })

      const aliceDebt = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebt.gt(toBN('0')))

      // to compensate borrowing fees
      await usdeToken.transfer(alice, await usdeToken.balanceOf(dennis), {
        from: dennis
      })
      const treasuryUSDE_before = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE_before = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_before = treasuryUSDE_before.add(liquidityIncentiveUSDE_before)

      const alice_USDEBalance_Before = await usdeToken.balanceOf(alice)
      assert.isTrue(alice_USDEBalance_Before.gt(toBN('0')))

      // close trove
      await borrowerOperations.closeTrove({
        from: alice
      })
      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_after = treasuryUSDE.add(liquidityIncentiveUSDE)
      assert.isTrue(fee_after.gt(fee_before))

      // check alice USDE balance after
      const alice_USDEBalance_After = await usdeToken.balanceOf(alice)
      th.assertIsApproximatelyEqual(alice_USDEBalance_After, alice_USDEBalance_Before.sub(aliceDebt.sub(USDE_GAS_COMPENSATION)), _1e14BN)

      const D_USDE = await usdeToken.balanceOf(dennis)
      const expectedTotalSupply = alice_USDEBalance_After.add(D_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("1"))).add(fee_after)

      // Check total USDE supply
      const totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("closeTrove(): applies pending rewards", async () => {
      // --- SETUP ---
      await openTrove({
        extraUSDEAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: carol
        }
      })

      // Whale transfers to A and B to cover their fees
      await usdeToken.transfer(alice, dec(10000, 18), {
        from: whale
      })
      await usdeToken.transfer(bob, dec(10000, 18), {
        from: whale
      })

      // --- TEST ---

      // price drops to 1ETH:100USDE, reducing Carol's ICR below MCR
      await priceFeed.setPrice(dec(105, 18));
      const treasuryUSDE_before = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE_before = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_before = treasuryUSDE_before.add(liquidityIncentiveUSDE_before)

      // liquidate Carol's Trove, Alice and Bob earn rewards.
      const liquidationTx = await troveManager.liquidate(carol, {
        from: owner
      });
      const [liquidatedDebt_C, liquidatedColls_C, gasComps_C, usdeGas_C] = th.getEmittedLiquidationValues(liquidationTx)
      const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_after = treasuryUSDE.add(liquidityIncentiveUSDE)
      assert.isTrue(fee_after.gt(fee_before))

      let A_USDE = await usdeToken.balanceOf(alice)
      let B_USDE = await usdeToken.balanceOf(bob)
      let C_USDE = await usdeToken.balanceOf(carol)
      let W_USDE = await usdeToken.balanceOf(whale)
      let expectedTotalSupply = A_USDE.add(B_USDE).add(C_USDE).add(W_USDE).add(usdeGas_C).add(USDE_GAS_COMPENSATION.mul(toBN("3"))).add(fee_after)

      // Check total USDE supply
      let totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)

      // Dennis opens a new Trove 
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: carol
        }
      })

      // check Alice and Bob's reward snapshots are zero before they alter their Troves
      const alice_ETHrewardSnapshot_Before = await troveManager.getRewardSnapshotColl(alice, contracts.weth.address)
      const alice_USDEDebtRewardSnapshot_Before = await troveManager.getRewardSnapshotUSDE(alice, contracts.weth.address)

      const bob_ETHrewardSnapshot_Before = await troveManager.getRewardSnapshotColl(bob, contracts.weth.address)
      const bob_USDEDebtRewardSnapshot_Before = await troveManager.getRewardSnapshotUSDE(bob, contracts.weth.address)

      assert.equal(alice_ETHrewardSnapshot_Before, 0)
      assert.equal(alice_USDEDebtRewardSnapshot_Before, 0)
      assert.equal(bob_ETHrewardSnapshot_Before, 0)
      assert.equal(bob_USDEDebtRewardSnapshot_Before, 0)

      const defaultPool_ETH = await defaultPool.getCollateralAmount(contracts.weth.address)
      const defaultPool_USDEDebt = await defaultPool.getUSDEDebt()

      // Carol's liquidated coll (1 ETH) and drawn debt should have entered the Default Pool
      assert.isAtMost(th.getDifference(defaultPool_ETH, liquidatedColls_C[0]), 100)
      assert.isAtMost(th.getDifference(defaultPool_USDEDebt, liquidatedDebt_C), 100)

      const pendingCollReward_A = (await troveManager.getPendingCollReward(alice))[0][0] //amounts, 0th index
      const pendingDebtReward_A = await troveManager.getPendingUSDEDebtReward(alice)
      assert.isTrue(pendingCollReward_A.gt('0'))
      assert.isTrue(pendingDebtReward_A.gt('0'))
      const treasuryUSDE_before_alice = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE_before_alice = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_before_alice = treasuryUSDE_before_alice.add(liquidityIncentiveUSDE_before_alice)

      // Close Alice's trove. Alice's pending rewards should be removed from the DefaultPool when she close.
      await borrowerOperations.closeTrove({
        from: alice
      })

      const treasuryUSDE_after_alice = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE_after_alice = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_after_alice = treasuryUSDE_after_alice.add(liquidityIncentiveUSDE_after_alice)
      assert.isTrue(fee_after_alice.gt(fee_before_alice))

      A_USDE = await usdeToken.balanceOf(alice)
      B_USDE = await usdeToken.balanceOf(bob)
      C_USDE = await usdeToken.balanceOf(carol)
      W_USDE = await usdeToken.balanceOf(whale)
      let O_USDE = await usdeToken.balanceOf(owner)
      expectedTotalSupply = A_USDE.add(B_USDE).add(C_USDE).add(W_USDE).add(O_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("3"))).add(fee_after_alice)

      // Check total USDE supply
      totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)

      const defaultPool_ETH_afterAliceCloses = await defaultPool.getCollateralAmount(contracts.weth.address)
      const defaultPool_USDEDebt_afterAliceCloses = await defaultPool.getUSDEDebt()

      assert.isAtMost(th.getDifference(defaultPool_ETH_afterAliceCloses,
        defaultPool_ETH.sub(pendingCollReward_A)), 1000)
      assert.isAtMost(th.getDifference(defaultPool_USDEDebt_afterAliceCloses,
        defaultPool_USDEDebt.sub(pendingDebtReward_A)), 1000)

      // whale adjusts trove, pulling their rewards out of DefaultPool
      const repayUSDEPromise_B = borrowerOperations.adjustTrove([], [], [], [], dec(1, 18), true, whale, whale, th._100pct, {
        from: whale
      })
      const pendingCollReward_B = (await troveManager.getPendingCollReward(bob))[0][0] //amounts, 0th index
      const pendingDebtReward_B = await troveManager.getPendingUSDEDebtReward(bob)
      const treasuryUSDE_before_bob = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE_before_bob = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_before_bob = treasuryUSDE_before_bob.add(liquidityIncentiveUSDE_before_bob)
      // Close Bob's trove. Expect DefaultPool coll and debt to drop to 0, since closing pulls his rewards out.
      await borrowerOperations.closeTrove({
        from: bob
      })
      const treasuryUSDE_after_bob = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentiveUSDE_after_bob = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_after_bob = treasuryUSDE_after_bob.add(liquidityIncentiveUSDE_after_bob)
      assert.isTrue(fee_after_bob.gt(fee_before_bob))

      const defaultPool_ETH_afterBobCloses = await defaultPool.getCollateralAmount(contracts.weth.address)
      const defaultPool_USDEDebt_afterBobCloses = await defaultPool.getUSDEDebt()

      assert.isAtMost(th.getDifference(defaultPool_ETH_afterBobCloses, defaultPool_ETH_afterAliceCloses.sub(pendingCollReward_B)), 0)
      assert.isAtMost(th.getDifference(defaultPool_USDEDebt_afterBobCloses, defaultPool_USDEDebt_afterAliceCloses.sub(pendingDebtReward_B)), 0)

      A_USDE = await usdeToken.balanceOf(alice)
      B_USDE = await usdeToken.balanceOf(bob)
      C_USDE = await usdeToken.balanceOf(carol)
      W_USDE = await usdeToken.balanceOf(whale)
      O_USDE = await usdeToken.balanceOf(owner)
      expectedTotalSupply = A_USDE.add(B_USDE).add(C_USDE).add(W_USDE).add(O_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("2"))).add(fee_after_bob)

      // Check total USDE supply
      totalSupply = await usdeToken.totalSupply()
      th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)
    })

    it("closeTrove(): reverts if borrower has insufficient USDE balance to repay his entire debt", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })

      //Confirm Bob's USDE balance is less than his trove debt
      const B_USDEBal = await usdeToken.balanceOf(B)
      const B_troveDebt = await getTroveEntireDebt(B)

      assert.isTrue(B_USDEBal.lt(B_troveDebt))

      const closeTrovePromise_B = borrowerOperations.closeTrove({
        from: B
      })

      // Check closing trove reverts
      await assertRevert(closeTrovePromise_B, "22") // Caller doesnt have enough USDE to make repayment
    })

    // --- openTrove() ---

    if (!withProxy) { // TODO: use rawLogs instead of logs
      it("openTrove(): emits a TroveUpdated event with the correct collateral and debt", async () => {
        const txA = (await openTrove({
          extraUSDEAmount: toBN(dec(15000, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: {
            from: A
          }
        })).tx
        const txB = (await openTrove({
          extraUSDEAmount: toBN(dec(5000, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: {
            from: B
          }
        })).tx
        const txC = (await openTrove({
          extraUSDEAmount: toBN(dec(3000, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: {
            from: C
          }
        })).tx

        const A_Coll = await getTroveEntireColl(A)
        const B_Coll = await getTroveEntireColl(B)
        const C_Coll = await getTroveEntireColl(C)
        const A_Debt = await getTroveEntireDebt(A)
        const B_Debt = await getTroveEntireDebt(B)
        const C_Debt = await getTroveEntireDebt(C)

        const A_emittedDebt = toBN(th.getEventArgByName(txA, "TroveUpdated", "_debt"))
        const A_emittedColl = toBN(th.getEventArgByName(txA, "TroveUpdated", "_amounts")[0])
        const B_emittedDebt = toBN(th.getEventArgByName(txB, "TroveUpdated", "_debt"))
        const B_emittedColl = toBN(th.getEventArgByName(txB, "TroveUpdated", "_amounts")[0])
        const C_emittedDebt = toBN(th.getEventArgByName(txC, "TroveUpdated", "_debt"))
        const C_emittedColl = toBN(th.getEventArgByName(txC, "TroveUpdated", "_amounts")[0])

        // Check emitted debt values are correct
        th.assertIsApproximatelyEqual(A_Debt, A_emittedDebt, _1e14BN)
        th.assertIsApproximatelyEqual(B_Debt, B_emittedDebt, _1e14BN)
        th.assertIsApproximatelyEqual(C_Debt, C_emittedDebt, _1e14BN)

        // Check emitted coll values are correct
        assert.isTrue(A_Coll[0].eq(A_emittedColl))
        assert.isTrue(B_Coll[0].eq(B_emittedColl))
        assert.isTrue(C_Coll[0].eq(C_emittedColl))

        const baseRateBefore = await troveManager.baseRate()

        // Artificially make baseRate 5%
        await troveManager.setBaseRate(dec(5, 16))
        await troveManager.setLastFeeOpTimeToNow()

        assert.isTrue((await troveManager.baseRate()).gt(baseRateBefore))

        const txD = (await openTrove({
          extraUSDEAmount: toBN(dec(5000, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: {
            from: D
          }
        })).tx
        const txE = (await openTrove({
          extraUSDEAmount: toBN(dec(3000, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: {
            from: E
          }
        })).tx
        const D_Coll = await getTroveEntireColl(D)
        const E_Coll = await getTroveEntireColl(E)
        const D_Debt = await getTroveEntireDebt(D)
        const E_Debt = await getTroveEntireDebt(E)

        const D_emittedDebt = toBN(th.getEventArgByName(txD, "TroveUpdated", "_debt"))
        const D_emittedColl = toBN(th.getEventArgByName(txD, "TroveUpdated", "_amounts")[0])

        const E_emittedDebt = toBN(th.getEventArgByName(txE, "TroveUpdated", "_debt"))
        const E_emittedColl = toBN(th.getEventArgByName(txE, "TroveUpdated", "_amounts")[0])

        // Check emitted debt values are correct
        th.assertIsApproximatelyEqual(D_Debt, D_emittedDebt, _1e14BN)
        th.assertIsApproximatelyEqual(E_Debt, E_emittedDebt, _1e14BN)

        // Check emitted coll values are correct
        assert.isTrue(D_Coll[0].eq(D_emittedColl))
        assert.isTrue(E_Coll[0].eq(E_emittedColl))
      })
    }

    it("openTrove(): Opens a trove with net debt >= minimum net debt", async () => {
      // Add 1 wei to correct for rounding error in helper function
      const txA = await contracts.borrowerOperations.openTrove([], [], th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN(1))), A, A, {
        from: A,
        value: toBN(dec(100, 30))
      })
      //borrowerOperations.openTrove(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN(1))), A, A, { from: A, value: dec(100, 30) })
      assert.isTrue(txA.receipt.status)
      assert.isTrue(await sortedTroves.contains(A))

      const txC = await contracts.borrowerOperations.openTrove([], [], th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN(dec(47789898, 22)))), A, A, {
        from: C,
        value: toBN(dec(100, 30))
      })
      //borrowerOperations.openTrove(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN(dec(47789898, 22)))), A, A, { from: C, value: dec(100, 30) })
      assert.isTrue(txC.receipt.status)
      assert.isTrue(await sortedTroves.contains(C))
    })

    it("openTrove(): reverts if net debt < minimum net debt", async () => {
      const txAPromise = contracts.borrowerOperations.openTrove([], [], th._100pct, 0, A, A, {
        from: A,
        value: toBN(dec(100, 30))
      })
      //borrowerOperations.openTrove(th._100pct, 0, A, A, { from: A, value: dec(100, 30) })
      await assertRevert(txAPromise, "revert")

      const txBPromise = contracts.borrowerOperations.openTrove([], [], th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.sub(toBN(1))), B, B, {
        from: B,
        value: toBN(dec(100, 30))
      })
      //borrowerOperations.openTrove(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.sub(toBN(1))), B, B, { from: B, value: dec(100, 30) })
      await assertRevert(txBPromise, "revert")

      const txCPromise = contracts.borrowerOperations.openTrove([], [], th._100pct, MIN_NET_DEBT.sub(toBN(dec(173, 18))), C, C, {
        from: C,
        value: toBN(dec(100, 30))
      })
      //borrowerOperations.openTrove(th._100pct, MIN_NET_DEBT.sub(toBN(dec(173, 18))), C, C, { from: C, value: dec(100, 30) })
      await assertRevert(txCPromise, "revert")
    })

    it("openTrove(): decays a non-zero base rate", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: C
        }
      })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens trove 
      await openTrove({
        extraUSDEAmount: toBN(dec(37, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: D
        }
      })

      // Check baseRate has decreased
      const baseRate_2 = await troveManager.baseRate()
      assert.isTrue(baseRate_2.lt(baseRate_1))

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E opens trove 
      await openTrove({
        extraUSDEAmount: toBN(dec(12, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: E
        }
      })

      const baseRate_3 = await troveManager.baseRate()
      assert.isTrue(baseRate_3.lt(baseRate_2))
    })

    it("openTrove(): doesn't change base rate if it is already zero", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: C
        }
      })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens trove 
      await openTrove({
        extraUSDEAmount: toBN(dec(37, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: D
        }
      })

      // Check baseRate is still 0
      const baseRate_2 = await troveManager.baseRate()
      assert.equal(baseRate_2, '0')

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E opens trove 
      await openTrove({
        extraUSDEAmount: toBN(dec(12, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: E
        }
      })

      const baseRate_3 = await troveManager.baseRate()
      assert.equal(baseRate_3, '0')
    })

    it("openTrove(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: C
        }
      })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      const lastFeeOpTime_1 = await troveManager.lastFeeOperationTime()

      // Borrower D triggers a fee
      await openTrove({
        extraUSDEAmount: toBN(dec(1, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: D
        }
      })

      const lastFeeOpTime_2 = await troveManager.lastFeeOperationTime()

      // Check that the last fee operation time did not update, as borrower D's debt issuance occured
      // since before minimum interval had passed 
      assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

      // 1 minute passes
      th.fastForwardTime(60, web3.currentProvider)

      // Check that now, at least one minute has passed since lastFeeOpTime_1
      const timeNow = await th.getLatestBlockTimestamp(web3)
      assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(3600))

      // Borrower E triggers a fee
      await openTrove({
        extraUSDEAmount: toBN(dec(1, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: E
        }
      })

      const lastFeeOpTime_3 = await troveManager.lastFeeOperationTime()

      // Check that the last fee operation time DID update, as borrower's debt issuance occured
      // after minimum interval had passed 
      assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
    })

    it("openTrove(): reverts if max fee > 100%", async () => {
      await assertRevert(
        contracts.borrowerOperations.openTrove([], [], dec(2, 18), dec(10000, 18), A, A, {
          from: A,
          value: toBN(dec(1000, 'ether'))
        }),
        "24") // Max fee percentage must be between 0.75% and 100%

      await assertRevert(
        contracts.borrowerOperations.openTrove([], [], '1000000000000000001', dec(20000, 18), B, B, {
          from: B,
          value: toBN(dec(100, 'ether'))
        }),
        "24") // Max fee percentage must be between 0.75% and 100%
    })

    it("openTrove(): reverts if max fee < 0.25% in Normal mode", async () => {
      await assertRevert(
        contracts.borrowerOperations.openTrove([], [], 0, dec(195000, 18), A, A, {
          from: A,
          value: toBN(dec(1200, 'ether'))
        }),
        "24") // Max fee percentage must be between 0.25% and 100%
      await assertRevert(
        contracts.borrowerOperations.openTrove([], [], 1, dec(195000, 18), A, A, {
          from: A,
          value: toBN(dec(1000, 'ether'))
        }),
        "24") // Max fee percentage must be between 0.25% and 100%
      await assertRevert(
        contracts.borrowerOperations.openTrove([], [], '1999999999999999', dec(195000, 18), A, A, {
          from: A,
          value: toBN(dec(1200, 'ether'))
        }),
        "24") // Max fee percentage must be between 0.25% and 100%
    })

    it("openTrove(): reverts if fee exceeds max fee percentage", async () => { // new fee system takes into account the max of ether and debt. 
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: C
        }
      })

      const totalSupply = await usdeToken.totalSupply()

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      //       actual fee percentage: 0.005000000186264514
      // user's max fee percentage:  0.00249999999999999999
      let borrowingRate = await troveManager.getBorrowingRate() // expect min(0.75 + 5%, 5%) rate
      assert.equal(borrowingRate.toString(), dec(25, 15))

      const lessThan5pct = '19999999999999999'
      await assertRevert(
        contracts.borrowerOperations.openTrove([], [], lessThan5pct, dec(30000, 18), A, A, {
          from: D,
          value: toBN(dec(1000, 'ether'))
        }),
        "Fee exceeded provided maximum")

      borrowingRate = await troveManager.getBorrowingRate() // expect 2.5% rate
      assert.equal(borrowingRate.toString(), dec(25, 15))
      // Attempt with maxFee 1%

      await assertRevert(
        contracts.borrowerOperations.openTrove([], [], dec(1, 16), dec(30000, 18), A, A, {
          from: D,
          value: toBN(dec(1000, 'ether'))
        }),
        "Fee exceeded provided maximum")

      // borrowingRate = await troveManager.getBorrowingRate() // expect 2.5% rate
      // assert.equal(borrowingRate.toString(), dec(25, 15))
      // // Attempt with maxFee 3.754%
      // await assertRevert(
      //   contracts.borrowerOperations.openTrove([], [], dec(3754, 13), dec(30000, 18), A, A, {
      //     from: D,
      //     value: toBN(dec(1000, 'ether'))
      //   }),
      //   "Fee exceeded provided maximum")

      borrowingRate = await troveManager.getBorrowingRate() // expect 2.5% rate
      assert.equal(borrowingRate.toString(), dec(25, 15))
      // Attempt with maxFee 1e-16%
      await assertRevert(
        contracts.borrowerOperations.openTrove([], [], dec(1, 16), dec(30000, 18), A, A, {
          from: D,
          value: toBN(dec(1000, 'ether'))
        }),
        "Fee exceeded provided maximum")
    })

    it("openTrove(): succeeds when fee is less than max fee percentage", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: C
        }
      })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      let borrowingRate = await troveManager.getBorrowingRate() // expect min(0.5 + 5%, 5%) rate
      assert.equal(borrowingRate.toString(), dec(25, 15))

      // Attempt with maxFee > 5%
      const moreThan5pct = '50000000000000001'
      const tx1 = await contracts.borrowerOperations.openTrove([], [], moreThan5pct, dec(10000, 18), A, A, {
        from: D,
        value: toBN(dec(100, 'ether'))
      })
      assert.isTrue(tx1.receipt.status)

      borrowingRate = await troveManager.getBorrowingRate() // expect 5% rate
      assert.equal(borrowingRate.toString(), dec(25, 15))

      // Attempt with maxFee = 5%
      const tx2 = await contracts.borrowerOperations.openTrove([], [], dec(5, 16), dec(10000, 18), A, A, {
        from: H,
        value: toBN(dec(100, 'ether'))
      })
      assert.isTrue(tx2.receipt.status)

      borrowingRate = await troveManager.getBorrowingRate() // expect 2.5% rate
      assert.equal(borrowingRate.toString(), dec(25, 15))

      // Attempt with maxFee 10%
      const tx3 = await contracts.borrowerOperations.openTrove([], [], dec(1, 17), dec(10000, 18), A, A, {
        from: E,
        value: toBN(dec(100, 'ether'))
      })
      assert.isTrue(tx3.receipt.status)

      borrowingRate = await troveManager.getBorrowingRate() // expect w.5% rate
      assert.equal(borrowingRate.toString(), dec(25, 15))

      // Attempt with maxFee 37.659%
      const tx4 = await contracts.borrowerOperations.openTrove([], [], dec(37659, 13), dec(10000, 18), A, A, {
        from: F,
        value: toBN(dec(100, 'ether'))
      })
      assert.isTrue(tx4.receipt.status)

      // Attempt with maxFee 100%
      const tx5 = await contracts.borrowerOperations.openTrove([], [], dec(1, 18), dec(10000, 18), A, A, {
        from: G,
        value: toBN(dec(100, 'ether'))
      })
      //borrowerOperations.openTrove(dec(1, 18), dec(10000, 18), A, A, { from: G, value: dec(100, 'ether') })
      assert.isTrue(tx5.receipt.status)
    })

    it("openTrove(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: C
        }
      })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 59 minutes pass
      th.fastForwardTime(3540, web3.currentProvider)

      // Assume Borrower also owns accounts D and E
      // Borrower triggers a fee, before decay interval has passed
      await openTrove({
        extraUSDEAmount: toBN(dec(1, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: D
        }
      })

      // 1 minute pass
      th.fastForwardTime(3540, web3.currentProvider)

      // Borrower triggers another fee
      await openTrove({
        extraUSDEAmount: toBN(dec(1, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: E
        }
      })

      // Check base rate has decreased even though Borrower tried to stop it decaying
      const baseRate_2 = await troveManager.baseRate()
      assert.isTrue(baseRate_2.lt(baseRate_1))
    })

    it("openTrove(): borrowing at non-zero base rate sends USDE fee to treasury contract", async () => {
      // time fast-forwards 1 year
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // Check treasury USDE balance before == 0
      const treasury_USDEBalance_Before = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentive_USDEBalance_Before = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_USDEBalance_Before = treasury_USDEBalance_Before.add(liquidityIncentive_USDEBalance_Before)
      assert.equal(fee_USDEBalance_Before, '0')

      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: C
        }
      })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens trove 
      await openTrove({
        extraUSDEAmount: toBN(dec(40000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: D
        }
      })

      // Check treasury USDE balance after has increased
      const treasury_USDEBalance_After = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentive_USDEBalance_After = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_USDEBalance_After = treasury_USDEBalance_After.add(liquidityIncentive_USDEBalance_After)
      assert.isTrue(fee_USDEBalance_After.gt(fee_USDEBalance_Before))
    })

    if (!withProxy) { // TODO: use rawLogs instead of logs
      it("openTrove(): borrowing at non-zero base records the (drawn debt + fee  + liq. reserve) on the Trove struct", async () => {
        // time fast-forwards 1 year
        await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

        await openTrove({
          extraUSDEAmount: toBN(dec(10000, 18)),
          ICR: toBN(dec(10, 18)),
          extraParams: {
            from: whale
          }
        })
        await openTrove({
          extraUSDEAmount: toBN(dec(20000, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: {
            from: A
          }
        })
        await openTrove({
          extraUSDEAmount: toBN(dec(30000, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: {
            from: B
          }
        })
        await openTrove({
          extraUSDEAmount: toBN(dec(40000, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: {
            from: C
          }
        })

        // Artificially make baseRate 5%
        await troveManager.setBaseRate(dec(5, 16))
        await troveManager.setLastFeeOpTimeToNow()

        // Check baseRate is now non-zero
        const baseRate_1 = await troveManager.baseRate()
        assert.isTrue(baseRate_1.gt(toBN('0')))

        // 2 hours pass
        th.fastForwardTime(7200, web3.currentProvider)

        const D_USDERequest = toBN(dec(20000, 18))

        // D withdraws USDE
        const openTroveTx = await contracts.borrowerOperations.openTrove([], [], th._100pct, D_USDERequest, ZERO_ADDRESS, ZERO_ADDRESS, {
          from: D,
          value: toBN(dec(200, 'ether'))
        })

        const emittedFee = toBN(th.getUSDEFeeFromUSDEBorrowingEvent(openTroveTx))
        assert.isTrue(toBN(emittedFee).gt(toBN('0')))

        const newDebt = await getTroveEntireDebt(D)

        // Check debt on Trove struct equals drawn debt plus emitted fee
        th.assertIsApproximatelyEqual(newDebt, D_USDERequest.add(emittedFee).add(USDE_GAS_COMPENSATION), 100000)
      })
    }

    it("openTrove(): Borrowing at non-zero base rate sends requested amount to the user", async () => {
      // time fast-forwards 1 year
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // Check treasury Staking contract balance before == 0
      const treasury_USDEBalance_Before = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentive_USDEBalance_Before = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_USDEBalance_Before = treasury_USDEBalance_Before.add(liquidityIncentive_USDEBalance_Before)
      assert.equal(fee_USDEBalance_Before, '0')

      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: C
        }
      })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens trove 
      const USDERequest_D = toBN(dec(40000, 18))
      await contracts.borrowerOperations.openTrove([], [], th._100pct, USDERequest_D, D, D, {
        from: D,
        value: toBN(dec(500, 'ether'))
      })

      // Check treasury USDE balance has increased
      const treasury_USDEBalance_After = await usdeToken.balanceOf(treasury.address)
      const liquidityIncentive_USDEBalance_After = await usdeToken.balanceOf(liquidityIncentive.address)
      const fee_USDEBalance_After = treasury_USDEBalance_After.add(liquidityIncentive_USDEBalance_After)
      assert.isTrue(fee_USDEBalance_After.gt(fee_USDEBalance_Before))

      // Check D's USDE balance now equals their requested USDE
      const USDEBalance_D = await usdeToken.balanceOf(D)
      assert.isTrue(USDERequest_D.eq(USDEBalance_D))
    })

    it("openTrove(): Borrowing at zero base rate charges minimum fee", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: B
        }
      })

      const USDERequest = toBN(dec(10000, 18))
      const txC = await contracts.borrowerOperations.openTrove([], [], th._100pct, USDERequest, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: C,
        value: toBN(dec(100, 'ether'))
      })
      const _USDEFee = toBN(th.getEventArgByName(txC, "USDEBorrowingFeePaid", "_USDEFee"))

      const expectedFee = BORROWING_FEE_FLOOR.mul(toBN(USDERequest)).div(toBN(dec(1, 18)))
      assert.isTrue(_USDEFee.eq(expectedFee))
    })

    it("openTrove(): reverts when system is in Recovery Mode and ICR < CCR", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: whale
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      assert.isFalse(await th.checkRecoveryMode(contracts))

      // price drops, and Recovery Mode kicks in
      await priceFeed.setPrice(dec(105, 18))

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Bob tries to open a trove with 149% ICR during Recovery Mode
      try {
        const txBob = await openTrove({
          extraUSDEAmount: toBN(dec(5000, 18)),
          ICR: toBN(dec(149, 16)),
          extraParams: {
            from: alice
          }
        })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("openTrove(): reverts when trove ICR < MCR", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: whale
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })

      assert.isFalse(await th.checkRecoveryMode(contracts))

      // Bob attempts to open a 109% ICR trove in Normal Mode
      try {
        const txBob = (await openTrove({
          extraUSDEAmount: toBN(dec(5000, 18)),
          ICR: toBN(dec(109, 16)),
          extraParams: {
            from: bob
          }
        })).tx
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // price drops, and Recovery Mode kicks in
      await priceFeed.setPrice(dec(105, 18))

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Bob attempts to open a 109% ICR trove in Recovery Mode
      try {
        const txBob = await openTrove({
          extraUSDEAmount: toBN(dec(5000, 18)),
          ICR: toBN(dec(109, 16)),
          extraParams: {
            from: bob
          }
        })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("openTrove(): reverts when opening the trove would cause the TCR of the system to fall below the CCR", async () => {
      // Alice creates trove with 131% ICR.  System TCR = 131%.
      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(131, 16)),
        extraParams: {
          from: alice
        }
      })
      const TCR = await th.getTCR(contracts)
      assert.equal(TCR.toString(), dec(131, 16))

      // Bob attempts to open a trove with ICR = 120%
      try {
        const {
          tx: txBob
        } = await openTrove({
          extraUSDEAmount: toBN(dec(5000, 18)),
          ICR: toBN(dec(120, 16)),
          extraParams: {
            from: bob
          }
        })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("openTrove(): reverts if trove is already active", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: {
          from: whale
        }
      })

      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(15, 17)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(15, 17)),
        extraParams: {
          from: bob
        }
      })

      try {
        const txB_1 = await openTrove({
          extraUSDEAmount: toBN(dec(5000, 18)),
          ICR: toBN(dec(3, 18)),
          extraParams: {
            from: bob
          }
        })

        assert.isFalse(txB_1.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }

      try {
        const txB_2 = await openTrove({
          ICR: toBN(dec(2, 18)),
          extraParams: {
            from: alice
          }
        })

        assert.isFalse(txB_2.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }
    })

    it("openTrove(): Can open a trove with ICR >= CCR when system is in Recovery Mode", async () => {
      // --- SETUP ---
      //  Alice and Bob add coll and withdraw such  that the TCR is ~130%
      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(131, 17)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(130, 17)),
        extraParams: {
          from: bob
        }
      })
      const TCR = await th.getTCR(contracts)
      assert.isTrue(TCR.gt(toBN(dec(130, 16))))

      // price drops to 1ETH:199USDE, reducing TCR below 130%
      await priceFeed.setPrice('1990000000000000000');

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Carol opens at 130% ICR in Recovery Mode
      const txCarol = (await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(13, 17)),
        extraParams: {
          from: carol
        }
      })).tx
      assert.isTrue(txCarol.receipt.status)
      assert.isTrue(await sortedTroves.contains(carol))

      const carol_TroveStatus = await troveManager.getTroveStatus(carol)
      assert.equal(carol_TroveStatus, 1)

      const carolICR = await th.getCurrentICR(contracts, carol)
      assert.isTrue(carolICR.gt(toBN(dec(129, 16))))
    })

    it("openTrove(): Reverts opening a trove with min debt when system is in Recovery Mode", async () => {
      // --- SETUP ---
      //  Alice and Bob add coll and withdraw such  that the TCR is ~130%
      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(131, 17)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(131, 17)),
        extraParams: {
          from: bob
        }
      })

      // await priceFeed.setPrice('200000000071347032000');
      // const TCR = (await th.getTCR(contracts)).toString()
      const TCR = await th.getTCR(contracts)
      assert.isTrue(TCR.gt(toBN(dec(130, 16))))

      // price drops to 1ETH:180USDE, reducing TCR below 130%
      await priceFeed.setPrice('18000000000000000000');
      assert.isTrue(await th.checkRecoveryMode(contracts))

      await assertRevert(
        contracts.borrowerOperations.openTrove([], [], th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT), carol, carol, {
          from: carol,
          value: toBN(dec(1, 'ether'))
        })
      )
    })

    it("openTrove(): creates a new Trove and assigns the correct collateral and debt amount", async () => {
      const debt_Before = await getTroveEntireDebt(alice)
      const coll_Before = await getTroveEntireColl(alice)
      const status_Before = await troveManager.getTroveStatus(alice)

      // check coll and debt before
      assert.equal(debt_Before, 0)
      assert.equal(coll_Before, 0)

      // check non-existent status
      assert.equal(status_Before, 0)

      const USDERequest = MIN_NET_DEBT
      await contracts.borrowerOperations.openTrove([], [], th._100pct, MIN_NET_DEBT, carol, carol, {
        from: alice,
        value: toBN(dec(100, 'ether'))
      })

      // Get the expected debt based on the USDE request (adding fee and liq. reserve on top)
      const expectedDebt = USDERequest
        .add(await troveManager.getBorrowingFee(USDERequest))
        .add(USDE_GAS_COMPENSATION)

      const debt_After = await getTroveEntireDebt(alice)
      const coll_After = await getTroveEntireColl(alice)
      const status_After = await troveManager.getTroveStatus(alice)

      // check coll and debt after
      assert.isTrue(coll_After[0].gt('0'))
      assert.isTrue(debt_After.gt('0'))

      assert.isTrue(debt_After.eq(expectedDebt))

      // check active status
      assert.equal(status_After, 1)
    })

    it("openTrove(): adds Trove owner to TroveOwners array", async () => {
      const TroveOwnersCount_Before = (await troveManager.getTroveOwnersCount()).toString();
      assert.equal(TroveOwnersCount_Before, '0')

      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(15, 17)),
        extraParams: {
          from: alice
        }
      })

      const TroveOwnersCount_After = (await troveManager.getTroveOwnersCount()).toString();
      assert.equal(TroveOwnersCount_After, '1')
    })

    it("openTrove(): creates a stake and adds it to total stakes", async () => {
      const aliceStakeBefore = await troveManager.getTroveStake(alice, contracts.weth.address)
      const totalStakesBefore = await th.getTotalStake(contracts, contracts.weth.address)

      assert.equal(aliceStakeBefore, '0')
      assert.equal(totalStakesBefore, '0')

      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      const aliceCollAfter = await getTroveEntireColl(alice)
      const aliceStakeAfter = await troveManager.getTroveStake(alice, contracts.weth.address)
      assert.isTrue(aliceCollAfter[0].gt(toBN('0')))
      assert.isTrue(aliceStakeAfter.eq(aliceCollAfter[0]))

      const totalStakesAfter = await th.getTotalStake(contracts, contracts.weth.address)

      assert.isTrue(totalStakesAfter.eq(aliceStakeAfter))
    })

    it("openTrove(): inserts Trove to Sorted Troves list", async () => {
      // Check before
      const aliceTroveInList_Before = await sortedTroves.contains(alice)
      const listIsEmpty_Before = await sortedTroves.isEmpty()
      assert.equal(aliceTroveInList_Before, false)
      assert.equal(listIsEmpty_Before, true)

      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })

      // check after
      const aliceTroveInList_After = await sortedTroves.contains(alice)
      const listIsEmpty_After = await sortedTroves.isEmpty()
      assert.equal(aliceTroveInList_After, true)
      assert.equal(listIsEmpty_After, false)
    })

    it("openTrove(): Increases the activePool ETH and raw ether balance by correct amount", async () => {
      const activePool_ETH_Before = await activePool.getCollateralAmount(contracts.weth.address)
      const activePool_RawEther_Before = await contracts.weth.balanceOf(activePool.address)
      assert.equal(activePool_ETH_Before, 0)
      assert.equal(activePool_RawEther_Before, 0)

      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      const aliceCollAfter = await getTroveEntireColl(alice)

      const activePool_ETH_After = await activePool.getCollateralAmount(contracts.weth.address)
      const activePool_RawEther_After = toBN(await contracts.weth.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_After.eq(aliceCollAfter[0]))
      assert.isTrue(activePool_RawEther_After.eq(aliceCollAfter[0]))
    })

    // TODO 
    it("openTrove(): records up-to-date initial snapshots of E_ETH and E_USDEDebt", async () => {
      // --- SETUP ---

      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: carol
        }
      })

      // --- TEST ---

      // price drops to 1ETH:100USDE, reducing Carol's ICR below MCR
      await priceFeed.setPrice(dec(100, 18));

      // close Carol's Trove, liquidating her 1 ether and 180USDE.
      const liquidationTx = await troveManager.liquidate(carol, {
        from: owner
      });
      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

      /* with total stakes = 10 ether, after liquidation, E_ETH should equal 1/10 ether per-ether-staked,
       and L_USDE should equal 18 USDE per-ether-staked. */

      const E_ETH = await th.getE_Coll(contracts, contracts.weth.address)
      const L_USDE = await th.getL_USDE(contracts, contracts.weth.address)

      assert.isTrue(E_ETH.gt(toBN('0')))
      assert.isTrue(L_USDE.gt(toBN('0')))
      // console.log("TCR", (await th.getTCR(contracts)).toString())
      // Bob opens trove
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })

      // Check Bob's snapshots of E_ETH and L_USDE equal the respective current values
      const bob_ETHrewardSnapshot = await troveManager.getRewardSnapshotColl(bob, contracts.weth.address) // bob_rewardSnapshot[0]
      const bob_USDEDebtRewardSnapshot = await troveManager.getRewardSnapshotUSDE(bob, contracts.weth.address)

      assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot, E_ETH), 1000)
      assert.isAtMost(th.getDifference(bob_USDEDebtRewardSnapshot, L_USDE), 1000)
    })

    it("openTrove(): allows a user to open a Trove, then close it, then re-open it", async () => {
      // Open Troves
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: whale
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: carol
        }
      })

      // Check Trove is active
      const status_1 = await troveManager.getTroveStatus(alice)
      assert.equal(status_1, 1)
      assert.isTrue(await sortedTroves.contains(alice))

      // to compensate borrowing fees
      await usdeToken.transfer(alice, dec(10000, 18), {
        from: whale
      })

      // Repay and close Trove
      await borrowerOperations.closeTrove({
        from: alice
      })

      // Check Trove is closed
      const status_2 = await troveManager.getTroveStatus(alice)
      assert.equal(status_2, 2)
      assert.isFalse(await sortedTroves.contains(alice))

      // Re-open Trove
      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })

      // Check Trove is re-opened
      const status_3 = await troveManager.getTroveStatus(alice)
      assert.equal(status_3, 1)
      assert.isTrue(await sortedTroves.contains(alice))
    })

    it("openTrove(): increases the Trove's USDE debt by the correct amount", async () => {
      // check before
      const debt_Before = await getTroveEntireDebt(alice) //alice_Trove_Before[0]
      assert.equal(debt_Before, 0)

      await contracts.borrowerOperations.openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), alice, alice, {
        from: alice,
        value: toBN(dec(100, 'ether'))
      })

      // check after
      const debt_After = await getTroveEntireDebt(alice) //alice_Trove_After[0]
      th.assertIsApproximatelyEqual(debt_After, dec(10000, 18), 10000)
    })

    it("openTrove(): increases USDE debt in ActivePool by the debt of the trove", async () => {
      const activePool_USDEDebt_Before = await activePool.getUSDEDebt()
      assert.equal(activePool_USDEDebt_Before, 0)

      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      const aliceDebt = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebt.gt(toBN('0')))

      const activePool_USDEDebt_After = await activePool.getUSDEDebt()
      assert.isTrue(activePool_USDEDebt_After.eq(aliceDebt))
    })

    it("openTrove(): increases user USDEToken balance by correct amount", async () => {
      // check before
      const alice_USDETokenBalance_Before = await usdeToken.balanceOf(alice)
      assert.equal(alice_USDETokenBalance_Before, 0)

      await contracts.borrowerOperations.openTrove([], [], th._100pct, dec(10000, 18), alice, alice, {
        from: alice,
        value: toBN(dec(100, 'ether'))
      })

      // check after
      const alice_USDETokenBalance_After = await usdeToken.balanceOf(alice)
      assert.equal(alice_USDETokenBalance_After, dec(10000, 18))
    })

    //  --- getNewICRFromTroveChange - (external wrapper in Tester contract calls internal function) ---

    describe("getNewICRFromTroveChange() returns the correct ICR", async () => {
      // 0, 0
      it("collChange = [0], debtChange = 0", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const newVC = await collateralManager.getValue([contracts.weth.address], [initialColl])
        // console.log("New VC " + newVC[0].toString())
        const initialDebt = dec(100, 18)
        const collChange = 0
        const debtChange = 0

        const newICR = (await collateralManager.getNewICRFromTroveChange(newVC[0], initialDebt, debtChange, true)).toString()
        assert.equal(newICR, '2000000000000000000')
      })

      // 0, +ve
      it("collChange = 0, debtChange is positive", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const newVC = await collateralManager.getValue([contracts.weth.address], [initialColl])
        const initialDebt = dec(100, 18)
        const collChange = 0
        const debtChange = dec(50, 18)

        const newICR = (await collateralManager.getNewICRFromTroveChange(newVC[0], initialDebt, debtChange, true)).toString()
        assert.isAtMost(th.getDifference(newICR, '1333333333333333333'), 100)
      })

      // 0, -ve
      it("collChange = 0, debtChange is negative", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const newVC = await collateralManager.getValue([contracts.weth.address], [initialColl])
        const initialDebt = dec(100, 18)
        const collChange = 0
        const debtChange = dec(50, 18)

        const newICR = (await collateralManager.getNewICRFromTroveChange(newVC[0], initialDebt, debtChange, false)).toString()
        assert.equal(newICR, '4000000000000000000')
      })

      // +ve, 0
      it("collChange is positive, debtChange is 0", async () => {
        price = await priceFeed.getPrice()
        const initialColl = toBN(dec(1, 'ether'))
        const initialDebt = dec(100, 18)
        const collChange = toBN(dec(1, 'ether'))
        const newVC = await collateralManager.getValue([contracts.weth.address], [initialColl.add(collChange)])
        const debtChange = 0

        const newICR = (await collateralManager.getNewICRFromTroveChange(newVC[0], initialDebt, debtChange, true)).toString()
        assert.equal(newICR, '4000000000000000000')
      })

      // -ve, 0
      it("collChange is negative, debtChange is 0", async () => {
        const initialColl = toBN(dec(1, 'ether'))
        const initialDebt = dec(100, 18)
        const collChange = toBN(dec(5, 17))
        const newVC = await collateralManager.getValue([contracts.weth.address], [initialColl.sub(collChange)])
        const debtChange = 0

        const newICR = (await collateralManager.getNewICRFromTroveChange(newVC[0], initialDebt, debtChange, true)).toString()
        assert.equal(newICR, '1000000000000000000')
      })

      // -ve, -ve
      it("collChange is negative, debtChange is negative", async () => {
        price = await priceFeed.getPrice()
        const initialColl = toBN(dec(1, 'ether'))
        const initialDebt = dec(100, 18)
        const collChange = toBN(dec(5, 17))
        const debtChange = dec(50, 18)
        const newVC = await collateralManager.getValue([contracts.weth.address], [initialColl.sub(collChange)])

        const newICR = (await collateralManager.getNewICRFromTroveChange(newVC[0], initialDebt, debtChange, false)).toString()
        assert.equal(newICR, '2000000000000000000')
      })

      // +ve, +ve 
      it("collChange is positive, debtChange is positive", async () => {
        price = await priceFeed.getPrice()
        const initialColl = toBN(dec(1, 'ether'))
        const initialDebt = dec(100, 18)
        const collChange = toBN(dec(1, 'ether'))
        const debtChange = dec(100, 18)
        const newVC = await collateralManager.getValue([contracts.weth.address], [initialColl.add(collChange)])

        const newICR = (await collateralManager.getNewICRFromTroveChange(newVC[0], initialDebt, debtChange, true)).toString()
        assert.equal(newICR, '2000000000000000000')
      })

      // +ve, -ve
      it("collChange is positive, debtChange is negative", async () => {
        price = await priceFeed.getPrice()
        const initialColl = toBN(dec(1, 'ether'))
        const initialDebt = dec(100, 18)
        const collChange = toBN(dec(1, 'ether'))
        const debtChange = dec(50, 18)
        const newVC = await collateralManager.getValue([contracts.weth.address], [initialColl.add(collChange)])
        const newICR = (await collateralManager.getNewICRFromTroveChange(newVC[0], initialDebt, debtChange, false)).toString()
        assert.equal(newICR, '8000000000000000000')
      })

      // -ve, +ve
      it("collChange is negative, debtChange is positive", async () => {
        const initialColl = toBN(dec(1, 'ether'))
        const initialDebt = dec(100, 18)
        const collChange = toBN(dec(5, 17))
        const debtChange = dec(100, 18)
        const newVC = await collateralManager.getValue([contracts.weth.address], [initialColl.sub(collChange)])

        const newICR = (await collateralManager.getNewICRFromTroveChange(newVC[0], initialDebt, debtChange, true)).toString()
        assert.equal(newICR, '500000000000000000')
      })
    })

    // --- getCompositeDebt ---

    it("getCompositeDebt(): returns debt + gas comp", async () => {
      const res1 = await borrowerOperations.getCompositeDebt('0')
      assert.equal(res1, USDE_GAS_COMPENSATION.toString())

      const res2 = await borrowerOperations.getCompositeDebt(dec(90, 18))
      th.assertIsApproximatelyEqual(res2, USDE_GAS_COMPENSATION.add(toBN(dec(90, 18))))

      const res3 = await borrowerOperations.getCompositeDebt(dec(24423422357345049, 12))
      th.assertIsApproximatelyEqual(res3, USDE_GAS_COMPENSATION.add(toBN(dec(24423422357345049, 12))))
    })

    //  --- getNewTCRFromTroveChange  - (external wrapper in Tester contract calls internal function) ---

    describe("getNewTCRFromTroveChange() returns the correct TCR", async () => {
      // 0, 0
      it("collChange = 0, debtChange = 0", async () => {
        // --- SETUP --- Create a ERD instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveUSDEAmount = await getOpenTroveUSDEAmount(troveTotalDebt)

        await contracts.borrowerOperations.openTrove([], [], th._100pct, troveUSDEAmount, alice, alice, {
          from: alice,
          value: troveColl
        })
        await contracts.borrowerOperations.openTrove([], [], th._100pct, troveUSDEAmount, bob, bob, {
          from: bob,
          value: troveColl
        })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))


        const [liquidatedDebt, liquidatedCollAmount, gasComp] = th.getEmittedLiquidationValues(liquidationTx)
        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = 0
        const debtChange = 0
        // const newTCR = await borrowerOperations.getNewTCRFromTroveChange(collChange, true, debtChange, true, price)
        const newTCR = await th.mockTroveChange(contracts, collChange, true, debtChange, true)

        const newVC = await collateralManager.getValue([contracts.weth.address], [troveColl.add(liquidatedCollAmount[0])])
        const expectedTCR = newVC[0].mul(toBN(dec(1, 18))).div(troveTotalDebt.add(liquidatedDebt))

        th.assertIsApproximatelyEqual(newTCR, expectedTCR, _1e10BN)
      })

      // 0, +ve
      it("collChange = 0, debtChange is positive", async () => {
        // --- SETUP --- Create a ERD instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveUSDEAmount = await getOpenTroveUSDEAmount(troveTotalDebt)

        await contracts.borrowerOperations.openTrove([], [], th._100pct, troveUSDEAmount, alice, alice, {
          from: alice,
          value: troveColl
        })
        await contracts.borrowerOperations.openTrove([], [], th._100pct, troveUSDEAmount, bob, bob, {
          from: bob,
          value: troveColl
        })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedCollAmount, gasCompAmounts] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = 0
        const debtChange = dec(200, 18)
        // const newTCR = await borrowerOperations.getNewTCRFromTroveChange(collChange, true, debtChange, true, price)
        const newTCR = await th.mockTroveChange(contracts, collChange, true, debtChange, true)

        const newVC = await collateralManager.getValue([contracts.weth.address], [troveColl.add(liquidatedCollAmount[0])])
        const expectedTCR = newVC[0].mul(toBN(dec(1, 18))).div(troveTotalDebt.add(liquidatedDebt.add(toBN(dec(200, 18)))))

        th.assertIsApproximatelyEqual(newTCR, expectedTCR, _1e10BN)
      })

      // 0, -ve
      it("collChange = 0, debtChange is negative", async () => {
        // --- SETUP --- Create a ERD instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveUSDEAmount = await getOpenTroveUSDEAmount(troveTotalDebt)
        await contracts.borrowerOperations.openTrove([], [], th._100pct, troveUSDEAmount, alice, alice, {
          from: alice,
          value: troveColl
        })
        await contracts.borrowerOperations.openTrove([], [], th._100pct, troveUSDEAmount, bob, bob, {
          from: bob,
          value: troveColl
        })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasCompColl, usdeGas] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()
        // --- TEST ---
        const collChange = 0
        const debtChange = dec(100, 18)
        // const newTCR = await borrowerOperations.getNewTCRFromTroveChange(collChange, true, debtChange, false, price)
        const newTCR = await th.mockTroveChange(contracts, collChange, true, debtChange, false)
        // console.log("debtChange", debtChange.toString())
        const expectedTCR = (troveColl.add(liquidatedColl[0])).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt.sub(toBN(dec(100, 18)))))

        th.assertIsApproximatelyEqual(newTCR, expectedTCR, _1e10BN)
      })

      // +ve, 0
      it("collChange is positive, debtChange is 0", async () => {
        // --- SETUP --- Create a ERD instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveUSDEAmount = await getOpenTroveUSDEAmount(troveTotalDebt)

        await contracts.borrowerOperations.openTrove([], [], th._100pct, troveUSDEAmount, alice, alice, {
          from: alice,
          value: troveColl
        })
        await contracts.borrowerOperations.openTrove([], [], th._100pct, troveUSDEAmount, bob, bob, {
          from: bob,
          value: troveColl
        })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasCompColl, usdeGas] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()
        // --- TEST ---
        const collChange = dec(995, 'ether')
        const debtChange = 0

        const collChangeVC = await collateralManager.getValue([contracts.weth.address], [collChange])
        // const newTCR = await borrowerOperations.getNewTCRFromTroveChange(collChangeVC[0], true, debtChange, true, price)
        const newTCR = await th.mockTroveChange(contracts, collChangeVC[0], true, debtChange, true)

        const expectedTCR = (troveColl.add(liquidatedColl[0]).add(toBN(collChange))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt))

        th.assertIsApproximatelyEqual(newTCR, expectedTCR, _1e10BN)
      })

      // -ve, 0
      it("collChange is negative, debtChange is 0", async () => {
        // --- SETUP --- Create a ERD instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveUSDEAmount = await getOpenTroveUSDEAmount(troveTotalDebt)
        await contracts.borrowerOperations.openTrove([], [], th._100pct, troveUSDEAmount, alice, alice, {
          from: alice,
          value: troveColl
        })
        await contracts.borrowerOperations.openTrove([], [], th._100pct, troveUSDEAmount, bob, bob, {
          from: bob,
          value: troveColl
        })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasCompColl, usdeGas] = th.getEmittedLiquidationValues(liquidationTx)


        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 18)
        const debtChange = 0

        const collChangeVC = await collateralManager.getValue([contracts.weth.address], [collChange])
        // const newTCR = await borrowerOperations.getNewTCRFromTroveChange(collChangeVC[0], false, debtChange, true, price)
        const newTCR = await th.mockTroveChange(contracts, collChangeVC[0], false, debtChange, true)

        const expectedTCR = (troveColl.add(liquidatedColl[0]).sub(toBN(dec(1, 'ether')))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt))

        th.assertIsApproximatelyEqual(newTCR, expectedTCR, _1e10BN)
      })

      // -ve, -ve
      it("collChange is negative, debtChange is negative", async () => {
        // --- SETUP --- Create a ERD instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveUSDEAmount = await getOpenTroveUSDEAmount(troveTotalDebt)
        await contracts.borrowerOperations.openTrove([], [], th._100pct, troveUSDEAmount, alice, alice, {
          from: alice,
          value: troveColl
        })
        await contracts.borrowerOperations.openTrove([], [], th._100pct, troveUSDEAmount, bob, bob, {
          from: bob,
          value: troveColl
        })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)


        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 18)
        const debtChange = dec(100, 18)

        const collChangeVC = await collateralManager.getValue([contracts.weth.address], [collChange])
        // const newTCR = await borrowerOperations.getNewTCRFromTroveChange(collChangeVC[0], false, debtChange, false, price)
        const newTCR = await th.mockTroveChange(contracts, collChangeVC[0], false, debtChange, false)

        const expectedTCR = (troveColl.add(liquidatedColl[0]).sub(toBN(dec(1, 'ether')))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt.sub(toBN(dec(100, 18)))))

        th.assertIsApproximatelyEqual(newTCR, expectedTCR, _1e10BN)
      })

      // +ve, +ve 
      it("collChange is positive, debtChange is positive", async () => {
        // --- SETUP --- Create a ERD instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveUSDEAmount = await getOpenTroveUSDEAmount(troveTotalDebt)
        await contracts.borrowerOperations.openTrove([], [], th._100pct, troveUSDEAmount, alice, alice, {
          from: alice,
          value: troveColl
        })
        await contracts.borrowerOperations.openTrove([], [], th._100pct, troveUSDEAmount, bob, bob, {
          from: bob,
          value: troveColl
        })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(995, 17)
        const debtChange = dec(100, 18)

        const collChangeVC = await collateralManager.getValue([contracts.weth.address], [collChange])
        // const newTCR = await borrowerOperations.getNewTCRFromTroveChange(collChangeVC[0], true, debtChange, true, price)
        const newTCR = await th.mockTroveChange(contracts, collChangeVC[0], true, debtChange, true)

        const expectedTCR = (troveColl.add(liquidatedColl[0]).add(toBN(collChange))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt.add(toBN(dec(100, 18)))))

        th.assertIsApproximatelyEqual(newTCR, expectedTCR, _1e10BN)
      })

      // +ve, -ve
      it("collChange is positive, debtChange is negative", async () => {
        // --- SETUP --- Create a ERD instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveUSDEAmount = await getOpenTroveUSDEAmount(troveTotalDebt)
        await contracts.borrowerOperations.openTrove([], [], th._100pct, troveUSDEAmount, alice, alice, {
          from: alice,
          value: troveColl
        })
        await contracts.borrowerOperations.openTrove([], [], th._100pct, troveUSDEAmount, bob, bob, {
          from: bob,
          value: troveColl
        })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(995, 'ether')
        const debtChange = dec(100, 18)

        const collChangeVC = await collateralManager.getValue([contracts.weth.address], [collChange])
        // const newTCR = await borrowerOperations.getNewTCRFromTroveChange(collChangeVC[0], true, debtChange, false, price)
        const newTCR = await th.mockTroveChange(contracts, collChangeVC[0], true, debtChange, false)

        const expectedTCR = (troveColl.add(liquidatedColl[0]).add(toBN(collChange))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt.sub(toBN(dec(100, 18)))))

        th.assertIsApproximatelyEqual(newTCR, expectedTCR, _1e10BN)
      })

      // -ve, +ve
      it("collChange is negative, debtChange is positive", async () => {
        // --- SETUP --- Create a ERD instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveUSDEAmount = await getOpenTroveUSDEAmount(troveTotalDebt)
        await contracts.borrowerOperations.openTrove([], [], th._100pct, troveUSDEAmount, alice, alice, {
          from: alice,
          value: troveColl
        })
        await contracts.borrowerOperations.openTrove([], [], th._100pct, troveUSDEAmount, bob, bob, {
          from: bob,
          value: troveColl
        })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 18)
        const debtChange = await getNetBorrowingAmount(dec(200, 18))

        const collChangeVC = await collateralManager.getValue([contracts.weth.address], [collChange])
        // const newTCR = await borrowerOperations.getNewTCRFromTroveChange(collChangeVC[0], false, debtChange, true, price)
        const newTCR = await th.mockTroveChange(contracts, collChangeVC[0], false, debtChange, true)

        const expectedTCR = (troveColl.add(liquidatedColl[0]).sub(toBN(collChange))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt.add(debtChange)))

        th.assertIsApproximatelyEqual(newTCR, expectedTCR, _1e10BN)
      })
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

/* TODO:

 1) Test SortedList re-ordering by ICR. ICR ratio
 changes with addColl, withdrawColl, withdrawUSDE, repayUSDE, etc. Can split them up and put them with
 individual functions, or give ordering it's own 'describe' block.

 2)In security phase:
 -'Negative' tests for all the above functions.
 */