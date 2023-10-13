const {
    assert
} = require("chai")
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
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues
const SECONDS_IN_ONE_DAY = timeValues.SECONDS_IN_ONE_DAY
const _1e14BN = toBN(dec(1, 14))
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
    let priceFeedSTETH
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
    let weth
    let steth
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
    let priceFeedLowDecimal
    let stableCoin
    let priceFeedStableCoin

    let contracts
    let ERDContracts

    const getOpenTroveUSDEAmount = async (totalDebt) => th.getOpenTroveUSDEAmount(contracts, totalDebt)
    const getNetBorrowingAmount = async (debtWithFee) => th.getNetBorrowingAmount(contracts, debtWithFee)
    const getActualDebtFromComposite = async (compositeDebt) => th.getActualDebtFromComposite(compositeDebt, contracts)
    const openTrove = async (params) => th.openTrove(contracts, params)
    const getTroveEntireTokens = async (trove) => th.getTroveEntireTokens(contracts, trove)
    const getTroveEntireColl = async (trove) => th.getTroveEntireColl(contracts, trove)
    const getTroveEntireDebt = async (trove) => th.getTroveEntireDebt(contracts, trove)
    const getTroveStake = async (trove) => th.getTroveStake(contracts, trove)

    const USDEMinAmount = toBN('1800000000000000000000')

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
            ERDContracts = await deploymentHelper.deployERDTesterContractsHardhat()
            contracts = await deploymentHelper.deployUSDETokenTester(contracts, ERDContracts)

            await deploymentHelper.connectCoreContracts(contracts, ERDContracts)

            if (withProxy) {
                const users = [alice, bob, carol, dennis, whale, A, B, C, D, E]
                await deploymentHelper.deployProxyScripts(contracts, ERDContracts, owner, users)
            }

            // priceFeed = contracts.priceFeedTestnet
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
            weth = contracts.weth
            steth = contracts.steth

            treasury = ERDContracts.treasury
            liquidityIncentive = ERDContracts.liquidityIncentive
            communityIssuance = ERDContracts.communityIssuance

            USDE_GAS_COMPENSATION = await borrowerOperations.USDE_GAS_COMPENSATION()
            MIN_NET_DEBT = await collateralManager.getMinNetDebt()
            BORROWING_FEE_FLOOR = await collateralManager.getBorrowingFeeFloor()

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

        // --- openTrove() --- 
        describe('openTrove() multi collateral', async () => {
            it("Open a trove with multiple collateral types, check if amounts added are correct", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(5, 18), dec(10, 18), dec(15, 18)], {
                    from: alice
                })

                const aliceRawBalanceBefore_A = await tokenA.balanceOf(alice)
                const aliceRawBalanceBefore_B = await tokenB.balanceOf(alice)
                const aliceRawBalanceBefore_C = await tokenC.balanceOf(alice)

                const activePoolRawBalanceBefore_A = await tokenA.balanceOf(activePool.address)
                const activePoolRawBalanceBefore_B = await tokenB.balanceOf(activePool.address)
                const activePoolRawBalanceBefore_C = await tokenC.balanceOf(activePool.address)

                assert.isTrue(activePoolRawBalanceBefore_A.eq(toBN(0)))
                assert.isTrue(activePoolRawBalanceBefore_B.eq(toBN(0)))
                assert.isTrue(activePoolRawBalanceBefore_C.eq(toBN(0)))

                assert.isTrue(aliceRawBalanceBefore_A.eq(toBN(dec(5, 18))))
                assert.isTrue(aliceRawBalanceBefore_B.eq(toBN(dec(10, 18))))
                assert.isTrue(aliceRawBalanceBefore_C.eq(toBN(dec(15, 18))))
                await borrowerOperations.openTrove([tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                    from: alice
                })

                const aliceRawBalanceAfter_A = await tokenA.balanceOf(alice)
                const aliceRawBalanceAfter_B = await tokenB.balanceOf(alice)
                const aliceRawBalanceAfter_C = await tokenC.balanceOf(alice)

                const activePoolRawBalanceAfter_A = await tokenA.balanceOf(activePool.address)
                const activePoolRawBalanceAfter_B = await tokenB.balanceOf(activePool.address)
                const activePoolRawBalanceAfter_C = await tokenC.balanceOf(activePool.address)

                assert.isTrue(aliceRawBalanceAfter_A.eq(toBN(0)))
                assert.isTrue(aliceRawBalanceAfter_B.eq(toBN(0)))
                assert.isTrue(aliceRawBalanceAfter_C.eq(toBN(0)))

                assert.isTrue(activePoolRawBalanceAfter_A.eq(toBN(dec(5, 18))))
                assert.isTrue(activePoolRawBalanceAfter_B.eq(toBN(dec(10, 18))))
                assert.isTrue(activePoolRawBalanceAfter_C.eq(toBN(dec(15, 18))))

                const aliceTokens = await getTroveEntireTokens(alice)
                const aliceColls = await getTroveEntireColl(alice)
                const aliceDebt = await getTroveEntireDebt(alice)

                assert.isTrue(await th.assertCollateralsEqual(aliceTokens, aliceColls, [tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)]))
                assert.isTrue(aliceDebt.eq(toBN(dec(20045000, 14))))

                // Missing token B allocation
                await th.addMultipleERC20(bob, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(5, 18), dec(10, 18), dec(15, 18)], {
                    from: bob
                })
                await assertRevert(
                    borrowerOperations.openTrove([tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(11, 18), dec(15, 18)], th._100pct, USDEMinAmount, bob, bob, ZERO_ADDRESS, {
                        from: bob
                    }),
                    "You are trying to transfer more tokens than from has"
                )

            })

            it("Open various troves with wrong order collateral, check that they have it properly", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenC], [dec(200, 18)], {
                    from: alice
                })
                await borrowerOperations.openTrove([tokenC.address], [dec(200, 18)], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                    from: alice
                })

                await th.addMultipleERC20(bob, borrowerOperations.address, [tokenC, tokenA], [dec(5, 18), dec(10, 18)], {
                    from: bob
                })
                await borrowerOperations.openTrove([tokenC.address, tokenA.address], [dec(5, 18), dec(10, 18)], th._100pct, USDEMinAmount, bob, bob, ZERO_ADDRESS, {
                    from: bob
                })

                await th.addMultipleERC20(carol, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(5, 18), dec(10, 18), dec(15, 18)], {
                    from: carol
                })
                await borrowerOperations.openTrove([tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], th._100pct, USDEMinAmount, carol, carol, ZERO_ADDRESS, {
                    from: carol
                })

                const aliceTokens = await getTroveEntireTokens(alice)
                const aliceColls = await getTroveEntireColl(alice)

                const bobTokens = await getTroveEntireTokens(bob)
                const bobColls = await getTroveEntireColl(bob)

                const carolTokens = await getTroveEntireTokens(carol)
                const carolColls = await getTroveEntireColl(carol)

                assert.isTrue(await th.assertCollateralsEqual(aliceTokens, aliceColls, [tokenC.address], [dec(200, 18)]))
                assert.isTrue(await th.assertCollateralsEqual(bobTokens, bobColls, [tokenC.address, tokenA.address], [dec(5, 18), dec(10, 18)]))
                assert.isTrue(await th.assertCollateralsEqual(carolTokens, carolColls, [tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)]))
            })

            it("Open trove multi collat with less balance than you have fails", async () => {
                await assertRevert(
                    borrowerOperations.openTrove([tokenA.address], [dec(200, 18)], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                        from: alice
                    }),
                    "You are trying to transfer more tokens than from has"
                )

                await assertRevert(
                    borrowerOperations.openTrove([tokenA.address, tokenB.address], [dec(200, 18), dec(200, 18)], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                        from: alice
                    }),
                    "You are trying to transfer more tokens than from has"
                )

                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA], [dec(400, 18)], {
                    from: alice
                })
                await assertRevert(
                    borrowerOperations.openTrove([tokenA.address, tokenB.address], [dec(200, 18), dec(200, 18)], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                        from: alice
                    }),
                    "You are trying to transfer more tokens than from has"
                )
            })

            it("Open trove after collateral price changes fails ", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA], [dec(400, 18)], {
                    from: alice
                })
                await th.addMultipleERC20(whale, borrowerOperations.address, [tokenA], [dec(400, 18)], {
                    from: whale
                })
                await th.addMultipleERC20(bob, borrowerOperations.address, [tokenA], [dec(400, 18)], {
                    from: bob
                })
                await borrowerOperations.openTrove([tokenA.address], [dec(300, 18)], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                    from: whale
                })
                await borrowerOperations.openTrove([tokenA.address], [dec(20, 18)], th._100pct, USDEMinAmount, bob, bob, ZERO_ADDRESS, {
                    from: bob
                })

                // priceFeedA.setPrice(dec(100, 18))
                priceFeedA.setPrice(dec(5, 17))
                // An operation that would result in ICR < MCR is not permitted
                await assertRevert(
                    borrowerOperations.openTrove([tokenA.address], [dec(20, 18)], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                        from: alice
                    }),
                    "ICRLessThanMCR"
                )
            })
        })

        describe('adjustTrove() multi collateral', async () => {
            it("Open a trove with multiple collateral types, then adjust", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA, tokenB, tokenC, tokenD], [dec(500, 18), dec(500, 18), dec(500, 18), dec(500, 18)], {
                    from: alice
                })
                await th.addMultipleERC20(bob, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(500, 18), dec(500, 18), dec(500, 18)], {
                    from: bob
                })
                await borrowerOperations.openTrove([tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                    from: alice
                })
                await borrowerOperations.openTrove([tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], th._100pct, USDEMinAmount, bob, bob, ZERO_ADDRESS, {
                    from: bob
                })
                const treasury_before = await usdeToken.balanceOf(treasury.address)
                const liquidityIncentiveUSDE_before = await usdeToken.balanceOf(liquidityIncentive.address)
                const fee_before = treasury_before.add(liquidityIncentiveUSDE_before)

                // Attempt to adjust with wrong order collateral and with new collateral type
                await borrowerOperations.adjustTrove([tokenD.address, tokenA.address], [dec(1, 18), dec(3, 18)], [tokenC.address, tokenB.address], [dec(2, 18), dec(1, 18)], th._100pct, 0, false, alice, alice, {
                    from: alice
                })
                const treasury_USDE = await usdeToken.balanceOf(treasury.address)
                const liquidityIncentive_USDE = await usdeToken.balanceOf(liquidityIncentive.address)
                const fee_after = treasury_USDE.add(liquidityIncentive_USDE)

                assert.isTrue(fee_after.gt(fee_before))
                const aliceTokens = await getTroveEntireTokens(alice)
                const aliceColls = await getTroveEntireColl(alice)
                const aliceDebt = await getTroveEntireDebt(alice)
                assert.isTrue(await th.assertCollateralsEqual(aliceTokens, aliceColls, [tokenA.address, tokenB.address, tokenC.address, tokenD.address], [dec(8, 18), dec(9, 18), dec(13, 18), dec(1, 18)]))

                th.assertIsApproximatelyEqual(aliceDebt, toBN(dec(20045000, 14)), _1e14BN) // With interests

                // Should let adjust debt and collateral types
                await borrowerOperations.adjustTrove([tokenD.address, tokenA.address], [dec(1, 18), dec(3, 18)], [tokenC.address, tokenB.address], [dec(2, 18), dec(1, 18)], th._100pct, dec(100, 18), true, alice, alice, {
                    from: alice
                })
                const aliceTokens2 = await getTroveEntireTokens(alice)
                const aliceColls2 = await getTroveEntireColl(alice)
                assert.isTrue(await th.assertCollateralsEqual(aliceTokens2, aliceColls2, [tokenA.address, tokenB.address, tokenC.address, tokenD.address], [dec(11, 18), dec(8, 18), dec(11, 18), dec(2, 18)]))
                const aliceDebt2 = await getTroveEntireDebt(alice)
                th.assertIsApproximatelyEqual(aliceDebt2, toBN(dec(21047500, 14)), _1e14BN) // With interests & extra fee 
                const treasury_before_adjust = await usdeToken.balanceOf(treasury.address)
                const liquidityIncentive_before_adjust = await usdeToken.balanceOf(liquidityIncentive.address)
                const fee_before_adjust = treasury_before_adjust.add(liquidityIncentive_before_adjust)
                await borrowerOperations.adjustTrove([tokenD.address, tokenA.address], [dec(1, 18), dec(3, 18)], [tokenC.address, tokenB.address], [dec(2, 18), dec(1, 18)], th._100pct, dec(1005, 17), false, alice, alice, {
                    from: alice
                })
                const treasury_after = await usdeToken.balanceOf(treasury.address)
                const liquidityIncentive_after = await usdeToken.balanceOf(liquidityIncentive.address)
                const fee_after_adjust = treasury_after.add(liquidityIncentive_after)
                assert.isTrue(fee_after_adjust.gt(fee_after))
                const aliceDebt3 = await getTroveEntireDebt(alice)
                th.assertIsApproximatelyEqual(aliceDebt3, toBN(dec(20042500, 14)), _1e14BN) // With interests

                // But not below debt floor
                // Trove's net debt must be greater than minimum
                await assertRevert(
                    borrowerOperations.adjustTrove([tokenD.address, tokenA.address], [dec(1, 18), dec(3, 18)], [tokenC.address, tokenB.address], [dec(2, 18), dec(1, 18)], th._100pct, dec(5, 18), false, alice, alice, {
                        from: alice
                    }),
                    "TroveDebtLessThanMinDebt"
                )
            })

            it("Adjusting trove without doing anything reverts", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(500, 18), dec(500, 18), dec(500, 18)], {
                    from: alice
                })

                await borrowerOperations.openTrove([tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                    from: alice
                })
                // Debt increase requires non-zero debtChange
                await assertRevert(
                    borrowerOperations.adjustTrove([], [], [], [], th._100pct, 0, true, alice, alice, {
                        from: alice
                    }),
                    "DebtIncreaseZero"
                )
                // There must be either a collateral change or a debt change
                await assertRevert(
                    borrowerOperations.adjustTrove([], [], [], [], th._100pct, 0, false, alice, alice, {
                        from: alice
                    }),
                    "MustChangeForCollOrDebt"
                )
                // Collateral amount is 0
                await assertRevert(
                    borrowerOperations.adjustTrove([], [], [tokenA.address], [0], th._100pct, 0, false, alice, alice, {
                        from: alice
                    }),
                    "CollAmountZero"
                )
                await assertRevert(
                    borrowerOperations.adjustTrove([tokenA.address], [0], [], [], th._100pct, 0, false, alice, alice, {
                        from: alice
                    }),
                    "CollAmountZero"
                )
                await assertRevert(
                    borrowerOperations.adjustTrove([tokenA.address, tokenB.address], [0, 0], [], [], th._100pct, 0, false, alice, alice, {
                        from: alice
                    }),
                    "CollAmountZero"
                )
                await assertRevert(
                    borrowerOperations.adjustTrove([], [], [tokenA.address, tokenB.address], [0, 0], th._100pct, 0, false, alice, alice, {
                        from: alice
                    }),
                    "CollAmountZero"
                )
            })

            it("Adjusting trove by amounts / tokens that do not line up reverts", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(500, 18), dec(500, 18), dec(500, 18)], {
                    from: alice
                })
                await th.addMultipleERC20(bob, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(500, 18), dec(500, 18), dec(500, 18)], {
                    from: bob
                })

                await borrowerOperations.openTrove([tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                    from: alice
                })
                // Length mismatch
                await assertRevert(
                    borrowerOperations.adjustTrove([], [0], [], [], th._100pct, 0, false, alice, alice, {
                        from: alice
                    }),
                    "LengthMismatch"
                )
                await assertRevert(
                    borrowerOperations.adjustTrove([], [], [], [0], th._100pct, 0, false, alice, alice, {
                        from: alice
                    }),
                    "LengthMismatch"
                )
                await assertRevert(
                    borrowerOperations.adjustTrove([], [], [tokenA.address, tokenB.address], [0], th._100pct, 0, false, alice, alice, {
                        from: alice
                    }),
                    "LengthMismatch"
                )
                await assertRevert(
                    borrowerOperations.adjustTrove([], [], [tokenA.address], [], th._100pct, 0, false, alice, alice, {
                        from: alice
                    }),
                    "LengthMismatch"
                )
                await assertRevert(
                    borrowerOperations.adjustTrove([tokenA.address, tokenB.address], [0], [], [], th._100pct, 0, false, alice, alice, {
                        from: alice
                    }),
                    "LengthMismatch"
                )
            })

            it("Adjusting trove by removing and adding same type of collateral does not work", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(500, 18), dec(500, 18), dec(500, 18)], {
                    from: alice
                })

                await borrowerOperations.openTrove([tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                    from: alice
                })
                // Overlap Colls
                await assertRevert(
                    borrowerOperations.adjustTrove([tokenA.address], [toBN(dec(1, 18))], [tokenA.address], [toBN(dec(2, 18))], th._100pct, 0, false, alice, alice, {
                        from: alice
                    }),
                    "CollsOverlap"
                )
                await assertRevert(
                    borrowerOperations.adjustTrove([tokenB.address, tokenA.address], [toBN(dec(1, 18)), toBN(dec(1, 18))], [tokenA.address], [toBN(dec(2, 18))], th._100pct, dec(1, 18), false, alice, alice, {
                        from: alice
                    }),
                    "CollsOverlap"
                )
            })

            it("Adjusting or opening trove with duplicate collat does not work", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(500, 18), dec(500, 18), dec(500, 18)], {
                    from: alice
                })
                // Duplicate Colls
                await assertRevert(
                    borrowerOperations.openTrove([tokenA.address, tokenA.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                        from: alice
                    }),
                    "CollsDuplicate"
                )

                // Can still open normal trove
                await borrowerOperations.openTrove([tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                    from: alice
                })
                // Length mismatch
                await assertRevert(
                    borrowerOperations.adjustTrove([tokenA.address, tokenB.address, tokenA.address], [toBN(dec(1, 18)), toBN(dec(1, 18))], [], [], th._100pct, 0, false, alice, alice, {
                        from: alice
                    }),
                    "LengthMismatch"
                )
                await assertRevert(
                    borrowerOperations.adjustTrove([], [], [tokenA.address, tokenA.address, tokenB.address], [toBN(dec(1, 18)), toBN(dec(1, 18))], th._100pct, 0, false, alice, alice, {
                        from: alice
                    }),
                    "LengthMismatch"
                )

                // Can still adjust normal trove
                await borrowerOperations.adjustTrove([tokenA.address, tokenB.address], [toBN(dec(1, 18)), toBN(dec(1, 18))], [], [], th._100pct, 0, false, alice, alice, {
                    from: alice
                })
            })

            it("Adjusting a trove with collateral after price drops calculates VC correctly", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenSuperRisky, tokenC], [dec(500, 18), dec(500, 18)], {
                    from: alice
                })
                await th.addMultipleERC20(whale, borrowerOperations.address, [tokenSuperRisky, tokenC], [dec(500, 18), dec(500, 18)], {
                    from: whale
                })

                // 5 low decimal token worth 5 * 200, with only 6 decimals. 
                await borrowerOperations.openTrove([tokenSuperRisky.address, tokenC.address], [dec(20, 18), dec(5, 18)], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                    from: alice
                })
                await borrowerOperations.openTrove([tokenSuperRisky.address, tokenC.address], [dec(450, 18), dec(450, 18)], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                    from: whale
                })

                const aliceTokens = await getTroveEntireTokens(alice)
                const aliceColls = await getTroveEntireColl(alice)
                const aliceDebt = await getTroveEntireDebt(alice)

                const aliceICRBefore = await th.getCurrentICR(contracts, alice)

                // (20 + 5 ) * 200 = 5000 VC Balance, 5000 / 2000 = 250% collateral ratio
                assert.isTrue(aliceICRBefore.lt(toBN(dec(25, 17))))
                assert.isTrue(aliceICRBefore.gt(toBN(dec(249, 16))))

                const newLowDecimalPrice = toBN(dec(0, 18))
                await priceFeedC.setPrice(newLowDecimalPrice)

                let aliceICRAfter = await th.getCurrentICR(contracts, alice)

                // (20 ) * 200 + (5) * 0 = 4000 VC Balance, 4000 / 2000 = 200% collateral ratio
                assert.isTrue(aliceICRAfter.lt(toBN(dec(2, 18))))
                assert.isTrue(aliceICRAfter.gt(toBN(dec(19, 17))))

                // Assert ICR = Alice ICR 
                const aliceVC = await collateralManager.getValue(aliceTokens, aliceColls)
                assert.isTrue(aliceVC[0].eq(toBN(dec(4000, 18))))
                th.assertIsApproximatelyEqual(aliceDebt, toBN(dec(20045000, 14)), _1e14BN)

                const newRiskyTokenPrice = toBN(dec(5, 17))
                await priceFeedSuperRisky.setPrice(newRiskyTokenPrice)

                // (20) * 100 + (5) * 0 = 2000 VC Balance, 2000 / 2000 = 100% collateral ratio
                aliceICRAfter = await th.getCurrentICR(contracts, alice)
                assert.isTrue(aliceICRAfter.lt(toBN(dec(100, 16))))
                assert.isTrue(aliceICRAfter.gt(toBN(dec(99, 16))))

                // Can do a withdrawal of collateral as long as total change is positive and above 110%. 
                // (20-2) * 100 + (5+10) * 110  = 3450 VC Balance, 3450 / 3000 = 150% collateral ratio
                await priceFeedC.setPrice(toBN(dec(55, 16)))
                const debtAddition = toBN(dec(1000, 18)).mul(toBN(1000)).div(toBN(1005)) // 1000 adjusted for fees
                await borrowerOperations.adjustTrove([tokenC.address], [toBN(dec(10, 18))], [tokenSuperRisky.address], [toBN(dec(2, 18))], th._100pct, debtAddition, true, alice, alice, {
                    from: alice
                })
                const treasuryUSDE = await usdeToken.balanceOf(treasury.address)
                const liquidityIncentiveUSDE = await usdeToken.balanceOf(liquidityIncentive.address)
                const A_USDE = await usdeToken.balanceOf(alice)
                const W_USDE = await usdeToken.balanceOf(whale)
                const expectedTotalSupply = A_USDE.add(W_USDE).add(USDE_GAS_COMPENSATION.mul(toBN("2"))).add(treasuryUSDE).add(liquidityIncentiveUSDE)

                // Check total USDE supply
                const totalSupply = await usdeToken.totalSupply()
                th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)

                aliceICRAfter = await th.getCurrentICR(contracts, alice)
                assert.isTrue(aliceICRAfter.lt(toBN(dec(115, 16))))
                assert.isTrue(aliceICRAfter.gt(toBN(dec(114, 16))))

                const newRiskyTokenPrice2 = toBN(dec(1, 18))
                await priceFeedSuperRisky.setPrice(newRiskyTokenPrice2) // new VC 3160, debt 3000

                // Reverts if trying to withdraw collateral + debt worth more than above 110%
                // An operation that would result in ICR < MCR is not permitted
                await assertRevert(
                    borrowerOperations.adjustTrove([tokenC.address], [toBN(dec(1, 18))], [tokenSuperRisky.address], [toBN(dec(11, 18))], th._100pct, toBN(dec(500, 18)), true, alice, alice, {
                        from: alice
                    }),
                    "ICRLessThanMCR"
                )
            })
        })

        describe('check VC, TCR, balances multi collateral', async () => {
            it("Open two multi collateral trove, check if collateral is correct", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(500, 18), dec(500, 18), dec(500, 18)], {
                    from: alice
                })
                await th.addMultipleERC20(bob, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(500, 18), dec(500, 18), dec(500, 18)], {
                    from: bob
                })

                await borrowerOperations.openTrove([tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                    from: alice
                })
                await borrowerOperations.openTrove([tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], th._100pct, USDEMinAmount, bob, bob, ZERO_ADDRESS, {
                    from: bob
                })

                const aliceTokens = await getTroveEntireTokens(alice)
                const aliceColls = await getTroveEntireColl(alice)
                const aliceDebt = await getTroveEntireDebt(alice)
                assert.isTrue(await th.assertCollateralsEqual(aliceTokens, aliceColls, [tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)]))
                th.assertIsApproximatelyEqual(aliceDebt, toBN(dec(20045000, 14)), _1e14BN)
            })

            it("Open two multi collateral trove, check raw balances of contracts are correct", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(500, 18), dec(500, 18), dec(500, 18)], {
                    from: alice
                })
                await th.addMultipleERC20(bob, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(500, 18), dec(500, 18), dec(500, 18)], {
                    from: bob
                })

                const ABCAddresses = [tokenA.address, tokenB.address, tokenC.address]
                const activePool_Coll_Before = [await activePool.getCollateralAmount(tokenA.address), await activePool.getCollateralAmount(tokenB.address), await activePool.getCollateralAmount(tokenC.address)]
                const activePool_RawColl_Before = [toBN(await tokenA.balanceOf(activePool.address)), toBN(await tokenB.balanceOf(activePool.address)), toBN(await tokenC.balanceOf(activePool.address))]

                assert.isTrue(await th.assertCollateralsEqual(ABCAddresses, [0, 0, 0], ABCAddresses, activePool_Coll_Before))
                assert.isTrue(await th.assertCollateralsEqual(ABCAddresses, [0, 0, 0], ABCAddresses, activePool_RawColl_Before))

                await borrowerOperations.openTrove([tokenA.address, tokenB.address], [dec(55, 18), dec(10, 18)], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                    from: alice
                })
                await borrowerOperations.openTrove([tokenA.address, tokenC.address], [dec(20, 18), dec(12, 18)], th._100pct, USDEMinAmount, bob, bob, ZERO_ADDRESS, {
                    from: bob
                })

                const aliceTokens = await getTroveEntireTokens(alice)
                const aliceColls = await getTroveEntireColl(alice)
                const aliceDebt = await getTroveEntireDebt(alice)

                const bobTokens = await getTroveEntireTokens(bob)
                const bobColls = await getTroveEntireColl(bob)
                const bobDebt = await getTroveEntireDebt(bob)

                assert.isTrue(await th.assertCollateralsEqual(aliceTokens, aliceColls, [tokenA.address, tokenB.address], [dec(55, 18), dec(10, 18)]))
                assert.isTrue(await th.assertCollateralsEqual(bobTokens, bobColls, [tokenA.address, tokenC.address], [dec(20, 18), dec(12, 18)]))

                const activePool_Coll_After = [await activePool.getCollateralAmount(tokenA.address), await activePool.getCollateralAmount(tokenB.address), await activePool.getCollateralAmount(tokenC.address)]
                const activePool_RawColl_After = [toBN(await tokenA.balanceOf(activePool.address)), toBN(await tokenB.balanceOf(activePool.address)), toBN(await tokenC.balanceOf(activePool.address))]

                const sumResult = await collateralManager.adjustColls(aliceColls, bobTokens, bobColls, [], [])
                const aliceBobTokens = aliceTokens
                const aliceBobAmounts = sumResult

                // Make sure raw balances of alice + bob are equal to the active pool amounts. 
                assert.isTrue(await th.assertCollateralsEqual(aliceBobTokens, aliceBobAmounts, ABCAddresses, activePool_Coll_After))
                assert.isTrue(await th.assertCollateralsEqual(aliceBobTokens, aliceBobAmounts, ABCAddresses, activePool_RawColl_After))
            })

            it("Open multi collateral trove, adjust prices individually, check if VC and TCR change accordingly. Ratio 1 tokens", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(500, 18), dec(500, 18), dec(500, 18)], {
                    from: alice
                })

                await borrowerOperations.openTrove([tokenA.address, tokenC.address, tokenB.address], [dec(10, 18), dec(5, 18), dec(5, 18)], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                    from: alice
                })

                const aliceTokens = await getTroveEntireTokens(alice)
                const aliceColls = await getTroveEntireColl(alice)
                const aliceDebt = await getTroveEntireDebt(alice)

                const TCRBefore = await th.getTCR(contracts)

                // (10 + 5 + 5 ) * 200 = 4000 VC Balance, 4000 / 2000 = 200% collateral ratio
                assert.isTrue(TCRBefore.lt(toBN(dec(2, 18))))
                assert.isTrue(TCRBefore.gt(toBN(dec(19, 17))))

                const newTokenAPrice = toBN(dec(5, 17))
                await priceFeedA.setPrice(newTokenAPrice)

                const TCRAfter = await th.getTCR(contracts)

                // (10) * 100 + (5 + 5) * 200 = 3000 VC Balance, 3000 / 2000 = 150% collateral ratio
                assert.isTrue(TCRAfter.lt(toBN(dec(15, 17))))
                assert.isTrue(TCRAfter.gt(toBN(dec(149, 16))))

                // Assert TCR = Alice ICR 
                const aliceVC = await collateralManager.getValue(aliceTokens, aliceColls)
                assert.isTrue(aliceVC[0].eq(toBN(dec(3000, 18))))
                th.assertIsApproximatelyEqual(aliceDebt, toBN(dec(20045000, 14)), _1e14BN)

                const newTokenBPrice = toBN(dec(5, 17))
                await priceFeedB.setPrice(newTokenBPrice)

                const TCRAfter2 = await th.getTCR(contracts)
                assert.isTrue(TCRAfter2.lt(toBN(dec(125, 16))))
                assert.isTrue(TCRAfter2.gt(toBN(dec(1240, 15))))
            })

            it("Ratio < 1, Open multi collateral trove, adjust prices individually, check if VC and TCR change accordingly", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenSuperRisky, tokenB, tokenC], [dec(500, 18), dec(500, 18), dec(500, 18)], {
                    from: alice
                })

                await borrowerOperations.openTrove([tokenSuperRisky.address, tokenC.address, tokenB.address], [dec(20, 18), dec(5, 18), dec(5, 18)], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                    from: alice
                })

                const aliceTokens = await getTroveEntireTokens(alice)
                const aliceColls = await getTroveEntireColl(alice)
                const aliceDebt = await getTroveEntireDebt(alice)

                const TCRBefore = await th.getTCR(contracts)

                // (20 + 5 + 5 ) * 200 = 6000 VC Balance, 6000 / 2000 = 300% collateral ratio
                assert.isTrue(TCRBefore.lt(toBN(dec(3, 18))))
                assert.isTrue(TCRBefore.gt(toBN(dec(299, 16))))

                const newRiskyTokenPrice = toBN(dec(5, 17))
                await priceFeedSuperRisky.setPrice(newRiskyTokenPrice)

                const TCRAfter = await th.getTCR(contracts)

                // (20 ) * 100 + (5 + 5) * 200 = 4000 VC Balance, 4000 / 2000 = 200% collateral ratio
                assert.isTrue(TCRAfter.lt(toBN(dec(20, 17))))
                assert.isTrue(TCRAfter.gt(toBN(dec(199, 16))))

                // Assert TCR = Alice ICR 
                const aliceVC = await collateralManager.getValue(aliceTokens, aliceColls)
                assert.isTrue(aliceVC[0].eq(toBN(dec(4000, 18))))
                th.assertIsApproximatelyEqual(aliceDebt, toBN(dec(20045000, 14)), _1e14BN)

                const newTokenBPrice = toBN(dec(5, 17))
                await priceFeedB.setPrice(newTokenBPrice)

                // 20 * 100 + 5 * 200 + 5 * 100 = 3500, 3500 / 2000 = 175%
                const TCRAfter2 = await th.getTCR(contracts)
                assert.isTrue(TCRAfter2.lt(toBN(dec(175, 16))))
                assert.isTrue(TCRAfter2.gt(toBN(dec(1740, 15))))
            })

            it("Including low decimal, Open multi collateral trove, adjust prices individually, check if VC and TCR change accordingly", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenSuperRisky, tokenC], [dec(500, 18), dec(500, 18)], {
                    from: alice
                })

                // 5 low decimal token worth 5 * 200, with only 6 decimals. 
                await borrowerOperations.openTrove([tokenSuperRisky.address, tokenC.address], [dec(20, 18), dec(5, 18)], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                    from: alice
                })

                const aliceTokens = await getTroveEntireTokens(alice)
                const aliceColls = await getTroveEntireColl(alice)
                const aliceDebt = await getTroveEntireDebt(alice)

                const TCRBefore = await th.getTCR(contracts)

                // (20 + 5 ) * 200 = 5000 VC Balance, 5000 / 2000 = 250% collateral ratio
                assert.isTrue(TCRBefore.lt(toBN(dec(25, 17))))
                assert.isTrue(TCRBefore.gt(toBN(dec(249, 16))))

                const newTokenCPrice = toBN(dec(2, 18))
                await priceFeedC.setPrice(newTokenCPrice)

                const TCRAfter = await th.getTCR(contracts)

                // (20) * 200 + (5) * 400 = 6000 VC Balance, 6000 / 2000 = 300% collateral ratio
                assert.isTrue(TCRAfter.lt(toBN(dec(30, 17))))
                assert.isTrue(TCRAfter.gt(toBN(dec(299, 16))))

                // Assert TCR = Alice ICR 
                const aliceVC = await collateralManager.getValue(aliceTokens, aliceColls)
                assert.isTrue(aliceVC[0].eq(toBN(dec(6000, 18))))
                th.assertIsApproximatelyEqual(aliceDebt, toBN(dec(20045000, 14)), _1e14BN)

                const newRiskyTokenPrice = toBN(dec(5, 17))
                await priceFeedSuperRisky.setPrice(newRiskyTokenPrice)

                // (20) * 100 + (5) * 400 = 4000 VC Balance, 4000 / 2000 = 200% collateral ratio
                const TCRAfter2 = await th.getTCR(contracts)
                assert.isTrue(TCRAfter2.lt(toBN(dec(200, 16))))
                assert.isTrue(TCRAfter2.gt(toBN(dec(199, 16))))
            })

            it("When price drops to 0, VC updates accordingly. ", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenSuperRisky, tokenC], [dec(500, 18), dec(500, 18)], {
                    from: alice
                })

                // 5 low decimal token worth 5 * 200, with only 6 decimals. 
                await borrowerOperations.openTrove([tokenSuperRisky.address, tokenC.address], [dec(20, 18), dec(5, 18)], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                    from: alice
                })

                const aliceTokens = await getTroveEntireTokens(alice)
                const aliceColls = await getTroveEntireColl(alice)
                const aliceDebt = await getTroveEntireDebt(alice)

                const TCRBefore = await th.getTCR(contracts)

                // (20 + 5 ) * 200 = 5000 VC Balance, 5000 / 2000 = 250% collateral ratio
                assert.isTrue(TCRBefore.lt(toBN(dec(25, 17))))
                assert.isTrue(TCRBefore.gt(toBN(dec(249, 16))))

                const newTokenCPrice = toBN(dec(0, 18))
                await priceFeedC.setPrice(newTokenCPrice)

                const TCRAfter = await th.getTCR(contracts)

                // (20) * 200 + (5) * 0 = 4000 VC Balance, 4000 / 2000 = 200% collateral ratio
                assert.isTrue(TCRAfter.lt(toBN(dec(20, 17))))
                assert.isTrue(TCRAfter.gt(toBN(dec(199, 16))))

                // Assert TCR = Alice ICR 
                const aliceVC = await collateralManager.getValue(aliceTokens, aliceColls)
                assert.isTrue(aliceVC[0].eq(toBN(dec(4000, 18))))
                th.assertIsApproximatelyEqual(aliceDebt, toBN(dec(20045000, 14)), _1e14BN)
            })
        })

        describe('Various Test multi collateral borrow ops', async () => {
            it("Try various operations with lots of accounts and tokens.", async () => {
                await collateralManager.pauseCollateral(contracts.weth.address)
                await collateralManager.removeCollateral(contracts.weth.address)

                const paramsE = {
                    name: "Token E",
                    symbol: "T.E",
                    decimals: 18,
                    price: toBN(dec(1, 18)),
                    ratio: toBN(dec(1, 18))
                }
                let result = await deploymentHelper.deployExtraCollateral(contracts, paramsE)
                let tokenE = result.token
                let priceFeedE = result.priceFeed
                let eTokenE = result.eToken

                const paramsF = {
                    name: "Token F",
                    symbol: "T.F",
                    decimals: 18,
                    price: toBN(dec(1, 18)),
                    ratio: toBN(dec(1, 18))
                }
                result = await deploymentHelper.deployExtraCollateral(contracts, paramsF)
                let tokenF = result.token
                let priceFeedF = result.priceFeed
                let eTokenF = result.eToken

                const paramsG = {
                    name: "Token G",
                    symbol: "T.G",
                    decimals: 18,
                    price: toBN(dec(1, 18)),
                    ratio: toBN(dec(1, 18))
                }
                result = await deploymentHelper.deployExtraCollateral(contracts, paramsG)
                let tokenG = result.token
                let priceFeedG = result.priceFeed
                let eTokenG = result.eToken

                const paramsH = {
                    name: "Token H",
                    symbol: "T.H",
                    decimals: 18,
                    price: toBN(dec(1, 18)),
                    ratio: toBN(dec(1, 18))
                }
                result = await deploymentHelper.deployExtraCollateral(contracts, paramsH)
                let tokenH = result.token
                let priceFeedH = result.priceFeed
                let eTokenH = result.eToken

                const paramsI = {
                    name: "Token I",
                    symbol: "T.I",
                    decimals: 18,
                    price: toBN(dec(1, 18)),
                    ratio: toBN(dec(1, 18))
                }
                result = await deploymentHelper.deployExtraCollateral(contracts, paramsI)
                let tokenI = result.token
                let priceFeedI = result.priceFeed
                let eTokenI = result.eToken

                // let accounts = [A, B, C, D, E, F, G, H]
                let accounts = [A, B, C, D]
                // let tokens = [contracts.weth, contracts.steth, tokenA, tokenB, tokenC, tokenD, tokenE, tokenF, tokenG, tokenH, tokenI, tokenRisky, tokenSuperRisky, stableCoin]
                let tokens = [tokenA, tokenB, tokenC, tokenD, tokenRisky, tokenSuperRisky, stableCoin, tokenE, tokenF, tokenG, tokenH, tokenI]
                await openTrove({
                    extraUSDEAmount: toBN(dec(100000, 30)),
                    ICR: toBN(dec(2, 18)),
                    token: tokenA,
                    extraParams: {
                        from: whale
                    }
                })
                await th.addTokensToAccountsAndOpenTroveWithICRNew(contracts, toBN(dec(2, 18)), accounts, tokens)
                console.log("Finished adding tokens and opening all troves. ")
                console.log("Adjusting troves randomly.")

                await th.adjustTrovesRandomly(contracts, accounts, tokens)
                await th.adjustTrovesRandomly(contracts, accounts, tokens)
                await th.adjustTrovesRandomly(contracts, accounts, tokens)

                console.log("Adjusting prices and adjusting troves again. ")
                await priceFeedA.setPrice(toBN(dec(9, 17)))
                await priceFeedB.setPrice(toBN(dec(94, 16)))
                await priceFeedC.setPrice(toBN(dec(111, 16)))
                await priceFeedD.setPrice(toBN(dec(115, 16)))
                await priceFeedE.setPrice(toBN(dec(1055, 15)))
                await priceFeedF.setPrice(toBN(dec(107, 16)))
                await priceFeedG.setPrice(toBN(dec(65, 16)))
                await priceFeedH.setPrice(toBN(dec(117, 16)))
                await priceFeedI.setPrice(toBN(dec(41, 17)))
                await contracts.priceFeedETH.setPrice(toBN(dec(125, 16)))
                await contracts.priceFeedSTETH.setPrice(toBN(dec(49, 16)))
                await priceFeedRisky.setPrice(toBN(dec(11175, 15)))
                await priceFeedSuperRisky.setPrice(toBN(dec(2775, 15)))
                await priceFeedStableCoin.setPrice(toBN(dec(222, 16)))
                await priceFeed.setPrice(toBN(dec(400, 18)))

                await th.adjustTrovesRandomly(contracts, accounts, tokens)
                await th.adjustTrovesRandomly(contracts, accounts, tokens)
                await th.adjustTrovesRandomly(contracts, accounts, tokens)
            })
        })

        describe('Various Test fees borrow ops', async () => {
            it("Basic get fee flat open trove before and after", async () => {
                // skip fee bootstrap period 
                await th.fastForwardTime((SECONDS_IN_ONE_DAY * 14), web3.currentProvider)
                await collateralManager.addCollateral(contracts.steth.address, priceFeedSTETH.address, contracts.eTokenSTETH.address, toBN(dec(1, 18)))
                await contracts.priceFeedSTETH.setPrice(toBN(dec(1, 18)))
                const paramsF = {
                    name: "Token A",
                    symbol: "T.A",
                    decimals: 18,
                    price: toBN(dec(1, 18)),
                    ratio: toBN(dec(1, 18))
                }
                result = await deploymentHelper.deployExtraCollateral(contracts, paramsF)
                let tokenA = result.token
                let priceFeedA = result.priceFeed

                // alice will open a trove with a solid amount of tokens, of weth. weth has no additional fee. 
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.steth], [dec(500, 18)], {
                    from: alice
                })
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.steth], [dec(500, 18)], {
                    from: bob
                })
                await th.addMultipleERC20(carol, borrowerOperations.address, [contracts.steth, tokenA], [dec(500, 18), dec(500, 18)], {
                    from: carol
                })

                await borrowerOperations.openTrove([], [], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                    from: alice,
                    value: dec(20, 18)
                })
                await borrowerOperations.openTrove([contracts.steth.address], [dec(20, 18)], th._100pct, USDEMinAmount, bob, bob, ZERO_ADDRESS, {
                    from: bob
                })

                const bobDebt = await troveManager.getTroveDebt(bob)
                th.assertIsApproximatelyEqual(bobDebt, toBN(dec(20045000, 14)))

                await borrowerOperations.openTrove([contracts.steth.address, tokenA.address], [dec(20, 18), dec(20, 18)], th._100pct, USDEMinAmount, carol, carol, ZERO_ADDRESS, {
                    from: carol
                })
                const carolDebt = await troveManager.getTroveDebt(carol)
                th.assertIsApproximatelyEqual(carolDebt, toBN(dec(20045000, 14)))
            })

            it("Basic get fee sloped open trove before and after", async () => {
                // skip fee bootstrap period. 
                await th.fastForwardTime((SECONDS_IN_ONE_DAY * 14), web3.currentProvider)

                await collateralManager.addCollateral(contracts.steth.address, priceFeedSTETH.address, contracts.eTokenSTETH.address, toBN(dec(1, 18)))
                await contracts.priceFeedSTETH.setPrice(toBN(dec(1, 18)))
                const paramsF = {
                    name: "Token A",
                    symbol: "T.A",
                    decimals: 18,
                    price: toBN(dec(1, 18)),
                    ratio: toBN(dec(1, 18))
                }
                result = await deploymentHelper.deployExtraCollateral(contracts, paramsF)
                let tokenA = result.token
                let priceFeedA = result.priceFeed

                // alice will open a trove with a solid amount of tokens, of weth. weth has no additional fee. 
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.steth], [dec(500, 18)], {
                    from: alice
                })
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.steth], [dec(500, 18)], {
                    from: bob
                })
                await th.addMultipleERC20(carol, borrowerOperations.address, [contracts.steth, tokenA], [dec(500, 18), dec(500, 18)], {
                    from: carol
                })

                await borrowerOperations.openTrove([], [], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                    from: alice,
                    value: dec(20, 18)
                })

                // Now steth is 50% of the collateral of the protocol, so the two fee points should be 0.5% and 1.5%, resulting in 1% fee.
                await borrowerOperations.openTrove([contracts.steth.address], [dec(20, 18)], th._100pct, USDEMinAmount, bob, bob, ZERO_ADDRESS, {
                    from: bob
                })
                // expect debt to be 2000.4025
                const bobDebt = await troveManager.getTroveDebt(bob)
                th.assertIsApproximatelyEqual(bobDebt, toBN(dec(20045000, 14)))
                // total collateral in the system is 40 + 120 = 160. 
                // steth is 100 / 160 = 62.5% of total. The fee should be (50% + 62.5%) / 2 => (0.01 + 0.01125) / 2 = 0.010625%
                // tokenA is 40 / 160 = 25% of total. The fee should be (0% + 25%) / 2 => (0.005 + 0.0075) = 0.00625% 
                await borrowerOperations.openTrove([contracts.steth.address, tokenA.address], [dec(80, 18), dec(40, 18)], th._100pct, USDEMinAmount, carol, carol, ZERO_ADDRESS, {
                    from: carol
                })
                // expect debt to be 2000.4025
                const carolDebt = await troveManager.getTroveDebt(carol)
                th.assertIsApproximatelyEqual(carolDebt, toBN(dec(20045000, 14)))
            })

            it("Basic get fee sloped open and adjust trove before and after", async () => {
                // skip fee bootstrap period. 
                await th.fastForwardTime((SECONDS_IN_ONE_DAY * 14), web3.currentProvider)

                await collateralManager.addCollateral(contracts.steth.address, priceFeedSTETH.address, contracts.eTokenSTETH.address, toBN(dec(1, 18)))
                await contracts.priceFeedSTETH.setPrice(toBN(dec(1, 18)))
                const paramsF = {
                    name: "Token A",
                    symbol: "T.A",
                    decimals: 18,
                    price: toBN(dec(1, 18)),
                    ratio: toBN(dec(1, 18))
                }
                result = await deploymentHelper.deployExtraCollateral(contracts, paramsF)
                let tokenA = result.token
                let priceFeedA = result.priceFeed

                // alice will open a trove with a solid amount of tokens, of weth. weth has no additional fee. 
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.steth], [dec(500, 18), dec(500, 18)], {
                    from: alice
                })
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.steth, tokenA], [dec(500, 18), dec(500, 18)], {
                    from: bob
                })

                await borrowerOperations.openTrove([], [], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                    from: alice,
                    value: dec(20, 18)
                })

                // Now steth is 50% of the collateral of the protocol, so the two fee points should be 0.5% and 1.5%, resulting in 1% fee.
                await borrowerOperations.openTrove([contracts.steth.address], [dec(20, 18)], th._100pct, USDEMinAmount, bob, bob, ZERO_ADDRESS, {
                    from: bob
                })
                // expect debt to be VCAmount * (0.005) / 2 + 2000 
                const bobDebt = await troveManager.getTroveDebt(bob)
                th.assertIsApproximatelyEqual(bobDebt, toBN(dec(20045000, 14)))

                // total collateral in the system is 40 + 120 = 160. 
                // steth is 100 / 160 = 62.5% of total. The fee should be (50% + 62.5%) / 2 => (0.01 + 0.01125) / 2 = 0.010625%
                // tokenA is 40 / 160 = 25% of total. The fee should be (0% + 25%) / 2 => (0.005 + 0.0075) = 0.00625% 
                await borrowerOperations.adjustTrove([contracts.steth.address, tokenA.address], [dec(80, 18), dec(40, 18)], [], [], th._100pct, 0, false, bob, bob, {
                    from: bob
                })
                // expect debt to be (80 * 200 * 0.010625 + 40 * 200 * 0.00625) / 2 + 2000 = 2110 + 15 from earlier
                const bobDebtAfter = await troveManager.getTroveDebt(bob)
                th.assertIsApproximatelyEqual(bobDebtAfter, toBN(dec(20045000, 14)), _1e14BN)
            })

            it("Test fee cap passed in to open trove", async () => {
                // skip fee bootstrap period. 
                await th.fastForwardTime((SECONDS_IN_ONE_DAY * 14), web3.currentProvider)

                await collateralManager.addCollateral(contracts.steth.address, priceFeedSTETH.address, contracts.eTokenSTETH.address, toBN(dec(1, 18)))
                await contracts.priceFeedSTETH.setPrice(toBN(dec(1, 18)))
                const paramsF = {
                    name: "Token A",
                    symbol: "T.A",
                    decimals: 18,
                    price: toBN(dec(1, 18)),
                    ratio: toBN(dec(1, 18))
                }
                result = await deploymentHelper.deployExtraCollateral(contracts, paramsF)
                let tokenA = result.token
                let priceFeedA = result.priceFeed

                // alice will open a trove with a solid amount of tokens, of weth. weth has no additional fee. 
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.steth], [dec(500, 18), dec(500, 18)], {
                    from: alice
                })
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.steth, tokenA], [dec(500, 18), dec(500, 18)], {
                    from: bob
                })

                await borrowerOperations.openTrove([], [], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                    from: alice,
                    value: dec(20, 18)
                })

                const justBelowFeeCap = toBN(dec(30, 18)).add(toBN(dec(1800, 18)).sub(USDEMinAmount)).mul(toBN(dec(1, 18))).div(toBN(dec(4000, 18))).sub(toBN(dec(1, 1)))
                // bob does not want to pay more than 0.5% fee on his open trove. Now calculated on collateral amount. 
                th.assertRevert(
                    borrowerOperations.openTrove([contracts.steth.address], [dec(20, 18)], justBelowFeeCap, USDEMinAmount, bob, bob, ZERO_ADDRESS, {
                        from: bob
                    }),
                    "TroveIsActive"
                )
            })

            it("During bootstrapping period, max fee is 1%", async () => {
                await collateralManager.addCollateral(contracts.steth.address, priceFeedSTETH.address, contracts.eTokenSTETH.address, toBN(dec(1, 18)))
                await contracts.priceFeedSTETH.setPrice(toBN(dec(1, 18)))
                const paramsF = {
                    name: "Token A",
                    symbol: "T.A",
                    decimals: 18,
                    price: toBN(dec(1, 18)),
                    ratio: toBN(dec(1, 18))
                }
                result = await deploymentHelper.deployExtraCollateral(contracts, paramsF)
                let tokenA = result.token
                let priceFeedA = result.priceFeed

                // alice will open a trove with a solid amount of tokens, of weth. weth has no additional fee. 
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.steth], [dec(500, 18), dec(500, 18)], {
                    from: alice
                })
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.steth, tokenA], [dec(500, 18), dec(500, 18)], {
                    from: bob
                })

                await borrowerOperations.openTrove([contracts.steth.address], [dec(20, 18)], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                    from: alice,
                    value: dec(20, 18)
                })

                // bob will pay max fee of 1% here 
                await borrowerOperations.openTrove([contracts.steth.address], [dec(20, 18)], th._100pct, USDEMinAmount, bob, bob, ZERO_ADDRESS, {
                    from: bob,
                    value: dec(20, 18)
                })
                const bobDebt = await troveManager.getTroveDebt(bob)
                assert.isFalse(bobDebt.sub(toBN(dec(2000, 18))).eq(toBN(dec(4025, 14))), "maxFee is 1% ")

                await usdeToken.transfer(bob, dec(1500, 18), {
                    from: alice
                })
                await borrowerOperations.closeTrove({
                    from: bob
                })
                // skip fee bootstrap period. 
                await th.fastForwardTime((SECONDS_IN_ONE_DAY * 14), web3.currentProvider)
                await borrowerOperations.openTrove([contracts.steth.address], [dec(20, 18)], th._100pct, USDEMinAmount, bob, bob, ZERO_ADDRESS, {
                    from: bob,
                    value: dec(20, 18)
                })
                const bobDebt2 = await troveManager.getTroveDebt(bob)
                assert.isTrue(bobDebt2.sub(toBN(dec(2004, 18))).eq(toBN(dec(5000, 14))), "maxFee no longer applies at 1% ")
            })

            it("Test fee decay without much change in time.", async () => {
                // skip fee bootstrap period. 
                await th.fastForwardTime((SECONDS_IN_ONE_DAY * 14), web3.currentProvider)

                await collateralManager.addCollateral(contracts.steth.address, priceFeedSTETH.address, contracts.eTokenSTETH.address, toBN(dec(1, 18)))
                await contracts.priceFeedSTETH.setPrice(toBN(dec(1, 18)))
                const paramsF = {
                    name: "Token A",
                    symbol: "T.A",
                    decimals: 18,
                    price: toBN(dec(1, 18)),
                    ratio: toBN(dec(1, 18))
                }
                result = await deploymentHelper.deployExtraCollateral(contracts, paramsF)
                let tokenA = result.token
                let priceFeedA = result.priceFeed
                // alice will open a trove with a solid amount of tokens, of weth. weth has no additional fee. 
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.steth], [dec(500, 18)], {
                    from: alice
                })
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.steth, tokenA], [dec(500, 18), dec(500, 18)], {
                    from: bob
                })
                await th.addMultipleERC20(carol, borrowerOperations.address, [contracts.steth, tokenA], [dec(500, 18), dec(500, 18)], {
                    from: carol
                })

                await borrowerOperations.openTrove([contracts.steth.address], [dec(20, 18)], th._100pct, USDEMinAmount, alice, alice, ZERO_ADDRESS, {
                    from: alice,
                    value: dec(20, 18)
                })
                // alice pays fee at 50% of the protocol. Carol potentially should pay less than that but it will charge the original fee. 
                const aliceDebt = await troveManager.getTroveDebt(alice)

                // Bob should pay slightly more than alice due to how the price curve is set up. Set to be around 0.875%. 
                await borrowerOperations.openTrove([contracts.steth.address], [dec(20, 18)], th._100pct, USDEMinAmount, bob, bob, ZERO_ADDRESS, {
                    from: bob,
                    value: dec(100, 18)
                })

                // Carol should pay slightly less than 0.875% fee. 
                await borrowerOperations.openTrove([contracts.steth.address], [dec(20, 18)], th._100pct, USDEMinAmount, carol, carol, ZERO_ADDRESS, {
                    from: carol,
                    value: dec(100, 18)
                })
                const carolDebt = await troveManager.getTroveDebt(carol)
                assert.isFalse(carolDebt.sub(toBN(dec(2000, 18))).eq(toBN(dec(4025, 14))), "slightly decayed")
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