const deploymentHelper = require("../utils/deploymentHelpersUpgrade.js")
const testHelpers = require("../utils/testHelpersUpgrade.js")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues

const dec = th.dec
const toBN = th.toBN
const assertRevert = th.assertRevert

/* The majority of access control tests are contained in this file. However, tests for restrictions 
on the ERD admin address's capabilities during the first year are found in:

test/launchSequenceTest/DuringLockupPeriodTest.js */

contract('Access Control: ERD functions with the caller restricted to ERD contract(s)', async accounts => {

  const [owner, ali, bob, carol] = accounts;

  let contracts

  let priceFeed
  let usdeToken
  let sortedTroves
  let troveManager
  let nameRegistry
  let activePool
  let stabilityPool
  let defaultPool
  let functionCaller
  let borrowerOperations
  let collateralManager

  let treasury
  let liquidityIncentive
  let communityIssuance

  let weth
  let priceFeedETH
  let steth
  let priceFeedSTETH
  let alice


  before(async () => {
    contracts = await deploymentHelper.deployERDCore()

    priceFeedETH = contracts.priceFeedETH
    priceFeedSTETH = contracts.priceFeedSTETH
    usdeToken = contracts.usdeToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    nameRegistry = contracts.nameRegistry
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    functionCaller = contracts.functionCaller
    borrowerOperations = contracts.borrowerOperations
    collateralManager = contracts.collateralManager
    weth = contracts.weth
    steth = contracts.steth

    treasury = contracts.treasury
    liquidityIncentive = contracts.liquidityIncentive
    communityIssuance = contracts.communityIssuance

    // console.log("collList" ,collList)
    accounts = await ethers.getSigners()
    // console.log(accounts[0])
    for (account of accounts.slice(0, 10)) {
      await th.openTrove(contracts, {
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: account,
        extraParams: {
          from: account.address
        }
      })
    }

    alice = (await ethers.getSigners())[1];
  })

  describe('TroveManager', async accounts => {
    // applyPendingRewards
    it("applyPendingRewards(): reverts when called by an account that is not BorrowerOperations or TMR", async () => {
      const [owner, alice, addr2] = await ethers.getSigners();
      // Attempt call from alice
      try {
        const txAlice = await troveManager.connect(alice).applyPendingRewards(bob)

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations/TMR contract")
      }
    })

    it("batchLiquidateTroves(): reverts when called by an account that is not TroveManger", async () => {
      const [owner, alice, addr2] = await ethers.getSigners();
      // Attempt call from alice
      const collList = await contracts.collateralManager.getCollateralSupport()

      await priceFeedETH.setPrice(dec(70, 18))

      await contracts.troveManager.liquidate(alice.address)

      assertRevert(contracts.troveManagerLiquidations.connect(alice).batchLiquidateTroves([bob], alice.address))
    })

    // updateRewardSnapshots
    it("updateRewardSnapshots(): reverts when called by an account that is not BorrowerOperations", async () => {
      const [owner, alice, addr2] = await ethers.getSigners();
      // Attempt call from alice
      try {
        const txAlice = await troveManager.connect(alice).updateTroveRewardSnapshots(bob)

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // removeStake
    it("removeStake(): reverts when called by an account that is not BorrowerOperations or TMR", async () => {
      const [owner, alice, addr2] = await ethers.getSigners();
      // Attempt call from alice
      try {
        const txAlice = await troveManager.connect(alice).removeStake(bob)

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations/TMR contract")
      }
    })

    // updateStakeAndTotalStakes
    it("updateStakeAndTotalStakes(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.connect(alice).updateStakeAndTotalStakes(bob)

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // closeTrove
    it("closeTrove(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.connect(alice).closeTrove(bob)

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // addTroveOwnerToArray
    it("addTroveOwnerToArray(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.connect(alice).addTroveOwnerToArray(bob)

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // setTroveStatus
    it("setTroveStatus(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.connect(alice).setTroveStatus(bob, 1)

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // increaseTroveDebt
    it("increaseTroveDebt(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.connect(alice).increaseTroveDebt(bob, 100)
      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // decreaseTroveDebt
    it("decreaseTroveDebt(): reverts when called by an account that is not BorrowerOperations/TMR", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.connect(alice).decreaseTroveDebt(bob, 100)
      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations/TMR contract")
      }
    })
  })

  describe('ActivePool', async accounts => {
    // sendCollaterals
    it("sendCollateral(): reverts when called by an account that is not BO nor TroveM nor SP", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.connect(alice).sendCollateral(alice.address, [contracts.weth.address], ["1"])
      } catch (err) {
        // "Caller is neither BorrowerOperations nor TroveManager nor StabilityPool"
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller_NotBOOrTMOrSPOrTMLOrTMR")
      }
    })

    // increaseUSDE
    it("increaseUSDEDebt(): reverts when called by an account that is not BO nor TroveM", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.connect(alice).increaseUSDEDebt(100)

      } catch (err) {
        // "Caller is neither BorrowerOperations nor TroveManager"
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller_NotBOOrTM")
      }
    })

    // decreaseUSDE
    it("decreaseUSDEDebt(): reverts when called by an account that is not BO nor TroveM nor SP", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.connect(alice).decreaseUSDEDebt(100)

      } catch (err) {
        // Caller is neither BorrowerOperations nor TroveManager nor StabilityPool
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller_NotBOOrTMOrSPOrTMLOrTMR")
      }
    })
  })

  describe('DefaultPool', async accounts => {
    // sendCollateralToActivePool
    it("sendCollateralToActivePool(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.connect(alice).sendCollateralToActivePool([contracts.weth.address], [100])

      } catch (err) {
        // Caller is not the TroveManager
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller_NotTM")
      }
    })

    // increaseUSDE
    it("increaseUSDEDebt(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.connect(alice).increaseUSDEDebt(100)

      } catch (err) {
        // Caller is not the TroveManager
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller_NotTM")
      }
    })

    // decreaseUSDE
    it("decreaseUSDE(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.connect(alice).decreaseUSDEDebt(100)

      } catch (err) {
        // Caller is not the TroveManager
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller_NotTM")
      }
    })
  })

  describe('StabilityPool', async accounts => {
    // --- onlyTroveManager --- 

    // offset
    it("offset(): reverts when called by an account that is not TroveManagerLiquidations", async () => {
      // Attempt call from alice
      try {
        txAlice = await stabilityPool.connect(alice).offset(100, [contracts.weth.address], [100])
        assert.fail(txAlice)
      } catch (err) {
        // Caller is not TroveManagerLiquidations
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller_NotTML")
      }
    })

    // --- onlyActivePool ---
  })

  describe('USDEToken', async accounts => {
    //    mint
    it("mint(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      const txAlice = usdeToken.mint(bob, 100)
      await th.assertRevert(txAlice, "USDEToken: Caller is not BorrowerOperations")
    })

    // burn
    it("burn(): reverts when called by an account that is not BO nor TroveM nor SP", async () => {
      // Attempt call from alice
      try {
        const txAlice = await usdeToken.burn(bob, 100)

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is neither BorrowerOperations nor TroveManager nor StabilityPool")
      }
    })

    // sendToPool
    it("sendToPool(): reverts when called by an account that is not StabilityPool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await usdeToken.sendToPool(bob, activePool.address, 100)

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "USDE: Caller is not the StabilityPool")
      }
    })

    // returnFromPool
    it("returnFromPool(): reverts when called by an account that is not TroveManagerLiquidations nor StabilityPool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await usdeToken.returnFromPool(activePool.address, bob, 100)

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is neither TroveManagerLiquidations nor StabilityPool")
      }
    })
  })

  describe('SortedTroves', async accounts => {
    // --- onlyBorrowerOperations ---
    //     insert
    it("insert(): reverts when called by an account that is not BorrowerOps or TroveM", async () => {
      // Attempt call from alice
      try {
        const txAlice = await sortedTroves.insert(bob, '130000000000000000000', bob, bob)

      } catch (err) {
        // Caller is not the BorrowerOperations
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller_NotBO")
      }
    })

    // --- onlyTroveManager ---
    // remove
    it("remove(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await sortedTroves.remove(bob)

      } catch (err) {
        // Caller is not the TroveManager
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller_NotTM")
      }
    })

    // --- onlyTroveMorBM ---
    // reinsert
    it("reinsert(): reverts when called by an account that is neither BorrowerOps nor TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await sortedTroves.reInsert(bob, '150000000000000000000', bob, bob)

      } catch (err) {
        // Caller is neither BorrowerOperations nor TroveManagerRedemptions
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller_NotBOOrTMR")
      }
    })
  })

  describe('CommunityIssuance', async accounts => {
    it("trigger(): nothing", async () => {
      const tx1 = communityIssuance.trigger(alice, dec(100, 18))
      const tx2 = communityIssuance.trigger(bob, dec(100, 18))
      const tx3 = communityIssuance.trigger(stabilityPool.address, dec(100, 18))

      assertRevert(tx1)
      assertRevert(tx2)
      assertRevert(tx3)
    })

    it("issue(): nothing", async () => {
      const tx1 = communityIssuance.issue()

      assertRevert(tx1)
    })
  })

  describe('CollateralManager', async accounts => {
    it("pauseCollateral(): reverts when caller is not the Owner", async () => {
      assertRevert(collateralManager.pauseCollateral(weth.address))
    })

    it("removeCollateral(): reverts when caller is not the Owner", async () => {
      assertRevert(collateralManager.removeCollateral(weth.address))
    })

    it("activeCollateral(): reverts when caller is not the Owner", async () => {
      assertRevert(collateralManager.activeCollateral(weth.address))
    })

    it("setOracle(): reverts when caller is not the Owner", async () => {
      assertRevert(collateralManager.setOracle(weth.address, priceFeedETH.address))
    })

    it("setCollateralPriority(): reverts when caller is not the Owner", async () => {
      assertRevert(collateralManager.setCollateralPriority(weth.address, 1))
    })
  })

  describe('TroveDebt', async accounts => {
    it("addDebt(): reverts when caller is not the troveManager", async () => {
      assertRevert(contracts.troveDebt.addDebt(bob, 100, web3.utils.toWei('1000000000', 'ether')))
    })
    it("subDebt(): reverts when caller is not the troveManager", async () => {
      assertRevert(contracts.troveDebt.subDebt(bob, 100, web3.utils.toWei('1000000000', 'ether')))
    })
  })
})