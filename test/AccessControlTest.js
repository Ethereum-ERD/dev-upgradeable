const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const TroveManagerTester = artifacts.require("TroveManagerTester")
const CollateralManagerTester = artifacts.require("CollateralManagerTester")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues

const dec = th.dec
const toBN = th.toBN
const assertRevert = th.assertRevert

/* The majority of access control tests are contained in this file. However, tests for restrictions 
on the ERD admin address's capabilities during the first year are found in:

test/launchSequenceTest/DuringLockupPeriodTest.js */

contract('Access Control: ERD functions with the caller restricted to ERD contract(s)', async accounts => {

  const [owner, alice, bob, carol] = accounts;

  let contracts

  let priceFeed
  let eusdToken
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
  let communityIssuance

  let weth
  let priceFeedETH
  let steth
  let priceFeedSTETH


  before(async () => {
    contracts = await deploymentHelper.deployERDCore()
    contracts.troveManager = await TroveManagerTester.new()
    contracts.collateralManager = await CollateralManagerTester.new()
    contracts = await deploymentHelper.deployEUSDToken(contracts)

    const ERDContracts = await deploymentHelper.deployERDContracts()

    priceFeedETH = contracts.priceFeedETH
    priceFeedSTETH = contracts.priceFeedSTETH
    eusdToken = contracts.eusdToken
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

    treasury = ERDContracts.treasury
    communityIssuance = ERDContracts.communityIssuance

    await deploymentHelper.connectCoreContracts(contracts, ERDContracts)

    const amountToMint = toBN(dec(100, 18));

    const colls = [contracts.weth.address, contracts.steth.address];
    const amounts = [amountToMint, amountToMint]
    const priceFeeds = [contracts.priceFeedETH, contracts.priceFeedSTETH]
    const collList = await contracts.collateralManager.getCollateralSupport()

    // console.log("collList" ,collList)

    for (account of accounts.slice(0, 10)) {
      await th.openTrove(contracts, {
        extraEUSDAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: account
        }
      })
    }
  })

  describe('TroveManager', async accounts => {
    // applyPendingRewards
    it("applyPendingRewards(): reverts when called by an account that is not BorrowerOperations or TMR", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.applyPendingRewards(bob, {
          from: alice
        })

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations/TMR contract")
      }
    })

    it("batchLiquidateTroves(): reverts when called by an account that is not TroveManger", async () => {
      // Attempt call from alice
      const collList = await contracts.collateralManager.getCollateralSupport()

      await priceFeedETH.setPrice(dec(70, 18))

      await contracts.troveManager.liquidate(alice)

      assertRevert(contracts.troveManagerLiquidations.batchLiquidateTroves([bob], alice))
    })

    // updateRewardSnapshots
    it("updateRewardSnapshots(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.updateTroveRewardSnapshots(bob, {
          from: alice
        })

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // removeStake
    it("removeStake(): reverts when called by an account that is not BorrowerOperations or TMR", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.removeStake(bob, {
          from: alice
        })

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations/TMR contract")
      }
    })

    // updateStakeAndTotalStakes
    it("updateStakeAndTotalStakes(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.updateStakeAndTotalStakes(bob, {
          from: alice
        })

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // closeTrove
    it("closeTrove(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.closeTrove(bob, {
          from: alice
        })

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // addTroveOwnerToArray
    it("addTroveOwnerToArray(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.addTroveOwnerToArray(bob, {
          from: alice
        })

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // setTroveStatus
    it("setTroveStatus(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.setTroveStatus(bob, 1, {
          from: alice
        })

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // updateTroveColl
    it("updateTroveColl(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.updateTroveColl(bob, [contracts.weth.address], [toBN(dec(1, 18))], {
          from: alice
        })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "TroveManager: Caller is not the BorrowerOperations contract")
      }
    })

    // updateTroveCollTMR
    it("updateTroveCollTMR(): reverts when called by an account that is not TroveManagerRedemptions", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.updateTroveCollTMR(bob, [contracts.weth.address], [toBN(dec(1, 18))], {
          from: alice
        })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "TroveManager: Caller is not the TroveManagerLiquidations contract")
      }
    })

    // increaseTroveDebt
    it("increaseTroveDebt(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.increaseTroveDebt(bob, 100, {
          from: alice
        })
      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // decreaseTroveDebt
    it("decreaseTroveDebt(): reverts when called by an account that is not BorrowerOperations/TMR", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.decreaseTroveDebt(bob, 100, {
          from: alice
        })
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
        const txAlice = await activePool.sendCollateral(alice, [contracts.weth.address], ["1"], {
          from: alice
        })
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BorrowerOperations nor TroveManager nor StabilityPool")
      }
    })

    // increaseEUSD
    it("increaseEUSDDebt(): reverts when called by an account that is not BO nor TroveM", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.increaseEUSDDebt(100, {
          from: alice
        })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BorrowerOperations nor TroveManager")
      }
    })

    // decreaseEUSD
    it("decreaseEUSDDebt(): reverts when called by an account that is not BO nor TroveM nor SP", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.decreaseEUSDDebt(100, {
          from: alice
        })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BorrowerOperations nor TroveManager nor StabilityPool")
      }
    })
  })

  describe('DefaultPool', async accounts => {
    // sendCollateralToActivePool
    it("sendCollateralToActivePool(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.sendCollateralToActivePool([contracts.weth.address], [100], {
          from: alice
        })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the TroveManager")
      }
    })

    // increaseEUSD
    it("increaseEUSDDebt(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.increaseEUSDDebt(100, {
          from: alice
        })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the TroveManager")
      }
    })

    // decreaseEUSD
    it("decreaseEUSD(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.decreaseEUSDDebt(100, {
          from: alice
        })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the TroveManager")
      }
    })
  })

  describe('StabilityPool', async accounts => {
    // --- onlyTroveManager --- 

    // offset
    it("offset(): reverts when called by an account that is not TroveManagerLiquidations", async () => {
      // Attempt call from alice
      try {
        txAlice = await stabilityPool.offset(100, [contracts.weth.address], [100], {
          from: alice
        })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not TroveManagerLiquidations")
      }
    })

    // --- onlyActivePool ---
  })

  describe('EUSDToken', async accounts => {
    //    mint
    it("mint(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      const txAlice = eusdToken.mint(bob, 100, {
        from: alice
      })
      await th.assertRevert(txAlice, "Caller is not BorrowerOperations")
    })

    // burn
    it("burn(): reverts when called by an account that is not BO nor TroveM nor SP", async () => {
      // Attempt call from alice
      try {
        const txAlice = await eusdToken.burn(bob, 100, {
          from: alice
        })

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is neither BorrowerOperations nor TroveManager nor StabilityPool")
      }
    })

    // sendToPool
    it("sendToPool(): reverts when called by an account that is not StabilityPool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await eusdToken.sendToPool(bob, activePool.address, 100, {
          from: alice
        })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the StabilityPool")
      }
    })

    // returnFromPool
    it("returnFromPool(): reverts when called by an account that is not TroveManagerLiquidations nor StabilityPool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await eusdToken.returnFromPool(activePool.address, bob, 100, {
          from: alice
        })

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
        const txAlice = await sortedTroves.insert(bob, '130000000000000000000', bob, bob, {
          from: alice
        })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, " Caller is not the BorrowerOperations")
      }
    })

    // --- onlyTroveManager ---
    // remove
    it("remove(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await sortedTroves.remove(bob, {
          from: alice
        })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, " Caller is not the TroveManager")
      }
    })

    // --- onlyTroveMorBM ---
    // reinsert
    it("reinsert(): reverts when called by an account that is neither BorrowerOps nor TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await sortedTroves.reInsert(bob, '150000000000000000000', bob, bob, {
          from: alice
        })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BO nor TroveM")
      }
    })
  })

  describe('CommunityIssuance', async accounts => {
    it("trigger(): nothing", async () => {
      const tx1 = communityIssuance.trigger(alice, dec(100, 18), {
        from: alice
      })
      const tx2 = communityIssuance.trigger(bob, dec(100, 18), {
        from: alice
      })
      const tx3 = communityIssuance.trigger(stabilityPool.address, dec(100, 18), {
        from: alice
      })

      assertRevert(tx1)
      assertRevert(tx2)
      assertRevert(tx3)
    })

    it("issue(): nothing", async () => {
      const tx1 = communityIssuance.issue({
        from: alice
      })

      assertRevert(tx1)
    })
  })

  describe('CollateralManager', async accounts => {
    it("pauseCollateral(): reverts when caller is not the Owner", async () => {
      assertRevert(collateralManager.pauseCollateral(weth.address, {
        from: alice
      }))
    })

    it("removeCollateral(): reverts when caller is not the Owner", async () => {
      assertRevert(collateralManager.removeCollateral(weth.address, {
        from: alice
      }))
    })

    it("activeCollateral(): reverts when caller is not the Owner", async () => {
      assertRevert(collateralManager.activeCollateral(weth.address, {
        from: alice
      }))
    })

    it("setOracle(): reverts when caller is not the Owner", async () => {
      assertRevert(collateralManager.setOracle(weth.address, priceFeedETH.address, {
        from: alice
      }))
    })

    it("setCollateralPriority(): reverts when caller is not the Owner", async () => {
      assertRevert(collateralManager.setCollateralPriority(weth.address, 1, {
        from: alice
      }))
    })
  })

  describe('TroveDebt', async accounts => {
    it("addDebt(): reverts when caller is not the troveManager", async () => {
      assertRevert(contracts.troveDebt.addDebt(bob, 100, web3.utils.toWei('1000000000', 'ether'), {
        from: alice
      }))
    })
    it("subDebt(): reverts when caller is not the troveManager", async () => {
      assertRevert(contracts.troveDebt.subDebt(bob, 100, web3.utils.toWei('1000000000', 'ether'), {
        from: alice
      }))
    })
  })
})