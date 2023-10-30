const BN = require('bn.js')
const {
  web3,
  ethers
} = require('hardhat')
const Destructible = artifacts.require("./TestContracts/Destructible.sol")


const MoneyValues = {
  negative_5e17: "-" + web3.utils.toWei('500', 'finney'),
  negative_1e18: "-" + web3.utils.toWei('1', 'ether'),
  negative_10e18: "-" + web3.utils.toWei('10', 'ether'),
  negative_50e18: "-" + web3.utils.toWei('50', 'ether'),
  negative_100e18: "-" + web3.utils.toWei('100', 'ether'),
  negative_101e18: "-" + web3.utils.toWei('101', 'ether'),
  negative_eth: (amount) => "-" + web3.utils.toWei(amount, 'ether'),

  _zeroBN: ethers.BigNumber.from('0'),
  _1e18BN: ethers.BigNumber.from('1000000000000000000'),
  _10e18BN: ethers.BigNumber.from('10000000000000000000'),
  _100e18BN: ethers.BigNumber.from('100000000000000000000'),
  _100BN: ethers.BigNumber.from('100'),
  _110BN: ethers.BigNumber.from('110'),
  _130BN: ethers.BigNumber.from('130'),

  _MCR: ethers.BigNumber.from('1100000000000000000'),
  _ICR100: ethers.BigNumber.from('1000000000000000000'),
  _CCR: ethers.BigNumber.from('1300000000000000000'),
}

const TimeValues = {
  SECONDS_IN_ONE_MINUTE: 60,
  SECONDS_IN_ONE_HOUR: 60 * 60,
  SECONDS_IN_ONE_DAY: 60 * 60 * 24,
  SECONDS_IN_ONE_WEEK: 60 * 60 * 24 * 7,
  SECONDS_IN_SIX_WEEKS: 60 * 60 * 24 * 7 * 6,
  SECONDS_IN_ONE_MONTH: 60 * 60 * 24 * 30,
  SECONDS_IN_ONE_YEAR: 60 * 60 * 24 * 365,
  MINUTES_IN_ONE_WEEK: 60 * 24 * 30,
  MINUTES_IN_ONE_MONTH: 60 * 24 * 30,
  MINUTES_IN_ONE_YEAR: 60 * 24 * 365
}

class TestHelper {

  static dec(val, scale) {
    let zerosCount

    if (scale == 'ether') {
      zerosCount = 18
    } else if (scale == 'finney')
      zerosCount = 15
    else {
      zerosCount = scale
    }

    const strVal = val.toString()
    const strZeros = ('0').repeat(zerosCount)

    return strVal.concat(strZeros)
  }

  static squeezeAddr(address) {
    const len = address.length
    return address.slice(0, 6).concat("...").concat(address.slice(len - 4, len))
  }

  static getDifference(x, y) {
    const x_BN = ethers.BigNumber.from(x.toString())
    const y_BN = ethers.BigNumber.from(y.toString())
    // console.log(x_BN.toString())
    // console.log(y_BN.toString())

    return Number(x_BN.sub(y_BN).abs())
  }

  static assertIsApproximatelyEqual(x, y, error = 1000) {
    assert.isAtMost(this.getDifference(x, y), error)
  }

  static zipToObject(array1, array2) {
    let obj = {}
    array1.forEach((element, idx) => obj[element] = array2[idx])
    return obj
  }

  static getGasMetrics(gasCostList) {
    const minGas = Math.min(...gasCostList)
    const maxGas = Math.max(...gasCostList)

    let sum = 0;
    for (const gas of gasCostList) {
      sum += gas
    }

    if (sum === 0) {
      return {
        gasCostList: gasCostList,
        minGas: undefined,
        maxGas: undefined,
        meanGas: undefined,
        medianGas: undefined
      }
    }
    const meanGas = sum / gasCostList.length

    // median is the middle element (for odd list size) or element adjacent-right of middle (for even list size)
    const sortedGasCostList = [...gasCostList].sort()
    const medianGas = (sortedGasCostList[Math.floor(sortedGasCostList.length / 2)])
    return {
      gasCostList,
      minGas,
      maxGas,
      meanGas,
      medianGas
    }
  }

  static getGasMinMaxAvg(gasCostList) {
    const metrics = th.getGasMetrics(gasCostList)

    const minGas = metrics.minGas
    const maxGas = metrics.maxGas
    const meanGas = metrics.meanGas
    const medianGas = metrics.medianGas

    return {
      minGas,
      maxGas,
      meanGas,
      medianGas
    }
  }

  static getEndOfAccount(account) {
    const accountLast2bytes = account.slice((account.length - 4), account.length)
    return accountLast2bytes
  }

  static randDecayFactor(min, max) {
    const amount = Math.random() * (max - min) + min;
    const amountInWei = web3.utils.toWei(amount.toFixed(18), 'ether')
    return amountInWei
  }

  static randAmountInWei(min, max) {
    const amount = Math.random() * (max - min) + min;
    const amountInWei = web3.utils.toWei(amount.toString(), 'ether')
    return amountInWei
  }

  static randAmountInGWei(min, max) {
    const amount = Math.floor(Math.random() * (max - min) + min);
    const amountInWei = web3.utils.toWei(amount.toString(), 'gwei')
    return amountInWei
  }

  static makeWei(num) {
    return web3.utils.toWei(num.toString(), 'ether')
  }

  static makeEther(num, _dec = 18) {
    return num.div(ethers.BigNumber.from("1".concat(('0').repeat(_dec))))
  }

  static appendData(results, message, data) {
    data.push(message + `\n`)
    for (const key in results) {
      data.push(key + "," + results[key] + '\n')
    }
  }
  static getGasFee(tx) {
    return this.toBN(tx.gasUsed * tx.effectiveGasPrice)
    // return this.toBN(tx.receipt.gasUsed * tx.receipt.effectiveGasPrice)
  }

  static getRandICR(min, max) {
    const ICR_Percent = (Math.floor(Math.random() * (max - min) + min))

    // Convert ICR to a duint
    const ICR = web3.utils.toWei((ICR_Percent * 10).toString(), 'finney')
    return ICR
  }

  static computeICR(coll, debt, price) {
    const collBN = ethers.BigNumber.from(coll)
    const debtBN = ethers.BigNumber.from(debt)
    const priceBN = ethers.BigNumber.from(price)

    const ICR = debtBN.eq(this.toBN('0')) ?
      this.toBN('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') :
      collBN.mul(priceBN).div(debtBN)

    return ICR
  }

  static async ICRbetween100and110(account, troveManager, price) {
    const ICR = await troveManager.getCurrentICR(account, price)
    return (ICR.gt(MoneyValues._ICR100)) && (ICR.lt(MoneyValues._MCR))
  }

  static async isUndercollateralized(account, troveManager, price) {
    const ICR = await troveManager.getCurrentICR(account, price)
    return ICR.lt(MoneyValues._MCR)
  }

  static toBN(num) {
    return ethers.BigNumber.from(num.toString())
  }

  static gasUsed(tx) {
    // const gas = tx.receipt.gasUsed
    const gas = tx.gasUsed
    return gas
  }

  static applyLiquidationFee(ethAmount) {
    return ethAmount.mul(this.toBN(this.dec(995, 15))).div(MoneyValues._1e18BN)
  }
  // --- Logging functions ---

  static logGasMetrics(gasResults, message) {
    console.log(
      `\n ${message} \n
      min gas: ${gasResults.minGas} \n
      max gas: ${gasResults.maxGas} \n
      mean gas: ${gasResults.meanGas} \n
      median gas: ${gasResults.medianGas} \n`
    )
  }

  static logAllGasCosts(gasResults) {
    console.log(
      `all gas costs: ${gasResults.gasCostList} \n`
    )
  }

  static logGas(gas, message) {
    console.log(
      `\n ${message} \n
      gas used: ${gas} \n`
    )
  }

  static isZeroArray(colls) {
    for (let i = 0; i < colls.length; i++) {
      if (colls[i] != 0) {
        return false
      }
    }
    return true
  }

  static async logActiveAccounts(contracts, n) {
    const count = await contracts.sortedTroves.getSize()
    const price = await contracts.priceFeedTestnet.getPrice()

    n = (typeof n == 'undefined') ? count : n

    let account = await contracts.sortedTroves.getLast()
    const head = await contracts.sortedTroves.getFirst()

    console.log(`Total active accounts: ${count}`)
    console.log(`First ${n} accounts, in ascending ICR order:`)

    let i = 0
    while (i < n) {
      const squeezedAddr = this.squeezeAddr(account)
      const coll = (await contracts.troveManager.Troves(account))[1]
      const debt = (await contracts.troveManager.Troves(account))[0]
      const ICR = await this.getCurrentICR(contracts, account)

      console.log(`Acct: ${squeezedAddr}  coll:${coll}  debt: ${debt}  ICR: ${ICR}`)

      if (account == head) {
        break;
      }

      account = await contracts.sortedTroves.getPrev(account)

      i++
    }
  }

  static async logAccountsArray(accounts, troveManager, price, n) {
    const length = accounts.length

    n = (typeof n == 'undefined') ? length : n

    console.log(`Number of accounts in array: ${length}`)
    console.log(`First ${n} accounts of array:`)

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i]

      const squeezedAddr = this.squeezeAddr(account)
      const coll = (await troveManager.Troves(account))[1]
      const debt = (await troveManager.Troves(account))[0]
      const ICR = await troveManager.getCurrentICR(account)

      console.log(`Acct: ${squeezedAddr}  coll:${coll}  debt: ${debt}  ICR: ${ICR}`)
    }
  }

  static logBN(label, x) {
    x = x.toString().padStart(18, '0')
    // TODO: thousand separators
    const integerPart = x.slice(0, x.length - 18) ? x.slice(0, x.length - 18) : '0'
    console.log(`${label}:`, integerPart + '.' + x.slice(-18))
  }

  // --- TCR and Recovery Mode functions ---

  // These functions use the PriceFeedTestNet view price function getPrice() which is sufficient for testing.
  // the mainnet contract PriceFeed uses fetchPrice, which is non-view and writes to storage.

  // To checkRecoveryMode / getTCR from the ERD mainnet contracts, pass a price value - this can be the lastGoodPrice
  // stored in ERD, or the current Chainlink ETHUSD price, etc.


  static async checkRecoveryMode(contracts) {
    return contracts.collateralManager.checkRecoveryMode()
  }

  static async getCurrentICR(contracts, borrower) {
    return contracts.collateralManager.getCurrentICR(borrower)
  }

  static async getTCR(contracts) {
    return contracts.collateralManager.getTCR()
    // return contracts.troveManager.getTCR()
  }

  // --- Gas compensation calculation functions ---

  // Given a composite debt, returns the actual debt  - i.e. subtracts the virtual debt.
  // Virtual debt = 200 USDE.
  static async getActualDebtFromComposite(compositeDebt, contracts) {

    const issuedDebt = await contracts.collateralManager.getActualDebtFromComposite(compositeDebt);

    return issuedDebt
  }

  // Adds the gas compensation (200 USDE)
  static async getCompositeDebt(contracts, debt) {
    const compositeDebt = contracts.borrowerOperations.getCompositeDebt(debt)
    return compositeDebt
  }

  static async getTroveEntireColl(contracts, trove) {
    return (await contracts.troveManager.getEntireDebtAndColl(trove))[1]
  }

  static async getTroveEntireTokens(contracts, trove) {
    return (await contracts.troveManager.getEntireDebtAndColl(trove))[4]
  }

  static async getTroveEntireDebt(contracts, trove) {
    return this.toBN((await contracts.troveManager.getEntireDebtAndColl(trove))[0])
  }

  static async getTroveStake(contracts, trove) {
    return (contracts.troveManager.getTroveStake(trove))
  }

  /*
   * given the requested YUSDE amomunt in openTrove, returns the total debt
   * So, it adds the gas compensation and the borrowing fee
   */
  static async getOpenTroveTotalDebt(contracts, usdeAmount) {
    const fee = await contracts.troveManager.getBorrowingFee(usdeAmount)
    // console.log("Fee " + fee)
    const compositeDebt = await this.getCompositeDebt(contracts, usdeAmount)
    // console.log("Composite debt " + compositeDebt)
    return compositeDebt.add(fee)
  }

  /*
   * given the desired total debt, returns the USDE amount that needs to be requested in openTrove
   * So, it subtracts the gas compensation and then the borrowing fee
   */
  static async getOpenTroveUSDEAmount(contracts, totalDebt) {
    const actualDebt = await this.getActualDebtFromComposite(totalDebt, contracts)
    return this.getNetBorrowingAmount(contracts, actualDebt)
  }

  // Subtracts the borrowing fee
  static async getNetBorrowingAmount(contracts, debtWithFee) {
    const borrowingRate = await contracts.troveManager.getBorrowingRateWithDecay()
    // console.log("borrowingRate:", borrowingRate)
    // console.log("borrowingRate:" + borrowingRate)
    // console.log("Numerator", (this.toBN(debtWithFee).mul(MoneyValues._1e18BN)).toString());
    return this.toBN(debtWithFee).mul(MoneyValues._1e18BN).div(MoneyValues._1e18BN.add(this.toBN(borrowingRate)))
  }

  // Adds the borrowing fee
  static async getAmountWithBorrowingFee(contracts, usdeAmount) {
    const fee = await contracts.troveManager.getBorrowingFee(usdeAmount)
    return usdeAmount.add(fee)
  }

  // Adds the redemption fee
  static async getRedemptionGrossAmount(contracts, expected) {
    const redemptionRate = await contracts.troveManager.getRedemptionRate()
    return this.toBN(expected).mul(MoneyValues._1e18BN).div(MoneyValues._1e18BN.add(redemptionRate))
  }

  // Get's total collateral minus total gas comp, for a series of troves.
  static async getExpectedTotalCollMinusTotalGasComp(troveList, contracts) {
    let totalCollRemainder = ethers.BigNumber.from('0')

    for (const trove of troveList) {
      const remainingColl = this.getCollMinusGasComp(trove, contracts)
      totalCollRemainder = totalCollRemainder.add(remainingColl)
    }
    return totalCollRemainder
  }

  static getEmittedSumValues(sumTX) {
    const log = sumTX.logs[0];
    return [sumTX.events[0].args[0], sumTX.events[0].args[1]];
    // return [sumTX.logs[0].args[0], sumTX.logs[0].args[1]];
  }

  static getEmittedRedemptionValues(redemptionTx) {
    for (let i = 0; i < redemptionTx.events.length; i++) {
      if (redemptionTx.events[i].event === "Redemption") {
        const attemptedUSDEAmount = redemptionTx.events[i].args[0]
        const actualUSDEAmount = redemptionTx.events[i].args[1]
        const tokensRedeemed = redemptionTx.events[i].args[2]
        const amountsRedeemed = redemptionTx.events[i].args[3]
        const CollFee = redemptionTx.events[i].args[4]

        return [attemptedUSDEAmount, actualUSDEAmount, tokensRedeemed, amountsRedeemed, CollFee]
      }
    }
    throw ("The transaction logs do not contain a redemption event")
  }

  // get multi-collateral liquidation values
  static getEmittedLiquidationValuesMulti(liquidationTx) {
    for (let i = 0; i < liquidationTx.events.length; i++) {
      if (liquidationTx.events[i].event === "Liquidation") {
        const liquidatedDebt = liquidationTx.events[i].args[0]
        const usdeGasComp = liquidationTx.events[i].args[3]
        const liquidatedCollAmounts = liquidationTx.events[i].args[1]
        const totalCollGasCompAmounts = liquidationTx.events[i].args[2]


        return [liquidatedDebt, usdeGasComp, liquidatedCollAmounts, totalCollGasCompAmounts]

      }
    }
    throw ("The transaction logs do not contain a liquidation event")
  }

  static getEmittedLiquidationValues(liquidationTx) {
    for (let i = 0; i < liquidationTx.events.length; i++) {
      if (liquidationTx.events[i].event === "Liquidation") {
        const liquidatedDebt = liquidationTx.events[i].args[0]
        const liquidatedCollAmounts = liquidationTx.events[i].args[1]
        const totalCollGasCompAmounts = liquidationTx.events[i].args[2]
        const usdeGasComp = liquidationTx.events[i].args[3]
        return [liquidatedDebt, liquidatedCollAmounts, totalCollGasCompAmounts, usdeGasComp]
      }
    }
    throw ("The transaction logs do not contain a liquidation event")
  }

  static getEmittedLiquidatedDebt(liquidationTx) {
    return this.getLiquidationEventArg(liquidationTx, 0) // LiquidatedDebt is position 0 in the Liquidation event
  }

  static getEmittedLiquidatedColl(liquidationTx) {
    return this.getLiquidationEventArg(liquidationTx, 1) // LiquidatedColl is position 1 in the Liquidation event
  }

  static getEmittedGasComp(liquidationTx) {
    return this.getLiquidationEventArg(liquidationTx, 2) // GasComp is position 2 in the Liquidation event
  }

  static getLiquidationEventArg(liquidationTx, arg) {
    for (let i = 0; i < liquidationTx.logs.length; i++) {
      if (liquidationTx.logs[i].event === "Liquidation") {
        return liquidationTx.logs[i].args[arg]
      }
    }

    throw ("The transaction logs do not contain a liquidation event")
  }

  static getUSDEFeeFromUSDEBorrowingEvent(tx) {
    for (let i = 0; i < tx.events.length; i++) {
      if (tx.events[i].event === "USDEBorrowingFeePaid") {
        return (tx.events[i].args[1]).toString()
      }
    }
    throw ("The transaction logs do not contain an USDEBorrowingFeePaid event")
  }

  static getEventArgByIndex(tx, eventName, argIndex) {
    for (let i = 0; i < tx.events.length; i++) {
      if (tx.events[i].event === eventName) {
        return tx.events[i].args[argIndex]
      }
    }
    throw (`The transaction logs do not contain event ${eventName}`)
  }

  static getEventArgByName(tx, eventName, argName) {
    for (let i = 0; i < tx.events.length; i++) {
      if (tx.events[i].event === eventName) {
        const keys = Object.keys(tx.events[i].args)
        for (let j = 0; j < keys.length; j++) {
          if (keys[j] === argName) {
            return tx.events[i].args[keys[j]]
          }
        }
      }
    }

    throw (`The transaction logs do not contain event ${eventName} and arg ${argName}`)
  }

  static getAllEventsByName(tx, eventName) {
    const events = []
    for (let i = 0; i < tx.events.length; i++) {
      if (tx.events[i].event === eventName) {
        events.push(tx.events[i])
      }
    }
    return events
  }

  static getDebtAndCollFromTroveUpdatedEvents(troveUpdatedEvents, address) {
    const event = troveUpdatedEvents.filter(event => event.args[0] === address)[0]
    return [event.args[1], event.args[2], event.args[3]]
  }

  static async getBorrowerOpsListHint(contracts, newColl, newDebt) {
    const price = contracts.priceFeedETH.getPrice()
    const newNICR = await contracts.hintHelpers.computeCR(newColl, newDebt)
    const {
      hintAddress: approxfullListHint,
      latestRandomSeed
    } = await contracts.hintHelpers.getApproxHint(newNICR, 5, this.latestRandomSeed, price)
    this.latestRandomSeed = latestRandomSeed

    const {
      0: upperHint,
      1: lowerHint
    } = await contracts.sortedTroves.findInsertPosition(newNICR, approxfullListHint, approxfullListHint)
    return {
      upperHint,
      lowerHint
    }
  }

  static async getEntireCollAndDebt(contracts, account) {
    console.log(`account: ${account}`)
    // let wethIDX = await contracts.colalteralManager.getIngetCollateralPrioritydex(contracts.weth.address)
    const rawColl = (await contracts.troveManager.getTroveColls(account, contracts.weth.address))[0]
    const rawDebt = (await contracts.troveManager.getTroveDebt(account))
    const pendingETHReward = (await contracts.troveManager.getPendingCollReward(account))[0][0]
    const pendingUSDEDebtReward = await contracts.troveManager.getPendingUSDEDebtReward(account)
    const entireColl = rawColl.add(pendingETHReward)
    const entireDebt = rawDebt.add(pendingUSDEDebtReward)

    return {
      entireColl,
      entireDebt
    }
  }

  static async getScaledDebt(contracts, account) {
    const scaledDebt = await contracts.troveDebt.scaledBalanceOf(account)
    return scaledDebt
  }

  static async getCollAndDebtFromAddColl(contracts, account, amount) {
    const {
      entireColl,
      entireDebt
    } = await this.getEntireCollAndDebt(contracts, account)

    const newColl = entireColl.add(this.toBN(amount))
    const newDebt = entireDebt
    return {
      newColl,
      newDebt
    }
  }

  static async getCollAndDebtFromWithdrawColl(contracts, account, amount) {
    const {
      entireColl,
      entireDebt
    } = await this.getEntireCollAndDebt(contracts, account)
    console.log(`entireColl  ${entireColl}`)
    console.log(`entireDebt  ${entireDebt}`)

    const newColl = entireColl.sub(this.toBN(amount))
    const newDebt = entireDebt
    return {
      newColl,
      newDebt
    }
  }

  static async getCollAndDebtFromWithdrawUSDE(contracts, account, amount) {
    const fee = await contracts.troveManager.getBorrowingFee(amount)
    const {
      entireColl,
      entireDebt
    } = await this.getEntireCollAndDebt(contracts, account)

    const newColl = entireColl
    const newDebt = entireDebt.add(this.toBN(amount)).add(fee)

    return {
      newColl,
      newDebt
    }
  }

  static async getCollAndDebtFromRepayUSDE(contracts, account, amount) {
    const {
      entireColl,
      entireDebt
    } = await this.getEntireCollAndDebt(contracts, account)

    const newColl = entireColl
    const newDebt = entireDebt.sub(this.toBN(amount))

    return {
      newColl,
      newDebt
    }
  }

  static async getCollAndDebtFromAdjustment(contracts, account, ETHChange, USDEChange) {
    const {
      entireColl,
      entireDebt
    } = await this.getEntireCollAndDebt(contracts, account)

    // const coll = (await contracts.troveManager.Troves(account))[1]
    // const debt = (await contracts.troveManager.Troves(account))[0]

    const fee = USDEChange.gt(this.toBN('0')) ? await contracts.troveManager.getBorrowingFee(USDEChange) : this.toBN('0')
    const newColl = entireColl.add(ETHChange)
    const newDebt = entireDebt.add(USDEChange).add(fee)

    return {
      newColl,
      newDebt
    }
  }

  static async getTotalStake(contracts, token) {
    const stake = await contracts.troveManager.totalStakes(token)
    return stake
  }

  static async getE_Coll(contracts, token) {
    const E_Coll = await contracts.troveManager.E_Coll(token)
    return E_Coll
  }

  static async getL_USDE(contracts, token) {
    const L_USDE = await contracts.troveManager.E_USDEDebt(token)
    return L_USDE
  }


  // --- BorrowerOperations gas functions ---

  static async openTrove_allAccounts(signers, contracts, ETHAmount, USDEAmount) {
    const gasCostList = []
    const totalDebt = await this.getOpenTroveTotalDebt(contracts, USDEAmount)

    for (const signer of signerg) {
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, ETHAmount, totalDebt)

      const tx = await contracts.borrowerOperations.connect(signer).openTrove([], [], this._100pct, USDEAmount, upperHint, lowerHint, this.ZERO_ADDRESS, {
        from: signer.address,
        value: ETHAmount
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async openTrove_allAccounts_randomETH(minETH, maxETH, signers, contracts, USDEAmount) {
    const gasCostList = []
    const totalDebt = await this.getOpenTroveTotalDebt(contracts, USDEAmount)

    for (const signer of signers) {
      const randCollAmount = this.randAmountInWei(minETH, maxETH)
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, randCollAmount, totalDebt)

      const tx = await contracts.borrowerOperations.connect(signer).openTrove([], [], this._100pct, USDEAmount, upperHint, lowerHint, this.ZERO_ADDRESS, {
        from: signer.address,
        value: randCollAmount
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async openTrove_allAccounts_randomETH_ProportionalUSDE(minETH, maxETH, signers, contracts, proportion) {
    const gasCostList = []

    for (const signer of signers) {
      const randCollAmount = this.randAmountInWei(minETH, maxETH)
      const proportionalUSDE = (ethers.BigNumber.from(proportion)).mul(ethers.BigNumber.from(randCollAmount))
      const totalDebt = await this.getOpenTroveTotalDebt(contracts, proportionalUSDE)

      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, randCollAmount, totalDebt)

      const tx = await contracts.borrowerOperations.connect(signer).openTrove([], [], this._100pct, proportionalUSDE, upperHint, lowerHint, this.ZERO_ADDRESS, {
        from: signer.address,
        value: randCollAmount
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async openTrove_allAccounts_randomETH_randomUSDE(minETH, maxETH, signers, contracts, minUSDEProportion, maxUSDEProportion, logging = false) {
    const gasCostList = []
    const price = await contracts.priceFeedTestnet.getPrice()
    const _1e18 = ethers.BigNumber.from('1000000000000000000')

    let i = 0
    for (const signer of signers) {

      const randCollAmount = this.randAmountInWei(minETH, maxETH)
      console.log(`randCollAmount ${randCollAmount }`)
      const randUSDEProportion = this.randAmountInWei(minUSDEProportion, maxUSDEProportion)
      const proportionalUSDE = (ethers.BigNumber.from(randUSDEProportion)).mul(ethers.BigNumber.from(randCollAmount).div(_1e18))
      const totalDebt = await this.getOpenTroveTotalDebt(contracts, proportionalUSDE)
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, randCollAmount, totalDebt)

      const feeFloor = this.dec(5, 16)
      const tx = await contracts.borrowerOperations.connect(signer).openTrove([], [], this._100pct, proportionalUSDE, upperHint, lowerHint, this.ZERO_ADDRESS, {
        from: signer.address,
        value: randCollAmount
      })

      if (logging && tx.receipt.status) {
        i++
        const ICR = await contracts.troveManager.getCurrentICR(account)
        console.log(`${i}. Trove opened. addr: ${this.squeezeAddr(account)} coll: ${randCollAmount} debt: ${proportionalUSDE} ICR: ${ICR}`)
      }
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async openTrove_allAccounts_randomUSDE(minUSDE, maxUSDE, signers, contracts, ETHAmount) {
    const gasCostList = []

    for (const signer of signers) {
      const randUSDEAmount = this.randAmountInWei(minUSDE, maxUSDE)
      const totalDebt = await this.getOpenTroveTotalDebt(contracts, randUSDEAmount)
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, ETHAmount, totalDebt)

      const tx = await contracts.borrowerOperations.connect(signer).openTrove([], [], this._100pct, randUSDEAmount, upperHint, lowerHint, this.ZERO_ADDRESS, {
        from: signer.address,
        value: ETHAmount
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async closeTrove_allAccounts(signers, contracts) {
    const gasCostList = []

    for (const signer of signers) {
      const tx = await contracts.borrowerOperations.connect(signer).closeTrove({
        from: signer.address
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async openTrove_allAccounts_decreasingUSDEAmounts(signers, contracts, ETHAmount, maxUSDEAmount) {
    const gasCostList = []

    let i = 0
    for (const signer of signers) {
      const USDEAmount = (maxUSDEAmount - i).toString()
      const USDEAmountWei = web3.utils.toWei(USDEAmount, 'ether')
      const totalDebt = await this.getOpenTroveTotalDebt(contracts, USDEAmountWei)
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, ETHAmount, totalDebt)

      const tx = await contracts.borrowerOperations.connect(signer).openTrove([], [], this._100pct, USDEAmountWei, upperHint, lowerHint, this.ZERO_ADDRESS, {
        from: signer.address,
        value: ETHAmount
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
      i += 1
    }
    return this.getGasMetrics(gasCostList)
  }

  static async addCollateralToCollateralManager(collateralManager, params) {
    await collateralManager.addCollateral(
      params._collateral,
      params._oracle
    );
    const validCollateral = await collateralManager.getCollateralSupport();
  }

  static async openTrove(contracts, {
    maxFeePercentage,
    extraUSDEAmount,
    upperHint,
    lowerHint,
    ICR,
    token,
    oracle,
    signer,
    extraParams
  }) {
    let flag
    if (!maxFeePercentage) maxFeePercentage = this._100pct
    if (!extraUSDEAmount) extraUSDEAmount = this.toBN(0)
    else if (typeof extraUSDEAmount == 'string') extraUSDEAmount = this.toBN(extraUSDEAmount)
    if (!upperHint) upperHint = this.ZERO_ADDRESS
    if (!lowerHint) lowerHint = this.ZERO_ADDRESS
    if (!token) {
      token = contracts.weth
      flag = true
    }
    if (!oracle) oracle = contracts.priceFeedETH
    // const account = extraParams.from
    const MIN_DEBT = (
      await this.getNetBorrowingAmount(contracts, await contracts.collateralManager.getMinNetDebt())
    ).add(this.toBN(1)) // add 1 to avoid rounding issues for tests where trove was opening at 130%, and you can’t open the first trove under TCR 130%
    const usdeAmount = MIN_DEBT.add(extraUSDEAmount)
    // console.log("MIN_DEBT: " + MIN_DEBT)

    if (!ICR && !extraParams.value) ICR = this.toBN(this.dec(13, 17)) // 130%
    else if (typeof ICR == 'string') ICR = this.toBN(ICR)
    // debt taken out = usdeAmount
    // totalDebt = debt taken out + fee + gas compensation
    const totalDebt = this.toBN(await this.getOpenTroveTotalDebt(contracts, usdeAmount.toString()))

    // netDebt = totalDebt - gas compensation
    const netDebt = await this.getActualDebtFromComposite(totalDebt.toString(), contracts)

    const price = this.toBN(await oracle.getPrice())
    let collateral
    let tx

    if (ICR) {
      const collateralAmount = ICR.mul(this.toBN(totalDebt)).div(price) //.div(this.toBN(this.dec(1, this.toBN(18).sub(await token.decimals()))))
      collateral = collateralAmount
      extraParams.value = collateralAmount.toString()

    } else {
      collateral = extraParams.value
    }

    if (flag) {
      // extraParams.value = collateral.toString();
      tx = await contracts.borrowerOperations.connect(signer).openTrove([], [], maxFeePercentage, usdeAmount.toString(), upperHint, lowerHint, this.ZERO_ADDRESS, extraParams)
    } else {
      const tokenMintedSuccessfully = await this.addERC20(token, signer, contracts.borrowerOperations.address, collateral, {
        from: signer.address
      })
      assert.isTrue(tokenMintedSuccessfully);
      extraParams.value = 0;
      tx = await contracts.borrowerOperations.connect(signer).openTrove([token.address], [collateral], maxFeePercentage, usdeAmount, upperHint, lowerHint, this.ZERO_ADDRESS, extraParams)
    }
    return {
      usdeAmount,
      netDebt,
      totalDebt,
      ICR,
      collateral: collateral,
      tx
    }
  }

  static async test(contracts, signer, wtoken, amount) {
    const tx = await contracts.borrowerOperations.openTrove(
      [wtoken], [amount.toString()],
      this._100pct,
      this.toBN(this.dec(2000, 18)),
      this.ZERO_ADDRESS,
      this.ZERO_ADDRESS,
      this.ZERO_ADDRESS, {
        from: signer
      }
    )
  }

  static async openTroveWithToken(contracts, token, {
    maxFeePercentage,
    extraUSDEAmount,
    upperHint,
    lowerHint,
    ICR,
    signer,
    extraParams
  }) {

    if (!maxFeePercentage) maxFeePercentage = this._100pct
    if (!extraUSDEAmount) extraUSDEAmount = this.toBN(0)
    else if (typeof extraUSDEAmount == 'string') extraUSDEAmount = this.toBN(extraUSDEAmount)
    if (!upperHint) upperHint = this.ZERO_ADDRESS
    if (!lowerHint) lowerHint = this.ZERO_ADDRESS

    const account = extraParams.from

    const MIN_DEBT = (
      await this.getNetBorrowingAmount(contracts, await contracts.collateralManager.getMinNetDebt())
    ).add(this.toBN(1)) // add 1 to avoid rounding issues for tests where trove was opening at 130%, and you can’t open the first trove under TCR 130%
    const usdeAmount = MIN_DEBT.add(extraUSDEAmount)


    if (!ICR && !extraParams.value) ICR = this.toBN(this.dec(13, 17)) // 130%
    else if (typeof ICR == 'string') ICR = this.toBN(ICR)

    const totalDebt = await this.getOpenTroveTotalDebt(contracts, usdeAmount)
    const netDebt = await this.getActualDebtFromComposite(totalDebt, contracts)

    // if (ICR) {
    const price = await contracts.priceFeedETH.getPrice()
    const collateralAmount = ICR.mul(totalDebt).div(price)
    const collateralVC = await contracts.collateralManager.getValues([contracts.weth.address], [collateralAmount]);

    extraParams.value = 0;

    // mint weth for from account (in extra params) and approve borrowerOperations to use it
    const tokenMint = await this.addERC20(token, signer, contracts.borrowerOperations.address, collateralAmount, {
      from: account
    })
    assert.isTrue(tokenMint);

    const tx = await contracts.borrowerOperations.connect(signer).openTrove([contracts.weth.address], [collateralAmount], maxFeePercentage, usdeAmount, upperHint, lowerHint, this.ZERO_ADDRESS, extraParams)
    return {
      usdeAmount,
      netDebt,
      totalDebt,
      ICR,
      collateral: collateralAmount,
      tx
    }
  }

  // replacing old addColl calls, mints some collateral and adds it to account
  static async addColl(contracts, collateralAmount, signer) {
    // mint weth for Alice and approve borrowerOperations to use it
    const account = signer.address
    await contracts.weth.mint(account, collateralAmount)
    await contracts.weth.connect(signer).approve(contracts.borrowerOperations.address, collateralAmount, {
      from: account
    })
    await contracts.borrowerOperations.connect(signer).addColl([contracts.weth.address], [collateralAmount], account, account, {
      from: account
    })
  }

  static printColls(name, tokens, amounts) {
    console.log(name + ":")
    for (let i = 0; i < tokens.length; i++) {
      console.log("token " + (i + 1) + " address " + tokens[i] + " with amount " + amounts[i])
    }
  }

  static async assertCollateralsEqual(tokens1, amounts1, tokens2, amounts2) {
    // this.printColls(tokens1, amounts1)
    // this.printColls(tokens2, amounts2)
    for (let i = 0; i < tokens1.length; i++) {
      const token1 = tokens1[i]
      const amount1 = this.toBN(amounts1[i])
      // console.log("token1: "+token1+"\tamount1: "+amount1)
      let found = false
      for (let j = 0; j < tokens2.length; j++) {
        const token2 = tokens2[j]
        const amount2 = this.toBN(amounts2[j])
        // console.log("token2: "+token2+"\tamount2: "+amount2)
        if (token1 == token2) {
          // console.log("token1", token1)
          // console.log("token2", token2)
          if (amount1.eq(amount2)) {
            found = true
            break
          } else {
            console.log("Token " + token1 + " amounts don't match: " + amount1 + " vs " + amount2)
            return false
          }
        }
      }
    }
    return true
  }

  // Same as assertCollateralsEqual but with tokens1 to be the whitelist tokens (or some larger list)
  // Only checks collisions with tokens2, ok if tokens2 does not contain that one. 
  static async leftAssertCollateralsEqual(tokens1, amounts1, tokens2, amounts2) {
    for (let i = 0; i < tokens1.length; i++) {
      const token1 = tokens1[i]
      const amount1 = this.toBN(amounts1[i])
      for (let j = 0; j < tokens2.length; j++) {
        const token2 = tokens2[j]
        const amount2 = this.toBN(amounts2[j])
        if (token1 == token2) {
          if (amount1.eq(amount2)) {
            break
          } else {
            console.log("Token " + token1 + " amounts don't match: " + amount1 + " vs " + amount2)
            return false
          }
        }
      }
    }
    return true
  }

  // mints amounts of given colls to from and then opens trove with those colls while taking out
  // debt of extraUSDEAmount
  static async openTroveWithColls(contracts, {
    maxFeePercentage,
    extraUSDEAmount,
    upperHint,
    lowerHint,
    ICR,
    colls,
    amounts,
    signer,
    extraParams
  }) {
    if (!maxFeePercentage) maxFeePercentage = this._100pct
    if (!extraUSDEAmount) extraUSDEAmount = this.toBN(0)
    else if (typeof extraUSDEAmount == 'string') extraUSDEAmount = this.toBN(extraUSDEAmount)
    if (!upperHint) upperHint = this.ZERO_ADDRESS
    if (!lowerHint) lowerHint = this.ZERO_ADDRESS

    const account = extraParams.from
    let usdeAmount
    const collsAddress = []
    const collsParamAddress = []
    const MIN_DEBT = (
      await this.getNetBorrowingAmount(contracts, await contracts.collateralManager.getMinNetDebt())
    ).add(this.toBN(1)) // add 1 to avoid rounding issues for tests where trove was opening at 130%, and you can’t open the first trove under TCR 130%
    usdeAmount = MIN_DEBT.add(extraUSDEAmount)

    if (!ICR) ICR = this.toBN(this.dec(13, 17)) // 130%
    else if (typeof ICR == 'string') ICR = this.toBN(ICR)

    const totalDebt = await this.getOpenTroveTotalDebt(contracts, usdeAmount)
    const netDebt = await this.getActualDebtFromComposite(totalDebt, contracts)
    let valueETH
    for (let i = 0; i < colls.length; i++) {
      collsAddress.push(colls[i].address)
      if (colls[i].address != contracts.weth.address) {
        collsParamAddress.push(colls[i].address)
      }
    }
    const totalVC = await contracts.collateralManager.getValues(collsAddress, amounts)
    const price = this.toBN(await contracts.priceFeedETH.getPrice())
    const amountsParam = []
    for (let i = 0; i < colls.length; i++) {
      const VC = (await contracts.collateralManager.getValues([colls[i].address], [amounts[i]]))

      // console.log("totalVC: ", totalVC[0].toString(), "VC: ", VC[0].toString())
      if (ICR) {
        amounts[i] = ICR.mul(totalDebt).div(price).mul(VC[0]).div(totalVC[0])
        // console.log((await colls[i].symbol()).toString(), amounts[i].toString())
      }

      if (colls[i].address != contracts.weth.address) {
        await this.addERC20(colls[i], signer, contracts.borrowerOperations.address, amounts[i], {
          from: account
        })
      }
      if (colls[i].address != contracts.weth.address) {
        amountsParam.push(amounts[i])
      } else {
        valueETH = amounts[i]
      }
    }

    const newTotalVC = (await contracts.collateralManager.getValues(collsAddress, amounts))[0]
    let tx
    tx = await contracts.borrowerOperations.connect(signer).openTrove(collsParamAddress, amountsParam, maxFeePercentage, usdeAmount, upperHint, lowerHint, this.ZERO_ADDRESS, {
      from: account,
      value: valueETH
    })
    return {
      usdeAmount,
      netDebt,
      totalDebt,
      ICR,
      newTotalVC,
      amounts,
      tx
    }
  }

  // mint collateralAmount of token to acccount
  // and then approve addressToApprove to spend collateralAmount of token
  static async addERC20(token, signer, addressToApprove, collateralAmount, extraParams) {
    const account = signer.address
    // if (!addressToApprove) {addressToApprove=contracts.borrowerOperations}
    const preMintBalance = await token.balanceOf(account)
    await token.mint(account, collateralAmount)
    const postMintBalance = await token.balanceOf(account)

    // console.log("WETH MINTED:", (postMintBalance.div(this.toBN(10 ** 18))).toNumber());

    await token.connect(signer).approve(addressToApprove, collateralAmount, extraParams);
    const tokenApprovedAmount = await token.allowance(account, addressToApprove)
    // console.log("TOKEN APPROVED:", (tokenApprovedAmount.div(this.toBN(10 ** 18))).toNumber());

    return (this.toNormalBase(postMintBalance.sub(preMintBalance)) == this.toNormalBase(collateralAmount) &&
      this.toNormalBase(collateralAmount) == this.toNormalBase(tokenApprovedAmount))
  }

  static async addWETH(token, addressToApprove, signer, extraParams) {
    // if (!addressToApprove) {addressToApprove=contracts.borrowerOperations}
    let collateralAmount = extraParams.value
    let account = extraParams.from
    const preMintBalance = await token.balanceOf(account)
    await token.connect(signer).deposit(extraParams)
    // await token.mint(account, collateralAmount)
    const postMintBalance = await token.balanceOf(account)

    // console.log("WETH MINTED:", (postMintBalance.div(this.toBN(10 ** 18))).toNumber());
    // console.log("collateral amount " + collateralAmount)
    await token.connect(signer).approve(addressToApprove, collateralAmount, {
      from: account
    });
    const tokenApprovedAmount = await token.allowance(account, addressToApprove)
    // console.log("TOKEN APPROVED:", (tokenApprovedAmount.div(this.toBN(10 ** 18))).toNumber());
    return (this.toNormalBase(postMintBalance.sub(preMintBalance)) == this.toNormalBase(collateralAmount) &&
      this.toNormalBase(collateralAmount) == this.toNormalBase(tokenApprovedAmount))
  }

  static async addMultipleERC20(signer, addressToApprove, tokens, amounts, extraParams) {
    for (let i = 0; i < tokens.length; i++) {
      if (!await this.addERC20(tokens[i], signer, addressToApprove, this.toBN(amounts[i]), extraParams)) return false
    }
    return true
  }

  static async mintAndApproveUSDEToken(contracts, account, addressToApprove, collateralAmount, extraParams) {
    const preMintBalance = await contracts.usdeToken.balanceOf(account)
    await contracts.usdeToken.unprotectedMint(account, collateralAmount)
    const postMintBalance = await contracts.usdeToken.balanceOf(account)

    await contracts.usdeToken.callInternalApprove(account, addressToApprove, collateralAmount)
    const approvedToken = await contracts.usdeToken.allowance(account, addressToApprove)

    return (this.toNormalBase(postMintBalance.sub(preMintBalance)) == this.toNormalBase(collateralAmount) &&
      this.toNormalBase(collateralAmount) == this.toNormalBase(approvedToken))
  }

  static async adjustTrove(contracts, signer, collsIn, amountsIn, collsOut, amountsOut, maxFeePercentage, USDEChange,
    isDebtIncrease, upperHint, lowerHint, extraParams) {

    const tx = await contracts.borrowerOperations.connect(signer).adjustTrove(collsIn, amountsIn, collsOut, amountsOut, maxFeePercentage, USDEChange,
      isDebtIncrease, upperHint, lowerHint, extraParams)
  }

  static async openTroveWithCollsOld(contracts, {
    maxFeePercentage,
    extraUSDEAmount,
    USDEAmount,
    upperHint,
    lowerHint,
    colls,
    amounts,
    ICR,
    signer,
    from,
    includeOne
  }) {

    if (!maxFeePercentage) maxFeePercentage = this._100pct
    if (!extraUSDEAmount) extraUSDEAmount = this.toBN(0)
    else if (typeof extraUSDEAmount == 'string') extraUSDEAmount = this.toBN(extraUSDEAmount)
    if (!upperHint) upperHint = this.ZERO_ADDRESS
    if (!lowerHint) lowerHint = this.ZERO_ADDRESS
    if (!USDEAmount) USDEAmount = this.toBN(0)
    if (!includeOne) includeOne = true
    let usdeAmount
    const collsAddress = []
    const MIN_DEBT = (
      await this.getNetBorrowingAmount(contracts, await contracts.collateralManager.getMinNetDebt())
    )
    if (includeOne) MIN_DEBT.add(this.toBN(1)) // add 1 to avoid rounding issues for tests where trove was opening at 150%, and you can’t open the first trove under TCR 150%
    if (USDEAmount.gt(MIN_DEBT)) usdeAmount = USDEAmount
    else usdeAmount = MIN_DEBT.add(extraUSDEAmount)

    const totalDebt = await this.getOpenTroveTotalDebt(contracts, usdeAmount)
    const netDebt = await this.getActualDebtFromComposite(totalDebt, contracts)
    for (let i = 0; i < colls.length; i++) {
      collsAddress.push(colls[i].address)
    }
    const totalVC = await contracts.collateralManager.getValues(collsAddress, amounts)

    // if (!ICR && !extraParams.value) ICR = this.toBN(this.dec(2, 18)) // 200%
    // else
    if (typeof ICR == 'string') ICR = this.toBN(ICR)
    if (ICR) {
      usdeAmount = await this.getOpenTroveUSDEAmount(contracts, totalVC[0].mul(this.toBN(this.dec(1, 18))).div(ICR))
    }
    for (let i = 0; i < colls.length; i++) {
      await this.addERC20(colls[i], signer, contracts.borrowerOperations.address, amounts[i], {
        from: from
      })
    }

    let tx = await contracts.borrowerOperations.connect(signer).openTrove(collsAddress, amounts, maxFeePercentage, usdeAmount, upperHint, lowerHint, this.ZERO_ADDRESS, {
      from: from
    })

    return {
      usdeAmount,
      netDebt,
      totalDebt,
      ICR,
      totalVC,
      amounts,
      tx
    }
  }

  // Pass in big number, divide by 18 and return normal number
  static toNormalBase(number) {
    return this.toBN(number).div(this.toBN(10 ** 18)).toNumber()
  }

  static async addTokensToAccountsAndOpenTroveWithICRNew(contracts, ICR, signers, tokens) {
    let extraParams
    for (let i = 0; i < signers.length; i++) {
      extraParams = {
        from: signers[i].address
      }
      for (let j = 0; j < tokens.length; j++) {
        await this.addERC20(tokens[j], signers[i], contracts.borrowerOperations.address, this.toBN(this.dec(1, 30)), extraParams)
      }
      let amounts1 = this.toBN(this.dec(1, 22))
      let amounts2 = this.toBN(this.dec(1, 22))
      let amounts3 = this.toBN(this.dec(1, 22))
      await this.openTroveWithColls(contracts, {
        ICR: ICR,
        colls: tokens,
        amounts: [amounts1, amounts2, amounts3, amounts1, amounts2, amounts3, amounts1, amounts2, amounts3, amounts1, amounts2, amounts3],
        signer: signers[i],
        extraParams: {
          from: signers[i].address
        }
      })
      for (let j = 0; j < tokens.length; j++) {
        await tokens[j].connect(signers[i]).approve(contracts.borrowerOperations.address, this.toBN(this.dec(1, 30)), extraParams);
        await this.addERC20(tokens[j], signers[i], contracts.borrowerOperations.address, this.toBN(this.dec(1, 30)), extraParams)
      }
    }
  }

  static async addTokensToAccountsAndOpenTroveWithICR(contracts, ICR, signers, tokens) {
    let extraParams
    for (let i = 0; i < signers.length; i++) {
      extraParams = {
        from: signers[i].address
      }
      for (let j = 0; j < tokens.length; j++) {
        await this.addERC20(tokens[j], signers[i], contracts.borrowerOperations.address, this.toBN(this.dec(1, 30)), extraParams)
      }
    }
    for (let i = 0; i < accounts.length; i++) {
      extraParams = {
        from: signers[i].address
      }
      let index1 = Math.floor(Math.random() * (tokens.length - 1))
      let index2 = Math.floor(Math.random() * (tokens.length - 1))
      let index3 = Math.floor(Math.random() * (tokens.length - 1))
      if (index1 == index2) {
        index2 = (index1 + 1) % tokens.length
      }
      if (index1 == index3) {
        index3 = (index1 + 1) % tokens.length
      }
      if (index2 == index3) {
        index3 = (index2 + 1) % tokens.length
      }
      // low decimal index hard coded to 11,
      let amounts1 = this.toBN(this.dec(1, 22))
      let amounts2 = this.toBN(this.dec(1, 22))
      let amounts3 = this.toBN(this.dec(1, 22))
      if (index1 == 11) {
        amounts1 = this.dec(1, 10)
      } else if (index2 == 11) {
        amounts2 = this.dec(1, 10)
      } else if (index3 == 11) {
        amounts3 = this.dec(1, 10)
      }
      await this.openTroveWithColls(contracts, {
        ICR: ICR,
        colls: [tokens[index1], tokens[index2], tokens[index3]],
        amounts: [amounts1, amounts2, amounts3],
        signer: signers[i],
        extraParams: {
          from: accounts[i]
        }
      })
      // Reapprove tokens to borrowerOperations
      await tokens[index1].connect(signers[i]).approve(contracts.borrowerOperations.address, this.toBN(this.dec(1, 30)), extraParams);
      await tokens[index2].connect(signers[i]).approve(contracts.borrowerOperations.address, this.toBN(this.dec(1, 30)), extraParams);
      await tokens[index3].connect(signers[i]).approve(contracts.borrowerOperations.address, this.toBN(this.dec(1, 30)), extraParams);
    }
  }

  static async adjustTrovesRandomly(contracts, signers, tokens) {
    for (let i = 0; i < signers.length; i++) {
      let extraParams = {
        from: signers[i].address
      }
      let token1 = (await this.getTroveEntireTokens(contracts, signers[i].address))[0]
      let index1
      for (let j = 0; j < tokens.length; j++) {
        if (tokens[j].address == token1.toString()) {
          index1 = j
          break
        }
      }
      let index2 = Math.floor(Math.random() * (tokens.length - 1))
      let index3 = Math.floor(Math.random() * (tokens.length - 1))
      if (index1 == index2) {
        index2 = (index1 + 1) % tokens.length
      }
      if (index1 == index3) {
        index3 = (index1 + 1) % tokens.length
      }
      if (index2 == index3) {
        index3 = (index2 + 1) % tokens.length
        if (index3 == index1) {
          index3 = (index3 + 1) % tokens.length
        }
      }
      await contracts.borrowerOperations.connect(signers[i]).adjustTrove(
        [tokens[index3].address, tokens[index2].address],
        [this.toBN(this.dec(10, 18)), this.toBN(this.dec(10, 18))],
        [tokens[index1].address],
        [this.toBN(this.dec(1, 9))],
        this._100pct,
        this.toBN(this.dec(1, 18)),
        true,
        this.ZERO_ADDRESS,
        this.ZERO_ADDRESS, {
          from: signers[i].address
        }
      )
    }
  }

  static async withdrawUSDE(contracts, {
    usdeAmount,
    ICR,
    upperHint,
    lowerHint,
    maxFeePercentage,
    signer,
    extraParams
  }) {
    if (!maxFeePercentage) maxFeePercentage = this._100pct
    if (!upperHint) upperHint = this.ZERO_ADDRESS
    if (!lowerHint) lowerHint = this.ZERO_ADDRESS

    assert(!(usdeAmount && ICR) && (usdeAmount || ICR), "Specify either usde amount or target ICR, but not both")

    let increasedTotalDebt
    if (ICR) {
      assert(extraParams.from, "A from account is needed")

      // get entire trove collateral and debt after considering redistribution
      const edc = await contracts.troveManager.getCurrentTroveAmounts(extraParams.from);

      const tokens = edc[1];
      const amounts = edc[0];
      const debt = edc[2];

      const troveVC = await contracts.collateralManager.getValues(tokens, amounts);

      const targetDebt = troveVC[0].mul(this.toBN(this.dec(1, 18))).div(ICR);

      assert(targetDebt > debt, "ICR is already greater than or equal to target")
      increasedTotalDebt = targetDebt.sub(debt)
      usdeAmount = await this.getNetBorrowingAmount(contracts, increasedTotalDebt)
    } else {
      increasedTotalDebt = await this.getAmountWithBorrowingFee(contracts, usdeAmount)
    }

    await contracts.borrowerOperations.connect(signer).withdrawUSDE(usdeAmount, upperHint, lowerHint, maxFeePercentage, extraParams)

    return {
      usdeAmount,
      increasedTotalDebt
    }
  }

  static async adjustTrove_allAccounts_randomAmount(signers, contracts, ETHMin, ETHMax, USDEMin, USDEMax) {
    const gasCostList = []

    for (const signer of signers) {
      let tx;

      let ETHChangeBN = this.toBN(this.randAmountInWei(ETHMin, ETHMax))
      let USDEChangeBN = this.toBN(this.randAmountInWei(USDEMin, USDEMax))

      const {
        newColl,
        newDebt
      } = await this.getCollAndDebtFromAdjustment(contracts, signer.address, ETHChangeBN, USDEChangeBN)
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const zero = this.toBN('0')

      let isDebtIncrease = USDEChangeBN.gt(zero)
      USDEChangeBN = USDEChangeBN.abs()

      // Add ETH to trove
      if (ETHChangeBN.gt(zero)) {
        tx = await contracts.borrowerOperations.connect(signer).adjustTrove([], [], [], [], USDEChangeBN, isDebtIncrease, upperHint, lowerHint, this._100pct, {
          from: signer.address,
          value: ETHChangeBN
        })
        // Withdraw ETH from trove
      } else if (ETHChangeBN.lt(zero)) {
        ETHChangeBN = ETHChangeBN.neg()
        tx = await contracts.borrowerOperations.connect(signer).adjustTrove([], [], [contracts.weth.address], [ETHChangeBN], USDEChangeBN, isDebtIncrease, upperHint, lowerHint, this._100pct, {
          from: signer.address
        })
      }

      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async adjustTrove_allAccounts_randomAmount(signers, contracts, ETHMin, ETHMax, USDEMin, USDEMax) {
    const gasCostList = []

    for (const signer of signers) {
      let tx;

      let ETHChangeBN = this.toBN(this.randAmountInWei(ETHMin, ETHMax))
      let USDEChangeBN = this.toBN(this.randAmountInWei(USDEMin, USDEMax))

      const {
        newColl,
        newDebt
      } = await this.getCollAndDebtFromAdjustment(contracts, signer.address, ETHChangeBN, USDEChangeBN)
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const zero = this.toBN('0')

      let isDebtIncrease = USDEChangeBN.gt(zero)
      USDEChangeBN = USDEChangeBN.abs()

      // Add ETH to trove
      if (ETHChangeBN.gt(zero)) {
        tx = await contracts.borrowerOperations.connect(signer).adjustTrove([], [], [], [], USDEChangeBN, isDebtIncrease, upperHint, lowerHint, this._100pct, {
          from: signer.address,
          value: ETHChangeBN
        })
        // Withdraw ETH from trove
      } else if (ETHChangeBN.lt(zero)) {
        ETHChangeBN = ETHChangeBN.neg()
        tx = await contracts.borrowerOperations.connect(signer).adjustTrove([], [], [contracts.weth.address], [ETHChangeBN], USDEChangeBN, isDebtIncrease, lowerHint, upperHint, this._100pct, {
          from: signer.address
        })
      }

      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      // console.log(`ETH change: ${ETHChangeBN},  USDEChange: ${USDEChangeBN}, gas: ${gas} `)

      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async addColl_allAccounts(signers, contracts, amount) {
    const gasCostList = []
    for (const signer of signers) {

      const {
        newColl,
        newDebt
      } = await this.getCollAndDebtFromAddColl(contracts, signer.address, amount)
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.connect(signer).addColl([], [], upperHint, lowerHint, {
        from: signer.address,
        value: amount
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async addColl_allAccounts_randomAmount(min, max, signers, contracts) {
    const gasCostList = []
    for (const signer of signers) {
      const randCollAmount = this.randAmountInWei(min, max)

      const {
        newColl,
        newDebt
      } = await this.getCollAndDebtFromAddColl(contracts, signer.address, randCollAmount)
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.connect(signer).addColl([], [], upperHint, lowerHint, {
        from: signer.address,
        value: randCollAmount
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawColl_allAccounts(signers, contracts, amount) {
    const gasCostList = []
    for (const signer of signers) {
      const {
        newColl,
        newDebt
      } = await this.getCollAndDebtFromWithdrawColl(contracts, signer.address, amount)
      // console.log(`newColl: ${newColl} `)
      // console.log(`newDebt: ${newDebt} `)
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.connect(signer).withdrawColl([contracts.weth.address], [amount], upperHint, lowerHint, {
        from: signers.address
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawColl_allAccounts_randomAmount(min, max, signers, contracts) {
    const gasCostList = []

    for (const signer of signers) {
      const randCollAmount = this.randAmountInWei(min, max)

      const {
        newColl,
        newDebt
      } = await this.getCollAndDebtFromWithdrawColl(contracts, signer.address, randCollAmount)
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.connect(signer).withdrawColl([contracts.weth.address], [randCollAmount], upperHint, lowerHint, {
        from: signer.address
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
      // console.log("gasCostlist length is " + gasCostList.length)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawUSDE_allAccounts(signers, contracts, amount) {
    const gasCostList = []

    for (const signer of signers) {
      const {
        newColl,
        newDebt
      } = await this.getCollAndDebtFromWithdrawUSDE(contracts, signer.address, amount)
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.connect(signer).withdrawUSDE(amount, upperHint, lowerHint, this._100pct, {
        from: signer.address
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawUSDE_allAccounts_randomAmount(min, max, signers, contracts) {
    const gasCostList = []

    for (const signer of signers) {
      const randUSDEAmount = this.randAmountInWei(min, max)

      const {
        newColl,
        newDebt
      } = await this.getCollAndDebtFromWithdrawUSDE(contracts, signer.address, randUSDEAmount)
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.connect(signer).withdrawUSDE(randUSDEAmount, upperHint, lowerHint, this._100pct, {
        from: signer.address
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async repayUSDE_allAccounts(signers, contracts, amount) {
    const gasCostList = []

    for (const signer of signers) {
      const {
        newColl,
        newDebt
      } = await this.getCollAndDebtFromRepayUSDE(contracts, signer.address, amount)
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.connect(signer).repayUSDE(amount, upperHint, lowerHint, {
        from: signer.address
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async repayUSDE_allAccounts_randomAmount(min, max, signers, contracts) {
    const gasCostList = []

    for (const signer of signers) {
      const randUSDEAmount = this.randAmountInWei(min, max)

      const {
        newColl,
        newDebt
      } = await this.getCollAndDebtFromRepayUSDE(contracts, signer.address, randUSDEAmount)
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.connect(signer).repayUSDE(randUSDEAmount, upperHint, lowerHint, {
        from: signer.address
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async getCurrentICR_allAccounts(signers, contracts, functionCaller) {
    const gasCostList = []

    for (const signer of signers) {
      const tx = await functionCaller.troveManager_getCurrentICR(signer.address)
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes) - 21000
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  // --- Redemption functions ---

  static async redeemCollateral(redeemer, contracts, USDEAmount, maxFee = this._100pct) {
    const price = await contracts.priceFeedETH.getPrice()
    const tx = await this.performRedemptionTx(redeemer, price, contracts, USDEAmount, maxFee)
    const gas = await this.gasUsed(tx)
    return gas
  }

  static async redeemCollateralAndGetTxObject(redeemer, contracts, USDEAmount, maxFee = this._100pct) {
    const price = await contracts.priceFeedETH.getPrice()
    const tx = await this.performRedemptionTx(redeemer, price, contracts, USDEAmount, maxFee)
    return tx
  }

  static async redeemCollateral_allAccounts_randomAmount(min, max, accounts, contracts) {
    const gasCostList = []
    const price = this.toBN(await contracts.priceFeedTestnet.getPrice())

    for (const redeemer of accounts) {
      const randUSDEAmount = this.randAmountInWei(min, max)

      tx = await this.performRedemptionTx(redeemer, price, contracts, randUSDEAmount)
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async performRedemptionWithMaxFeeAmount(redeemer, contracts, USDEAmount, maxFee = this._100pct, maxIterations = 0) {
    const finalUSDEAmount = this.toBN(USDEAmount)
    // TODO Ensure max fee is not greater than the amount of USDE fee calculated
    const price = contracts.priceFeedETH.getPrice()
    const redemptionhint = await contracts.hintHelpers.getRedemptionHints(finalUSDEAmount, price, 0)

    const firstRedemptionHint = redemptionhint[0]
    const partialRedemptionNewICR = redemptionhint[1]

    const {
      hintAddress: approxPartialRedemptionHint,
      latestRandomSeed
    } = await contracts.hintHelpers.getApproxHint(partialRedemptionNewICR, 50, this.latestRandomSeed, price)
    this.latestRandomSeed = latestRandomSeed

    const exactPartialRedemptionHint = (await contracts.sortedTroves.findInsertPosition(partialRedemptionNewICR,
      approxPartialRedemptionHint,
      approxPartialRedemptionHint))

    const totalUSDE_ToPullIn = this.toBN(1000000).mul(finalUSDEAmount);
    // console.log("TO Pull IN", totalUSDE_ToPullIn.toString());

    await contracts.usdeToken.connect(redeemer).approve(contracts.troveManagerRedemptions.address, totalUSDE_ToPullIn, {
      from: redeemer.address
    });

    const tx = await contracts.troveManager.connect(redeemer).redeemCollateral(finalUSDEAmount,
      firstRedemptionHint,
      exactPartialRedemptionHint[0],
      exactPartialRedemptionHint[1],
      partialRedemptionNewICR,
      maxIterations,
      maxFee, {
        from: redeemer.address,
        gasPrice: 50000
      },
    )

    return tx
  }

  static async estimateUSDEEligible(contracts, USDEAmount) {
    const totalUSDESupply = await contracts.troveManagerRedemptions.getEntireSystemDebt(); // S
    const decayedBaseRate = await contracts.troveManager.calcDecayedBaseRate(); // BR
    const squareTerm = (this.toBN(this.dec(1005, 15)).add(decayedBaseRate)) // BR + .5%
    const sqrtTerm = squareTerm.mul(squareTerm) //.div(this.toBN(this.dec(1,18))) // Square term squared, over the precision
    const sqrtTerm2 = ((this.toBN(this.dec(2, 0))).mul(this.toBN(USDEAmount))).mul(this.toBN(this.dec(1, 36))).div(totalUSDESupply)
    const finalSqrtTerm = this.sqrt((sqrtTerm.add(sqrtTerm2)).mul(this.toBN(this.dec(1, 18)))) //.div(this.toBN(this.dec(1,9)))

    const finalUSDEAmount = totalUSDESupply.mul(finalSqrtTerm.sub(squareTerm.mul(this.toBN(this.dec(1, 9))))).div(this.toBN(this.dec(1, 27)))
    // console.log("FINAL USDE AMOUNT : " + finalUSDEAmount)
    // console.log("FINAL USDE FEE : ", this.toBN(USDEAmount).sub(finalUSDEAmount).toString())
    return finalUSDEAmount
  }

  // Using babylonian estimation of the square root for big numbers
  static sqrt(x) {
    let z = (x.add(this.toBN(this.dec(1, 0)))).div(this.toBN(this.dec(2, 0)))
    let y = x
    while (z.lt(y)) {
      y = z
      z = ((x.div(z)).add(z)).div(this.toBN(this.dec(2, 0)))
    }
    return y
  }

  static async estimateRedemptionFee(contracts, USDEAmount) {
    const estimateUpdatedBaseRate = await this.estimateUpdatedBaseRateFromRedemption(contracts, USDEAmount)
    // console.log("ESTIMATED UDPATED BSE RATE " + estimateUpdatedBaseRate.toString())
    return (this.toBN(estimateUpdatedBaseRate).add(this.toBN(this.dec(5, 15)))).mul(USDEAmount).div(this.toBN(this.dec(1, 18)))
  }

  static async estimateUpdatedBaseRateFromRedemption(contracts, USDEAmount) {
    const USDESupplyAtStart = await contracts.troveManagerRedemptions.getEntireSystemDebt();
    const decayedBaseRate = await contracts.troveManager.calcDecayedBaseRate();

    /* Convert the drawn ETH back to USDE at face value rate (1 USDE:1 USD), in order to get
     * the fraction of total supply that was redeemed at face value. */
    const redeemedUSDEFraction = USDEAmount.mul(this.toBN(this.dec(1, 18))).div(USDESupplyAtStart);
    const BETA = 2
    const newBaseRate = decayedBaseRate.add(redeemedUSDEFraction.div(this.toBN(this.dec(BETA, 0))));
    // console.log("USDESUPPLY AT START ", USDESupplyAtStart.toString())
    // console.log("REDEEMED USDE FRACTION " + redeemedUSDEFraction.toString())
    // console.log("NEW BASE RATE ", newBaseRate.toString())
    return Math.min(newBaseRate, this._100pct); // cap baseRate at a maximum of 100%

  }

  // --- Composite functions ---

  static async makeTrovesIncreasingICR(accounts, contracts) {
    let amountFinney = 2000

    for (const account of accounts) {
      const coll = web3.utils.toWei(amountFinney.toString(), 'finney')

      await contracts.borrowerOperations.openTrove(this._100pct, '200000000000000000000', account, account, this.ZERO_ADDRESS, {
        from: account,
        value: coll
      })

      amountFinney += 10
    }
  }

  // --- StabilityPool gas functions ---

  static async provideToSP_allAccounts(signers, stabilityPool, amount) {
    const gasCostList = []
    for (const signer of signers) {
      const tx = await stabilityPool.connect(signer).provideToSP(amount, this.ZERO_ADDRESS, {
        from: signer.address
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async provideToSP_allAccounts_randomAmount(min, max, signers, stabilityPool) {
    const gasCostList = []
    for (const signer of signers) {
      const randomUSDEAmount = this.randAmountInWei(min, max)
      const tx = await stabilityPool.connect(signer).provideToSP(randomUSDEAmount, this.ZERO_ADDRESS, {
        from: signer.address
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawFromSP_allAccounts(signers, stabilityPool, amount) {
    const gasCostList = []
    for (const signer of signers) {
      const tx = await stabilityPool.connect(signer).withdrawFromSP(amount, {
        from: signer.address
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawFromSP_allAccounts_randomAmount(min, max, signers, stabilityPool) {
    const gasCostList = []
    for (const signer of signers) {
      const randomUSDEAmount = this.randAmountInWei(min, max)
      const tx = await stabilityPool.connect(signer).withdrawFromSP(randomUSDEAmount, {
        from: signer.address
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawETHGainToTrove_allAccounts(signers, contracts) {
    const gasCostList = []
    for (const signer of signers) {

      let {
        entireColl,
        entireDebt
      } = await this.getEntireCollAndDebt(contracts, signer.address)
      // console.log(`entireColl: ${entireColl}`)
      // console.log(`entireDebt: ${entireDebt}`)
      const ETHGain = await contracts.stabilityPool.getDepositorETHGain(signer.address)
      const newColl = entireColl.add(ETHGain)
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, newColl, entireDebt)

      const tx = await contracts.stabilityPool.connect(signer).withdrawETHGainToTrove(upperHint, lowerHint, {
        from: signer.address
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async addColl_allAccounts(signers, contracts, amount) {
    const gasCostList = []
    for (const signer of signers) {

      const {
        newColl,
        newDebt
      } = await this.getCollAndDebtFromAddColl(contracts, signer.address, amount)
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.connect(signer).addColl(upperHint, lowerHint, {
        from: signer.address,
        value: amount
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async addColl_allAccounts_randomAmount(min, max, signers, contracts) {
    const gasCostList = []
    for (const signer of signers) {
      const randCollAmount = this.randAmountInWei(min, max)

      const {
        newColl,
        newDebt
      } = await this.getCollAndDebtFromAddColl(contracts, signer.address, randCollAmount)
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.connect(signer).addColl(upperHint, lowerHint, {
        from: signer.address,
        value: randCollAmount
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawColl_allAccounts(signers, contracts, amount) {
    const gasCostList = []
    for (const signer of signers) {
      const {
        newColl,
        newDebt
      } = await this.getCollAndDebtFromWithdrawColl(contracts, signer.address, amount)
      // console.log(`newColl: ${newColl} `)
      // console.log(`newDebt: ${newDebt} `)
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.connect(signer).withdrawColl(amount, upperHint, lowerHint, {
        from: signer.address
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawColl_allAccounts_randomAmount(min, max, signers, contracts) {
    const gasCostList = []

    for (const signer of signers) {
      const randCollAmount = this.randAmountInWei(min, max)

      const {
        newColl,
        newDebt
      } = await this.getCollAndDebtFromWithdrawColl(contracts, signer.address, randCollAmount)
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.connect(signer).withdrawColl(randCollAmount, upperHint, lowerHint, {
        from: signer.address
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
      // console.log("gasCostlist length is " + gasCostList.length)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawUSDE_allAccounts(signers, contracts, amount) {
    const gasCostList = []

    for (const signer of signers) {
      const {
        newColl,
        newDebt
      } = await this.getCollAndDebtFromWithdrawUSDE(contracts, signer.address, amount)
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.connect(signer).withdrawUSDE(this._100pct, amount, upperHint, lowerHint, {
        from: signer.address
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawUSDE_allAccounts_randomAmount(min, max, signers, contracts) {
    const gasCostList = []

    for (const signer of signers) {
      const randUSDEAmount = this.randAmountInWei(min, max)

      const {
        newColl,
        newDebt
      } = await this.getCollAndDebtFromWithdrawUSDE(contracts, signer.address, randUSDEAmount)
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.connect(signer).withdrawUSDE(this._100pct, randUSDEAmount, upperHint, lowerHint, {
        from: signer.address
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async repayUSDE_allAccounts(signers, contracts, amount) {
    const gasCostList = []

    for (const signer of signers) {
      const {
        newColl,
        newDebt
      } = await this.getCollAndDebtFromRepayUSDE(contracts, signer.address, amount)
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.connect(signer).repayUSDE(amount, upperHint, lowerHint, {
        from: signer.address
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async repayUSDE_allAccounts_randomAmount(min, max, signers, contracts) {
    const gasCostList = []

    for (const signer of signers) {
      const randUSDEAmount = this.randAmountInWei(min, max)

      const {
        newColl,
        newDebt
      } = await this.getCollAndDebtFromRepayUSDE(contracts, signer.address, randUSDEAmount)
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.connect(signer).repayUSDE(randUSDEAmount, upperHint, lowerHint, {
        from: signer.address
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async getCurrentICR_allAccounts(accounts, contracts, functionCaller) {
    const gasCostList = []
    const price = await contracts.priceFeedTestnet.getPrice()

    for (const account of accounts) {
      const tx = await functionCaller.troveManager_getCurrentICR(account)
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes) - 21000
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  // --- Redemption functions ---

  static async redeemCollateral(redeemer, contracts, USDEAmount, maxFee = this._100pct) {
    const price = await contracts.priceFeedETH.getPrice()
    const tx = await this.performRedemptionTx(redeemer, price, contracts, USDEAmount, maxFee)
    const gas = await this.gasUsed(tx)
    return gas
  }

  static async redeemCollateralAndGetTxObject(redeemer, contracts, USDEAmount, maxFee = this._100pct) {
    const price = await contracts.priceFeedETH.getPrice()
    const tx = await this.performRedemptionTx(redeemer, price, contracts, USDEAmount, maxFee)
    return tx
  }

  static async redeemCollateral_allAccounts_randomAmount(min, max, accounts, contracts) {
    const gasCostList = []
    const price = await contracts.priceFeedTestnet.getPrice()

    for (const redeemer of accounts) {
      const randUSDEAmount = this.randAmountInWei(min, max)

      tx = await this.performRedemptionTx(redeemer, price, contracts, randUSDEAmount)
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async performRedemptionTx(redeemer, price, contracts, USDEAmount, maxFee = this._100pct, maxIterations = 0, gasPrice_toUse = 0) {
    const redemptionhint = await contracts.hintHelpers.getRedemptionHints(USDEAmount, price, maxIterations)

    const firstRedemptionHint = redemptionhint[0]
    const partialRedemptionNewICR = redemptionhint[1]

    const {
      hintAddress: approxPartialRedemptionHint,
      latestRandomSeed
    } = await contracts.hintHelpers.getApproxHint(partialRedemptionNewICR, 50, this.latestRandomSeed, price)
    this.latestRandomSeed = latestRandomSeed
    const exactPartialRedemptionHint = (await contracts.sortedTroves.findInsertPosition(partialRedemptionNewICR,
      approxPartialRedemptionHint,
      approxPartialRedemptionHint))
    const tx = await contracts.troveManager.connect(redeemer).redeemCollateral(USDEAmount,
      firstRedemptionHint,
      exactPartialRedemptionHint[0],
      exactPartialRedemptionHint[1],
      partialRedemptionNewICR,
      maxIterations, maxFee, {
        from: redeemer.address,
        gasPrice: gasPrice_toUse
      },
    )
    const txRes = await tx.wait()
    return txRes
  }

  static async performRedemptionWithMaxFeeAmount(redeemer, contracts, USDEAmount, maxFee = this._100pct, maxIterations = 0, gasPrice_toUse = 0) {
    const finalUSDEAmount = this.toBN(USDEAmount)
    // TODO Ensure max fee is not greater than the amount of USDE fee calculated
    const price = await contracts.priceFeedETH.getPrice()
    const redemptionhint = await contracts.hintHelpers.getRedemptionHints(finalUSDEAmount, price, 0)

    const firstRedemptionHint = redemptionhint[0]
    const partialRedemptionNewICR = redemptionhint[1]
    const {
      hintAddress: approxPartialRedemptionHint,
      latestRandomSeed
    } = await contracts.hintHelpers.getApproxHint(partialRedemptionNewICR, 50, this.latestRandomSeed, price)
    this.latestRandomSeed = latestRandomSeed

    const exactPartialRedemptionHint = (await contracts.sortedTroves.findInsertPosition(partialRedemptionNewICR,
      approxPartialRedemptionHint,
      approxPartialRedemptionHint))

    const totalUSDE_ToPullIn = this.toBN(1000000).mul(finalUSDEAmount);
    // console.log("TO Pull IN", totalUSDE_ToPullIn.toString());

    await contracts.usdeToken.connect(redeemer).approve(contracts.troveManagerRedemptions.address, totalUSDE_ToPullIn, {
      from: redeemer.address
    });

    const tx = await contracts.troveManager.connect(redeemer).redeemCollateral(finalUSDEAmount,
      firstRedemptionHint,
      exactPartialRedemptionHint[0],
      exactPartialRedemptionHint[1],
      partialRedemptionNewICR,
      maxIterations,
      maxFee, {
        from: redeemer.address,
        gasPrice: gasPrice_toUse
      },
    )

    return tx
  }

  static async estimateUSDEEligible(contracts, USDEAmount) {
    const totalUSDESupply = await contracts.troveManagerRedemptions.getEntireSystemDebt(); // S
    const decayedBaseRate = await contracts.troveManager.calcDecayedBaseRate(); // BR
    const squareTerm = (this.toBN(this.dec(1005, 15)).add(decayedBaseRate)) // BR + .5%
    const sqrtTerm = squareTerm.mul(squareTerm) //.div(this.toBN(this.dec(1,18))) // Square term squared, over the precision
    const sqrtTerm2 = ((this.toBN(this.dec(2, 0))).mul(this.toBN(USDEAmount))).mul(this.toBN(this.dec(1, 36))).div(totalUSDESupply)
    const finalSqrtTerm = this.sqrt((sqrtTerm.add(sqrtTerm2)).mul(this.toBN(this.dec(1, 18)))) //.div(this.toBN(this.dec(1,9)))

    const finalUSDEAmount = totalUSDESupply.mul(finalSqrtTerm.sub(squareTerm.mul(this.toBN(this.dec(1, 9))))).div(this.toBN(this.dec(1, 27)))
    // console.log("FINAL YUDS AMOUNT : " + finalUSDEAmount)
    // console.log("FINAL USDE FEE : ", this.toBN(USDEAmount).sub(finalUSDEAmount).toString())
    return finalUSDEAmount
  }

  // Using babylonian estimation of the square root for big numbers
  static sqrt(x) {
    let z = (x.add(this.toBN(this.dec(1, 0)))).div(this.toBN(this.dec(2, 0)))
    let y = x
    while (z.lt(y)) {
      y = z
      z = ((x.div(z)).add(z)).div(this.toBN(this.dec(2, 0)))
    }
    return y
  }

  static async estimateRedemptionFee(contracts, USDEAmount) {
    const estimateUpdatedBaseRate = await this.estimateUpdatedBaseRateFromRedemption(contracts, USDEAmount)
    // console.log("ESTIMATED UDPATED BSE RATE " + estimateUpdatedBaseRate.toString())
    return (this.toBN(estimateUpdatedBaseRate).add(this.toBN(this.dec(5, 15)))).mul(USDEAmount).div(this.toBN(this.dec(1, 18)))
  }

  static async estimateUpdatedBaseRateFromRedemption(contracts, USDEAmount) {
    const USDESupplyAtStart = await contracts.troveManagerRedemptions.getEntireSystemDebt();
    const decayedBaseRate = await contracts.troveManager.calcDecayedBaseRate();

    /* Convert the drawn ETH back to USDE at face value rate (1 USDE:1 USD), in order to get
     * the fraction of total supply that was redeemed at face value. */
    const redeemedUSDEFraction = USDEAmount.mul(this.toBN(this.dec(1, 18))).div(USDESupplyAtStart);
    const BETA = 2
    const newBaseRate = decayedBaseRate.add(redeemedUSDEFraction.div(this.toBN(this.dec(BETA, 0))));
    // console.log("USDESUPPLY AT START ", USDESupplyAtStart.toString())
    // console.log("REDEEMED USDE FRACTION " + redeemedUSDEFraction.toString())
    // console.log("NEW BASE RATE ", newBaseRate.toString())
    return Math.min(newBaseRate, this._100pct); // cap baseRate at a maximum of 100%

  }

  // --- Composite functions ---

  static async makeTrovesIncreasingICR(accounts, contracts) {
    let amountFinney = 2000

    for (const account of accounts) {
      const coll = web3.utils.toWei(amountFinney.toString(), 'finney')

      await contracts.borrowerOperations.openTrove([], [], this._100pct, '200000000000000000000', account, account, this.ZERO_ADDRESS, {
        from: account,
        value: coll
      })

      amountFinney += 10
    }
  }

  // --- StabilityPool gas functions ---

  static async provideToSP_allAccounts(signers, stabilityPool, amount) {
    const gasCostList = []
    for (const signer of signers) {
      const tx = await stabilityPool.connect(signer).provideToSP(amount, this.ZERO_ADDRESS, {
        from: signer.address
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async provideToSP_allAccounts_randomAmount(min, max, signers, stabilityPool) {
    const gasCostList = []
    for (const signer of signers) {
      const randomUSDEAmount = this.randAmountInWei(min, max)
      const tx = await stabilityPool.connect(signer).provideToSP(randomUSDEAmount, this.ZERO_ADDRESS, {
        from: signer.address
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawFromSP_allAccounts(signers, stabilityPool, amount) {
    const gasCostList = []
    for (const signer of signers) {
      const tx = await stabilityPool.connect(signer).withdrawFromSP(amount, {
        from: signer.address
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawFromSP_allAccounts_randomAmount(min, max, signers, stabilityPool) {
    const gasCostList = []
    for (const signer of signers) {
      const randomUSDEAmount = this.randAmountInWei(min, max)
      const tx = await stabilityPool.connect(signer).withdrawFromSP(randomUSDEAmount, {
        from: signer.address
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawColalteralGainToTrove_allAccounts(signers, contracts) {
    const gasCostList = []
    for (const signer of signers) {

      let {
        entireColl,
        entireDebt
      } = await this.getEntireCollAndDebt(contracts, signer.address)
      // console.log(`entireColl: ${entireColl}`)
      // console.log(`entireDebt: ${entireDebt}`)
      const ETHGain = await contracts.stabilityPool.getDepositorCollateralGain(signer.address)
      const newColl = entireColl.add(ETHGain)
      const {
        upperHint,
        lowerHint
      } = await this.getBorrowerOpsListHint(contracts, newColl, entireDebt)

      const tx = await contracts.stabilityPool.connect(signer).withdrawCollateralGainToTrove(upperHint, lowerHint, {
        from: signer.address
      })
      const txRes = await tx.wait()
      const gas = this.gasUsed(txRes)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }


  static async registerFrontEnds(frontEnds, stabilityPool) {
    for (const frontEnd of frontEnds) {
      await stabilityPool.connect(frontEnd).registerFrontEnd(this.dec(5, 17), {
        from: frontEnd.address
      }) // default kickback rate of 50%
    }
  }

  // --- Time functions ---

  static async fastForwardTime(seconds, currentWeb3Provider) {
    await currentWeb3Provider.send({
        id: 0,
        jsonrpc: '2.0',
        method: 'evm_increaseTime',
        params: [seconds]
      },
      (err) => {
        if (err) console.log(err)
      })

    await currentWeb3Provider.send({
        id: 0,
        jsonrpc: '2.0',
        method: 'evm_mine'
      },
      (err) => {
        if (err) console.log(err)
      })
  }

  static async getLatestBlockTimestamp(web3Instance) {
    const blockNumber = await web3Instance.eth.getBlockNumber()
    const block = await web3Instance.eth.getBlock(blockNumber)

    return block.timestamp
  }

  static async getTimestampFromTx(tx, web3Instance) {
    return this.getTimestampFromTxReceipt(tx, web3Instance)
  }

  static async getTimestampFromTxReceipt(txReceipt, web3Instance) {
    const block = await web3Instance.eth.getBlock(txReceipt.blockNumber)
    return block.timestamp
  }

  static secondsToDays(seconds) {
    return Number(seconds) / (60 * 60 * 24)
  }

  static daysToSeconds(days) {
    return Number(days) * (60 * 60 * 24)
  }

  static async getTimeFromSystemDeployment(troveManager, web3, timePassedSinceDeployment) {
    const deploymentTime = await troveManager.getDelayTime()
    return this.toBN(deploymentTime).add(this.toBN(timePassedSinceDeployment))
  }

  static async mockTroveChange(contracts, collChange, isCollIncrease, debtChange, isDebtChange) {
    const totalValue = await contracts.troveManager.getTotalValue()
    const activeDebt = await contracts.troveDebt.totalSupply()
    const closedDebt = await contracts.defaultPool.getUSDEDebt()
    const gasUSDE = await contracts.usdeToken.balanceOf(contracts.gasPool.address)
    const debt = this.toBN(activeDebt).add(this.toBN(closedDebt)).add(this.toBN(gasUSDE))

    var value
    var newDebt
    if (isCollIncrease) {
      value = this.toBN(totalValue).add(this.toBN(collChange))
    } else {
      value = this.toBN(totalValue).sub(this.toBN(collChange))
    }
    if (isDebtChange) {
      newDebt = this.toBN(debt).add(this.toBN(debtChange))
    } else {
      newDebt = this.toBN(debt).sub(this.toBN(debtChange))
    }

    if (newDebt > this.toBN(0)) {
      return value.mul(this.toBN(this.dec(1, 18))).div(newDebt)
    } else {
      return this.toBN(this.dec(1, 100))
    }
  }

  static async mockGetEDC(contracts, trove) {

  }

  // --- Assert functions ---

  static async assertRevert(txPromise, message = undefined) {
    try {
      const tx = await txPromise
      // console.log("tx succeeded")
      const txRes = await tx.wait()
      assert.isFalse(txRes.status === 1) // when this assert fails, the expected revert didn't occur, i.e. the tx succeeded
    } catch (err) {
      // console.log("tx failed")
      // console.log(err.message)

      // TODO !!!

      if (message) {
        assert.include(err.message, message)
      } else {
        assert.include(err.message, "revert")
      }
    }
  }

  static async assertAssert(txPromise, message = undefined) {
    try {
      const tx = await txPromise
      assert.isFalse(tx.receipt.status) // when this assert fails, the expected revert didn't occur, i.e. the tx succeeded
    } catch (err) {
      if (message) {
        assert.include(err.message, message)
      } else {
        assert.include(err.message, "invalid opcode")
      }
    }
  }

  // --- Misc. functions  ---

  static async forceSendEth(from, receiver, value) {
    const destructible = await Destructible.new()
    await web3.eth.sendTransaction({
      to: destructible.address,
      from,
      value
    })
    await destructible.destruct(receiver)
  }

  static hexToParam(hexValue) {
    return ('0'.repeat(64) + hexValue.slice(2)).slice(-64)
  }

  static formatParam(param) {
    let formattedParam = param
    if (typeof param == 'number' || typeof param == 'object' ||
      (typeof param == 'string' && (new RegExp('[0-9]*')).test(param))) {
      formattedParam = web3.utils.toHex(formattedParam)
    } else if (typeof param == 'boolean') {
      formattedParam = param ? '0x01' : '0x00'
    } else if (param.slice(0, 2) != '0x') {
      formattedParam = web3.utils.asciiToHex(formattedParam)
    }

    return this.hexToParam(formattedParam)
  }
  static getTransactionData(signatureString, params) {
    /*
     console.log('signatureString: ', signatureString)
     console.log('params: ', params)
     console.log('params: ', params.map(p => typeof p))
     */
    return web3.utils.sha3(signatureString).slice(0, 10) +
      params.reduce((acc, p) => acc + this.formatParam(p), '')
  }
}

TestHelper.ZERO_ADDRESS = '0x' + '0'.repeat(40)
TestHelper.maxBytes32 = '0x' + 'f'.repeat(64)


TestHelper._100pct = '1000000000000000000'
TestHelper.latestRandomSeed = 31337

module.exports = {
  TestHelper,
  MoneyValues,
  TimeValues
}