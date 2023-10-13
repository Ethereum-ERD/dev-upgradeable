const {
  assert
} = require("chai")
const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const CollateralManagerTester = artifacts.require("CollateralManagerTester")
// const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const TroveManagerLiquidations = artifacts.require("./TroveManagerLiquidations.sol")
const USDETokenTester = artifacts.require("./USDETokenTester")

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const TroveManagerTester = artifacts.require("TroveManagerTester")
const USDEToken = artifacts.require("USDEToken")
const NonPayable = artifacts.require('NonPayable.sol')
const _1e14BN = toBN(dec(1, 14))
const ZERO = toBN('0')
const ZERO_ADDRESS = th.ZERO_ADDRESS
const maxBytes32 = th.maxBytes32

contract('StabilityPool', async accounts => {

  const [owner,
    defaulter_1, defaulter_2, defaulter_3,
    whale,
    alice, bob, carol, dennis, erin, flyn,
    A, B, C, D, E, F,
    frontEnd_1, frontEnd_2, frontEnd_3,
  ] = accounts;

  const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]
  let contracts
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
  let communityIssuance
  let weth
  let priceFeedETH
  let steth
  let priceFeedSTETH
  let tokenA
  let priceFeedA
  let tokenB
  let priceFeedB
  let tokenC
  let priceFeedC
  let tokenD
  let priceFeedD
  let tokenRisky
  let priceFeedRisky
  let tokenSuperRisky
  let priceFeedSuperRisky
  let tokenLowDecimal
  let priceFeedLowDecimal
  let stableCoin
  let priceFeedStableCoin
  let tokens
  let troveManagerRedemptions
  let troveManagerLiquidations

  let gasPriceInWei

  const getOpenTroveUSDEAmount = async (totalDebt) => th.getOpenTroveUSDEAmount(contracts, totalDebt)
  const openTrove = async (params) => th.openTrove(contracts, params)
  const openTroveToken = async (token, params) => th.openTroveWithToken(contracts, token, params)

  describe("Stability Pool Mechanisms", async () => {
    before(async () => {
      gasPriceInWei = await web3.eth.getGasPrice()
    })

    beforeEach(async () => {
      contracts = await deploymentHelper.deployERDCore()
      contracts.collateralManager = await CollateralManagerTester.new()
      // contracts.borrowerOperations = await BorrowerOperationsTester.new()
      contracts.troveManager = await TroveManagerTester.new()

      // contracts.usdeToken = await USDETokenTester.new(contracts.troveManager.address,
      //     contracts.troveManagerLiquidations.address,
      //     contracts.troveManagerRedemptions.address,
      //     contracts.stabilityPool.address,
      //     contracts.borrowerOperations.address),
      const ERDContracts = await deploymentHelper.deployERDContracts()
      contracts = await deploymentHelper.deployUSDETokenTester(contracts, ERDContracts)

      priceFeedETH = contracts.priceFeedETH
      priceFeedSTETH = contracts.priceFeedSTETH
      usdeToken = contracts.usdeToken
      sortedTroves = contracts.sortedTroves
      troveManager = contracts.troveManager
      activePool = contracts.activePool
      stabilityPool = contracts.stabilityPool
      defaultPool = contracts.defaultPool
      borrowerOperations = contracts.borrowerOperations
      hintHelpers = contracts.hintHelpers
      weth = contracts.weth
      steth = contracts.steth
      troveManagerLiquidations = contracts.troveManagerLiquidations
      troveManagerRedemptions = contracts.troveManagerRedemptions
      collateralManager = contracts.collateralManager

      treasury = ERDContracts.treasury
      liquidityIncentive = ERDContracts.liquidityIncentive
      communityIssuance = ERDContracts.communityIssuance

      await deploymentHelper.connectCoreContracts(contracts, ERDContracts)

      await collateralManager.addCollateral(contracts.steth.address, priceFeedSTETH.address, contracts.eTokenSTETH.address, toBN(dec(1, 18)))
      await priceFeedSTETH.setPrice(dec(1, 18))
      // Register 3 front ends
      await th.registerFrontEnds(frontEnds, stabilityPool)

      const paramsA = {
        name: "Token A",
        symbol: "T.A",
        decimals: 18,
        price: toBN(dec(1, 18)),
        ratio: toBN(dec(1, 18))
      }
      let result = await deploymentHelper.deployExtraCollateral(contracts, paramsA)
      tokenA = result.token
      priceFeedA = result.priceFeed
      eTokenA = result.eToken

      const paramsB = {
        name: "Token B",
        symbol: "T.B",
        decimals: 18,
        price: toBN(dec(1, 18)),
        ratio: toBN(dec(1, 18))
      }
      result = await deploymentHelper.deployExtraCollateral(contracts, paramsB)
      tokenB = result.token
      priceFeedB = result.priceFeed
      eTokenB = result.eToken

      const paramsC = {
        name: "Token C",
        symbol: "T.C",
        decimals: 18,
        price: toBN(dec(1, 18)),
        ratio: toBN(dec(1, 18))
      }
      result = await deploymentHelper.deployExtraCollateral(contracts, paramsC)
      tokenC = result.token
      priceFeedC = result.priceFeed
      eTokenC = result.eToken

      const paramsD = {
        name: "Token D",
        symbol: "T.D",
        decimals: 18,
        price: toBN(dec(1, 18)),
        ratio: toBN(dec(1, 18))
      }
      result = await deploymentHelper.deployExtraCollateral(contracts, paramsD)
      tokenD = result.token
      priceFeedD = result.priceFeed
      eTokenD = result.eToken

      const paramsRisky = {
        name: "Risky Token",
        symbol: "T.R",
        decimals: 18,
        price: toBN(dec(1, 18)),
        ratio: toBN(dec(1, 18))
      }
      result = await deploymentHelper.deployExtraCollateral(contracts, paramsRisky)
      tokenRisky = result.token
      priceFeedRisky = result.priceFeed
      eTokenRisky = result.eToken

      const paramsSuperRisky = {
        name: "Super Risky Token",
        symbol: "T.SR",
        decimals: 18,
        price: toBN(dec(1, 18)),
        ratio: toBN(dec(1, 18))
      }
      result = await deploymentHelper.deployExtraCollateral(contracts, paramsSuperRisky)
      tokenSuperRisky = result.token
      priceFeedSuperRisky = result.priceFeed
      eTokenSuperRisky = result.eToken

      const paramsStableCoin = {
        name: "USD Coin",
        symbol: "USDC",
        decimals: 18,
        price: toBN(dec(1, 18)),
        ratio: toBN(dec(1, 18))
      }
      result = await deploymentHelper.deployExtraCollateral(contracts, paramsStableCoin)
      stableCoin = result.token
      priceFeedStableCoin = result.priceFeed
      eTokenStableCoin = result.eToken
    })

    it("MULTICOLLATERAL withdrawFromSP(): partial retrieval - retrieves correct USDE amount and the entire ETH Gain, and updates deposit", async () => {
      // --- SETUP ---

      await th.addERC20(steth, whale, borrowerOperations.address, toBN(dec(2, 24)), {
        from: whale
      })

      const whaleInSP = toBN(dec(10000, 18));
      const aliceInSP = toBN(dec(2000, 18));
      const bobInSP = toBN(dec(3000, 18));

      await borrowerOperations.openTrove(
        [steth.address],
        [dec(100, 'ether')],
        th._100pct,
        await getOpenTroveUSDEAmount(dec(18500, 18)),
        whale,
        whale, ZERO_ADDRESS, {
          from: whale,
          value: dec(100, 'ether')
        }
      )


      // Whale deposits 10000 USDE in StabilityPool
      await stabilityPool.provideToSP(whaleInSP, frontEnd_1, {
        from: whale
      })

      // // 2 Troves opened
      await borrowerOperations.openTrove(
        [],
        [],
        th._100pct,
        await getOpenTroveUSDEAmount(dec(2400, 18)),
        defaulter_1,
        defaulter_1, ZERO_ADDRESS, {
          from: defaulter_1,
          value: dec(20, 'ether')
        }
      )

      await th.addERC20(steth, defaulter_2, borrowerOperations.address, toBN(dec(21, 18)), {
        from: defaulter_2
      })
      await borrowerOperations.openTrove(
        [steth.address],
        [dec(21, 'ether')],
        th._100pct,
        await getOpenTroveUSDEAmount(dec(2400, 18)),
        defaulter_2,
        defaulter_2, ZERO_ADDRESS, {
          from: defaulter_2
        }
      )

      await th.addERC20(steth, alice, borrowerOperations.address, toBN(dec(230, 18)), {
        from: alice
      })
      await borrowerOperations.openTrove(
        [steth.address],
        [dec(230, 'ether')],
        th._100pct,
        await getOpenTroveUSDEAmount(dec(2400, 18)),
        alice,
        alice, ZERO_ADDRESS, {
          from: alice
        }
      )

      const defaulter1_ICR_pre = await th.getCurrentICR(contracts, defaulter_1)
      const defaulter2_ICR_pre = await th.getCurrentICR(contracts, defaulter_2);
      th.assertIsApproximatelyEqual(defaulter1_ICR_pre, toBN("1666666666666666666"), _1e14BN)
      th.assertIsApproximatelyEqual(defaulter2_ICR_pre, toBN("1750000000000000000"), _1e14BN)

      // // --- TEST ---

      // Alice makes deposit #1: 2000 USDE
      await stabilityPool.provideToSP(aliceInSP, frontEnd_1, {
        from: alice
      })

      // // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeedETH.setPrice(dec(130, 18));
      await priceFeedSTETH.setPrice(dec(95, 16));

      const alice_pre_WETH_balance = toBN(await web3.eth.getBalance(alice))
      const alice_pre_STETH_balance = await steth.balanceOf(alice);

      const whale_pre_WETH_balance = toBN(await web3.eth.getBalance(whale))
      const whale_pre_STETH_balance = await steth.balanceOf(whale);

      // // 2 users with Trove with 170 USDE drawn are closed
      const liquidationTX_1 = await troveManager.liquidate(defaulter_1, {
        from: owner
      }) // 170 USDE closed
      const liquidationTX_2 = await troveManager.liquidate(defaulter_2, {
        from: owner
      }) // 170 USDE closed

      const [liquidatedDebt_1, usdeGasComp_1, liquidatedCollAmounts_1,
        totalCollGasCompAmounts_1
      ] = await th.getEmittedLiquidationValuesMulti(liquidationTX_1);

      const [liquidatedDebt_2, usdeGasComp_2, liquidatedCollAmounts_2,
        totalCollGasCompAmounts_2
      ] = await th.getEmittedLiquidationValuesMulti(liquidationTX_2);

      // Alice USDELoss is ((2000/(10000 + 2000)) * liquidatedDebt), for each liquidation

      const expectedUSDELoss_A = liquidatedDebt_1.mul(toBN(aliceInSP)).div(toBN(aliceInSP).add(toBN(whaleInSP)))
        .add(liquidatedDebt_2.mul(toBN(aliceInSP)).div(toBN(aliceInSP).add(toBN(whaleInSP))))

      const expectedCompoundedUSDEDeposit_A = toBN(aliceInSP).sub(expectedUSDELoss_A)
      const compoundedUSDEDeposit_A = await stabilityPool.getCompoundedUSDEDeposit(alice)

      assert.isAtMost(th.getDifference(expectedCompoundedUSDEDeposit_A, compoundedUSDEDeposit_A), 100000)
      // Alice retrieves part of her entitled USDE: 1800 USDEer
      await stabilityPool.withdrawFromSP(dec(1000, 18), {
        from: alice,
        gasPrice: 0
      })

      // Alice Gains Are Accurate
      const alice_post_WETH_balance = toBN(await web3.eth.getBalance(alice))
      const alice_post_STETH_balance = await steth.balanceOf(alice);

      const alice_WETH_gain = alice_post_WETH_balance.sub(alice_pre_WETH_balance);
      const alice_STETH_gain = alice_post_STETH_balance.sub(alice_pre_STETH_balance);
      const alice_expected_WETH_gain = (toBN(dec(20, 18))).mul(aliceInSP).div(aliceInSP.add(whaleInSP)).mul(toBN(dec(995, 18))).div(toBN(dec(1000, 18)))
      const alice_expected_STETH_gain = (toBN(dec(21, 18))).mul(aliceInSP).div(aliceInSP.add(whaleInSP)).mul(toBN(dec(995, 18))).div(toBN(dec(1000, 18)))

      // gains from WETH liquidation
      assert.isAtMost(th.getDifference(alice_WETH_gain, alice_expected_WETH_gain), 100000)

      // gains from STETH liquidation
      assert.isAtMost(th.getDifference(alice_STETH_gain, alice_expected_STETH_gain), 100000)

      const expectedNewDeposit_A = (compoundedUSDEDeposit_A.sub(toBN(dec(1000, 18))))

      // check Alice's deposit has been updated to equal her compounded deposit minus her withdrawal */
      const newDeposit = ((await stabilityPool.deposits(alice))[0]).toString()
      assert.isAtMost(th.getDifference(newDeposit, expectedNewDeposit_A), 100000)

      // // Expect Alice has withdrawn all ETH gain
      const alice_pendingETHGain = (await stabilityPool.getDepositorCollateralGain(alice))[1][0]
      assert.equal(alice_pendingETHGain, 0)

      // // Expect Alice has withdrawn all STETH gain
      const alice_pendingSTETHGain = (await stabilityPool.getDepositorCollateralGain(alice))[1][1]
      assert.equal(alice_pendingSTETHGain, 0)

      // Whale Gains Are Accurate

      const expectedUSDELoss_whale = liquidatedDebt_1.mul(whaleInSP).div(aliceInSP.add(whaleInSP))
        .add(liquidatedDebt_2.mul(whaleInSP).div(aliceInSP.add(whaleInSP)))

      const expectedCompoundedUSDEDeposit_Whale = toBN(whaleInSP).sub(expectedUSDELoss_whale)
      const compoundedUSDEDeposit_Whale = await stabilityPool.getCompoundedUSDEDeposit(whale)

      assert.isAtMost(th.getDifference(expectedCompoundedUSDEDeposit_Whale, compoundedUSDEDeposit_Whale), 100000)

      await stabilityPool.withdrawFromSP(dec(1000, 18), {
        from: whale,
        gasPrice: 0
      }) // whale withdraws 1000 USDE from SP

      const whale_post_WETH_balance = toBN(await web3.eth.getBalance(whale))
      const whale_post_STETH_balance = await steth.balanceOf(whale);

      const whale_WETH_gain = whale_post_WETH_balance.sub(whale_pre_WETH_balance);
      const whale_STETH_gain = whale_post_STETH_balance.sub(whale_pre_STETH_balance);

      const whale_expected_WETH_gain = (toBN(dec(20, 18))).mul(whaleInSP).div(aliceInSP.add(whaleInSP)).mul(toBN(dec(995, 18))).div(toBN(dec(1000, 18)))
      const whale_expected_STETH_gain = (toBN(dec(21, 18))).mul(whaleInSP).div(aliceInSP.add(whaleInSP)).mul(toBN(dec(995, 18))).div(toBN(dec(1000, 18)))

      // gains from WETH liquidation
      assert.isAtMost(th.getDifference(whale_WETH_gain, whale_expected_WETH_gain), 100000)

      // gains from STETH liquidation
      assert.isAtMost(th.getDifference(whale_STETH_gain, whale_expected_STETH_gain), 100000)

      const expectedNewDeposit_Whale = (compoundedUSDEDeposit_Whale.sub(toBN(dec(1000, 18))))

      // check whale's deposit has been updated to equal her compounded deposit minus her withdrawal */
      const newWhaleDeposit = ((await stabilityPool.deposits(whale))[0]).toString()
      assert.isAtMost(th.getDifference(newWhaleDeposit, expectedNewDeposit_Whale), 100000)

      // // Expect whale has withdrawn all ETH gain
      const whale_pendingETHGain = (await stabilityPool.getDepositorCollateralGain(whale))[1][0]
      assert.equal(whale_pendingETHGain, 0)

      // // Expect whale has withdrawn all STETH gain
      const whale_pendingSTETHGain = (await stabilityPool.getDepositorCollateralGain(whale))[1][1]
      assert.equal(whale_pendingSTETHGain, 0)
    })

    it("open, deposit into SP, liquidate, deposit into SP #2, liquidate", async () => {
      // --- SETUP ---
      await th.addERC20(steth, whale, borrowerOperations.address, toBN(dec(20000, 24)), {
        from: whale
      })

      const whaleInSP = toBN(dec(10000, 18));
      const aliceInSP = toBN(dec(2000, 18));
      const carolInSP = toBN(dec(2000, 18));
      const bobInSP = toBN(dec(2000, 18));

      await th.addERC20(steth, bob, borrowerOperations.address, toBN(dec(2200, 24)), {
        from: bob
      })

      await borrowerOperations.openTrove(
        [steth.address],
        [dec(1000, 'ether')],
        th._100pct,
        await getOpenTroveUSDEAmount(dec(25000, 18)),
        bob,
        bob, ZERO_ADDRESS, {
          from: bob,
          value: dec(1000, 'ether')
        }
      )

      await stabilityPool.provideToSP(bobInSP, frontEnd_1, {
        from: bob
      })

      await borrowerOperations.openTrove(
        [steth.address],
        [dec(100, 'ether')],
        th._100pct,
        await getOpenTroveUSDEAmount(dec(18500, 18)),
        whale,
        whale, ZERO_ADDRESS, {
          from: whale,
          value: dec(10000, 'ether')
        }
      )


      // Whale deposits 10000 USDE in StabilityPool
      await stabilityPool.provideToSP(whaleInSP, frontEnd_1, {
        from: whale
      })

      // // 2 Troves opened
      await borrowerOperations.openTrove(
        [],
        [],
        th._100pct,
        await getOpenTroveUSDEAmount(dec(2400, 18)),
        defaulter_1,
        defaulter_1, ZERO_ADDRESS, {
          from: defaulter_1,
          value: dec(20, 'ether')
        }
      )

      await th.addERC20(steth, defaulter_2, borrowerOperations.address, toBN(dec(210000, 18)), {
        from: defaulter_2
      })
      await borrowerOperations.openTrove(
        [steth.address],
        [dec(21, 'ether')],
        th._100pct,
        await getOpenTroveUSDEAmount(dec(2400, 18)),
        defaulter_2,
        defaulter_2, ZERO_ADDRESS, {
          from: defaulter_2
        }
      )

      await th.addERC20(steth, alice, borrowerOperations.address, toBN(dec(230000, 18)), {
        from: alice
      })
      await borrowerOperations.openTrove(
        [steth.address],
        [dec(230, 'ether')],
        th._100pct,
        await getOpenTroveUSDEAmount(dec(2400, 18)),
        alice,
        alice, ZERO_ADDRESS, {
          from: alice
        }
      )

      const defaulter1_ICR_pre = await th.getCurrentICR(contracts, defaulter_1)
      const defaulter2_ICR_pre = await th.getCurrentICR(contracts, defaulter_2);

      th.assertIsApproximatelyEqual(defaulter1_ICR_pre, toBN("1666666666666666666"), _1e14BN)
      th.assertIsApproximatelyEqual(defaulter2_ICR_pre, toBN("1750000000000000000"), _1e14BN)

      // // --- TEST ---

      // Alice makes deposit #1: 2000 USDE
      await stabilityPool.provideToSP(aliceInSP, frontEnd_1, {
        from: alice,
        gasPrice: 0
      })

      // // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeedETH.setPrice(dec(126, 18));
      await priceFeedSTETH.setPrice(dec(95, 16));

      const defaulter1_ICR = await th.getCurrentICR(contracts, defaulter_1)
      const defaulter2_ICR = await th.getCurrentICR(contracts, defaulter_2);

      const alice_pre_WETH_balance = toBN(await web3.eth.getBalance(alice))
      const alice_pre_STETH_balance = await steth.balanceOf(alice);

      const whale_pre_WETH_balance = toBN(await web3.eth.getBalance(whale))
      const whale_pre_STETH_balance = await steth.balanceOf(whale);

      // // 2 users with Trove with 170 USDE drawn are closed
      const liquidationTX_1 = await troveManager.liquidate(defaulter_1, {
        from: owner
      }) // 170 USDE closed
      const liquidationTX_2 = await troveManager.liquidate(defaulter_2, {
        from: owner
      }) // 170 USDE closed

      const [liquidatedDebt_1, usdeGasComp_1, liquidatedCollAmounts_1,
        totalCollGasCompAmounts_1
      ] = await th.getEmittedLiquidationValuesMulti(liquidationTX_1);

      const [liquidatedDebt_2, usdeGasComp_2, liquidatedCollAmounts_2,
        totalCollGasCompAmounts_2
      ] = await th.getEmittedLiquidationValuesMulti(liquidationTX_2);

      // Alice USDELoss is ((2000/(10000 + 2000)) * liquidatedDebt), for each liquidation

      const expectedUSDELoss_A = liquidatedDebt_1.mul(toBN(aliceInSP)).div(toBN(aliceInSP).add(toBN(whaleInSP).add(toBN(bobInSP))))
        .add(liquidatedDebt_2.mul(toBN(aliceInSP)).div((toBN(aliceInSP).add(toBN(whaleInSP).add(toBN(bobInSP))))))

      const expectedCompoundedUSDEDeposit_A = toBN(aliceInSP).sub(expectedUSDELoss_A)
      const compoundedUSDEDeposit_A = await stabilityPool.getCompoundedUSDEDeposit(alice)

      assert.isAtMost(th.getDifference(expectedCompoundedUSDEDeposit_A, compoundedUSDEDeposit_A), 100000)

      // Alice retrieves part of her entitled USDE: 1800 USDEer
      await stabilityPool.withdrawFromSP(dec(1000, 18), {
        from: alice,
        gasPrice: 0
      })

      // Alice Gains Are Accurate
      const alice_post_WETH_balance = toBN(await web3.eth.getBalance(alice))
      const alice_post_STETH_balance = await steth.balanceOf(alice);

      const alice_WETH_gain = alice_post_WETH_balance.sub(alice_pre_WETH_balance);
      const alice_STETH_gain = alice_post_STETH_balance.sub(alice_pre_STETH_balance);

      const alice_expected_WETH_gain = (toBN(dec(20, 18))).mul(aliceInSP).div(aliceInSP.add(whaleInSP).add(bobInSP)).mul(toBN(dec(995, 18))).div(toBN(dec(1000, 18)))
      const alice_expected_STETH_gain = (toBN(dec(21, 18))).mul(aliceInSP).div(aliceInSP.add(whaleInSP).add(bobInSP)).mul(toBN(dec(995, 18))).div(toBN(dec(1000, 18)))

      // gains from WETH liquidation
      assert.isAtMost(th.getDifference(alice_WETH_gain, alice_expected_WETH_gain), 100000)

      // gains from STETH liquidation
      assert.isAtMost(th.getDifference(alice_STETH_gain, alice_expected_STETH_gain), 100000)

      const expectedNewDeposit_A = (compoundedUSDEDeposit_A.sub(toBN(dec(1000, 18))))

      // check Alice's deposit has been updated to equal her compounded deposit minus her withdrawal */
      const newDeposit = ((await stabilityPool.deposits(alice))[0]).toString()
      assert.isAtMost(th.getDifference(newDeposit, expectedNewDeposit_A), 100000)

      // // Expect Alice has withdrawn all ETH gain
      const alice_pendingETHGain = (await stabilityPool.getDepositorCollateralGain(alice))[1][0]
      assert.equal(alice_pendingETHGain, 0)

      // // Expect Alice has withdrawn all STETH gain
      const alice_pendingSTETHGain = (await stabilityPool.getDepositorCollateralGain(alice))[1][1]
      assert.equal(alice_pendingSTETHGain, 0)

      // Whale Gains Are Accurate

      const expectedUSDELoss_whale = liquidatedDebt_1.mul(whaleInSP).div(aliceInSP.add(whaleInSP).add(bobInSP))
        .add(liquidatedDebt_2.mul(whaleInSP).div(aliceInSP.add(whaleInSP).add(bobInSP)))

      const expectedCompoundedUSDEDeposit_Whale = toBN(whaleInSP).sub(expectedUSDELoss_whale)
      const compoundedUSDEDeposit_Whale = await stabilityPool.getCompoundedUSDEDeposit(whale)

      assert.isAtMost(th.getDifference(expectedCompoundedUSDEDeposit_Whale, compoundedUSDEDeposit_Whale), 100000)

      // new depositor to stability pool
      await th.addERC20(steth, carol, borrowerOperations.address, toBN(dec(230, 18)), {
        from: carol
      })
      await borrowerOperations.openTrove(
        [steth.address],
        [dec(230, 'ether')],
        th._100pct,
        await getOpenTroveUSDEAmount(dec(2400, 18)),
        carol,
        carol, ZERO_ADDRESS, {
          from: carol
        }
      )

      // carol makes deposit #1: 2000 USDE
      await stabilityPool.provideToSP(carolInSP, frontEnd_1, {
        from: carol
      })
    })

    it("withdrawFromSP(): doesn't impact any troves, including the caller's trove", async () => {
      await th.addERC20(steth, whale, borrowerOperations.address, toBN(dec(2, 24)), {
        from: whale
      })

      await th.addERC20(steth, alice, borrowerOperations.address, toBN(dec(232, 24)), {
        from: alice
      })

      await th.addERC20(steth, bob, borrowerOperations.address, toBN(dec(22, 24)), {
        from: bob
      })

      await th.addERC20(steth, carol, borrowerOperations.address, toBN(dec(22, 24)), {
        from: carol
      })

      await borrowerOperations.openTrove(
        [steth.address],
        [dec(100, 'ether')],
        th._100pct,
        await getOpenTroveUSDEAmount(dec(20000, 18)),
        whale,
        whale, ZERO_ADDRESS, {
          from: whale,
          value: dec(100, 'ether')
        }
      )

      await borrowerOperations.openTrove(
        [steth.address],
        [dec(100, 'ether')],
        th._100pct,
        await getOpenTroveUSDEAmount(dec(12000, 18)),
        alice,
        alice, ZERO_ADDRESS, {
          from: alice,
          value: dec(100, 'ether')
        }
      )

      await borrowerOperations.openTrove(
        [steth.address],
        [dec(100, 'ether')],
        th._100pct,
        await getOpenTroveUSDEAmount(dec(25000, 18)),
        bob,
        bob, ZERO_ADDRESS, {
          from: bob,
          value: dec(100, 'ether')
        }
      )

      await borrowerOperations.openTrove(
        [steth.address],
        [dec(100, 'ether')],
        th._100pct,
        await getOpenTroveUSDEAmount(dec(35000, 18)),
        carol,
        carol, ZERO_ADDRESS, {
          from: carol,
          value: dec(100, 'ether')
        }
      )

      // A, B and C provide to SP
      await stabilityPool.provideToSP(dec(10000, 18), frontEnd_1, {
        from: alice
      })
      await stabilityPool.provideToSP(dec(20000, 18), frontEnd_1, {
        from: bob
      })
      await stabilityPool.provideToSP(dec(30000, 18), frontEnd_1, {
        from: carol
      })

      // Price drops
      await priceFeedETH.setPrice(dec(105, 18))
      await priceFeedSTETH.setPrice(dec(95, 1))

      // Get debt, collateral and ICR of all existing troves
      const whale_Debt_Before = (await troveManager.getTroveDebt(whale)).toString()
      const alice_Debt_Before = (await troveManager.getTroveDebt(alice)).toString()
      const bob_Debt_Before = (await troveManager.getTroveDebt(bob)).toString()
      const carol_Debt_Before = (await troveManager.getTroveDebt(carol)).toString()

      const whale_Coll_Before = (await troveManager.getTroveColls(whale))[0][0].toString()
      const alice_Coll_Before = (await troveManager.getTroveColls(alice))[0][0].toString()
      const bob_Coll_Before = (await troveManager.getTroveColls(bob))[0][0].toString()
      const carol_Coll_Before = (await troveManager.getTroveColls(carol))[0][0].toString()

      const whale_Coll_Before_1 = (await troveManager.getTroveColls(whale))[0][1].toString()
      const alice_Coll_Before_1 = (await troveManager.getTroveColls(alice))[0][1].toString()
      const bob_Coll_Before_1 = (await troveManager.getTroveColls(bob))[0][1].toString()
      const carol_Coll_Before_1 = (await troveManager.getTroveColls(carol))[0][1].toString()


      // price rises
      await priceFeedETH.setPrice(dec(200, 18))
      await priceFeedSTETH.setPrice(dec(7, 18))

      // Carol withdraws her Stability deposit 
      assert.equal(((await stabilityPool.deposits(carol))[0]).toString(), dec(30000, 18))
      await stabilityPool.withdrawFromSP(dec(30000, 18), {
        from: carol,
        gasPrice: 0
      })
      assert.equal(((await stabilityPool.deposits(carol))[0]).toString(), '0')

      const whale_Debt_After = (await troveManager.getTroveDebt(whale)).toString()
      const alice_Debt_After = (await troveManager.getTroveDebt(alice)).toString()
      const bob_Debt_After = (await troveManager.getTroveDebt(bob)).toString()
      const carol_Debt_After = (await troveManager.getTroveDebt(carol)).toString()

      const whale_Coll_After = (await troveManager.getTroveColls(whale))[0][0].toString()
      const alice_Coll_After = (await troveManager.getTroveColls(alice))[0][0].toString()
      const bob_Coll_After = (await troveManager.getTroveColls(bob))[0][0].toString()
      const carol_Coll_After = (await troveManager.getTroveColls(carol))[0][0].toString()

      const whale_Coll_After_1 = (await troveManager.getTroveColls(whale))[0][1].toString()
      const alice_Coll_After_1 = (await troveManager.getTroveColls(alice))[0][1].toString()
      const bob_Coll_After_1 = (await troveManager.getTroveColls(bob))[0][1].toString()
      const carol_Coll_After_1 = (await troveManager.getTroveColls(carol))[0][1].toString()


      // Check all troves are unaffected by Carol's Stability deposit withdrawal
      th.assertIsApproximatelyEqual(whale_Debt_Before, whale_Debt_After, _1e14BN)
      th.assertIsApproximatelyEqual(alice_Debt_Before, alice_Debt_After, _1e14BN)
      th.assertIsApproximatelyEqual(bob_Debt_Before, bob_Debt_After, _1e14BN)
      th.assertIsApproximatelyEqual(carol_Debt_Before, carol_Debt_After, _1e14BN)

      assert.equal(whale_Coll_Before, whale_Coll_After)
      assert.equal(alice_Coll_Before, alice_Coll_After)
      assert.equal(bob_Coll_Before, bob_Coll_After)
      assert.equal(carol_Coll_Before, carol_Coll_After)

      assert.equal(whale_Coll_Before_1, whale_Coll_After_1)
      assert.equal(alice_Coll_Before_1, alice_Coll_After_1)
      assert.equal(bob_Coll_Before_1, bob_Coll_After_1)
      assert.equal(carol_Coll_Before_1, carol_Coll_After_1)
    })

    it("provideToSP(), new deposit: depositor does not receive any collateral gains", async () => {
      const addresses = [alice, whale, C, D]

      await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(5, 18), dec(10, 18), dec(15, 18)], {
        from: alice
      })
      await th.addMultipleERC20(whale, borrowerOperations.address, [tokenB, tokenD, tokenA], [dec(234, 18), dec(114000, 18), dec(11445, 18)], {
        from: whale
      })

      await borrowerOperations.openTrove(
        [tokenA.address, tokenB.address, tokenC.address],
        [dec(5, 18), dec(10, 18), dec(15, 18)],
        th._100pct,
        toBN(dec(2000, 18)),
        alice,
        alice, ZERO_ADDRESS, {
          from: alice
        }
      )
      await borrowerOperations.openTrove(
        [tokenB.address, tokenD.address, tokenA.address],
        [dec(234, 18), dec(114000, 18), dec(11445, 18)],
        th._100pct,
        toBN(dec(200000, 18)),
        whale,
        whale, ZERO_ADDRESS, {
          from: whale
        }
      )

      // Whale transfers USDE to A, B
      await usdeToken.transfer(A, dec(100, 18), {
        from: whale
      })
      await usdeToken.transfer(B, dec(200, 18), {
        from: whale
      })

      // C, D open troves
      await th.addMultipleERC20(C, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(4, 18), dec(3, 18), dec(20, 18)], {
        from: C
      })
      await th.addMultipleERC20(D, borrowerOperations.address, [tokenB, tokenD], [dec(500, 18), dec(4, 18)], {
        from: D
      })

      await borrowerOperations.openTrove(
        [tokenA.address, tokenB.address, tokenC.address],
        [dec(4, 18), dec(3, 18), dec(20, 18)],
        th._100pct,
        toBN(dec(2000, 18)),
        C,
        C, ZERO_ADDRESS, {
          from: C
        }
      )
      await borrowerOperations.openTrove(
        [tokenB.address, tokenD.address],
        [dec(500, 18), dec(4, 18)],
        th._100pct,
        toBN(dec(2000, 18)),
        D,
        D, ZERO_ADDRESS, {
          from: D
        }
      )

      // --- TEST ---
      // tokens = [weth, steth, tokenA, tokenB, tokenC, tokenD, tokenRisky, tokenSuperRisky, stableCoin]
      tokens = [steth, tokenA, tokenB, tokenC, tokenD, tokenRisky, tokenSuperRisky, stableCoin]

      // console.log("BEFORE");
      const balancesBefore = {}
      for (let j = 0; j < addresses.length; j++) {
        let address = addresses[j];
        balancesBefore[address] = {}
        for (let i = 0; i < tokens.length; i++) {
          let token = tokens[i];
          const balance = await token.balanceOf(addresses[j])
          // console.log(address, token.address, balance);
          assert.equal(balance.toString(), '0')
          balancesBefore[address][token.address.address] = balance;
        }
      }

      // A, B, C, D provide to SP
      await stabilityPool.provideToSP(dec(100, 18), frontEnd_1, {
        from: whale,
        gasPrice: 0
      })
      await stabilityPool.provideToSP(dec(200, 18), ZERO_ADDRESS, {
        from: alice,
        gasPrice: 0
      })
      await stabilityPool.provideToSP(dec(300, 18), frontEnd_2, {
        from: C,
        gasPrice: 0
      })
      await stabilityPool.provideToSP(dec(400, 18), ZERO_ADDRESS, {
        from: D,
        gasPrice: 0
      })

      // console.log("AFTER");
      // Get  ETH balances after
      const balancesAfter = {}
      for (let j = 0; j < addresses.length; j++) {
        let address = addresses[j];
        balancesAfter[address] = {}
        for (let i = 0; i < tokens.length; i++) {
          let token = tokens[i];
          const balance = await token.balanceOf(addresses[j])
          // console.log(address, token.address, balance);
          assert.equal(balance.toString(), '0')
          balancesAfter[address][token.address.address] = balance;
        }
      }

      const TCR = await th.getCurrentICR(contracts, C);
      // console.log("TCR", TCR.toString())
    })

    it("provideToSP(): doesn't impact other users' deposits or ETH gains", async () => {
      await th.addMultipleERC20(whale, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(5, 18), dec(10, 18), dec(15, 18)], {
        from: whale
      })
      await borrowerOperations.openTrove(
        [tokenA.address, tokenB.address, tokenC.address],
        [dec(5, 18), dec(10, 18), dec(15, 18)],
        th._100pct,
        toBN(dec(2000, 18)),
        whale,
        whale, ZERO_ADDRESS, {
          from: whale
        }
      )

      await borrowerOperations.openTrove(
        [],
        [],
        th._100pct,
        await getOpenTroveUSDEAmount(dec(2400, 18)),
        defaulter_1,
        defaulter_1, ZERO_ADDRESS, {
          from: defaulter_1,
          value: dec(20, 'ether')
        }
      )

      await borrowerOperations.openTrove(
        [],
        [],
        th._100pct,
        await getOpenTroveUSDEAmount(dec(2400, 18)),
        defaulter_2,
        defaulter_2, ZERO_ADDRESS, {
          from: defaulter_2,
          value: dec(21, 'ether')
        })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraUSDEAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: carol
        }
      })

      await stabilityPool.provideToSP(dec(1000, 18), frontEnd_1, {
        from: alice
      })
      await stabilityPool.provideToSP(dec(2000, 18), frontEnd_1, {
        from: bob
      })
      await stabilityPool.provideToSP(dec(3000, 18), frontEnd_1, {
        from: carol
      })

      // D opens a trove
      await openTrove({
        extraUSDEAmount: toBN(dec(300, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: {
          from: dennis
        }
      })

      // Price drops
      await priceFeedETH.setPrice(dec(120, 18))
      await priceFeedSTETH.setPrice(dec(95, 16))

      const defaulter1_ICR = await th.getCurrentICR(contracts, defaulter_1);
      const defaulter2_ICR = await th.getCurrentICR(contracts, defaulter_2);

      // Defaulters are liquidated
      await troveManager.liquidate(defaulter_1)
      await troveManager.liquidate(defaulter_2)
      assert.isFalse(await sortedTroves.contains(defaulter_1))
      assert.isFalse(await sortedTroves.contains(defaulter_2))

      const alice_USDEDeposit_Before = (await stabilityPool.getCompoundedUSDEDeposit(alice)).toString()
      const bob_USDEDeposit_Before = (await stabilityPool.getCompoundedUSDEDeposit(bob)).toString()
      const carol_USDEDeposit_Before = (await stabilityPool.getCompoundedUSDEDeposit(carol)).toString()

      const alice_ETHGain_Before = ((await stabilityPool.getDepositorCollateralGain(alice))[1][0]).toString()
      const bob_ETHGain_Before = ((await stabilityPool.getDepositorCollateralGain(bob))[1][0]).toString()
      const carol_ETHGain_Before = ((await stabilityPool.getDepositorCollateralGain(carol))[1][0]).toString()

      //check non-zero USDE and ETHGain in the Stability Pool
      const USDEinSP = await stabilityPool.getTotalUSDEDeposits()
      const ETHinSP = await stabilityPool.getCollateralAmount(weth.address)
      assert.isTrue(USDEinSP.gt(mv._zeroBN))
      assert.isTrue(ETHinSP.gt(mv._zeroBN))

      // D makes an SP deposit
      await stabilityPool.provideToSP(dec(1000, 18), frontEnd_1, {
        from: dennis
      })
      assert.equal((await stabilityPool.getCompoundedUSDEDeposit(dennis)).toString(), dec(1000, 18))

      const alice_USDEDeposit_After = (await stabilityPool.getCompoundedUSDEDeposit(alice)).toString()
      const bob_USDEDeposit_After = (await stabilityPool.getCompoundedUSDEDeposit(bob)).toString()
      const carol_USDEDeposit_After = (await stabilityPool.getCompoundedUSDEDeposit(carol)).toString()

      const alice_ETHGain_After = ((await stabilityPool.getDepositorCollateralGain(alice))[1][0]).toString()
      const bob_ETHGain_After = ((await stabilityPool.getDepositorCollateralGain(bob))[1][0]).toString()
      const carol_ETHGain_After = ((await stabilityPool.getDepositorCollateralGain(carol))[1][0]).toString()

      // Check compounded deposits and ETH gains for A, B and C have not changed
      assert.equal(alice_USDEDeposit_Before, alice_USDEDeposit_After)
      assert.equal(bob_USDEDeposit_Before, bob_USDEDeposit_After)
      assert.equal(carol_USDEDeposit_Before, carol_USDEDeposit_After)

      assert.equal(alice_ETHGain_Before, alice_ETHGain_After)
      assert.equal(bob_ETHGain_Before, bob_ETHGain_After)
      assert.equal(carol_ETHGain_Before, carol_ETHGain_After)
    })

    it("withdrawFromSP(): caller can withdraw full deposit and ETH gain during Recovery Mode", async () => {
      // --- SETUP ---
      // Price doubles
      // await priceFeedSTETH.setPrice(dec(1, 18))
      // await priceFeedETH.setPrice(dec(400, 18))

      await th.addMultipleERC20(defaulter_1, borrowerOperations.address, [steth], [dec(100, 18)], {
        from: defaulter_1
      })
      await borrowerOperations.openTrove(
        [steth.address],
        [dec(100, 18)],
        th._100pct,
        toBN(dec(3290, 18)),
        defaulter_1,
        defaulter_1, ZERO_ADDRESS, {
          from: defaulter_1,
          value: dec(50, 18)
        }
      )
      // A, B, C open troves and make Stability Pool deposits
      await th.addMultipleERC20(alice, borrowerOperations.address, [steth], [dec(100, 18)], {
        from: alice
      })
      await borrowerOperations.openTrove(
        [steth.address],
        [dec(100, 18)],
        th._100pct,
        toBN(dec(3000, 18)),
        alice,
        alice, ZERO_ADDRESS, {
          from: alice,
          value: dec(50, 18)
        }
      )

      await th.addMultipleERC20(bob, borrowerOperations.address, [steth], [dec(100, 18)], {
        from: bob
      })
      await borrowerOperations.openTrove(
        [steth.address],
        [dec(100, 18)],
        th._100pct,
        toBN(dec(3000, 18)),
        bob,
        bob, ZERO_ADDRESS, {
          from: bob,
          value: dec(50, 18)
        }
      )

      await th.addMultipleERC20(carol, borrowerOperations.address, [steth], [dec(100, 18)], {
        from: carol
      })
      await borrowerOperations.openTrove(
        [steth.address],
        [dec(100, 18)],
        th._100pct,
        toBN(dec(3000, 18)),
        carol,
        carol, ZERO_ADDRESS, {
          from: carol,
          value: dec(50, 18)
        }
      )

      const TCR = await collateralManager.getTCR();
      // console.log("TCR", TCR.toString());

      // A, B, C provides 10000, 5000, 3000 USDE to SP
      await stabilityPool.provideToSP(dec(2000, 18), frontEnd_1, {
        from: alice
      })
      await stabilityPool.provideToSP(dec(2000, 18), frontEnd_1, {
        from: bob
      })
      await stabilityPool.provideToSP(dec(2000, 18), frontEnd_1, {
        from: carol
      })

      // Price halves
      await priceFeedSTETH.setPrice(dec(95, 16))
      await priceFeedETH.setPrice(dec(28, 18))

      const TCRpost = await collateralManager.getTCR();
      // console.log("TCR", TCRpost.toString());

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Liquidate defaulter 1
      await troveManager.liquidate(defaulter_1)
      assert.isFalse(await sortedTroves.contains(defaulter_1))

      const alice_USDE_Balance_Before = await usdeToken.balanceOf(alice)
      const bob_USDE_Balance_Before = await usdeToken.balanceOf(bob)
      const carol_USDE_Balance_Before = await usdeToken.balanceOf(carol)

      const alice_ETH_Balance_Before = web3.utils.toBN(await web3.eth.getBalance(alice))
      const bob_ETH_Balance_Before = web3.utils.toBN(await web3.eth.getBalance(bob))
      const carol_ETH_Balance_Before = web3.utils.toBN(await web3.eth.getBalance(carol))

      const alice_Deposit_Before = await stabilityPool.getCompoundedUSDEDeposit(alice)
      const bob_Deposit_Before = await stabilityPool.getCompoundedUSDEDeposit(bob)
      const carol_Deposit_Before = await stabilityPool.getCompoundedUSDEDeposit(carol)

      const alice_ETHGain_Before = (await stabilityPool.getDepositorCollateralGain(alice))[1][0]
      const bob_ETHGain_Before = (await stabilityPool.getDepositorCollateralGain(bob))[1][0]
      const carol_ETHGain_Before = (await stabilityPool.getDepositorCollateralGain(carol))[1][0]

      const USDEinSP_Before = await stabilityPool.getTotalUSDEDeposits()

      // Price rises
      // await priceFeedSTETH.setPrice(dec(220, 18))

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // A, B, C withdraw their full deposits from the Stability Pool
      await stabilityPool.withdrawFromSP(dec(2000, 18), {
        from: alice,
        gasPrice: 0
      })
      await stabilityPool.withdrawFromSP(dec(2000, 18), {
        from: bob,
        gasPrice: 0
      })
      await stabilityPool.withdrawFromSP(dec(2000, 18), {
        from: carol,
        gasPrice: 0
      })

      // Check USDE balances of A, B, C have risen by the value of their compounded deposits, respectively
      const alice_expectedUSDEBalance = (alice_USDE_Balance_Before.add(alice_Deposit_Before)).toString()

      const bob_expectedUSDEBalance = (bob_USDE_Balance_Before.add(bob_Deposit_Before)).toString()
      const carol_expectedUSDEBalance = (carol_USDE_Balance_Before.add(carol_Deposit_Before)).toString()

      const alice_USDE_Balance_After = (await usdeToken.balanceOf(alice)).toString()

      const bob_USDE_Balance_After = (await usdeToken.balanceOf(bob)).toString()
      const carol_USDE_Balance_After = (await usdeToken.balanceOf(carol)).toString()

      assert.equal(alice_USDE_Balance_After, alice_expectedUSDEBalance)
      assert.equal(bob_USDE_Balance_After, bob_expectedUSDEBalance)
      assert.equal(carol_USDE_Balance_After, carol_expectedUSDEBalance)

      // Check ETH balances of A, B, C have increased by the value of their ETH gain from liquidations, respectively
      const alice_expectedETHBalance = (alice_ETH_Balance_Before.add(alice_ETHGain_Before)).toString()
      const bob_expectedETHBalance = (bob_ETH_Balance_Before.add(bob_ETHGain_Before)).toString()
      const carol_expectedETHBalance = (carol_ETH_Balance_Before.add(carol_ETHGain_Before)).toString()

      const alice_ETHBalance_After = (await web3.eth.getBalance(alice)).toString()
      const bob_ETHBalance_After = (await web3.eth.getBalance(bob)).toString()
      const carol_ETHBalance_After = (await web3.eth.getBalance(carol)).toString()

      assert.equal(alice_expectedETHBalance, alice_ETHBalance_After)
      assert.equal(bob_expectedETHBalance, bob_ETHBalance_After)
      assert.equal(carol_expectedETHBalance, carol_ETHBalance_After)

      // Check USDE in Stability Pool has been reduced by A, B and C's compounded deposit
      const expectedUSDEinSP = (USDEinSP_Before
          .sub(alice_Deposit_Before)
          .sub(bob_Deposit_Before)
          .sub(carol_Deposit_Before))
        .toString()
      const USDEinSP_After = (await stabilityPool.getTotalUSDEDeposits()).toString()
      assert.equal(USDEinSP_After, expectedUSDEinSP)

      // Check ETH in SP has reduced to zero
      const ETHinSP_After = (await stabilityPool.getCollateralAmount(weth.address)).toString()
      assert.isAtMost(th.getDifference(ETHinSP_After, '0'), 100000)
    })
  })
});