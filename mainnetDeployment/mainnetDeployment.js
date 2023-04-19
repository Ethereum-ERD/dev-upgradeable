// const { UniswapV2Factory } = require("./ABIs/UniswapV2Factory.js")
// const { UniswapV2Pair } = require("./ABIs/UniswapV2Pair.js")
// const { UniswapV2Router02 } = require("./ABIs/UniswapV2Router02.js")
const { ChainlinkAggregatorV3Interface } = require("./ABIs/ChainlinkAggregatorV3Interface.js")
const { TestHelper: th, TimeValues: timeVals } = require("../utils/testHelpers.js")
const { dec } = th
const MainnetDeploymentHelper = require("../utils/mainnetDeploymentHelpers.js")
const toBigNum = ethers.BigNumber.from

async function mainnetDeploy(configParams) {
  const date = new Date()
  console.log(date.toUTCString())
  const deployerWallet = (await ethers.getSigners())[0]
  // const account2Wallet = (await ethers.getSigners())[1]
  const basefee = await ethers.provider.getGasPrice();
  const gasPrice = toBigNum(basefee).add(toBigNum('20000000000')) // add tip
  configParams.GAS_PRICE = gasPrice;
  console.log(`BWB gasPrice is ${configParams.GAS_PRICE}`)

  const mdh = new MainnetDeploymentHelper(configParams, deployerWallet)
  
  const deploymentState = mdh.loadPreviousDeployment()
  console.log(`deployer address: ${deployerWallet.address}`)
  assert.equal(deployerWallet.address, configParams.liquityAddrs.DEPLOYER)
  // assert.equal(account2Wallet.address, configParams.beneficiaries.ACCOUNT_2)
  let deployerETHBalance = await ethers.provider.getBalance(deployerWallet.address)
  console.log(`deployerETHBalance before: ${deployerETHBalance}`)

  deployerETHBalance = await ethers.provider.getBalance(deployerWallet.address)
  console.log(`deployer's ETH balance before deployments: ${deployerETHBalance}`)

  // Deploy core logic contracts
  const erdCore = await mdh.deployERDCoreMainnet(deploymentState)
  console.log("Deployed ERD core mainnet");
  await mdh.logContractObjects(erdCore)



//   // Check Uniswap Pair EUSD-ETH pair before pair creation
//   let EUSDWETHPairAddr = await uniswapV2Factory.getPair(erdCore.eusdToken.address, configParams.externalAddrs.WETH_ERC20)
//   let WETHEUSDPairAddr = await uniswapV2Factory.getPair(configParams.externalAddrs.WETH_ERC20, erdCore.eusdToken.address)
//   assert.equal(EUSDWETHPairAddr, WETHEUSDPairAddr)

//   if (EUSDWETHPairAddr == th.ZERO_ADDRESS) {
//     // Deploy Unipool for EUSD-WETH
//     const pairTx = await mdh.sendAndWaitForTransaction(uniswapV2Factory.createPair(
//       configParams.externalAddrs.WETH_ERC20,
//       erdCore.eusdToken.address,
//       { gasPrice }
//     ))

//     // Check Uniswap Pair EUSD-WETH pair after pair creation (forwards and backwards should have same address)
//     EUSDWETHPairAddr = await uniswapV2Factory.getPair(erdCore.eusdToken.address, configParams.externalAddrs.WETH_ERC20)
//     assert.notEqual(EUSDWETHPairAddr, th.ZERO_ADDRESS)
//     WETHEUSDPairAddr = await uniswapV2Factory.getPair(configParams.externalAddrs.WETH_ERC20, erdCore.eusdToken.address)
//     console.log(`EUSD-WETH pair contract address after Uniswap pair creation: ${EUSDWETHPairAddr}`)
//     assert.equal(WETHEUSDPairAddr, EUSDWETHPairAddr)
//   }

//   deploymentState['uniToken'] = {address: eUSDWETHPairAddr};
//   // Deploy Unipool
//   const unipool = await mdh.deployUnipoolMainnet(deploymentState);

  
  // Deploy ERD Contracts
  const ERDContracts = await mdh.deployERDContractsMainnet(
    deploymentState,
  );
  console.log("Deployed ERD Contracts");

  // Connect all core contracts up
  await mdh.connectCoreContractsMainnet(erdCore, ERDContracts, configParams.externalAddrs.CHAINLINK_ETHUSD_PROXY)
  console.log("Connected Core Contracts");

  
  mdh.saveDeployment(deploymentState)
  // // --- TESTS AND CHECKS  ---
 
//   // Deployer repay EUSD
//   console.log(`deployer trove debt before repaying: ${await erdCore.troveManager.getTroveDebt(deployerWallet.address)}`)
//  await mdh.sendAndWaitForTransaction(erdCore.borrowerOperations.repayEUSD(dec(800, 18), th.ZERO_ADDRESS, th.ZERO_ADDRESS, {gasPrice, gasLimit: 1000000}))
//   console.log(`deployer trove debt after repaying: ${await erdCore.troveManager.getTroveDebt(deployerWallet.address)}`)
 
//   // Deployer add coll
//   console.log(`deployer trove coll before adding coll: ${await erdCore.troveManager.getTroveColl(deployerWallet.address)}`)
//   await mdh.sendAndWaitForTransaction(erdCore.borrowerOperations.addColl([], [], th.ZERO_ADDRESS, th.ZERO_ADDRESS, {value: dec(2, 'ether'), gasPrice, gasLimit: 1000000}))
//   console.log(`deployer trove coll after addingColl: ${await erdCore.troveManager.getTroveColl(deployerWallet.address)}`)
 
  // Check chainlink proxy price ---
 
  const chainlinkProxy = new ethers.Contract(
    configParams.externalAddrs.CHAINLINK_ETHUSD_PROXY,
    ChainlinkAggregatorV3Interface,
    deployerWallet
  )
 
  // Get latest price
  let chainlinkPrice = await chainlinkProxy.latestAnswer()
  console.log(`current Chainlink price: ${chainlinkPrice}`)
 
  // --- PriceFeed ---
  console.log("PRICEFEED CHECKS")
  // Check Pricefeed's status and last good price
  const lastGoodPrice = await erdCore.priceFeed.lastGoodPrice()
  const priceFeedInitialStatus = await erdCore.priceFeed.status()
  th.logBN('PriceFeed first stored price', lastGoodPrice)
  console.log(`PriceFeed initial status: ${priceFeedInitialStatus}`)
  
  // --- Sorted Troves ---

  // Check max size
  const sortedTrovesMaxSize = (await erdCore.sortedTroves.data())[2]
  assert.equal(sortedTrovesMaxSize, '115792089237316195423570985008687907853269984665640564039457584007913129639935')

  // --- TroveManager ---

  const liqReserve = await erdCore.troveManager.EUSD_GAS_COMPENSATION()
  const minNetDebt = await erdCore.troveManager.MIN_NET_DEBT()

  th.logBN('system liquidation reserve', liqReserve)
  th.logBN('system min net debt      ', minNetDebt)

  // --- Make first EUSD-ETH liquidity provision ---

  // Open trove if not yet opened
//   const troveStatus = await erdCore.troveManager.getTroveStatus(deployerWallet.address)
//   if (troveStatus.toString() != '1') {
//     let _3kEUSDWithdrawal = th.dec(3000, 18) // 3000 EUSD
//     let _3ETHcoll = th.dec(3, 'ether') // 3 ETH
//     console.log('Opening trove...')
//     await mdh.sendAndWaitForTransaction(
//         erdCore.borrowerOperations.openTrove(
//         [], [],
//             th._100pct,
//         _3kEUSDWithdrawal,
//         th.ZERO_ADDRESS,
//         th.ZERO_ADDRESS,
//         { value: _3ETHcoll, gasPrice }
//       )
//     )
//   } else {
//     console.log('Deployer already has an active trove')
//   }

//   // Check deployer now has an open trove
//   console.log(`deployer is in sorted list after making trove: ${await erdCore.sortedTroves.contains(deployerWallet.address)}`)

//   const deployerTrove = await erdCore.troveManager.Troves(deployerWallet.address)
//   th.logBN('deployer share', deployerTrove[0])
//   th.logBN('deployer stake', deployerTrove[1])
//   console.log(`deployer's trove status: ${deployerTrove[2]}`)

//   // Check deployer has EUSD
//   let deployerEUSDBal = await erdCore.eusdToken.balanceOf(deployerWallet.address)
//   th.logBN("deployer's EUSD balance", deployerEUSDBal)


  

  // // --- Make SP deposit and earn nothing ---
  // console.log("CHECK DEPLOYER MAKING DEPOSIT AND EARNING nothing")

  // let SPDeposit = await erdCore.stabilityPool.getCompoundedEUSDDeposit(deployerWallet.address)
  // th.logBN("deployer SP deposit before making deposit", SPDeposit)

  // // Provide to SP
  // await mdh.sendAndWaitForTransaction(erdCore.stabilityPool.provideToSP(dec(15, 18), th.ZERO_ADDRESS, { gasPrice, gasLimit: 400000 }))

  // // Get SP deposit 
  // SPDeposit = await erdCore.stabilityPool.getCompoundedEUSDDeposit(deployerWallet.address)
  // th.logBN("deployer SP deposit after depositing 15 EUSD", SPDeposit)

  // console.log("wait 90 seconds before withdrawing...")
  // // wait 90 seconds
  // await configParams.waitFunction()

  // // Withdraw from SP
  // // await mdh.sendAndWaitForTransaction(erdCore.stabilityPool.withdrawFromSP(dec(1000, 18), { gasPrice, gasLimit: 400000 }))

  // // SPDeposit = await erdCore.stabilityPool.getCompoundedEUSDDeposit(deployerWallet.address)
  // // th.logBN("deployer SP deposit after full withdrawal", SPDeposit)



  // // --- 2nd Account opens trove ---
  // const trove2Status = await erdCore.troveManager.getTroveStatus(account2Wallet.address)
  // if (trove2Status.toString() != '1') {
  //   console.log("Acct 2 opens a trove ...")
  //   let _2kEUSDWithdrawal = th.dec(2000, 18) // 2000 EUSD
  //   let _1pt5_ETHcoll = th.dec(15, 17) // 1.5 ETH
  //   const borrowerOpsEthersFactory = await ethers.getContractFactory("BorrowerOperations", account2Wallet)
  //   const borrowerOpsAcct2 = await new ethers.Contract(erdCore.borrowerOperations.address, borrowerOpsEthersFactory.interface, account2Wallet)

  //   await mdh.sendAndWaitForTransaction(borrowerOpsAcct2.openTrove([], [], th._100pct, _2kEUSDWithdrawal, th.ZERO_ADDRESS, th.ZERO_ADDRESS, { value: _1pt5_ETHcoll, gasPrice, gasLimit: 1000000 }))
  // } else {
  //   console.log('Acct 2 already has an active trove')
  // }

  // const acct2Trove = await erdCore.troveManager.Troves(account2Wallet.address)
  // th.logBN('acct2 share', acct2Trove[0])
  // th.logBN('acct2 stake', acct2Trove[1])
  // console.log(`acct2 trove status: ${acct2Trove[2]}`)

  // //  --- deployer withdraws staking gains ---
  // console.log("CHECK DEPLOYER WITHDRAWING STAKING GAINS")

  // // check deployer's EUSD balance before withdrawing staking gains
  // deployerEUSDBal = await erdCore.eusdToken.balanceOf(deployerWallet.address)
  // th.logBN('deployer EUSD bal before withdrawing staking gains', deployerEUSDBal)

  // // check deployer's EUSD balance after withdrawing staking gains
  // deployerEUSDBal = await erdCore.eusdToken.balanceOf(deployerWallet.address)
  // th.logBN('deployer EUSD bal after withdrawing staking gains', deployerEUSDBal)


  // // --- System stats  ---
  //
  // // Number of troves
  // const numTroves = await erdCore.troveManager.getTroveOwnersCount()
  // console.log(`number of troves: ${numTroves} `)
  //
  // // Sorted list size
  // const listSize = await erdCore.sortedTroves.getSize()
  // console.log(`Trove list size: ${listSize} `)
  //
  // // Total system debt and coll
  // const entireSystemDebt = await erdCore.troveManager.getEntireSystemDebt()
  // const entireSystemColl = await erdCore.troveManager.getEntireSystemColl()
  // th.logBN("Entire system debt", entireSystemDebt)
  // th.logBN("Entire system coll", entireSystemColl)
  //
  // // TCR
  // const TCR = await erdCore.troveManager.getTCR(chainlinkPrice)
  // console.log(`TCR: ${TCR}`)
  //
  // // current borrowing rate
  // const baseRate = await erdCore.troveManager.baseRate()
  // const currentBorrowingRate = await erdCore.troveManager.getBorrowingRateWithDecay()
  // th.logBN("Base rate", baseRate)
  // th.logBN("Current borrowing rate", currentBorrowingRate)
  //
  // // total SP deposits
  // const totalSPDeposits = await erdCore.stabilityPool.getTotalEUSDDeposits()
  // th.logBN("Total EUSD SP deposits", totalSPDeposits)
  //
  // // --- State variables ---
  //
  // // TroveManager
  // console.log("TroveManager state variables:")
  // const totalStakes = await erdCore.troveManager.totalStakes()
  // const totalStakesSnapshot = await erdCore.troveManager.totalStakesSnapshot()
  // const totalCollateralSnapshot = await erdCore.troveManager.totalCollateralSnapshot()
  // th.logBN("Total trove stakes", totalStakes)
  // th.logBN("Snapshot of total trove stakes before last liq. ", totalStakesSnapshot)
  // th.logBN("Snapshot of total trove collateral before last liq. ", totalCollateralSnapshot)
  //
  // const L_ETH = await erdCore.troveManager.L_ETH()
  // const L_EUSDDebt = await erdCore.troveManager.L_EUSDDebt()
  // th.logBN("L_ETH", L_ETH)
  // th.logBN("L_EUSDDebt", L_EUSDDebt)
  //
  // // StabilityPool
  // console.log("StabilityPool state variables:")
  // const P = await erdCore.stabilityPool.P()
  // const currentScale = await erdCore.stabilityPool.currentScale()
  // const currentEpoch = await erdCore.stabilityPool.currentEpoch()
  // // TODO: Supply an address here: epochToScaleToSum(address, epoch, scale)
  // const S = await erdCore.stabilityPool.epochToScaleToSum(currentEpoch, currentScale)
  // const G = await erdCore.stabilityPool.epochToScaleToG(currentEpoch, currentScale)
  // th.logBN("Product P", P)
  // th.logBN("Current epoch", currentEpoch)
  // th.logBN("Current scale", currentScale)
  // th.logBN("Sum S, at current epoch and scale", S)
  // th.logBN("Sum G, at current epoch and scale", G)
}

module.exports = {
  mainnetDeploy
}
