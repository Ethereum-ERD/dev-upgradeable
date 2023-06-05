const StabilityPool = artifacts.require("./StabilityPool.sol")
const ActivePool = artifacts.require("./ActivePool.sol")
const DefaultPool = artifacts.require("./DefaultPool.sol")
const NonPayable = artifacts.require("./NonPayable.sol")
const ERC20Token = artifacts.require("./ERC20Token.sol")
const WETH = artifacts.require("./WETH.sol")

const testHelpers = require("../utils/testHelpers.js")

const th = testHelpers.TestHelper
const dec = th.dec

const _minus_1_Ether = web3.utils.toWei('-1', 'ether')

contract('StabilityPool', async accounts => {
  /* mock* are EOA’s, temporarily used to call protected functions.
  TODO: Replace with mock contracts, and later complete transactions from EOA
  */
  let stabilityPool
  let tokenAddress

  const [owner, alice] = accounts;

  beforeEach(async () => {
    stabilityPool = await StabilityPool.new()
    const mockActivePoolAddress = (await NonPayable.new()).address
    const dumbContractAddress = (await NonPayable.new()).address
    const wethContractAddress = (await WETH.new()).address
    tokenAddress = (await ERC20Token.new("STETH", "stake ETH", 18)).address
    await stabilityPool.initialize()
    await stabilityPool.setAddresses(dumbContractAddress, dumbContractAddress, mockActivePoolAddress, dumbContractAddress, dumbContractAddress, dumbContractAddress, dumbContractAddress, dumbContractAddress, dumbContractAddress, wethContractAddress)
  })

  it('getETH(): gets the recorded ETH balance', async () => {
    const recordedETHBalance = await stabilityPool.getCollateralAmount(tokenAddress)
    assert.equal(recordedETHBalance, 0)
  })

  it('getTotalEUSDDeposits(): gets the recorded EUSD balance', async () => {
    const recordedETHBalance = await stabilityPool.getTotalEUSDDeposits()
    assert.equal(recordedETHBalance, 0)
  })
})

contract('ActivePool', async accounts => {

  let activePool, mockBorrowerOperations, tokenAddress

  const [owner, alice] = accounts;
  beforeEach(async () => {
    activePool = await ActivePool.new()
    mockBorrowerOperations = await NonPayable.new()
    const dumbContractAddress = (await NonPayable.new()).address
    tokenAddress = (await ERC20Token.new("STETH", "stake ETH", 18)).address
    await activePool.initialize()
    await activePool.setAddresses(mockBorrowerOperations.address, dumbContractAddress, dumbContractAddress, dumbContractAddress, dumbContractAddress, dumbContractAddress, dumbContractAddress, dumbContractAddress, dumbContractAddress, dumbContractAddress)
  })

  it('getETH(): gets the recorded ETH balance', async () => {
    const recordedETHBalance = await activePool.getCollateralAmount(tokenAddress)
    assert.equal(recordedETHBalance, 0)
  })

  it('getEUSDDebt(): gets the recorded EUSD balance', async () => {
    const recordedETHBalance = await activePool.getEUSDDebt()
    assert.equal(recordedETHBalance, 0)
  })

  it('increaseEUSD(): increases the recorded EUSD balance by the correct amount', async () => {
    const recordedEUSD_balanceBefore = await activePool.getEUSDDebt()
    assert.equal(recordedEUSD_balanceBefore, 0)

    // await activePool.increaseEUSDDebt(100, { from: mockBorrowerOperationsAddress })
    const increaseEUSDDebtData = th.getTransactionData('increaseEUSDDebt(uint256)', ['0x64'])
    const tx = await mockBorrowerOperations.forward(activePool.address, increaseEUSDDebtData)
    assert.isTrue(tx.receipt.status)
    const recordedEUSD_balanceAfter = await activePool.getEUSDDebt()
    assert.equal(recordedEUSD_balanceAfter, 100)
  })
  // Decrease
  it('decreaseEUSD(): decreases the recorded EUSD balance by the correct amount', async () => {
    // start the pool on 100 wei
    //await activePool.increaseEUSDDebt(100, { from: mockBorrowerOperationsAddress })
    const increaseEUSDDebtData = th.getTransactionData('increaseEUSDDebt(uint256)', ['0x64'])
    const tx1 = await mockBorrowerOperations.forward(activePool.address, increaseEUSDDebtData)
    assert.isTrue(tx1.receipt.status)

    const recordedEUSD_balanceBefore = await activePool.getEUSDDebt()
    assert.equal(recordedEUSD_balanceBefore, 100)

    //await activePool.decreaseEUSDDebt(100, { from: mockBorrowerOperationsAddress })
    const decreaseEUSDDebtData = th.getTransactionData('decreaseEUSDDebt(uint256)', ['0x64'])
    const tx2 = await mockBorrowerOperations.forward(activePool.address, decreaseEUSDDebtData)
    assert.isTrue(tx2.receipt.status)
    const recordedEUSD_balanceAfter = await activePool.getEUSDDebt()
    assert.equal(recordedEUSD_balanceAfter, 0)
  })

  // send raw ether
  it('sendETH(): decreases the recorded ETH balance by the correct amount', async () => {
    // setup: give pool 2 ether
    const activePool_initialBalance = web3.utils.toBN(await web3.eth.getBalance(activePool.address))
    assert.equal(activePool_initialBalance, 0)
    // start pool with 2 ether
    //await web3.eth.sendTransaction({ from: mockBorrowerOperationsAddress, to: activePool.address, value: dec(2, 'ether') })
    const tx1 = await mockBorrowerOperations.forward(activePool.address, '0x', {
      from: owner,
      value: dec(2, 'ether')
    })
    assert.isTrue(tx1.receipt.status)

    const activePool_BalanceBeforeTx = web3.utils.toBN(await web3.eth.getBalance(activePool.address))
    const alice_Balance_BeforeTx = web3.utils.toBN(await web3.eth.getBalance(alice))

    assert.equal(activePool_BalanceBeforeTx, dec(2, 'ether'))

    // send ether from pool to alice
    //await activePool.sendETH(alice, dec(1, 'ether'), { from: mockBorrowerOperationsAddress })
    const sendETHData = th.getTransactionData('sendETH(address,uint256)', [alice, web3.utils.toHex(dec(1, 'ether'))])
    const tx2 = await mockBorrowerOperations.forward(activePool.address, '0x', {
      from: owner,
      value: dec(1, 18)
    })
    assert.isTrue(tx2.receipt.status)

    const activePool_BalanceAfterTx = web3.utils.toBN(await web3.eth.getBalance(activePool.address))
    const alice_Balance_AfterTx = web3.utils.toBN(await web3.eth.getBalance(alice))

    const alice_BalanceChange = alice_Balance_AfterTx.sub(alice_Balance_BeforeTx)
    const pool_BalanceChange = activePool_BalanceAfterTx.sub(activePool_BalanceBeforeTx)
    assert.equal(alice_BalanceChange.toString(), web3.utils.toBN(0).toString())
    assert.equal(pool_BalanceChange.toString(), web3.utils.toBN(dec(1, 'ether')).toString())
  })
})

contract('DefaultPool', async accounts => {

  let defaultPool, mockTroveManager, mockActivePool, tokenAddress

  const [owner, alice] = accounts;
  beforeEach(async () => {
    defaultPool = await DefaultPool.new()
    mockTroveManager = await NonPayable.new()
    mockActivePool = await NonPayable.new()
    tokenAddress = (await ERC20Token.new("STETH", "stake ETH", 18)).address
    await defaultPool.initialize()
    await defaultPool.setAddresses(mockTroveManager.address, mockActivePool.address)
  })

  it('getETH(): gets the recorded EUSD balance', async () => {
    const recordedETHBalance = await defaultPool.getCollateralAmount(tokenAddress)
    assert.equal(recordedETHBalance, 0)
  })

  it('getEUSDDebt(): gets the recorded EUSD balance', async () => {
    const recordedETHBalance = await defaultPool.getEUSDDebt()
    assert.equal(recordedETHBalance, 0)
  })

  it('increaseEUSD(): increases the recorded EUSD balance by the correct amount', async () => {
    const recordedEUSD_balanceBefore = await defaultPool.getEUSDDebt()
    assert.equal(recordedEUSD_balanceBefore, 0)

    // await defaultPool.increaseEUSDDebt(100, { from: mockTroveManagerAddress })
    const increaseEUSDDebtData = th.getTransactionData('increaseEUSDDebt(uint256)', ['0x64'])
    const tx = await mockTroveManager.forward(defaultPool.address, increaseEUSDDebtData)
    assert.isTrue(tx.receipt.status)

    const recordedEUSD_balanceAfter = await defaultPool.getEUSDDebt()
    assert.equal(recordedEUSD_balanceAfter, 100)
  })

  it('decreaseEUSD(): decreases the recorded EUSD balance by the correct amount', async () => {
    // start the pool on 100 wei
    //await defaultPool.increaseEUSDDebt(100, { from: mockTroveManagerAddress })
    const increaseEUSDDebtData = th.getTransactionData('increaseEUSDDebt(uint256)', ['0x64'])
    const tx1 = await mockTroveManager.forward(defaultPool.address, increaseEUSDDebtData)
    assert.isTrue(tx1.receipt.status)

    const recordedEUSD_balanceBefore = await defaultPool.getEUSDDebt()
    assert.equal(recordedEUSD_balanceBefore, 100)

    // await defaultPool.decreaseEUSDDebt(100, { from: mockTroveManagerAddress })
    const decreaseEUSDDebtData = th.getTransactionData('decreaseEUSDDebt(uint256)', ['0x64'])
    const tx2 = await mockTroveManager.forward(defaultPool.address, decreaseEUSDDebtData)
    assert.isTrue(tx2.receipt.status)

    const recordedEUSD_balanceAfter = await defaultPool.getEUSDDebt()
    assert.equal(recordedEUSD_balanceAfter, 0)
  })
})

contract('Reset chain state', async accounts => {})