const {
    assert
} = require("chai")
const deploymentHelper = require("../utils/deploymentHelpersUpgrade.js")
const testHelpers = require("../utils/testHelpersUpgrade.js")
const th = testHelpers.TestHelper

const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

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

contract('newBorrowerOperations', async accounts => {

    const [
        owner, alice, bob, carol, dennis
    ] = accounts
    let Owner, Alice, Bob, Carol, Dennis

    let priceFeedSTETH
    let priceFeedETH
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
    const openTrove = async (params) => th.openTrove(contracts, params)
    const getTroveEntireColl = async (trove) => th.getTroveEntireColl(contracts, trove)
    const getTroveEntireDebt = async (trove) => th.getTroveEntireDebt(contracts, trove)
    const getTroveStake = async (trove) => th.getTroveStake(contracts, trove)

    let USDE_GAS_COMPENSATION
    let MIN_NET_DEBT
    let BORROWING_FEE_FLOOR

    let tokensToOracles = new Map()

    before(async () => {

    })

    const testCorpus = ({
        withProxy = false
    }) => {
        beforeEach(async () => {
            contracts = await deploymentHelper.deployERDCore()

            priceFeedSTETH = contracts.priceFeedSTETH
            priceFeedETH = contracts.priceFeedETH
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
            treasury = contracts.treasury
            liquidityIncentive = contracts.liquidityIncentive
            communityIssuance = contracts.communityIssuance

            var params = {
                _collateral: contracts.weth.address,
                _oracle: priceFeedETH.address
            }

            params = {
                _collateral: contracts.steth.address,
                _oracle: priceFeedSTETH.address
            }

            USDE_GAS_COMPENSATION = await borrowerOperations.USDE_GAS_COMPENSATION()
            MIN_NET_DEBT = await collateralManager.getMinNetDebt()
            BORROWING_FEE_FLOOR = await collateralManager.getBorrowingFeeFloor()
            await collateralManager.addCollateral(contracts.steth.address, priceFeedSTETH.address, contracts.eTokenSTETH.address, toBN(dec(1, 18)))
            await priceFeedSTETH.setPrice(dec(1, 18))
            tokensToOracles.set(contracts.weth.address, priceFeedETH);
            tokensToOracles.set(contracts.steth.address, priceFeedSTETH);
            const signers = await ethers.getSigners()
            Owner = signers[0]
            Alice = signers[1]
            Bob = signers[2]
            Carol = signers[3]
            Dennis = signers[4]
        })

        it("removeCollateral(), loop through valid collateral and delete", async () => {
            let validCollateral = await collateralManager.getCollateralSupport();
            for (let i = 1; i < validCollateral.length; i++) {
                assert.isTrue(await collateralManager.getIsActive(validCollateral[i]), "Collateral shouldn't be removed before paused");
                await collateralManager.pauseCollateral(validCollateral[i]);
                await collateralManager.removeCollateral(validCollateral[i]);
                assert.isFalse(await collateralManager.getIsActive(validCollateral[i]), "Collateral has been removed");
            }
        })

        it("removeCollateral(), try remove collateral which is active", async () => {
            let validCollateral = await collateralManager.getCollateralSupport();
            for (let i = 1; i < validCollateral.length; i++) {
                assert.isTrue(await collateralManager.getIsActive(validCollateral[i]), "Collateral shouldn't be remove");
                await assertRevert(collateralManager.removeCollateral(validCollateral[i]));
                await collateralManager.pauseCollateral(validCollateral[i])
                assert.isFalse(await collateralManager.getIsActive(validCollateral[i]), "Collateral has been paused");

            }

            for (let i = 1; i < validCollateral.length; i++) {
                await collateralManager.removeCollateral(validCollateral[i])
                assert.isFalse(await collateralManager.getIsSupport(validCollateral[i]), "Collateral is not be supported");
                // Collateral not pause
                await assertRevert(collateralManager.removeCollateral(validCollateral[i]), "CollNotPaused");
            }

        })

        it("getOracle(), check oracles for each collateral", async () => {
            let validCollateral = await collateralManager.getCollateralSupport();
            for (let i = 0; i < validCollateral.length; i++) {
                let oracle = await collateralManager.getCollateralOracle(validCollateral[i]);
                assert.equal(oracle, tokensToOracles.get(validCollateral[i]).address)
            }
        })

        it("setOracle(), loop through valid collateral and change oracle", async () => {
            let validCollateral = await collateralManager.getCollateralSupport();
            for (let i = 0; i < validCollateral.length; i++) {
                let oracle = await collateralManager.getCollateralOracle(validCollateral[i]);
                await collateralManager.setOracle(validCollateral[i], validCollateral[i]);
                let newOracle = await collateralManager.getCollateralOracle(validCollateral[i]);
                assert.notEqual(oracle, newOracle);
            }
        })

        it("Check after paused of collateral that people cannot open trove with that collateral, but it still works inside the system with adjust.", async () => {
            await openTrove({
                ICR: toBN(dec(2, 18)),
                signer: Alice,
                extraParams: {
                    from: alice
                }
            })
            await collateralManager.pauseCollateral(contracts.steth.address)
            await collateralManager.removeCollateral(contracts.steth.address)
            const collTopUp = dec(100, 18)
            await th.addERC20(contracts.steth, Bob, contracts.borrowerOperations.address, toBN(collTopUp), {
                from: bob
            })
            const openTxAPromise = borrowerOperations.connect(Bob).openTrove([contracts.steth.address], [collTopUp], th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN('1'))), alice, alice, ZERO_ADDRESS, {
                from: bob
            })
            // Collateral does not active or is paused
            await assertRevert(openTxAPromise, "CollNotActive")

            await collateralManager.addCollateral(contracts.steth.address, priceFeedSTETH.address, contracts.eTokenSTETH.address, toBN(dec(1, 18)))
            // 1 ETH : 1 STETH
            await priceFeedSTETH.setPrice(toBN(dec(1, 18)))

            const tx = await borrowerOperations.connect(Bob).openTrove([contracts.steth.address], [collTopUp], th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN('1'))), alice, alice, ZERO_ADDRESS, {
                from: bob
            })
            const txRes = await tx.wait()
            assert.isTrue(txRes.status === 1)

            await collateralManager.pauseCollateral(contracts.steth.address)

            await th.addERC20(contracts.steth, Carol, contracts.borrowerOperations.address, toBN(collTopUp), {
                from: carol
            })
            const openTx_C = borrowerOperations.connect(Carol).openTrove([contracts.steth.address], [collTopUp], th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN('1'))), bob, bob, ZERO_ADDRESS, {
                from: carol
            })
            // Collateral does not active or is paused
            await assertRevert(openTx_C, "CollNotActive")

            const tx_B = await borrowerOperations.connect(Bob).adjustTrove([], [], [contracts.steth.address], [toBN(dec(1, 18))], th._100pct, 0, false, th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
                from: bob
            })
            const txBRes = await tx_B.wait()
            assert.isTrue(txBRes.status === 1)
        })

        it("Check after paused of collateral that people cannot open trove with that collateral, but it still works inside the system.", async () => {
            /*
            Add troves with both collaterals.
            deprecate Eth
            - make sure new troves cannot be opened with Eth
            - still able to liquidate troves with Eth
            */
            let validCollateral = await collateralManager.getCollateralSupport();
            let a_wethToMint = toBN(dec(400, 17));
            // let a_amounts = [a_wethToMint];

            let {
                collateral: a_amounts
            } = await openTrove({
                ICR: toBN(dec(2, 18)),
                signer: Alice,
                extraParams: {
                    from: alice,
                    value: a_wethToMint
                }
            })

            let b_stethToMint = toBN(dec(400, 17));

            let b_colls = [contracts.steth];
            let b_amounts = [b_stethToMint];

            await th.addERC20(contracts.steth, Bob, contracts.borrowerOperations.address, b_stethToMint, {
                from: bob
            })
            await borrowerOperations.connect(Bob).openTrove([contracts.steth.address], [b_stethToMint], th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN('1'))), alice, alice, ZERO_ADDRESS, {
                from: bob
            })

            let c_wethToMint = toBN(dec(110, 17));
            let c_stethToMint = toBN(dec(100, 17));

            let c_colls = [contracts.weth, contracts.steth];
            let c_amounts = [c_wethToMint, c_stethToMint];
            await th.addERC20(contracts.steth, Carol, contracts.borrowerOperations.address, c_stethToMint, {
                from: carol
            })
            await borrowerOperations.connect(Carol).openTrove([contracts.steth.address], [c_stethToMint], th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN('1'))), alice, alice, ZERO_ADDRESS, {
                from: carol,
                value: c_wethToMint
            })
            // paused ETH
            await collateralManager.pauseCollateral(validCollateral[0]);

            let d_wethToMint = toBN(dec(400, 17));

            let d_colls = [contracts.weth];
            let d_amounts = [d_wethToMint];
            // ETH does not active or is paused
            await assertRevert(
                openTrove({
                    ICR: toBN(dec(2, 18)),
                    signer: Dennis,
                    extraParams: {
                        from: dennis,
                        value: d_wethToMint
                    }
                }),
                "ETHNotActive"
            )

            const addedColl1 = toBN(dec(1, 'ether'))
            // ETH does not active
            await assertRevert(
                borrowerOperations.connect(Alice).addColl([], [], alice, alice, {
                    from: alice,
                    value: addedColl1
                }),
                "ETHNotActive"
            )

            await borrowerOperations.connect(Carol).withdrawColl([contracts.weth.address], [addedColl1], carol, carol, {
                from: carol
            });

            await steth.mint(carol, addedColl1)
            await steth.connect(Carol).approve(borrowerOperations.address, addedColl1, {
                from: carol
            });
            await borrowerOperations.connect(Carol).addColl([steth.address], [addedColl1], carol, carol, {
                from: carol
            });
            await borrowerOperations.connect(Carol).withdrawColl([steth.address], [addedColl1], carol, carol, {
                from: carol
            });
            // // Price drops to 100 $/E
            await contracts.priceFeedETH.setPrice(dec(130, 18))
            await contracts.priceFeedSTETH.setPrice(dec(65, 16))

            // Confirm not in Recovery Mode
            assert.isFalse(await th.checkRecoveryMode(contracts))

            // L1: C liquidated
            const txB = await troveManager.liquidate(carol)
            const txBRes = await txB.wait()
            assert.isTrue(txBRes.status === 1)
            assert.isFalse(await sortedTroves.contains(carol))


            // Price bounces back to 200 $/E
            await contracts.priceFeedETH.setPrice(dec(200, 18))
            await contracts.priceFeedSTETH.setPrice(dec(1, 18))


            const alice_ETH = ((await troveManager.getTroveColls(alice))[0][0]
                    .add((await troveManager.getPendingCollReward(alice))[0][0]))
                .toString()

            const bob_STETH = ((await troveManager.getTroveColls(bob))[0][0]
                    .add((await troveManager.getPendingCollReward(bob))[0][0]))
                .toString()


            /* Expected collateral:
            A: Alice receives 0.995 ETH from L1, and ~3/5*0.995 ETH from L2.
            expect aliceColl = 2 + 0.995 + 2.995/4.995 * 0.995 = 3.5916 ETH

            C: Carol receives ~2/5 ETH from L2
            expect carolColl = 2 + 2/4.995 * 0.995 = 2.398 ETH

            Total coll = 4 + 2 * 0.995 ETH
            */
            const A_ETHAfterL1 = a_wethToMint.add(th.applyLiquidationFee(c_amounts[0]))
            assert.isAtMost(th.getDifference(alice_ETH, A_ETHAfterL1), Number(dec(150, 20)))

            const entireSystemETH = (await activePool.getCollateralAmount(weth.address)).add(await defaultPool.getCollateralAmount(weth.address))
            assert.isTrue(entireSystemETH.eq(a_amounts.add(th.applyLiquidationFee(c_amounts[1]))))

            aliceCTS = (await contracts.troveManager.getCurrentTroveAmounts(alice))

            await usdeToken.unprotectedMint(alice, toBN(dec(1300, 18)))
            await usdeToken.connect(Alice).approve(borrowerOperations.address, toBN(dec(1300, 18)), {
                from: alice
            });

            const txAlice = await borrowerOperations.connect(Alice).closeTrove({
                from: alice
            })
            const txAliceRes = await txAlice.wait()
            assert.isTrue(txAliceRes.status === 1)

            const B_STETHAfterL1 = b_amounts[0].add(th.applyLiquidationFee(c_amounts[1]))
            assert.isAtMost(th.getDifference(bob_STETH, B_STETHAfterL1), Number(dec(150, 20)))

            const entireSystemSTETH = (await activePool.getCollateralAmount(steth.address)).add(await defaultPool.getCollateralAmount(steth.address))
            assert.isTrue(entireSystemSTETH.eq(b_amounts[0].add(th.applyLiquidationFee(c_amounts[1]))))

            assert.equal((await usdeToken.balanceOf(owner)).toString(), dec(200, 18))
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