const deploymentHelper = require("../utils/deploymentHelpers.js")
const {
  TestHelper: th,
  MoneyValues: mv
} = require("../utils/testHelpers.js")
const {
  toBN,
  dec,
  ZERO_ADDRESS
} = th

const _dec = (number) => toBN(dec(1, number))
const TroveManagerTester = artifacts.require("./TroveManagerTester")
const CollateralManagerTester = artifacts.require("CollateralManagerTester")
const USDEToken = artifacts.require("./USDEToken.sol")

contract('TroveManager - in Recovery Mode - back to normal mode in 1 tx', async accounts => {
  const [
    owner,
    alice, bob, carol, dennis, erin, freddy, greta, harry, ida,
    whale, defaulter_1, defaulter_2, defaulter_3, defaulter_4,
    A, B, C, D, E, F, G, H, I
  ] = accounts;

  let contracts
  let troveManager
  let stabilityPool
  let priceFeed
  let priceFeedSTETH
  let sortedTroves

  const openTrove = async (params) => th.openTrove(contracts, params)

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
    const ERDContracts = await deploymentHelper.deployERDContracts()

    troveManager = contracts.troveManager
    stabilityPool = contracts.stabilityPool
    priceFeed = contracts.priceFeedETH
    sortedTroves = contracts.sortedTroves
    weth = contracts.weth
    steth = contracts.steth

    await deploymentHelper.connectCoreContracts(contracts, ERDContracts)
  })

  context('Batch liquidations', () => {
    const setup = async () => {
      const {
        collateral: A_coll,
        totalDebt: A_totalDebt
      } = await openTrove({
        ICR: toBN(dec(296, 16)),
        extraParams: {
          from: alice
        }
      })
      const {
        collateral: B_coll,
        totalDebt: B_totalDebt
      } = await openTrove({
        ICR: toBN(dec(280, 16)),
        extraParams: {
          from: bob
        }
      })
      const {
        collateral: C_coll,
        totalDebt: C_totalDebt
      } = await openTrove({
        ICR: toBN(dec(150, 16)),
        extraParams: {
          from: carol
        }
      })

      const totalLiquidatedDebt = A_totalDebt.add(B_totalDebt).add(C_totalDebt)

      await openTrove({
        ICR: toBN(dec(340, 16)),
        extraUSDEAmount: totalLiquidatedDebt,
        extraParams: {
          from: whale
        }
      })
      await stabilityPool.provideToSP(totalLiquidatedDebt, ZERO_ADDRESS, {
        from: whale
      })
      // Price drops
      await priceFeed.setPrice(dec(85, 18))
      const price = await priceFeed.getPrice()
      const TCR = await th.getTCR(contracts)
      // Check Recovery Mode is active
      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Check troves A, B are in range 110% < ICR < TCR, C is below 100%
      const ICR_A = await th.getCurrentICR(contracts, alice)
      const ICR_B = await th.getCurrentICR(contracts, bob)
      const ICR_C = await th.getCurrentICR(contracts, carol)

      assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
      assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
      assert.isTrue(ICR_C.lt(mv._ICR100))

      return {
        A_coll,
        A_totalDebt,
        B_coll,
        B_totalDebt,
        C_coll,
        C_totalDebt,
        totalLiquidatedDebt,
        price,
      }
    }

    it('First trove only doesn\'t get out of Recovery Mode', async () => {
      await setup()
      const tx = await troveManager.batchLiquidateTroves([alice])

      const TCR = await th.getTCR(contracts)
      assert.isTrue(await th.checkRecoveryMode(contracts))
    })

    it('Two troves over MCR are liquidated', async () => {
      await setup()
      const tx = await troveManager.batchLiquidateTroves([alice, bob, carol])

      // Confirm all troves removed
      assert.isFalse(await sortedTroves.contains(alice))
      // assert.isFalse(await sortedTroves.contains(bob))
      assert.isFalse(await sortedTroves.contains(carol))

      // Confirm troves have status 'closed by liquidation' (Status enum element idx 3)
      assert.equal((await troveManager.getTroveStatus(alice)), '3')
      // assert.equal((await troveManager.getTroveStatus(bob)), '3')
      assert.equal((await troveManager.getTroveStatus(carol)), '3')
    })

    it('Stability Pool profit matches', async () => {
      const {
        A_coll,
        A_totalDebt,
        C_coll,
        C_totalDebt,
        totalLiquidatedDebt,
        price,
      } = await setup()

      const spEthBefore = await stabilityPool.getCollateralAmount(weth.address);
      const spusdeBefore = await stabilityPool.getTotalUSDEDeposits()

      const tx = await troveManager.batchLiquidateTroves([alice, carol])

      // Confirm all troves removed
      assert.isFalse(await sortedTroves.contains(alice))
      assert.isFalse(await sortedTroves.contains(carol))

      // Confirm troves have status 'closed by liquidation' (Status enum element idx 3)
      assert.equal((await troveManager.getTroveStatus(alice)), '3')
      assert.equal((await troveManager.getTroveStatus(carol)), '3')

      const spEthAfter = await stabilityPool.getCollateralAmount(weth.address);
      const spusdeAfter = await stabilityPool.getTotalUSDEDeposits()


      // liquidate collaterals with the gas compensation fee subtracted
      const expectedCollateralLiquidatedA = th.applyLiquidationFee(A_totalDebt.mul(mv._MCR).div(price))
      const expectedCollateralLiquidatedC = th.applyLiquidationFee(C_coll)
      // Stability Pool gains
      const expectedGainInUSDE = expectedCollateralLiquidatedA.mul(price).div(mv._1e18BN).sub(A_totalDebt)
      const realGainInUSDE = spEthAfter.sub(spEthBefore).mul(price).div(mv._1e18BN).sub(spusdeBefore.sub(spusdeAfter))

      assert.isAtMost(th.getDifference(spEthAfter.sub(spEthBefore), expectedCollateralLiquidatedA), _dec(12))
      assert.isAtMost(th.getDifference(spusdeBefore.sub(spusdeAfter), A_totalDebt), _dec(14))
      assert.isAtMost(th.getDifference(realGainInUSDE, expectedGainInUSDE), _dec(12))
    })

    it('A trove over TCR is not liquidated', async () => {
      const {
        collateral: A_coll,
        totalDebt: A_totalDebt
      } = await openTrove({
        ICR: toBN(dec(280, 16)),
        extraParams: {
          from: alice
        }
      })
      const {
        collateral: B_coll,
        totalDebt: B_totalDebt
      } = await openTrove({
        ICR: toBN(dec(276, 16)),
        extraParams: {
          from: bob
        }
      })
      const {
        collateral: C_coll,
        totalDebt: C_totalDebt
      } = await openTrove({
        ICR: toBN(dec(150, 16)),
        extraParams: {
          from: carol
        }
      })

      const totalLiquidatedDebt = A_totalDebt.add(B_totalDebt).add(C_totalDebt)

      await openTrove({
        ICR: toBN(dec(310, 16)),
        extraUSDEAmount: totalLiquidatedDebt,
        extraParams: {
          from: whale
        }
      })
      await stabilityPool.provideToSP(totalLiquidatedDebt, ZERO_ADDRESS, {
        from: whale
      })

      // Price drops
      await priceFeed.setPrice(dec(85, 18))
      const price = await priceFeed.getPrice()
      const TCR = await th.getTCR(contracts)

      // Check Recovery Mode is active
      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Check troves A, B are in range 110% < ICR < TCR, C is below 100%
      const ICR_A = await th.getCurrentICR(contracts, alice)
      const ICR_B = await th.getCurrentICR(contracts, bob)
      const ICR_C = await th.getCurrentICR(contracts, carol)

      assert.isTrue(ICR_A.gt(TCR))
      assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
      assert.isTrue(ICR_C.lt(mv._ICR100))

      const tx = await troveManager.batchLiquidateTroves([bob, alice])

      const liquidationEvents = th.getAllEventsByName(tx, 'TroveLiquidated')
      assert.equal(liquidationEvents.length, 1, 'Not enough liquidations')

      // Confirm only Bob’s trove removed
      assert.isTrue(await sortedTroves.contains(alice))
      assert.isFalse(await sortedTroves.contains(bob))
      assert.isTrue(await sortedTroves.contains(carol))

      // Confirm troves have status 'closed by liquidation' (Status enum element idx 3)
      assert.equal((await troveManager.getTroveStatus(bob)), '3')
      // Confirm troves have status 'open' (Status enum element idx 1)
      assert.equal((await troveManager.getTroveStatus(alice)), '1')
      assert.equal((await troveManager.getTroveStatus(carol)), '1')
    })
  })

  context('Sequential liquidations', () => {
    const setup = async () => {
      const {
        collateral: A_coll,
        totalDebt: A_totalDebt
      } = await openTrove({
        ICR: toBN(dec(299, 16)),
        extraParams: {
          from: alice
        }
      })
      const {
        collateral: B_coll,
        totalDebt: B_totalDebt
      } = await openTrove({
        ICR: toBN(dec(298, 16)),
        extraParams: {
          from: bob
        }
      })

      const totalLiquidatedDebt = A_totalDebt.add(B_totalDebt)

      await openTrove({
        ICR: toBN(dec(300, 16)),
        extraUSDEAmount: totalLiquidatedDebt.add(toBN(dec(1, 18))),
        extraParams: {
          from: whale
        }
      })
      await stabilityPool.provideToSP(totalLiquidatedDebt.add(toBN(dec(1, 18))), ZERO_ADDRESS, {
        from: whale
      })

      // Price drops
      await priceFeed.setPrice(dec(85, 18))
      const price = await priceFeed.getPrice()
      const TCR = await th.getTCR(contracts)

      // Check Recovery Mode is active
      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Check troves A, B are in range 110% < ICR < TCR, C is below 100%
      const ICR_A = await th.getCurrentICR(contracts, alice)
      const ICR_B = await th.getCurrentICR(contracts, bob)

      assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
      assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))

      return {
        A_coll,
        A_totalDebt,
        B_coll,
        B_totalDebt,
        totalLiquidatedDebt,
        price,
      }
    }

    it('First trove only doesn’t get out of Recovery Mode', async () => {
      await setup()
      const tx = await troveManager.liquidateTroves(1)

      const TCR = await th.getTCR(contracts)
      assert.isTrue(await th.checkRecoveryMode(contracts))
    })

    it('Two troves over MCR are liquidated', async () => {
      await setup()
      const tx = await troveManager.liquidateTroves(10)

      const liquidationEvents = th.getAllEventsByName(tx, 'TroveLiquidated')
      assert.equal(liquidationEvents.length, 2, 'Not enough liquidations')

      // Confirm all troves removed
      assert.isFalse(await sortedTroves.contains(alice))
      assert.isFalse(await sortedTroves.contains(bob))

      // Confirm troves have status 'closed by liquidation' (Status enum element idx 3)
      assert.equal((await troveManager.getTroveStatus(alice)), '3')
      assert.equal((await troveManager.getTroveStatus(bob)), '3')
    })
  })
})