const {
  zeroAddress
} = require("ethereumjs-util")
const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const SortedTroves = artifacts.require("SortedTroves")
const SortedTrovesTester = artifacts.require("SortedTrovesTester")
const TroveManagerTester = artifacts.require("TroveManagerTester")
const CollateralManagerTester = artifacts.require("CollateralManagerTester")
// const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
// const SortedTrovesBOTester = artifacts.require("./SortedTrovesBOTester.sol")
const USDEToken = artifacts.require("USDEToken")

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues

contract('SortedTroves', async accounts => {

  const assertSortedListIsOrdered = async (contracts) => {
    //const price = await contracts.priceFeedTestnet.getPrice()

    let trove = await contracts.sortedTroves.getLast()
    while (trove !== (await contracts.sortedTroves.getFirst())) {

      // Get the adjacent upper trove ("prev" moves up the list, from lower ICR -> higher ICR)
      const prevTrove = await contracts.sortedTroves.getPrev(trove)

      const troveOldICR = await contracts.sortedTroves.getICR(trove) //contracts.th.getCurrentICR(contracts, trove)
      const prevTroveOldICR = await contracts.sortedTroves.getICR(prevTrove) //contracts.th.getCurrentICR(contracts, prevTrove)

      assert.isTrue(prevTroveOldICR.gte(troveOldICR))

      // climb the list
      trove = prevTrove
    }
  }

  const [
    owner,
    alice, bob, carol, dennis, erin, flyn, graham, harriet, ida,
    defaulter_1, defaulter_2, defaulter_3, defaulter_4,
    A, B, C, D, E, F, G, H, I, J, whale
  ] = accounts;

  //let priceFeed
  let sortedTroves
  let troveManager
  let troveManagerRedemptions
  let borrowerOperations
  let usdeToken

  let stableCoin
  let priceFeedStableCoin
  let tokenRisky
  let priceFeedRisky

  let sortedTrovesTester
  let collateralManager

  let contracts

  const getOpenTroveUSDEAmount = async (totalDebt) => th.getOpenTroveUSDEAmount(contracts, totalDebt)
  const openTrove = async (params) => th.openTrove(contracts, params)

  describe('SortedTroves', () => {
    beforeEach(async () => {
      contracts = await deploymentHelper.deployERDCore()
      contracts.troveManager = await TroveManagerTester.new()
      contracts.collateralManager = await CollateralManagerTester.new()
      // contracts.usdeToken = await USDEToken.new(
      //   contracts.troveManager.address,
      //   contracts.troveManagerLiquidations.address,
      //   contracts.troveManagerRedemptions.address,
      //   contracts.stabilityPool.address,
      //   contracts.borrowerOperations.address
      // )

      const ERDContracts = await deploymentHelper.deployERDTesterContractsHardhat()

      sortedTroves = contracts.sortedTroves
      troveManager = contracts.troveManager
      collateralManager = contracts.collateralManager
      borrowerOperations = contracts.borrowerOperations
      usdeToken = contracts.usdeToken
      await deploymentHelper.connectCoreContracts(contracts, ERDContracts)
    })

    it('contains(): returns true for addresses that have opened troves', async () => {
      await openTrove({
        ICR: toBN(dec(150, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        ICR: toBN(dec(20, 18)),
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        ICR: toBN(dec(2000, 18)),
        extraParams: {
          from: carol
        }
      })

      // // Confirm trove statuses became active
      assert.equal((await troveManager.getTroveStatus(alice)).toString(), '1')
      assert.equal((await troveManager.getTroveStatus(bob)).toString(), '1')
      assert.equal((await troveManager.getTroveStatus(carol)).toString(), '1')

      // // Check sorted list contains troves
      assert.isTrue(await sortedTroves.contains(alice))
      assert.isTrue(await sortedTroves.contains(bob))
      assert.isTrue(await sortedTroves.contains(carol))
    })

    it('contains(): returns false for addresses that have not opened troves', async () => {
      await openTrove({
        ICR: toBN(dec(150, 16)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        ICR: toBN(dec(20, 18)),
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        ICR: toBN(dec(2000, 18)),
        extraParams: {
          from: carol
        }
      })

      // Confirm troves have non-existent status
      assert.equal((await troveManager.getTroveStatus(dennis)).toString(), '0')
      assert.equal((await troveManager.getTroveStatus(erin)).toString(), '0')

      // Check sorted list do not contain troves
      assert.isFalse(await sortedTroves.contains(dennis))
      assert.isFalse(await sortedTroves.contains(erin))
    })

    it('contains(): returns false for addresses that opened and then closed a trove', async () => {
      await openTrove({
        ICR: toBN(dec(1000, 18)),
        extraUSDEAmount: toBN(dec(3000, 18)),
        extraParams: {
          from: whale
        }
      })

      await openTrove({
        ICR: toBN(dec(150, 16)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        ICR: toBN(dec(20, 18)),
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        ICR: toBN(dec(2000, 18)),
        extraParams: {
          from: carol
        }
      })

      // to compensate borrowing fees
      await usdeToken.transfer(alice, dec(1000, 18), {
        from: whale
      })
      await usdeToken.transfer(bob, dec(1000, 18), {
        from: whale
      })
      await usdeToken.transfer(carol, dec(1000, 18), {
        from: whale
      })

      // A, B, C close troves
      await borrowerOperations.closeTrove({
        from: alice
      })
      await borrowerOperations.closeTrove({
        from: bob
      })
      await borrowerOperations.closeTrove({
        from: carol
      })

      // Confirm trove statuses became closed
      assert.equal((await troveManager.getTroveStatus(alice)).toString(), '2')
      assert.equal((await troveManager.getTroveStatus(bob)).toString(), '2')
      assert.equal((await troveManager.getTroveStatus(carol)).toString(), '2')

      // Check sorted list does not contain troves
      assert.isFalse(await sortedTroves.contains(alice))
      assert.isFalse(await sortedTroves.contains(bob))
      assert.isFalse(await sortedTroves.contains(carol))
    })

    // true for addresses that opened -> closed -> opened a trove
    it('contains(): returns true for addresses that opened, closed and then re-opened a trove', async () => {
      await openTrove({
        ICR: toBN(dec(1000, 18)),
        extraUSDEAmount: toBN(dec(3000, 18)),
        extraParams: {
          from: whale
        }
      })

      await openTrove({
        ICR: toBN(dec(150, 16)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        ICR: toBN(dec(20, 18)),
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        ICR: toBN(dec(2000, 18)),
        extraParams: {
          from: carol
        }
      })

      // to compensate borrowing fees
      await usdeToken.transfer(alice, dec(1000, 18), {
        from: whale
      })
      await usdeToken.transfer(bob, dec(1000, 18), {
        from: whale
      })
      await usdeToken.transfer(carol, dec(1000, 18), {
        from: whale
      })

      // A, B, C close troves
      await borrowerOperations.closeTrove({
        from: alice
      })
      await borrowerOperations.closeTrove({
        from: bob
      })
      await borrowerOperations.closeTrove({
        from: carol
      })

      // Confirm trove statuses became closed
      assert.equal((await troveManager.getTroveStatus(alice)).toString(), '2')
      assert.equal((await troveManager.getTroveStatus(bob)).toString(), '2')
      assert.equal((await troveManager.getTroveStatus(carol)).toString(), '2')

      await openTrove({
        ICR: toBN(dec(1000, 16)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        ICR: toBN(dec(2000, 18)),
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        ICR: toBN(dec(3000, 18)),
        extraParams: {
          from: carol
        }
      })

      // Confirm trove statuses became open again
      assert.equal((await troveManager.getTroveStatus(alice)).toString(), '1')
      assert.equal((await troveManager.getTroveStatus(bob)).toString(), '1')
      assert.equal((await troveManager.getTroveStatus(carol)).toString(), '1')

      // Check sorted list does  contain troves
      assert.isTrue(await sortedTroves.contains(alice))
      assert.isTrue(await sortedTroves.contains(bob))
      assert.isTrue(await sortedTroves.contains(carol))
    })

    // false when list size is 0
    it('contains(): returns false when there are no troves in the system', async () => {
      assert.isFalse(await sortedTroves.contains(alice))
      assert.isFalse(await sortedTroves.contains(bob))
      assert.isFalse(await sortedTroves.contains(carol))
    })

    // true when list size is 1 and the trove the only one in system
    it('contains(): true when list size is 1 and the trove the only one in system', async () => {
      await openTrove({
        ICR: toBN(dec(150, 16)),
        extraParams: {
          from: alice
        }
      })

      assert.isTrue(await sortedTroves.contains(alice))
    })

    // false when list size is 1 and trove is not in the system
    it('contains(): false when list size is 1 and trove is not in the system', async () => {
      await openTrove({
        ICR: toBN(dec(150, 16)),
        extraParams: {
          from: alice
        }
      })

      assert.isFalse(await sortedTroves.contains(bob))
    })

    // --- getMaxSize ---

    it("getMaxSize(): Returns the maximum list size", async () => {
      const max = await sortedTroves.getMaxSize()

      assert.equal(web3.utils.toHex(max), th.maxBytes32)
    })

    //--- Ordering --- 
    // infinte ICR (zero collateral) is not possible anymore, therefore, skipping
    it.skip("stays ordered after troves with 'infinite' ICR receive a redistribution", async () => {
      // make several troves with 0 debt and collateral, in random order
      await borrowerOperations.openTrove([], [], th._100pct, 0, whale, whale, {
        from: whale,
        value: dec(50, 'ether')
      })
      await borrowerOperations.openTrove([], [], th._100pct, 0, A, A, {
        from: A,
        value: dec(1, 'ether')
      })
      await borrowerOperations.openTrove([], [], th._100pct, 0, B, B, {
        from: B,
        value: dec(37, 'ether')
      })
      await borrowerOperations.openTrove([], [], th._100pct, 0, C, C, {
        from: C,
        value: dec(5, 'ether')
      })
      await borrowerOperations.openTrove([], [], th._100pct, 0, D, D, {
        from: D,
        value: dec(4, 'ether')
      })
      await borrowerOperations.openTrove([], [], th._100pct, 0, E, E, {
        from: E,
        value: dec(19, 'ether')
      })

      // Make some troves with non-zero debt, in random order
      await borrowerOperations.openTrove([], [], th._100pct, dec(5, 19), F, F, {
        from: F,
        value: dec(1, 'ether')
      })
      await borrowerOperations.openTrove([], [], th._100pct, dec(3, 18), G, G, {
        from: G,
        value: dec(37, 'ether')
      })
      await borrowerOperations.openTrove([], [], th._100pct, dec(2, 20), H, H, {
        from: H,
        value: dec(5, 'ether')
      })
      await borrowerOperations.openTrove([], [], th._100pct, dec(17, 18), I, I, {
        from: I,
        value: dec(4, 'ether')
      })
      await borrowerOperations.openTrove([], [], th._100pct, dec(5, 21), J, J, {
        from: J,
        value: dec(1345, 'ether')
      })

      const price_1 = await priceFeed.getPrice()

      // Check troves are ordered
      await assertSortedListIsOrdered(contracts)

      await borrowerOperations.openTrove([], [], th._100pct, dec(100, 18), defaulter_1, defaulter_1, {
        from: defaulter_1,
        value: dec(1, 'ether')
      })
      assert.isTrue(await sortedTroves.contains(defaulter_1))

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price_2 = await priceFeed.getPrice()

      // Liquidate a trove
      await troveManager.liquidate(defaulter_1)
      assert.isFalse(await sortedTroves.contains(defaulter_1))

      // Check troves are ordered
      await assertSortedListIsOrdered(contracts)
    })
  })

  describe('SortedTroves with mock dependencies', () => {
    beforeEach(async () => {
      contracts = await deploymentHelper.deployERDCore()
      contracts.troveManager = await TroveManagerTester.new()
      // contracts.borrowerOperations = await SortedTrovesBOTester.new()
      //contracts.borrowerOperations = await BorrowerOperationsTester.new()
      // contracts.usdeToken = await USDEToken.new(
      //   contracts.troveManager.address,
      //   contracts.troveManagerLiquidations.address,
      //   contracts.troveManagerRedemptions.address,
      //   contracts.stabilityPool.address,
      //   contracts.borrowerOperations.address
      // )

      const ERDContracts = await deploymentHelper.deployERDTesterContractsHardhat()

      sortedTroves = contracts.sortedTroves
      troveManager = contracts.troveManager
      borrowerOperations = contracts.borrowerOperations
      usdeToken = contracts.usdeToken
      await deploymentHelper.connectCoreContracts(contracts, ERDContracts)

      sortedTrovesTester = await SortedTrovesTester.new()
      sortedTrovesTester.initialize()

      // borrowerOperations.resetSortedTroves(sortedTrovesTester.address)
    })

    context('when params are wrongly set', () => {
      it('setParams(): reverts if size is zero', async () => {
        await th.assertRevert(sortedTrovesTester.setParams(0, troveManager.address, borrowerOperations.address, contracts.troveManagerRedemptions.address), "SortedTroves: Size can't be zero")
      })
    })

    context('when params are properly set', () => {
      beforeEach('set params', async () => {
        await sortedTrovesTester.setParams(2, troveManager.address, borrowerOperations.address, contracts.troveManagerRedemptions.address)
      })

      it('insert(): fails if list is full', async () => {
        await sortedTrovesTester.callInsert(alice, 1, alice, alice)
        await sortedTrovesTester.callInsert(bob, 1, alice, alice)
        await th.assertRevert(sortedTrovesTester.callInsert(carol, 1, alice, alice), 'SortedTroves: List is full')
      })

      it('insert(): fails if list already contains the node', async () => {
        await sortedTrovesTester.callInsert(alice, 1, alice, alice)
        await th.assertRevert(sortedTrovesTester.callInsert(alice, 1, alice, alice), 'SortedTroves: List already contains the node')
      })

      it('insert(): fails if id is zero', async () => {
        await th.assertRevert(sortedTrovesTester.callInsert(th.ZERO_ADDRESS, 1, alice, alice), 'SortedTroves: Id cannot be zero')
      })

      it('insert(): fails if ICR is zero', async () => {
        await th.assertRevert(sortedTrovesTester.callInsert(alice, 0, alice, alice), 'SortedTroves: ICR must be positive')
      })

      it('remove(): fails if id is not in the list', async () => {
        await th.assertRevert(sortedTrovesTester.callRemove(alice), 'SortedTroves: List does not contain the id')
      })

      it('reInsert(): fails if list doesn’t contain the node', async () => {
        await th.assertRevert(sortedTrovesTester.callReInsert(alice, 1, alice, alice), 'SortedTroves: List does not contain the id')
      })

      it('reInsert(): fails if new ICR is zero', async () => {
        await sortedTrovesTester.callInsert(alice, 1, alice, alice)
        assert.isTrue(await sortedTrovesTester.contains(alice), 'list should contain element')
        await th.assertRevert(sortedTrovesTester.callReInsert(alice, 0, alice, alice), 'SortedTroves: ICR must be positive')
        assert.isTrue(await sortedTrovesTester.contains(alice), 'list should contain element')
      })

      it('findInsertPosition(): No prevId for hint - ascend list starting from nextId, result is after the tail', async () => {
        await sortedTrovesTester.callInsert(alice, 1, alice, alice)
        const pos = await sortedTrovesTester.findInsertPosition(1, th.ZERO_ADDRESS, alice)
        assert.equal(pos[0], alice, 'prevId result should be nextId param')
        assert.equal(pos[1], th.ZERO_ADDRESS, 'nextId result should be zero')
      })


    })
  })

  describe('Check position, re-insert multi-collateral multi-ratio, selective update, etc. ', () => {
    beforeEach(async () => {
      contracts = await deploymentHelper.deployERDCore()
      contracts.troveManager = await TroveManagerTester.new()
      contracts.collateralManager = await CollateralManagerTester.new()
      // contracts.borrowerOperations = await SortedTrovesBOTester.new()
      // contracts.usdeToken = await USDEToken.new(
      //   contracts.troveManager.address,
      //   contracts.troveManagerLiquidations.address,
      //   contracts.troveManagerRedemptions.address,
      //   contracts.stabilityPool.address,
      //   contracts.borrowerOperations.address
      // )
      const ERDContracts = await deploymentHelper.deployERDTesterContractsHardhat()

      sortedTrovesTester = await SortedTrovesTester.new()

      contracts.sortedTroves = sortedTrovesTester
      sortedTroves = contracts.sortedTroves
      troveManager = contracts.troveManager
      collateralManager = contracts.collateralManager
      borrowerOperations = contracts.borrowerOperations
      usdeToken = contracts.usdeToken
      troveManagerRedemptions = contracts.troveManagerRedemptions
      await deploymentHelper.connectCoreContracts(contracts, ERDContracts)

      // Deploy new trove manager
      await collateralManager.addCollateral(contracts.steth.address, contracts.priceFeedSTETH.address, contracts.eTokenSTETH.address, toBN(dec(1, 18)))
      await contracts.priceFeedSTETH.setPrice(dec(1, 18))

      const paramsRisky = {
        name: "Risky Token",
        symbol: "T.R",
        decimals: 18,
        price: dec(1, 18),
        ratio: toBN(dec(1, 18))
      }
      let result = await deploymentHelper.deployExtraCollateral(contracts, paramsRisky)
      tokenRisky = result.token
      priceFeedRisky = result.priceFeed
      eTokenRisky = result.eToken


      const paramsStableCoin = {
        name: "USD Coin",
        symbol: "USDC",
        decimals: 18,
        price: dec(1, 18),
        ratio: toBN(dec(1, 18))
      }
      result = await deploymentHelper.deployExtraCollateral(contracts, paramsStableCoin)
      stableCoin = result.token
      priceFeedStableCoin = result.priceFeed
      eTokenStableCoin = result.eToken


      await contracts.priceFeedETH.setPrice(dec(100, 18))
      await contracts.priceFeedSTETH.setPrice(dec(99, 16))
      await priceFeedStableCoin.setPrice(toBN(dec(95, 16)))
      await priceFeedRisky.setPrice(toBN(dec(1, 18)))
      await makeTrovesInSequence()
      // Whale ~250%, A ~200%, B ~150%, C ~130%, D ~140%, E ~125%
      // Whale has weth, steth
      // A has weth, stable
      // B has weth, risky
      // C has stable, risky
      // D has steth, risky
      // E has steth, stable
    })

    it('findInsertPosition(): After price changes, list remains sorted as original. Update single trove updates just that ICR.', async () => {
      // Whale ~250%, A ~200%, B ~150%, C ~130%, D ~140%, E ~125%
      // Whale has weth, steth
      // A has weth, stable
      // B has weth, risky
      // C has stable, risky
      // D has steth, risky
      // E has steth, stable

      // Expect a trove with ICR 280% to be inserted between A and B
      let targetICR = dec(180, 16)

      // Pass addresses that loosely bound the right postiion
      let hints = await sortedTrovesTester.findInsertPosition(targetICR, A, E)
      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], A)
      assert.equal(hints[1], B)

      // Change prices. List should not update since we are using stale list.
      await contracts.priceFeedETH.setPrice(dec(90, 18))
      hints = await sortedTrovesTester.findInsertPosition(targetICR, A, E)
      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], A)
      assert.equal(hints[1], B)

      await assertSortedListIsOrdered(contracts)

      // Change prices and update only one trove. Insert position should reflect new change.
      await contracts.priceFeedSTETH.setPrice(dec(1, 18))
      await priceFeedStableCoin.setPrice(toBN(dec(1, 18)))
      await priceFeedRisky.setPrice(toBN(dec(1, 18)))
      let DUpdatedICR = await th.getCurrentICR(contracts, D)
      th.assertIsApproximatelyEqual(DUpdatedICR, toBN(dec(126, 16)), toBN(dec(1, 14)))
      // assert.isTrue(DUpdatedICR.eq(toBN(dec(360, 16))), 'ICR should be updated correctly')
      await sortedTrovesTester.callReInsert(D, DUpdatedICR, A, E)

      targetICR = dec(130, 16)
      hints = await sortedTrovesTester.findInsertPosition(targetICR, A, E)
      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], B)
      assert.equal(hints[1], D)

      await assertSortedListIsOrdered(contracts)

      // Re-insert all options.
      let whaleUpdatedICR = await th.getCurrentICR(contracts, whale)
      let AUpdatedICR = await th.getCurrentICR(contracts, A)
      let BUpdatedICR = await th.getCurrentICR(contracts, B)
      let CUpdatedICR = await th.getCurrentICR(contracts, C)
      let EUpdatedICR = await th.getCurrentICR(contracts, E)
      await sortedTrovesTester.callReInsert(whale, whaleUpdatedICR, whale, E)
      await sortedTrovesTester.callReInsert(A, AUpdatedICR, whale, E)
      await sortedTrovesTester.callReInsert(B, BUpdatedICR, whale, E)
      await sortedTrovesTester.callReInsert(C, CUpdatedICR, whale, E)

      // Expect E to still be out of position
      targetICR = dec(120, 16)
      hints = await sortedTrovesTester.findInsertPosition(targetICR, A, E)
      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], E)
      assert.equal(hints[1], C)

      await sortedTrovesTester.callReInsert(E, EUpdatedICR, whale, E)

      hints = await sortedTrovesTester.findInsertPosition(targetICR, A, E)
      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], D)
      assert.equal(hints[1], C)

      await assertSortedListIsOrdered(contracts)
    })

    it('TroveManager updateTroves(), correctly inserts multiple troves. ', async () => {
      // Whale ~250%, A ~200%, B ~150%, C ~130%, D ~140%, E ~125%
      // Whale has weth, steth
      // A has weth, stable
      // B has weth, risky
      // C has stable, risky
      // D has steth, risky
      // E has steth, stable

      // Expect a trove with ICR 280% to be inserted between A and B
      let targetICR = dec(180, 16)

      // Pass addresses that loosely bound the right postiion
      let hints = await sortedTrovesTester.findInsertPosition(targetICR, A, E)
      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], A)
      assert.equal(hints[1], B)

      // Change prices. List should not update since we are using stale list.
      await contracts.priceFeedETH.setPrice(dec(90, 18))
      hints = await sortedTrovesTester.findInsertPosition(targetICR, A, E)
      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], A)
      assert.equal(hints[1], B)

      await assertSortedListIsOrdered(contracts)

      // Change prices and update only one trove. Insert position should reflect new change.
      await contracts.priceFeedSTETH.setPrice(dec(1, 18))
      await priceFeedStableCoin.setPrice(toBN(dec(1, 18)))
      await priceFeedRisky.setPrice(toBN(dec(1, 18)))
      let DUpdatedICR = await th.getCurrentICR(contracts, D)
      th.assertIsApproximatelyEqual(DUpdatedICR, toBN(dec(126, 16)), toBN(dec(1, 14)))
      await troveManagerRedemptions.updateTroves([D], [A], [E])
      // sortedTrovesTester.callReInsert(D, DUpdatedICR, A, E)

      targetICR = dec(130, 16)
      hints = await sortedTrovesTester.findInsertPosition(targetICR, A, E)
      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], B)
      assert.equal(hints[1], D)

      await assertSortedListIsOrdered(contracts)

      // Re-insert all options except E.
      await troveManagerRedemptions.updateTroves([whale, A, B, C], [whale, whale, whale, whale], [E, E, E, E])

      // Expect E to still be out of position
      targetICR = dec(120, 16)
      hints = await sortedTrovesTester.findInsertPosition(targetICR, A, E)
      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], E)
      assert.equal(hints[1], C)

      await troveManagerRedemptions.updateTroves([E], [whale], [E])
      // await sortedTrovesTester.callReInsert(E, EUpdatedICR, whale, E)

      hints = await sortedTrovesTester.findInsertPosition(targetICR, A, E)
      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], D)
      assert.equal(hints[1], C)

      await assertSortedListIsOrdered(contracts)

      // Also hints can be wrong.
      await troveManagerRedemptions.updateTroves([E], [E], [whale])

      await assertSortedListIsOrdered(contracts)
    })

  })


  // Sequentially add coll and withdraw USDE, 1 account at a time
  const makeTrovesInSequence = async () => {
    // const makeTrovesInSequence = async () => {
    const allColls = [contracts.weth, contracts.steth, stableCoin, tokenRisky]
    const allAmounts = [toBN(dec(100, 18)), // price = 100. Collateral amount = 100. Value = 100 * 100 = 10000
      toBN(dec(200, 18)), // price = 0.99ETH. Collateral amount = 200. Value = 200 * 100 * 0.99 = 19800
      toBN(dec(300, 18)), // price = 0.95ETH. Collateral amount = 300. Value = 300 * 100 * 0.95 = 28500
      toBN(dec(150, 18))
    ] // price = 1 ETH. Collateral amount = 150. value = 150 * 100 * 1 = 15000

    const whaleColls = [contracts.weth, contracts.steth]
    const whaleAmounts = [allAmounts[0], allAmounts[1]]
    const AColls = [contracts.weth, stableCoin]
    const AAmounts = [allAmounts[0], allAmounts[2]]
    const BColls = [contracts.weth, tokenRisky]
    const BAmounts = [allAmounts[0], allAmounts[3]]
    const CColls = [stableCoin, tokenRisky]
    const CAmounts = [allAmounts[2], allAmounts[3]]
    const DColls = [contracts.steth, tokenRisky]
    const DAmounts = [allAmounts[1], allAmounts[3]]
    const EColls = [contracts.steth, stableCoin]
    const EAmounts = [allAmounts[1], allAmounts[2]]

    await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(250, 16)),
      colls: whaleColls,
      amounts: whaleAmounts,
      extraParams: {
        from: whale
      }
    })
    await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(200, 16)),
      colls: AColls,
      amounts: AAmounts,
      extraParams: {
        from: A
      }
    })
    await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(150, 16)),
      colls: BColls,
      amounts: BAmounts,
      extraParams: {
        from: B
      }
    })
    await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(130, 16)),
      colls: CColls,
      amounts: CAmounts,
      extraParams: {
        from: C
      }
    })
    await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(140, 16)),
      colls: DColls,
      amounts: DAmounts,
      extraParams: {
        from: D
      }
    })
    await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(125, 16)),
      colls: EColls,
      amounts: EAmounts,
      extraParams: {
        from: E
      }
    })
  }


})