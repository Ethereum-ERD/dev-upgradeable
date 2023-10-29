const {
  web3
} = require("hardhat")
const deploymentHelper = require("../utils/deploymentHelpersUpgrade.js")
const testHelpers = require("../utils/testHelpersUpgrade.js")
const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues
const _dec = (number) => toBN(dec(1, number))

const TroveManagerTester = artifacts.require("TroveManagerTester")
const USDEToken = artifacts.require("USDEToken")
const NonPayable = artifacts.require('NonPayable.sol')

const ZERO = toBN('0')
const ZERO_ADDRESS = th.ZERO_ADDRESS
const maxBytes32 = th.maxBytes32

const getFrontEndTag = async (stabilityPool, depositor) => {
  return (await stabilityPool.deposits(depositor))[1]
}

contract('StabilityPool', async accounts => {

  const [owner,
    defaulter_1, defaulter_2, defaulter_3,
    whale,
    alice, bob, carol, dennis, erin, flyn,
    A, B, C, D, E, F,
    frontEnd_1, frontEnd_2, frontEnd_3,
  ] = accounts;

  let Owner,
    Defaulter_1, Defaulter_2, Defaulter_3,
    Whale, Alice, Bob, Carol, Dennis, Erin, Flyn,
    signerA, signerB, signerC, signerD, signerE, signerF,
    FrontEnd_1, FrontEnd_2, FrontEnd_3

  let FrontEnds
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
  let steth

  const getOpenTroveUSDEAmount = async (totalDebt) => th.getOpenTroveUSDEAmount(contracts, totalDebt)
  const openTrove = async (params) => th.openTrove(contracts, params)
  const assertRevert = th.assertRevert

  describe("Stability Pool Mechanisms", async () => {
    beforeEach(async () => {
      contracts = await deploymentHelper.deployERDCore()

      priceFeed = contracts.priceFeedETH
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

      treasury = contracts.treasury
      liquidityIncentive = contracts.liquidityIncentive
      communityIssuance = contracts.communityIssuance
      const signers = await ethers.getSigners()
      Owner = signers[0]
      Defaulter_1 = signers[1]
      Defaulter_2 = signers[2]
      Defaulter_3 = signers[3]
      Whale = signers[4]
      Alice = signers[5]
      Bob = signers[6]
      Carol = signers[7]
      Dennis = signers[8]
      Erin = signers[9]
      Flyn = signers[10]
      signerA = signers[11]
      signerB = signers[12]
      signerC = signers[13]
      signerD = signers[14]
      signerE = signers[15]
      signerF = signers[16]
      FrontEnd_1 = signers[17]
      FrontEnd_2 = signers[18]
      FrontEnd_3 = signers[19]

      FrontEnds = [FrontEnd_1, FrontEnd_2, FrontEnd_3]
      // Register 3 front ends
      await th.registerFrontEnds(FrontEnds, stabilityPool)
    })

    // --- provideToSP() ---
    // increases recorded USDE at Stability Pool
    it("provideToSP(): increases the Stability Pool USDE balance", async () => {
      // --- SETUP --- Give Alice a least 200
      await openTrove({
        extraUSDEAmount: toBN(200),
        ICR: toBN(dec(2, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })

      // --- TEST ---

      // provideToSP()
      await stabilityPool.connect(Alice).provideToSP(200, ZERO_ADDRESS, {
        from: alice
      })

      // check USDE balances after
      const stabilityPool_USDE_After = await stabilityPool.getTotalUSDEDeposits()
      assert.equal(stabilityPool_USDE_After, 200)
    })

    it("provideToSP(): updates the user's deposit record in StabilityPool", async () => {
      // --- SETUP --- Give Alice a least 200
      await openTrove({
        extraUSDEAmount: toBN(200),
        ICR: toBN(dec(2, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })

      // --- TEST ---
      // check user's deposit record before
      const alice_depositRecord_Before = await stabilityPool.deposits(alice)
      assert.equal(alice_depositRecord_Before[0], 0)

      // provideToSP()
      await stabilityPool.connect(Alice).provideToSP(200, frontEnd_1, {
        from: alice
      })

      // check user's deposit record after
      const alice_depositRecord_After = (await stabilityPool.deposits(alice))[0]
      assert.equal(alice_depositRecord_After, 200)
    })

    it("provideToSP(): reduces the user's USDE balance by the correct amount", async () => {
      // --- SETUP --- Give Alice a least 200
      await openTrove({
        extraUSDEAmount: toBN(200),
        ICR: toBN(dec(2, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })

      // --- TEST ---
      // get user's deposit record before
      const alice_USDEBalance_Before = await usdeToken.balanceOf(alice)

      // provideToSP()
      await stabilityPool.connect(Alice).provideToSP(200, frontEnd_1, {
        from: alice
      })

      // check user's USDE balance change
      const alice_USDEBalance_After = await usdeToken.balanceOf(alice)
      assert.equal(alice_USDEBalance_Before.sub(alice_USDEBalance_After), '200')
    })

    it("provideToSP(): increases totalUSDEDeposits by correct amount", async () => {
      // --- SETUP ---

      // Whale opens Trove with 50 ETH, adds 2000 USDE to StabilityPool
      await openTrove({
        extraUSDEAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })
      await stabilityPool.connect(Whale).provideToSP(dec(2000, 18), frontEnd_1, {
        from: whale
      })

      const totalUSDEDeposits = await stabilityPool.getTotalUSDEDeposits()
      assert.equal(totalUSDEDeposits, dec(2000, 18))
    })

    it('provideToSP(): Correctly updates user snapshots of accumulated rewards per unit staked', async () => {
      // --- SETUP ---

      // Whale opens Trove and deposits to SP
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Whale,
        extraParams: {
          from: whale,
          value: dec(50, 'ether')
        }
      })
      const whaleUSDE = await usdeToken.balanceOf(whale)
      await stabilityPool.connect(Whale).provideToSP(whaleUSDE, frontEnd_1, {
        from: whale
      })

      // 2 Troves opened, each withdraws minimum debt
      await openTrove({
        extraUSDEAmount: 0,
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_1,
        extraParams: {
          from: defaulter_1,
        }
      })
      await openTrove({
        extraUSDEAmount: 0,
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_2,
        extraParams: {
          from: defaulter_2,
        }
      })

      // Alice makes Trove and withdraws 100 USDE
      await openTrove({
        extraUSDEAmount: toBN(dec(100, 18)),
        ICR: toBN(dec(5, 18)),
        signer: Alice,
        extraParams: {
          from: alice,
          value: dec(50, 'ether')
        }
      })


      // price drops: defaulter's Troves fall below MCR, whale doesn't
      await priceFeed.setPrice(dec(105, 18));

      const SPUSDE_Before = await stabilityPool.getTotalUSDEDeposits()

      // Troves are closed
      await troveManager.liquidate(defaulter_1, {
        from: owner
      })
      await troveManager.liquidate(defaulter_2, {
        from: owner
      })
      assert.isFalse(await sortedTroves.contains(defaulter_1))
      assert.isFalse(await sortedTroves.contains(defaulter_2))

      // Confirm SP has decreased
      const SPUSDE_After = await stabilityPool.getTotalUSDEDeposits()
      assert.isTrue(SPUSDE_After.lt(SPUSDE_Before))

      // --- TEST ---
      const P_Before = (await stabilityPool.P())
      const S_Before = (await stabilityPool.epochToScaleToSum(contracts.weth.address, 0, 0))
      const G_Before = (await stabilityPool.epochToScaleToG(0, 0))
      assert.isTrue(P_Before.gt(toBN('0')))
      assert.isTrue(S_Before.gt(toBN('0')))

      // Check 'Before' snapshots
      const alice_snapshot_Before = await stabilityPool.depositSnapshots(alice) // snapshots
      // console.log(alice_snapshot_Before);
      // console.log("Snapshot taken");
      const alice_snapshot_S_Before = (await stabilityPool.getDepositSnapshotS(alice, contracts.weth.address)).toString();
      const alice_snapshot_P_Before = alice_snapshot_Before.P.toString()
      const alice_snapshot_G_Before = alice_snapshot_Before.G.toString()
      assert.equal(alice_snapshot_S_Before, '0')
      assert.equal(alice_snapshot_P_Before, '0')
      assert.equal(alice_snapshot_G_Before, '0')

      // Make deposit
      await stabilityPool.connect(Alice).provideToSP(dec(100, 18), frontEnd_1, {
        from: alice
      })

      // Check 'After' snapshots
      const alice_snapshot_After = await stabilityPool.depositSnapshots(alice)

      const alice_snapshot_S_After = (await stabilityPool.getDepositSnapshotS(alice, contracts.weth.address)).toString()
      const alice_snapshot_P_After = alice_snapshot_After.P.toString()
      const alice_snapshot_G_After = alice_snapshot_After.G.toString()

      assert.equal(alice_snapshot_S_After, S_Before)
      assert.equal(alice_snapshot_P_After, P_Before)
      assert.equal(alice_snapshot_G_After, G_Before)
    })

    // TODO: rewrite this test case to reflect multi-col
    it("provideToSP(), multiple deposits: updates user's deposit and snapshots", async () => {
      // --- SETUP ---
      // Whale opens Trove and deposits to SP
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Whale,
        extraParams: {
          from: whale,
          value: dec(50, 'ether')
        }
      })
      const whaleUSDE = await usdeToken.balanceOf(whale)
      await stabilityPool.connect(Whale).provideToSP(whaleUSDE, frontEnd_1, {
        from: whale
      })

      // 3 Troves opened. Two users withdraw 160 USDE each
      await openTrove({
        extraUSDEAmount: 0,
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_1,
        extraParams: {
          from: defaulter_1,
          value: dec(50, 'ether')
        }
      })
      await openTrove({
        extraUSDEAmount: 0,
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_2,
        extraParams: {
          from: defaulter_2,
          value: dec(50, 'ether')
        }
      })
      await openTrove({
        extraUSDEAmount: 0,
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_3,
        extraParams: {
          from: defaulter_3,
          value: dec(50, 'ether')
        }
      })

      // --- TEST ---

      // Alice makes deposit #1: 150 USDE
      await openTrove({
        extraUSDEAmount: toBN(dec(250, 18)),
        ICR: toBN(dec(3, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })
      await stabilityPool.connect(Alice).provideToSP(dec(150, 18), frontEnd_1, {
        from: alice
      })

      const alice_Snapshot_0 = await stabilityPool.depositSnapshots(alice)
      const alice_Snapshot_S_0 = (await stabilityPool.getDepositSnapshotS(alice, contracts.weth.address)).toString()
      const alice_Snapshot_P_0 = alice_Snapshot_0.P.toString()
      assert.equal(alice_Snapshot_S_0, 0)
      assert.equal(alice_Snapshot_P_0, '1000000000000000000')

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(dec(105, 18));

      // 2 users with Trove with 180 USDE drawn are closed
      await troveManager.liquidate(defaulter_1, {
        from: owner
      }) // 180 USDE closed
      await troveManager.liquidate(defaulter_2, {
        from: owner
      }) // 180 USDE closed

      const alice_compoundedDeposit_1 = await stabilityPool.getCompoundedUSDEDeposit(alice)

      // Alice makes deposit #2
      const alice_topUp_1 = toBN(dec(100, 18))
      await stabilityPool.connect(Alice).provideToSP(alice_topUp_1, frontEnd_1, {
        from: alice
      })

      const alice_newDeposit_1 = ((await stabilityPool.deposits(alice))[0]).toString()
      assert.equal(alice_compoundedDeposit_1.add(alice_topUp_1), alice_newDeposit_1)

      // get system reward terms
      const P_1 = await stabilityPool.P()
      const S_1 = await stabilityPool.epochToScaleToSum(contracts.weth.address, 0, 0)
      assert.isTrue(P_1.lt(toBN(dec(1, 18))))
      assert.isTrue(S_1.gt(toBN('0')))

      // check Alice's new snapshot is correct
      const alice_Snapshot_1 = await stabilityPool.depositSnapshots(alice)
      const alice_Snapshot_S_1 = (await stabilityPool.getDepositSnapshotS(alice, contracts.weth.address)).toString()
      const alice_Snapshot_P_1 = alice_Snapshot_1.P.toString()
      assert.equal(alice_Snapshot_S_1, S_1)
      assert.equal(alice_Snapshot_P_1, P_1)

      // Bob withdraws USDE and deposits to StabilityPool
      await openTrove({
        extraUSDEAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(3, 18)),
        signer: Bob,
        extraParams: {
          from: bob
        }
      })
      await stabilityPool.connect(Alice).provideToSP(dec(427, 18), frontEnd_1, {
        from: alice
      })

      // Defaulter 3 Trove is closed
      await troveManager.liquidate(defaulter_3, {
        from: owner
      })

      const alice_compoundedDeposit_2 = await stabilityPool.getCompoundedUSDEDeposit(alice)

      const P_2 = await stabilityPool.P()
      const S_2 = await stabilityPool.epochToScaleToSum(contracts.weth.address, 0, 0)
      assert.isTrue(P_2.lt(P_1))
      assert.isTrue(S_2.gt(S_1))

      // Alice makes deposit #3:  100USDE
      await stabilityPool.connect(Alice).provideToSP(dec(100, 18), frontEnd_1, {
        from: alice
      })

      // check Alice's new snapshot is correct
      const alice_Snapshot_2 = await stabilityPool.depositSnapshots(alice)
      const alice_Snapshot_S_2 = (await stabilityPool.getDepositSnapshotS(alice, contracts.weth.address)).toString()
      const alice_Snapshot_P_2 = alice_Snapshot_2.P.toString()
      assert.equal(alice_Snapshot_S_2, S_2)
      assert.equal(alice_Snapshot_P_2, P_2)
    })

    it("provideToSP(): reverts if user tries to provide more than their USDE balance", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Whale,
        extraParams: {
          from: whale,
          value: dec(50, 'ether')
        }
      })

      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Alice,
        extraParams: {
          from: alice,
          value: dec(50, 'ether')
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Bob,
        extraParams: {
          from: bob,
          value: dec(50, 'ether')
        }
      })
      const aliceUSDEbal = await usdeToken.balanceOf(alice)
      const bobUSDEbal = await usdeToken.balanceOf(bob)

      // Alice, attempts to deposit 1 wei more than her balance

      const aliceTxPromise = stabilityPool.connect(Alice).provideToSP(aliceUSDEbal.add(toBN(1)), frontEnd_1, {
        from: alice
      })
      await assertRevert(aliceTxPromise, "revert")

      // Bob, attempts to deposit 235534 more than his balance

      const bobTxPromise = stabilityPool.connect(Bob).provideToSP(bobUSDEbal.add(toBN(dec(235534, 18))), frontEnd_1, {
        from: bob
      })
      await assertRevert(bobTxPromise, "revert")
    })

    it("provideToSP(): reverts if user tries to provide 2^256-1 USDE, which exceeds their balance", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Whale,
        extraParams: {
          from: whale,
          value: dec(50, 'ether')
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Alice,
        extraParams: {
          from: alice,
          value: dec(50, 'ether')
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Bob,
        extraParams: {
          from: bob,
          value: dec(50, 'ether')
        }
      })

      const maxBytes32 = toBN("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")

      // Alice attempts to deposit 2^256-1 USDE
      try {
        aliceTx = await stabilityPool.connect(Alice).provideToSP(maxBytes32, frontEnd_1, {
          from: alice
        })
        assert.isFalse(tx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }
    })

    it("provideToSP(): reverts if cannot receive ETH Gain", async () => {
      // --- SETUP ---
      // Whale deposits 1850 USDE in StabilityPool
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Whale,
        extraParams: {
          from: whale,
          value: dec(50, 'ether')
        }
      })
      await stabilityPool.connect(Whale).provideToSP(dec(1850, 18), frontEnd_1, {
        from: whale
      })

      // Defaulter Troves opened
      await openTrove({
        extraUSDEAmount: 0,
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_1,
        extraParams: {
          from: defaulter_1
        }
      })
      await openTrove({
        extraUSDEAmount: 0,
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_2,
        extraParams: {
          from: defaulter_2
        }
      })

      // --- TEST ---

      const nonPayable = await NonPayable.new()
      await usdeToken.connect(Whale).transfer(nonPayable.address, dec(250, 18), {
        from: whale
      })

      // NonPayable makes deposit #1: 150 USDE
      const txData1 = th.getTransactionData('provideToSP(uint256,address)', [web3.utils.toHex(dec(150, 18)), frontEnd_1])
      const tx1 = await nonPayable.forward(stabilityPool.address, txData1)

      const gains_0 = await stabilityPool.getDepositorCollateralGain(nonPayable.address)
      const gain_0 = gains_0[1][0];

      assert.isTrue(gain_0.eq(toBN(0)), 'NonPayable should not have accumulated gains')

      // price drops: defaulters' Troves fall below MCR, nonPayable and whale Trove remain active
      await priceFeed.setPrice(dec(105, 18));

      // 2 defaulters are closed
      await troveManager.liquidate(defaulter_1, {
        from: owner
      })
      await troveManager.liquidate(defaulter_2, {
        from: owner
      })

      const gains_1 = await stabilityPool.getDepositorCollateralGain(nonPayable.address)
      const gain_1 = gains_1[1][0];

      assert.isTrue(gain_1.gt(toBN(0)), 'NonPayable should have some accumulated gains')

      // ERD Test (in our case, the nonpayable address can receive gains):
      // NonPayable tries to make deposit #2: 100USDE (which also attempts to withdraw ETH gain)
      // const txData2 = th.getTransactionData('provideToSP(uint256,address)', [web3.utils.toHex(dec(100, 18)), frontEnd_1])
      // await th.assertRevert(nonPayable.forward(stabilityPool.address, txData2), 'StabilityPool: sending ETH failed')
    })


    it("provideToSP(): doesn't impact other users' deposits or ETH gains", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Whale,
        extraParams: {
          from: whale,
          value: dec(50, 'ether')
        }
      })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraUSDEAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Bob,
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Carol,
        extraParams: {
          from: carol
        }
      })

      await stabilityPool.connect(Alice).provideToSP(dec(1000, 18), frontEnd_1, {
        from: alice
      })
      await stabilityPool.connect(Bob).provideToSP(dec(2000, 18), frontEnd_1, {
        from: bob
      })
      await stabilityPool.connect(Carol).provideToSP(dec(3000, 18), frontEnd_1, {
        from: carol
      })

      // D opens a trove
      await openTrove({
        extraUSDEAmount: toBN(dec(300, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Dennis,
        extraParams: {
          from: dennis
        }
      })

      // Would-be defaulters open troves
      await openTrove({
        extraUSDEAmount: 0,
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_1,
        extraParams: {
          from: defaulter_1
        }
      })
      await openTrove({
        extraUSDEAmount: 0,
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_2,
        extraParams: {
          from: defaulter_2
        }
      })

      // Price drops
      await priceFeed.setPrice(dec(105, 18))

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
      await stabilityPool.connect(Dennis).provideToSP(dec(1000, 18), frontEnd_1, {
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

    it("provideToSP(): doesn't impact system debt, collateral or TCR", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Whale,
        extraParams: {
          from: whale,
          value: dec(50, 'ether')
        }
      })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraUSDEAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Bob,
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Carol,
        extraParams: {
          from: carol
        }
      })

      await stabilityPool.connect(Alice).provideToSP(dec(1000, 18), frontEnd_1, {
        from: alice
      })
      await stabilityPool.connect(Bob).provideToSP(dec(2000, 18), frontEnd_1, {
        from: bob
      })
      await stabilityPool.connect(Carol).provideToSP(dec(3000, 18), frontEnd_1, {
        from: carol
      })

      // D opens a trove
      await openTrove({
        extraUSDEAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Dennis,
        extraParams: {
          from: dennis
        }
      })

      // Would-be defaulters open troves
      await openTrove({
        extraUSDEAmount: 0,
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_1,
        extraParams: {
          from: defaulter_1
        }
      })
      await openTrove({
        extraUSDEAmount: 0,
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_2,
        extraParams: {
          from: defaulter_2
        }
      })

      // Price drops
      await priceFeed.setPrice(dec(105, 18))

      // Defaulters are liquidated
      await troveManager.liquidate(defaulter_1)
      await troveManager.liquidate(defaulter_2)
      assert.isFalse(await sortedTroves.contains(defaulter_1))
      assert.isFalse(await sortedTroves.contains(defaulter_2))

      const activeDebt_Before = (await activePool.getUSDEDebt()).toString()
      const defaultedDebt_Before = (await defaultPool.getUSDEDebt()).toString()
      const activeColl_Before = (await activePool.getCollateralAmount(contracts.weth.address)).toString()
      const defaultedColl_Before = (await defaultPool.getCollateralAmount(contracts.weth.address)).toString()
      const TCR_Before = (await th.getTCR(contracts)).toString()

      // D makes an SP deposit
      await stabilityPool.connect(Dennis).provideToSP(dec(1000, 18), frontEnd_1, {
        from: dennis
      })
      assert.equal((await stabilityPool.getCompoundedUSDEDeposit(dennis)).toString(), dec(1000, 18))

      const activeDebt_After = (await activePool.getUSDEDebt()).toString()
      const defaultedDebt_After = (await defaultPool.getUSDEDebt()).toString()
      const activeColl_After = (await activePool.getCollateralAmount(contracts.weth.address)).toString()
      const defaultedColl_After = (await defaultPool.getCollateralAmount(contracts.weth.address)).toString()
      const TCR_After = (await th.getTCR(contracts)).toString()

      // Check total system debt, collateral and TCR have not changed after a Stability deposit is made
      assert.equal(activeDebt_Before, activeDebt_After)
      assert.equal(defaultedDebt_Before, defaultedDebt_After)
      assert.equal(activeColl_Before, activeColl_After)
      assert.equal(defaultedColl_Before, defaultedColl_After)
      th.assertIsApproximatelyEqual(TCR_Before, TCR_After, _dec(9))
    })

    it("provideToSP(): doesn't impact any troves, including the caller's trove", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Whale,
        extraParams: {
          from: whale,
          value: dec(50, 'ether')
        }
      })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraUSDEAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Bob,
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Carol,
        extraParams: {
          from: carol
        }
      })

      // A and B provide to SP
      await stabilityPool.connect(Alice).provideToSP(dec(1000, 18), frontEnd_1, {
        from: alice
      })
      await stabilityPool.connect(Bob).provideToSP(dec(2000, 18), frontEnd_1, {
        from: bob
      })

      // D opens a trove
      await openTrove({
        extraUSDEAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Dennis,
        extraParams: {
          from: dennis
        }
      })

      // Price drops
      await priceFeed.setPrice(dec(105, 18))
      const price = toBN(await priceFeed.getPrice())

      // Get debt, collateral and ICR of all existing troves
      const whale_Debt_Before = (await troveManager.getTroveDebt(whale)).toString()
      const alice_Debt_Before = (await troveManager.getTroveDebt(alice)).toString()
      const bob_Debt_Before = (await troveManager.getTroveDebt(bob)).toString()
      const carol_Debt_Before = (await troveManager.getTroveDebt(carol)).toString()
      const dennis_Debt_Before = (await troveManager.getTroveDebt(dennis)).toString()

      const whale_Coll_Before = (await troveManager.getTroveColls(whale))[0][0].toString()
      const alice_Coll_Before = (await troveManager.getTroveColls(alice))[0][0].toString()
      const bob_Coll_Before = (await troveManager.getTroveColls(bob))[0][0].toString()
      const carol_Coll_Before = (await troveManager.getTroveColls(carol))[0][0].toString()
      const dennis_Coll_Before = (await troveManager.getTroveColls(dennis))[0][0].toString()

      const whale_ICR_Before = (await th.getCurrentICR(contracts, whale)).toString()
      const alice_ICR_Before = (await th.getCurrentICR(contracts, alice)).toString()
      const bob_ICR_Before = (await th.getCurrentICR(contracts, bob)).toString()
      const carol_ICR_Before = (await th.getCurrentICR(contracts, carol)).toString()
      const dennis_ICR_Before = (await th.getCurrentICR(contracts, dennis)).toString()

      // D makes an SP deposit
      await stabilityPool.connect(Dennis).provideToSP(dec(1000, 18), frontEnd_1, {
        from: dennis
      })
      assert.equal((await stabilityPool.getCompoundedUSDEDeposit(dennis)).toString(), dec(1000, 18))

      const whale_Debt_After = (await troveManager.getTroveDebt(whale)).toString()
      const alice_Debt_After = (await troveManager.getTroveDebt(alice)).toString()
      const bob_Debt_After = (await troveManager.getTroveDebt(bob)).toString()
      const carol_Debt_After = (await troveManager.getTroveDebt(carol)).toString()
      const dennis_Debt_After = (await troveManager.getTroveDebt(dennis)).toString()

      const whale_Coll_After = (await troveManager.getTroveColls(whale))[0][0].toString()
      const alice_Coll_After = (await troveManager.getTroveColls(alice))[0][0].toString()
      const bob_Coll_After = (await troveManager.getTroveColls(bob))[0][0].toString()
      const carol_Coll_After = (await troveManager.getTroveColls(carol))[0][0].toString()
      const dennis_Coll_After = (await troveManager.getTroveColls(dennis))[0][0].toString()

      const whale_ICR_After = (await th.getCurrentICR(contracts, whale)).toString()
      const alice_ICR_After = (await th.getCurrentICR(contracts, alice)).toString()
      const bob_ICR_After = (await th.getCurrentICR(contracts, bob)).toString()
      const carol_ICR_After = (await th.getCurrentICR(contracts, carol)).toString()
      const dennis_ICR_After = (await th.getCurrentICR(contracts, dennis)).toString()

      th.assertIsApproximatelyEqual(whale_Debt_Before, whale_Debt_After, _dec(14))
      th.assertIsApproximatelyEqual(alice_Debt_Before, alice_Debt_After, _dec(14))
      th.assertIsApproximatelyEqual(bob_Debt_Before, bob_Debt_After, _dec(14))
      th.assertIsApproximatelyEqual(carol_Debt_Before, carol_Debt_After, _dec(14))
      th.assertIsApproximatelyEqual(dennis_Debt_Before, dennis_Debt_After, _dec(14))

      th.assertIsApproximatelyEqual(whale_Coll_Before, whale_Coll_After, _dec(14))
      th.assertIsApproximatelyEqual(alice_Coll_Before, alice_Coll_After, _dec(14))
      th.assertIsApproximatelyEqual(bob_Coll_Before, bob_Coll_After, _dec(14))
      th.assertIsApproximatelyEqual(carol_Coll_Before, carol_Coll_After, _dec(14))
      th.assertIsApproximatelyEqual(dennis_Coll_Before, dennis_Coll_After, _dec(14))

      th.assertIsApproximatelyEqual(whale_ICR_Before, whale_ICR_After, _dec(9))
      th.assertIsApproximatelyEqual(alice_ICR_Before, alice_ICR_After, _dec(9))
      th.assertIsApproximatelyEqual(bob_ICR_Before, bob_ICR_After, _dec(9))
      th.assertIsApproximatelyEqual(carol_ICR_Before, carol_ICR_After, _dec(9))
      th.assertIsApproximatelyEqual(dennis_ICR_Before, dennis_ICR_After, _dec(9))
    })


    it("provideToSP(): doesn't protect the depositor's trove from liquidation", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Whale,
        extraParams: {
          from: whale,
          value: dec(50, 'ether')
        }
      })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraUSDEAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Bob,
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Carol,
        extraParams: {
          from: carol
        }
      })

      // A, B provide 100 USDE to SP
      await stabilityPool.connect(Alice).provideToSP(dec(1000, 18), frontEnd_1, {
        from: alice
      })
      await stabilityPool.connect(Bob).provideToSP(dec(1000, 18), frontEnd_1, {
        from: bob
      })

      // Confirm Bob has an active trove in the system
      assert.isTrue(await sortedTroves.contains(bob))
      assert.equal((await troveManager.getTroveStatus(bob)).toString(), '1') // Confirm Bob's trove status is active

      // Confirm Bob has a Stability deposit
      assert.equal((await stabilityPool.getCompoundedUSDEDeposit(bob)).toString(), dec(1000, 18))

      // Price drops
      await priceFeed.setPrice(dec(105, 18))
      const price = toBN(await priceFeed.getPrice())

      // Liquidate bob
      await troveManager.liquidate(bob)

      // Check Bob's trove has been removed from the system
      assert.isFalse(await sortedTroves.contains(bob))
      assert.equal((await troveManager.getTroveStatus(bob)).toString(), '3') // check Bob's trove status was closed by liquidation
    })

    it("provideToSP(): providing 0 USDE reverts", async () => {
      // --- SETUP ---
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Whale,
        extraParams: {
          from: whale,
          value: dec(50, 'ether')
        }
      })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraUSDEAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Bob,
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Carol,
        extraParams: {
          from: carol
        }
      })

      // A, B, C provides 100, 50, 30 USDE to SP
      await stabilityPool.connect(Alice).provideToSP(dec(100, 18), frontEnd_1, {
        from: alice
      })
      await stabilityPool.connect(Bob).provideToSP(dec(50, 18), frontEnd_1, {
        from: bob
      })
      await stabilityPool.connect(Carol).provideToSP(dec(30, 18), frontEnd_1, {
        from: carol
      })

      const bob_Deposit_Before = (await stabilityPool.getCompoundedUSDEDeposit(bob)).toString()
      const USDEinSP_Before = (await stabilityPool.getTotalUSDEDeposits()).toString()

      assert.equal(USDEinSP_Before, dec(180, 18))

      // Bob provides 0 USDE to the Stability Pool
      const txPromise_B = stabilityPool.connect(Bob).provideToSP(0, frontEnd_1, {
        from: bob
      })
      await th.assertRevert(txPromise_B)
    })

    // --- Gain functionality ---
    it("provideToSP(), new deposit: when SP > 0, triggers Gain reward event - increases the sum G", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Whale,
        extraParams: {
          from: whale,
          value: dec(50, 'ether')
        }
      })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraUSDEAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerA,
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerB,
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerC,
        extraParams: {
          from: C
        }
      })

      // A provides to SP
      await stabilityPool.connect(signerA).provideToSP(dec(1000, 18), frontEnd_1, {
        from: A
      })

      let currentEpoch = await stabilityPool.currentEpoch()
      let currentScale = await stabilityPool.currentScale()
      const G_Before = await stabilityPool.epochToScaleToG(currentEpoch, currentScale)

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // B provides to SP
      await stabilityPool.connect(signerB).provideToSP(dec(1000, 18), frontEnd_1, {
        from: B
      })

      currentEpoch = await stabilityPool.currentEpoch()
      currentScale = await stabilityPool.currentScale()
      const G_After = await stabilityPool.epochToScaleToG(currentEpoch, currentScale)

      // Expect G has increased from the reward event triggered
      assert.isTrue(G_After.eq(G_Before))
    })

    it("provideToSP(), new deposit: when SP is empty, doesn't update G", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Whale,
        extraParams: {
          from: whale,
          value: dec(50, 'ether')
        }
      })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraUSDEAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerA,
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerB,
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerC,
        extraParams: {
          from: C
        }
      })

      // A provides to SP
      await stabilityPool.connect(signerA).provideToSP(dec(1000, 18), frontEnd_1, {
        from: A
      })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // A withdraws
      await stabilityPool.connect(signerA).withdrawFromSP(dec(1000, 18), {
        from: A
      })

      // Check SP is empty
      assert.equal((await stabilityPool.getTotalUSDEDeposits()), '0')

      // Check G is non-zero
      let currentEpoch = await stabilityPool.currentEpoch()
      let currentScale = await stabilityPool.currentScale()
      const G_Before = await stabilityPool.epochToScaleToG(currentEpoch, currentScale)

      // assert.isTrue(G_Before.gt(toBN('0')))

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // B provides to SP
      await stabilityPool.connect(signerB).provideToSP(dec(1000, 18), frontEnd_1, {
        from: B
      })

      currentEpoch = await stabilityPool.currentEpoch()
      currentScale = await stabilityPool.currentScale()
      const G_After = await stabilityPool.epochToScaleToG(currentEpoch, currentScale)

      // Expect G has not changed
      assert.isTrue(G_After.eq(G_Before))
    })

    it("provideToSP(), new deposit: sets the correct front end tag", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Whale,
        extraParams: {
          from: whale,
          value: dec(50, 'ether')
        }
      })

      // A, B, C, D open troves and make Stability Pool deposits
      await openTrove({
        extraUSDEAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerA,
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerB,
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerC,
        extraParams: {
          from: C
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerD,
        extraParams: {
          from: D
        }
      })

      // Check A, B, C D have no front end tags
      const A_tagBefore = await getFrontEndTag(stabilityPool, A)
      const B_tagBefore = await getFrontEndTag(stabilityPool, B)
      const C_tagBefore = await getFrontEndTag(stabilityPool, C)
      const D_tagBefore = await getFrontEndTag(stabilityPool, D)

      assert.equal(A_tagBefore, ZERO_ADDRESS)
      assert.equal(B_tagBefore, ZERO_ADDRESS)
      assert.equal(C_tagBefore, ZERO_ADDRESS)
      assert.equal(D_tagBefore, ZERO_ADDRESS)

      // A, B, C, D provides to SP
      await stabilityPool.connect(signerA).provideToSP(dec(1000, 18), frontEnd_1, {
        from: A
      })
      await stabilityPool.connect(signerB).provideToSP(dec(2000, 18), frontEnd_2, {
        from: B
      })
      await stabilityPool.connect(signerC).provideToSP(dec(3000, 18), frontEnd_3, {
        from: C
      })
      await stabilityPool.connect(signerD).provideToSP(dec(4000, 18), ZERO_ADDRESS, {
        from: D
      }) // transacts directly, no front end

      // Check A, B, C D have no front end tags
      const A_tagAfter = await getFrontEndTag(stabilityPool, A)
      const B_tagAfter = await getFrontEndTag(stabilityPool, B)
      const C_tagAfter = await getFrontEndTag(stabilityPool, C)
      const D_tagAfter = await getFrontEndTag(stabilityPool, D)

      // Check front end tags are correctly set
      assert.equal(A_tagAfter, frontEnd_1)
      assert.equal(B_tagAfter, frontEnd_2)
      assert.equal(C_tagAfter, frontEnd_3)
      assert.equal(D_tagAfter, ZERO_ADDRESS)
    })




    it("provideToSP(), new eligible deposit: tagged front end's stake increases", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })

      // A, B, C, open troves 
      await openTrove({
        extraUSDEAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerA,
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerB,
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerC,
        extraParams: {
          from: C
        }
      })

      // Get front ends' stakes before
      const F1_Stake_Before = await stabilityPool.frontEndStakes(frontEnd_1)
      const F2_Stake_Before = await stabilityPool.frontEndStakes(frontEnd_2)
      const F3_Stake_Before = await stabilityPool.frontEndStakes(frontEnd_3)

      const deposit_A = dec(1000, 18)
      const deposit_B = dec(2000, 18)
      const deposit_C = dec(3000, 18)

      // A, B, C provide to SP
      await stabilityPool.connect(signerA).provideToSP(deposit_A, frontEnd_1, {
        from: A
      })
      await stabilityPool.connect(signerB).provideToSP(deposit_B, frontEnd_2, {
        from: B
      })
      await stabilityPool.connect(signerC).provideToSP(deposit_C, frontEnd_3, {
        from: C
      })

      // Get front ends' stakes after
      const F1_Stake_After = await stabilityPool.frontEndStakes(frontEnd_1)
      const F2_Stake_After = await stabilityPool.frontEndStakes(frontEnd_2)
      const F3_Stake_After = await stabilityPool.frontEndStakes(frontEnd_3)

      const F1_Diff = F1_Stake_After.sub(F1_Stake_Before)
      const F2_Diff = F2_Stake_After.sub(F2_Stake_Before)
      const F3_Diff = F3_Stake_After.sub(F3_Stake_Before)

      // Check front ends' stakes have increased by amount equal to the deposit made through them 
      assert.equal(F1_Diff, deposit_A)
      assert.equal(F2_Diff, deposit_B)
      assert.equal(F3_Diff, deposit_C)
    })

    // it.only("provideToSP(), new deposit: depositor does not receive ETH gains", async () => {
    it("provideToSP(), new deposit: depositor does not receive ETH gains", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })

      // Whale transfers USDE to A, B
      await usdeToken.connect(Whale).transfer(A, dec(100, 18), {
        from: whale
      })
      await usdeToken.connect(Whale).transfer(B, dec(200, 18), {
        from: whale
      })

      // C, D open troves
      await openTrove({
        extraUSDEAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerC,
        extraParams: {
          from: C
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerD,
        extraParams: {
          from: D
        }
      })

      // --- TEST ---

      // get current ETH balances
      const A_ETHBalance_Before = await weth.balanceOf(A);
      const B_ETHBalance_Before = await weth.balanceOf(B);
      const C_ETHBalance_Before = await weth.balanceOf(C);
      const D_ETHBalance_Before = await weth.balanceOf(D);

      // A, B, C, D provide to SP
      await stabilityPool.connect(signerA).provideToSP(dec(100, 18), frontEnd_1, {
        from: A
      })
      await stabilityPool.connect(signerB).provideToSP(dec(200, 18), ZERO_ADDRESS, {
        from: B
      })
      await stabilityPool.connect(signerC).provideToSP(dec(300, 18), frontEnd_2, {
        from: C
      })
      await stabilityPool.connect(signerD).provideToSP(dec(400, 18), ZERO_ADDRESS, {
        from: D
      })

      // Get  ETH balances after
      const A_ETHBalance_After = await weth.balanceOf(A);
      const B_ETHBalance_After = await weth.balanceOf(B);
      const C_ETHBalance_After = await weth.balanceOf(C);
      const D_ETHBalance_After = await weth.balanceOf(D);

      // Check ETH balances have not changed
      assert.equal(A_ETHBalance_After.toString(), A_ETHBalance_Before.toString())
      assert.equal(B_ETHBalance_After.toString(), B_ETHBalance_Before.toString())
      assert.equal(C_ETHBalance_After.toString(), C_ETHBalance_Before.toString())
      assert.equal(D_ETHBalance_After.toString(), D_ETHBalance_Before.toString())
    })

    it("provideToSP(), new deposit after past full withdrawal: depositor does not receive ETH gains", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })

      // Whale transfers USDE to A, B
      await usdeToken.connect(Whale).transfer(A, dec(1000, 18), {
        from: whale
      })
      await usdeToken.connect(Whale).transfer(B, dec(1000, 18), {
        from: whale
      })

      // C, D open troves
      await openTrove({
        extraUSDEAmount: toBN(dec(4000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerC,
        extraParams: {
          from: C
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerD,
        extraParams: {
          from: D
        }
      })

      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_1,
        extraParams: {
          from: defaulter_1
        }
      })

      // --- SETUP ---
      // A, B, C, D provide to SP
      await stabilityPool.connect(signerA).provideToSP(dec(105, 18), frontEnd_1, {
        from: A
      })
      await stabilityPool.connect(signerB).provideToSP(dec(105, 18), ZERO_ADDRESS, {
        from: B
      })
      await stabilityPool.connect(signerC).provideToSP(dec(105, 18), frontEnd_1, {
        from: C
      })
      await stabilityPool.connect(signerD).provideToSP(dec(105, 18), ZERO_ADDRESS, {
        from: D
      })

      // time passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // B deposits. A,B,C,D earn
      await stabilityPool.connect(signerB).provideToSP(dec(5, 18), ZERO_ADDRESS, {
        from: B
      })

      // Price drops, defaulter is liquidated, A, B, C, D earn ETH
      await priceFeed.setPrice(dec(105, 18))
      assert.isFalse(await th.checkRecoveryMode(contracts))

      await troveManager.liquidate(defaulter_1)

      // Price bounces back
      await priceFeed.setPrice(dec(200, 18))

      // A B,C, D fully withdraw from the pool
      await stabilityPool.connect(signerA).withdrawFromSP(dec(105, 18), {
        from: A
      })
      await stabilityPool.connect(signerB).withdrawFromSP(dec(105, 18), {
        from: B
      })
      await stabilityPool.connect(signerC).withdrawFromSP(dec(105, 18), {
        from: C
      })
      await stabilityPool.connect(signerD).withdrawFromSP(dec(105, 18), {
        from: D
      })

      // --- TEST ---

      // get current ETH balances
      const A_ETHBalance_Before = await web3.eth.getBalance(A)
      const B_ETHBalance_Before = await web3.eth.getBalance(B)
      const C_ETHBalance_Before = await web3.eth.getBalance(C)
      const D_ETHBalance_Before = await web3.eth.getBalance(D)

      // A, B, C, D provide to SP
      await stabilityPool.connect(signerA).provideToSP(dec(100, 18), frontEnd_1, {
        from: A,
        gasPrice: 0
      })
      await stabilityPool.connect(signerB).provideToSP(dec(200, 18), ZERO_ADDRESS, {
        from: B,
        gasPrice: 0
      })
      await stabilityPool.connect(signerC).provideToSP(dec(300, 18), frontEnd_2, {
        from: C,
        gasPrice: 0
      })
      await stabilityPool.connect(signerD).provideToSP(dec(400, 18), ZERO_ADDRESS, {
        from: D,
        gasPrice: 0
      })

      // Get  ETH balances after
      const A_ETHBalance_After = await web3.eth.getBalance(A)
      const B_ETHBalance_After = await web3.eth.getBalance(B)
      const C_ETHBalance_After = await web3.eth.getBalance(C)
      const D_ETHBalance_After = await web3.eth.getBalance(D)

      // Check ETH balances have not changed
      assert.equal(A_ETHBalance_After, A_ETHBalance_Before)
      assert.equal(B_ETHBalance_After, B_ETHBalance_Before)
      assert.equal(C_ETHBalance_After, C_ETHBalance_Before)
      assert.equal(D_ETHBalance_After, D_ETHBalance_Before)
    })

    it("provideToSP(), topup: triggers reward event - increases the sum G", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })

      // A, B, C open troves 
      await openTrove({
        extraUSDEAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerA,
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerB,
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerC,
        extraParams: {
          from: C
        }
      })

      // A, B, C provide to SP
      await stabilityPool.connect(signerA).provideToSP(dec(100, 18), frontEnd_1, {
        from: A
      })
      await stabilityPool.connect(signerB).provideToSP(dec(50, 18), frontEnd_1, {
        from: B
      })
      await stabilityPool.connect(signerC).provideToSP(dec(50, 18), frontEnd_1, {
        from: C
      })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      const G_Before = await stabilityPool.epochToScaleToG(0, 0)

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // B tops up
      await stabilityPool.connect(signerB).provideToSP(dec(100, 18), frontEnd_1, {
        from: B
      })

      const G_After = await stabilityPool.epochToScaleToG(0, 0)
      // Expect G has increased from the reward event triggered by B's topup
      assert.isTrue(G_After.eq(G_Before))
    })

    it("provideToSP(), topup from different front end: doesn't change the front end tag", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })

      // whale transfer to troves D and E
      await usdeToken.connect(Whale).transfer(D, dec(100, 18), {
        from: whale
      })
      await usdeToken.connect(Whale).transfer(E, dec(200, 18), {
        from: whale
      })

      // A, B, C open troves 
      await openTrove({
        extraUSDEAmount: toBN(dec(100, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerA,
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(200, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerB,
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(300, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerC,
        extraParams: {
          from: C
        }
      })


      // A, B, C, D, E provide to SP
      await stabilityPool.connect(signerA).provideToSP(dec(10, 18), frontEnd_1, {
        from: A
      })
      await stabilityPool.connect(signerB).provideToSP(dec(20, 18), frontEnd_2, {
        from: B
      })
      await stabilityPool.connect(signerC).provideToSP(dec(30, 18), ZERO_ADDRESS, {
        from: C
      })
      await stabilityPool.connect(signerD).provideToSP(dec(40, 18), frontEnd_1, {
        from: D
      })
      await stabilityPool.connect(signerE).provideToSP(dec(50, 18), ZERO_ADDRESS, {
        from: E
      })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // A, B, C, D, E top up, from different front ends
      await stabilityPool.connect(signerA).provideToSP(dec(10, 18), frontEnd_2, {
        from: A
      })
      await stabilityPool.connect(signerB).provideToSP(dec(20, 18), frontEnd_1, {
        from: B
      })
      await stabilityPool.connect(signerC).provideToSP(dec(15, 18), frontEnd_3, {
        from: C
      })
      await stabilityPool.connect(signerD).provideToSP(dec(20, 18), frontEnd_2, {
        from: D
      })
      await stabilityPool.connect(signerE).provideToSP(dec(30, 18), frontEnd_3, {
        from: E
      })

      const frontEndTag_A = (await stabilityPool.deposits(A))[1]
      const frontEndTag_B = (await stabilityPool.deposits(B))[1]
      const frontEndTag_C = (await stabilityPool.deposits(C))[1]
      const frontEndTag_D = (await stabilityPool.deposits(D))[1]
      const frontEndTag_E = (await stabilityPool.deposits(E))[1]

      // Check deposits are still tagged with their original front end
      assert.equal(frontEndTag_A, frontEnd_1)
      assert.equal(frontEndTag_B, frontEnd_2)
      assert.equal(frontEndTag_C, ZERO_ADDRESS)
      assert.equal(frontEndTag_D, frontEnd_1)
      assert.equal(frontEndTag_E, ZERO_ADDRESS)
    })

    it("provideToSP(), topup: tagged front end's stake increases", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })

      // A, B, C, D, E, F open troves 
      await openTrove({
        extraUSDEAmount: toBN(dec(100, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerA,
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(200, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerB,
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(300, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerC,
        extraParams: {
          from: C
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(100, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerD,
        extraParams: {
          from: D
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(200, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerE,
        extraParams: {
          from: E
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(300, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerF,
        extraParams: {
          from: F
        }
      })

      // A, B, C, D, E, F provide to SP
      await stabilityPool.connect(signerA).provideToSP(dec(10, 18), frontEnd_1, {
        from: A
      })
      await stabilityPool.connect(signerB).provideToSP(dec(20, 18), frontEnd_2, {
        from: B
      })
      await stabilityPool.connect(signerC).provideToSP(dec(30, 18), frontEnd_3, {
        from: C
      })
      await stabilityPool.connect(signerD).provideToSP(dec(10, 18), frontEnd_1, {
        from: D
      })
      await stabilityPool.connect(signerE).provideToSP(dec(20, 18), frontEnd_2, {
        from: E
      })
      await stabilityPool.connect(signerF).provideToSP(dec(30, 18), frontEnd_3, {
        from: F
      })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // Get front ends' stake before
      const F1_Stake_Before = await stabilityPool.frontEndStakes(frontEnd_1)
      const F2_Stake_Before = await stabilityPool.frontEndStakes(frontEnd_2)
      const F3_Stake_Before = await stabilityPool.frontEndStakes(frontEnd_3)

      // A, B, C top up  (front end param passed here is irrelevant)
      await stabilityPool.connect(signerA).provideToSP(dec(10, 18), ZERO_ADDRESS, {
        from: A
      }) // provides no front end param
      await stabilityPool.connect(signerB).provideToSP(dec(20, 18), frontEnd_1, {
        from: B
      }) // provides front end that doesn't match his tag
      await stabilityPool.connect(signerC).provideToSP(dec(30, 18), frontEnd_3, {
        from: C
      }) // provides front end that matches his tag

      // Get front ends' stakes after
      const F1_Stake_After = await stabilityPool.frontEndStakes(frontEnd_1)
      const F2_Stake_After = await stabilityPool.frontEndStakes(frontEnd_2)
      const F3_Stake_After = await stabilityPool.frontEndStakes(frontEnd_3)

      // Check front ends' stakes have increased
      assert.isTrue(F1_Stake_After.gt(F1_Stake_Before))
      assert.isTrue(F2_Stake_After.gt(F2_Stake_Before))
      assert.isTrue(F3_Stake_After.gt(F3_Stake_Before))
    })

    it("provideToSP(): reverts when amount is zero", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })

      await openTrove({
        extraUSDEAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerA,
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerB,
        extraParams: {
          from: B
        }
      })

      // Whale transfers USDE to C, D
      await usdeToken.connect(Whale).transfer(C, dec(100, 18), {
        from: whale
      })
      await usdeToken.connect(Whale).transfer(D, dec(100, 18), {
        from: whale
      })

      txPromise_A = stabilityPool.connect(signerA).provideToSP(0, frontEnd_1, {
        from: A
      })
      txPromise_B = stabilityPool.connect(signerB).provideToSP(0, ZERO_ADDRESS, {
        from: B
      })
      txPromise_C = stabilityPool.connect(signerC).provideToSP(0, frontEnd_2, {
        from: C
      })
      txPromise_D = stabilityPool.connect(signerD).provideToSP(0, ZERO_ADDRESS, {
        from: D
      })
      // Amount must be non-zero
      await th.assertRevert(txPromise_A, 'ZeroValue')
      await th.assertRevert(txPromise_B, 'ZeroValue')
      await th.assertRevert(txPromise_C, 'ZeroValue')
      await th.assertRevert(txPromise_D, 'ZeroValue')
    })

    it("provideToSP(): reverts if user is a registered front end", async () => {
      // C, D, E, F open troves 
      await openTrove({
        extraUSDEAmount: toBN(dec(30, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerC,
        extraParams: {
          from: C
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerD,
        extraParams: {
          from: D
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerE,
        extraParams: {
          from: E
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerF,
        extraParams: {
          from: F
        }
      })

      // C, E, F registers as front end
      await stabilityPool.connect(signerC).registerFrontEnd(dec(1, 18), {
        from: C
      })
      await stabilityPool.connect(signerE).registerFrontEnd(dec(1, 18), {
        from: E
      })
      await stabilityPool.connect(signerF).registerFrontEnd(dec(1, 18), {
        from: F
      })

      const txPromise_C = stabilityPool.connect(signerC).provideToSP(dec(10, 18), ZERO_ADDRESS, {
        from: C
      })
      const txPromise_E = stabilityPool.connect(signerE).provideToSP(dec(10, 18), frontEnd_1, {
        from: E
      })
      const txPromise_F = stabilityPool.connect(signerF).provideToSP(dec(10, 18), F, {
        from: F
      })
      // must not already be a registered front end
      await th.assertRevert(txPromise_C, "AlreadyRegistered")
      await th.assertRevert(txPromise_E, "AlreadyRegistered")
      await th.assertRevert(txPromise_F, "AlreadyRegistered")

      const txD = await stabilityPool.connect(signerD).provideToSP(dec(10, 18), frontEnd_1, {
        from: D
      })
      const txDRes = await txD.wait()
      assert.isTrue(txDRes.status === 1)
    })

    it("provideToSP(): reverts if provided tag is not a registered front end", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(30, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerC,
        extraParams: {
          from: C
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerD,
        extraParams: {
          from: D
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerE,
        extraParams: {
          from: E
        }
      })

      const txPromise_C = stabilityPool.connect(signerC).provideToSP(dec(10, 18), A, {
        from: C
      }) // passes another EOA
      const txPromise_D = stabilityPool.connect(signerD).provideToSP(dec(10, 18), troveManager.address, {
        from: D
      })
      const txPromise_E = stabilityPool.connect(signerE).provideToSP(dec(10, 18), stabilityPool.address, {
        from: E
      })
      const txPromise_F = stabilityPool.connect(signerF).provideToSP(dec(10, 18), F, {
        from: F
      }) // passes itself
      // Tag must be a registered front end, or the zero address
      await th.assertRevert(txPromise_C, "MustRegisteredOrZeroAddress")
      await th.assertRevert(txPromise_D, "MustRegisteredOrZeroAddress")
      await th.assertRevert(txPromise_E, "MustRegisteredOrZeroAddress")
      await th.assertRevert(txPromise_F, "MustRegisteredOrZeroAddress")
    })

    // --- withdrawFromSP ---

    it("withdrawFromSP(): reverts when user has no active deposit", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(100, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(100, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Bob,
        extraParams: {
          from: bob
        }
      })

      await stabilityPool.connect(Alice).provideToSP(dec(100, 18), frontEnd_1, {
        from: alice
      })

      const alice_initialDeposit = ((await stabilityPool.deposits(alice))[0]).toString()
      const bob_initialDeposit = ((await stabilityPool.deposits(bob))[0]).toString()

      assert.equal(alice_initialDeposit, dec(100, 18))
      assert.equal(bob_initialDeposit, '0')

      const txAlice = await stabilityPool.connect(Alice).withdrawFromSP(dec(100, 18), {
        from: alice
      })
      const txAliceRes = await txAlice.wait()
      assert.isTrue(txAliceRes.status === 1)


      try {
        const txBob = await stabilityPool.connect(Bob).withdrawFromSP(dec(100, 18), {
          from: bob
        })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        // TODO: infamous issue #99
        //assert.include(err.message, "User must have a non-zero deposit")

      }
    })

    it("withdrawFromSP(): reverts when amount > 0 and system has an undercollateralized trove", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(100, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })

      await stabilityPool.connect(Alice).provideToSP(dec(100, 18), frontEnd_1, {
        from: alice
      })

      const alice_initialDeposit = ((await stabilityPool.deposits(alice))[0]).toString()
      assert.equal(alice_initialDeposit, dec(100, 18))

      // defaulter opens trove
      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_1,
        extraParams: {
          from: defaulter_1
        }
      })

      // ETH drops, defaulter is in liquidation range (but not liquidated yet)
      await priceFeed.setPrice(dec(100, 18))

      await th.assertRevert(stabilityPool.connect(Alice).withdrawFromSP(dec(100, 18), {
        from: alice
      }))
    })

    it("withdrawFromSP(): partial retrieval - retrieves correct USDE amount and the entire ETH Gain, and updates deposit", async () => {
      // --- SETUP ---
      // Whale deposits 185000 USDE in StabilityPool
      await openTrove({
        extraUSDEAmount: toBN(dec(1, 24)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })
      await stabilityPool.connect(Whale).provideToSP(dec(185000, 18), frontEnd_1, {
        from: whale
      })

      // 2 Troves opened
      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_1,
        extraParams: {
          from: defaulter_1
        }
      })
      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_2,
        extraParams: {
          from: defaulter_2
        }
      })

      // --- TEST ---

      // Alice makes deposit #1: 15000 USDE
      await openTrove({
        extraUSDEAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })
      await stabilityPool.connect(Alice).provideToSP(dec(15000, 18), frontEnd_1, {
        from: alice
      })

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(dec(105, 18));

      // 2 users with Trove with 170 USDE drawn are closed
      const liquidationTXW_1 = await troveManager.liquidate(defaulter_1, {
        from: owner
      }) // 170 USDE closed
      const liquidationTXW_2 = await troveManager.liquidate(defaulter_2, {
        from: owner
      }) // 170 USDE closed
      const liquidationTX_1 = await liquidationTXW_1.wait()
      const liquidationTX_2 = await liquidationTXW_2.wait()

      const [liquidatedDebt_1] = await th.getEmittedLiquidationValues(liquidationTX_1)
      const [liquidatedDebt_2] = await th.getEmittedLiquidationValues(liquidationTX_2)

      // Alice USDELoss is ((15000/200000) * liquidatedDebt), for each liquidation
      const expectedUSDELoss_A = (liquidatedDebt_1.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18))))
        .add(liquidatedDebt_2.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18))))

      const expectedCompoundedUSDEDeposit_A = toBN(dec(15000, 18)).sub(expectedUSDELoss_A)
      const compoundedUSDEDeposit_A = await stabilityPool.getCompoundedUSDEDeposit(alice)

      assert.isAtMost(th.getDifference(expectedCompoundedUSDEDeposit_A, compoundedUSDEDeposit_A), 100000)

      // Alice retrieves part of her entitled USDE: 9000 USDE
      await stabilityPool.connect(Alice).withdrawFromSP(dec(9000, 18), {
        from: alice
      })

      const expectedNewDeposit_A = (compoundedUSDEDeposit_A.sub(toBN(dec(9000, 18))))

      // check Alice's deposit has been updated to equal her compounded deposit minus her withdrawal */
      const newDeposit = ((await stabilityPool.deposits(alice))[0]).toString()
      assert.isAtMost(th.getDifference(newDeposit, expectedNewDeposit_A), 100000)

      // Expect Alice has withdrawn all ETH gain
      const alice_pendingETHGain = (await stabilityPool.getDepositorCollateralGain(alice))[1][0]
      assert.equal(alice_pendingETHGain, 0)
    })


    it("withdrawFromSP(): partial retrieval - leaves the correct amount of USDE in the Stability Pool", async () => {
      // --- SETUP ---
      // Whale deposits 185000 USDE in StabilityPool
      await openTrove({
        extraUSDEAmount: toBN(dec(1, 24)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })
      await stabilityPool.connect(Whale).provideToSP(dec(185000, 18), frontEnd_1, {
        from: whale
      })

      // 2 Troves opened
      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_1,
        extraParams: {
          from: defaulter_1
        }
      })
      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_2,
        extraParams: {
          from: defaulter_2
        }
      })
      // --- TEST ---

      // Alice makes deposit #1: 15000 USDE
      await openTrove({
        extraUSDEAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })
      await stabilityPool.connect(Alice).provideToSP(dec(15000, 18), frontEnd_1, {
        from: alice
      })

      const SP_USDE_Before = await stabilityPool.getTotalUSDEDeposits()
      assert.equal(SP_USDE_Before, dec(200000, 18))

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(dec(105, 18));

      // 2 users liquidated
      const liquidationTXW_1 = await troveManager.liquidate(defaulter_1, {
        from: owner
      })
      const liquidationTXW_2 = await troveManager.liquidate(defaulter_2, {
        from: owner
      })
      const liquidationTX_1 = await liquidationTXW_1.wait()
      const liquidationTX_2 = await liquidationTXW_2.wait()

      const [liquidatedDebt_1] = await th.getEmittedLiquidationValues(liquidationTX_1)
      const [liquidatedDebt_2] = await th.getEmittedLiquidationValues(liquidationTX_2)

      // Alice retrieves part of her entitled USDE: 9000 USDE
      await stabilityPool.connect(Alice).withdrawFromSP(dec(9000, 18), {
        from: alice
      })

      /* Check SP has reduced from 2 liquidations and Alice's withdrawal
      Expect USDE in SP = (200000 - liquidatedDebt_1 - liquidatedDebt_2 - 9000) */
      const expectedSPUSDE = toBN(dec(200000, 18))
        .sub(toBN(liquidatedDebt_1))
        .sub(toBN(liquidatedDebt_2))
        .sub(toBN(dec(9000, 18)))

      const SP_USDE_After = (await stabilityPool.getTotalUSDEDeposits()).toString()

      th.assertIsApproximatelyEqual(SP_USDE_After, expectedSPUSDE)
    })

    it("withdrawFromSP(): full retrieval - leaves the correct amount of USDE in the Stability Pool", async () => {
      // --- SETUP ---
      // Whale deposits 185000 USDE in StabilityPool
      await openTrove({
        extraUSDEAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })
      await stabilityPool.connect(Whale).provideToSP(dec(185000, 18), frontEnd_1, {
        from: whale
      })

      // 2 Troves opened
      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_1,
        extraParams: {
          from: defaulter_1
        }
      })
      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_2,
        extraParams: {
          from: defaulter_2
        }
      })

      // --- TEST ---

      // Alice makes deposit #1
      await openTrove({
        extraUSDEAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })
      await stabilityPool.connect(Alice).provideToSP(dec(15000, 18), frontEnd_1, {
        from: alice
      })

      const SP_USDE_Before = await stabilityPool.getTotalUSDEDeposits()
      assert.equal(SP_USDE_Before, dec(200000, 18))

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(dec(105, 18));

      // 2 defaulters liquidated
      const liquidationTXW_1 = await troveManager.liquidate(defaulter_1, {
        from: owner
      })
      const liquidationTXW_2 = await troveManager.liquidate(defaulter_2, {
        from: owner
      })
      const liquidationTX_1 = await liquidationTXW_1.wait()
      const liquidationTX_2 = await liquidationTXW_2.wait()

      const [liquidatedDebt_1] = await th.getEmittedLiquidationValues(liquidationTX_1)
      const [liquidatedDebt_2] = await th.getEmittedLiquidationValues(liquidationTX_2)

      // Alice USDELoss is ((15000/200000) * liquidatedDebt), for each liquidation
      const expectedUSDELoss_A = (liquidatedDebt_1.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18))))
        .add(liquidatedDebt_2.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18))))

      const expectedCompoundedUSDEDeposit_A = toBN(dec(15000, 18)).sub(expectedUSDELoss_A)
      const compoundedUSDEDeposit_A = await stabilityPool.getCompoundedUSDEDeposit(alice)

      assert.isAtMost(th.getDifference(expectedCompoundedUSDEDeposit_A, compoundedUSDEDeposit_A), 100000)

      const USDEinSPBefore = await stabilityPool.getTotalUSDEDeposits()

      // Alice retrieves all of her entitled USDE:
      await stabilityPool.connect(Alice).withdrawFromSP(dec(15000, 18), {
        from: alice
      })

      const expectedUSDEinSPAfter = USDEinSPBefore.sub(compoundedUSDEDeposit_A)

      const USDEinSPAfter = await stabilityPool.getTotalUSDEDeposits()
      assert.isAtMost(th.getDifference(expectedUSDEinSPAfter, USDEinSPAfter), 100000)
    })

    it("withdrawFromSP(): Subsequent deposit and withdrawal attempt from same account, with no intermediate liquidations, withdraws zero ETH", async () => {
      // --- SETUP ---
      // Whale deposits 18500 USDE in StabilityPool
      await openTrove({
        extraUSDEAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })
      await stabilityPool.connect(Whale).provideToSP(dec(18500, 18), frontEnd_1, {
        from: whale
      })

      // 2 defaulters open
      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_1,
        extraParams: {
          from: defaulter_1
        }
      })
      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_2,
        extraParams: {
          from: defaulter_2
        }
      })

      // --- TEST ---

      // Alice makes deposit #1: 15000 USDE
      await openTrove({
        extraUSDEAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })
      await stabilityPool.connect(Alice).provideToSP(dec(15000, 18), frontEnd_1, {
        from: alice
      })

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(dec(105, 18));

      // defaulters liquidated
      await troveManager.liquidate(defaulter_1, {
        from: owner
      })
      await troveManager.liquidate(defaulter_2, {
        from: owner
      })

      // Alice retrieves all of her entitled USDE:
      await stabilityPool.connect(Alice).withdrawFromSP(dec(15000, 18), {
        from: alice
      })

      const aliceGains = (await stabilityPool.getDepositorCollateralGain(alice));

      // empty lists for tokens and amounts in the event that alice has no deposit in the pool
      assert.equal(((await stabilityPool.getDepositorCollateralGain(alice))[1]).length, 0)

      // Alice makes second deposit
      await stabilityPool.connect(Alice).provideToSP(dec(10000, 18), frontEnd_1, {
        from: alice
      })
      assert.equal((await stabilityPool.getDepositorCollateralGain(alice))[1][0], 0)

      const ETHinSP_Before = (await stabilityPool.getCollateralAmount(weth.address)).toString()

      // Alice attempts second withdrawal
      await stabilityPool.connect(Alice).withdrawFromSP(dec(10000, 18), {
        from: alice
      })
      // empty lists for tokens and amounts in the event that alice has no deposit in the pool
      assert.equal((await stabilityPool.getDepositorCollateralGain(alice))[1].length, 0)

      // Check ETH in pool does not change
      const ETHinSP_1 = (await stabilityPool.getCollateralAmount(weth.address)).toString()
      assert.equal(ETHinSP_Before, ETHinSP_1)

      // Third deposit
      await stabilityPool.connect(Alice).provideToSP(dec(10000, 18), frontEnd_1, {
        from: alice
      })
      assert.equal((await stabilityPool.getDepositorCollateralGain(alice))[1][0], 0)

      // const txPromise_A = stabilityPool.withdrawETHGainToTrove(alice, alice, { from: alice })
      // await th.assertRevert(txPromise_A)
    })

    it("withdrawFromSP(): it correctly updates the user's USDE and ETH snapshots of entitled reward per unit staked", async () => {
      // --- SETUP ---
      // Whale deposits 185000 USDE in StabilityPool
      await openTrove({
        extraUSDEAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })
      await stabilityPool.connect(Whale).provideToSP(dec(185000, 18), frontEnd_1, {
        from: whale
      })

      // 2 defaulters open
      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_1,
        extraParams: {
          from: defaulter_1
        }
      })
      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_2,
        extraParams: {
          from: defaulter_2
        }
      })

      // --- TEST ---

      // Alice makes deposit #1: 15000 USDE
      await openTrove({
        extraUSDEAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })
      await stabilityPool.connect(Alice).provideToSP(dec(15000, 18), frontEnd_1, {
        from: alice
      })

      // check 'Before' snapshots
      const alice_snapshot_Before = await stabilityPool.depositSnapshots(alice)
      const alice_snapshot_S_Before = (await stabilityPool.getDepositSnapshotS(alice, contracts.weth.address)).toString();
      const alice_snapshot_P_Before = alice_snapshot_Before.P.toString()
      assert.equal(alice_snapshot_S_Before, 0)
      assert.equal(alice_snapshot_P_Before, '1000000000000000000')

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(dec(105, 18));

      // 2 defaulters liquidated
      await troveManager.liquidate(defaulter_1, {
        from: owner
      })
      await troveManager.liquidate(defaulter_2, {
        from: owner
      });

      // Alice retrieves part of her entitled USDE: 9000 USDE
      await stabilityPool.connect(Alice).withdrawFromSP(dec(9000, 18), {
        from: alice
      })

      const P = (await stabilityPool.P()).toString()
      const S = (await stabilityPool.epochToScaleToSum(contracts.weth.address, 0, 0)).toString()
      // check 'After' snapshots
      const alice_snapshot_After = await stabilityPool.depositSnapshots(alice)
      const alice_snapshot_S_After = (await stabilityPool.getDepositSnapshotS(alice, contracts.weth.address)).toString();
      const alice_snapshot_P_After = alice_snapshot_After.P.toString()
      assert.equal(alice_snapshot_S_After, S)
      assert.equal(alice_snapshot_P_After, P)
    })

    it("withdrawFromSP(): decreases StabilityPool ETH", async () => {
      // --- SETUP ---
      // Whale deposits 185000 USDE in StabilityPool
      await openTrove({
        extraUSDEAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })
      await stabilityPool.connect(Whale).provideToSP(dec(185000, 18), frontEnd_1, {
        from: whale
      })

      // 1 defaulter opens
      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_1,
        extraParams: {
          from: defaulter_1
        }
      })

      // --- TEST ---

      // Alice makes deposit #1: 15000 USDE
      await openTrove({
        extraUSDEAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })
      await stabilityPool.connect(Alice).provideToSP(dec(15000, 18), frontEnd_1, {
        from: alice
      })

      // price drops: defaulter's Trove falls below MCR, alice and whale Trove remain active
      await priceFeed.setPrice('100000000000000000000');

      // defaulter's Trove is closed.
      const liquidationTx_1 = await troveManager.liquidate(defaulter_1, {
        from: owner
      }); // 180 USDE closed
      const liquidationTx_1Res = await liquidationTx_1.wait();

      [liquidatedDebt, liquidatedColl, gasComp] = await th.getEmittedLiquidationValues(liquidationTx_1Res);

      //Get ActivePool and StabilityPool Ether before retrieval:
      const active_ETH_Before = await activePool.getCollateralAmount(weth.address)
      const stability_ETH_Before = await stabilityPool.getCollateralAmount(weth.address)

      // Expect alice to be entitled to 15000/200000 of the liquidated coll
      const aliceExpectedETHGain = liquidatedColl[0].mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18)))
      const aliceETHGain = (await stabilityPool.getDepositorCollateralGain(alice))[1][0];
      assert.isTrue(aliceExpectedETHGain.eq(aliceETHGain))

      // Alice retrieves all of her deposit
      await stabilityPool.connect(Alice).withdrawFromSP(dec(15000, 18), {
        from: alice
      })

      const active_ETH_After = await activePool.getCollateralAmount(weth.address)
      const stability_ETH_After = await stabilityPool.getCollateralAmount(weth.address)

      const active_ETH_Difference = (active_ETH_Before.sub(active_ETH_After))
      const stability_ETH_Difference = (stability_ETH_Before.sub(stability_ETH_After))

      assert.equal(active_ETH_Difference, '0')

      // Expect StabilityPool to have decreased by Alice's ETHGain
      assert.isAtMost(th.getDifference(stability_ETH_Difference, aliceETHGain), 10000)
    })

    it("withdrawFromSP(): All depositors are able to withdraw from the SP to their account", async () => {
      // Whale opens trove 
      await openTrove({
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })

      // 1 defaulter open
      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_1,
        extraParams: {
          from: defaulter_1
        }
      })

      // 6 Accounts open troves and provide to SP
      const depositors = [Alice, Bob, Carol, Dennis, Erin, Flyn]
      for (const account of depositors) {
        await openTrove({
          extraUSDEAmount: toBN(dec(10000, 18)),
          ICR: toBN(dec(2, 18)),
          signer: account,
          extraParams: {
            from: account.address
          }
        })
        await stabilityPool.connect(account).provideToSP(dec(10000, 18), frontEnd_1, {
          from: account.address
        })
      }

      await priceFeed.setPrice(dec(105, 18))
      await troveManager.liquidate(defaulter_1)

      await priceFeed.setPrice(dec(200, 18))

      // All depositors attempt to withdraw
      await stabilityPool.connect(Alice).withdrawFromSP(dec(10000, 18), {
        from: alice
      })
      assert.equal(((await stabilityPool.deposits(alice))[0]).toString(), '0')
      await stabilityPool.connect(Bob).withdrawFromSP(dec(10000, 18), {
        from: bob
      })
      assert.equal(((await stabilityPool.deposits(alice))[0]).toString(), '0')
      await stabilityPool.connect(Carol).withdrawFromSP(dec(10000, 18), {
        from: carol
      })
      assert.equal(((await stabilityPool.deposits(alice))[0]).toString(), '0')
      await stabilityPool.connect(Dennis).withdrawFromSP(dec(10000, 18), {
        from: dennis
      })
      assert.equal(((await stabilityPool.deposits(alice))[0]).toString(), '0')
      await stabilityPool.connect(Erin).withdrawFromSP(dec(10000, 18), {
        from: erin
      })
      assert.equal(((await stabilityPool.deposits(alice))[0]).toString(), '0')
      await stabilityPool.connect(Flyn).withdrawFromSP(dec(10000, 18), {
        from: flyn
      })
      assert.equal(((await stabilityPool.deposits(alice))[0]).toString(), '0')

      const totalDeposits = (await stabilityPool.getTotalUSDEDeposits()).toString()

      assert.isAtMost(th.getDifference(totalDeposits, '0'), 100000)
    })

    it("withdrawFromSP(): increases depositor's USDE token balance by the expected amount", async () => {
      // Whale opens trove 
      await weth.connect(Whale).approve(borrowerOperations.address, dec(100000000, 18), {
        from: whale
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(100000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })

      // 1 defaulter opens trove
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(100, 'ether')
      })

      // const defaulterDebt = (await troveManager.getEntireDebtAndColls(defaulter_1))[0]

      // 6 Accounts open troves and provide to SP
      const depositors = [Alice, Bob, Carol, Dennis, Erin, Flyn]
      for (const account of depositors) {
        await weth.connect(account).approve(borrowerOperations.address, dec(100000000, 18), {
          from: account.address
        })
        await openTrove({
          extraUSDEAmount: toBN(dec(10000, 18)),
          ICR: toBN(dec(2, 18)),
          signer: account,
          extraParams: {
            from: account.address
          }
        })
        await stabilityPool.connect(account).provideToSP(dec(10000, 18), frontEnd_1, {
          from: account.address
        })
      }

      await priceFeed.setPrice(dec(105, 18))
      await troveManager.liquidate(defaulter_1)

      const aliceBalBefore = await usdeToken.balanceOf(alice)
      const bobBalBefore = await usdeToken.balanceOf(bob)

      /* From an offset of 10000 USDE, each depositor receives
      USDELoss = 1666.6666666666666666 USDE

      and thus with a deposit of 10000 USDE, each should withdraw 8333.3333333333333333 USDE (in practice, slightly less due to rounding error)
      */

      // Price bounces back to $200 per ETH
      await priceFeed.setPrice(dec(200, 18))

      // Bob issues a further 5000 USDE from his trove
      await borrowerOperations.connect(Bob).withdrawUSDE(dec(5000, 18), bob, bob, th._100pct, {
        from: bob
      })

      // Expect Alice's USDE balance increase be very close to 8333.3333333333333333 USDE
      await stabilityPool.connect(Alice).withdrawFromSP(dec(10000, 18), {
        from: alice
      })
      const aliceBalance = (await usdeToken.balanceOf(alice))

      assert.isAtMost(th.getDifference(aliceBalance.sub(aliceBalBefore), '8333333333333333333333'), _dec(16))

      // expect Bob's USDE balance increase to be very close to  13333.33333333333333333 USDE
      await stabilityPool.connect(Bob).withdrawFromSP(dec(10000, 18), {
        from: bob
      })
      const bobBalance = (await usdeToken.balanceOf(bob))
      assert.isAtMost(th.getDifference(bobBalance.sub(bobBalBefore), '13333333333333333333333'), _dec(16))
    })

    it("withdrawFromSP(): doesn't impact other users Stability deposits or ETH gains", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(100000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Bob,
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Carol,
        extraParams: {
          from: carol
        }
      })

      await stabilityPool.connect(Alice).provideToSP(dec(10000, 18), frontEnd_1, {
        from: alice
      })
      await stabilityPool.connect(Bob).provideToSP(dec(20000, 18), frontEnd_1, {
        from: bob
      })
      await stabilityPool.connect(Carol).provideToSP(dec(30000, 18), frontEnd_1, {
        from: carol
      })

      // Would-be defaulters open troves
      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_1,
        extraParams: {
          from: defaulter_1
        }
      })
      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_2,
        extraParams: {
          from: defaulter_2
        }
      })

      // Price drops
      await priceFeed.setPrice(dec(105, 18))

      // Defaulters are liquidated
      await troveManager.liquidate(defaulter_1)
      await troveManager.liquidate(defaulter_2)
      assert.isFalse(await sortedTroves.contains(defaulter_1))
      assert.isFalse(await sortedTroves.contains(defaulter_2))

      const alice_USDEDeposit_Before = (await stabilityPool.getCompoundedUSDEDeposit(alice)).toString()
      const bob_USDEDeposit_Before = (await stabilityPool.getCompoundedUSDEDeposit(bob)).toString()

      const alice_ETHGain_Before = ((await stabilityPool.getDepositorCollateralGain(alice))[1][0]).toString()
      const bob_ETHGain_Before = ((await stabilityPool.getDepositorCollateralGain(bob))[1][0]).toString()

      //check non-zero USDE and ETHGain in the Stability Pool
      const USDEinSP = await stabilityPool.getTotalUSDEDeposits()
      const ETHinSP = await stabilityPool.getCollateralAmount(weth.address)
      assert.isTrue(USDEinSP.gt(mv._zeroBN))
      assert.isTrue(ETHinSP.gt(mv._zeroBN))

      // Price rises
      await priceFeed.setPrice(dec(200, 18))

      // Carol withdraws her Stability deposit 
      assert.equal(((await stabilityPool.deposits(carol))[0]).toString(), dec(30000, 18))
      await stabilityPool.connect(Carol).withdrawFromSP(dec(30000, 18), {
        from: carol
      })
      assert.equal(((await stabilityPool.deposits(carol))[0]).toString(), '0')

      const alice_USDEDeposit_After = (await stabilityPool.getCompoundedUSDEDeposit(alice)).toString()
      const bob_USDEDeposit_After = (await stabilityPool.getCompoundedUSDEDeposit(bob)).toString()

      const alice_ETHGain_After = ((await stabilityPool.getDepositorCollateralGain(alice))[1][0]).toString()
      const bob_ETHGain_After = ((await stabilityPool.getDepositorCollateralGain(bob))[1][0]).toString()

      // Check compounded deposits and ETH gains for A and B have not changed
      assert.equal(alice_USDEDeposit_Before, alice_USDEDeposit_After)
      assert.equal(bob_USDEDeposit_Before, bob_USDEDeposit_After)

      assert.equal(alice_ETHGain_Before, alice_ETHGain_After)
      assert.equal(bob_ETHGain_Before, bob_ETHGain_After)
    })

    it("withdrawFromSP(): doesn't impact system debt, collateral or TCR ", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(100000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Bob,
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Carol,
        extraParams: {
          from: carol
        }
      })

      await stabilityPool.connect(Alice).provideToSP(dec(10000, 18), frontEnd_1, {
        from: alice
      })
      await stabilityPool.connect(Bob).provideToSP(dec(20000, 18), frontEnd_1, {
        from: bob
      })
      await stabilityPool.connect(Carol).provideToSP(dec(30000, 18), frontEnd_1, {
        from: carol
      })

      // Would-be defaulters open troves
      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_1,
        extraParams: {
          from: defaulter_1
        }
      })
      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_2,
        extraParams: {
          from: defaulter_2
        }
      })

      // Price drops
      await priceFeed.setPrice(dec(105, 18))

      // Defaulters are liquidated
      await troveManager.liquidate(defaulter_1)
      await troveManager.liquidate(defaulter_2)
      assert.isFalse(await sortedTroves.contains(defaulter_1))
      assert.isFalse(await sortedTroves.contains(defaulter_2))

      // Price rises
      await priceFeed.setPrice(dec(200, 18))

      const activeDebt_Before = (await activePool.getUSDEDebt()).toString()
      const defaultedDebt_Before = (await defaultPool.getUSDEDebt()).toString()
      const activeColl_Before = (await activePool.getCollateralAmount(contracts.weth.address)).toString()
      const defaultedColl_Before = (await defaultPool.getCollateralAmount(contracts.weth.address)).toString()
      const TCR_Before = (await th.getTCR(contracts)).toString()

      // Carol withdraws her Stability deposit 
      assert.equal(((await stabilityPool.deposits(carol))[0]).toString(), dec(30000, 18))
      await stabilityPool.connect(Carol).withdrawFromSP(dec(30000, 18), {
        from: carol
      })
      assert.equal(((await stabilityPool.deposits(carol))[0]).toString(), '0')

      const activeDebt_After = (await activePool.getUSDEDebt()).toString()
      const defaultedDebt_After = (await defaultPool.getUSDEDebt()).toString()
      const activeColl_After = (await activePool.getCollateralAmount(contracts.weth.address)).toString()
      const defaultedColl_After = (await defaultPool.getCollateralAmount(contracts.weth.address)).toString()
      const TCR_After = (await th.getTCR(contracts)).toString()

      // Check total system debt, collateral and TCR have not changed after a Stability deposit is made
      assert.equal(activeDebt_Before, activeDebt_After)
      assert.equal(defaultedDebt_Before, defaultedDebt_After)
      assert.equal(activeColl_Before, activeColl_After)
      assert.equal(defaultedColl_Before, defaultedColl_After)
      th.assertIsApproximatelyEqual(TCR_Before, TCR_After, _dec(10))
    })

    it("withdrawFromSP(): doesn't impact any troves, including the caller's trove", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(100000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Bob,
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Carol,
        extraParams: {
          from: carol
        }
      })

      // A, B and C provide to SP
      await stabilityPool.connect(Alice).provideToSP(dec(10000, 18), frontEnd_1, {
        from: alice
      })
      await stabilityPool.connect(Bob).provideToSP(dec(20000, 18), frontEnd_1, {
        from: bob
      })
      await stabilityPool.connect(Carol).provideToSP(dec(30000, 18), frontEnd_1, {
        from: carol
      })

      // Price drops
      await priceFeed.setPrice(dec(105, 18))
      const price = toBN(await priceFeed.getPrice())

      // Get debt, collateral and ICR of all existing troves
      const whale_Debt_Before = (await troveManager.getTroveDebt(whale)).toString()
      const alice_Debt_Before = (await troveManager.getTroveDebt(alice)).toString()
      const bob_Debt_Before = (await troveManager.getTroveDebt(bob)).toString()
      const carol_Debt_Before = (await troveManager.getTroveDebt(carol)).toString()

      const whale_Coll_Before = (await troveManager.getTroveColls(whale))[0][0].toString()
      const alice_Coll_Before = (await troveManager.getTroveColls(alice))[0][0].toString()
      const bob_Coll_Before = (await troveManager.getTroveColls(bob))[0][0].toString()
      const carol_Coll_Before = (await troveManager.getTroveColls(carol))[0][0].toString()

      const whale_ICR_Before = (await th.getCurrentICR(contracts, whale)).toString()
      const alice_ICR_Before = (await th.getCurrentICR(contracts, alice)).toString()
      const bob_ICR_Before = (await th.getCurrentICR(contracts, bob)).toString()
      const carol_ICR_Before = (await th.getCurrentICR(contracts, carol)).toString()

      // price rises
      await priceFeed.setPrice(dec(200, 18))

      // Carol withdraws her Stability deposit 
      assert.equal(((await stabilityPool.deposits(carol))[0]).toString(), dec(30000, 18))
      await stabilityPool.connect(Carol).withdrawFromSP(dec(30000, 18), {
        from: carol
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

      // const whale_ICR_After = (await th.getCurrentICR(contracts, whale)).toString()
      // const alice_ICR_After = (await th.getCurrentICR(contracts, alice)).toString()
      // const bob_ICR_After = (await th.getCurrentICR(contracts, bob)).toString()
      // const carol_ICR_After = (await th.getCurrentICR(contracts, carol)).toString()

      // Check all troves are unaffected by Carol's Stability deposit withdrawal
      th.assertIsApproximatelyEqual(whale_Debt_Before, whale_Debt_After, _dec(15))
      th.assertIsApproximatelyEqual(alice_Debt_Before, alice_Debt_After, _dec(15))
      th.assertIsApproximatelyEqual(bob_Debt_Before, bob_Debt_After, _dec(15))
      th.assertIsApproximatelyEqual(carol_Debt_Before, carol_Debt_After, _dec(15))

      th.assertIsApproximatelyEqual(whale_Coll_Before, whale_Coll_After, _dec(14))
      th.assertIsApproximatelyEqual(alice_Coll_Before, alice_Coll_After, _dec(14))
      th.assertIsApproximatelyEqual(bob_Coll_Before, bob_Coll_After, _dec(14))
      th.assertIsApproximatelyEqual(carol_Coll_Before, carol_Coll_After, _dec(14))

      // th.assertIsApproximatelyEqual(whale_ICR_Before, whale_ICR_After, _dec(14))
      // th.assertIsApproximatelyEqual(alice_ICR_Before, alice_ICR_After, _dec(14))
      // th.assertIsApproximatelyEqual(bob_ICR_Before, bob_ICR_After, _dec(14))
      // th.assertIsApproximatelyEqual(carol_ICR_Before, carol_ICR_After, _dec(14))
    })

    it("withdrawFromSP(): succeeds when amount is 0 and system has an undercollateralized trove", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(100, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerA,
        extraParams: {
          from: A
        }
      })

      await stabilityPool.connect(signerA).provideToSP(dec(100, 18), frontEnd_1, {
        from: A
      })

      const A_initialDeposit = ((await stabilityPool.deposits(A))[0]).toString()
      assert.equal(A_initialDeposit, dec(100, 18))

      // defaulters opens trove
      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_1,
        extraParams: {
          from: defaulter_1
        }
      })
      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_2,
        extraParams: {
          from: defaulter_2
        }
      })

      // ETH drops, defaulters are in liquidation range
      await priceFeed.setPrice(dec(105, 18))
      const price = toBN(await priceFeed.getPrice())
      assert.isTrue(await th.ICRbetween100and110(defaulter_1, troveManager, price))

      await th.fastForwardTime(timeValues.MINUTES_IN_ONE_WEEK, web3.currentProvider)

      // Liquidate d1
      await troveManager.liquidate(defaulter_1)
      assert.isFalse(await sortedTroves.contains(defaulter_1))

      // Check d2 is undercollateralized
      assert.isTrue(await th.ICRbetween100and110(defaulter_2, troveManager, price))
      assert.isTrue(await sortedTroves.contains(defaulter_2))

      const A_ETHBalBefore = toBN(await web3.eth.getBalance(A))

      // Check Alice has gains to withdraw
      const A_pendingETHGain = (await stabilityPool.getDepositorCollateralGain(A))[1][0]
      assert.isTrue(A_pendingETHGain.gt(toBN('0')))

      // Check withdrawal of 0 succeeds
      const tx = await stabilityPool.connect(signerA).withdrawFromSP(0, {
        from: A,
        gasPrice: 0
      })
      const txRes = await tx.wait()
      assert.isTrue(txRes.status === 1)

      const A_ETHBalAfter = toBN(await web3.eth.getBalance(A))

      // Check A's ETH balances have increased correctly
      assert.isTrue(A_ETHBalAfter.sub(A_ETHBalBefore).eq(A_pendingETHGain))
    })

    it("withdrawFromSP(): withdrawing 0 USDE doesn't alter the caller's deposit or the total USDE in the Stability Pool", async () => {
      // --- SETUP ---
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Bob,
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Carol,
        extraParams: {
          from: carol
        }
      })

      // A, B, C provides 100, 50, 30 USDE to SP
      await stabilityPool.connect(Alice).provideToSP(dec(100, 18), frontEnd_1, {
        from: alice
      })
      await stabilityPool.connect(Bob).provideToSP(dec(50, 18), frontEnd_1, {
        from: bob
      })
      await stabilityPool.connect(Carol).provideToSP(dec(30, 18), frontEnd_1, {
        from: carol
      })

      const bob_Deposit_Before = (await stabilityPool.getCompoundedUSDEDeposit(bob)).toString()
      const USDEinSP_Before = (await stabilityPool.getTotalUSDEDeposits()).toString()

      assert.equal(USDEinSP_Before, dec(180, 18))

      // Bob withdraws 0 USDE from the Stability Pool
      await stabilityPool.connect(Bob).withdrawFromSP(0, {
        from: bob
      })

      // check Bob's deposit and total USDE in Stability Pool has not changed
      const bob_Deposit_After = (await stabilityPool.getCompoundedUSDEDeposit(bob)).toString()
      const USDEinSP_After = (await stabilityPool.getTotalUSDEDeposits()).toString()

      assert.equal(bob_Deposit_Before, bob_Deposit_After)
      assert.equal(USDEinSP_Before, USDEinSP_After)
    })

    it("withdrawFromSP(): withdrawing 0 ETH Gain does not alter the caller's ETH balance, their trove collateral, or the ETH  in the Stability Pool", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Bob,
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Carol,
        extraParams: {
          from: carol
        }
      })

      // Would-be defaulter open trove
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_1,
        extraParams: {
          from: defaulter_1
        }
      })

      // Price drops
      await priceFeed.setPrice(dec(105, 18))

      assert.isFalse(await th.checkRecoveryMode(contracts))

      // Defaulter 1 liquidated, full offset
      await troveManager.liquidate(defaulter_1)

      // Dennis opens trove and deposits to Stability Pool
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Dennis,
        extraParams: {
          from: dennis
        }
      })
      await stabilityPool.connect(Dennis).provideToSP(dec(100, 18), frontEnd_1, {
        from: dennis
      })

      // Check Dennis has 0 ETHGain
      const dennis_ETHGain = ((await stabilityPool.getDepositorCollateralGain(dennis))[1][0]).toString()
      assert.equal(dennis_ETHGain, '0')

      const dennis_ETHBalance_Before = (await weth.balanceOf(dennis)).toString()
      const dennis_Collateral_Before = ((await troveManager.getTroveColls(dennis))[0][0]).toString()
      const ETHinSP_Before = (await stabilityPool.getCollateralAmount(weth.address)).toString()

      await priceFeed.setPrice(dec(200, 18))

      // Dennis withdraws his full deposit and ETHGain to his account
      await stabilityPool.connect(Dennis).withdrawFromSP(dec(100, 18), {
        from: dennis
      })

      // Check withdrawal does not alter Dennis' ETH balance or his trove's collateral
      const dennis_ETHBalance_After = (await weth.balanceOf(dennis)).toString()
      const dennis_Collateral_After = ((await troveManager.getTroveColls(dennis))[0][0]).toString()
      const ETHinSP_After = (await stabilityPool.getCollateralAmount(weth.address)).toString()

      assert.equal(dennis_ETHBalance_Before, dennis_ETHBalance_After)
      assert.equal(dennis_Collateral_Before, dennis_Collateral_After)

      // Check withdrawal has not altered the ETH in the Stability Pool
      assert.equal(ETHinSP_Before, ETHinSP_After)
    })

    it("withdrawFromSP(): Request to withdraw > caller's deposit only withdraws the caller's compounded deposit", async () => {
      // --- SETUP ---
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Bob,
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Carol,
        extraParams: {
          from: carol
        }
      })

      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_1,
        extraParams: {
          from: defaulter_1
        }
      })

      // A, B, C provide USDE to SP
      await stabilityPool.connect(Alice).provideToSP(dec(10000, 18), frontEnd_1, {
        from: alice
      })
      await stabilityPool.connect(Bob).provideToSP(dec(20000, 18), frontEnd_1, {
        from: bob
      })
      await stabilityPool.connect(Carol).provideToSP(dec(30000, 18), frontEnd_1, {
        from: carol
      })

      // Price drops
      await priceFeed.setPrice(dec(105, 18))

      // Liquidate defaulter 1
      await troveManager.liquidate(defaulter_1)

      const alice_USDE_Balance_Before = await usdeToken.balanceOf(alice)
      const bob_USDE_Balance_Before = await usdeToken.balanceOf(bob)

      const alice_Deposit_Before = await stabilityPool.getCompoundedUSDEDeposit(alice)
      const bob_Deposit_Before = await stabilityPool.getCompoundedUSDEDeposit(bob)

      const USDEinSP_Before = await stabilityPool.getTotalUSDEDeposits()

      await priceFeed.setPrice(dec(200, 18))

      // Bob attempts to withdraws 1 wei more than his compounded deposit from the Stability Pool
      await stabilityPool.connect(Bob).withdrawFromSP(bob_Deposit_Before.add(toBN(1)), {
        from: bob
      })

      // Check Bob's USDE balance has risen by only the value of his compounded deposit
      const bob_expectedUSDEBalance = (bob_USDE_Balance_Before.add(bob_Deposit_Before)).toString()
      const bob_USDE_Balance_After = (await usdeToken.balanceOf(bob)).toString()
      assert.equal(bob_USDE_Balance_After, bob_expectedUSDEBalance)

      // Alice attempts to withdraws 2309842309.000000000000000000 USDE from the Stability Pool
      await stabilityPool.connect(Alice).withdrawFromSP('2309842309000000000000000000', {
        from: alice
      })

      // Check Alice's USDE balance has risen by only the value of her compounded deposit
      const alice_expectedUSDEBalance = (alice_USDE_Balance_Before.add(alice_Deposit_Before)).toString()
      const alice_USDE_Balance_After = (await usdeToken.balanceOf(alice)).toString()
      assert.equal(alice_USDE_Balance_After, alice_expectedUSDEBalance)

      // Check USDE in Stability Pool has been reduced by only Alice's compounded deposit and Bob's compounded deposit
      const expectedUSDEinSP = (USDEinSP_Before.sub(alice_Deposit_Before).sub(bob_Deposit_Before)).toString()
      const USDEinSP_After = (await stabilityPool.getTotalUSDEDeposits()).toString()
      assert.equal(USDEinSP_After, expectedUSDEinSP)
    })

    it("withdrawFromSP(): Request to withdraw 2^256-1 USDE only withdraws the caller's compounded deposit", async () => {
      // --- SETUP ---
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })

      // A, B, C open troves 
      // A, B, C open troves 
      // A, B, C open troves 
      // A, B, C open troves 
      // A, B, C open troves 
      // A, B, C open troves 
      // A, B, C open troves 
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Bob,
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Carol,
        extraParams: {
          from: carol
        }
      })

      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_1,
        extraParams: {
          from: defaulter_1
        }
      })

      // A, B, C provides 100, 50, 30 USDE to SP
      await stabilityPool.connect(Alice).provideToSP(dec(100, 18), frontEnd_1, {
        from: alice
      })
      await stabilityPool.connect(Bob).provideToSP(dec(50, 18), frontEnd_1, {
        from: bob
      })
      await stabilityPool.connect(Carol).provideToSP(dec(30, 18), frontEnd_1, {
        from: carol
      })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      // Liquidate defaulter 1
      await troveManager.liquidate(defaulter_1)

      const bob_USDE_Balance_Before = await usdeToken.balanceOf(bob)

      const bob_Deposit_Before = await stabilityPool.getCompoundedUSDEDeposit(bob)

      const USDEinSP_Before = await stabilityPool.getTotalUSDEDeposits()

      const maxBytes32 = toBN("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")

      // Price drops
      await priceFeed.setPrice(dec(200, 18))

      // Bob attempts to withdraws maxBytes32 USDE from the Stability Pool
      await stabilityPool.connect(Bob).withdrawFromSP(maxBytes32, {
        from: bob
      })

      // Check Bob's USDE balance has risen by only the value of his compounded deposit
      const bob_expectedUSDEBalance = (bob_USDE_Balance_Before.add(bob_Deposit_Before)).toString()
      const bob_USDE_Balance_After = (await usdeToken.balanceOf(bob)).toString()
      assert.equal(bob_USDE_Balance_After, bob_expectedUSDEBalance)

      // Check USDE in Stability Pool has been reduced by only  Bob's compounded deposit
      const expectedUSDEinSP = (USDEinSP_Before.sub(bob_Deposit_Before)).toString()
      const USDEinSP_After = (await stabilityPool.getTotalUSDEDeposits()).toString()
      assert.equal(USDEinSP_After, expectedUSDEinSP)
    })

    it("withdrawFromSP(): caller can withdraw full deposit and ETH gain during Recovery Mode", async () => {
      // --- SETUP ---
      // Price doubles
      await priceFeed.setPrice(dec(400, 18))
      await openTrove({
        extraUSDEAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })
      // Price halves
      await priceFeed.setPrice(dec(200, 18))

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(4, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(4, 18)),
        signer: Bob,
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(4, 18)),
        signer: Carol,
        extraParams: {
          from: carol
        }
      })

      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(100, 'ether')
      })

      // A, B, C provides 10000, 5000, 3000 USDE to SP
      await stabilityPool.connect(Alice).provideToSP(dec(10000, 18), frontEnd_1, {
        from: alice
      })
      await stabilityPool.connect(Bob).provideToSP(dec(5000, 18), frontEnd_1, {
        from: bob
      })
      await stabilityPool.connect(Carol).provideToSP(dec(3000, 18), frontEnd_1, {
        from: carol
      })

      // Price drops
      await priceFeed.setPrice(dec(105, 18))
      const price = toBN(await priceFeed.getPrice())

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Liquidate defaulter 1
      await troveManager.liquidate(defaulter_1)
      assert.isFalse(await sortedTroves.contains(defaulter_1))

      const alice_USDE_Balance_Before = await usdeToken.balanceOf(alice)
      const bob_USDE_Balance_Before = await usdeToken.balanceOf(bob)
      const carol_USDE_Balance_Before = await usdeToken.balanceOf(carol)

      const alice_ETH_Balance_Before = toBN(await web3.eth.getBalance(alice))
      const bob_ETH_Balance_Before = toBN(await web3.eth.getBalance(bob))
      const carol_ETH_Balance_Before = toBN(await web3.eth.getBalance(carol))

      const alice_Deposit_Before = await stabilityPool.getCompoundedUSDEDeposit(alice)
      const bob_Deposit_Before = await stabilityPool.getCompoundedUSDEDeposit(bob)
      const carol_Deposit_Before = await stabilityPool.getCompoundedUSDEDeposit(carol)

      const alice_ETHGain_Before = (await stabilityPool.getDepositorCollateralGain(alice))[1][0]
      const bob_ETHGain_Before = (await stabilityPool.getDepositorCollateralGain(bob))[1][0]
      const carol_ETHGain_Before = (await stabilityPool.getDepositorCollateralGain(carol))[1][0]

      const USDEinSP_Before = await stabilityPool.getTotalUSDEDeposits()

      // Price rises
      await priceFeed.setPrice(dec(222, 18))

      assert.isFalse(await th.checkRecoveryMode(contracts))

      // A, B, C withdraw their full deposits from the Stability Pool
      await stabilityPool.connect(Alice).withdrawFromSP(dec(10000, 18), {
        from: alice,
        gasPrice: 0
      })
      await stabilityPool.connect(Bob).withdrawFromSP(dec(5000, 18), {
        from: bob,
        gasPrice: 0
      })
      await stabilityPool.connect(Carol).withdrawFromSP(dec(3000, 18), {
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

    it("getDepositorETHGain(): depositor does not earn further ETH gains from liquidations while their compounded deposit == 0: ", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(1, 24)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })

      // A, B, C open troves
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Alice,
        extraParams: {
          from: alice
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Bob,
        extraParams: {
          from: bob
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Carol,
        extraParams: {
          from: carol
        }
      })

      // defaulters open troves 
      await openTrove({
        extraUSDEAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_1,
        extraParams: {
          from: defaulter_1
        }
      })
      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_2,
        extraParams: {
          from: defaulter_2
        }
      })
      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_3,
        extraParams: {
          from: defaulter_3
        }
      })

      // A, B, provide 10000, 5000 USDE to SP
      await stabilityPool.connect(Alice).provideToSP(dec(10000, 18), frontEnd_1, {
        from: alice
      })
      await stabilityPool.connect(Bob).provideToSP(dec(5000, 18), frontEnd_1, {
        from: bob
      })

      //price drops
      await priceFeed.setPrice(dec(105, 18))

      // Liquidate defaulter 1. Empties the Pool
      await troveManager.liquidate(defaulter_1)
      assert.isFalse(await sortedTroves.contains(defaulter_1))

      const USDEinSP = (await stabilityPool.getTotalUSDEDeposits()).toString()
      assert.equal(USDEinSP, '0')

      // Check Stability deposits have been fully cancelled with debt, and are now all zero
      const alice_Deposit = (await stabilityPool.getCompoundedUSDEDeposit(alice)).toString()
      const bob_Deposit = (await stabilityPool.getCompoundedUSDEDeposit(bob)).toString()

      assert.equal(alice_Deposit, '0')
      assert.equal(bob_Deposit, '0')

      // Get ETH gain for A and B
      // if a user's deposit in the SP is 0, then getDepositorGains returns two length 0 arrays
      const alice_ETHGain_1 = ((await stabilityPool.getDepositorCollateralGain(alice))[1].length).toString()
      const bob_ETHGain_1 = ((await stabilityPool.getDepositorCollateralGain(bob))[1].length).toString()

      // Whale deposits 10000 USDE to Stability Pool
      await stabilityPool.connect(Whale).provideToSP(dec(1, 24), frontEnd_1, {
        from: whale
      })

      // Liquidation 2
      await troveManager.liquidate(defaulter_2)
      assert.isFalse(await sortedTroves.contains(defaulter_2))

      // Check Alice and Bob have not received ETH gain from liquidation 2 while their deposit was 0
      const alice_ETHGain_2 = ((await stabilityPool.getDepositorCollateralGain(alice))[1].length).toString()
      const bob_ETHGain_2 = ((await stabilityPool.getDepositorCollateralGain(bob))[1].length).toString()

      assert.equal(alice_ETHGain_1, alice_ETHGain_2)
      assert.equal(bob_ETHGain_1, bob_ETHGain_2)

      // Liquidation 3
      await troveManager.liquidate(defaulter_3)
      assert.isFalse(await sortedTroves.contains(defaulter_3))

      // Check Alice and Bob have not received ETH gain from liquidation 3 while their deposit was 0
      const alice_ETHGain_3 = ((await stabilityPool.getDepositorCollateralGain(alice))[1].length).toString()
      const bob_ETHGain_3 = ((await stabilityPool.getDepositorCollateralGain(bob))[1].length).toString()

      assert.equal(alice_ETHGain_1, alice_ETHGain_3)
      assert.equal(bob_ETHGain_1, bob_ETHGain_3)
    })

    // --- Gain functionality ---

    it("withdrawFromSP(), partial withdrawal: doesn't change the front end tag", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })

      // whale transfer to troves D and E
      await usdeToken.connect(Whale).transfer(D, dec(100, 18), {
        from: whale
      })
      await usdeToken.connect(Whale).transfer(E, dec(200, 18), {
        from: whale
      })

      // A, B, C open troves
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerA,
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerB,
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerC,
        extraParams: {
          from: C
        }
      })

      // A, B, C, D, E provide to SP
      await stabilityPool.connect(signerA).provideToSP(dec(10, 18), frontEnd_1, {
        from: A
      })
      await stabilityPool.connect(signerB).provideToSP(dec(20, 18), frontEnd_2, {
        from: B
      })
      await stabilityPool.connect(signerC).provideToSP(dec(30, 18), ZERO_ADDRESS, {
        from: C
      })
      await stabilityPool.connect(signerD).provideToSP(dec(40, 18), frontEnd_1, {
        from: D
      })
      await stabilityPool.connect(signerE).provideToSP(dec(50, 18), ZERO_ADDRESS, {
        from: E
      })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // A, B, C, D, E withdraw, from different front ends
      await stabilityPool.connect(signerA).withdrawFromSP(dec(5, 18), {
        from: A
      })
      await stabilityPool.connect(signerB).withdrawFromSP(dec(10, 18), {
        from: B
      })
      await stabilityPool.connect(signerC).withdrawFromSP(dec(15, 18), {
        from: C
      })
      await stabilityPool.connect(signerD).withdrawFromSP(dec(20, 18), {
        from: D
      })
      await stabilityPool.connect(signerE).withdrawFromSP(dec(25, 18), {
        from: E
      })

      const frontEndTag_A = (await stabilityPool.deposits(A))[1]
      const frontEndTag_B = (await stabilityPool.deposits(B))[1]
      const frontEndTag_C = (await stabilityPool.deposits(C))[1]
      const frontEndTag_D = (await stabilityPool.deposits(D))[1]
      const frontEndTag_E = (await stabilityPool.deposits(E))[1]

      // Check deposits are still tagged with their original front end
      assert.equal(frontEndTag_A, frontEnd_1)
      assert.equal(frontEndTag_B, frontEnd_2)
      assert.equal(frontEndTag_C, ZERO_ADDRESS)
      assert.equal(frontEndTag_D, frontEnd_1)
      assert.equal(frontEndTag_E, ZERO_ADDRESS)
    })

    it("withdrawFromSP(), partial withdrawal: tagged front end's stake decreases", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })

      // A, B, C, D, E, F open troves 
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerA,
        extraParams: {
          from: A
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerB,
        extraParams: {
          from: B
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerC,
        extraParams: {
          from: C
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerD,
        extraParams: {
          from: D
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerE,
        extraParams: {
          from: E
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerF,
        extraParams: {
          from: F
        }
      })

      // A, B, C, D, E, F provide to SP
      await stabilityPool.connect(signerA).provideToSP(dec(10, 18), frontEnd_1, {
        from: A
      })
      await stabilityPool.connect(signerB).provideToSP(dec(20, 18), frontEnd_2, {
        from: B
      })
      await stabilityPool.connect(signerC).provideToSP(dec(30, 18), frontEnd_3, {
        from: C
      })
      await stabilityPool.connect(signerD).provideToSP(dec(10, 18), frontEnd_1, {
        from: D
      })
      await stabilityPool.connect(signerE).provideToSP(dec(20, 18), frontEnd_2, {
        from: E
      })
      await stabilityPool.connect(signerF).provideToSP(dec(30, 18), frontEnd_3, {
        from: F
      })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // Get front ends' stake before
      const F1_Stake_Before = await stabilityPool.frontEndStakes(frontEnd_1)
      const F2_Stake_Before = await stabilityPool.frontEndStakes(frontEnd_2)
      const F3_Stake_Before = await stabilityPool.frontEndStakes(frontEnd_3)

      // A, B, C withdraw 
      await stabilityPool.connect(signerA).withdrawFromSP(dec(1, 18), {
        from: A
      })
      await stabilityPool.connect(signerB).withdrawFromSP(dec(2, 18), {
        from: B
      })
      await stabilityPool.connect(signerC).withdrawFromSP(dec(3, 18), {
        from: C
      })

      // Get front ends' stakes after
      const F1_Stake_After = await stabilityPool.frontEndStakes(frontEnd_1)
      const F2_Stake_After = await stabilityPool.frontEndStakes(frontEnd_2)
      const F3_Stake_After = await stabilityPool.frontEndStakes(frontEnd_3)

      // Check front ends' stakes have decreased
      assert.isTrue(F1_Stake_After.lt(F1_Stake_Before))
      assert.isTrue(F2_Stake_After.lt(F2_Stake_Before))
      assert.isTrue(F3_Stake_After.lt(F3_Stake_Before))
    })

    it("withdrawFromSP(), full withdrawal: rem`oves deposit's front end tag", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(100000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })

      // Whale transfers to A, B 
      await usdeToken.connect(Whale).transfer(A, dec(10000, 18), {
        from: whale
      })
      await usdeToken.connect(Whale).transfer(B, dec(20000, 18), {
        from: whale
      })

      //C, D open troves
      await openTrove({
        extraUSDEAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerC,
        extraParams: {
          from: C
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40000, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerD,
        extraParams: {
          from: D
        }
      })

      // A, B, C, D make their initial deposits
      await stabilityPool.connect(signerA).provideToSP(dec(10000, 18), frontEnd_1, {
        from: A
      })
      await stabilityPool.connect(signerB).provideToSP(dec(20000, 18), ZERO_ADDRESS, {
        from: B
      })
      await stabilityPool.connect(signerC).provideToSP(dec(30000, 18), frontEnd_2, {
        from: C
      })
      await stabilityPool.connect(signerD).provideToSP(dec(40000, 18), ZERO_ADDRESS, {
        from: D
      })

      // Check deposits are tagged with correct front end 
      const A_tagBefore = await getFrontEndTag(stabilityPool, A)
      const B_tagBefore = await getFrontEndTag(stabilityPool, B)
      const C_tagBefore = await getFrontEndTag(stabilityPool, C)
      const D_tagBefore = await getFrontEndTag(stabilityPool, D)

      assert.equal(A_tagBefore, frontEnd_1)
      assert.equal(B_tagBefore, ZERO_ADDRESS)
      assert.equal(C_tagBefore, frontEnd_2)
      assert.equal(D_tagBefore, ZERO_ADDRESS)

      // All depositors make full withdrawal
      await stabilityPool.connect(signerA).withdrawFromSP(dec(10000, 18), {
        from: A
      })
      await stabilityPool.connect(signerB).withdrawFromSP(dec(20000, 18), {
        from: B
      })
      await stabilityPool.connect(signerC).withdrawFromSP(dec(30000, 18), {
        from: C
      })
      await stabilityPool.connect(signerD).withdrawFromSP(dec(40000, 18), {
        from: D
      })

      // Check all deposits now have no front end tag
      const A_tagAfter = await getFrontEndTag(stabilityPool, A)
      const B_tagAfter = await getFrontEndTag(stabilityPool, B)
      const C_tagAfter = await getFrontEndTag(stabilityPool, C)
      const D_tagAfter = await getFrontEndTag(stabilityPool, D)

      assert.equal(A_tagAfter, ZERO_ADDRESS)
      assert.equal(B_tagAfter, ZERO_ADDRESS)
      assert.equal(C_tagAfter, ZERO_ADDRESS)
      assert.equal(D_tagAfter, ZERO_ADDRESS)
    })

    it("withdrawFromSP(), full withdrawal: zero's depositor's snapshots", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })

      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_1,
        extraParams: {
          from: defaulter_1
        }
      })

      //  SETUP: Execute a series of operations to make G, S > 0 and P < 1  

      // E opens trove and makes a deposit
      await openTrove({
        extraUSDEAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: signerE,
        extraParams: {
          from: E
        }
      })
      await stabilityPool.connect(signerE).provideToSP(dec(10000, 18), frontEnd_3, {
        from: E
      })

      // Fast-forward time and make a second deposit, to trigger reward and make G > 0
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
      await stabilityPool.connect(signerE).provideToSP(dec(10000, 18), frontEnd_3, {
        from: E
      })

      // perform a liquidation to make 0 < P < 1, and S > 0
      await priceFeed.setPrice(dec(105, 18))
      assert.isFalse(await th.checkRecoveryMode(contracts))

      await troveManager.liquidate(defaulter_1)

      const currentEpoch = await stabilityPool.currentEpoch()
      const currentScale = await stabilityPool.currentScale()

      const S_Before = await stabilityPool.epochToScaleToSum(contracts.weth.address, currentEpoch, currentScale)
      const P_Before = await stabilityPool.P()
      const G_Before = await stabilityPool.epochToScaleToG(currentEpoch, currentScale)
      // Confirm 0 < P < 1
      assert.isTrue(P_Before.gt(toBN('0')) && P_Before.lt(toBN(dec(1, 18))))
      // Confirm S, G are both > 0
      assert.isTrue(S_Before.gt(toBN('0')))
      assert.isTrue(G_Before.eq(toBN('0')))

      // --- TEST ---

      // Whale transfers to A, B
      await usdeToken.connect(Whale).transfer(A, dec(10000, 18), {
        from: whale
      })
      await usdeToken.connect(Whale).transfer(B, dec(20000, 18), {
        from: whale
      })

      await priceFeed.setPrice(dec(200, 18))

      // C, D open troves
      await openTrove({
        extraUSDEAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: signerC,
        extraParams: {
          from: C
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(40000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: signerD,
        extraParams: {
          from: D
        }
      })

      // A, B, C, D make their initial deposits
      await stabilityPool.connect(signerA).provideToSP(dec(10000, 18), frontEnd_1, {
        from: A
      })
      await stabilityPool.connect(signerB).provideToSP(dec(20000, 18), ZERO_ADDRESS, {
        from: B
      })
      await stabilityPool.connect(signerC).provideToSP(dec(30000, 18), frontEnd_2, {
        from: C
      })
      await stabilityPool.connect(signerD).provideToSP(dec(40000, 18), ZERO_ADDRESS, {
        from: D
      })

      // Check deposits snapshots are non-zero

      for (depositor of [A, B, C, D]) {
        const snapshot = await stabilityPool.depositSnapshots(depositor)

        const ZERO = toBN('0')
        // Check S,P, G snapshots are non-zero
        assert.equal((await stabilityPool.getDepositSnapshotS(depositor, contracts.weth.address)).toString(), S_Before) // S 
        assert.isTrue(snapshot.P.eq(P_Before)) // P 
        assert.isTrue(snapshot.G.eq(ZERO)) // GL increases a bit between each depositor op, so just check it is non-zero
        assert.equal(snapshot.scale, '0') // scale
        assert.equal(snapshot.epoch, '0') // epoch
      }

      // All depositors make full withdrawal
      await stabilityPool.connect(signerA).withdrawFromSP(dec(10000, 18), {
        from: A
      })
      await stabilityPool.connect(signerB).withdrawFromSP(dec(20000, 18), {
        from: B
      })
      await stabilityPool.connect(signerC).withdrawFromSP(dec(30000, 18), {
        from: C
      })
      await stabilityPool.connect(signerD).withdrawFromSP(dec(40000, 18), {
        from: D
      })

      // Check all depositors' snapshots have been zero'd
      for (depositor of [A, B, C, D]) {
        const snapshot = await stabilityPool.depositSnapshots(depositor)

        // Check S, P, G snapshots are now zero
        assert.equal((await stabilityPool.getDepositSnapshotS(depositor, contracts.weth.address)).toString(), '0') // S 
        assert.equal(snapshot.P.toString(), '0') // P 
        assert.equal(snapshot.G.toString(), '0') // G
        assert.equal(snapshot.scale, '0') // scale
        assert.equal(snapshot.epoch, '0') // epoch
      }
    })

    it("withdrawFromSP(), reverts when initial deposit value is 0", async () => {
      await openTrove({
        extraUSDEAmount: toBN(dec(100000, 18)),
        ICR: toBN(dec(10, 18)),
        signer: Whale,
        extraParams: {
          from: whale
        }
      })

      // A opens trove and join the Stability Pool
      await openTrove({
        extraUSDEAmount: toBN(dec(10100, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerA,
        extraParams: {
          from: A
        }
      })
      await stabilityPool.connect(signerA).provideToSP(dec(10000, 18), frontEnd_1, {
        from: A
      })

      await openTrove({
        ICR: toBN(dec(2, 18)),
        signer: Defaulter_1,
        extraParams: {
          from: defaulter_1
        }
      })

      //  SETUP: Execute a series of operations to trigger Gain and ETH rewards for depositor A

      // Fast-forward time and make a second deposit, to trigger Gain reward and make G > 0
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
      await stabilityPool.connect(signerA).provideToSP(dec(100, 18), frontEnd_1, {
        from: A
      })

      // perform a liquidation to make 0 < P < 1, and S > 0
      await priceFeed.setPrice(dec(105, 18))
      assert.isFalse(await th.checkRecoveryMode(contracts))

      await troveManager.liquidate(defaulter_1)
      assert.isFalse(await sortedTroves.contains(defaulter_1))

      await priceFeed.setPrice(dec(200, 18))

      // A successfully withraws deposit and all gains
      await stabilityPool.connect(signerA).withdrawFromSP(dec(10100, 18), {
        from: A
      })

      // Confirm A's recorded deposit is 0
      const A_deposit = (await stabilityPool.deposits(A))[0] // get initialValue property on deposit struct
      assert.equal(A_deposit, '0')

      // --- TEST ---
      // User must have a non-zero deposit
      const expectedRevertMessage = "NoDepositBefore"

      // Further withdrawal attempt from A
      const withdrawalPromise_A = stabilityPool.connect(signerA).withdrawFromSP(dec(10000, 18), {
        from: A
      })
      await th.assertRevert(withdrawalPromise_A, expectedRevertMessage)

      // Withdrawal attempt of a non-existent deposit, from C
      const withdrawalPromise_C = stabilityPool.connect(signerC).withdrawFromSP(dec(10000, 18), {
        from: C
      })
      await th.assertRevert(withdrawalPromise_C, expectedRevertMessage)
    })

    it("registerFrontEnd(): registers the front end and chosen kickback rate", async () => {
      const unregisteredFrontEnds = [A, B, C, D, E]
      for (const frontEnd of unregisteredFrontEnds) {
        assert.isFalse((await stabilityPool.frontEnds(frontEnd))[1]) // check inactive
        assert.equal((await stabilityPool.frontEnds(frontEnd))[0], '0') // check no chosen kickback rate
      }

      await stabilityPool.connect(signerA).registerFrontEnd(dec(1, 18), {
        from: A
      })
      await stabilityPool.connect(signerB).registerFrontEnd('897789897897897', {
        from: B
      })
      await stabilityPool.connect(signerC).registerFrontEnd('99990098', {
        from: C
      })
      await stabilityPool.connect(signerD).registerFrontEnd('37', {
        from: D
      })
      await stabilityPool.connect(signerE).registerFrontEnd('0', {
        from: E
      })

      // Check front ends are registered as active, and have correct kickback rates
      assert.isTrue((await stabilityPool.frontEnds(A))[1])
      assert.equal((await stabilityPool.frontEnds(A))[0], dec(1, 18))

      assert.isTrue((await stabilityPool.frontEnds(B))[1])
      assert.equal((await stabilityPool.frontEnds(B))[0], '897789897897897')

      assert.isTrue((await stabilityPool.frontEnds(C))[1])
      assert.equal((await stabilityPool.frontEnds(C))[0], '99990098')

      assert.isTrue((await stabilityPool.frontEnds(D))[1])
      assert.equal((await stabilityPool.frontEnds(D))[0], '37')

      assert.isTrue((await stabilityPool.frontEnds(E))[1])
      assert.equal((await stabilityPool.frontEnds(E))[0], '0')
    })

    it("registerFrontEnd(): reverts if the front end is already registered", async () => {

      await stabilityPool.connect(signerA).registerFrontEnd(dec(1, 18), {
        from: A
      })
      await stabilityPool.connect(signerB).registerFrontEnd('897789897897897', {
        from: B
      })
      await stabilityPool.connect(signerC).registerFrontEnd('99990098', {
        from: C
      })

      const _2ndAttempt_A = stabilityPool.connect(signerA).registerFrontEnd(dec(1, 18), {
        from: A
      })
      const _2ndAttempt_B = stabilityPool.connect(signerB).registerFrontEnd('897789897897897', {
        from: B
      })
      const _2ndAttempt_C = stabilityPool.connect(signerC).registerFrontEnd('99990098', {
        from: C
      })
      // must not already be a registered front end
      await th.assertRevert(_2ndAttempt_A, "AlreadyRegistered")
      await th.assertRevert(_2ndAttempt_B, "AlreadyRegistered")
      await th.assertRevert(_2ndAttempt_C, "AlreadyRegistered")
    })

    it("registerFrontEnd(): reverts if the kickback rate >1", async () => {

      const invalidKickbackTx_A = stabilityPool.connect(signerA).registerFrontEnd(dec(1, 19), {
        from: A
      })
      const invalidKickbackTx_B = stabilityPool.connect(signerA).registerFrontEnd('1000000000000000001', {
        from: A
      })
      const invalidKickbackTx_C = stabilityPool.connect(signerA).registerFrontEnd(dec(23423, 45), {
        from: A
      })
      const invalidKickbackTx_D = stabilityPool.connect(signerA).registerFrontEnd(maxBytes32, {
        from: A
      })
      // Kickback rate must be in range [0,1]
      await th.assertRevert(invalidKickbackTx_A, "BadKickbackRate")
      await th.assertRevert(invalidKickbackTx_B, "BadKickbackRate")
      await th.assertRevert(invalidKickbackTx_C, "BadKickbackRate")
      await th.assertRevert(invalidKickbackTx_D, "BadKickbackRate")
    })

    it("registerFrontEnd(): reverts if address has a non-zero deposit already", async () => {
      // C, D, E open troves 
      await openTrove({
        extraUSDEAmount: toBN(dec(10, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerC,
        extraParams: {
          from: C
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerD,
        extraParams: {
          from: D
        }
      })
      await openTrove({
        extraUSDEAmount: toBN(dec(10, 18)),
        ICR: toBN(dec(2, 18)),
        signer: signerE,
        extraParams: {
          from: E
        }
      })

      // C, E provides to SP
      await stabilityPool.connect(signerC).provideToSP(dec(10, 18), frontEnd_1, {
        from: C
      })
      await stabilityPool.connect(signerE).provideToSP(dec(10, 18), ZERO_ADDRESS, {
        from: E
      })

      const txPromise_C = stabilityPool.connect(signerC).registerFrontEnd(dec(1, 18), {
        from: C
      })
      const txPromise_E = stabilityPool.connect(signerE).registerFrontEnd(dec(1, 18), {
        from: E
      })
      // User must have no deposit
      await th.assertRevert(txPromise_C, "HadDeposit")
      await th.assertRevert(txPromise_E, "HadDeposit")

      // D, with no deposit, successfully registers a front end
      const txD = await stabilityPool.connect(signerD).registerFrontEnd(dec(1, 18), {
        from: D
      })
      const txDRes = await txD.wait()
      assert.isTrue(txDRes.status === 1)
    })

  })
})

contract('Reset chain state', async accounts => {})