const deploymentHelper = require("../utils/deploymentHelpersUpgrade.js")
const testHelpers = require("../utils/testHelpersUpgrade.js")
const DefaultPoolTester = artifacts.require("./DefaultPoolTester.sol")

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const getDifference = th.getDifference
const mv = testHelpers.MoneyValues
const _dec = (number) => toBN(dec(1, number))

contract('TroveManager - Redistribution reward calculations', async accounts => {
  const [
    owner,
    alice, bob, carol, dennis, erin, freddy,
    A, B, C, D, E
  ] = accounts
  let Owner,
    Alice, Bob, Carol, Dennis, Erin, Freddy,
    signerA, signerB, signerC, signerD, signerE

  let priceFeed
  let priceFeedSTETH
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
  let weth
  let steth

  let contracts

  const getOpenTroveUSDEAmount = async (totalDebt) => th.getOpenTroveUSDEAmount(contracts, totalDebt)
  const getNetBorrowingAmount = async (debtWithFee) => th.getNetBorrowingAmount(contracts, debtWithFee)
  const openTrove = async (params) => th.openTrove(contracts, params)
  const addColl = async (params) => th.addColl(contracts, params)
  const getTroveEntireColl = async (trove) => th.getTroveEntireColl(contracts, trove)
  const getTroveEntireDebt = async (trove) => th.getTroveEntireDebt(contracts, trove)

  beforeEach(async () => {
    contracts = await deploymentHelper.deployERDCore()

    priceFeed = contracts.priceFeedETH
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
    const signers = await ethers.getSigners()
    Owner = signers[0]
    Alice = signers[1]
    Bob = signers[2]
    Carol = signers[3]
    Dennis = signers[4]
    Erin = signers[5]
    Freddy = signers[6]
    signerA = signers[7]
    signerB = signers[8]
    signerC = signers[9]
    signerD = signers[10]
    signerE = signers[11]

    await collateralManager.addCollateral(contracts.steth.address, priceFeedSTETH.address, contracts.eTokenSTETH.address, toBN(dec(1, 18)))
    await priceFeedSTETH.setPrice(dec(1, 18))
  })

  it("redistribution: A, B Open. B Liquidated. C, D Open. D Liquidated. Distributes correct rewards", async () => {
    // A, B open trove
    const {
      collateral: A_coll
    } = await openTrove({
      ICR: toBN(dec(400, 16)),
      signer: Alice,
      extraParams: {
        from: alice
      }
    })
    const {
      collateral: B_coll
    } = await openTrove({
      ICR: toBN(dec(210, 16)),
      signer: Bob,
      extraParams: {
        from: bob
      }
    })
    // let activePoolColl = await activePool.getTotalCollateral()
    // let defaultPoolColl = await defaultPool.getTotalCollateral()
    // let systemColl = await await contracts.borrowerOperations.getEntireSystemColl()
    // console.log('Init: \n')
    // console.log('collValue in active pool: ', (await collateralManager.getTotalValue(activePoolColl[1], activePoolColl[2])).toString())
    // console.log('debt in active pool: ', (await activePool.getUSDEDebt()).toString())
    // console.log('collValue in default pool: ', (await collateralManager.getTotalValue(defaultPoolColl[1], defaultPoolColl[2])).toString())
    // console.log('debt in default pool: ', (await defaultPool.getUSDEDebt()).toString())
    // console.log('TCR: ', (await contracts.collateralManager.getTCR()).toString())
    // console.log('entire system collValue: ', (await collateralManager.getTotalValue(systemColl[0], systemColl[1])).toString())
    // console.log('entire system debt: ', (await contracts.borrowerOperations.getEntireSystemDebt()).toString())

    // bobCTS = (await contracts.troveManager.getCurrentTroveAmounts(bob))
    // console.log('bobICR: ', (await th.getCurrentICR(contracts, bob)).toString())
    // console.log('bobVC: ', (await collateralManager.getTotalValue(bobCTS[1], bobCTS[0])).toString())
    // console.log('bobDebt: ', bobCTS[2].toString())

    // aliceCTS = (await contracts.troveManager.getCurrentTroveAmounts(alice))
    // console.log('aliceICR: ', (await th.getCurrentICR(contracts, alice)).toString())
    // console.log('aliceVC: ', (await collateralManager.getTotalValue(aliceCTS[1], aliceCTS[0])).toString())
    // console.log('aliceDebt: ', aliceCTS[2].toString())


    // console.log('----------- \n\n')
    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // activePoolColl = await activePool.getTotalCollateral()
    // defaultPoolColl = await defaultPool.getTotalCollateral()
    // systemColl = await await contracts.borrowerOperations.getEntireSystemColl()
    // console.log('Price dropped to 100: \n')

    // console.log('collVC in active pool: ', (await collateralManager.getTotalValue(activePoolColl[1], activePoolColl[2])).toString())
    // console.log('debt in active pool: ', (await activePool.getUSDEDebt()).toString())
    // console.log('collVC in default pool: ', (await collateralManager.getTotalValue(defaultPoolColl[1], defaultPoolColl[2])).toString())
    // console.log('debt in default pool: ', (await defaultPool.getUSDEDebt()).toString())
    // console.log('TCR: ', (await contracts.collateralManager.getTCR()).toString())
    // console.log('entire system VC: ', (await collateralManager.getTotalValue(systemColl[0], systemColl[1])).toString())
    // console.log('entire system debt: ', (await contracts.borrowerOperations.getEntireSystemDebt()).toString())

    // bobCTS = (await contracts.troveManager.getCurrentTroveAmounts(bob))
    // console.log('bobICR: ', (await th.getCurrentICR(contracts, bob)).toString())
    // console.log('bobVC: ', (await collateralManager.getTotalValue(bobCTS[1], bobCTS[0])).toString())
    // console.log('bobDebt: ', bobCTS[2].toString())

    // aliceCTS = (await contracts.troveManager.getCurrentTroveAmounts(alice))
    // console.log('aliceICR: ', (await th.getCurrentICR(contracts, alice)).toString())
    // console.log('aliceVC: ', (await collateralManager.getTotalValue(aliceCTS[1], aliceCTS[0])).toString())
    // console.log('aliceDebt: ', aliceCTS[2].toString())
    // console.log('----------- \n\n')
    // Confirm not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // L1: B liquidated
    const txWB = await troveManager.liquidate(bob)
    const txB = await txWB.wait()
    assert.isTrue(txB.status === 1)
    assert.isFalse(await sortedTroves.contains(bob))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))
    // console.log('Liquidated Bob & price back to 200: \n')

    // activePoolColl = await activePool.getTotalCollateral()
    // defaultPoolColl = await defaultPool.getTotalCollateral()
    // systemColl = await await contracts.borrowerOperations.getEntireSystemColl()
    // console.log('Price dropped to 100: \n')

    // console.log('collVC in active pool: ', (await collateralManager.getTotalValue(activePoolColl[1], activePoolColl[2])).toString())
    // console.log('debt in active pool: ', (await activePool.getUSDEDebt()).toString())
    // console.log('collVC in default pool: ', (await collateralManager.getTotalValue(defaultPoolColl[1], defaultPoolColl[2])).toString())
    // console.log('debt in default pool: ', (await defaultPool.getUSDEDebt()).toString())
    // console.log('TCR: ', (await contracts.collateralManager.getTCR()).toString())
    // console.log('entire system VC: ', (await collateralManager.getTotalValue(systemColl[0], systemColl[1])).toString())
    // console.log('entire system debt: ', (await contracts.borrowerOperations.getEntireSystemDebt()).toString())

    // bobCTS = (await contracts.troveManager.getCurrentTroveAmounts(bob))
    // console.log('bobICR: ', (await th.getCurrentICR(contracts, bob)).toString())
    // console.log('bobVC: ', (await collateralManager.getTotalValue(bobCTS[1], bobCTS[0])).toString())
    // console.log('bobDebt: ', bobCTS[2].toString())

    // aliceCTS = (await contracts.troveManager.getCurrentTroveAmounts(alice))
    // console.log('aliceICR: ', (await th.getCurrentICR(contracts, alice)).toString())
    // console.log('aliceVC: ', (await collateralManager.getTotalValue(aliceCTS[1], aliceCTS[0])).toString())
    // console.log('aliceDebt: ', aliceCTS[2].toString())
    // console.log('----------- \n\n')
    // C, D open troves
    const {
      collateral: C_coll
    } = await openTrove({
      ICR: toBN(dec(400, 16)),
      signer: Carol,
      extraParams: {
        from: carol
      }
    })
    const {
      collateral: D_coll
    } = await openTrove({
      ICR: toBN(dec(210, 16)),
      signer: Dennis,
      extraParams: {
        from: dennis
      }
    })

    // const test = (await troveManager.getPendingCollReward(alice))[0][0];
    // console.log('test: ', test.toString())

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Confirm not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // L2: D Liquidated
    const txWD = await troveManager.liquidate(dennis)
    const txD = await txWD.wait()
    assert.isTrue(txD.status === 1)
    assert.isFalse(await sortedTroves.contains(dennis))

    await priceFeed.setPrice(dec(200, 18))

    // Get entire coll of A and C
    const alice_Coll = ((await troveManager.getTroveColls(alice))[0][0]
        .add((await troveManager.getPendingCollReward(alice))[0][0]))
      .toString()
    const carol_Coll = ((await troveManager.getTroveColls(carol))[0][0]
        .add((await troveManager.getPendingCollReward(carol))[0][0]))
      .toString()

    /* Expected collateral:
    A: Alice receives 0.995 ETH from L1, and ~3/5*0.995 ETH from L2.
    expect aliceColl = 2 + 0.995 + 2.995/4.995 * 0.995 = 3.5916 ETH

    C: Carol receives ~2/5 ETH from L2
    expect carolColl = 2 + 2/4.995 * 0.995 = 2.398 ETH

    Total coll = 4 + 2 * 0.995 ETH
    */
    const A_collAfterL1 = A_coll.add(th.applyLiquidationFee(B_coll))
    assert.isAtMost(th.getDifference(alice_Coll, A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(D_coll)).div(A_collAfterL1.add(C_coll)))), Number(dec(150, 20)))
    assert.isAtMost(th.getDifference(carol_Coll, C_coll.add(C_coll.mul(th.applyLiquidationFee(D_coll)).div(A_collAfterL1.add(C_coll)))), Number(dec(100, 20)))

    const entireSystemColl = (await activePool.getCollateralAmount(weth.address)).add(await defaultPool.getCollateralAmount(weth.address)).toString()
    assert.equal(entireSystemColl, A_coll.add(C_coll).add(th.applyLiquidationFee(B_coll.add(D_coll))))

    // check USDE gas compensation
    assert.equal((await usdeToken.balanceOf(owner)).toString(), dec(400, 18))
  })

  it("redistribution: A, B, C Open. C Liquidated. D, E, F Open. F Liquidated. Distributes correct rewards", async () => {
    // A, B C open troves
    const {
      collateral: A_coll
    } = await openTrove({
      ICR: toBN(dec(400, 16)),
      signer: Alice,
      extraParams: {
        from: alice
      }
    })
    const {
      collateral: B_coll
    } = await openTrove({
      ICR: toBN(dec(400, 16)),
      signer: Bob,
      extraParams: {
        from: bob
      }
    })
    const {
      collateral: C_coll
    } = await openTrove({
      ICR: toBN(dec(210, 16)),
      signer: Carol,
      extraParams: {
        from: carol
      }
    })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Confirm not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // L1: C liquidated
    const txWC = await troveManager.liquidate(carol)
    const txC = await txWC.wait()
    assert.isTrue(txC.status === 1)
    assert.isFalse(await sortedTroves.contains(carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // D, E, F open troves
    const {
      collateral: D_coll
    } = await openTrove({
      ICR: toBN(dec(400, 16)),
      signer: Dennis,
      extraParams: {
        from: dennis
      }
    })
    const {
      collateral: E_coll
    } = await openTrove({
      ICR: toBN(dec(400, 16)),
      signer: Erin,
      extraParams: {
        from: erin
      }
    })
    const {
      collateral: F_coll
    } = await openTrove({
      ICR: toBN(dec(210, 16)),
      signer: Freddy,
      extraParams: {
        from: freddy
      }
    })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Confirm not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // L2: F Liquidated
    const txWF = await troveManager.liquidate(freddy)
    const txF = await txWF.wait()
    assert.isTrue(txF.status === 1)
    assert.isFalse(await sortedTroves.contains(freddy))

    // Get entire coll of A, B, D and E
    const alice_Coll = ((await troveManager.getTroveColls(alice))[0][0]
        .add((await troveManager.getPendingCollReward(alice))[0][0]))
      .toString()
    const bob_Coll = ((await troveManager.getTroveColls(bob))[0][0]
        .add((await troveManager.getPendingCollReward(bob))[0][0]))
      .toString()
    const dennis_Coll = ((await troveManager.getTroveColls(dennis))[0][0]
        .add((await troveManager.getPendingCollReward(dennis))[0][0]))
      .toString()
    const erin_Coll = ((await troveManager.getTroveColls(erin))[0][0]
        .add((await troveManager.getPendingCollReward(erin))[0][0]))
      .toString()

    /* Expected collateral:
    A and B receives 1/2 ETH * 0.995 from L1.
    total Coll: 3

    A, B, receive (2.4975)/8.995 * 0.995 ETH from L2.
    
    D, E receive 2/8.995 * 0.995 ETH from L2.

    expect A, B coll  = 2 +  0.4975 + 0.2763  =  ETH
    expect D, E coll  = 2 + 0.2212  =  ETH

    Total coll = 8 (non-liquidated) + 2 * 0.995 (liquidated and redistributed)
    */
    const A_collAfterL1 = A_coll.add(A_coll.mul(th.applyLiquidationFee(C_coll)).div(A_coll.add(B_coll)))
    const B_collAfterL1 = B_coll.add(B_coll.mul(th.applyLiquidationFee(C_coll)).div(A_coll.add(B_coll)))
    const totalBeforeL2 = A_collAfterL1.add(B_collAfterL1).add(D_coll).add(E_coll)
    const expected_A = A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(F_coll)).div(totalBeforeL2))
    const expected_B = B_collAfterL1.add(B_collAfterL1.mul(th.applyLiquidationFee(F_coll)).div(totalBeforeL2))
    const expected_D = D_coll.add(D_coll.mul(th.applyLiquidationFee(F_coll)).div(totalBeforeL2))
    const expected_E = E_coll.add(E_coll.mul(th.applyLiquidationFee(F_coll)).div(totalBeforeL2))
    assert.isAtMost(th.getDifference(alice_Coll, expected_A), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, expected_B), 1000)
    assert.isAtMost(th.getDifference(dennis_Coll, expected_D), 1000)
    assert.isAtMost(th.getDifference(erin_Coll, expected_E), 1000)

    const entireSystemColl = (await activePool.getCollateralAmount(weth.address)).add(await defaultPool.getCollateralAmount(weth.address)).toString()
    assert.equal(entireSystemColl, A_coll.add(B_coll).add(D_coll).add(E_coll).add(th.applyLiquidationFee(C_coll.add(F_coll))))

    // check USDE gas compensation
    assert.equal((await usdeToken.balanceOf(owner)).toString(), dec(400, 18))
  })

  it("redistribution: Sequence of alternate opening/liquidation: final surviving trove has ETH from all previously liquidated troves", async () => {
    // A, B  open troves
    const {
      collateral: A_coll
    } = await openTrove({
      ICR: toBN(dec(400, 16)),
      signer: Alice,
      extraParams: {
        from: alice
      }
    })
    const {
      collateral: B_coll
    } = await openTrove({
      ICR: toBN(dec(400, 16)),
      signer: Bob,
      extraParams: {
        from: bob
      }
    })

    // let activePoolColl = await activePool.getTotalCollateral()
    // let defaultPoolColl = await defaultPool.getTotalCollateral()
    // let systemColl = await await contracts.borrowerOperations.getEntireSystemColl()
    // console.log('Before Price Drop: \n')

    // console.log('collVC in active pool: ', (await collateralManager.getTotalValue(activePoolColl[1], activePoolColl[2])).toString())
    // console.log('total amount in active pool', (await weth.balanceOf(activePool.address)).toString())
    // console.log('debt in active pool: ', (await activePool.getUSDEDebt()).toString())
    // console.log('collVC in default pool: ', (await collateralManager.getTotalValue(defaultPoolColl[1], defaultPoolColl[2])).toString())
    // console.log('total amount in default pool', (await weth.balanceOf(defaultPool.address)).toString())
    // console.log('debt in default pool: ', (await defaultPool.getUSDEDebt()).toString())
    // console.log('TCR: ', (await contracts.collateralManager.getTCR()).toString())
    // console.log('entire system VC: ', (await collateralManager.getTotalValue(systemColl[0], systemColl[1])).toString())
    // console.log('entire system amount: ', (await weth.balanceOf(activePool.address)).add((await weth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system debt: ', (await contracts.borrowerOperations.getEntireSystemDebt()).toString())

    // bobCTS = (await contracts.troveManager.getCurrentTroveAmounts(bob))
    // console.log('bobICR: ', (await th.getCurrentICR(contracts, bob)).toString())
    // console.log('bobVC: ', (await collateralManager.getTotalValue(bobCTS[1], bobCTS[0])).toString())
    // console.log('bobAmount:', bobCTS[1][0].toString())
    // console.log('bobDebt: ', bobCTS[2].toString())

    // aliceCTS = (await contracts.troveManager.getCurrentTroveAmounts(alice))
    // console.log('aliceICR: ', (await th.getCurrentICR(contracts, alice)).toString())
    // console.log('aliceVC: ', (await collateralManager.getTotalValue(aliceCTS[1], aliceCTS[0])).toString())
    // console.log('aliceAmount:', aliceCTS[1][0].toString())
    // console.log('aliceDebt: ', aliceCTS[2].toString())
    // console.log('----------- \n\n')

    // Price drops to 1 $/E
    await priceFeed.setPrice(dec(15, 17))

    // L1: A liquidated
    const txWA = await troveManager.liquidate(alice)
    const txA = await txWA.wait()
    assert.isTrue(txA.status === 1)
    assert.isFalse(await sortedTroves.contains(alice))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // activePoolColl = await activePool.getTotalCollateral()
    // defaultPoolColl = await defaultPool.getTotalCollateral()
    // systemColl = await await contracts.borrowerOperations.getEntireSystemColl()
    // console.log('\n----------- ')
    // console.log('After Liquidating Alice: \n')

    // console.log('collVC in active pool: ', (await collateralManager.getTotalValue(activePoolColl[1], activePoolColl[2])).toString())
    // console.log('total amount in active pool', (await weth.balanceOf(activePool.address)).toString())
    // console.log('debt in active pool: ', (await activePool.getUSDEDebt()).toString())
    // console.log('collVC in default pool: ', (await collateralManager.getTotalValue(defaultPoolColl[1], defaultPoolColl[2])).toString())
    // console.log('total amount in default pool', (await weth.balanceOf(defaultPool.address)).toString())
    // console.log('debt in default pool: ', (await defaultPool.getUSDEDebt()).toString())
    // console.log('TCR: ', (await contracts.collateralManager.getTCR()).toString())
    // console.log('entire system VC: ', (await contracts.borrowerOperations.getEntireSystemColl()).toString())
    // console.log('entire system amount: ', (await weth.balanceOf(activePool.address)).add((await weth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system debt: ', (await collateralManager.getTotalValue(systemColl[0], systemColl[1])).toString())

    // bobCTS = (await contracts.troveManager.getCurrentTroveAmounts(bob))
    // console.log('bobICR: ', (await th.getCurrentICR(contracts, bob)).toString())
    // console.log('bobVC: ', (await collateralManager.getTotalValue(bobCTS[1], bobCTS[0])).toString())
    // console.log('bobAmount:', bobCTS[1][0].toString())
    // console.log('bobDebt: ', bobCTS[2].toString())

    // aliceCTS = (await contracts.troveManager.getCurrentTroveAmounts(alice))
    // console.log('aliceICR: ', (await th.getCurrentICR(contracts, alice)).toString())
    // console.log('aliceVC: ', (await collateralManager.getTotalValue(aliceCTS[1], aliceCTS[0])).toString())
    // //console.log('aliceAmount:', aliceCTS[1][0].toString())
    // console.log('aliceDebt: ', aliceCTS[2].toString())
    // console.log('----------- \n\n')

    // C, opens trove
    const {
      collateral: C_coll
    } = await openTrove({
      ICR: toBN(dec(210, 16)),
      signer: Carol,
      extraParams: {
        from: carol
      }
    })

    // activePoolColl = await activePool.getTotalCollateral()
    // defaultPoolColl = await defaultPool.getTotalCollateral()
    // systemColl = await await contracts.borrowerOperations.getEntireSystemColl()
    // console.log('\n----------- ')
    // console.log('Add carol: \n')

    // console.log('collVC in active pool: ', (await collateralManager.getTotalValue(activePoolColl[1], activePoolColl[2])).toString())
    // console.log('total amount in active pool', (await weth.balanceOf(activePool.address)).toString())
    // console.log('debt in active pool: ', (await activePool.getUSDEDebt()).toString())
    // console.log('collVC in default pool: ', (await collateralManager.getTotalValue(defaultPoolColl[1], defaultPoolColl[2])).toString())
    // console.log('total amount in default pool', (await weth.balanceOf(defaultPool.address)).toString())
    // console.log('debt in default pool: ', (await defaultPool.getUSDEDebt()).toString())
    // console.log('TCR: ', (await contracts.collateralManager.getTCR()).toString())
    // console.log('entire system VC: ', (await contracts.borrowerOperations.getEntireSystemColl()).toString())
    // console.log('entire system amount: ', (await weth.balanceOf(activePool.address)).add((await weth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system debt: ', (await collateralManager.getTotalValue(systemColl[0], systemColl[1])).toString())

    // bobCTS = (await contracts.troveManager.getCurrentTroveAmounts(bob))
    // console.log('bobICR: ', (await th.getCurrentICR(contracts, bob)).toString())
    // console.log('bobVC: ', (await collateralManager.getTotalValue(bobCTS[1], bobCTS[0])).toString())
    // console.log('bobAmount:', bobCTS[1][0].toString())
    // console.log('bobDebt: ', bobCTS[2].toString())

    // carolCTS = (await contracts.troveManager.getCurrentTroveAmounts(carol))
    // console.log('carolICR: ', (await th.getCurrentICR(contracts, carol)).toString())
    // console.log('carolVC: ', (await collateralManager.getTotalValue(carolCTS[1], carolCTS[0])).toString())
    // console.log('carolAmount:', carolCTS[1][0].toString())
    // console.log('carolDebt: ', carolCTS[2].toString())
    // console.log('----------- \n\n')

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(1, 18))

    // L2: B Liquidated
    const txWB = await troveManager.liquidate(bob)
    const txB = await txWB.wait()
    assert.isTrue(txB.status === 1)
    assert.isFalse(await sortedTroves.contains(bob))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))
    // D opens trove
    const {
      collateral: D_coll
    } = await openTrove({
      ICR: toBN(dec(210, 16)),
      signer: Dennis,
      extraParams: {
        from: dennis
      }
    })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(1, 18))

    // L3: C Liquidated
    const txWC = await troveManager.liquidate(carol)
    const txC = await txWC.wait()
    assert.isTrue(txC.status === 1)
    assert.isFalse(await sortedTroves.contains(carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))
    // E opens trove
    const {
      collateral: E_coll
    } = await openTrove({
      ICR: toBN(dec(210, 16)),
      signer: Erin,
      extraParams: {
        from: erin
      }
    })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(1, 18))

    // L4: D Liquidated
    const txWD = await troveManager.liquidate(dennis)
    const txD = await txWD.wait()
    assert.isTrue(txD.status === 1)
    assert.isFalse(await sortedTroves.contains(dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))
    // F opens trove
    const {
      collateral: F_coll
    } = await openTrove({
      ICR: toBN(dec(210, 16)),
      signer: Freddy,
      extraParams: {
        from: freddy
      }
    })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(1, 18))

    // L5: E Liquidated
    const txWE = await troveManager.liquidate(erin)
    const txE = await txWE.wait()
    assert.isTrue(txE.status === 1)
    assert.isFalse(await sortedTroves.contains(erin))

    // Get entire coll of A, B, D, E and F
    aliceCTS = (await contracts.troveManager.getCurrentTroveAmounts(alice))
    const alice_Coll = (await collateralManager.getTotalValue(aliceCTS[1], aliceCTS[0])).toString()

    bobCTS = (await contracts.troveManager.getCurrentTroveAmounts(bob))
    const bob_Coll = (await collateralManager.getTotalValue(bobCTS[1], bobCTS[0])).toString()

    carolCTS = (await contracts.troveManager.getCurrentTroveAmounts(carol))
    const carol_Coll = (await collateralManager.getTotalValue(carolCTS[1], carolCTS[0])).toString()

    dennisCTS = (await contracts.troveManager.getCurrentTroveAmounts(dennis))
    const dennis_Coll = (await collateralManager.getTotalValue(dennisCTS[1], dennisCTS[0])).toString()

    erinCTS = (await contracts.troveManager.getCurrentTroveAmounts(erin))
    const erin_Coll = (await collateralManager.getTotalValue(erinCTS[1], erinCTS[0])).toString()

    const freddy_rawColl = (await troveManager.getTroveColls(freddy))[0][0].toString()
    const freddy_ETHReward = ((await troveManager.getPendingCollReward(freddy))[0][0]).toString()

    /* Expected collateral:
     A-E should have been liquidated
     trove F should have acquired all ETH in the system: 1 ETH initial coll, and 0.995^5+0.995^4+0.995^3+0.995^2+0.995 from rewards = 5.925 ETH
    */
    assert.isAtMost(th.getDifference(alice_Coll, '0'), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, '0'), 1000)
    assert.isAtMost(th.getDifference(carol_Coll, '0'), 1000)
    assert.isAtMost(th.getDifference(dennis_Coll, '0'), 1000)
    assert.isAtMost(th.getDifference(erin_Coll, '0'), 1000)

    assert.isAtMost(th.getDifference(freddy_rawColl, F_coll), 1000)
    const gainedETH = th.applyLiquidationFee(
      E_coll.add(th.applyLiquidationFee(
        D_coll.add(th.applyLiquidationFee(
          C_coll.add(th.applyLiquidationFee(
            B_coll.add(th.applyLiquidationFee(A_coll))
          ))
        ))
      ))
    )
    assert.isAtMost(th.getDifference(freddy_ETHReward, gainedETH), 1000)

    const entireSystemColl = (await activePool.getCollateralAmount(weth.address)).add(await defaultPool.getCollateralAmount(weth.address)).toString()
    assert.isAtMost(th.getDifference(entireSystemColl, F_coll.add(gainedETH)), 1000)

    // check USDE gas compensation
    assert.equal((await usdeToken.balanceOf(owner)).toString(), dec(1000, 18))
  })

  // ---Trove adds collateral --- 

  // Test based on scenario in: https://docs.google.com/spreadsheets/d/1F5p3nZy749K5jwO-bwJeTsRoY7ewMfWIQ3QHtokxqzo/edit?usp=sharing
  it("redistribution: A,B,C,D,E open. Liq(A). B adds coll. Liq(C). B and D have correct coll and debt", async () => {
    // A, B, C, D, E open troves
    const {
      collateral: A_coll
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(100000, 18),
      signer: signerA,
      extraParams: {
        from: A
      }
    })
    const {
      collateral: B_coll
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(100000, 18),
      signer: signerB,
      extraParams: {
        from: B
      }
    })
    const {
      collateral: C_coll
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(100000, 18),
      signer: signerC,
      extraParams: {
        from: C
      }
    })
    const {
      collateral: D_coll
    } = await openTrove({
      ICR: toBN(dec(20000, 16)),
      extraUSDEAmount: dec(10, 18),
      signer: signerD,
      extraParams: {
        from: D
      }
    })
    const {
      collateral: E_coll
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(100000, 18),
      signer: signerE,
      extraParams: {
        from: E
      }
    })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate A
    // console.log(`ICR A: ${await troveManager.getCurrentICR(A, price)}`)
    const txWA = await troveManager.liquidate(A)
    const txA = await txWA.wait()
    assert.isTrue(txA.status === 1)
    assert.isFalse(await sortedTroves.contains(A))

    // Check entireColl for each trove:
    const B_entireColl_1 = (await getTroveEntireColl(B))[0]
    const C_entireColl_1 = (await getTroveEntireColl(C))[0]
    const D_entireColl_1 = (await getTroveEntireColl(D))[0]
    const E_entireColl_1 = (await getTroveEntireColl(E))[0]

    const totalCollAfterL1 = B_coll.add(C_coll).add(D_coll).add(E_coll)
    const B_collAfterL1 = B_coll.add(th.applyLiquidationFee(A_coll).mul(B_coll).div(totalCollAfterL1))
    const C_collAfterL1 = C_coll.add(th.applyLiquidationFee(A_coll).mul(C_coll).div(totalCollAfterL1))
    const D_collAfterL1 = D_coll.add(th.applyLiquidationFee(A_coll).mul(D_coll).div(totalCollAfterL1))
    const E_collAfterL1 = E_coll.add(th.applyLiquidationFee(A_coll).mul(E_coll).div(totalCollAfterL1))
    assert.isAtMost(getDifference(B_entireColl_1, B_collAfterL1), 1e8)
    assert.isAtMost(getDifference(C_entireColl_1, C_collAfterL1), 1e8)
    assert.isAtMost(getDifference(D_entireColl_1, D_collAfterL1), 1e8)
    assert.isAtMost(getDifference(E_entireColl_1, E_collAfterL1), 1e8)

    // Bob adds 130 ETH to his trove
    const addedColl1 = toBN(dec(130, 'ether'))
    //addColl({collateralAmount: addedColl1, account: B})
    await borrowerOperations.connect(signerB).addColl([], [], B, B, {
      from: B,
      value: addedColl1
    })

    // Liquidate C
    const txWC = await troveManager.liquidate(C)
    const txC = await txWC.wait()
    assert.isTrue(txC.status === 1)
    assert.isFalse(await sortedTroves.contains(C))

    const B_entireColl_2 = (await getTroveEntireColl(B))[0]
    const D_entireColl_2 = (await getTroveEntireColl(D))[0]
    const E_entireColl_2 = (await getTroveEntireColl(E))[0]

    const totalCollAfterL2 = B_collAfterL1.add(addedColl1).add(D_collAfterL1).add(E_collAfterL1)
    const B_collAfterL2 = B_collAfterL1.add(addedColl1).add(th.applyLiquidationFee(C_collAfterL1).mul(B_collAfterL1.add(addedColl1)).div(totalCollAfterL2))
    const D_collAfterL2 = D_collAfterL1.add(th.applyLiquidationFee(C_collAfterL1).mul(D_collAfterL1).div(totalCollAfterL2))
    const E_collAfterL2 = E_collAfterL1.add(th.applyLiquidationFee(C_collAfterL1).mul(E_collAfterL1).div(totalCollAfterL2))
    // console.log(`D_entireColl_2: ${D_entireColl_2}`)
    // console.log(`E_entireColl_2: ${E_entireColl_2}`)
    assert.isAtMost(getDifference(B_entireColl_2, B_collAfterL2), 1e8)
    assert.isAtMost(getDifference(D_entireColl_2, D_collAfterL2), 1e8)
    assert.isAtMost(getDifference(E_entireColl_2, E_collAfterL2), 1e8)

    // Bob adds 340 ETH to his trove
    const addedColl2 = toBN(dec(340, 'ether'))
    await borrowerOperations.connect(signerB).addColl([], [], B, B, {
      from: B,
      value: addedColl2
    })
    // Liquidate E
    const txWE = await troveManager.liquidate(E)
    const txE = await txWE.wait()
    assert.isTrue(txE.status === 1)
    assert.isFalse(await sortedTroves.contains(E))

    const totalCollAfterL3 = B_collAfterL2.add(addedColl2).add(D_collAfterL2)
    const B_collAfterL3 = B_collAfterL2.add(addedColl2).add(th.applyLiquidationFee(E_collAfterL2).mul(B_collAfterL2.add(addedColl2)).div(totalCollAfterL3))
    const D_collAfterL3 = D_collAfterL2.add(th.applyLiquidationFee(E_collAfterL2).mul(D_collAfterL2).div(totalCollAfterL3))

    const B_entireColl_3 = (await getTroveEntireColl(B))[0]
    const D_entireColl_3 = (await getTroveEntireColl(D))[0]

    const diff_entireColl_B = getDifference(B_entireColl_3, B_collAfterL3)
    const diff_entireColl_D = getDifference(D_entireColl_3, D_collAfterL3)

    assert.isAtMost(diff_entireColl_B, 1e8)
    assert.isAtMost(diff_entireColl_D, 1e8)
  })

  // Test based on scenario in: https://docs.google.com/spreadsheets/d/1F5p3nZy749K5jwO-bwJeTsRoY7ewMfWIQ3QHtokxqzo/edit?usp=sharing
  it("redistribution: A,B,C,D open. Liq(A). B adds coll. Liq(C). B and D have correct coll and debt", async () => {
    // A, B, C, D, E open troves
    const {
      collateral: A_coll
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(100000, 18),
      signer: signerA,
      extraParams: {
        from: A
      }
    })
    const {
      collateral: B_coll
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(100000, 18),
      signer: signerB,
      extraParams: {
        from: B
      }
    })
    const {
      collateral: C_coll
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(100000, 18),
      signer: signerC,
      extraParams: {
        from: C
      }
    })
    const {
      collateral: D_coll
    } = await openTrove({
      ICR: toBN(dec(20000, 16)),
      extraUSDEAmount: dec(10, 18),
      signer: signerD,
      extraParams: {
        from: D
      }
    })
    const {
      collateral: E_coll
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(100000, 18),
      signer: signerE,
      extraParams: {
        from: E
      }
    })

    // console.log(A_coll.toString())

    bobCTS = (await contracts.troveManager.getCurrentTroveAmounts(A))
    // console.log('bobICR: ', (await th.getCurrentICR(contracts, A)).toString())
    // console.log('bobVC: ', (await collateralManager.getTotalValue(bobCTS[1], bobCTS[0])).toString())
    // console.log('bobAmount:', bobCTS[1][0].toString())
    // console.log('bobDebt: ', bobCTS[2].toString())
    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Check entireColl for each trove:

    const A_entireColl_0 = (await getTroveEntireColl(A))[0]
    const B_entireColl_0 = (await getTroveEntireColl(B))[0]
    const C_entireColl_0 = (await getTroveEntireColl(C))[0]
    const D_entireColl_0 = (await getTroveEntireColl(D))[0]
    const E_entireColl_0 = (await getTroveEntireColl(E))[0]

    // entireSystemColl, excluding A 
    const denominatorColl_1 = (await weth.balanceOf(activePool.address)).add((await weth.balanceOf(defaultPool.address))).sub(A_entireColl_0)

    // Liquidate A
    // console.log(`ICR A: ${await troveManager.getCurrentICR(A, price)}`)
    const txWA = await troveManager.liquidate(A)
    const txA = await txWA.wait()
    assert.isTrue(txA.status === 1)
    assert.isFalse(await sortedTroves.contains(A))

    const A_collRedistribution = A_entireColl_0.mul(toBN(995)).div(toBN(1000)) // remove the gas comp

    // console.log(`A_collRedistribution: ${A_collRedistribution}`)
    // Check accumulated ETH gain for each trove
    const B_ETHGain_1 = (await troveManager.getPendingCollReward(B))[0][0]
    const C_ETHGain_1 = (await troveManager.getPendingCollReward(C))[0][0]
    const D_ETHGain_1 = (await troveManager.getPendingCollReward(D))[0][0]
    const E_ETHGain_1 = (await troveManager.getPendingCollReward(E))[0][0]

    // Check gains are what we'd expect from a distribution proportional to each trove's entire coll
    const B_expectedPendingETH_1 = A_collRedistribution.mul(B_entireColl_0).div(denominatorColl_1)
    const C_expectedPendingETH_1 = A_collRedistribution.mul(C_entireColl_0).div(denominatorColl_1)
    const D_expectedPendingETH_1 = A_collRedistribution.mul(D_entireColl_0).div(denominatorColl_1)
    const E_expectedPendingETH_1 = A_collRedistribution.mul(E_entireColl_0).div(denominatorColl_1)

    assert.isAtMost(getDifference(B_expectedPendingETH_1, B_ETHGain_1), 1e8)
    assert.isAtMost(getDifference(C_expectedPendingETH_1, C_ETHGain_1), 1e8)
    assert.isAtMost(getDifference(D_expectedPendingETH_1, D_ETHGain_1), 1e8)
    assert.isAtMost(getDifference(E_expectedPendingETH_1, E_ETHGain_1), 1e8)

    // // Bob adds 130 ETH to his trove
    await borrowerOperations.connect(signerB).addColl([], [], B, B, {
      from: B,
      value: dec(130, 'ether')
    })

    // Check entireColl for each trove
    const B_entireColl_1 = (await getTroveEntireColl(B))[0]
    const C_entireColl_1 = (await getTroveEntireColl(C))[0]
    const D_entireColl_1 = (await getTroveEntireColl(D))[0]
    const E_entireColl_1 = (await getTroveEntireColl(E))[0]

    // entireSystemColl, excluding C
    const denominatorColl_2 = (await weth.balanceOf(activePool.address)).add((await weth.balanceOf(defaultPool.address))).sub(C_entireColl_1)

    // Liquidate C
    const txWC = await troveManager.liquidate(C)
    const txC = await txWC.wait()
    assert.isTrue(txC.status === 1)
    assert.isFalse(await sortedTroves.contains(C))

    const C_collRedistribution = C_entireColl_1.mul(toBN(995)).div(toBN(1000)) // remove the gas comp
    // console.log(`C_collRedistribution: ${C_collRedistribution}`)

    const B_ETHGain_2 = (await troveManager.getPendingCollReward(B))[0][0]
    const D_ETHGain_2 = (await troveManager.getPendingCollReward(D))[0][0]
    const E_ETHGain_2 = (await troveManager.getPendingCollReward(E))[0][0]

    // Since B topped up, he has no previous pending ETH gain
    const B_expectedPendingETH_2 = C_collRedistribution.mul(B_entireColl_1).div(denominatorColl_2)

    // D & E's accumulated pending ETH gain includes their previous gain
    const D_expectedPendingETH_2 = C_collRedistribution.mul(D_entireColl_1).div(denominatorColl_2)
      .add(D_expectedPendingETH_1)

    const E_expectedPendingETH_2 = C_collRedistribution.mul(E_entireColl_1).div(denominatorColl_2)
      .add(E_expectedPendingETH_1)

    assert.isAtMost(getDifference(B_expectedPendingETH_2, B_ETHGain_2), 1e8)
    assert.isAtMost(getDifference(D_expectedPendingETH_2, D_ETHGain_2), 1e8)
    assert.isAtMost(getDifference(E_expectedPendingETH_2, E_ETHGain_2), 1e8)

    // // Bob adds 340 ETH to his trove
    await borrowerOperations.connect(signerB).addColl([], [], B, B, {
      from: B,
      value: dec(340, 'ether')
    })

    // Check entireColl for each trove
    const B_entireColl_2 = (await getTroveEntireColl(B))[0]
    const D_entireColl_2 = (await getTroveEntireColl(D))[0]
    const E_entireColl_2 = (await getTroveEntireColl(E))[0]

    // entireSystemColl, excluding E
    const denominatorColl_3 = (await weth.balanceOf(activePool.address)).add((await weth.balanceOf(defaultPool.address))).sub(E_entireColl_2)

    // Liquidate E
    const txWE = await troveManager.liquidate(E)
    const txE = await txWE.wait()
    assert.isTrue(txE.status === 1)
    assert.isFalse(await sortedTroves.contains(E))

    const E_collRedistribution = E_entireColl_2.mul(toBN(995)).div(toBN(1000)) // remove the gas comp
    // console.log(`E_collRedistribution: ${E_collRedistribution}`)

    const B_ETHGain_3 = (await troveManager.getPendingCollReward(B))[0][0]
    const D_ETHGain_3 = (await troveManager.getPendingCollReward(D))[0][0]

    // Since B topped up, he has no previous pending ETH gain
    const B_expectedPendingETH_3 = E_collRedistribution.mul(B_entireColl_2).div(denominatorColl_3)

    // D'S accumulated pending ETH gain includes their previous gain
    const D_expectedPendingETH_3 = E_collRedistribution.mul(D_entireColl_2).div(denominatorColl_3)
      .add(D_expectedPendingETH_2)

    assert.isAtMost(getDifference(B_expectedPendingETH_3, B_ETHGain_3), 1e8)
    assert.isAtMost(getDifference(D_expectedPendingETH_3, D_ETHGain_3), 1e8)
  })

  it("redistribution: A,B,C Open. Liq(C). B adds coll. Liq(A). B acquires all coll and debt", async () => {
    // A, B, C open troves
    const {
      collateral: A_coll,
      totalDebt: A_totalDebt
    } = await openTrove({
      ICR: toBN(dec(400, 16)),
      signer: Alice,
      extraParams: {
        from: alice
      }
    })
    const {
      collateral: B_coll,
      totalDebt: B_totalDebt
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(110, 18),
      signer: Bob,
      extraParams: {
        from: bob
      }
    })
    const {
      collateral: C_coll,
      totalDebt: C_totalDebt
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(110, 18),
      signer: Carol,
      extraParams: {
        from: carol
      }
    })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Carol
    const txWC = await troveManager.liquidate(carol)
    const txC = await txWC.wait()
    assert.isTrue(txC.status === 1)
    assert.isFalse(await sortedTroves.contains(carol))
    const B_debt_after_carol = await getTroveEntireDebt(bob)
    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    //Bob adds ETH to his trove
    const addedColl = toBN(dec(1, 'ether'))
    await borrowerOperations.connect(Bob).addColl([], [], bob, bob, {
      from: bob,
      value: addedColl
    })

    // Alice withdraws USDE
    await borrowerOperations.connect(Alice).withdrawUSDE(await getNetBorrowingAmount(A_totalDebt), alice, alice, th._100pct, {
      from: alice
    })
    const A_debt_after_withdraw = await getTroveEntireDebt(alice)
    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Alice
    const txWA = await troveManager.liquidate(alice)
    const txA = await txWA.wait()
    assert.isTrue(txA.status === 1)
    assert.isFalse(await sortedTroves.contains(alice))

    // Expect Bob now holds all Ether and USDEDebt in the system: 2 + 0.4975+0.4975*0.995+0.995 Ether and 110*3 USDE (10 each for gas compensation)
    const bob_Coll = (await getTroveEntireColl(bob))[0].toString()

    const bob_USDEDebt = (await getTroveEntireDebt(bob)).toString()

    const expected_B_coll = B_coll
      .add(addedColl)
      .add(th.applyLiquidationFee(A_coll))
      .add(th.applyLiquidationFee(C_coll).mul(B_coll).div(A_coll.add(B_coll)))
      .add(th.applyLiquidationFee(th.applyLiquidationFee(C_coll).mul(A_coll).div(A_coll.add(B_coll))))
    assert.isAtMost(th.getDifference(bob_Coll, expected_B_coll), 1000)
    assert.isAtMost(th.getDifference(bob_USDEDebt, A_debt_after_withdraw.add(B_debt_after_carol)), _dec(14))
  })

  it("redistribution: A,B,C Open. Liq(C). B tops up coll. D Opens. Liq(D). Distributes correct rewards.", async () => {
    // A, B, C open troves
    const {
      collateral: A_coll,
      totalDebt: A_totalDebt
    } = await openTrove({
      ICR: toBN(dec(400, 16)),
      signer: Alice,
      extraParams: {
        from: alice
      }
    })
    const {
      collateral: B_coll,
      totalDebt: B_totalDebt
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(110, 18),
      signer: Bob,
      extraParams: {
        from: bob
      }
    })
    const {
      collateral: C_coll,
      totalDebt: C_totalDebt
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(110, 18),
      signer: Carol,
      extraParams: {
        from: carol
      }
    })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Carol
    const txWC = await troveManager.liquidate(carol)
    const txC = await txWC.wait()
    assert.isTrue(txC.status === 1)
    assert.isFalse(await sortedTroves.contains(carol))
    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    //Bob adds ETH to his trove
    const addedColl = toBN(dec(1, 'ether'))
    await borrowerOperations.connect(Bob).addColl([], [], bob, bob, {
      from: bob,
      value: addedColl
    })

    // D opens trove
    const {
      collateral: D_coll,
      totalDebt: D_totalDebt
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(110, 18),
      signer: Dennis,
      extraParams: {
        from: dennis
      }
    })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate D
    const txWA = await troveManager.liquidate(dennis)
    const txA = await txWA.wait()
    assert.isTrue(txA.status === 1)
    assert.isFalse(await sortedTroves.contains(dennis))
    /* Bob rewards:
     L1: 1/2*0.995 ETH, 55 USDE
     L2: (2.4975/3.995)*0.995 = 0.622 ETH , 110*(2.4975/3.995)= 68.77 USDEDebt

    coll: 3.1195 ETH
    debt: 233.77 USDEDebt

     Alice rewards:
    L1 1/2*0.995 ETH, 55 USDE
    L2 (1.4975/3.995)*0.995 = 0.3730 ETH, 110*(1.4975/3.995) = 41.23 USDEDebt

    coll: 1.8705 ETH
    debt: 146.23 USDEDebt

    totalColl: 4.99 ETH
    totalDebt 380 USDE (includes 50 each for gas compensation)
    */
    const bob_Coll = (await getTroveEntireColl(bob))[0].toString()
    const bob_USDEDebt = (await getTroveEntireDebt(bob)).toString()

    const alice_Coll = (await getTroveEntireColl(alice))[0].toString()
    const alice_USDEDebt = (await getTroveEntireDebt(alice)).toString()

    const totalCollAfterL1 = A_coll.add(B_coll).add(addedColl).add(th.applyLiquidationFee(C_coll))
    const B_collAfterL1 = B_coll.add(B_coll.mul(th.applyLiquidationFee(C_coll)).div(A_coll.add(B_coll))).add(addedColl)
    const expected_B_coll = B_collAfterL1.add(B_collAfterL1.mul(th.applyLiquidationFee(D_coll)).div(totalCollAfterL1))
    const expected_B_debt = B_totalDebt
      .add(B_coll.mul(C_totalDebt).div(A_coll.add(B_coll)))
      .add(B_collAfterL1.mul(D_totalDebt).div(totalCollAfterL1))

    assert.isAtMost(th.getDifference(bob_Coll, expected_B_coll), 1000)
    assert.isAtMost(th.getDifference(bob_USDEDebt, expected_B_debt), _dec(14))

    const A_collAfterL1 = A_coll.add(A_coll.mul(th.applyLiquidationFee(C_coll)).div(A_coll.add(B_coll)))
    const expected_A_coll = A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(D_coll)).div(totalCollAfterL1))
    const expected_A_debt = A_totalDebt
      .add(A_coll.mul(C_totalDebt).div(A_coll.add(B_coll)))
      .add(A_collAfterL1.mul(D_totalDebt).div(totalCollAfterL1))
    assert.isAtMost(th.getDifference(alice_Coll, expected_A_coll), 1000)
    assert.isAtMost(th.getDifference(alice_USDEDebt, expected_A_debt), _dec(14))

    // check USDE gas compensation
    assert.equal((await usdeToken.balanceOf(owner)).toString(), dec(400, 18))
  })

  it("redistribution: Trove with the majority stake tops up. A,B,C, D open. Liq(D). C tops up. E Enters, Liq(E). Distributes correct rewards", async () => {
    const _998_Ether = toBN('998000000000000000000')
    // A, B, C, D open troves
    const {
      collateral: A_coll
    } = await openTrove({
      ICR: toBN(dec(400, 16)),
      signer: Alice,
      extraParams: {
        from: alice
      }
    })
    const {
      collateral: B_coll
    } = await openTrove({
      ICR: toBN(dec(400, 16)),
      extraUSDEAmount: dec(110, 18),
      signer: Bob,
      extraParams: {
        from: bob
      }
    })
    const {
      collateral: C_coll
    } = await openTrove({
      extraUSDEAmount: dec(110, 18),
      signer: Carol,
      extraParams: {
        from: carol,
        value: _998_Ether
      }
    })
    const {
      collateral: D_coll
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(110, 18),
      signer: Dennis,
      extraParams: {
        from: dennis,
        value: dec(1000, 'ether')
      }
    })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Dennis
    const txWD = await troveManager.liquidate(dennis)
    const txD = await txWD.wait()
    assert.isTrue(txD.status === 1)
    assert.isFalse(await sortedTroves.contains(dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // Expected rewards:  alice: 1 ETH, bob: 1 ETH, carol: 998 ETH
    const alice_ETHReward_1 = (await troveManager.getPendingCollReward(alice))[0][0]
    const bob_ETHReward_1 = (await troveManager.getPendingCollReward(bob))[0][0]
    const carol_ETHReward_1 = (await troveManager.getPendingCollReward(carol))[0][0]

    //Expect 1000 + 1000*0.995 ETH in system now
    const entireSystemColl_1 = (await activePool.getCollateralAmount(weth.address)).add(await defaultPool.getCollateralAmount(weth.address)).toString()
    assert.equal(entireSystemColl_1, A_coll.add(B_coll).add(C_coll).add(th.applyLiquidationFee(D_coll)))

    const totalColl = A_coll.add(B_coll).add(C_coll)
    th.assertIsApproximatelyEqual(alice_ETHReward_1.toString(), th.applyLiquidationFee(D_coll).mul(A_coll).div(totalColl))
    th.assertIsApproximatelyEqual(bob_ETHReward_1.toString(), th.applyLiquidationFee(D_coll).mul(B_coll).div(totalColl))
    th.assertIsApproximatelyEqual(carol_ETHReward_1.toString(), th.applyLiquidationFee(D_coll).mul(C_coll).div(totalColl))

    //Carol adds 1 ETH to her trove, brings it to 1992.01 total coll
    const C_addedColl = toBN(dec(1, 'ether'))
    await borrowerOperations.connect(Carol).addColl([], [], carol, carol, {
      from: carol,
      value: dec(1, 'ether')
    })

    //Expect 1996 ETH in system now
    const entireSystemColl_2 = (await activePool.getCollateralAmount(weth.address)).add(await defaultPool.getCollateralAmount(weth.address))
    th.assertIsApproximatelyEqual(entireSystemColl_2, totalColl.add(th.applyLiquidationFee(D_coll)).add(C_addedColl))

    // E opens with another 1996 ETH
    const {
      collateral: E_coll
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      signer: Erin,
      extraParams: {
        from: erin,
        value: entireSystemColl_2
      }
    })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Erin
    const txWE = await troveManager.liquidate(erin)
    const txE = await txWE.wait()
    assert.isTrue(txE.status === 1)
    assert.isFalse(await sortedTroves.contains(erin))

    /* Expected ETH rewards: 
     Carol = 1992.01/1996 * 1996*0.995 = 1982.05 ETH
     Alice = 1.995/1996 * 1996*0.995 = 1.985025 ETH
     Bob = 1.995/1996 * 1996*0.995 = 1.985025 ETH

    therefore, expected total collateral:

    Carol = 1991.01 + 1991.01 = 3974.06
    Alice = 1.995 + 1.985025 = 3.980025 ETH
    Bob = 1.995 + 1.985025 = 3.980025 ETH

    total = 3982.02 ETH
    */

    const alice_Coll = ((await troveManager.getTroveColls(alice))[0][0]
        .add((await troveManager.getPendingCollReward(alice))[0][0]))
      .toString()

    const bob_Coll = ((await troveManager.getTroveColls(bob))[0][0]
        .add((await troveManager.getPendingCollReward(bob))[0][0]))
      .toString()

    const carol_Coll = ((await troveManager.getTroveColls(carol))[0][0]
        .add((await troveManager.getPendingCollReward(carol))[0][0]))
      .toString()

    const totalCollAfterL1 = A_coll.add(B_coll).add(C_coll).add(th.applyLiquidationFee(D_coll)).add(C_addedColl)
    const A_collAfterL1 = A_coll.add(A_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll)))
    const expected_A_coll = A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))
    const B_collAfterL1 = B_coll.add(B_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll)))
    const expected_B_coll = B_collAfterL1.add(B_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))
    const C_collAfterL1 = C_coll.add(C_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll))).add(C_addedColl)
    const expected_C_coll = C_collAfterL1.add(C_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))

    assert.isAtMost(th.getDifference(alice_Coll, expected_A_coll), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, expected_B_coll), 1000)
    assert.isAtMost(th.getDifference(carol_Coll, expected_C_coll), 1000)

    //Expect 3982.02 ETH in system now
    const entireSystemColl_3 = (await activePool.getCollateralAmount(weth.address)).add(await defaultPool.getCollateralAmount(weth.address)).toString()
    th.assertIsApproximatelyEqual(entireSystemColl_3, totalCollAfterL1.add(th.applyLiquidationFee(E_coll)))

    // check USDE gas compensation
    th.assertIsApproximatelyEqual((await usdeToken.balanceOf(owner)).toString(), dec(400, 18))
  })

  it("redistribution: Trove with the majority stake tops up. A,B,C, D open. Liq(D). A, B, C top up. E Enters, Liq(E). Distributes correct rewards", async () => {
    const _998_Ether = toBN('998000000000000000000')
    // A, B, C open troves
    const {
      collateral: A_coll
    } = await openTrove({
      ICR: toBN(dec(400, 16)),
      signer: Alice,
      extraParams: {
        from: alice
      }
    })
    const {
      collateral: B_coll
    } = await openTrove({
      ICR: toBN(dec(400, 16)),
      extraUSDEAmount: dec(110, 18),
      signer: Bob,
      extraParams: {
        from: bob
      }
    })
    const {
      collateral: C_coll
    } = await openTrove({
      extraUSDEAmount: dec(110, 18),
      signer: Carol,
      extraParams: {
        from: carol,
        value: _998_Ether
      }
    })
    const {
      collateral: D_coll
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(110, 18),
      signer: Dennis,
      extraParams: {
        from: dennis,
        value: dec(1000, 'ether')
      }
    })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Dennis
    const txWD = await troveManager.liquidate(dennis)
    const txD = await txWD.wait()
    assert.isTrue(txD.status === 1)
    assert.isFalse(await sortedTroves.contains(dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // Expected rewards:  alice: 1 ETH, bob: 1 ETH, carol: 998 ETH (*0.995)
    const alice_ETHReward_1 = (await troveManager.getPendingCollReward(alice))[0][0]
    const bob_ETHReward_1 = (await troveManager.getPendingCollReward(bob))[0][0]
    const carol_ETHReward_1 = (await troveManager.getPendingCollReward(carol))[0][0]

    //Expect 1995 ETH in system now
    const entireSystemColl_1 = (await activePool.getCollateralAmount(weth.address)).add(await defaultPool.getCollateralAmount(weth.address)).toString()
    assert.equal(entireSystemColl_1, A_coll.add(B_coll).add(C_coll).add(th.applyLiquidationFee(D_coll)))

    const totalColl = A_coll.add(B_coll).add(C_coll)
    th.assertIsApproximatelyEqual(alice_ETHReward_1.toString(), th.applyLiquidationFee(D_coll).mul(A_coll).div(totalColl))
    th.assertIsApproximatelyEqual(bob_ETHReward_1.toString(), th.applyLiquidationFee(D_coll).mul(B_coll).div(totalColl))
    th.assertIsApproximatelyEqual(carol_ETHReward_1.toString(), th.applyLiquidationFee(D_coll).mul(C_coll).div(totalColl))

    /* Alice, Bob, Carol each adds 1 ETH to their troves, 
    bringing them to 2.995, 2.995, 1992.01 total coll each. */

    const addedColl = toBN(dec(1, 'ether'))
    await borrowerOperations.connect(Alice).addColl([], [], alice, alice, {
      from: alice,
      value: addedColl
    })

    await borrowerOperations.connect(Bob).addColl([], [], bob, bob, {
      from: bob,
      value: addedColl
    })

    await borrowerOperations.connect(Carol).addColl([], [], carol, carol, {
      from: carol,
      value: addedColl
    })

    //Expect 1998 ETH in system now
    const entireSystemColl_2 = (await activePool.getCollateralAmount(weth.address)).add(await defaultPool.getCollateralAmount(weth.address)).toString()
    th.assertIsApproximatelyEqual(entireSystemColl_2, totalColl.add(th.applyLiquidationFee(D_coll)).add(addedColl.mul(toBN(3))))

    // E opens with another 1998 ETH
    const {
      collateral: E_coll
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      signer: Erin,
      extraParams: {
        from: erin,
        value: entireSystemColl_2
      }
    })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Erin
    const txWE = await troveManager.liquidate(erin)
    const txE = await txWE.wait()
    assert.isTrue(txE.status === 1)
    assert.isFalse(await sortedTroves.contains(erin))

    /* Expected ETH rewards: 
     Carol = 1992.01/1998 * 1998*0.995 = 1982.04995 ETH
     Alice = 2.995/1998 * 1998*0.995 = 2.980025 ETH
     Bob = 2.995/1998 * 1998*0.995 = 2.980025 ETH

    therefore, expected total collateral:

    Carol = 1992.01 + 1982.04995 = 3974.05995
    Alice = 2.995 + 2.980025 = 5.975025 ETH
    Bob = 2.995 + 2.980025 = 5.975025 ETH

    total = 3986.01 ETH
    */

    const alice_Coll = ((await troveManager.getTroveColls(alice))[0][0]
        .add((await troveManager.getPendingCollReward(alice))[0][0]))
      .toString()

    const bob_Coll = ((await troveManager.getTroveColls(bob))[0][0]
        .add((await troveManager.getPendingCollReward(bob))[0][0]))
      .toString()

    const carol_Coll = ((await troveManager.getTroveColls(carol))[0][0]
        .add((await troveManager.getPendingCollReward(carol))[0][0]))
      .toString()

    const totalCollAfterL1 = A_coll.add(B_coll).add(C_coll).add(th.applyLiquidationFee(D_coll)).add(addedColl.mul(toBN(3)))
    const A_collAfterL1 = A_coll.add(A_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll))).add(addedColl)
    const expected_A_coll = A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))
    const B_collAfterL1 = B_coll.add(B_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll))).add(addedColl)
    const expected_B_coll = B_collAfterL1.add(B_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))
    const C_collAfterL1 = C_coll.add(C_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll))).add(addedColl)
    const expected_C_coll = C_collAfterL1.add(C_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))

    assert.isAtMost(th.getDifference(alice_Coll, expected_A_coll), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, expected_B_coll), 1000)
    assert.isAtMost(th.getDifference(carol_Coll, expected_C_coll), 1000)

    //Expect 3986.01 ETH in system now
    const entireSystemColl_3 = (await activePool.getCollateralAmount(weth.address)).add(await defaultPool.getCollateralAmount(weth.address))
    th.assertIsApproximatelyEqual(entireSystemColl_3, totalCollAfterL1.add(th.applyLiquidationFee(E_coll)))

    // check USDE gas compensation
    th.assertIsApproximatelyEqual((await usdeToken.balanceOf(owner)).toString(), dec(400, 18))
  })

  // --- Trove withdraws collateral ---

  it("redistribution: A,B,C Open. Liq(C). B withdraws coll. Liq(A). B acquires all coll and debt", async () => {
    // A, B, C open troves
    const {
      collateral: A_coll,
      totalDebt: A_totalDebt
    } = await openTrove({
      ICR: toBN(dec(400, 16)),
      signer: Alice,
      extraParams: {
        from: alice
      }
    })
    const {
      collateral: B_coll,
      totalDebt: B_totalDebt
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(110, 18),
      signer: Bob,
      extraParams: {
        from: bob
      }
    })
    const {
      collateral: C_coll,
      totalDebt: C_totalDebt
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(110, 18),
      signer: Carol,
      extraParams: {
        from: carol
      }
    })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Carol
    const txWC = await troveManager.liquidate(carol)
    const txC = await txWC.wait()
    assert.isTrue(txC.status === 1)
    assert.isFalse(await sortedTroves.contains(carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    //Bob withdraws 0.5 ETH from his trove
    const withdrawnColl = toBN(dec(500, 'finney'))
    await borrowerOperations.connect(Bob).withdrawColl([weth.address], [withdrawnColl], bob, bob, {
      from: bob
    })

    // Alice withdraws USDE
    await borrowerOperations.connect(Alice).withdrawUSDE(await getNetBorrowingAmount(A_totalDebt), alice, alice, th._100pct, {
      from: alice
    })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Alice
    const txWA = await troveManager.liquidate(alice)
    const txA = await txWA.wait()
    assert.isTrue(txA.status === 1)
    assert.isFalse(await sortedTroves.contains(alice))

    // Expect Bob now holds all Ether and USDEDebt in the system: 2.5 Ether and 300 USDE
    // 1 + 0.995/2 - 0.5 + 1.4975*0.995
    const bob_Coll = (await getTroveEntireColl(bob))[0].toString()
    const bob_USDEDebt = (await getTroveEntireDebt(bob)).toString()

    const expected_B_coll = B_coll
      .sub(withdrawnColl)
      .add(th.applyLiquidationFee(A_coll))
      .add(th.applyLiquidationFee(C_coll).mul(B_coll).div(A_coll.add(B_coll)))
      .add(th.applyLiquidationFee(th.applyLiquidationFee(C_coll).mul(A_coll).div(A_coll.add(B_coll))))
    assert.isAtMost(th.getDifference(bob_Coll, expected_B_coll), 1000)
    assert.isAtMost(th.getDifference(bob_USDEDebt, A_totalDebt.mul(toBN(2)).add(B_totalDebt).add(C_totalDebt)), _dec(14))

    // check USDE gas compensation
    assert.equal((await usdeToken.balanceOf(owner)).toString(), dec(400, 18))
  })

  it("redistribution: A,B,C Open. Liq(C). B withdraws coll. D Opens. Liq(D). Distributes correct rewards.", async () => {
    // A, B, C open troves
    const {
      collateral: A_coll,
      totalDebt: A_totalDebt
    } = await openTrove({
      ICR: toBN(dec(400, 16)),
      signer: Alice,
      extraParams: {
        from: alice
      }
    })
    const {
      collateral: B_coll,
      totalDebt: B_totalDebt
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(110, 18),
      signer: Bob,
      extraParams: {
        from: bob
      }
    })
    const {
      collateral: C_coll,
      totalDebt: C_totalDebt
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(110, 18),
      signer: Carol,
      extraParams: {
        from: carol
      }
    })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Carol
    const txWC = await troveManager.liquidate(carol)
    const txC = await txWC.wait()
    assert.isTrue(txC.status === 1)
    assert.isFalse(await sortedTroves.contains(carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    //Bob  withdraws 0.5 ETH from his trove
    const withdrawnColl = toBN(dec(500, 'finney'))
    await borrowerOperations.connect(Bob).withdrawColl([weth.address], [withdrawnColl], bob, bob, {
      from: bob
    })

    // D opens trove
    const {
      collateral: D_coll,
      totalDebt: D_totalDebt
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(110, 18),
      signer: Dennis,
      extraParams: {
        from: dennis
      }
    })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate D
    const txWA = await troveManager.liquidate(dennis)
    const txA = await txWA.wait()
    assert.isTrue(txA.status === 1)
    assert.isFalse(await sortedTroves.contains(dennis))

    /* Bob rewards:
     L1: 0.4975 ETH, 55 USDE
     L2: (0.9975/2.495)*0.995 = 0.3978 ETH , 110*(0.9975/2.495)= 43.98 USDEDebt

    coll: (1 + 0.4975 - 0.5 + 0.3968) = 1.3953 ETH
    debt: (110 + 55 + 43.98 = 208.98 USDEDebt

     Alice rewards:
    L1 0.4975, 55 USDE
    L2 (1.4975/2.495)*0.995 = 0.5972 ETH, 110*(1.4975/2.495) = 66.022 USDEDebt

    coll: (1 + 0.4975 + 0.5972) = 2.0947 ETH
    debt: (50 + 55 + 66.022) = 171.022 USDE Debt

    totalColl: 3.49 ETH
    totalDebt 380 USDE (Includes 50 in each trove for gas compensation)
    */
    const bob_Coll = (await getTroveEntireColl(bob))[0].toString()
    const bob_USDEDebt = (await getTroveEntireDebt(bob)).toString()

    const alice_Coll = (await getTroveEntireColl(alice))[0].toString()
    const alice_USDEDebt = (await getTroveEntireDebt(alice)).toString()

    const totalCollAfterL1 = A_coll.add(B_coll).sub(withdrawnColl).add(th.applyLiquidationFee(C_coll))
    const B_collAfterL1 = B_coll.add(B_coll.mul(th.applyLiquidationFee(C_coll)).div(A_coll.add(B_coll))).sub(withdrawnColl)
    const expected_B_coll = B_collAfterL1.add(B_collAfterL1.mul(th.applyLiquidationFee(D_coll)).div(totalCollAfterL1))
    const expected_B_debt = B_totalDebt
      .add(B_coll.mul(C_totalDebt).div(A_coll.add(B_coll)))
      .add(B_collAfterL1.mul(D_totalDebt).div(totalCollAfterL1))
    assert.isAtMost(th.getDifference(bob_Coll, expected_B_coll), 1000)
    assert.isAtMost(th.getDifference(bob_USDEDebt, expected_B_debt), _dec(14))

    const A_collAfterL1 = A_coll.add(A_coll.mul(th.applyLiquidationFee(C_coll)).div(A_coll.add(B_coll)))
    const expected_A_coll = A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(D_coll)).div(totalCollAfterL1))
    const expected_A_debt = A_totalDebt
      .add(A_coll.mul(C_totalDebt).div(A_coll.add(B_coll)))
      .add(A_collAfterL1.mul(D_totalDebt).div(totalCollAfterL1))

    assert.isAtMost(th.getDifference(alice_Coll, expected_A_coll), 1000)
    assert.isAtMost(th.getDifference(alice_USDEDebt, expected_A_debt), _dec(14))

    const entireSystemColl = (await activePool.getCollateralAmount(weth.address)).add(await defaultPool.getCollateralAmount(weth.address))
    th.assertIsApproximatelyEqual(entireSystemColl, A_coll.add(B_coll).add(th.applyLiquidationFee(C_coll)).sub(withdrawnColl).add(th.applyLiquidationFee(D_coll)))
    const entireSystemDebt = (await activePool.getUSDEDebt()).add(await defaultPool.getUSDEDebt())
    th.assertIsApproximatelyEqual(entireSystemDebt, A_totalDebt.add(B_totalDebt).add(C_totalDebt).add(D_totalDebt))

    // check USDE gas compensation
    th.assertIsApproximatelyEqual((await usdeToken.balanceOf(owner)).toString(), dec(400, 18))
  })

  it("redistribution: Trove with the majority stake withdraws. A,B,C,D open. Liq(D). C withdraws some coll. E Enters, Liq(E). Distributes correct rewards", async () => {
    const _998_Ether = toBN('998000000000000000000')
    // A, B, C, D open troves
    const {
      collateral: A_coll
    } = await openTrove({
      ICR: toBN(dec(400, 16)),
      signer: Alice,
      extraParams: {
        from: alice
      }
    })
    const {
      collateral: B_coll
    } = await openTrove({
      ICR: toBN(dec(400, 16)),
      extraUSDEAmount: dec(110, 18),
      signer: Bob,
      extraParams: {
        from: bob
      }
    })
    const {
      collateral: C_coll
    } = await openTrove({
      extraUSDEAmount: dec(110, 18),
      signer: Carol,
      extraParams: {
        from: carol,
        value: _998_Ether
      }
    })
    const {
      collateral: D_coll
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(110, 18),
      signer: Dennis,
      extraParams: {
        from: dennis,
        value: dec(1000, 'ether')
      }
    })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Dennis
    const txWD = await troveManager.liquidate(dennis)
    const txD = await txWD.wait()
    assert.isTrue(txD.status === 1)
    assert.isFalse(await sortedTroves.contains(dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // Expected rewards:  alice: 1 ETH, bob: 1 ETH, carol: 998 ETH (*0.995)
    const alice_ETHReward_1 = (await troveManager.getPendingCollReward(alice))[0][0]
    const bob_ETHReward_1 = (await troveManager.getPendingCollReward(bob))[0][0]
    const carol_ETHReward_1 = (await troveManager.getPendingCollReward(carol))[0][0]

    //Expect 1995 ETH in system now
    const entireSystemColl_1 = (await activePool.getCollateralAmount(weth.address)).add(await defaultPool.getCollateralAmount(weth.address))
    th.assertIsApproximatelyEqual(entireSystemColl_1, A_coll.add(B_coll).add(C_coll).add(th.applyLiquidationFee(D_coll)))

    const totalColl = A_coll.add(B_coll).add(C_coll)
    th.assertIsApproximatelyEqual(alice_ETHReward_1.toString(), th.applyLiquidationFee(D_coll).mul(A_coll).div(totalColl))
    th.assertIsApproximatelyEqual(bob_ETHReward_1.toString(), th.applyLiquidationFee(D_coll).mul(B_coll).div(totalColl))
    th.assertIsApproximatelyEqual(carol_ETHReward_1.toString(), th.applyLiquidationFee(D_coll).mul(C_coll).div(totalColl))

    //Carol wthdraws 1 ETH from her trove, brings it to 1990.01 total coll
    const C_withdrawnColl = toBN(dec(1, 'ether'))
    await borrowerOperations.connect(Carol).withdrawColl([weth.address], [C_withdrawnColl], carol, carol, {
      from: carol
    })

    //Expect 1994 ETH in system now
    const entireSystemColl_2 = (await activePool.getCollateralAmount(weth.address)).add(await defaultPool.getCollateralAmount(weth.address))
    th.assertIsApproximatelyEqual(entireSystemColl_2, totalColl.add(th.applyLiquidationFee(D_coll)).sub(C_withdrawnColl))

    // E opens with another 1994 ETH
    const {
      collateral: E_coll
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      signer: Erin,
      extraParams: {
        from: erin,
        value: entireSystemColl_2
      }
    })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Erin
    const txWE = await troveManager.liquidate(erin)
    const tx = await txWE.wait()
    assert.isTrue(tx.status === 1)
    assert.isFalse(await sortedTroves.contains(erin))

    /* Expected ETH rewards: 
     Carol = 1990.01/1994 * 1994*0.995 = 1980.05995 ETH
     Alice = 1.995/1994 * 1994*0.995 = 1.985025 ETH
     Bob = 1.995/1994 * 1994*0.995 = 1.985025 ETH

    therefore, expected total collateral:

    Carol = 1990.01 + 1980.05995 = 3970.06995
    Alice = 1.995 + 1.985025 = 3.980025 ETH
    Bob = 1.995 + 1.985025 = 3.980025 ETH

    total = 3978.03 ETH
    */

    const alice_Coll = ((await troveManager.getTroveColls(alice))[0][0]
        .add((await troveManager.getPendingCollReward(alice))[0][0]))
      .toString()

    const bob_Coll = ((await troveManager.getTroveColls(bob))[0][0]
        .add((await troveManager.getPendingCollReward(bob))[0][0]))
      .toString()

    const carol_Coll = ((await troveManager.getTroveColls(carol))[0][0]
        .add((await troveManager.getPendingCollReward(carol))[0][0]))
      .toString()

    const totalCollAfterL1 = A_coll.add(B_coll).add(C_coll).add(th.applyLiquidationFee(D_coll)).sub(C_withdrawnColl)
    const A_collAfterL1 = A_coll.add(A_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll)))
    const expected_A_coll = A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))
    const B_collAfterL1 = B_coll.add(B_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll)))
    const expected_B_coll = B_collAfterL1.add(B_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))
    const C_collAfterL1 = C_coll.add(C_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll))).sub(C_withdrawnColl)
    const expected_C_coll = C_collAfterL1.add(C_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))

    assert.isAtMost(th.getDifference(alice_Coll, expected_A_coll), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, expected_B_coll), 1000)
    assert.isAtMost(th.getDifference(carol_Coll, expected_C_coll), 1000)

    //Expect 3978.03 ETH in system now
    const entireSystemColl_3 = (await activePool.getCollateralAmount(weth.address)).add(await defaultPool.getCollateralAmount(weth.address))
    th.assertIsApproximatelyEqual(entireSystemColl_3, totalCollAfterL1.add(th.applyLiquidationFee(E_coll)))

    // check USDE gas compensation
    assert.equal((await usdeToken.balanceOf(owner)).toString(), dec(400, 18))
  })

  it("redistribution: Trove with the majority stake withdraws. A,B,C,D open. Liq(D). A, B, C withdraw. E Enters, Liq(E). Distributes correct rewards", async () => {
    const _998_Ether = toBN('998000000000000000000')
    // A, B, C, D open troves
    const {
      collateral: A_coll
    } = await openTrove({
      ICR: toBN(dec(400, 16)),
      signer: Alice,
      extraParams: {
        from: alice
      }
    })
    const {
      collateral: B_coll
    } = await openTrove({
      ICR: toBN(dec(400, 16)),
      extraUSDEAmount: dec(110, 18),
      signer: Bob,
      extraParams: {
        from: bob
      }
    })
    const {
      collateral: C_coll
    } = await openTrove({
      extraUSDEAmount: dec(110, 18),
      signer: Carol,
      extraParams: {
        from: carol,
        value: _998_Ether
      }
    })
    const {
      collateral: D_coll
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(110, 18),
      signer: Dennis,
      extraParams: {
        from: dennis,
        value: dec(1000, 'ether')
      }
    })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Dennis
    const txWD = await troveManager.liquidate(dennis)
    let tx = await txWD.wait()
    assert.isTrue(tx.status === 1)
    assert.isFalse(await sortedTroves.contains(dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // Expected rewards:  alice: 1 ETH, bob: 1 ETH, carol: 998 ETH (*0.995)
    const alice_ETHReward_1 = (await troveManager.getPendingCollReward(alice))[0][0]
    const bob_ETHReward_1 = (await troveManager.getPendingCollReward(bob))[0][0]
    const carol_ETHReward_1 = (await troveManager.getPendingCollReward(carol))[0][0]

    //Expect 1995 ETH in system now
    const entireSystemColl_1 = (await activePool.getCollateralAmount(weth.address)).add(await defaultPool.getCollateralAmount(weth.address))
    th.assertIsApproximatelyEqual(entireSystemColl_1, A_coll.add(B_coll).add(C_coll).add(th.applyLiquidationFee(D_coll)))

    const totalColl = A_coll.add(B_coll).add(C_coll)
    th.assertIsApproximatelyEqual(alice_ETHReward_1.toString(), th.applyLiquidationFee(D_coll).mul(A_coll).div(totalColl))
    th.assertIsApproximatelyEqual(bob_ETHReward_1.toString(), th.applyLiquidationFee(D_coll).mul(B_coll).div(totalColl))
    th.assertIsApproximatelyEqual(carol_ETHReward_1.toString(), th.applyLiquidationFee(D_coll).mul(C_coll).div(totalColl))

    /* Alice, Bob, Carol each withdraw 0.5 ETH to their troves, 
    bringing them to 1.495, 1.495, 1990.51 total coll each. */
    const withdrawnColl = toBN(dec(500, 'finney'))
    await borrowerOperations.connect(Alice).withdrawColl([weth.address], [withdrawnColl], alice, alice, {
      from: alice
    })
    await borrowerOperations.connect(Bob).withdrawColl([weth.address], [withdrawnColl], bob, bob, {
      from: bob
    })
    await borrowerOperations.connect(Carol).withdrawColl([weth.address], [withdrawnColl], carol, carol, {
      from: carol
    })

    const alice_Coll_1 = ((await troveManager.getTroveColls(alice))[0][0]
        .add((await troveManager.getPendingCollReward(alice))[0][0]))
      .toString()

    const bob_Coll_1 = ((await troveManager.getTroveColls(bob))[0][0]
        .add((await troveManager.getPendingCollReward(bob))[0][0]))
      .toString()

    const carol_Coll_1 = ((await troveManager.getTroveColls(carol))[0][0]
        .add((await troveManager.getPendingCollReward(carol))[0][0]))
      .toString()

    const totalColl_1 = A_coll.add(B_coll).add(C_coll)
    assert.isAtMost(th.getDifference(alice_Coll_1, A_coll.add(th.applyLiquidationFee(D_coll).mul(A_coll).div(totalColl_1)).sub(withdrawnColl)), 1000)
    assert.isAtMost(th.getDifference(bob_Coll_1, B_coll.add(th.applyLiquidationFee(D_coll).mul(B_coll).div(totalColl_1)).sub(withdrawnColl)), 1000)
    assert.isAtMost(th.getDifference(carol_Coll_1, C_coll.add(th.applyLiquidationFee(D_coll).mul(C_coll).div(totalColl_1)).sub(withdrawnColl)), 1000)

    //Expect 1993.5 ETH in system now
    const entireSystemColl_2 = (await activePool.getCollateralAmount(weth.address)).add(await defaultPool.getCollateralAmount(weth.address))
    th.assertIsApproximatelyEqual(entireSystemColl_2, totalColl.add(th.applyLiquidationFee(D_coll)).sub(withdrawnColl.mul(toBN(3))))

    // E opens with another 1993.5 ETH
    const {
      collateral: E_coll
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      signer: Erin,
      extraParams: {
        from: erin,
        value: entireSystemColl_2
      }
    })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Erin
    const txWE = await troveManager.liquidate(erin)
    tx = await txWE.wait()
    assert.isTrue(tx.status === 1)
    assert.isFalse(await sortedTroves.contains(erin))

    /* Expected ETH rewards: 
     Carol = 1990.51/1993.5 * 1993.5*0.995 = 1980.55745 ETH
     Alice = 1.495/1993.5 * 1993.5*0.995 = 1.487525 ETH
     Bob = 1.495/1993.5 * 1993.5*0.995 = 1.487525 ETH

    therefore, expected total collateral:

    Carol = 1990.51 + 1980.55745 = 3971.06745
    Alice = 1.495 + 1.487525 = 2.982525 ETH
    Bob = 1.495 + 1.487525 = 2.982525 ETH

    total = 3977.0325 ETH
    */

    const alice_Coll_2 = ((await troveManager.getTroveColls(alice))[0][0]
        .add((await troveManager.getPendingCollReward(alice))[0][0]))
      .toString()

    const bob_Coll_2 = ((await troveManager.getTroveColls(bob))[0][0]
        .add((await troveManager.getPendingCollReward(bob))[0][0]))
      .toString()

    const carol_Coll_2 = ((await troveManager.getTroveColls(carol))[0][0]
        .add((await troveManager.getPendingCollReward(carol))[0][0]))
      .toString()

    const totalCollAfterL1 = A_coll.add(B_coll).add(C_coll).add(th.applyLiquidationFee(D_coll)).sub(withdrawnColl.mul(toBN(3)))
    const A_collAfterL1 = A_coll.add(A_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll))).sub(withdrawnColl)
    const expected_A_coll = A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))
    const B_collAfterL1 = B_coll.add(B_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll))).sub(withdrawnColl)
    const expected_B_coll = B_collAfterL1.add(B_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))
    const C_collAfterL1 = C_coll.add(C_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll))).sub(withdrawnColl)
    const expected_C_coll = C_collAfterL1.add(C_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))

    assert.isAtMost(th.getDifference(alice_Coll_2, expected_A_coll), 1000)
    assert.isAtMost(th.getDifference(bob_Coll_2, expected_B_coll), 1000)
    assert.isAtMost(th.getDifference(carol_Coll_2, expected_C_coll), 1000)

    //Expect 3977.0325 ETH in system now
    const entireSystemColl_3 = (await activePool.getCollateralAmount(weth.address)).add(await defaultPool.getCollateralAmount(weth.address))
    th.assertIsApproximatelyEqual(entireSystemColl_3, totalCollAfterL1.add(th.applyLiquidationFee(E_coll)))

    // check USDE gas compensation
    assert.equal((await usdeToken.balanceOf(owner)).toString(), dec(400, 18))
  })

  // For calculations of correct values used in test, see scenario 1:
  // https://docs.google.com/spreadsheets/d/1F5p3nZy749K5jwO-bwJeTsRoY7ewMfWIQ3QHtokxqzo/edit?usp=sharing
  it("redistribution, all operations: A,B,C open. Liq(A). D opens. B adds, C withdraws. Liq(B). E & F open. D adds. Liq(F). Distributes correct rewards", async () => {
    // A, B, C open troves
    const {
      collateral: A_coll
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(100, 18),
      signer: Alice,
      extraParams: {
        from: alice
      }
    })
    const {
      collateral: B_coll
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(100, 18),
      signer: Bob,
      extraParams: {
        from: bob
      }
    })
    const {
      collateral: C_coll
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(100, 18),
      signer: Carol,
      extraParams: {
        from: carol
      }
    })

    // Price drops to 1 $/E
    await priceFeed.setPrice(dec(1, 18))

    // Liquidate A
    const txWA = await troveManager.liquidate(alice)
    tx = await txWA.wait()
    assert.isTrue(tx.status === 1)
    assert.isFalse(await sortedTroves.contains(alice))

    // Check rewards for B and C
    const B_pendingRewardsAfterL1 = th.applyLiquidationFee(A_coll).mul(B_coll).div(B_coll.add(C_coll))
    const C_pendingRewardsAfterL1 = th.applyLiquidationFee(A_coll).mul(C_coll).div(B_coll.add(C_coll))
    assert.isAtMost(th.getDifference((await troveManager.getPendingCollReward(bob))[0][0], B_pendingRewardsAfterL1), 1000000)
    assert.isAtMost(th.getDifference((await troveManager.getPendingCollReward(carol))[0][0], C_pendingRewardsAfterL1), 1000000)

    const totalStakesSnapshotAfterL1 = B_coll.add(C_coll)
    const totalCollateralSnapshotAfterL1 = totalStakesSnapshotAfterL1.add(th.applyLiquidationFee(A_coll))
    th.assertIsApproximatelyEqual(await troveManager.totalStakesSnapshot(weth.address), totalStakesSnapshotAfterL1)
    th.assertIsApproximatelyEqual(await troveManager.totalCollateralSnapshot(weth.address), totalCollateralSnapshotAfterL1)

    // Price rises to 1000
    await priceFeed.setPrice(dec(1000, 18))

    // D opens trove
    const {
      collateral: D_coll,
      totalDebt: D_totalDebt
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(110, 18),
      signer: Dennis,
      extraParams: {
        from: dennis
      }
    })

    //Bob adds 1 ETH to his trove
    const B_addedColl = toBN(dec(1, 'ether'))
    await borrowerOperations.connect(Bob).addColl([], [], bob, bob, {
      from: bob,
      value: B_addedColl
    })

    //Carol  withdraws 1 ETH from her trove
    const C_withdrawnColl = toBN(dec(1, 'ether'))
    await borrowerOperations.connect(Carol).withdrawColl([weth.address], [C_withdrawnColl], carol, carol, {
      from: carol
    })

    const B_collAfterL1 = B_coll.add(B_pendingRewardsAfterL1).add(B_addedColl)
    const C_collAfterL1 = C_coll.add(C_pendingRewardsAfterL1).sub(C_withdrawnColl)

    // Price drops
    await priceFeed.setPrice(dec(1, 18))

    // Liquidate B
    const txWB = await troveManager.liquidate(bob)
    tx = await txWB.wait()
    assert.isTrue(tx.status === 1)
    assert.isFalse(await sortedTroves.contains(bob))

    // Check rewards for C and D
    const C_pendingRewardsAfterL2 = C_collAfterL1.mul(th.applyLiquidationFee(B_collAfterL1)).div(C_collAfterL1.add(D_coll))
    const D_pendingRewardsAfterL2 = D_coll.mul(th.applyLiquidationFee(B_collAfterL1)).div(C_collAfterL1.add(D_coll))
    assert.isAtMost(th.getDifference((await troveManager.getPendingCollReward(carol))[0][0], C_pendingRewardsAfterL2), 1000000)
    assert.isAtMost(th.getDifference((await troveManager.getPendingCollReward(dennis))[0][0], D_pendingRewardsAfterL2), 1000000)

    const totalStakesSnapshotAfterL2 = totalStakesSnapshotAfterL1.add(D_coll.mul(totalStakesSnapshotAfterL1).div(totalCollateralSnapshotAfterL1)).sub(B_coll).sub(C_withdrawnColl.mul(totalStakesSnapshotAfterL1).div(totalCollateralSnapshotAfterL1))
    const defaultedAmountAfterL2 = th.applyLiquidationFee(B_coll.add(B_addedColl).add(B_pendingRewardsAfterL1)).add(C_pendingRewardsAfterL1)
    const totalCollateralSnapshotAfterL2 = C_coll.sub(C_withdrawnColl).add(D_coll).add(defaultedAmountAfterL2)
    th.assertIsApproximatelyEqual(await troveManager.totalStakesSnapshot(weth.address), totalStakesSnapshotAfterL2)
    th.assertIsApproximatelyEqual(await troveManager.totalCollateralSnapshot(weth.address), totalCollateralSnapshotAfterL2)

    // Price rises to 1000
    await priceFeed.setPrice(dec(1000, 18))

    // E and F open troves
    const {
      collateral: E_coll,
      totalDebt: E_totalDebt
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(110, 18),
      signer: Erin,
      extraParams: {
        from: erin
      }
    })
    const {
      collateral: F_coll,
      totalDebt: F_totalDebt
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraUSDEAmount: dec(110, 18),
      signer: Freddy,
      extraParams: {
        from: freddy
      }
    })

    // D tops up
    const D_addedColl = toBN(dec(1, 'ether'))
    await borrowerOperations.connect(Dennis).addColl([], [], dennis, dennis, {
      from: dennis,
      value: D_addedColl
    })

    // Price drops to 1
    await priceFeed.setPrice(dec(1, 18))

    // Liquidate F
    const txWF = await troveManager.liquidate(freddy)
    tx = await txWF.wait()
    assert.isTrue(tx.status === 1)
    assert.isFalse(await sortedTroves.contains(freddy))

    // Grab remaining troves' collateral
    const carol_rawColl = (await troveManager.getTroveColls(carol))[0][0].toString()
    const carol_pendingETHReward = ((await troveManager.getPendingCollReward(carol))[01][0]).toString()

    const dennis_rawColl = (await troveManager.getTroveColls(dennis))[0][0].toString()
    const dennis_pendingETHReward = ((await troveManager.getPendingCollReward(dennis))[0][0]).toString()

    const erin_rawColl = (await troveManager.getTroveColls(erin))[0][0].toString()
    const erin_pendingETHReward = ((await troveManager.getPendingCollReward(erin))[0][0]).toString()

    // Check raw collateral of C, D, E
    const C_collAfterL2 = C_collAfterL1.add(C_pendingRewardsAfterL2)
    const D_collAfterL2 = D_coll.add(D_pendingRewardsAfterL2).add(D_addedColl)
    const totalCollForL3 = C_collAfterL2.add(D_collAfterL2).add(E_coll)
    const C_collAfterL3 = C_collAfterL2.add(C_collAfterL2.mul(th.applyLiquidationFee(F_coll)).div(totalCollForL3))
    const D_collAfterL3 = D_collAfterL2.add(D_collAfterL2.mul(th.applyLiquidationFee(F_coll)).div(totalCollForL3))
    const E_collAfterL3 = E_coll.add(E_coll.mul(th.applyLiquidationFee(F_coll)).div(totalCollForL3))
    assert.isAtMost(th.getDifference(carol_rawColl, C_collAfterL1), 1000)
    assert.isAtMost(th.getDifference(dennis_rawColl, D_collAfterL2), 1000000)
    assert.isAtMost(th.getDifference(erin_rawColl, E_coll), 1000)

    // Check pending ETH rewards of C, D, E
    assert.isAtMost(th.getDifference(carol_pendingETHReward, C_collAfterL3.sub(C_collAfterL1)), 1000000)
    assert.isAtMost(th.getDifference(dennis_pendingETHReward, D_collAfterL3.sub(D_collAfterL2)), 1000000)
    assert.isAtMost(th.getDifference(erin_pendingETHReward, E_collAfterL3.sub(E_coll)), 1000000)

    // Check systemic collateral
    const activeColl = (await activePool.getCollateralAmount(weth.address)).toString()
    const defaultColl = (await defaultPool.getCollateralAmount(weth.address)).toString()

    assert.isAtMost(th.getDifference(activeColl, C_collAfterL1.add(D_collAfterL2.add(E_coll))), 1000000)
    assert.isAtMost(th.getDifference(defaultColl, C_collAfterL3.sub(C_collAfterL1).add(D_collAfterL3.sub(D_collAfterL2)).add(E_collAfterL3.sub(E_coll))), 1000000)

    // Check system snapshots
    const totalStakesSnapshotAfterL3 = totalStakesSnapshotAfterL2.add(D_addedColl.add(E_coll).mul(totalStakesSnapshotAfterL2).div(totalCollateralSnapshotAfterL2))
    const totalCollateralSnapshotAfterL3 = C_coll.sub(C_withdrawnColl).add(D_coll).add(D_addedColl).add(E_coll).add(defaultedAmountAfterL2).add(th.applyLiquidationFee(F_coll))
    const totalStakesSnapshot = (await troveManager.totalStakesSnapshot(weth.address)).toString()
    const totalCollateralSnapshot = (await troveManager.totalCollateralSnapshot(weth.address)).toString()
    th.assertIsApproximatelyEqual(totalStakesSnapshot, totalStakesSnapshotAfterL3)
    th.assertIsApproximatelyEqual(totalCollateralSnapshot, totalCollateralSnapshotAfterL3)

    // check USDE gas compensation
    assert.equal((await usdeToken.balanceOf(owner)).toString(), dec(600, 18))
  })

  // For calculations of correct values used in test, see scenario 2:
  // https://docs.google.com/spreadsheets/d/1F5p3nZy749K5jwO-bwJeTsRoY7ewMfWIQ3QHtokxqzo/edit?usp=sharing
  it("redistribution, all operations: A,B,C open. Liq(A). D opens. B adds, C withdraws. Liq(B). E & F open. D adds. Liq(F). Varying coll. Distributes correct rewards", async () => {
    /* A, B, C open troves.
    A: 450 ETH
    B: 8901 ETH
    C: 23.902 ETH
    */
    const {
      collateral: A_coll
    } = await openTrove({
      ICR: toBN(dec(90000, 16)),
      signer: Alice,
      extraParams: {
        from: alice,
        value: toBN('450000000000000000000')
      }
    })
    const {
      collateral: B_coll
    } = await openTrove({
      ICR: toBN(dec(1800000, 16)),
      signer: Bob,
      extraParams: {
        from: bob,
        value: toBN('8901000000000000000000')
      }
    })
    const {
      collateral: C_coll
    } = await openTrove({
      ICR: toBN(dec(4600, 16)),
      signer: Carol,
      extraParams: {
        from: carol,
        value: toBN('23902000000000000000')
      }
    })

    // Price drops 
    await priceFeed.setPrice('1')

    // Liquidate A
    const txWA = await troveManager.liquidate(alice)
    tx = await txWA.wait()
    assert.isTrue(tx.status === 1)
    assert.isFalse(await sortedTroves.contains(alice))

    // Check rewards for B and C
    const B_pendingRewardsAfterL1 = th.applyLiquidationFee(A_coll).mul(B_coll).div(B_coll.add(C_coll))
    const C_pendingRewardsAfterL1 = th.applyLiquidationFee(A_coll).mul(C_coll).div(B_coll.add(C_coll))
    assert.isAtMost(th.getDifference((await troveManager.getPendingCollReward(bob))[0][0], B_pendingRewardsAfterL1), 1000000)
    assert.isAtMost(th.getDifference((await troveManager.getPendingCollReward(carol))[0][0], C_pendingRewardsAfterL1), 1000000)

    const totalStakesSnapshotAfterL1 = B_coll.add(C_coll)
    const totalCollateralSnapshotAfterL1 = totalStakesSnapshotAfterL1.add(th.applyLiquidationFee(A_coll))
    th.assertIsApproximatelyEqual(await troveManager.totalStakesSnapshot(weth.address), totalStakesSnapshotAfterL1)
    th.assertIsApproximatelyEqual(await troveManager.totalCollateralSnapshot(weth.address), totalCollateralSnapshotAfterL1)

    // Price rises 
    await priceFeed.setPrice(dec(1, 27))

    // D opens trove: 0.035 ETH
    const {
      collateral: D_coll,
      totalDebt: D_totalDebt
    } = await openTrove({
      extraUSDEAmount: dec(100, 18),
      signer: Dennis,
      extraParams: {
        from: dennis,
        value: toBN(dec(35, 15))
      }
    })

    // Bob adds 11.33909 ETH to his trove
    const B_addedColl = toBN('11339090000000000000')
    await borrowerOperations.connect(Bob).addColl([], [], bob, bob, {
      from: bob,
      value: B_addedColl
    })

    // Carol withdraws 15 ETH from her trove
    const C_withdrawnColl = toBN(dec(15, 'ether'))
    await borrowerOperations.connect(Carol).withdrawColl([weth.address], [C_withdrawnColl], carol, carol, {
      from: carol
    })

    const B_collAfterL1 = B_coll.add(B_pendingRewardsAfterL1).add(B_addedColl)
    const C_collAfterL1 = C_coll.add(C_pendingRewardsAfterL1).sub(C_withdrawnColl)

    // Price drops
    await priceFeed.setPrice('1')

    // Liquidate B
    const txWB = await troveManager.liquidate(bob)
    tx = await txWB.wait()
    assert.isTrue(tx.status === 1)
    assert.isFalse(await sortedTroves.contains(bob))

    // Check rewards for C and D
    const C_pendingRewardsAfterL2 = C_collAfterL1.mul(th.applyLiquidationFee(B_collAfterL1)).div(C_collAfterL1.add(D_coll))
    const D_pendingRewardsAfterL2 = D_coll.mul(th.applyLiquidationFee(B_collAfterL1)).div(C_collAfterL1.add(D_coll))
    const C_collAfterL2 = C_collAfterL1.add(C_pendingRewardsAfterL2)
    assert.isAtMost(th.getDifference((await troveManager.getPendingCollReward(carol))[0][0], C_pendingRewardsAfterL2), 10000000)
    assert.isAtMost(th.getDifference((await troveManager.getPendingCollReward(dennis))[0][0], D_pendingRewardsAfterL2), 10000000)

    const totalStakesSnapshotAfterL2 = totalStakesSnapshotAfterL1.add(D_coll.mul(totalStakesSnapshotAfterL1).div(totalCollateralSnapshotAfterL1)).sub(B_coll).sub(C_withdrawnColl.mul(totalStakesSnapshotAfterL1).div(totalCollateralSnapshotAfterL1))
    const defaultedAmountAfterL2 = th.applyLiquidationFee(B_coll.add(B_addedColl).add(B_pendingRewardsAfterL1)).add(C_pendingRewardsAfterL1)
    const totalCollateralSnapshotAfterL2 = C_coll.sub(C_withdrawnColl).add(D_coll).add(defaultedAmountAfterL2)
    th.assertIsApproximatelyEqual(await troveManager.totalStakesSnapshot(weth.address), totalStakesSnapshotAfterL2)
    th.assertIsApproximatelyEqual(await troveManager.totalCollateralSnapshot(weth.address), totalCollateralSnapshotAfterL2)

    // Price rises 
    await priceFeed.setPrice(dec(1, 27))

    /* E and F open troves.
    E: 10000 ETH
    F: 0.0007 ETH
    */
    const {
      collateral: E_coll,
      totalDebt: E_totalDebt
    } = await openTrove({
      extraUSDEAmount: dec(100, 18),
      signer: Erin,
      extraParams: {
        from: erin,
        value: toBN(dec(1, 22))
      }
    })
    const {
      collateral: F_coll,
      totalDebt: F_totalDebt
    } = await openTrove({
      extraUSDEAmount: dec(100, 18),
      signer: Freddy,
      extraParams: {
        from: freddy,
        value: toBN('700000000000000')
      }
    })

    // D tops up
    const D_addedColl = toBN(dec(1, 'ether'))
    await borrowerOperations.connect(Dennis).addColl([], [], dennis, dennis, {
      from: dennis,
      value: D_addedColl
    })

    const D_collAfterL2 = D_coll.add(D_pendingRewardsAfterL2).add(D_addedColl)

    // Price drops 
    await priceFeed.setPrice('10000000')

    // Liquidate F
    const txWF = await troveManager.liquidate(freddy)
    tx = await txWF.wait()
    assert.isTrue(tx.status === 1)
    assert.isFalse(await sortedTroves.contains(freddy))

    // Grab remaining troves' collateral
    const carol_rawColl = (await troveManager.getTroveColls(carol))[0][0].toString()
    const carol_pendingETHReward = ((await troveManager.getPendingCollReward(carol))[0][0]).toString()
    //const carol_Stake = (await troveManager.Troves(carol))[2].toString()

    const dennis_rawColl = (await troveManager.getTroveColls(dennis))[0][0].toString()
    const dennis_pendingETHReward = ((await troveManager.getPendingCollReward(dennis))[0][0]).toString()
    //const dennis_Stake = (await troveManager.Troves(dennis))[2].toString()

    const erin_rawColl = (await troveManager.getTroveColls(erin))[0][0].toString()
    const erin_pendingETHReward = ((await troveManager.getPendingCollReward(erin))[0][0]).toString()
    //const erin_Stake = (await troveManager.Troves(erin))[2].toString()

    // Check raw collateral of C, D, E
    const totalCollForL3 = C_collAfterL2.add(D_collAfterL2).add(E_coll)
    const C_collAfterL3 = C_collAfterL2.add(C_collAfterL2.mul(th.applyLiquidationFee(F_coll)).div(totalCollForL3))
    const D_collAfterL3 = D_collAfterL2.add(D_collAfterL2.mul(th.applyLiquidationFee(F_coll)).div(totalCollForL3))
    const E_collAfterL3 = E_coll.add(E_coll.mul(th.applyLiquidationFee(F_coll)).div(totalCollForL3))
    assert.isAtMost(th.getDifference(carol_rawColl, C_collAfterL1), 1000)
    assert.isAtMost(th.getDifference(dennis_rawColl, D_collAfterL2), 1000000)
    assert.isAtMost(th.getDifference(erin_rawColl, E_coll), 1000)

    // Check pending ETH rewards of C, D, E
    assert.isAtMost(th.getDifference(carol_pendingETHReward, C_collAfterL3.sub(C_collAfterL1)), 1000000)
    assert.isAtMost(th.getDifference(dennis_pendingETHReward, D_collAfterL3.sub(D_collAfterL2)), 1000000)
    assert.isAtMost(th.getDifference(erin_pendingETHReward, E_collAfterL3.sub(E_coll)), 1000000)

    // Check systemic collateral
    const activeColl = (await activePool.getCollateralAmount(weth.address)).toString()
    const defaultColl = (await defaultPool.getCollateralAmount(weth.address)).toString()

    assert.isAtMost(th.getDifference(activeColl, C_collAfterL1.add(D_collAfterL2.add(E_coll))), 1000000)
    assert.isAtMost(th.getDifference(defaultColl, C_collAfterL3.sub(C_collAfterL1).add(D_collAfterL3.sub(D_collAfterL2)).add(E_collAfterL3.sub(E_coll))), 1000000)

    // Check system snapshots
    const totalStakesSnapshotAfterL3 = totalStakesSnapshotAfterL2.add(D_addedColl.add(E_coll).mul(totalStakesSnapshotAfterL2).div(totalCollateralSnapshotAfterL2))
    const totalCollateralSnapshotAfterL3 = C_coll.sub(C_withdrawnColl).add(D_coll).add(D_addedColl).add(E_coll).add(defaultedAmountAfterL2).add(th.applyLiquidationFee(F_coll))
    const totalStakesSnapshot = (await troveManager.totalStakesSnapshot(weth.address)).toString()
    const totalCollateralSnapshot = (await troveManager.totalCollateralSnapshot(weth.address)).toString()
    th.assertIsApproximatelyEqual(totalStakesSnapshot, totalStakesSnapshotAfterL3)
    th.assertIsApproximatelyEqual(totalCollateralSnapshot, totalCollateralSnapshotAfterL3)

    // check USDE gas compensation
    assert.equal((await usdeToken.balanceOf(owner)).toString(), dec(600, 18))
  })

  it("open alice and bob", async () => {
    const {
      collateral: A_coll
    } = await openTrove({
      ICR: toBN(dec(400, 16)),
      signer: Alice,
      extraParams: {
        from: alice
      }
    })
    const {
      collateral: B_coll
    } = await openTrove({
      ICR: toBN(dec(200, 16)),
      signer: Bob,
      extraParams: {
        from: bob
      }
    })
    // let activePoolColl = await activePool.getTotalCollateral()
    // let defaultPoolColl = await defaultPool.getTotalCollateral()
    // let systemColl = await contracts.borrowerOperations.getEntireSystemColl()
    // console.log('With weth only: \n')
    // console.log('collVC in active pool: ', (await collateralManager.getTotalValue(activePoolColl[1], activePoolColl[2])).toString())
    // console.log('debt in active pool: ', (await activePool.getUSDEDebt()).toString())
    // console.log('collVC in default pool: ', (await collateralManager.getTotalValue(defaultPoolColl[1], defaultPoolColl[2])).toString())
    // console.log('debt in default pool: ', (await defaultPool.getUSDEDebt()).toString())
    // console.log('TCR: ', (await contracts.collateralManager.getTCR()).toString())
    // console.log('entire system VC: ', (await collateralManager.getTotalValue(systemColl[0], systemColl[1])).toString())
    // console.log('entire system debt: ', (await contracts.borrowerOperations.getEntireSystemDebt()).toString())

    // bobCTS = (await contracts.troveManager.getCurrentTroveAmounts(bob))
    // console.log('bobICR: ', (await th.getCurrentICR(contracts, bob)).toString())
    // console.log('bobVC: ', (await collateralManager.getTotalValue(bobCTS[1], bobCTS[0])).toString())
    // console.log('bobDebt: ', bobCTS[2].toString())

    // aliceCTS = (await contracts.troveManager.getCurrentTroveAmounts(alice))
    // console.log('aliceICR: ', (await th.getCurrentICR(contracts, alice)).toString())
    // console.log('aliceVC: ', (await collateralManager.getTotalValue(aliceCTS[1], aliceCTS[0])).toString())
    // console.log('aliceDebt: ', aliceCTS[2].toString())


    // console.log('----------- \n\n')

    await priceFeed.setPrice(dec(100, 18))

    // activePoolColl = await activePool.getTotalCollateral()
    // defaultPoolColl = await defaultPool.getTotalCollateral()
    // systemColl = await contracts.borrowerOperations.getEntireSystemColl()
    // console.log('Price dropped to 100: \n')

    // console.log('collVC in active pool: ', (await collateralManager.getTotalValue(activePoolColl[1], activePoolColl[2])).toString())
    // console.log('debt in active pool: ', (await activePool.getUSDEDebt()).toString())
    // console.log('collVC in default pool: ', (await collateralManager.getTotalValue(defaultPoolColl[1], defaultPoolColl[2])).toString())
    // console.log('debt in default pool: ', (await defaultPool.getUSDEDebt()).toString())
    // console.log('TCR: ', (await contracts.collateralManager.getTCR()).toString())
    // console.log('entire system VC: ', (await collateralManager.getTotalValue(systemColl[0], systemColl[1])).toString())
    // console.log('entire system debt: ', (await contracts.borrowerOperations.getEntireSystemDebt()).toString())

    // bobCTS = (await contracts.troveManager.getCurrentTroveAmounts(bob))
    // console.log('bobICR: ', (await th.getCurrentICR(contracts, bob)).toString())
    // console.log('bobVC: ', (await collateralManager.getTotalValue(bobCTS[1], bobCTS[0])).toString())
    // console.log('bobDebt: ', bobCTS[2].toString())

    // aliceCTS = (await contracts.troveManager.getCurrentTroveAmounts(alice))
    // console.log('aliceICR: ', (await th.getCurrentICR(contracts, alice)).toString())
    // console.log('aliceVC: ', (await collateralManager.getTotalValue(aliceCTS[1], aliceCTS[0])).toString())
    // console.log('aliceDebt: ', aliceCTS[2].toString())
    // console.log('----------- \n\n')
    // Confirm not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // L1: B liquidated
    const txWB = await troveManager.liquidate(bob)
    tx = await txWB.wait()
    assert.isTrue(tx.status === 1)
    assert.isFalse(await sortedTroves.contains(bob))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // activePoolColl = await activePool.getTotalCollateral()
    // defaultPoolColl = await defaultPool.getTotalCollateral()
    // systemColl = await contracts.borrowerOperations.getEntireSystemColl()
    // console.log('Liquidated Bob & price back to 200: \n')

    // console.log('collVC in active pool: ', (await collateralManager.getTotalValue(activePoolColl[1], activePoolColl[2])).toString())
    // console.log('debt in active pool: ', (await activePool.getUSDEDebt()).toString())
    // console.log('collVC in default pool: ', (await collateralManager.getTotalValue(defaultPoolColl[1], defaultPoolColl[2])).toString())
    // console.log('debt in default pool: ', (await defaultPool.getUSDEDebt()).toString())
    // console.log('TCR: ', (await contracts.collateralManager.getTCR()).toString())
    // console.log('entire system VC: ', (await collateralManager.getTotalValue(systemColl[0], systemColl[1])).toString())
    // console.log('entire system debt: ', (await contracts.borrowerOperations.getEntireSystemDebt()).toString())

    // bobCTS = (await contracts.troveManager.getCurrentTroveAmounts(bob))
    // console.log('bobICR: ', (await th.getCurrentICR(contracts, bob)).toString())
    // console.log('bobVC: ', (await collateralManager.getTotalValue(bobCTS[1], bobCTS[0])).toString())
    // console.log('bobDebt: ', bobCTS[2].toString())

    // aliceCTS = (await contracts.troveManager.getCurrentTroveAmounts(alice))
    // console.log('aliceICR: ', (await th.getCurrentICR(contracts, alice)).toString())
    // console.log('aliceVC: ', (await collateralManager.getTotalValue(aliceCTS[1], aliceCTS[0])).toString())
    // console.log('aliceDebt: ', aliceCTS[2].toString())
    // console.log('----------- \n\n')
    // C, D open troves
    const {
      collateral: C_coll
    } = await openTrove({
      ICR: toBN(dec(400, 16)),
      signer: Carol,
      extraParams: {
        from: carol
      }
    })
    const {
      collateral: D_coll
    } = await openTrove({
      ICR: toBN(dec(210, 16)),
      signer: Dennis,
      extraParams: {
        from: dennis
      }
    })


    // const test = (await troveManager.getPendingCollReward(alice))[0][0];
    // console.log('test: ', test.toString())


    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Confirm not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // L2: D Liquidated
    const txWD = await troveManager.liquidate(dennis)
    tx = await txWD.wait()
    assert.isTrue(tx.status === 1)
    assert.isFalse(await sortedTroves.contains(dennis))


    await priceFeed.setPrice(dec(200, 18))

    // Get entire coll of A and C
    const alice_Coll = ((await troveManager.getTroveColls(alice))[0][0]
        .add((await troveManager.getPendingCollReward(alice))[0][0]))
      .toString()
    const carol_Coll = ((await troveManager.getTroveColls(carol))[0][0]
        .add((await troveManager.getPendingCollReward(carol))[0][0]))
      .toString()


    /* Expected collateral:
    A: Alice receives 0.995 ETH from L1, and ~3/5*0.995 ETH from L2.
    expect aliceColl = 2 + 0.995 + 2.995/4.995 * 0.995 = 3.5916 ETH
    C: Carol receives ~2/5 ETH from L2
    expect carolColl = 2 + 2/4.995 * 0.995 = 2.398 ETH
    Total coll = 4 + 2 * 0.995 ETH
    */
    const A_collAfterL1 = A_coll.add(th.applyLiquidationFee(B_coll))
    assert.isAtMost(th.getDifference(alice_Coll, A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(D_coll)).div(A_collAfterL1.add(C_coll)))), Number(dec(150, 20)))
    assert.isAtMost(th.getDifference(carol_Coll, C_coll.add(C_coll.mul(th.applyLiquidationFee(D_coll)).div(A_collAfterL1.add(C_coll)))), Number(dec(100, 20)))

    const entireSystemColl = (await activePool.getCollateralAmount(weth.address)).add(await defaultPool.getCollateralAmount(weth.address)).toString()
    assert.equal(entireSystemColl, A_coll.add(C_coll).add(th.applyLiquidationFee(B_coll.add(D_coll))))


    // check USDE gas compensation
    assert.equal((await usdeToken.balanceOf(owner)).toString(), dec(400, 18))
  })

  it("multi redistribution: A, B Open. B Liquidated. C, D Open. D Liquidated. Distributes correct rewards", async () => {
    // A, B open trove
    const oracles = [contracts.priceFeedETH, contracts.priceFeedSTETH]
    let a_wethToMint = toBN(dec(200, 17));
    let a_stethToMint = toBN(dec(200, 17));

    let a_colls = [contracts.weth, contracts.steth];
    let a_amounts = [a_wethToMint, a_stethToMint];

    const {
      amounts: A_amounts
    } = await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(400, 16)),
      colls: a_colls,
      amounts: a_amounts,
      signer: Alice,
      extraParams: {
        from: alice
      }
    });

    let b_wethToMint = toBN(dec(100, 17));
    let b_stethToMint = toBN(dec(100, 17));

    let b_colls = [contracts.weth, contracts.steth];
    let b_amounts = [b_wethToMint, b_stethToMint];

    const {
      amounts: B_amounts
    } = await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(210, 16)),
      colls: b_colls,
      amounts: b_amounts,
      signer: Bob,
      extraParams: {
        from: bob
      }
    });

    // console.log('\n----------- ')
    // console.log('With 2 colls: \n')

    // let activePoolColl = await activePool.getTotalCollateral()
    // let defaultPoolColl = await defaultPool.getTotalCollateral()
    // let systemColl = await contracts.borrowerOperations.getEntireSystemColl()

    // console.log('collVC in active pool: ', (await collateralManager.getTotalValue(activePoolColl[1], activePoolColl[2])).toString())
    // console.log('total amount weth in active pool', (await weth.balanceOf(activePool.address)).toString())
    // console.log('total amount steth in active pool', (await contracts.steth.balanceOf(activePool.address)).toString())
    // console.log('debt in active pool: ', (await activePool.getUSDEDebt()).toString())
    // console.log('collVC in default pool: ', (await collateralManager.getTotalValue(defaultPoolColl[1], defaultPoolColl[2])).toString())
    // console.log('total amount weth in default pool', (await weth.balanceOf(defaultPool.address)).toString())
    // console.log('total amount steth in default pool', (await contracts.steth.balanceOf(defaultPool.address)).toString())
    // console.log('debt in default pool: ', (await defaultPool.getUSDEDebt()).toString())
    // console.log('TCR: ', (await contracts.collateralManager.getTCR()).toString())
    // console.log('entire system VC: ', (await collateralManager.getTotalValue(systemColl[0], systemColl[1])).toString())
    // console.log('entire system eth amount: ', (await weth.balanceOf(activePool.address)).add((await weth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system steth amount: ', (await contracts.steth.balanceOf(activePool.address)).add((await contracts.steth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system debt: ', (await contracts.borrowerOperations.getEntireSystemDebt()).toString())

    // bobCTS = (await contracts.troveManager.getCurrentTroveAmounts(bob))
    // console.log('bobICR: ', (await th.getCurrentICR(contracts, bob)).toString())
    // console.log('bobVC: ', (await collateralManager.getTotalValue(bobCTS[1], bobCTS[0])).toString())
    // console.log('bob ETH Amount:', bobCTS[0][0].toString())
    // console.log('bob STETH Amount:', bobCTS[0][1].toString())
    // console.log('bobDebt: ', bobCTS[2].toString())

    // aliceCTS = (await contracts.troveManager.getCurrentTroveAmounts(alice))
    // console.log('aliceICR: ', (await th.getCurrentICR(contracts, alice)).toString())
    // console.log('aliceVC: ', (await collateralManager.getTotalValue(aliceCTS[1], aliceCTS[0])).toString())
    // console.log('alice ETH Amount:', aliceCTS[0][0].toString())
    // console.log('alice SETH Amount:', aliceCTS[0][1].toString())
    // console.log('aliceDebt: ', aliceCTS[2].toString())
    // console.log('----------- \n\n')

    // // Price drops to 100 $/E
    await contracts.priceFeedETH.setPrice(dec(100, 18))

    // console.log('\n----------- ')
    // console.log('After price drop: \n')

    // activePoolColl = await activePool.getTotalCollateral()
    // defaultPoolColl = await defaultPool.getTotalCollateral()
    // systemColl = await contracts.borrowerOperations.getEntireSystemColl()

    // console.log('collVC in active pool: ', (await collateralManager.getTotalValue(activePoolColl[1], activePoolColl[2])).toString())
    // console.log('total amount weth in active pool', (await weth.balanceOf(activePool.address)).toString())
    // console.log('total amount steth in active pool', (await contracts.steth.balanceOf(activePool.address)).toString())
    // console.log('debt in active pool: ', (await activePool.getUSDEDebt()).toString())
    // console.log('collVC in default pool: ', (await collateralManager.getTotalValue(defaultPoolColl[1], defaultPoolColl[2])).toString())
    // console.log('total amount weth in default pool', (await weth.balanceOf(defaultPool.address)).toString())
    // console.log('total amount steth in default pool', (await contracts.steth.balanceOf(defaultPool.address)).toString())
    // console.log('debt in default pool: ', (await defaultPool.getUSDEDebt()).toString())
    // console.log('TCR: ', (await contracts.collateralManager.getTCR()).toString())
    // console.log('entire system VC: ', (await collateralManager.getTotalValue(systemColl[0], systemColl[1])).toString())
    // console.log('entire system eth amount: ', (await weth.balanceOf(activePool.address)).add((await weth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system steth amount: ', (await contracts.steth.balanceOf(activePool.address)).add((await contracts.steth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system debt: ', (await contracts.borrowerOperations.getEntireSystemDebt()).toString())

    // bobCTS = (await contracts.troveManager.getCurrentTroveAmounts(bob))
    // console.log('bobICR: ', (await th.getCurrentICR(contracts, bob)).toString())
    // console.log('bobVC: ', (await collateralManager.getTotalValue(bobCTS[1], bobCTS[0])).toString())
    // console.log('bob ETH Amount:', bobCTS[0][0].toString())
    // console.log('bob STETH Amount:', bobCTS[0][1].toString())
    // console.log('bobDebt: ', bobCTS[2].toString())

    // aliceCTS = (await contracts.troveManager.getCurrentTroveAmounts(alice))
    // console.log('aliceICR: ', (await th.getCurrentICR(contracts, alice)).toString())
    // console.log('aliceVC: ', (await collateralManager.getTotalValue(aliceCTS[1], aliceCTS[0])).toString())
    // console.log('alice ETH Amount:', aliceCTS[0][0].toString())
    // console.log('alice SETH Amount:', aliceCTS[0][1].toString())
    // console.log('aliceDebt: ', aliceCTS[2].toString())
    // console.log('----------- \n\n')

    // // Confirm not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // // L1: B liquidated
    const txWB = await troveManager.liquidate(bob)
    tx = await txWB.wait()
    assert.isTrue(tx.status === 1)
    assert.isFalse(await sortedTroves.contains(bob))

    // // Price bounces back to 200 $/E
    await contracts.priceFeedETH.setPrice(dec(200, 18))

    // console.log('\n----------- ')
    // console.log('After liquidate bob: \n')

    // activePoolColl = await activePool.getTotalCollateral()
    // defaultPoolColl = await defaultPool.getTotalCollateral()
    // systemColl = await contracts.borrowerOperations.getEntireSystemColl()

    // console.log('collVC in active pool: ', (await collateralManager.getTotalValue(activePoolColl[1], activePoolColl[2])).toString())
    // console.log('total amount weth in active pool', (await weth.balanceOf(activePool.address)).toString())
    // console.log('total amount steth in active pool', (await contracts.steth.balanceOf(activePool.address)).toString())
    // console.log('debt in active pool: ', (await activePool.getUSDEDebt()).toString())
    // console.log('collVC in default pool: ', (await collateralManager.getTotalValue(defaultPoolColl[1], defaultPoolColl[2])).toString())
    // console.log('total amount weth in default pool', (await weth.balanceOf(defaultPool.address)).toString())
    // console.log('total amount steth in default pool', (await contracts.steth.balanceOf(defaultPool.address)).toString())
    // console.log('debt in default pool: ', (await defaultPool.getUSDEDebt()).toString())
    // console.log('TCR: ', (await contracts.collateralManager.getTCR()).toString())
    // console.log('entire system VC: ', (await collateralManager.getTotalValue(systemColl[0], systemColl[1])).toString())
    // console.log('entire system eth amount: ', (await weth.balanceOf(activePool.address)).add((await weth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system steth amount: ', (await contracts.steth.balanceOf(activePool.address)).add((await contracts.steth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system debt: ', (await contracts.borrowerOperations.getEntireSystemDebt()).toString())

    // bobCTS = (await contracts.troveManager.getCurrentTroveAmounts(bob))
    // console.log('bobICR: ', (await th.getCurrentICR(contracts, bob)).toString())
    // console.log('bobVC: ', (await collateralManager.getTotalValue(bobCTS[1], bobCTS[0])).toString())
    // // console.log('bob ETH Amount:', bobCTS[0][0].toString())
    // // console.log('bob STETH Amount:', bobCTS[0][1].toString())
    // console.log('bobDebt: ', bobCTS[2].toString())

    // aliceCTS = (await contracts.troveManager.getCurrentTroveAmounts(alice))
    // console.log('aliceICR: ', (await th.getCurrentICR(contracts, alice)).toString())
    // console.log('aliceVC: ', (await collateralManager.getTotalValue(aliceCTS[1], aliceCTS[0])).toString())
    // console.log('alice ETH Amount:', aliceCTS[0][0].toString())
    // console.log('alice SETH Amount:', aliceCTS[0][1].toString())
    // console.log('aliceDebt: ', aliceCTS[2].toString())
    // console.log('----------- \n\n')

    const {
      amounts: C_amounts
    } = await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(400, 16)),
      colls: a_colls,
      amounts: a_amounts,
      signer: Carol,
      extraParams: {
        from: carol
      }
    });

    const {
      amounts: D_amounts
    } = await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(210, 16)),
      colls: b_colls,
      amounts: b_amounts,
      signer: Dennis,
      extraParams: {
        from: dennis
      }
    });

    // // Price drops to 100 $/E
    await contracts.priceFeedETH.setPrice(dec(100, 18))

    // // Confirm not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // // L2: D Liquidated
    const txWD = await troveManager.liquidate(dennis)
    tx = await txWD.wait()
    assert.isTrue(tx.status === 1)
    assert.isFalse(await sortedTroves.contains(dennis))

    await contracts.priceFeedETH.setPrice(dec(200, 18))

    // Get entire coll of A and C
    const alice_ETH = (await getTroveEntireColl(alice))[0].toString()
    const carol_ETH = (await getTroveEntireColl(carol))[0].toString()

    // /* Expected collateral:
    // A: Alice receives 0.995 ETH from L1, and ~3/5*0.995 ETH from L2.
    // expect aliceColl = 2 + 0.995 + 2.995/4.995 * 0.995 = 3.5916 ETH

    // C: Carol receives ~2/5 ETH from L2
    // expect carolColl = 2 + 2/4.995 * 0.995 = 2.398 ETH

    // Total coll = 4 + 2 * 0.995 ETH
    // */
    const A_ETHAfterL1 = A_amounts[0].add(th.applyLiquidationFee(B_amounts[0]))
    assert.isAtMost(th.getDifference(alice_ETH, A_ETHAfterL1.add(A_ETHAfterL1.mul(th.applyLiquidationFee(D_amounts[0])).div(A_ETHAfterL1.add(C_amounts[0])))), Number(dec(150, 20)))
    assert.isAtMost(th.getDifference(carol_ETH, C_amounts[0].add(C_amounts[0].mul(th.applyLiquidationFee(D_amounts[0])).div(A_ETHAfterL1.add(C_amounts[0])))), Number(dec(100, 20)))

    // // const entireSystemColl = Number(await contracts.borrowerOperations.getEntireSystemColl())

    // // assert.equal(entireSystemColl, Number(A_coll.add(C_coll).add(th.applyLiquidationFee(B_coll.add(D_coll))))*2*100)

    const entireSystemETH = (await activePool.getCollateralAmount(steth.address)).add(await defaultPool.getCollateralAmount(weth.address)).toString()
    assert.equal(entireSystemETH, A_amounts[0].add(C_amounts[0]).add(th.applyLiquidationFee(B_amounts[0].add(D_amounts[0]))))

    const alice_STETH = (await getTroveEntireColl(alice))[1].toString()
    const carol_STETH = (await getTroveEntireColl(carol))[1].toString()

    // /* Expected collateral:
    // A: Alice receives 0.995 ETH from L1, and ~3/5*0.995 ETH from L2.
    // expect aliceColl = 2 + 0.995 + 2.995/4.995 * 0.995 = 3.5916 ETH

    // C: Carol receives ~2/5 ETH from L2
    // expect carolColl = 2 + 2/4.995 * 0.995 = 2.398 ETH

    // Total coll = 4 + 2 * 0.995 ETH
    // */
    const A_STETHAfterL1 = A_amounts[1].add(th.applyLiquidationFee(B_amounts[1]))
    assert.isAtMost(th.getDifference(alice_STETH, A_STETHAfterL1.add(A_STETHAfterL1.mul(th.applyLiquidationFee(D_amounts[1])).div(A_STETHAfterL1.add(C_amounts[1])))), Number(dec(150, 20)))
    assert.isAtMost(th.getDifference(carol_STETH, C_amounts[1].add(C_amounts[0].mul(th.applyLiquidationFee(D_amounts[1])).div(A_STETHAfterL1.add(C_amounts[1])))), Number(dec(100, 20)))

    // // const entireSystemColl = Number(await contracts.borrowerOperations.getEntireSystemColl())

    // // assert.equal(entireSystemColl, Number(A_coll.add(C_coll).add(th.applyLiquidationFee(B_coll.add(D_coll))))*2*100)

    const entireSystemSTETH = (await activePool.getCollateralAmount(steth.address)).add(await defaultPool.getCollateralAmount(steth.address)).toString()
    assert.equal(entireSystemSTETH, A_amounts[1].add(C_amounts[1]).add(th.applyLiquidationFee(B_amounts[1].add(D_amounts[1]))))

    // check USDE gas compensation
    assert.equal((await usdeToken.balanceOf(owner)).toString(), dec(400, 18))
  })

  it("multi redistribution: A open with ETH, B open with STETH, C open with both, liquidate C", async () => {
    let a_wethToMint = toBN(dec(400, 17));

    let a_colls = [contracts.weth];
    let a_amounts = [a_wethToMint];

    const {
      amounts: A_amounts
    } = await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(400, 16)),
      colls: a_colls,
      amounts: a_amounts,
      signer: Alice,
      extraParams: {
        from: alice
      }
    });

    let b_stethToMint = toBN(dec(400, 17));

    let b_colls = [contracts.steth];
    let b_amounts = [b_stethToMint];

    const {
      amounts: B_amounts
    } = await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(400, 16)),
      colls: b_colls,
      amounts: b_amounts,
      signer: Bob,
      extraParams: {
        from: bob
      }
    });

    let c_wethToMint = toBN(dec(100, 17));
    let c_stethToMint = toBN(dec(100, 17));

    let c_colls = [contracts.weth, contracts.steth];
    let c_amounts = [c_wethToMint, c_stethToMint];


    const {
      amounts: C_amounts
    } = await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(210, 16)),
      colls: c_colls,
      amounts: c_amounts,
      signer: Carol,
      extraParams: {
        from: carol
      }
    });

    // console.log('\n----------- ')
    // console.log('With 2 colls: \n')

    // let activePoolColl = await activePool.getTotalCollateral()
    // let defaultPoolColl = await defaultPool.getTotalCollateral()
    // let systemColl = await contracts.borrowerOperations.getEntireSystemColl()

    // console.log('collVC in active pool: ', (await collateralManager.getTotalValue(activePoolColl[1], activePoolColl[2])).toString())
    // console.log('total amount weth in active pool', (await weth.balanceOf(activePool.address)).toString())
    // console.log('total amount steth in active pool', (await contracts.steth.balanceOf(activePool.address)).toString())
    // console.log('debt in active pool: ', (await activePool.getUSDEDebt()).toString())
    // console.log('collVC in default pool: ', (await collateralManager.getTotalValue(defaultPoolColl[1], defaultPoolColl[2])).toString())
    // console.log('total amount weth in default pool', (await weth.balanceOf(defaultPool.address)).toString())
    // console.log('total amount steth in default pool', (await contracts.steth.balanceOf(defaultPool.address)).toString())
    // console.log('debt in default pool: ', (await defaultPool.getUSDEDebt()).toString())
    // console.log('TCR: ', (await contracts.collateralManager.getTCR()).toString())
    // console.log('entire system VC: ', (await contracts.borrowerOperations.getEntireSystemColl()).toString())
    // console.log('entire system eth amount: ', (await weth.balanceOf(activePool.address)).add((await weth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system steth amount: ', (await contracts.steth.balanceOf(activePool.address)).add((await contracts.steth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system debt: ', (await collateralManager.getTotalValue(systemColl[0], systemColl[1])).toString())

    // bobCTS = (await contracts.troveManager.getCurrentTroveAmounts(bob))
    // console.log('bobICR: ', (await th.getCurrentICR(contracts, bob)).toString())
    // console.log('bobVC: ', (await collateralManager.getTotalValue(bobCTS[1], bobCTS[0])).toString())
    // console.log('bob ETH Amount:', bobCTS[0][0].toString())
    // //console.log('bob STETH Amount:', bobCTS[0][1].toString())
    // console.log('bobDebt: ', bobCTS[2].toString())

    // aliceCTS = (await contracts.troveManager.getCurrentTroveAmounts(alice))
    // console.log('aliceICR: ', (await th.getCurrentICR(contracts, alice)).toString())
    // console.log('aliceVC: ', (await collateralManager.getTotalValue(aliceCTS[1], aliceCTS[0])).toString())
    // console.log('alice ETH Amount:', aliceCTS[0][0].toString())
    // //console.log('alice STETH Amount:', aliceCTS[0][1].toString())
    // console.log('aliceDebt: ', aliceCTS[2].toString())

    // carolCTS = (await contracts.troveManager.getCurrentTroveAmounts(carol))
    // console.log('carolICR: ', (await th.getCurrentICR(contracts, carol)).toString())
    // console.log('carolVC: ', (await collateralManager.getTotalValue(carolCTS[1], carolCTS[0])).toString())
    // console.log('carol ETH Amount:', carolCTS[0][0].toString())
    // console.log('carol STETH Amount:', carolCTS[0][1].toString())
    // console.log('carolDebt: ', carolCTS[2].toString())

    // console.log('----------- \n\n')

    // // Price drops to 100 $/E
    await contracts.priceFeedETH.setPrice(dec(100, 18))

    // console.log('\n----------- ')
    // console.log('After price drop: \n')

    // activePoolColl = await activePool.getTotalCollateral()
    // defaultPoolColl = await defaultPool.getTotalCollateral()
    // systemColl = await contracts.borrowerOperations.getEntireSystemColl()

    // console.log('collVC in active pool: ', (await collateralManager.getTotalValue(activePoolColl[1], activePoolColl[2])).toString())
    // console.log('total amount weth in active pool', (await weth.balanceOf(activePool.address)).toString())
    // console.log('total amount steth in active pool', (await contracts.steth.balanceOf(activePool.address)).toString())
    // console.log('debt in active pool: ', (await activePool.getUSDEDebt()).toString())
    // console.log('collVC in default pool: ', (await collateralManager.getTotalValue(defaultPoolColl[1], defaultPoolColl[2])).toString())
    // console.log('total amount weth in default pool', (await weth.balanceOf(defaultPool.address)).toString())
    // console.log('total amount steth in default pool', (await contracts.steth.balanceOf(defaultPool.address)).toString())
    // console.log('debt in default pool: ', (await defaultPool.getUSDEDebt()).toString())
    // console.log('TCR: ', (await contracts.collateralManager.getTCR()).toString())
    // console.log('entire system VC: ', (await contracts.borrowerOperations.getEntireSystemColl()).toString())
    // console.log('entire system eth amount: ', (await weth.balanceOf(activePool.address)).add((await weth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system steth amount: ', (await contracts.steth.balanceOf(activePool.address)).add((await contracts.steth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system debt: ', (await collateralManager.getTotalValue(systemColl[0], systemColl[1])).toString())

    // bobCTS = (await contracts.troveManager.getCurrentTroveAmounts(bob))
    // console.log('bobICR: ', (await th.getCurrentICR(contracts, bob)).toString())
    // console.log('bobVC: ', (await collateralManager.getTotalValue(bobCTS[1], bobCTS[0])).toString())
    // console.log('bob ETH Amount:', bobCTS[0][0].toString())
    // //console.log('bob STETH Amount:', bobCTS[0][1].toString())
    // console.log('bobDebt: ', bobCTS[2].toString())

    // aliceCTS = (await contracts.troveManager.getCurrentTroveAmounts(alice))
    // console.log('aliceICR: ', (await th.getCurrentICR(contracts, alice)).toString())
    // console.log('aliceVC: ', (await collateralManager.getTotalValue(aliceCTS[1], aliceCTS[0])).toString())
    // console.log('alice ETH Amount:', aliceCTS[0][0].toString())
    // //console.log('alice STETH Amount:', aliceCTS[0][1].toString())
    // console.log('aliceDebt: ', aliceCTS[2].toString())

    // carolCTS = (await contracts.troveManager.getCurrentTroveAmounts(carol))
    // console.log('carolICR: ', (await th.getCurrentICR(contracts, carol)).toString())
    // console.log('carolVC: ', (await collateralManager.getTotalValue(carolCTS[1], carolCTS[0])).toString())
    // console.log('carol ETH Amount:', carolCTS[0][0].toString())
    // console.log('carol STETH Amount:', carolCTS[0][1].toString())
    // console.log('carolDebt: ', carolCTS[2].toString())

    // console.log('----------- \n\n')

    // Confirm not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // L1: C liquidated
    const txWB = await troveManager.liquidate(carol)
    tx = await txWB.wait()
    assert.isTrue(tx.status === 1)
    assert.isFalse(await sortedTroves.contains(carol))

    // Price bounces back to 200 $/E
    await contracts.priceFeedETH.setPrice(dec(200, 18))

    // console.log('\n----------- ')
    // console.log('After price drop: \n')

    // activePoolColl = await activePool.getTotalCollateral()
    // defaultPoolColl = await defaultPool.getTotalCollateral()
    // systemColl = await contracts.borrowerOperations.getEntireSystemColl()

    // console.log('collVC in active pool: ', (await collateralManager.getTotalValue(activePoolColl[1], activePoolColl[2])).toString())
    // console.log('total amount weth in active pool', (await weth.balanceOf(activePool.address)).toString())
    // console.log('total amount steth in active pool', (await contracts.steth.balanceOf(activePool.address)).toString())
    // console.log('debt in active pool: ', (await activePool.getUSDEDebt()).toString())
    // console.log('collVC in default pool: ', (await collateralManager.getTotalValue(defaultPoolColl[1], defaultPoolColl[2])).toString())
    // console.log('total amount weth in default pool', (await weth.balanceOf(defaultPool.address)).toString())
    // console.log('total amount steth in default pool', (await contracts.steth.balanceOf(defaultPool.address)).toString())
    // console.log('debt in default pool: ', (await defaultPool.getUSDEDebt()).toString())
    // console.log('TCR: ', (await contracts.collateralManager.getTCR()).toString())
    // console.log('entire system VC: ', (await contracts.borrowerOperations.getEntireSystemColl()).toString())
    // console.log('entire system eth amount: ', (await weth.balanceOf(activePool.address)).add((await weth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system steth amount: ', (await contracts.steth.balanceOf(activePool.address)).add((await contracts.steth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system debt: ', (await collateralManager.getTotalValue(systemColl[0], systemColl[1])).toString())

    // bobCTS = (await contracts.troveManager.getCurrentTroveAmounts(bob))
    // console.log('bobICR: ', (await th.getCurrentICR(contracts, bob)).toString())
    // console.log('bobVC: ', (await collateralManager.getTotalValue(bobCTS[1], bobCTS[0])).toString())
    // console.log('bob ETH Amount:', bobCTS[0][0].toString())
    // //console.log('bob STETH Amount:', bobCTS[0][1].toString())
    // console.log('bobDebt: ', bobCTS[2].toString())

    // aliceCTS = (await contracts.troveManager.getCurrentTroveAmounts(alice))
    // console.log('aliceICR: ', (await th.getCurrentICR(contracts, alice)).toString())
    // console.log('aliceVC: ', (await collateralManager.getTotalValue(aliceCTS[1], aliceCTS[0])).toString())
    // console.log('alice ETH Amount:', aliceCTS[0][0].toString())
    // //console.log('alice STETH Amount:', aliceCTS[0][1].toString())
    // console.log('aliceDebt: ', aliceCTS[2].toString())

    // carolCTS = (await contracts.troveManager.getCurrentTroveAmounts(carol))
    // console.log('carolICR: ', (await th.getCurrentICR(contracts, carol)).toString())
    // console.log('carolVC: ', (await collateralManager.getTotalValue(carolCTS[1], carolCTS[0])).toString())
    // // console.log('carol ETH Amount:', carolCTS[0][0].toString())
    // // console.log('carol STETH Amount:', carolCTS[0][1].toString())
    // console.log('carolDebt: ', carolCTS[2].toString())

    // console.log('----------- \n\n')

    const alice_ETH = (await getTroveEntireColl(alice))[0].toString()
    const bob_STETH = (await getTroveEntireColl(bob))[1].toString()

    /* Expected collateral:
    A: Alice receives 0.995 ETH from L1, and ~3/5*0.995 ETH from L2.
    expect aliceColl = 2 + 0.995 + 2.995/4.995 * 0.995 = 3.5916 ETH

    C: Carol receives ~2/5 ETH from L2
    expect carolColl = 2 + 2/4.995 * 0.995 = 2.398 ETH

    Total coll = 4 + 2 * 0.995 ETH
    */
    const A_ETHAfterL1 = A_amounts[0].add(th.applyLiquidationFee(C_amounts[0]))
    assert.isAtMost(th.getDifference(alice_ETH, A_ETHAfterL1), Number(dec(150, 20)))

    const entireSystemETH = (await activePool.getCollateralAmount(weth.address)).add(await defaultPool.getCollateralAmount(weth.address)).toString()
    assert.equal(entireSystemETH, A_amounts[0].add(th.applyLiquidationFee(C_amounts[0])))

    const B_STETHAfterL1 = B_amounts[0].add(th.applyLiquidationFee(C_amounts[1]))
    assert.isAtMost(th.getDifference(bob_STETH, B_STETHAfterL1), Number(dec(150, 20)))

    const entireSystemSTETH = (await activePool.getCollateralAmount(steth.address)).add(await defaultPool.getCollateralAmount(steth.address)).toString()
    assert.equal(entireSystemSTETH, B_amounts[0].add(th.applyLiquidationFee(C_amounts[1])))
    assert.equal((await usdeToken.balanceOf(owner)).toString(), dec(200, 18))
  })

  it("multi redistribution revert(): A open with ETH, B open with STETH, C open with both, liquidate C, then liquidate B", async () => {
    let a_wethToMint = toBN(dec(400, 17));

    let a_colls = [contracts.weth];
    let a_amounts = [a_wethToMint];

    const {
      amounts: A_amounts
    } = await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(400, 16)),
      colls: a_colls,
      amounts: a_amounts,
      signer: Alice,
      extraParams: {
        from: alice
      }
    });

    let b_stethToMint = toBN(dec(400, 17));

    let b_colls = [contracts.steth];
    let b_amounts = [b_stethToMint];

    const {
      amounts: B_amounts
    } = await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(210, 16)),
      colls: b_colls,
      amounts: b_amounts,
      signer: Bob,
      extraParams: {
        from: bob
      }
    });

    let c_wethToMint = toBN(dec(100, 17));
    let c_stethToMint = toBN(dec(100, 17));

    let c_colls = [contracts.weth, contracts.steth];
    let c_amounts = [c_wethToMint, c_stethToMint];


    const {
      amounts: C_amounts
    } = await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(210, 16)),
      colls: c_colls,
      amounts: c_amounts,
      signer: Carol,
      extraParams: {
        from: carol
      }
    });

    // console.log('\n----------- ')
    // console.log('With 2 colls: \n')

    // let activePoolColl = await activePool.getTotalCollateral()
    // let defaultPoolColl = await defaultPool.getTotalCollateral()
    // let systemColl = await contracts.borrowerOperations.getEntireSystemColl()

    // console.log('collVC in active pool: ', (await collateralManager.getTotalValue(activePoolColl[1], activePoolColl[2])).toString())
    // console.log('total amount weth in active pool', (await weth.balanceOf(activePool.address)).toString())
    // console.log('total amount steth in active pool', (await contracts.steth.balanceOf(activePool.address)).toString())
    // console.log('debt in active pool: ', (await activePool.getUSDEDebt()).toString())
    // console.log('collVC in default pool: ', (await collateralManager.getTotalValue(defaultPoolColl[1], defaultPoolColl[2])).toString())
    // console.log('total amount weth in default pool', (await weth.balanceOf(defaultPool.address)).toString())
    // console.log('total amount steth in default pool', (await contracts.steth.balanceOf(defaultPool.address)).toString())
    // console.log('debt in default pool: ', (await defaultPool.getUSDEDebt()).toString())
    // console.log('TCR: ', (await contracts.collateralManager.getTCR()).toString())
    // console.log('entire system VC: ', (await contracts.borrowerOperations.getEntireSystemColl()).toString())
    // console.log('entire system eth amount: ', (await weth.balanceOf(activePool.address)).add((await weth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system steth amount: ', (await contracts.steth.balanceOf(activePool.address)).add((await contracts.steth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system debt: ', (await collateralManager.getTotalValue(systemColl[0], systemColl[1])).toString())

    // bobCTS = (await contracts.troveManager.getCurrentTroveAmounts(bob))
    // console.log('bobICR: ', (await th.getCurrentICR(contracts, bob)).toString())
    // console.log('bobVC: ', (await collateralManager.getTotalValue(bobCTS[1], bobCTS[0])).toString())
    // console.log('bob ETH Amount:', bobCTS[0][0].toString())
    // //console.log('bob STETH Amount:', bobCTS[0][1].toString())
    // console.log('bobDebt: ', bobCTS[2].toString())

    // aliceCTS = (await contracts.troveManager.getCurrentTroveAmounts(alice))
    // console.log('aliceICR: ', (await th.getCurrentICR(contracts, alice)).toString())
    // console.log('aliceVC: ', (await collateralManager.getTotalValue(aliceCTS[1], aliceCTS[0])).toString())
    // console.log('alice ETH Amount:', aliceCTS[0][0].toString())
    // //console.log('alice STETH Amount:', aliceCTS[0][1].toString())
    // console.log('aliceDebt: ', aliceCTS[2].toString())

    // carolCTS = (await contracts.troveManager.getCurrentTroveAmounts(carol))
    // console.log('carolICR: ', (await th.getCurrentICR(contracts, carol)).toString())
    // console.log('carolVC: ', (await collateralManager.getTotalValue(carolCTS[1], carolCTS[0])).toString())
    // console.log('carol ETH Amount:', carolCTS[0][0].toString())
    // console.log('carol STETH Amount:', carolCTS[0][1].toString())
    // console.log('carolDebt: ', carolCTS[2].toString())

    // console.log('----------- \n\n')

    // // Price drops to 100 $/E
    await contracts.priceFeedETH.setPrice(dec(100, 18))

    // console.log('\n----------- ')
    // console.log('After price drop: \n')

    // activePoolColl = await activePool.getTotalCollateral()
    // defaultPoolColl = await defaultPool.getTotalCollateral()
    // systemColl = await contracts.borrowerOperations.getEntireSystemColl()

    // console.log('collVC in active pool: ', (await collateralManager.getTotalValue(activePoolColl[1], activePoolColl[2])).toString())
    // console.log('total amount weth in active pool', (await weth.balanceOf(activePool.address)).toString())
    // console.log('total amount steth in active pool', (await contracts.steth.balanceOf(activePool.address)).toString())
    // console.log('debt in active pool: ', (await activePool.getUSDEDebt()).toString())
    // console.log('collVC in default pool: ', (await collateralManager.getTotalValue(defaultPoolColl[1], defaultPoolColl[2])).toString())
    // console.log('total amount weth in default pool', (await weth.balanceOf(defaultPool.address)).toString())
    // console.log('total amount steth in default pool', (await contracts.steth.balanceOf(defaultPool.address)).toString())
    // console.log('debt in default pool: ', (await defaultPool.getUSDEDebt()).toString())
    // console.log('TCR: ', (await contracts.collateralManager.getTCR()).toString())
    // console.log('entire system VC: ', (await contracts.borrowerOperations.getEntireSystemColl()).toString())
    // console.log('entire system eth amount: ', (await weth.balanceOf(activePool.address)).add((await weth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system steth amount: ', (await contracts.steth.balanceOf(activePool.address)).add((await contracts.steth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system debt: ', (await collateralManager.getTotalValue(systemColl[0], systemColl[1])).toString())

    // bobCTS = (await contracts.troveManager.getCurrentTroveAmounts(bob))
    // console.log('bobICR: ', (await th.getCurrentICR(contracts, bob)).toString())
    // console.log('bobVC: ', (await collateralManager.getTotalValue(bobCTS[1], bobCTS[0])).toString())
    // console.log('bob ETH Amount:', bobCTS[0][0].toString())
    // //console.log('bob STETH Amount:', bobCTS[0][1].toString())
    // console.log('bobDebt: ', bobCTS[2].toString())

    // aliceCTS = (await contracts.troveManager.getCurrentTroveAmounts(alice))
    // console.log('aliceICR: ', (await th.getCurrentICR(contracts, alice)).toString())
    // console.log('aliceVC: ', (await collateralManager.getTotalValue(aliceCTS[1], aliceCTS[0])).toString())
    // console.log('alice ETH Amount:', aliceCTS[0][0].toString())
    // //console.log('alice STETH Amount:', aliceCTS[0][1].toString())
    // console.log('aliceDebt: ', aliceCTS[2].toString())

    // carolCTS = (await contracts.troveManager.getCurrentTroveAmounts(carol))
    // console.log('carolICR: ', (await th.getCurrentICR(contracts, carol)).toString())
    // console.log('carolVC: ', (await collateralManager.getTotalValue(carolCTS[1], carolCTS[0])).toString())
    // console.log('carol ETH Amount:', carolCTS[0][0].toString())
    // console.log('carol STETH Amount:', carolCTS[0][1].toString())
    // console.log('carolDebt: ', carolCTS[2].toString())

    // console.log('----------- \n\n')

    // Confirm not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // L1: C liquidated
    const txWB = await troveManager.liquidate(carol)
    tx = await txWB.wait()
    assert.isTrue(tx.status === 1)
    assert.isFalse(await sortedTroves.contains(carol))
    await th.assertRevert(troveManager.liquidate(bob), "ZeroValue")
    assert.isTrue(await sortedTroves.contains(bob))

    // Price bounces back to 200 $/E
    await contracts.priceFeedETH.setPrice(dec(200, 18))

    // console.log('\n----------- ')
    // console.log('After price drop: \n')

    // activePoolColl = await activePool.getTotalCollateral()
    // defaultPoolColl = await defaultPool.getTotalCollateral()
    // systemColl = await contracts.borrowerOperations.getEntireSystemColl()

    // console.log('collVC in active pool: ', (await collateralManager.getTotalValue(activePoolColl[1], activePoolColl[2])).toString())
    // console.log('total amount weth in active pool', (await weth.balanceOf(activePool.address)).toString())
    // console.log('total amount steth in active pool', (await contracts.steth.balanceOf(activePool.address)).toString())
    // console.log('debt in active pool: ', (await activePool.getUSDEDebt()).toString())
    // console.log('collVC in default pool: ', (await collateralManager.getTotalValue(defaultPoolColl[1], defaultPoolColl[2])).toString())
    // console.log('total amount weth in default pool', (await weth.balanceOf(defaultPool.address)).toString())
    // console.log('total amount steth in default pool', (await contracts.steth.balanceOf(defaultPool.address)).toString())
    // console.log('debt in default pool: ', (await defaultPool.getUSDEDebt()).toString())
    // console.log('TCR: ', (await contracts.collateralManager.getTCR()).toString())
    // console.log('entire system VC: ', (await contracts.borrowerOperations.getEntireSystemColl()).toString())
    // console.log('entire system eth amount: ', (await weth.balanceOf(activePool.address)).add((await weth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system steth amount: ', (await contracts.steth.balanceOf(activePool.address)).add((await contracts.steth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system debt: ', (await collateralManager.getTotalValue(systemColl[0], systemColl[1])).toString())

    // bobCTS = (await contracts.troveManager.getCurrentTroveAmounts(bob))
    // console.log('bobICR: ', (await th.getCurrentICR(contracts, bob)).toString())
    // console.log('bobVC: ', (await collateralManager.getTotalValue(bobCTS[1], bobCTS[0])).toString())
    // console.log('bob ETH Amount:', bobCTS[0][0].toString())
    // //console.log('bob STETH Amount:', bobCTS[0][1].toString())
    // console.log('bobDebt: ', bobCTS[2].toString())

    // aliceCTS = (await contracts.troveManager.getCurrentTroveAmounts(alice))
    // console.log('aliceICR: ', (await th.getCurrentICR(contracts, alice)).toString())
    // console.log('aliceVC: ', (await collateralManager.getTotalValue(aliceCTS[1], aliceCTS[0])).toString())
    // console.log('alice ETH Amount:', aliceCTS[0][0].toString())
    // //console.log('alice STETH Amount:', aliceCTS[0][1].toString())
    // console.log('aliceDebt: ', aliceCTS[2].toString())

    // carolCTS = (await contracts.troveManager.getCurrentTroveAmounts(carol))
    // console.log('carolICR: ', (await th.getCurrentICR(contracts, carol)).toString())
    // console.log('carolVC: ', (await collateralManager.getTotalValue(carolCTS[1], carolCTS[0])).toString())
    // // console.log('carol ETH Amount:', carolCTS[0][0].toString())
    // // console.log('carol STETH Amount:', carolCTS[0][1].toString())
    // console.log('carolDebt: ', carolCTS[2].toString())

    // console.log('----------- \n\n')

    const alice_ETH = (await getTroveEntireColl(alice))[0].toString()
    const bob_STETH = (await getTroveEntireColl(bob))[1].toString()

    /* Expected collateral:
    A: Alice receives 0.995 ETH from L1, and ~3/5*0.995 ETH from L2.
    expect aliceColl = 2 + 0.995 + 2.995/4.995 * 0.995 = 3.5916 ETH

    C: Carol receives ~2/5 ETH from L2
    expect carolColl = 2 + 2/4.995 * 0.995 = 2.398 ETH

    Total coll = 4 + 2 * 0.995 ETH
    */
    const A_ETHAfterL1 = A_amounts[0].add(th.applyLiquidationFee(C_amounts[0]))
    assert.isAtMost(th.getDifference(alice_ETH, A_ETHAfterL1), Number(dec(150, 20)))

    const entireSystemETH = (await activePool.getCollateralAmount(weth.address)).add(await defaultPool.getCollateralAmount(weth.address)).toString()
    assert.equal(entireSystemETH, A_amounts[0].add(th.applyLiquidationFee(C_amounts[0])))

    const B_STETHAfterL1 = B_amounts[0].add(th.applyLiquidationFee(C_amounts[1]))
    assert.isAtMost(th.getDifference(bob_STETH, B_STETHAfterL1), Number(dec(150, 20)))

    const entireSystemSTETH = (await activePool.getCollateralAmount(steth.address)).add(await defaultPool.getCollateralAmount(steth.address)).toString()
    assert.equal(entireSystemSTETH, B_amounts[0].add(th.applyLiquidationFee(C_amounts[1])))
    assert.equal((await usdeToken.balanceOf(owner)).toString(), dec(200, 18))
  })

  it("multi redistribution: A open with ETH, B open with STETH, C open with both 5:1.5 ratio, liquidate C", async () => {
    await contracts.priceFeedETH.setPrice(dec(2000, 18))
    await contracts.priceFeedSTETH.setPrice(dec(5, 17))

    let a_wethToMint = toBN(dec(40, 17));

    let a_colls = [contracts.weth];
    let a_amounts = [a_wethToMint];

    const {
      amounts: A_amounts
    } = await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(400, 16)),
      colls: a_colls,
      amounts: a_amounts,
      signer: Alice,
      extraParams: {
        from: alice
      }
    });

    let b_stethToMint = toBN(dec(400, 17));

    let b_colls = [contracts.steth];
    let b_amounts = [b_stethToMint];

    const {
      amounts: B_amounts
    } = await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(400, 16)),
      colls: b_colls,
      amounts: b_amounts,
      signer: Bob,
      extraParams: {
        from: bob
      }
    });

    let c_wethToMint = toBN(dec(5, 17));
    let c_stethToMint = toBN(dec(160, 17));

    let c_colls = [contracts.weth, contracts.steth];
    let c_amounts = [c_wethToMint, c_stethToMint];


    const {
      amounts: C_amounts
    } = await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(210, 16)),
      colls: c_colls,
      amounts: c_amounts,
      signer: Carol,
      extraParams: {
        from: carol
      }
    });

    // console.log('\n----------- ')
    // console.log('With 2 colls: \n')

    // let activePoolColl = await activePool.getTotalCollateral()
    // let defaultPoolColl = await defaultPool.getTotalCollateral()
    // let systemColl = await contracts.borrowerOperations.getEntireSystemColl()

    // console.log('collVC in active pool: ', (await collateralManager.getTotalValue(activePoolColl[1], activePoolColl[2])).toString())
    // console.log('total amount weth in active pool', (await weth.balanceOf(activePool.address)).toString())
    // console.log('total amount wavstethax in active pool', (await contracts.steth.balanceOf(activePool.address)).toString())
    // console.log('debt in active pool: ', (await activePool.getUSDEDebt()).toString())
    // console.log('collVC in default pool: ', (await collateralManager.getTotalValue(defaultPoolColl[1], defaultPoolColl[2])).toString())
    // console.log('total amount weth in default pool', (await weth.balanceOf(defaultPool.address)).toString())
    // console.log('total amount steth in default pool', (await contracts.steth.balanceOf(defaultPool.address)).toString())
    // console.log('debt in default pool: ', (await defaultPool.getUSDEDebt()).toString())
    // console.log('TCR: ', (await contracts.collateralManager.getTCR()).toString())
    // console.log('entire system VC: ', (await collateralManager.getTotalValue(systemColl[0], systemColl[1])).toString())
    // console.log('entire system eth amount: ', (await weth.balanceOf(activePool.address)).add((await weth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system steth amount: ', (await contracts.steth.balanceOf(activePool.address)).add((await contracts.steth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system debt: ', (await contracts.borrowerOperations.getEntireSystemDebt()).toString())

    // aliceCTS = (await contracts.troveManager.getCurrentTroveAmounts(alice))
    // console.log('aliceICR: ', (await th.getCurrentICR(contracts, alice)).toString())
    // console.log('aliceVC: ', (await collateralManager.getTotalValue(aliceCTS[1], aliceCTS[0])).toString())
    // console.log('alice ETH Amount:', aliceCTS[0][0].toString())
    // //console.log('alice STETH Amount:', aliceCTS[0][1].toString())
    // console.log('aliceDebt: ', aliceCTS[2].toString())

    // bobCTS = (await contracts.troveManager.getCurrentTroveAmounts(bob))
    // console.log('bobICR: ', (await th.getCurrentICR(contracts, bob)).toString())
    // console.log('bobVC: ', (await collateralManager.getTotalValue(bobCTS[1], bobCTS[0])).toString())
    // // console.log('bob ETH Amount:', bobCTS[0][0].toString())
    // console.log('bob STETH Amount:', bobCTS[0][1].toString())
    // console.log('bobDebt: ', bobCTS[2].toString())

    // carolCTS = (await contracts.troveManager.getCurrentTroveAmounts(carol))
    // console.log('carolICR: ', (await th.getCurrentICR(contracts, carol)).toString())
    // console.log('carolVC: ', (await collateralManager.getTotalValue(carolCTS[1], carolCTS[0])).toString())
    // console.log('carol ETH Amount:', carolCTS[0][0].toString())
    // console.log('carol STETH Amount:', carolCTS[0][1].toString())
    // console.log('carolDebt: ', carolCTS[2].toString())

    // console.log('----------- \n\n')

    // // // Price drops to 100 $/E
    // await contracts.priceFeedETH.setPrice(dec(100, 18))
    await contracts.priceFeedSTETH.setPrice(dec(4, 17))

    // console.log('\n----------- ')
    // console.log('Drop STETH to 100: \n')

    // activePoolColl = await activePool.getTotalCollateral()
    // defaultPoolColl = await defaultPool.getTotalCollateral()
    // systemColl = await contracts.borrowerOperations.getEntireSystemColl()

    // console.log('collVC in active pool: ', (await collateralManager.getTotalValue(activePoolColl[1], activePoolColl[2])).toString())
    // console.log('total amount weth in active pool', (await weth.balanceOf(activePool.address)).toString())
    // console.log('total amount wavstethax in active pool', (await contracts.steth.balanceOf(activePool.address)).toString())
    // console.log('debt in active pool: ', (await activePool.getUSDEDebt()).toString())
    // console.log('collVC in default pool: ', (await collateralManager.getTotalValue(defaultPoolColl[1], defaultPoolColl[2])).toString())
    // console.log('total amount weth in default pool', (await weth.balanceOf(defaultPool.address)).toString())
    // console.log('total amount steth in default pool', (await contracts.steth.balanceOf(defaultPool.address)).toString())
    // console.log('debt in default pool: ', (await defaultPool.getUSDEDebt()).toString())
    // console.log('TCR: ', (await contracts.collateralManager.getTCR()).toString())
    // console.log('entire system VC: ', (await collateralManager.getTotalValue(systemColl[0], systemColl[1])).toString())
    // console.log('entire system eth amount: ', (await weth.balanceOf(activePool.address)).add((await weth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system steth amount: ', (await contracts.steth.balanceOf(activePool.address)).add((await contracts.steth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system debt: ', (await contracts.borrowerOperations.getEntireSystemDebt()).toString())

    // aliceCTS = (await contracts.troveManager.getCurrentTroveAmounts(alice))
    // console.log('aliceICR: ', (await th.getCurrentICR(contracts, alice)).toString())
    // console.log('aliceVC: ', (await collateralManager.getTotalValue(aliceCTS[1], aliceCTS[0])).toString())
    // console.log('alice ETH Amount:', aliceCTS[0][0].toString())
    // //console.log('alice STETH Amount:', aliceCTS[0][1].toString())
    // console.log('aliceDebt: ', aliceCTS[2].toString())

    // bobCTS = (await contracts.troveManager.getCurrentTroveAmounts(bob))
    // console.log('bobICR: ', (await th.getCurrentICR(contracts, bob)).toString())
    // console.log('bobVC: ', (await collateralManager.getTotalValue(bobCTS[1], bobCTS[0])).toString())
    // // console.log('bob ETH Amount:', bobCTS[0][0].toString())
    // console.log('bob STETH Amount:', bobCTS[0][1].toString())
    // console.log('bobDebt: ', bobCTS[2].toString())

    // carolCTS = (await contracts.troveManager.getCurrentTroveAmounts(carol))
    // console.log('carolICR: ', (await th.getCurrentICR(contracts, carol)).toString())
    // console.log('carolVC: ', (await collateralManager.getTotalValue(carolCTS[1], carolCTS[0])).toString())
    // console.log('carol ETH Amount:', carolCTS[0][0].toString())
    // console.log('carol STETH Amount:', carolCTS[0][1].toString())
    // console.log('carolDebt: ', carolCTS[2].toString())

    // console.log('----------- \n\n')

    // Confirm not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // L1: C liquidated
    const txWB = await troveManager.liquidate(carol)
    tx = await txWB.wait()
    assert.isTrue(tx.status === 1)
    assert.isFalse(await sortedTroves.contains(carol))

    // console.log('\n----------- ')
    // console.log('After Liquidate carol: \n')

    // activePoolColl = await activePool.getTotalCollateral()
    // defaultPoolColl = await defaultPool.getTotalCollateral()
    // systemColl = await contracts.borrowerOperations.getEntireSystemColl()

    // console.log('collVC in active pool: ', (await collateralManager.getTotalValue(activePoolColl[1], activePoolColl[2])).toString())
    // console.log('total amount weth in active pool', (await weth.balanceOf(activePool.address)).toString())
    // console.log('total amount wavstethax in active pool', (await contracts.steth.balanceOf(activePool.address)).toString())
    // console.log('debt in active pool: ', (await activePool.getUSDEDebt()).toString())
    // console.log('collVC in default pool: ', (await collateralManager.getTotalValue(defaultPoolColl[1], defaultPoolColl[2])).toString())
    // console.log('total amount weth in default pool', (await weth.balanceOf(defaultPool.address)).toString())
    // console.log('total amount steth in default pool', (await contracts.steth.balanceOf(defaultPool.address)).toString())
    // console.log('debt in default pool: ', (await defaultPool.getUSDEDebt()).toString())
    // console.log('TCR: ', (await contracts.collateralManager.getTCR()).toString())
    // console.log('entire system VC: ', (await collateralManager.getTotalValue(systemColl[0], systemColl[1])).toString())
    // console.log('entire system eth amount: ', (await weth.balanceOf(activePool.address)).add((await weth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system steth amount: ', (await contracts.steth.balanceOf(activePool.address)).add((await contracts.steth.balanceOf(defaultPool.address))).toString())
    // console.log('entire system debt: ', (await contracts.borrowerOperations.getEntireSystemDebt()).toString())

    // aliceCTS = (await contracts.troveManager.getCurrentTroveAmounts(alice))
    // console.log('aliceICR: ', (await th.getCurrentICR(contracts, alice)).toString())
    // console.log('aliceVC: ', (await collateralManager.getTotalValue(aliceCTS[1], aliceCTS[0])).toString())
    // console.log('alice ETH Amount:', aliceCTS[0][0].toString())
    // //console.log('alice STETH Amount:', aliceCTS[0][1].toString())
    // console.log('aliceDebt: ', aliceCTS[2].toString())

    // bobCTS = (await contracts.troveManager.getCurrentTroveAmounts(bob))
    // console.log('bobICR: ', (await th.getCurrentICR(contracts, bob)).toString())
    // console.log('bobVC: ', (await collateralManager.getTotalValue(bobCTS[1], bobCTS[0])).toString())
    // // console.log('bob ETH Amount:', bobCTS[0][0].toString())
    // console.log('bob STETH Amount:', bobCTS[0][1].toString())
    // console.log('bobDebt: ', bobCTS[2].toString())

    // carolCTS = (await contracts.troveManager.getCurrentTroveAmounts(carol))
    // console.log('carolICR: ', (await th.getCurrentICR(contracts, carol)).toString())
    // console.log('carolVC: ', (await collateralManager.getTotalValue(carolCTS[1], carolCTS[0])).toString())
    // // console.log('carol ETH Amount:', carolCTS[0][0].toString())
    // // console.log('carol STETH Amount:', carolCTS[0][1].toString())
    // console.log('carolDebt: ', carolCTS[2].toString())

    // console.log('----------- \n\n')

    const alice_ETH = (await getTroveEntireColl(alice))[0].toString()
    const bob_STETH = (await getTroveEntireColl(bob))[1].toString()

    // /* Expected collateral:
    // A: Alice receives 0.995 ETH from L1, and ~3/5*0.995 ETH from L2.
    // expect aliceColl = 2 + 0.995 + 2.995/4.995 * 0.995 = 3.5916 ETH

    // C: Carol receives ~2/5 ETH from L2
    // expect carolColl = 2 + 2/4.995 * 0.995 = 2.398 ETH

    // Total coll = 4 + 2 * 0.995 ETH
    // */
    const A_ETHAfterL1 = A_amounts[0].add(th.applyLiquidationFee(C_amounts[0]))
    assert.isAtMost(th.getDifference(alice_ETH, A_ETHAfterL1), Number(dec(150, 20)))

    const entireSystemETH = (await activePool.getCollateralAmount(weth.address)).add(await defaultPool.getCollateralAmount(weth.address)).toString()
    assert.isAtMost(th.getDifference(entireSystemETH, A_amounts[0].add(th.applyLiquidationFee(C_amounts[0]))), 1)
    const B_STETHAfterL1 = B_amounts[0].add(th.applyLiquidationFee(C_amounts[1]))
    assert.isAtMost(th.getDifference(bob_STETH, B_STETHAfterL1), Number(dec(150, 20)))

    const entireSystemSTETH = (await activePool.getCollateralAmount(steth.address)).add(await defaultPool.getCollateralAmount(steth.address)).toString()
    assert.isAtMost(th.getDifference(entireSystemSTETH, B_amounts[0].add(th.applyLiquidationFee(C_amounts[1]))), 1)

    assert.equal((await usdeToken.balanceOf(owner)).toString(), dec(200, 18))
  })

})