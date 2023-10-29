const NonPayable = artifacts.require("./NonPayable.sol")
const ERC20Token = artifacts.require("./ERC20Token.sol")
const WETH = artifacts.require("./WETH.sol")

const testHelpers = require("../utils/testHelpersUpgrade.js")

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
    const StabilityPool = await ethers.getContractFactory("StabilityPool");
    stabilityPool = await upgrades.deployProxy(StabilityPool);
    await stabilityPool.deployed();
    const mockActivePoolAddress = (await NonPayable.new()).address
    const dumbContractAddress = (await NonPayable.new()).address
    const wethContractAddress = (await WETH.new()).address
    tokenAddress = (await ERC20Token.new("STETH", "stake ETH", 18)).address
    await stabilityPool.setAddresses(dumbContractAddress, dumbContractAddress, mockActivePoolAddress, dumbContractAddress, dumbContractAddress, dumbContractAddress, dumbContractAddress, dumbContractAddress, dumbContractAddress, wethContractAddress)
  })

  it('getETH(): gets the recorded ETH balance', async () => {
    const recordedETHBalance = await stabilityPool.getCollateralAmount(tokenAddress)
    assert.equal(recordedETHBalance, 0)
  })

  it('getTotalUSDEDeposits(): gets the recorded USDE balance', async () => {
    const recordedETHBalance = await stabilityPool.getTotalUSDEDeposits()
    assert.equal(recordedETHBalance, 0)
  })
})

contract('ActivePool', async accounts => {

  let activePool, mockBorrowerOperations, tokenAddress

  const [owner, alice] = accounts;
  beforeEach(async () => {
    const ActivePool = await ethers.getContractFactory("ActivePool");
    activePool = await upgrades.deployProxy(ActivePool);
    await activePool.deployed();
    mockBorrowerOperations = await NonPayable.new()
    const dumbContractAddress = (await NonPayable.new()).address
    tokenAddress = (await ERC20Token.new("STETH", "stake ETH", 18)).address
    await activePool.setAddresses(mockBorrowerOperations.address, dumbContractAddress, dumbContractAddress, dumbContractAddress, dumbContractAddress, dumbContractAddress, dumbContractAddress, dumbContractAddress, dumbContractAddress, dumbContractAddress)
  })

  it('getETH(): gets the recorded ETH balance', async () => {
    const recordedETHBalance = await activePool.getCollateralAmount(tokenAddress)
    assert.equal(recordedETHBalance, 0)
  })

  it('getUSDEDebt(): gets the recorded USDE balance', async () => {
    const recordedETHBalance = await activePool.getUSDEDebt()
    assert.equal(recordedETHBalance, 0)
  })

  it('increaseUSDE(): increases the recorded USDE balance by the correct amount', async () => {
    const recordedUSDE_balanceBefore = await activePool.getUSDEDebt()
    assert.equal(recordedUSDE_balanceBefore, 0)

    // await activePool.increaseUSDEDebt(100, { from: mockBorrowerOperationsAddress })
    const increaseUSDEDebtData = th.getTransactionData('increaseUSDEDebt(uint256)', ['0x64'])
    const tx = await mockBorrowerOperations.forward(activePool.address, increaseUSDEDebtData)
    assert.isTrue(tx.receipt.status)
    const recordedUSDE_balanceAfter = await activePool.getUSDEDebt()
    assert.equal(recordedUSDE_balanceAfter, 100)
  })
  // Decrease
  it('decreaseUSDE(): decreases the recorded USDE balance by the correct amount', async () => {
    // start the pool on 100 wei
    //await activePool.increaseUSDEDebt(100, { from: mockBorrowerOperationsAddress })
    const increaseUSDEDebtData = th.getTransactionData('increaseUSDEDebt(uint256)', ['0x64'])
    const tx1 = await mockBorrowerOperations.forward(activePool.address, increaseUSDEDebtData)
    assert.isTrue(tx1.receipt.status)

    const recordedUSDE_balanceBefore = await activePool.getUSDEDebt()
    assert.equal(recordedUSDE_balanceBefore, 100)

    //await activePool.decreaseUSDEDebt(100, { from: mockBorrowerOperationsAddress })
    const decreaseUSDEDebtData = th.getTransactionData('decreaseUSDEDebt(uint256)', ['0x64'])
    const tx2 = await mockBorrowerOperations.forward(activePool.address, decreaseUSDEDebtData)
    assert.isTrue(tx2.receipt.status)
    const recordedUSDE_balanceAfter = await activePool.getUSDEDebt()
    assert.equal(recordedUSDE_balanceAfter, 0)
  })

  // send raw ether
  it('sendETH(): decreases the recorded ETH balance by the correct amount', async () => {
    // setup: give pool 2 ether
    const activePool_initialBalance = web3.utils.toBN(await web3.eth.getBalance(activePool.address))
    assert.equal(activePool_initialBalance, 0)
    // start pool with 2 ether
    //await web3.eth.sendTransaction({ from: mockBorrowerOperationsAddress, to: activePool.address, value: dec(2, 'ether') })
    const tx1 = await mockBorrowerOperations.forward(activePool.address, '0x', {
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
    const DefaultPool = await ethers.getContractFactory("DefaultPool");
    defaultPool = await upgrades.deployProxy(DefaultPool);
    await defaultPool.deployed();
    mockTroveManager = await NonPayable.new()
    mockActivePool = await NonPayable.new()
    tokenAddress = (await ERC20Token.new("STETH", "stake ETH", 18)).address
    await defaultPool.setAddresses(mockTroveManager.address, mockActivePool.address)
  })

  it('getETH(): gets the recorded USDE balance', async () => {
    const recordedETHBalance = await defaultPool.getCollateralAmount(tokenAddress)
    assert.equal(recordedETHBalance, 0)
  })

  it('getUSDEDebt(): gets the recorded USDE balance', async () => {
    const recordedETHBalance = await defaultPool.getUSDEDebt()
    assert.equal(recordedETHBalance, 0)
  })

  it('increaseUSDE(): increases the recorded USDE balance by the correct amount', async () => {
    const recordedUSDE_balanceBefore = await defaultPool.getUSDEDebt()
    assert.equal(recordedUSDE_balanceBefore, 0)

    // await defaultPool.increaseUSDEDebt(100, { from: mockTroveManagerAddress })
    const increaseUSDEDebtData = th.getTransactionData('increaseUSDEDebt(uint256)', ['0x64'])
    const tx = await mockTroveManager.forward(defaultPool.address, increaseUSDEDebtData)
    assert.isTrue(tx.receipt.status)

    const recordedUSDE_balanceAfter = await defaultPool.getUSDEDebt()
    assert.equal(recordedUSDE_balanceAfter, 100)
  })

  it('decreaseUSDE(): decreases the recorded USDE balance by the correct amount', async () => {
    // start the pool on 100 wei
    //await defaultPool.increaseUSDEDebt(100, { from: mockTroveManagerAddress })
    const increaseUSDEDebtData = th.getTransactionData('increaseUSDEDebt(uint256)', ['0x64'])
    const tx1 = await mockTroveManager.forward(defaultPool.address, increaseUSDEDebtData)
    assert.isTrue(tx1.receipt.status)

    const recordedUSDE_balanceBefore = await defaultPool.getUSDEDebt()
    assert.equal(recordedUSDE_balanceBefore, 100)

    // await defaultPool.decreaseUSDEDebt(100, { from: mockTroveManagerAddress })
    const decreaseUSDEDebtData = th.getTransactionData('decreaseUSDEDebt(uint256)', ['0x64'])
    const tx2 = await mockTroveManager.forward(defaultPool.address, decreaseUSDEDebtData)
    assert.isTrue(tx2.receipt.status)

    const recordedUSDE_balanceAfter = await defaultPool.getUSDEDebt()
    assert.equal(recordedUSDE_balanceAfter, 0)
  })
})

contract('Reset chain state', async accounts => {})