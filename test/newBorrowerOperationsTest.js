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

const ZERO_ADDRESS = th.ZERO_ADDRESS

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
        owner, alice, bob, carol, dennis, whale,
        A, B, C, D, E, F, G, H,
        // defaulter_1, defaulter_2,
        frontEnd_1, frontEnd_2, frontEnd_3
    ] = accounts;

    // const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]

    let priceFeedSTETH
    let priceFeedETH
    let usdeToken
    let sortedTroves
    let troveManager
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
            await collateralManager.addCollateral(contracts.steth.address, priceFeedSTETH.address, contracts.eTokenSTETH.address, toBN(dec(1, 18)))
            await priceFeedSTETH.setPrice(dec(1, 18))
        })

        it("addColl(), basic sanity", async () => {
            const amountToMint = toBN(dec(1000, 18));

            const _colls = [contracts.weth, contracts.steth];
            const _amounts = [amountToMint, amountToMint]
            const _priceFeeds = [contracts.priceFeedETH, contracts.priceFeedSTETH]

            const stethMintAlice = await th.addERC20(contracts.steth, bob, borrowerOperations.address, amountToMint, {
                from: bob
            })
            assert.isTrue(stethMintAlice);

            const params = await th.openTroveWithColls(contracts, {
                ICR: toBN(dec(2, 18)),
                colls: _colls,
                amounts: _amounts,
                extraUSDEAmount: toBN(dec(2000, 18)),
                extraParams: {
                    from: alice
                }
            })

            for (let i = 0; i < params.amounts.length; i++) {
                console.log("amounts[".concat(i).concat("]"), params.amounts[i].toString())
            }

            const troveColls2 = await troveManager.getTroveColls(alice)
            console.log("trove coll address " + troveColls2[2][0])
            console.log("trove coll amount " + troveColls2[0][0])

            const activePoolWeth = await contracts.weth.balanceOf(activePool.address)
            console.log("WETH active pool has:", (activePoolWeth.div(toBN(10 ** 18))).toNumber());

            const activePoolSTETH = await contracts.steth.balanceOf(activePool.address)
            console.log("steth activepool has:", (activePoolSTETH.div(toBN(10 ** 18))).toNumber());

            const aliceUSDE = await usdeToken.balanceOf(alice)
            console.log("usde MINTED:", (aliceUSDE.div(toBN(10 ** 18))).toNumber());

            const aliceSTETH = await contracts.steth.balanceOf(alice)
            console.log("steth alice has:", (aliceSTETH.div(toBN(10 ** 18))).toNumber());

            const aliceWeth = await contracts.weth.balanceOf(alice)
            console.log("weth alice has:", (aliceWeth.div(toBN(10 ** 18))).toNumber());

            const troveDebt = await troveManager.getTroveDebt(alice)

            assert.isTrue(th.toNormalBase(troveDebt) == (params.newTotalVC.div(params.ICR)).toString())

            // collsIn, amountsIn, collsOut, amountsOut, 
            await th.adjustTrove(contracts, [], [], [], [], th._100pct, 0, false, th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
                from: alice,
                value: amountToMint
            })

            const troveColls = await troveManager.getTroveColls(alice)
            console.log("trove coll address " + troveColls[2][0])
            console.log("trove coll amount " + troveColls[0][0])

            const troveDebt2 = await troveManager.getTroveDebt(alice)
            console.log("Trove debt2: " + troveDebt2)

            // collsIn, amountsIn, collsOut, amountsOut, 
            await th.adjustTrove(contracts, [], [], [], [], th._100pct, 0, false, th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
                from: alice,
                value: amountToMint
            })

            const troveColls3 = await troveManager.getTroveColls(alice)
            console.log("trove coll address " + troveColls3[2])
            console.log("trove coll amount " + troveColls3[0])


            await th.adjustTrove(contracts, [], [], [], [], th._100pct, toBN(dec(2000, 18)), true, th.ZERO_ADDRESS, th.ZERO_ADDRESS, {
                from: alice
            })

            const troveDebt3 = await troveManager.getTroveDebt(alice)
            console.log("Trove debt3: " + troveDebt3)
            const mintedUSDEb = await contracts.usdeToken.balanceOf(alice)
            console.log(th.toNormalBase(mintedUSDEb))

            const result = await th.mintAndApproveUSDEToken(contracts, alice, borrowerOperations.address, amountToMint)
            const mintedUSDE = await contracts.usdeToken.balanceOf(alice)
            console.log(th.toNormalBase(mintedUSDE))
            console.log("result " + result)

            // const amountToMint = toBN(dec(1000, 18));

            const collsBob = [contracts.weth, contracts.steth];
            const amountsBob = [amountToMint, amountToMint]
            const paramsBob = await th.openTroveWithColls(contracts, {
                ICR: toBN(dec(2, 18)),
                colls: collsBob,
                amounts: amountsBob,
                extraUSDEAmount: toBN(dec(2000, 18)),
                extraParams: {
                    from: bob
                }
            })

            const aliceWethBefore = toBN(await web3.eth.getBalance(alice))
            await contracts.borrowerOperations.closeTrove({
                from: alice,
                gasPrice: 0
            })

            const activePoolWeth2 = await contracts.weth.balanceOf(activePool.address)
            console.log("WETH active pool has:", (activePoolWeth2.div(toBN(10 ** 18))).toNumber());

            const activePoolSTETH2 = await contracts.steth.balanceOf(activePool.address)
            console.log("steth activepool has:", (activePoolSTETH2.div(toBN(10 ** 18))).toNumber());

            const aliceUSDE2 = await usdeToken.balanceOf(alice)
            console.log("usde MINTED:", (aliceUSDE2.div(toBN(10 ** 18))).toNumber());

            const aliceSTETH2 = await contracts.steth.balanceOf(alice)
            console.log("steth alice has:", (aliceSTETH2.div(toBN(10 ** 18))).toNumber());

            const aliceWeth2 = toBN(await web3.eth.getBalance(alice))
            console.log("weth alice has:", (aliceWeth2.sub(aliceWethBefore).div(toBN(dec(1, 18)))).toNumber());

            const troveDebtalice2 = await troveManager.getTroveDebt(alice)
            console.log("Trove debt: " + troveDebtalice2)
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