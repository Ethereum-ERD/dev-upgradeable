const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const th = testHelpers.TestHelper
const {
  dec,
  toBN
} = th
const moneyVals = testHelpers.MoneyValues

let latestRandomSeed = 31337

const TroveManagerTester = artifacts.require("TroveManagerTester")
const CollateralManagerTester = artifacts.require("CollateralManagerTester")
const USDEToken = artifacts.require("USDEToken")

contract('HintHelpers', async accounts => {

  const [owner] = accounts;

  let sortedTroves
  let troveManager
  let collateralManager
  let borrowerOperations
  let hintHelpers
  let priceFeed

  let contracts

  let numAccounts;

  const getNetBorrowingAmount = async (debtWithFee) => th.getNetBorrowingAmount(contracts, debtWithFee)

  /* Open a Trove for each account. USDE debt is 200 USDE each, with collateral beginning at
  1.5 ether, and rising by 0.01 ether per Trove.  Hence, the ICR of account (i + 1) is always 1% greater than the ICR of account i. 
 */

  // Open Troves in parallel, then withdraw USDE in parallel
  const makeTrovesInParallel = async (accounts, n) => {
    activeAccounts = accounts.slice(0, n)
    // console.log(`number of accounts used is: ${activeAccounts.length}`)
    // console.time("makeTrovesInParallel")
    const openTrovepromises = activeAccounts.map((account, index) => openTrove(account, index))
    await Promise.all(openTrovepromises)
    const withdrawUSDEpromises = activeAccounts.map(account => withdrawUSDEfromTrove(account))
    await Promise.all(withdrawUSDEpromises)
    // console.timeEnd("makeTrovesInParallel")
  }

  const openTrove = async (account, index) => {
    const amountFinney = 2000 + index * 10
    const coll = web3.utils.toWei((amountFinney.toString()), 'finney')
    await borrowerOperations.openTrove([], [], th._100pct, 0, account, account, th.ZERO_ADDRESS, {
      from: account,
      value: coll
    })
  }

  const withdrawUSDEfromTrove = async (account) => {
    await borrowerOperations.withdrawUSDE('100000000000000000000', account, account, th._100pct, {
      from: account
    })
  }

  // Sequentially add coll and withdraw USDE, 1 account at a time
  const makeTrovesInSequence = async (accounts, n) => {
    activeAccounts = accounts.slice(0, n)
    // console.log(`number of accounts used is: ${activeAccounts.length}`)

    let ICR = 200

    // console.time('makeTrovesInSequence')
    for (const account of activeAccounts) {
      const ICR_BN = toBN(ICR.toString().concat('0'.repeat(16)))
      await th.openTrove(contracts, {
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: ICR_BN,
        extraParams: {
          from: account
        }
      })

      ICR += 1
    }
    // console.timeEnd('makeTrovesInSequence')
  }

  before(async () => {
    contracts = await deploymentHelper.deployERDCore()
    contracts.troveManager = await TroveManagerTester.new()
    contracts.collateralManager = await CollateralManagerTester.new()
    contracts.usdeToken = await USDEToken.new(
      contracts.troveManager.address,
      contracts.troveManagerLiquidations.address,
      contracts.troveManagerRedemptions.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address
    )
    const ERDContracts = await deploymentHelper.deployERDContracts()

    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    collateralManager = contracts.collateralManager
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers
    priceFeed = contracts.priceFeedETH

    await deploymentHelper.connectCoreContracts(contracts, ERDContracts)

    numAccounts = 10
    // numAccounts = 1000 // passed this test. 

    await priceFeed.setPrice(dec(100, 18))
    await makeTrovesInSequence(accounts, numAccounts)
    // await makeTrovesInParallel(accounts, numAccounts)  

  })

  it("setup: makes accounts with nominal ICRs increasing by 1% consecutively", async () => {
    // check first 10 accounts
    const ICR_0 = await th.getCurrentICR(contracts, accounts[0])
    const ICR_1 = await th.getCurrentICR(contracts, accounts[1])
    const ICR_2 = await th.getCurrentICR(contracts, accounts[2])
    const ICR_3 = await th.getCurrentICR(contracts, accounts[3])
    const ICR_4 = await th.getCurrentICR(contracts, accounts[4])
    const ICR_5 = await th.getCurrentICR(contracts, accounts[5])
    const ICR_6 = await th.getCurrentICR(contracts, accounts[6])
    const ICR_7 = await th.getCurrentICR(contracts, accounts[7])
    const ICR_8 = await th.getCurrentICR(contracts, accounts[8])
    const ICR_9 = await th.getCurrentICR(contracts, accounts[9])

    // div 1e16 because of variable interest 
    assert.isTrue(ICR_0.div(toBN(dec(1, 16))).eq(toBN("199")))
    assert.isTrue(ICR_1.div(toBN(dec(1, 16))).eq(toBN("200")))
    assert.isTrue(ICR_2.div(toBN(dec(1, 16))).eq(toBN("201")))
    assert.isTrue(ICR_3.div(toBN(dec(1, 16))).eq(toBN("202")))
    assert.isTrue(ICR_4.div(toBN(dec(1, 16))).eq(toBN("203")))
    assert.isTrue(ICR_5.div(toBN(dec(1, 16))).eq(toBN("204")))
    assert.isTrue(ICR_6.div(toBN(dec(1, 16))).eq(toBN("205")))
    assert.isTrue(ICR_7.div(toBN(dec(1, 16))).eq(toBN("206")))
    assert.isTrue(ICR_8.div(toBN(dec(1, 16))).eq(toBN("207")))
    assert.isTrue(ICR_9.div(toBN(dec(1, 16))).eq(toBN("209")))
  })

  it("getApproxHint(): returns the address of a Trove within sqrt(length) positions of the correct insert position", async () => {
    const sqrtLength = Math.ceil(Math.sqrt(numAccounts))
    const price = await priceFeed.getPrice()

    /* As per the setup, the ICRs of Troves are monotonic and seperated by 1% intervals. Therefore, the difference in ICR between 
    the given CR and the ICR of the hint address equals the number of positions between the hint address and the correct insert position 
    for a Trove with the given CR. */

    // CR = 250%
    const CR_250 = '2500000000000000000'
    const CRPercent_250 = Number(web3.utils.fromWei(CR_250, 'ether')) * 100

    let hintAddress

    // const hintAddress_250 = await functionCaller.troveManager_getApproxHint(CR_250, sqrtLength * 10)

    let approxHint = await hintHelpers.getApproxHint(CR_250, sqrtLength * 10, latestRandomSeed, price)
    hintAddress = approxHint[0]
    latestRandomSeed = approxHint[2]
    const ICR_hintAddress_250 = await th.getCurrentICR(contracts, hintAddress)
    const ICRPercent_hintAddress_250 = Number(web3.utils.fromWei(ICR_hintAddress_250, 'ether')) * 100

    // check the hint position is at most sqrtLength positions away from the correct position
    ICR_Difference_250 = (ICRPercent_hintAddress_250 - CRPercent_250)
    assert.isBelow(ICR_Difference_250, sqrtLength)

    // CR = 287% 
    const CR_287 = '2870000000000000000'
    const CRPercent_287 = Number(web3.utils.fromWei(CR_287, 'ether')) * 100

    // const hintAddress_287 = await functionCaller.troveManager_getApproxHint(CR_287, sqrtLength * 10)

    approxHint = await hintHelpers.getApproxHint(CR_287, sqrtLength * 10, latestRandomSeed, price)
    hintAddress = approxHint[0]
    latestRandomSeed = approxHint[2]
    const ICR_hintAddress_287 = await th.getCurrentICR(contracts, hintAddress)
    const ICRPercent_hintAddress_287 = Number(web3.utils.fromWei(ICR_hintAddress_287, 'ether')) * 100

    // check the hint position is at most sqrtLength positions away from the correct position
    ICR_Difference_287 = (ICRPercent_hintAddress_287 - CRPercent_287)
    assert.isBelow(ICR_Difference_287, sqrtLength)

    // CR = 213%
    const CR_213 = '2130000000000000000'
    const CRPercent_213 = Number(web3.utils.fromWei(CR_213, 'ether')) * 100

    // const hintAddress_213 = await functionCaller.troveManager_getApproxHint(CR_213, sqrtLength * 10)

    approxHint = await hintHelpers.getApproxHint(CR_213, sqrtLength * 10, latestRandomSeed, price)
    hintAddress = approxHint[0]
    latestRandomSeed = approxHint[2]
    const ICR_hintAddress_213 = await th.getCurrentICR(contracts, hintAddress)
    const ICRPercent_hintAddress_213 = Number(web3.utils.fromWei(ICR_hintAddress_213, 'ether')) * 100

    // check the hint position is at most sqrtLength positions away from the correct position
    ICR_Difference_213 = (ICRPercent_hintAddress_213 - CRPercent_213)
    assert.isBelow(ICR_Difference_213, sqrtLength)

    // CR = 201%
    const CR_201 = '2010000000000000000'
    const CRPercent_201 = Number(web3.utils.fromWei(CR_201, 'ether')) * 100

    //  const hintAddress_201 = await functionCaller.troveManager_getApproxHint(CR_201, sqrtLength * 10)

    approxHint = await hintHelpers.getApproxHint(CR_201, sqrtLength * 10, latestRandomSeed, price)
    hintAddress = approxHint[0]
    latestRandomSeed = approxHint[2]
    const ICR_hintAddress_201 = await th.getCurrentICR(contracts, hintAddress)
    const ICRPercent_hintAddress_201 = Number(web3.utils.fromWei(ICR_hintAddress_201, 'ether')) * 100

    // check the hint position is at most sqrtLength positions away from the correct position
    ICR_Difference_201 = (ICRPercent_hintAddress_201 - CRPercent_201)
    assert.isBelow(ICR_Difference_201, sqrtLength)
  })

  /* Pass 10 random collateral ratios to getApproxHint(). For each, check whether the returned hint address is within 
  sqrt(length) positions of where a Trove with that CR should be inserted. */
  it("getApproxHint(): for 10 random CRs, returns the address of a Trove within sqrt(length) positions of the correct insert position", async () => {
    console.log("Time-consuming")
    const price = await priceFeed.getPrice()
    const sqrtLength = Math.ceil(Math.sqrt(numAccounts))
    let hintAddress
    for (i = 0; i < 10; i++) {
      // get random ICR between 200% and (200 + numAccounts)%
      const min = 200
      const max = 200 + numAccounts
      const ICR_Percent = (Math.floor(Math.random() * (max - min) + min))

      // Convert ICR to a duint
      const ICR = web3.utils.toWei((ICR_Percent * 10).toString(), 'finney')

      const approxHint = await hintHelpers.getApproxHint(ICR, sqrtLength * 10, latestRandomSeed, price)
      hintAddress = approxHint[0]
      latestRandomSeed = approxHint[2]
      const ICR_hintAddress = await th.getCurrentICR(contracts, hintAddress)
      const ICRPercent_hintAddress = Number(web3.utils.fromWei(ICR_hintAddress, 'ether')) * 100

      // check the hint position is at most sqrtLength positions away from the correct position
      ICR_Difference = (ICRPercent_hintAddress - ICR_Percent)
      assert.isBelow(ICR_Difference, sqrtLength)
    }
  })

  it("getApproxHint(): returns the head of the list if the CR is the max uint256 value", async () => {
    const sqrtLength = Math.ceil(Math.sqrt(numAccounts))
    const price = await priceFeed.getPrice()

    // CR = Maximum value, i.e. 2**256 -1 
    const CR_Max = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

    let hintAddress

    // const hintAddress_Max = await functionCaller.troveManager_getApproxHint(CR_Max, sqrtLength * 10)

    (

      {
        hintAddress,
        latestRandomSeed
      } = await hintHelpers.getApproxHint(CR_Max, sqrtLength * 10, latestRandomSeed, price))

    const ICR_hintAddress_Max = await th.getCurrentICR(contracts, hintAddress)
    const ICRPercent_hintAddress_Max = Number(web3.utils.fromWei(ICR_hintAddress_Max, 'ether')) * 100

    const firstTrove = await sortedTroves.getFirst()
    const ICR_FirstTrove = await th.getCurrentICR(contracts, firstTrove)
    const ICRPercent_FirstTrove = Number(web3.utils.fromWei(ICR_FirstTrove, 'ether')) * 100

    // check the hint position is at most sqrtLength positions away from the correct position
    ICR_Difference_Max = (ICRPercent_hintAddress_Max - ICRPercent_FirstTrove)
    assert.isBelow(ICR_Difference_Max, sqrtLength)
  })

  it("getApproxHint(): returns the tail of the list if the CR is lower than ICR of any Trove", async () => {
    const sqrtLength = Math.ceil(Math.sqrt(numAccounts))
    const price = await priceFeed.getPrice()

    // CR = MCR
    const CR_Min = '1100000000000000000'

    let hintAddress

    //  const hintAddress_Min = await functionCaller.troveManager_getApproxHint(CR_Min, sqrtLength * 10)

    ({
      hintAddress,
      latestRandomSeed
    } = await hintHelpers.getApproxHint(CR_Min, sqrtLength * 10, latestRandomSeed, price))
    const ICR_hintAddress_Min = await th.getCurrentICR(contracts, hintAddress)
    const ICRPercent_hintAddress_Min = Number(web3.utils.fromWei(ICR_hintAddress_Min, 'ether')) * 100

    const lastTrove = await sortedTroves.getLast()
    const ICR_LastTrove = await th.getCurrentICR(contracts, lastTrove)
    const ICRPercent_LastTrove = Number(web3.utils.fromWei(ICR_LastTrove, 'ether')) * 100

    // check the hint position is at most sqrtLength positions away from the correct position
    const ICR_Difference_Min = (ICRPercent_hintAddress_Min - ICRPercent_LastTrove)
    assert.isBelow(ICR_Difference_Min, sqrtLength)
  })

})

// Gas usage:  See gas costs spreadsheet. Cost per trial = 10k-ish.