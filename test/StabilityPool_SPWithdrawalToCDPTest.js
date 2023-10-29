const deploymentHelper = require("../utils/deploymentHelpersUpgrade.js")
const testHelpers = require("../utils/testHelpersUpgrade.js")
const {
  dec,
  toBN
} = testHelpers.TestHelper
const th = testHelpers.TestHelper

const _dec = (number) => toBN(dec(1, number))

contract('StabilityPool - Withdrawal of stability deposit - Reward calculations', async accounts => {

  const [owner,
    defaulter_1, defaulter_2, defaulter_3, defaulter_4,
    whale, alice, bob, carol, dennis, erin, flyn, graham, harriet,
    A, B, C, D, E, F
  ] = accounts
  let Owner,
    Defaulter_1, Defaulter_2, Defaulter_3, Defaulter_4, Defaulter_5,
    Whale, Alice, Bob, Carol, Dennis, Erin, Flyn, Graham, Harriet,
    signerA, signerB, signerC, signerD, signerE, signerF

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

  let gasPriceInWei

  const ZERO_ADDRESS = th.ZERO_ADDRESS

  const getOpenTroveUSDEAmount = async (totalDebt) => th.getOpenTroveUSDEAmount(contracts, totalDebt)

  describe("Stability Pool Withdrawal", async () => {

    before(async () => {
      gasPriceInWei = await web3.eth.getGasPrice()
    })

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
      const signers = await ethers.getSigners()
      Owner = signers[0]
      Defaulter_1 = signers[1]
      Defaulter_2 = signers[2]
      Defaulter_3 = signers[3]
      Defaulter_4 = signers[4]
      Whale = signers[5]
      Alice = signers[6]
      Bob = signers[7]
      Carol = signers[8]
      Dennis = signers[9]
      Erin = signers[10]
      Flyn = signers[11]
      Graham = signers[12]
      Harriet = signers[13]
      signerA = signers[14]
      signerB = signers[15]
      signerC = signers[16]
      signerD = signers[17]
      signerE = signers[18]
      signerF = signers[19]
    })

    // --- Compounding tests ---

    // --- withdrawCollateralGainToTrove() ---

    // --- Identical deposits, identical liquidation amounts---
    it("withdrawCollateralGainToTrove(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      // A, B, C open troves
      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Carol).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol,
        value: dec(10000, 'ether')
      })

      // Whale transfers 10k USDE to A, B and C who then deposit it to the SP
      const depositors = [Alice, Bob, Carol]
      for (const account of depositors) {
        await usdeToken.connect(Whale).transfer(account.address, dec(10000, 18), {
          from: whale
        })
        await stabilityPool.connect(account).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
          from: account.address
        })
      }

      // Defaulter opens trove with 200% ICR and 10k USDE net debt
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(100, 'ether')
      })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter liquidated
      await troveManager.liquidate(defaulter_1, {
        from: owner
      });

      // Check depositors' compounded deposit is 6666.66 USDE and ETH Gain is 33.16 ETH
      const txWA = await stabilityPool.connect(Alice).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice
      })
      const txWB = await stabilityPool.connect(Bob).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob
      })
      const txWC = await stabilityPool.connect(Carol).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol
      })
      const txA = await txWA.wait()
      const txB = await txWB.wait()
      const txC = await txWC.wait()

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'CollGainWithdrawn', '_collAmounts')[0].toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(alice)).div(_dec(11)).toString(), '66666666666'), 10000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(bob)).div(_dec(11)).toString(), '66666666666'), 10000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(carol)).div(_dec(11)).toString(), '66666666666'), 10000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '33166666666666666667'), _dec(14))
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '33166666666666666667'), _dec(14))
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '33166666666666666667'), _dec(14))
    })

    it("withdrawCollateralGainToTrove(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after two identical liquidations", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      // A, B, C open troves
      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Carol).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol,
        value: dec(10000, 'ether')
      })

      // Whale transfers 10k USDE to A, B and C who then deposit it to the SP
      const depositors = [Alice, Bob, Carol]
      for (const account of depositors) {
        await usdeToken.connect(Whale).transfer(account.address, dec(10000, 18), {
          from: whale
        })
        await stabilityPool.connect(account).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
          from: account.address
        })
      }

      // Defaulters open trove with 200% ICR
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_2).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_2, defaulter_2, ZERO_ADDRESS, {
        from: defaulter_2,
        value: dec(100, 'ether')
      })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Two defaulters liquidated
      await troveManager.liquidate(defaulter_1, {
        from: owner
      });
      await troveManager.liquidate(defaulter_2, {
        from: owner
      });

      // Check depositors' compounded deposit is 3333.33 USDE and ETH Gain is 66.33 ETH
      const txWA = await stabilityPool.connect(Alice).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice
      })
      const txWB = await stabilityPool.connect(Bob).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob
      })
      const txWC = await stabilityPool.connect(Carol).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol
      })
      const txA = await txWA.wait()
      const txB = await txWB.wait()
      const txC = await txWC.wait()
      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'CollGainWithdrawn', '_collAmounts')[0].toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(alice)).div(_dec(12)).toString(), '3333333333'), 10000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(bob)).div(_dec(12)).toString(), '3333333333'), 10000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(carol)).div(_dec(12)).toString(), '3333333333'), 10000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '66333333333333333333'), _dec(14))
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '66333333333333333333'), _dec(14))
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '66333333333333333333'), _dec(14))
    })

    it("withdrawCollateralGainToTrove():  Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after three identical liquidations", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      // A, B, C open troves
      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Carol).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol,
        value: dec(10000, 'ether')
      })

      // Whale transfers 10k USDE to A, B and C who then deposit it to the SP
      const depositors = [Alice, Bob, Carol]
      for (const account of depositors) {
        await usdeToken.connect(Whale).transfer(account.address, dec(10000, 18), {
          from: whale
        })
        await stabilityPool.connect(account).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
          from: account.address
        })
      }

      // Defaulters open trove with 200% ICR
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_2).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_2, defaulter_2, ZERO_ADDRESS, {
        from: defaulter_2,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_3).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_3, defaulter_3, ZERO_ADDRESS, {
        from: defaulter_3,
        value: dec(100, 'ether')
      })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await troveManager.liquidate(defaulter_1, {
        from: owner
      });
      await troveManager.liquidate(defaulter_2, {
        from: owner
      });
      await troveManager.liquidate(defaulter_3, {
        from: owner
      });

      // Check depositors' compounded deposit is 0 USDE and ETH Gain is 99.5 ETH
      const txWA = await stabilityPool.connect(Alice).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice
      })
      const txWB = await stabilityPool.connect(Bob).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob
      })
      const txWC = await stabilityPool.connect(Carol).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol
      })
      const txA = await txWA.wait()
      const txB = await txWB.wait()
      const txC = await txWC.wait()

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'CollGainWithdrawn', '_collAmounts')[0].toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(alice)).toString(), '0'), 10000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(bob)).toString(), '0'), 10000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(carol)).toString(), '0'), 10000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(99500, 15)), _dec(14))
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(99500, 15)), _dec(14))
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(99500, 15)), _dec(14))
    })

    // --- Identical deposits, increasing liquidation amounts ---
    it("withdrawCollateralGainToTrove(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after two liquidations of increasing USDE", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      // A, B, C open troves
      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Carol).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol,
        value: dec(10000, 'ether')
      })

      // Whale transfers 10k USDE to A, B and C who then deposit it to the SP
      const depositors = [Alice, Bob, Carol]
      for (const account of depositors) {
        await usdeToken.connect(Whale).transfer(account.address, dec(10000, 18), {
          from: whale
        })
        await stabilityPool.connect(account).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
          from: account.address
        })
      }

      // Defaulters open trove with 200% ICR
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(5000, 18)), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: '50000000000000000000'
      })
      await borrowerOperations.connect(Defaulter_2).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(7000, 18)), defaulter_2, defaulter_2, ZERO_ADDRESS, {
        from: defaulter_2,
        value: '70000000000000000000'
      })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulters liquidated
      await troveManager.liquidate(defaulter_1, {
        from: owner
      });
      await troveManager.liquidate(defaulter_2, {
        from: owner
      });

      // Check depositors' compounded deposit
      const txWA = await stabilityPool.connect(Alice).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice
      })
      const txWB = await stabilityPool.connect(Bob).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob
      })
      const txWC = await stabilityPool.connect(Carol).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol
      })
      const txA = await txWA.wait()
      const txB = await txWB.wait()
      const txC = await txWC.wait()

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'CollGainWithdrawn', '_collAmounts')[0].toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(alice)).div(_dec(11)).toString(), '60000000000'), 10000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(bob)).div(_dec(11)).toString(), '60000000000'), 10000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(carol)).div(_dec(11)).toString(), '60000000000'), 10000)

      // (0.5 + 0.7) * 99.5 / 3
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(398, 17)), _dec(14))
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(398, 17)), _dec(14))
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(398, 17)), _dec(14))
    })

    it("withdrawCollateralGainToTrove(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after three liquidations of increasing USDE", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      // A, B, C open troves
      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Carol).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol,
        value: dec(10000, 'ether')
      })

      // Whale transfers 10k USDE to A, B and C who then deposit it to the SP
      const depositors = [Alice, Bob, Carol]
      for (const account of depositors) {
        await usdeToken.connect(Whale).transfer(account.address, dec(10000, 18), {
          from: whale
        })
        await stabilityPool.connect(account).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
          from: account.address
        })
      }

      // Defaulters open trove with 200% ICR
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(5000, 18)), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: '50000000000000000000'
      })
      await borrowerOperations.connect(Defaulter_2).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(6000, 18)), defaulter_2, defaulter_2, ZERO_ADDRESS, {
        from: defaulter_2,
        value: '60000000000000000000'
      })
      await borrowerOperations.connect(Defaulter_3).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(7000, 18)), defaulter_3, defaulter_3, ZERO_ADDRESS, {
        from: defaulter_3,
        value: '70000000000000000000'
      })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await troveManager.liquidate(defaulter_1, {
        from: owner
      });
      await troveManager.liquidate(defaulter_2, {
        from: owner
      });
      await troveManager.liquidate(defaulter_3, {
        from: owner
      });

      // Check depositors' compounded deposit
      const txWA = await stabilityPool.connect(Alice).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice
      })
      const txWB = await stabilityPool.connect(Bob).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob
      })
      const txWC = await stabilityPool.connect(Carol).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol
      })
      const txA = await txWA.wait()
      const txB = await txWB.wait()
      const txC = await txWC.wait()

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'CollGainWithdrawn', '_collAmounts')[0].toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(alice)).div(_dec(12)).toString(), '4000000000'), 10000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(bob)).div(_dec(12)).toString(), '4000000000'), 10000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(carol)).div(_dec(12)).toString(), '4000000000'), 10000)

      // (0.5 + 0.6 + 0.7) * 99.5 / 3
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(597, 17)), _dec(14))
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(597, 17)), _dec(14))
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(597, 17)), _dec(14))
    })

    // --- Increasing deposits, identical liquidation amounts ---
    it("withdrawCollateralGainToTrove(): Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after two identical liquidations", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      // A, B, C open troves
      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Carol).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol,
        value: dec(10000, 'ether')
      })

      // Whale transfers 10k, 20k, 30k USDE to A, B and C respectively who then deposit it to the SP
      await usdeToken.connect(Whale).transfer(alice, dec(10000, 18), {
        from: whale
      })
      await stabilityPool.connect(Alice).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
        from: alice
      })
      await usdeToken.connect(Whale).transfer(bob, dec(20000, 18), {
        from: whale
      })
      await stabilityPool.connect(Bob).provideToSP(dec(20000, 18), ZERO_ADDRESS, {
        from: bob
      })
      await usdeToken.connect(Whale).transfer(carol, dec(30000, 18), {
        from: whale
      })
      await stabilityPool.connect(Carol).provideToSP(dec(30000, 18), ZERO_ADDRESS, {
        from: carol
      })

      // 2 Defaulters open trove with 200% ICR
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_2).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_2, defaulter_2, ZERO_ADDRESS, {
        from: defaulter_2,
        value: dec(100, 'ether')
      })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await troveManager.liquidate(defaulter_1, {
        from: owner
      });
      await troveManager.liquidate(defaulter_2, {
        from: owner
      });

      // Depositors attempt to withdraw everything
      const txWA = await stabilityPool.connect(Alice).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice
      })
      const txWB = await stabilityPool.connect(Bob).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob
      })
      const txWC = await stabilityPool.connect(Carol).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol
      })
      const txA = await txWA.wait()
      const txB = await txWB.wait()
      const txC = await txWC.wait()

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(alice)).div(_dec(10)).toString(), '666666666666'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(bob)).div(_dec(11)).toString(), '133333333333'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(carol)).div(_dec(11)).toString(), '200000000000'), 100000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '33166666666666666667'), _dec(14))
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '66333333333333333333'), _dec(14))
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(995, 17)), _dec(14))
    })

    it("withdrawCollateralGainToTrove(): Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after three identical liquidations", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      // A, B, C open troves
      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Carol).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol,
        value: dec(10000, 'ether')
      })

      // Whale transfers 10k, 20k, 30k USDE to A, B and C respectively who then deposit it to the SP
      await usdeToken.connect(Whale).transfer(alice, dec(10000, 18), {
        from: whale
      })
      await stabilityPool.connect(Alice).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
        from: alice
      })
      await usdeToken.connect(Whale).transfer(bob, dec(20000, 18), {
        from: whale
      })
      await stabilityPool.connect(Bob).provideToSP(dec(20000, 18), ZERO_ADDRESS, {
        from: bob
      })
      await usdeToken.connect(Whale).transfer(carol, dec(30000, 18), {
        from: whale
      })
      await stabilityPool.connect(Carol).provideToSP(dec(30000, 18), ZERO_ADDRESS, {
        from: carol
      })

      // Defaulters open trove with 200% ICR
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_2).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_2, defaulter_2, ZERO_ADDRESS, {
        from: defaulter_2,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_3).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_3, defaulter_3, ZERO_ADDRESS, {
        from: defaulter_3,
        value: dec(100, 'ether')
      })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await troveManager.liquidate(defaulter_1, {
        from: owner
      });
      await troveManager.liquidate(defaulter_2, {
        from: owner
      });
      await troveManager.liquidate(defaulter_3, {
        from: owner
      });

      // Depositors attempt to withdraw everything
      const txWA = await stabilityPool.connect(Alice).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice
      })
      const txWB = await stabilityPool.connect(Bob).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob
      })
      const txWC = await stabilityPool.connect(Carol).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol
      })
      const txA = await txWA.wait()
      const txB = await txWB.wait()
      const txC = await txWC.wait()

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'CollGainWithdrawn', '_collAmounts')[0].toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(alice)).div(_dec(10)).toString(), '500000000000'), 1000000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(bob)).div(_dec(11)).toString(), '100000000000'), 1000000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(carol)).div(_dec(11)).toString(), '150000000000'), 1000000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '49750000000000000000'), _dec(14))
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 17)), _dec(14))
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '149250000000000000000'), _dec(14))
    })

    // --- Varied deposits and varied liquidation amount ---
    it("withdrawCollateralGainToTrove(): Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after three varying liquidations", async () => {
      // Whale opens Trove with 1m ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(1000000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(1000000, 'ether')
      })

      // A, B, C open troves
      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Carol).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol,
        value: dec(10000, 'ether')
      })

      /* Depositors provide:-
      Alice:  2000 USDE
      Bob:  456000 USDE
      Carol: 13100 USDE */
      // Whale transfers USDE to  A, B and C respectively who then deposit it to the SP
      await usdeToken.connect(Whale).transfer(alice, dec(2000, 18), {
        from: whale
      })
      await stabilityPool.connect(Alice).provideToSP(dec(2000, 18), ZERO_ADDRESS, {
        from: alice
      })
      await usdeToken.connect(Whale).transfer(bob, dec(456000, 18), {
        from: whale
      })
      await stabilityPool.connect(Bob).provideToSP(dec(456000, 18), ZERO_ADDRESS, {
        from: bob
      })
      await usdeToken.connect(Whale).transfer(carol, dec(13100, 18), {
        from: whale
      })
      await stabilityPool.connect(Carol).provideToSP(dec(13100, 18), ZERO_ADDRESS, {
        from: carol
      })

      /* Defaulters open troves
     
      Defaulter 1: 207000 USDE & 2160 ETH
      Defaulter 2: 5000 USDE & 50 ETH
      Defaulter 3: 46700 USDE & 500 ETH
      */
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount('207000000000000000000000'), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(2160, 18)
      })
      await borrowerOperations.connect(Defaulter_2).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(5, 21)), defaulter_2, defaulter_2, ZERO_ADDRESS, {
        from: defaulter_2,
        value: dec(50, 'ether')
      })
      await borrowerOperations.connect(Defaulter_3).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount('46700000000000000000000'), defaulter_3, defaulter_3, ZERO_ADDRESS, {
        from: defaulter_3,
        value: dec(500, 'ether')
      })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await troveManager.liquidate(defaulter_1, {
        from: owner
      });
      await troveManager.liquidate(defaulter_2, {
        from: owner
      });
      await troveManager.liquidate(defaulter_3, {
        from: owner
      });

      // Depositors attempt to withdraw everything
      const txWA = await stabilityPool.connect(Alice).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice
      })
      const txWB = await stabilityPool.connect(Bob).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob
      })
      const txWC = await stabilityPool.connect(Carol).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol
      })
      const txA = await txWA.wait()
      const txB = await txWB.wait()
      const txC = await txWC.wait()

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'CollGainWithdrawn', '_collAmounts')[0].toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(alice)).div(_dec(4)).toString(), '90171938017406100'), 100000000000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(bob)).div(_dec(18)).toString(), '205592'), 1)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(carol)).div(_dec(14)).toString(), '59062619'), 100)

      // 2710 * 0.995 * {2000, 456000, 13100}/4711
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '11447463383570366500'), _dec(14))
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '2610021651454043834000'), _dec(14))
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '74980885162385912900'), _dec(14))
    })

    // --- Deposit enters at t > 0

    it("withdrawCollateralGainToTrove(): A, B, C Deposit -> 2 liquidations -> D deposits -> 1 liquidation. All deposits and liquidations = 100 USDE.  A, B, C, D withdraw correct USDE deposit and ETH Gain", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      // A, B, C open troves
      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Carol).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Dennis).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: dennis,
        value: dec(10000, 'ether')
      })

      // Whale transfers 10k USDE to A, B and C who then deposit it to the SP
      const depositors = [Alice, Bob, Carol]
      for (const account of depositors) {
        await usdeToken.connect(Whale).transfer(account.address, dec(10000, 18), {
          from: whale
        })
        await stabilityPool.connect(account).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
          from: account.address
        })
      }

      // Defaulters open trove with 200% ICR
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_2).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_2, defaulter_2, ZERO_ADDRESS, {
        from: defaulter_2,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_3).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_3, defaulter_3, ZERO_ADDRESS, {
        from: defaulter_3,
        value: dec(100, 'ether')
      })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await troveManager.liquidate(defaulter_1, {
        from: owner
      });
      await troveManager.liquidate(defaulter_2, {
        from: owner
      });

      // Whale transfers 10k to Dennis who then provides to SP
      await usdeToken.connect(Whale).transfer(dennis, dec(10000, 18), {
        from: whale
      })
      await stabilityPool.connect(Dennis).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
        from: dennis
      })

      // Third defaulter liquidated
      await troveManager.liquidate(defaulter_3, {
        from: owner
      });

      const txWA = await stabilityPool.connect(Alice).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice
      })
      const txWB = await stabilityPool.connect(Bob).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob
      })
      const txWC = await stabilityPool.connect(Carol).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol
      })
      const txWD = await stabilityPool.connect(Dennis).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: dennis
      })
      const txA = await txWA.wait()
      const txB = await txWB.wait()
      const txC = await txWC.wait()
      const txD = await txWD.wait()

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const dennis_ETHWithdrawn = th.getEventArgByName(txD, 'CollGainWithdrawn', '_collAmounts')[0].toString()

      // console.log()
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(alice)).div(_dec(11)).toString(), '16666666666'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(bob)).div(_dec(11)).toString(), '16666666666'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(carol)).div(_dec(11)).toString(), '16666666666'), 100000)

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(dennis)).div(_dec(11)).toString(), '50000000000'), 100000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '82916666666666666667'), _dec(14))
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '82916666666666666667'), _dec(14))
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '82916666666666666667'), _dec(14))

      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '49750000000000000000'), _dec(14))
    })

    it("withdrawCollateralGainToTrove(): A, B, C Deposit -> 2 liquidations -> D deposits -> 2 liquidations. All deposits and liquidations = 100 USDE.  A, B, C, D withdraw correct USDE deposit and ETH Gain", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      // A, B, C open troves
      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Carol).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Dennis).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: dennis,
        value: dec(10000, 'ether')
      })

      // Whale transfers 10k USDE to A, B and C who then deposit it to the SP
      const depositors = [Alice, Bob, Carol]
      for (const account of depositors) {
        await usdeToken.connect(Whale).transfer(account.address, dec(10000, 18), {
          from: whale
        })
        await stabilityPool.connect(account).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
          from: account.address
        })
      }

      // Defaulters open trove with 200% ICR
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_2).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_2, defaulter_2, ZERO_ADDRESS, {
        from: defaulter_2,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_3).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_3, defaulter_3, ZERO_ADDRESS, {
        from: defaulter_3,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_4).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_4, defaulter_4, ZERO_ADDRESS, {
        from: defaulter_4,
        value: dec(100, 'ether')
      })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await troveManager.liquidate(defaulter_1, {
        from: owner
      });
      await troveManager.liquidate(defaulter_2, {
        from: owner
      });

      // Dennis opens a trove and provides to SP
      await usdeToken.connect(Whale).transfer(dennis, dec(10000, 18), {
        from: whale
      })
      await stabilityPool.connect(Dennis).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
        from: dennis
      })

      // Third and fourth defaulters liquidated
      await troveManager.liquidate(defaulter_3, {
        from: owner
      });
      await troveManager.liquidate(defaulter_4, {
        from: owner
      });

      const txWA = await stabilityPool.connect(Alice).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice
      })
      const txWB = await stabilityPool.connect(Bob).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob
      })
      const txWC = await stabilityPool.connect(Carol).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol
      })
      const txWD = await stabilityPool.connect(Dennis).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: dennis
      })
      const txA = await txWA.wait()
      const txB = await txWB.wait()
      const txC = await txWC.wait()
      const txD = await txWD.wait()

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const dennis_ETHWithdrawn = th.getEventArgByName(txD, 'CollGainWithdrawn', '_collAmounts')[0].toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(alice)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(bob)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(carol)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(dennis)).toString(), '0'), 100000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(995, 17)), _dec(14))
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 17)), _dec(14))
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(995, 17)), _dec(14))
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, dec(995, 17)), _dec(14))
    })

    it("withdrawCollateralGainToTrove(): A, B, C Deposit -> 2 liquidations -> D deposits -> 2 liquidations. Various deposit and liquidation vals.  A, B, C, D withdraw correct USDE deposit and ETH Gain", async () => {
      // Whale opens Trove with 1m ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(1000000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(1000000, 'ether')
      })

      // A, B, C, D open troves
      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Carol).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Dennis).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: dennis,
        value: dec(10000, 'ether')
      })

      /* Depositors open troves and make SP deposit:
      Alice: 60000 USDE
      Bob: 20000 USDE
      Carol: 15000 USDE
      */
      // Whale transfers USDE to  A, B and C respectively who then deposit it to the SP
      await usdeToken.connect(Whale).transfer(alice, dec(60000, 18), {
        from: whale
      })
      await stabilityPool.connect(Alice).provideToSP(dec(60000, 18), ZERO_ADDRESS, {
        from: alice
      })
      await usdeToken.connect(Whale).transfer(bob, dec(20000, 18), {
        from: whale
      })
      await stabilityPool.connect(Bob).provideToSP(dec(20000, 18), ZERO_ADDRESS, {
        from: bob
      })
      await usdeToken.connect(Whale).transfer(carol, dec(15000, 18), {
        from: whale
      })
      await stabilityPool.connect(Carol).provideToSP(dec(15000, 18), ZERO_ADDRESS, {
        from: carol
      })

      /* Defaulters open troves:
      Defaulter 1:  10000 USDE, 100 ETH
      Defaulter 2:  25000 USDE, 250 ETH
      Defaulter 3:  5000 USDE, 50 ETH
      Defaulter 4:  40000 USDE, 400 ETH
      */
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_2).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(25000, 18)), defaulter_2, defaulter_2, ZERO_ADDRESS, {
        from: defaulter_2,
        value: '250000000000000000000'
      })
      await borrowerOperations.connect(Defaulter_3).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(5000, 18)), defaulter_3, defaulter_3, ZERO_ADDRESS, {
        from: defaulter_3,
        value: '50000000000000000000'
      })
      await borrowerOperations.connect(Defaulter_4).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(40000, 18)), defaulter_4, defaulter_4, ZERO_ADDRESS, {
        from: defaulter_4,
        value: dec(400, 'ether')
      })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await troveManager.liquidate(defaulter_1, {
        from: owner
      });
      await troveManager.liquidate(defaulter_2, {
        from: owner
      });

      // Dennis provides 25000 USDE
      await usdeToken.connect(Whale).transfer(dennis, dec(25000, 18), {
        from: whale
      })
      await stabilityPool.connect(Dennis).provideToSP(dec(25000, 18), ZERO_ADDRESS, {
        from: dennis
      })

      // Last two defaulters liquidated
      await troveManager.liquidate(defaulter_3, {
        from: owner
      });
      await troveManager.liquidate(defaulter_4, {
        from: owner
      });

      // Each depositor withdraws as much as possible
      const txWA = await stabilityPool.connect(Alice).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice
      })
      const txWB = await stabilityPool.connect(Bob).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob
      })
      const txWC = await stabilityPool.connect(Carol).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol
      })
      const txWD = await stabilityPool.connect(Dennis).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: dennis
      })
      const txA = await txWA.wait()
      const txB = await txWB.wait()
      const txC = await txWC.wait()
      const txD = await txWD.wait()

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const dennis_ETHWithdrawn = th.getEventArgByName(txD, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(alice)).div(_dec(6)).toString(), '17832817337461300'), 100000000000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(bob)).div(_dec(6)).toString(), '5944272445820430'), 100000000000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(carol)).div(_dec(6)).toString(), '4458204334365320'), 100000000000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(dennis)).div(_dec(6)).toString(), '11764705882352900'), 100000000000)

      // 3.5*0.995 * {60000,20000,15000,0} / 95000 + 450*0.995 * {60000/950*{60000,20000,15000},25000} / (120000-35000)
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '419563467492260055900'), _dec(14))
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '139854489164086692700'), _dec(14))
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '104890866873065014000'), _dec(14))
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '131691176470588233700'), _dec(14))
    })

    // --- Depositor leaves ---

    it("withdrawCollateralGainToTrove(): A, B, C, D deposit -> 2 liquidations -> D withdraws -> 2 liquidations. All deposits and liquidations = 100 USDE.  A, B, C, D withdraw correct USDE deposit and ETH Gain", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      // A, B, C, D open troves
      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Carol).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Dennis).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: dennis,
        value: dec(10000, 'ether')
      })

      // Whale transfers 10k USDE to A, B and C who then deposit it to the SP
      const depositors = [Alice, Bob, Carol, Dennis]
      for (const account of depositors) {
        await usdeToken.connect(Whale).transfer(account.address, dec(10000, 18), {
          from: whale
        })
        await stabilityPool.connect(account).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
          from: account.address
        })
      }

      // Defaulters open trove with 200% ICR
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_2).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_2, defaulter_2, ZERO_ADDRESS, {
        from: defaulter_2,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_3).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_3, defaulter_3, ZERO_ADDRESS, {
        from: defaulter_3,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_4).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_4, defaulter_4, ZERO_ADDRESS, {
        from: defaulter_4,
        value: dec(100, 'ether')
      })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await troveManager.liquidate(defaulter_1, {
        from: owner
      });
      await troveManager.liquidate(defaulter_2, {
        from: owner
      });

      // Dennis withdraws his deposit and ETH gain
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txWD = await stabilityPool.connect(Dennis).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: dennis
      })
      const txD = await txWD.wait()
      await priceFeed.setPrice(dec(100, 18))

      const dennis_ETHWithdrawn = th.getEventArgByName(txD, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(dennis)).toString(), '5000000000000000000000'), _dec(16))
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '49750000000000000000'), _dec(14))

      // Two more defaulters are liquidated
      await troveManager.liquidate(defaulter_3, {
        from: owner
      });
      await troveManager.liquidate(defaulter_4, {
        from: owner
      });

      const txWA = await stabilityPool.connect(Alice).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice
      })
      const txWB = await stabilityPool.connect(Bob).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob
      })
      const txWC = await stabilityPool.connect(Carol).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol
      })
      const txA = await txWA.wait()
      const txB = await txWB.wait()
      const txC = await txWC.wait()

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'CollGainWithdrawn', '_collAmounts')[0].toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(alice)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(bob)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(carol)).toString(), '0'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(995, 17)), _dec(14))
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 17)), _dec(14))
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(995, 17)), _dec(14))
    })

    it("withdrawCollateralGainToTrove(): A, B, C, D deposit -> 2 liquidations -> D withdraws -> 2 liquidations. Various deposit and liquidation vals. A, B, C, D withdraw correct USDE deposit and ETH Gain", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      // A, B, C, D open troves
      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Carol).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol,
        value: dec(10000, 'ether')
      })

      /* Initial deposits:
      Alice: 20000 USDE
      Bob: 25000 USDE
      Carol: 12500 USDE
      Dennis: 40000 USDE
      */
      // Whale transfers USDE to  A, B,C and D respectively who then deposit it to the SP
      await usdeToken.connect(Whale).transfer(alice, dec(20000, 18), {
        from: whale
      })
      await stabilityPool.connect(Alice).provideToSP(dec(20000, 18), ZERO_ADDRESS, {
        from: alice
      })
      await usdeToken.connect(Whale).transfer(bob, dec(25000, 18), {
        from: whale
      })
      await stabilityPool.connect(Bob).provideToSP(dec(25000, 18), ZERO_ADDRESS, {
        from: bob
      })
      await usdeToken.connect(Whale).transfer(carol, dec(12500, 18), {
        from: whale
      })
      await stabilityPool.connect(Carol).provideToSP(dec(12500, 18), ZERO_ADDRESS, {
        from: carol
      })
      await usdeToken.connect(Whale).transfer(dennis, dec(40000, 18), {
        from: whale
      })
      await stabilityPool.connect(Dennis).provideToSP(dec(40000, 18), ZERO_ADDRESS, {
        from: dennis
      })

      /* Defaulters open troves:
      Defaulter 1: 10000 USDE
      Defaulter 2: 20000 USDE
      Defaulter 3: 30000 USDE
      Defaulter 4: 5000 USDE
      */
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_2).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(20000, 18)), defaulter_2, defaulter_2, ZERO_ADDRESS, {
        from: defaulter_2,
        value: dec(200, 'ether')
      })
      await borrowerOperations.connect(Defaulter_3).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(30000, 18)), defaulter_3, defaulter_3, ZERO_ADDRESS, {
        from: defaulter_3,
        value: dec(300, 'ether')
      })
      await borrowerOperations.connect(Defaulter_4).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(5000, 18)), defaulter_4, defaulter_4, ZERO_ADDRESS, {
        from: defaulter_4,
        value: '50000000000000000000'
      })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await troveManager.liquidate(defaulter_1, {
        from: owner
      });
      await troveManager.liquidate(defaulter_2, {
        from: owner
      });

      // Dennis withdraws his deposit and ETH gain
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txWD = await stabilityPool.connect(Dennis).withdrawFromSP(dec(40000, 18), {
        from: dennis
      })
      const txD = await txWD.wait()
      await priceFeed.setPrice(dec(100, 18))

      const dennis_ETHWithdrawn = th.getEventArgByName(txD, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      assert.isAtMost(th.getDifference((await usdeToken.balanceOf(dennis)).toString(), '27692307692307700000000'), _dec(16))
      // 300*0.995 * 40000/97500
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '122461538461538466100'), _dec(14))

      // Two more defaulters are liquidated
      await troveManager.liquidate(defaulter_3, {
        from: owner
      });
      await troveManager.liquidate(defaulter_4, {
        from: owner
      });

      const txWA = await stabilityPool.connect(Alice).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice
      })
      const txWB = await stabilityPool.connect(Bob).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob
      })
      const txWC = await stabilityPool.connect(Carol).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol
      })
      const txA = await txWA.wait()
      const txB = await txWB.wait()
      const txC = await txWC.wait()

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'CollGainWithdrawn', '_collAmounts')[0].toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(alice)).toString(), '1672240802675590000000'), _dec(16))
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(bob)).toString(), '2090301003344480000000'), _dec(16))
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(carol)).toString(), '1045150501672240000000'), _dec(16))

      // 300*0.995 * {20000,25000,12500}/97500 + 350*0.995 * {20000,25000,12500}/57500
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '182361204013377919900'), _dec(14))
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '227951505016722411000'), _dec(14))
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '113975752508361205500'), _dec(14))
    })

    // --- One deposit enters at t > 0, and another leaves later ---
    it("withdrawCollateralGainToTrove(): A, B, D deposit -> 2 liquidations -> C makes deposit -> 1 liquidation -> D withdraws -> 1 liquidation. All deposits: 100 USDE. Liquidations: 100,100,100,50.  A, B, C, D withdraw correct USDE deposit and ETH Gain", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      // A, B, C, D open troves
      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Carol).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol,
        value: dec(10000, 'ether')
      })

      // Whale transfers 10k USDE to A, B and D who then deposit it to the SP
      const depositors = [Alice, Bob, Dennis]
      for (const account of depositors) {
        await usdeToken.connect(Whale).transfer(account.address, dec(10000, 18), {
          from: whale
        })
        await stabilityPool.connect(account).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
          from: account.address
        })
      }

      // Defaulters open troves
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_2).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_2, defaulter_2, ZERO_ADDRESS, {
        from: defaulter_2,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_3).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_3, defaulter_3, ZERO_ADDRESS, {
        from: defaulter_3,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_4).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(5000, 18)), defaulter_4, defaulter_4, ZERO_ADDRESS, {
        from: defaulter_4,
        value: '50000000000000000000'
      })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await troveManager.liquidate(defaulter_1, {
        from: owner
      });
      await troveManager.liquidate(defaulter_2, {
        from: owner
      });

      // Carol makes deposit
      await usdeToken.connect(Whale).transfer(carol, dec(10000, 18), {
        from: whale
      })
      await stabilityPool.connect(Carol).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
        from: carol
      })

      await troveManager.liquidate(defaulter_3, {
        from: owner
      });

      // Dennis withdraws his deposit and ETH gain
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txWD = await stabilityPool.connect(Dennis).withdrawFromSP(dec(10000, 18), {
        from: dennis
      })
      const txD = await txWD.wait()
      await priceFeed.setPrice(dec(100, 18))

      const dennis_ETHWithdrawn = th.getEventArgByName(txD, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      assert.isAtMost(th.getDifference((await usdeToken.balanceOf(dennis)).toString(), '1666666666666666666666'), _dec(16))
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '82916666666666666667'), _dec(14))

      await troveManager.liquidate(defaulter_4, {
        from: owner
      });

      const txWA = await stabilityPool.connect(Alice).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice
      })
      const txWB = await stabilityPool.connect(Bob).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob
      })
      const txWC = await stabilityPool.connect(Carol).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol
      })
      const txA = await txWA.wait()
      const txB = await txWB.wait()
      const txC = await txWC.wait()

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'CollGainWithdrawn', '_collAmounts')[0].toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(alice)).toString(), '666666666666666666666'), _dec(16))
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(bob)).toString(), '666666666666666666666'), _dec(16))
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(carol)).toString(), '2000000000000000000000'), _dec(16))

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '92866666666666666667'), _dec(14))
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '92866666666666666667'), _dec(14))
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '79600000000000000000'), _dec(14))
    })

    // --- Tests for full offset - Pool empties to 0 ---

    // A, B deposit 10000
    // L1 cancels 20000, 200
    // C, D deposit 10000
    // L2 cancels 10000,100

    // A, B withdraw 0USDE & 100e
    // C, D withdraw 5000USDE  & 500e
    it("withdrawCollateralGainToTrove(): Depositor withdraws correct compounded deposit after liquidation empties the pool", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      // A, B, C, D open troves
      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Carol).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Dennis).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: dennis,
        value: dec(10000, 'ether')
      })

      // Whale transfers 10k USDE to A, B who then deposit it to the SP
      const depositors = [Alice, Bob]
      for (const account of depositors) {
        await usdeToken.connect(Whale).transfer(account.address, dec(10000, 18), {
          from: whale
        })
        await stabilityPool.connect(account).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
          from: account.address
        })
      }

      // 2 Defaulters open trove with 200% ICR
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(20000, 18)), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(200, 'ether')
      })
      await borrowerOperations.connect(Defaulter_2).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_2, defaulter_2, ZERO_ADDRESS, {
        from: defaulter_2,
        value: dec(100, 'ether')
      })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated. 20000 USDE fully offset with pool.
      await troveManager.liquidate(defaulter_1, {
        from: owner
      });

      // Carol, Dennis each deposit 10000 USDE
      const depositors_2 = [Carol, Dennis]
      for (const account of depositors_2) {
        await usdeToken.connect(Whale).transfer(account.address, dec(10000, 18), {
          from: whale
        })
        await stabilityPool.connect(account).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
          from: account.address
        })
      }

      // Defaulter 2 liquidated. 10000 USDE offset
      await troveManager.liquidate(defaulter_2, {
        from: owner
      });

      const txWA = await stabilityPool.connect(Alice).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice
      })
      const txWB = await stabilityPool.connect(Bob).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob
      })
      const txWC = await stabilityPool.connect(Carol).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol
      })
      const txWD = await stabilityPool.connect(Dennis).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: dennis
      })
      const txA = await txWA.wait()
      const txB = await txWB.wait()
      const txC = await txWC.wait()
      const txD = await txWD.wait()

      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const dennis_ETHWithdrawn = th.getEventArgByName(txD, 'CollGainWithdrawn', '_collAmounts')[0].toString()

      // Expect Alice And Bob's compounded deposit to be 0 USDE
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(alice)).toString(), '0'), 10000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(bob)).toString(), '0'), 10000)

      // Expect Alice and Bob's ETH Gain to be 100 ETH
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(995, 17)), _dec(14))
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 17)), _dec(14))

      // Expect Carol And Dennis' compounded deposit to be 50 USDE
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(carol)).toString(), '5000000000000000000000'), _dec(16))
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(dennis)).toString(), '5000000000000000000000'), _dec(16))

      // Expect Carol and and Dennis ETH Gain to be 50 ETH
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '49750000000000000000'), _dec(14))
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '49750000000000000000'), _dec(14))
    })

    // A, B deposit 10000
    // L1 cancels 10000, 1
    // L2 10000, 200 empties Pool
    // C, D deposit 10000
    // L3 cancels 10000, 1 
    // L2 20000, 200 empties Pool
    it("withdrawCollateralGainToTrove(): Pool-emptying liquidation increases epoch by one, resets scaleFactor to 0, and resets P to 1e18", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      // A, B, C, D open troves
      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Carol).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Dennis).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: dennis,
        value: dec(10000, 'ether')
      })

      // Whale transfers 10k USDE to A, B who then deposit it to the SP
      const depositors = [Alice, Bob]
      for (const account of depositors) {
        await usdeToken.connect(Whale).transfer(account.address, dec(10000, 18), {
          from: whale
        })
        await stabilityPool.connect(account).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
          from: account.address
        })
      }

      // 4 Defaulters open trove with 200% ICR
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_2).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_2, defaulter_2, ZERO_ADDRESS, {
        from: defaulter_2,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_3).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_3, defaulter_3, ZERO_ADDRESS, {
        from: defaulter_3,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_4).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_4, defaulter_4, ZERO_ADDRESS, {
        from: defaulter_4,
        value: dec(100, 'ether')
      })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      const epoch_0 = (await stabilityPool.currentEpoch()).toString()
      const scale_0 = (await stabilityPool.currentScale()).toString()
      const P_0 = (await stabilityPool.P()).toString()

      assert.equal(epoch_0, '0')
      assert.equal(scale_0, '0')
      assert.equal(P_0, dec(1, 18))

      // Defaulter 1 liquidated. 10--0 USDE fully offset, Pool remains non-zero
      await troveManager.liquidate(defaulter_1, {
        from: owner
      });

      //Check epoch, scale and sum
      const epoch_1 = (await stabilityPool.currentEpoch()).toString()
      const scale_1 = (await stabilityPool.currentScale()).toString()
      const P_1 = (await stabilityPool.P()).toString()

      assert.equal(epoch_1, '0')
      assert.equal(scale_1, '0')
      assert.isAtMost(th.getDifference(P_1, dec(5, 17)), _dec(12))

      // Defaulter 2 liquidated. 1--00 USDE, empties pool
      await troveManager.liquidate(defaulter_2, {
        from: owner
      });

      //Check epoch, scale and sum
      const epoch_2 = (await stabilityPool.currentEpoch()).toString()
      const scale_2 = (await stabilityPool.currentScale()).toString()
      const P_2 = (await stabilityPool.P()).toString()

      assert.equal(epoch_2, '1')
      assert.equal(scale_2, '0')
      assert.equal(P_2, dec(1, 18))

      // Carol, Dennis each deposit 10000 USDE
      const depositors_2 = [Carol, Dennis]
      for (const account of depositors_2) {
        await usdeToken.connect(Whale).transfer(account.address, dec(10000, 18), {
          from: whale
        })
        await stabilityPool.connect(account).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
          from: account.address
        })
      }

      // Defaulter 3 liquidated. 10000 USDE fully offset, Pool remains non-zero
      await troveManager.liquidate(defaulter_3, {
        from: owner
      });

      //Check epoch, scale and sum
      const epoch_3 = (await stabilityPool.currentEpoch()).toString()
      const scale_3 = (await stabilityPool.currentScale()).toString()
      const P_3 = (await stabilityPool.P()).toString()

      assert.equal(epoch_3, '1')
      assert.equal(scale_3, '0')
      assert.isAtMost(th.getDifference(P_3, dec(5, 17)), _dec(12))

      // Defaulter 4 liquidated. 10000 USDE, empties pool
      await troveManager.liquidate(defaulter_4, {
        from: owner
      });

      //Check epoch, scale and sum
      const epoch_4 = (await stabilityPool.currentEpoch()).toString()
      const scale_4 = (await stabilityPool.currentScale()).toString()
      const P_4 = (await stabilityPool.P()).toString()

      assert.equal(epoch_4, '2')
      assert.equal(scale_4, '0')
      assert.equal(P_4, dec(1, 18))
    })


    // A, B deposit 10000
    // L1 cancels 20000, 200
    // C, D, E deposit 10000, 20000, 30000
    // L2 cancels 10000,100 

    // A, B withdraw 0 USDE & 100e
    // C, D withdraw 5000 USDE  & 50e
    it("withdrawCollateralGainToTrove(): Depositors withdraw correct compounded deposit after liquidation empties the pool", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      // A, B, C, D open troves
      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Carol).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Dennis).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: dennis,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Erin).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: erin,
        value: dec(10000, 'ether')
      })

      // Whale transfers 10k USDE to A, B who then deposit it to the SP
      const depositors = [Alice, Bob]
      for (const account of depositors) {
        await usdeToken.connect(Whale).transfer(account.address, dec(10000, 18), {
          from: whale
        })
        await stabilityPool.connect(account).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
          from: account.address
        })
      }

      // 2 Defaulters open trove with 200% ICR
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(20000, 18)), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(200, 'ether')
      })
      await borrowerOperations.connect(Defaulter_2).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_2, defaulter_2, ZERO_ADDRESS, {
        from: defaulter_2,
        value: dec(100, 'ether')
      })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated. 20000 USDE fully offset with pool.
      await troveManager.liquidate(defaulter_1, {
        from: owner
      });

      // Carol, Dennis, Erin each deposit 10000, 20000, 30000 USDE respectively
      await usdeToken.connect(Whale).transfer(carol, dec(10000, 18), {
        from: whale
      })
      await stabilityPool.connect(Carol).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
        from: carol
      })

      await usdeToken.connect(Whale).transfer(dennis, dec(20000, 18), {
        from: whale
      })
      await stabilityPool.connect(Dennis).provideToSP(dec(20000, 18), ZERO_ADDRESS, {
        from: dennis
      })

      await usdeToken.connect(Whale).transfer(erin, dec(30000, 18), {
        from: whale
      })
      await stabilityPool.connect(Erin).provideToSP(dec(30000, 18), ZERO_ADDRESS, {
        from: erin
      })

      // Defaulter 2 liquidated. 10000 USDE offset
      await troveManager.liquidate(defaulter_2, {
        from: owner
      });

      const txWA = await stabilityPool.connect(Alice).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice
      })
      const txWB = await stabilityPool.connect(Bob).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob
      })
      const txWC = await stabilityPool.connect(Carol).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol
      })
      const txWD = await stabilityPool.connect(Dennis).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: dennis
      })
      const txWE = await stabilityPool.connect(Erin).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: erin
      })
      const txA = await txWA.wait()
      const txB = await txWB.wait()
      const txC = await txWC.wait()
      const txD = await txWD.wait()
      const txE = await txWE.wait()

      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const dennis_ETHWithdrawn = th.getEventArgByName(txD, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const erin_ETHWithdrawn = th.getEventArgByName(txE, 'CollGainWithdrawn', '_collAmounts')[0].toString()

      // Expect Alice And Bob's compounded deposit to be 0 USDE
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(alice)).toString(), '0'), 10000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(bob)).toString(), '0'), 10000)

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(carol)).toString(), '8333333333333333333333'), _dec(16))
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(dennis)).toString(), '16666666666666666666666'), _dec(16))
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(erin)).toString(), '25000000000000000000000'), _dec(16))

      //Expect Alice and Bob's ETH Gain to be 1 ETH
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(995, 17)), _dec(14))
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 17)), _dec(14))

      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '16583333333333333333'), _dec(14))
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '33166666666666666667'), _dec(14))
      assert.isAtMost(th.getDifference(erin_ETHWithdrawn, '49750000000000000000'), _dec(14))
    })

    // A deposits 10000
    // L1, L2, L3 liquidated with 10000 USDE each
    // A withdraws all
    // Expect A to withdraw 0 deposit and ether only from reward L1
    it("withdrawCollateralGainToTrove(): single deposit fully offset. After subsequent liquidations, depositor withdraws 0 deposit and *only* the ETH Gain from one liquidation", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      // A, B, C, D open troves
      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Carol).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Dennis).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: dennis,
        value: dec(10000, 'ether')
      })

      await usdeToken.connect(Whale).transfer(alice, dec(10000, 18), {
        from: whale
      })
      await stabilityPool.connect(Alice).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
        from: alice
      })

      // Defaulter 1,2,3 withdraw 10000 USDE
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_2).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_2, defaulter_2, ZERO_ADDRESS, {
        from: defaulter_2,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_3).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), defaulter_3, defaulter_3, ZERO_ADDRESS, {
        from: defaulter_3,
        value: dec(100, 'ether')
      })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1, 2  and 3 liquidated
      await troveManager.liquidate(defaulter_1, {
        from: owner
      });
      await troveManager.liquidate(defaulter_2, {
        from: owner
      });
      await troveManager.liquidate(defaulter_3, {
        from: owner
      });

      const txWA = await stabilityPool.connect(Alice).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice
      })
      const txA = await txWA.wait()

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'CollGainWithdrawn', '_collAmounts')[0].toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(alice)).toString(), 0), 100000)
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(995, 17)), _dec(14))
    })

    //--- Serial full offsets ---

    // A,B deposit 10000 USDE
    // L1 cancels 20000 USDE, 2E
    // B,C deposits 10000 USDE
    // L2 cancels 20000 USDE, 2E
    // E,F deposit 10000 USDE
    // L3 cancels 20000, 200E
    // G,H deposits 10000
    // L4 cancels 20000, 200E

    // Expect all depositors withdraw 0 USDE and 100 ETH

    it("withdrawCollateralGainToTrove(): Depositor withdraws correct compounded deposit after liquidation empties the pool", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      // A, B, C, D, E, F, G, H open troves
      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Carol).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Dennis).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: dennis,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Erin).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: erin,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Flyn).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: flyn,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Harriet).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: harriet,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Graham).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: graham,
        value: dec(10000, 'ether')
      })

      // 4 Defaulters open trove with 200% ICR
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(20000, 18)), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(200, 'ether')
      })
      await borrowerOperations.connect(Defaulter_2).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(20000, 18)), defaulter_2, defaulter_2, ZERO_ADDRESS, {
        from: defaulter_2,
        value: dec(200, 'ether')
      })
      await borrowerOperations.connect(Defaulter_3).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(20000, 18)), defaulter_3, defaulter_3, ZERO_ADDRESS, {
        from: defaulter_3,
        value: dec(200, 'ether')
      })
      await borrowerOperations.connect(Defaulter_4).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(20000, 18)), defaulter_4, defaulter_4, ZERO_ADDRESS, {
        from: defaulter_4,
        value: dec(200, 'ether')
      })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Alice, Bob each deposit 10k USDE
      const depositors_1 = [Alice, Bob]
      for (const account of depositors_1) {
        await usdeToken.connect(Whale).transfer(account.address, dec(10000, 18), {
          from: whale
        })
        await stabilityPool.connect(account).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
          from: account.address
        })
      }

      // Defaulter 1 liquidated. 20k USDE fully offset with pool.
      await troveManager.liquidate(defaulter_1, {
        from: owner
      });

      // Carol, Dennis each deposit 10000 USDE
      const depositors_2 = [Carol, Dennis]
      for (const account of depositors_2) {
        await usdeToken.connect(Whale).transfer(account.address, dec(10000, 18), {
          from: whale
        })
        await stabilityPool.connect(account).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
          from: account.address
        })
      }

      // Defaulter 2 liquidated. 10000 USDE offset
      await troveManager.liquidate(defaulter_2, {
        from: owner
      });

      // Erin, Flyn each deposit 10000 USDE
      const depositors_3 = [Erin, Flyn]
      for (const account of depositors_3) {
        await usdeToken.connect(Whale).transfer(account.address, dec(10000, 18), {
          from: whale
        })
        await stabilityPool.connect(account).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
          from: account.address
        })
      }

      // Defaulter 3 liquidated. 10000 USDE offset
      await troveManager.liquidate(defaulter_3, {
        from: owner
      });

      // Graham, Harriet each deposit 10000 USDE
      const depositors_4 = [Graham, Harriet]
      for (const account of depositors_4) {
        await usdeToken.connect(Whale).transfer(account.address, dec(10000, 18), {
          from: whale
        })
        await stabilityPool.connect(account).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
          from: account.address
        })
      }

      // Defaulter 4 liquidated. 10k USDE offset
      await troveManager.liquidate(defaulter_4, {
        from: owner
      });

      const txWA = await stabilityPool.connect(Alice).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice
      })
      const txWB = await stabilityPool.connect(Bob).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob
      })
      const txWC = await stabilityPool.connect(Carol).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol
      })
      const txWD = await stabilityPool.connect(Dennis).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: dennis
      })
      const txWE = await stabilityPool.connect(Erin).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: erin
      })
      const txWF = await stabilityPool.connect(Flyn).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: flyn
      })
      const txWG = await stabilityPool.connect(Graham).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: graham
      })
      const txWH = await stabilityPool.connect(Harriet).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: harriet
      })
      const txA = await txWA.wait()
      const txB = await txWB.wait()
      const txC = await txWC.wait()
      const txD = await txWD.wait()
      const txE = await txWE.wait()
      const txF = await txWF.wait()
      const txG = await txWG.wait()
      const txH = await txWH.wait()

      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const dennis_ETHWithdrawn = th.getEventArgByName(txD, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const erin_ETHWithdrawn = th.getEventArgByName(txE, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const flyn_ETHWithdrawn = th.getEventArgByName(txF, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const graham_ETHWithdrawn = th.getEventArgByName(txG, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const harriet_ETHWithdrawn = th.getEventArgByName(txH, 'CollGainWithdrawn', '_collAmounts')[0].toString()

      // Expect all deposits to be 0 USDE
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(alice)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(bob)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(carol)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(dennis)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(erin)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(flyn)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(graham)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(harriet)).toString(), '0'), 100000)

      /* Expect all ETH gains to be 100 ETH:  Since each liquidation of empties the pool, depositors
      should only earn ETH from the single liquidation that cancelled with their deposit */
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(995, 17)), _dec(14))
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 17)), _dec(14))
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(995, 17)), _dec(14))
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, dec(995, 17)), _dec(14))
      assert.isAtMost(th.getDifference(erin_ETHWithdrawn, dec(995, 17)), _dec(14))
      assert.isAtMost(th.getDifference(flyn_ETHWithdrawn, dec(995, 17)), _dec(14))
      assert.isAtMost(th.getDifference(graham_ETHWithdrawn, dec(995, 17)), _dec(14))
      assert.isAtMost(th.getDifference(harriet_ETHWithdrawn, dec(995, 17)), _dec(14))

      const finalEpoch = (await stabilityPool.currentEpoch()).toString()
      assert.equal(finalEpoch, 4)
    })

    // --- Scale factor tests ---

    // A deposits 10000
    // L1 brings P close to boundary, i.e. 9e-9: liquidate 9999.99991
    // A withdraws all
    // B deposits 10000
    // L2 of 9900 USDE, should bring P slightly past boundary i.e. 1e-9 -> 1e-10

    // expect d(B) = d0(B)/100
    // expect correct ETH gain, i.e. all of the reward
    it("withdrawCollateralGainToTrove(): deposit spans one scale factor change: Single depositor withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })

      await usdeToken.connect(Whale).transfer(alice, dec(10000, 18), {
        from: whale
      })
      await stabilityPool.connect(Alice).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
        from: alice
      })

      // Defaulter 1 withdraws 'almost' 10000 USDE:  9999.99991 USDE
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount('9999999990000000000000'), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(100, 'ether')
      })

      assert.equal(await stabilityPool.currentScale(), '0')

      // Defaulter 2 withdraws 9900 USDE
      await borrowerOperations.connect(Defaulter_2).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(9901, 18)), defaulter_2, defaulter_2, ZERO_ADDRESS, {
        from: defaulter_2,
        value: dec(60, 'ether')
      })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated.  Value of P reduced to 1e18, all usde in SP was spend because of interest.
      await troveManager.liquidate(defaulter_1, {
        from: owner
      });
      assert.equal((await stabilityPool.P()).toString(), _dec(18))

      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txWA = await stabilityPool.connect(Alice).withdrawFromSP(dec(10000, 18), {
        from: alice
      })
      const txA = await txWA.wait()
      await priceFeed.setPrice(dec(100, 18))

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = await th.getEventArgByName(txA, 'CollGainWithdrawn', '_collAmounts')[0].toString()

      await usdeToken.connect(Whale).transfer(bob, dec(10000, 18), {
        from: whale
      })
      await stabilityPool.connect(Bob).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
        from: bob
      })

      // Defaulter 2 liquidated.  9900 USDE liquidated. P altered by a factor of 1-(9900/10000) = 0.01.  Scale changed.
      await troveManager.liquidate(defaulter_2, {
        from: owner
      });

      assert.equal(await stabilityPool.currentScale(), '0')

      const txWB = await stabilityPool.connect(Bob).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob
      })
      const txB = await txWB.wait()
      const bob_ETHWithdrawn = await th.getEventArgByName(txB, 'CollGainWithdrawn', '_collAmounts')[0].toString()

      // Expect Bob to retain 1% of initial deposit (100 USDE) and all the liquidated ETH (60 ether)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(bob)).div(toBN(dec(1, 14))).toString(), '1000000'), 100000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '59700000000000000000'), _dec(14))

    })

    // A deposits 10000
    // L1 brings P close to boundary, i.e. 9e-9: liquidate 9999.99991 USDE
    // A withdraws all
    // B, C, D deposit 10000, 20000, 30000
    // L2 of 59400, should bring P slightly past boundary i.e. 1e-9 -> 1e-10

    // expect d(B) = d0(B)/100
    // expect correct ETH gain, i.e. all of the reward
    it("withdrawCollateralGainToTrove(): Several deposits of varying amounts span one scale factor change. Depositors withdraw correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Carol).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Dennis).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: dennis,
        value: dec(10000, 'ether')
      })

      await usdeToken.connect(Whale).transfer(alice, dec(10000, 18), {
        from: whale
      })
      await stabilityPool.connect(Alice).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
        from: alice
      })

      // Defaulter 1 withdraws 'almost' 10k USDE.
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount('9999999990000000000000'), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(100, 'ether')
      })

      // Defaulter 2 withdraws 59400 USDE
      await borrowerOperations.connect(Defaulter_2).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount('59400000000000000000000'), defaulter_2, defaulter_2, ZERO_ADDRESS, {
        from: defaulter_2,
        value: dec(330, 'ether')
      })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated.  Value of P reduced to 1e18, all usde in SP was spend because of interest.
      await troveManager.liquidate(defaulter_1, {
        from: owner
      });
      assert.equal((await stabilityPool.P()).toString(), _dec(18))

      assert.equal(await stabilityPool.currentScale(), '0')

      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txWA = await stabilityPool.connect(Alice).withdrawFromSP(dec(10000, 18), {
        from: alice
      })
      await priceFeed.setPrice(dec(100, 18))

      //B, C, D deposit to Stability Pool
      await usdeToken.connect(Whale).transfer(bob, dec(10000, 18), {
        from: whale
      })
      await stabilityPool.connect(Bob).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
        from: bob
      })

      await usdeToken.connect(Whale).transfer(carol, dec(20000, 18), {
        from: whale
      })
      await stabilityPool.connect(Carol).provideToSP(dec(20000, 18), ZERO_ADDRESS, {
        from: carol
      })

      await usdeToken.connect(Whale).transfer(dennis, dec(30000, 18), {
        from: whale
      })
      await stabilityPool.connect(Dennis).provideToSP(dec(30000, 18), ZERO_ADDRESS, {
        from: dennis
      })

      // 54000 USDE liquidated.  P altered by a factor of 1-(59400/60000) = 0.01. Scale changed.
      const txWL2 = await troveManager.liquidate(defaulter_2, {
        from: owner
      });
      const txL2 = await txWL2.wait()
      assert.isTrue(txL2.status === 1)

      assert.equal(await stabilityPool.currentScale(), '0')

      const txWB = await stabilityPool.connect(Bob).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob
      })
      const txWC = await stabilityPool.connect(Carol).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol
      })
      const txWD = await stabilityPool.connect(Dennis).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: dennis
      })
      const txB = await txWB.wait()
      const txC = await txWC.wait()
      const txD = await txWD.wait()

      /* Expect depositors to retain 1% of their initial deposit, and an ETH gain 
      in proportion to their initial deposit:
     
      Bob:  1000 USDE, 55 Ether
      Carol:  2000 USDE, 110 Ether
      Dennis:  3000 USDE, 165 Ether
     
      Total: 6000 USDE, 300 Ether
      */
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(bob)).div(_dec(2)).toString(), dec(100, 16)), _dec(15))
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(carol)).div(_dec(2)).toString(), dec(200, 16)), _dec(15))
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(dennis)).div(_dec(2)).toString(), dec(300, 16)), _dec(15))

      const bob_ETHWithdrawn = await th.getEventArgByName(txB, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const carol_ETHWithdrawn = await th.getEventArgByName(txC, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const dennis_ETHWithdrawn = await th.getEventArgByName(txD, 'CollGainWithdrawn', '_collAmounts')[0].toString()

      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '54725000000000000000'), _dec(14))
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '109450000000000000000'), _dec(14))
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '164175000000000000000'), _dec(14))
    })

    // Deposit's ETH reward spans one scale change - deposit reduced by correct amount

    // A make deposit 10000 USDE
    // L1 brings P to 1e-5*P. L1:  9999.9000000000000000 USDE
    // A withdraws
    // B makes deposit 10000 USDE
    // L2 decreases P again by 1e-5, over the scale boundary: 9999.9000000000000000 (near to the 10000 USDE total deposits)
    // B withdraws
    // expect d(B) = d0(B) * 1e-5
    // expect B gets entire ETH gain from L2
    it("withdrawCollateralGainToTrove(): deposit spans one scale factor change: Single depositor withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Carol).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol,
        value: dec(10000, 'ether')
      })

      await usdeToken.connect(Whale).transfer(alice, dec(10000, 18), {
        from: whale
      })
      await stabilityPool.connect(Alice).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
        from: alice
      })

      // Defaulter 1 and default 2 each withdraw 9999.999999999 USDE
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(99999, 17)), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_2).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(99999, 17)), defaulter_2, defaulter_2, ZERO_ADDRESS, {
        from: defaulter_2,
        value: dec(100, 'ether')
      })

      // price drops by 50%: defaulter 1 ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated.  Value of P updated to  to 1e13
      const txWL1 = await troveManager.liquidate(defaulter_1, {
        from: owner
      });
      const txL1 = await txWL1.wait()
      assert.isTrue(txL1.status === 1)
      // P decreases. P < 1e(18-5) = 1e13
      th.assertIsApproximatelyEqual(await stabilityPool.P(), dec(1, 13), _dec(14))
      assert.equal(await stabilityPool.currentScale(), '0')

      // Alice withdraws
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txWA = await stabilityPool.connect(Alice).withdrawFromSP(dec(10000, 18), {
        from: alice
      })
      await priceFeed.setPrice(dec(100, 18))

      // Bob deposits 10k USDE
      await usdeToken.connect(Whale).transfer(bob, dec(10000, 18), {
        from: whale
      })
      await stabilityPool.connect(Bob).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
        from: bob
      })

      // Defaulter 2 liquidated
      const txWL2 = await troveManager.liquidate(defaulter_2, {
        from: owner
      });
      const txL2 = await txWL2.wait()
      assert.isTrue(txL2.status === 1)
      // Scale changes and P changes. P < 1e(13-5+9) = 1e17
      th.assertIsApproximatelyEqual(await stabilityPool.P(), dec(1, 17), _dec(17))
      assert.equal(await stabilityPool.currentScale(), '1')

      const txWB = await stabilityPool.connect(Bob).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob
      })
      const txB = await txWB.wait()
      const bob_ETHWithdrawn = await th.getEventArgByName(txB, 'CollGainWithdrawn', '_collAmounts')[0].toString()

      // Bob should withdraw 1e-5 of initial deposit: 0.1 USDE and the full ETH gain of 100 ether
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(bob)).toString(), dec(1, 17)), _dec(17))
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 17)), _dec(14))
    })

    // A make deposit 10000 USDE
    // L1 brings P to 1e-5*P. L1:  9999.9000000000000000 USDE
    // A withdraws
    // B,C D make deposit 10000, 20000, 30000
    // L2 decreases P again by 1e-5, over boundary. L2: 59999.4000000000000000  (near to the 60000 USDE total deposits)
    // B withdraws
    // expect d(B) = d0(B) * 1e-5
    // expect B gets entire ETH gain from L2
    it("withdrawCollateralGainToTrove(): Several deposits of varying amounts span one scale factor change. Depositors withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Carol).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Dennis).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: dennis,
        value: dec(10000, 'ether')
      })

      await usdeToken.connect(Whale).transfer(alice, dec(10000, 18), {
        from: whale
      })
      await stabilityPool.connect(Alice).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
        from: alice
      })

      // Defaulter 1 and default 2 withdraw up to debt of 9999.9 USDE and 59999.4 USDE
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount('9999900000000000000000'), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_2).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount('59999400000000000000000'), defaulter_2, defaulter_2, ZERO_ADDRESS, {
        from: defaulter_2,
        value: dec(600, 'ether')
      })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated.  Value of P updated to  to 9999999, i.e. in decimal, ~1e-10
      const txWL1 = await troveManager.liquidate(defaulter_1, {
        from: owner
      });
      // P decreases. P < 1e(18-5) = 1e13
      th.assertIsApproximatelyEqual(await stabilityPool.P(), dec(1, 13), _dec(14))
      assert.equal(await stabilityPool.currentScale(), '0')

      // Alice withdraws
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txWA = await stabilityPool.connect(Alice).withdrawFromSP(dec(100, 18), {
        from: alice
      })
      await priceFeed.setPrice(dec(100, 18))

      // B, C, D deposit 10000, 20000, 30000 USDE
      await usdeToken.connect(Whale).transfer(bob, dec(10000, 18), {
        from: whale
      })
      await stabilityPool.connect(Bob).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
        from: bob
      })

      await usdeToken.connect(Whale).transfer(carol, dec(20000, 18), {
        from: whale
      })
      await stabilityPool.connect(Carol).provideToSP(dec(20000, 18), ZERO_ADDRESS, {
        from: carol
      })

      await usdeToken.connect(Whale).transfer(dennis, dec(30000, 18), {
        from: whale
      })
      await stabilityPool.connect(Dennis).provideToSP(dec(30000, 18), ZERO_ADDRESS, {
        from: dennis
      })

      // Defaulter 2 liquidated
      const txWL2 = await troveManager.liquidate(defaulter_2, {
        from: owner
      });
      const txL2 = await txWL2.wait()
      assert.isTrue(txL2.status === 1)
      // P decreases. P < 1e(13-5+9) = 1e17
      th.assertIsApproximatelyEqual(await stabilityPool.P(), dec(1, 17), _dec(17))
      assert.equal(await stabilityPool.currentScale(), '1')

      const txWB = await stabilityPool.connect(Bob).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob
      })
      const txB = await txWB.wait()
      const bob_ETHWithdrawn = await th.getEventArgByName(txB, 'CollGainWithdrawn', '_collAmounts')[0].toString()

      const txWC = await stabilityPool.connect(Carol).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol
      })
      const txC = await txWC.wait()
      const carol_ETHWithdrawn = await th.getEventArgByName(txC, 'CollGainWithdrawn', '_collAmounts')[0].toString()

      const txWD = await stabilityPool.connect(Dennis).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: dennis
      })
      const txD = await txWD.wait()
      const dennis_ETHWithdrawn = await th.getEventArgByName(txD, 'CollGainWithdrawn', '_collAmounts')[0].toString()

      // {B, C, D} should have a compounded deposit of {0.1, 0.2, 0.3} USDE
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(bob)).div(_dec(2)).toString(), dec(1, 15)), _dec(15))
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(carol)).div(_dec(2)).toString(), dec(2, 15)), _dec(15))
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(dennis)).div(_dec(2)).toString(), dec(3, 15)), _dec(15))

      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 17)), _dec(14))
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(1990, 17)), _dec(14))
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, dec(2985, 17)), _dec(14))
    })

    // A make deposit 10000 USDE
    // L1 brings P to (~1e-10)*P. L1: 9999.9999999000000000 USDE
    // Expect A to withdraw 0 deposit
    it("withdrawCollateralGainToTrove(): Deposit that decreases to less than 1e-9 of it's original value is reduced to 0", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Carol).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Dennis).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: dennis,
        value: dec(10000, 'ether')
      })

      // Defaulters 1 withdraws 9999.9999999 USDE
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount('9999999999900000000000'), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(100, 'ether')
      })

      // Price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      await usdeToken.connect(Whale).transfer(alice, dec(10000, 18), {
        from: whale
      })
      await stabilityPool.connect(Alice).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
        from: alice
      })

      // Defaulter 1 liquidated. P -> (~1e-10)*P
      const txWL1 = await troveManager.liquidate(defaulter_1, {
        from: owner
      });
      const txL1 = await txWL1.wait()
      assert.isTrue(txL1.status === 1)

      const aliceDeposit = (await stabilityPool.getCompoundedUSDEDeposit(alice)).toString()
      // console.log(`alice deposit: ${aliceDeposit}`)
      assert.equal(aliceDeposit, 0)
    })

    // --- Serial scale changes ---

    /* A make deposit 10000 USDE
    L1 brings P to 0.0001P. L1:  9999.900000000000000000 USDE, 1 ETH
    B makes deposit 9999.9, brings SP to 10k
    L2 decreases P by(~1e-5)P. L2:  9999.900000000000000000 USDE, 1 ETH
    C makes deposit 9999.9, brings SP to 10k
    L3 decreases P by(~1e-5)P. L3:  9999.900000000000000000 USDE, 1 ETH
    D makes deposit 9999.9, brings SP to 10k
    L4 decreases P by(~1e-5)P. L4:  9999.900000000000000000 USDE, 1 ETH
    expect A, B, C, D each withdraw ~100 Ether
    */
    it("withdrawCollateralGainToTrove(): Several deposits of 10000 USDE span one scale factor change. Depositors withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      await borrowerOperations.connect(Alice).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Bob).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Carol).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(Dennis).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: dennis,
        value: dec(10000, 'ether')
      })

      // Defaulters 1-4 each withdraw 9999.9 USDE
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount('9999900000000000000000'), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_2).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount('9999900000000000000000'), defaulter_2, defaulter_2, ZERO_ADDRESS, {
        from: defaulter_2,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_3).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount('9999900000000000000000'), defaulter_3, defaulter_3, ZERO_ADDRESS, {
        from: defaulter_3,
        value: dec(100, 'ether')
      })
      await borrowerOperations.connect(Defaulter_4).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount('9999900000000000000000'), defaulter_4, defaulter_4, ZERO_ADDRESS, {
        from: defaulter_4,
        value: dec(100, 'ether')
      })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      await usdeToken.connect(Whale).transfer(alice, dec(10000, 18), {
        from: whale
      })
      await stabilityPool.connect(Alice).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
        from: alice
      })

      // Defaulter 1 liquidated. 
      const txWL1 = await troveManager.liquidate(defaulter_1, {
        from: owner
      });
      const txL1 = await txWL1.wait()
      assert.isTrue(txL1.status === 1)
      // P decreases to <  1e(18-5) = 1e13
      th.assertIsApproximatelyEqual(await stabilityPool.P(), dec(1, 13), _dec(14))
      assert.equal(await stabilityPool.currentScale(), '0')

      // B deposits 9999.9 USDE
      await usdeToken.connect(Whale).transfer(bob, dec(99999, 17), {
        from: whale
      })
      await stabilityPool.connect(Bob).provideToSP(dec(99999, 17), ZERO_ADDRESS, {
        from: bob
      })

      // Defaulter 2 liquidated
      const txWL2 = await troveManager.liquidate(defaulter_2, {
        from: owner
      });
      const txL2 = await txWL2.wait()
      assert.isTrue(txL2.status === 1)
      // Scale changes and P changes to < 1e(13-5+9) = 1e17
      assert.isAtMost(th.getDifference((await stabilityPool.P()).div(_dec(16)), 100), 100)
      assert.equal(await stabilityPool.currentScale(), '1')

      // C deposits 9999.9 USDE
      await usdeToken.connect(Whale).transfer(carol, dec(99999, 17), {
        from: whale
      })
      await stabilityPool.connect(Carol).provideToSP(dec(99999, 17), ZERO_ADDRESS, {
        from: carol
      })

      // Defaulter 3 liquidated
      const txWL3 = await troveManager.liquidate(defaulter_3, {
        from: owner
      });
      const txL3 = await txWL3.wait()
      assert.isTrue(txL3.status === 1)
      // P decreases to < 1e(17-5) = 1e12
      th.assertIsApproximatelyEqual(await stabilityPool.P(), dec(1, 12), _dec(12))
      assert.equal(await stabilityPool.currentScale(), '1')

      // D deposits 9999.9 USDE
      await usdeToken.connect(Whale).transfer(dennis, dec(99999, 17), {
        from: whale
      })
      await stabilityPool.connect(Dennis).provideToSP(dec(99999, 17), ZERO_ADDRESS, {
        from: dennis
      })

      // Defaulter 4 liquidated
      const txWL4 = await troveManager.liquidate(defaulter_4, {
        from: owner
      });
      const txL4 = await txWL4.wait()
      assert.isTrue(txL4.status === 1)
      // Scale changes and P changes to < 1e(12-5+9) = 1e16
      th.assertIsApproximatelyEqual(await stabilityPool.P(), dec(1, 16), _dec(16))
      assert.equal(await stabilityPool.currentScale(), '2')

      const txWA = await stabilityPool.connect(Alice).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice
      })
      const txWB = await stabilityPool.connect(Bob).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob
      })
      const txWC = await stabilityPool.connect(Carol).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: carol
      })
      const txWD = await stabilityPool.connect(Dennis).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: dennis
      })
      const txA = await txWA.wait()
      const txB = await txWB.wait()
      const txC = await txWC.wait()
      const txD = await txWD.wait()

      const alice_ETHWithdrawn = await th.getEventArgByName(txA, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const bob_ETHWithdrawn = await th.getEventArgByName(txB, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const carol_ETHWithdrawn = await th.getEventArgByName(txC, 'CollGainWithdrawn', '_collAmounts')[0].toString()
      const dennis_ETHWithdrawn = await th.getEventArgByName(txD, 'CollGainWithdrawn', '_collAmounts')[0].toString()

      // A, B, C should retain 0 - their deposits have been completely used up
      assert.equal(await stabilityPool.getCompoundedUSDEDeposit(alice), '0')
      assert.equal(await stabilityPool.getCompoundedUSDEDeposit(alice), '0')
      assert.equal(await stabilityPool.getCompoundedUSDEDeposit(alice), '0')
      // D should retain around 0.9999 USDE, since his deposit of 9999.9 was reduced by a factor of 1e-5
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedUSDEDeposit(dennis)).div(_dec(12)).toString(), '99999'), _dec(5))

      // 99.5 ETH is offset at each L, 0.5 goes to gas comp
      // Each depositor gets ETH rewards of around 99.5 ETH. 1e17 error tolerance
      assert.isTrue(toBN(alice_ETHWithdrawn).sub(toBN(dec(995, 17))).abs().lte(toBN(dec(1, 17))))
      assert.isTrue(toBN(bob_ETHWithdrawn).sub(toBN(dec(995, 17))).abs().lte(toBN(dec(1, 17))))
      assert.isTrue(toBN(carol_ETHWithdrawn).sub(toBN(dec(995, 17))).abs().lte(toBN(dec(1, 17))))
      assert.isTrue(toBN(dennis_ETHWithdrawn).sub(toBN(dec(995, 17))).abs().lte(toBN(dec(1, 17))))
    })

    it("withdrawCollateralGainToTrove(): 2 depositors can withdraw after each receiving half of a pool-emptying liquidation", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      await borrowerOperations.connect(signerA).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: A,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(signerB).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: B,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(signerC).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: C,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(signerD).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: D,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(signerE).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: E,
        value: dec(10000, 'ether')
      })
      await borrowerOperations.connect(signerF).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(10000, 18)), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
        from: F,
        value: dec(10000, 'ether')
      })

      // Defaulters 1-3 each withdraw 24100, 24300, 24500 USDE (inc gas comp)
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(24100, 18)), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(200, 'ether')
      })
      await borrowerOperations.connect(Defaulter_2).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(24300, 18)), defaulter_2, defaulter_2, ZERO_ADDRESS, {
        from: defaulter_2,
        value: dec(200, 'ether')
      })
      await borrowerOperations.connect(Defaulter_3).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(24500, 18)), defaulter_3, defaulter_3, ZERO_ADDRESS, {
        from: defaulter_3,
        value: dec(200, 'ether')
      })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // A, B provide 10k USDE
      await usdeToken.connect(Whale).transfer(A, dec(10000, 18), {
        from: whale
      })
      await usdeToken.connect(Whale).transfer(B, dec(10000, 18), {
        from: whale
      })
      await stabilityPool.connect(signerA).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
        from: A
      })
      await stabilityPool.connect(signerB).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
        from: B
      })

      // Defaulter 1 liquidated. SP emptied
      const txWL1 = await troveManager.liquidate(defaulter_1, {
        from: owner
      });
      const txL1 = await txWL1.wait()
      assert.isTrue(txL1.status === 1)

      // Check compounded deposits
      const A_deposit = await stabilityPool.getCompoundedUSDEDeposit(A)
      const B_deposit = await stabilityPool.getCompoundedUSDEDeposit(B)
      // console.log(`A_deposit: ${A_deposit}`)
      // console.log(`B_deposit: ${B_deposit}`)
      assert.equal(A_deposit, '0')
      assert.equal(B_deposit, '0')

      // Check SP tracker is zero
      const USDEinSP_1 = await stabilityPool.getTotalUSDEDeposits()
      // console.log(`USDEinSP_1: ${USDEinSP_1}`)
      assert.equal(USDEinSP_1, '0')

      // Check SP USDE balance is zero
      const SPUSDEBalance_1 = await usdeToken.balanceOf(stabilityPool.address)
      // console.log(`SPUSDEBalance_1: ${SPUSDEBalance_1}`)
      assert.equal(SPUSDEBalance_1, '0')

      // Attempt withdrawals
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txWA = await stabilityPool.connect(signerA).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: A
      })
      const txWB = await stabilityPool.connect(signerB).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: B
      })
      await priceFeed.setPrice(dec(100, 18))
      const txA = await txWA.wait()
      const txB = await txWB.wait()
      assert.isTrue(txA.status === 1)
      assert.isTrue(txB.status === 1)

      // ==========

      // C, D provide 10k USDE
      await usdeToken.connect(Whale).transfer(C, dec(10000, 18), {
        from: whale
      })
      await usdeToken.connect(Whale).transfer(D, dec(10000, 18), {
        from: whale
      })
      await stabilityPool.connect(signerC).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
        from: C
      })
      await stabilityPool.connect(signerD).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
        from: D
      })

      // Defaulter 2 liquidated.  SP emptied
      const txWL2 = await troveManager.liquidate(defaulter_2, {
        from: owner
      });
      const txL2 = await txWL2.wait()
      assert.isTrue(txL2.status === 1)

      // Check compounded deposits
      const C_deposit = await stabilityPool.getCompoundedUSDEDeposit(C)
      const D_deposit = await stabilityPool.getCompoundedUSDEDeposit(D)
      // console.log(`A_deposit: ${C_deposit}`)
      // console.log(`B_deposit: ${D_deposit}`)
      assert.equal(C_deposit, '0')
      assert.equal(D_deposit, '0')

      // Check SP tracker is zero
      const USDEinSP_2 = await stabilityPool.getTotalUSDEDeposits()
      // console.log(`USDEinSP_2: ${USDEinSP_2}`)
      assert.equal(USDEinSP_2, '0')

      // Check SP USDE balance is zero
      const SPUSDEBalance_2 = await usdeToken.balanceOf(stabilityPool.address)
      // console.log(`SPUSDEBalance_2: ${SPUSDEBalance_2}`)
      assert.equal(SPUSDEBalance_2, '0')

      // Attempt withdrawals
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txWC = await stabilityPool.connect(signerC).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: C
      })
      const txWD = await stabilityPool.connect(signerD).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: D
      })
      await priceFeed.setPrice(dec(100, 18))
      const txC = await txWC.wait()
      const txD = await txWD.wait()
      assert.isTrue(txC.status === 1)
      assert.isTrue(txD.status === 1)

      // ============

      // E, F provide 10k USDE
      await usdeToken.connect(Whale).transfer(E, dec(10000, 18), {
        from: whale
      })
      await usdeToken.connect(Whale).transfer(F, dec(10000, 18), {
        from: whale
      })
      await stabilityPool.connect(signerE).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
        from: E
      })
      await stabilityPool.connect(signerF).provideToSP(dec(10000, 18), ZERO_ADDRESS, {
        from: F
      })

      // Defaulter 3 liquidated. SP emptied
      const txWL3 = await troveManager.liquidate(defaulter_3, {
        from: owner
      });
      const txL3 = await txWL3.wait()
      assert.isTrue(txL3.status === 1)

      // Check compounded deposits
      const E_deposit = await stabilityPool.getCompoundedUSDEDeposit(E)
      const F_deposit = await stabilityPool.getCompoundedUSDEDeposit(F)
      // console.log(`E_deposit: ${E_deposit}`)
      // console.log(`F_deposit: ${F_deposit}`)
      assert.equal(E_deposit, '0')
      assert.equal(F_deposit, '0')

      // Check SP tracker is zero
      const USDEinSP_3 = await stabilityPool.getTotalUSDEDeposits()
      assert.equal(USDEinSP_3, '0')

      // Check SP USDE balance is zero
      const SPUSDEBalance_3 = await usdeToken.balanceOf(stabilityPool.address)
      // console.log(`SPUSDEBalance_3: ${SPUSDEBalance_3}`)
      assert.equal(SPUSDEBalance_3, '0')

      // Attempt withdrawals
      const txWE = await stabilityPool.connect(signerE).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: E
      })
      const txWF = await stabilityPool.connect(signerF).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: F
      })
      const txE = await txWE.wait()
      const txF = await txWF.wait()
      assert.isTrue(txE.status === 1)
      assert.isTrue(txF.status === 1)
    })

    // --- Extreme values, confirm no overflows ---

    it("withdrawCollateralGainToTrove(): Large liquidated coll/debt, deposits and ETH price", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      // ETH:USD price is $2 billion per ETH
      await priceFeed.setPrice(dec(2, 27));

      const depositors = [Alice, Bob]
      for (const account of depositors) {
        await borrowerOperations.connect(account).openTrove([], [], th._100pct, dec(1, 36), account.address, account.address, ZERO_ADDRESS, {
          from: account.address,
          value: dec(2, 27)
        })
        await stabilityPool.connect(account).provideToSP(dec(1, 36), ZERO_ADDRESS, {
          from: account.address
        })
      }

      // Defaulter opens trove with 200% ICR
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(1, 36)), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: dec(1, 27)
      })

      // ETH:USD price drops to $1 billion per ETH
      await priceFeed.setPrice(dec(1, 27));

      // Defaulter liquidated
      await troveManager.liquidate(defaulter_1, {
        from: owner
      });

      const txWA = await stabilityPool.connect(Alice).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice
      })
      const txWB = await stabilityPool.connect(Bob).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob
      })
      const txA = await txWA.wait()
      const txB = await txWB.wait()

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'CollGainWithdrawn', '_collAmounts')[0]
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'CollGainWithdrawn', '_collAmounts')[0]

      // Check USDE balances
      const aliceUSDEBalance = await stabilityPool.getCompoundedUSDEDeposit(alice)
      const aliceExpectedUSDEBalance = toBN(dec(5, 35))
      const aliceUSDEBalDiff = aliceUSDEBalance.sub(aliceExpectedUSDEBalance).abs()

      assert.isTrue(aliceUSDEBalDiff.lte(toBN(dec(1, 27)))) // error tolerance of 1e18

      const bobUSDEBalance = await stabilityPool.getCompoundedUSDEDeposit(bob)
      const bobExpectedUSDEBalance = toBN(dec(5, 35))
      const bobUSDEBalDiff = bobUSDEBalance.sub(bobExpectedUSDEBalance).abs()

      assert.isTrue(bobUSDEBalDiff.lte(toBN(dec(1, 27))))

      // Check ETH gains
      const aliceExpectedETHGain = toBN(dec(4975, 23))
      const aliceETHDiff = aliceExpectedETHGain.sub(toBN(alice_ETHWithdrawn))

      assert.isTrue(aliceETHDiff.lte(toBN(dec(1, 18))))

      const bobExpectedETHGain = toBN(dec(4975, 23))
      const bobETHDiff = bobExpectedETHGain.sub(toBN(bob_ETHWithdrawn))

      assert.isTrue(bobETHDiff.lte(toBN(dec(1, 18))))
    })

    it("withdrawCollateralGainToTrove(): Small liquidated coll/debt, large deposits and ETH price", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.connect(Whale).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(100000, 18)), whale, whale, ZERO_ADDRESS, {
        from: whale,
        value: dec(100000, 'ether')
      })

      // ETH:USD price is $2 billion per ETH
      await priceFeed.setPrice(dec(2, 27));

      const depositors = [Alice, Bob]
      for (const account of depositors) {
        await borrowerOperations.connect(account).openTrove([], [], th._100pct, dec(1, 38), account.address, account.address, ZERO_ADDRESS, {
          from: account.address,
          value: dec(2, 29)
        })
        await stabilityPool.connect(account).provideToSP(dec(1, 38), ZERO_ADDRESS, {
          from: account.address
        })
      }

      // Defaulter opens trove with 50e-7 ETH and  5000 USDE. 200% ICR
      await borrowerOperations.connect(Defaulter_1).openTrove([], [], th._100pct, await getOpenTroveUSDEAmount(dec(5000, 18)), defaulter_1, defaulter_1, ZERO_ADDRESS, {
        from: defaulter_1,
        value: '5000000000000'
      })

      // ETH:USD price drops to $1 billion per ETH
      await priceFeed.setPrice(dec(1, 27));

      // Defaulter liquidated
      await troveManager.liquidate(defaulter_1, {
        from: owner
      });

      await stabilityPool.connect(Alice).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: alice
      })
      await stabilityPool.connect(Bob).withdrawCollateralGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, {
        from: bob
      })

      // Expect ETH gain per depositor of ~1e11 wei to be rounded to 0 by the ETHGainedPerUnitStaked calculation (e / D), where D is ~1e36.
      // await th.assertRevert(txAPromise, 'StabilityPool: caller must have non-zero Collateral Gain')
      // await th.assertRevert(txBPromise, 'StabilityPool: caller must have non-zero Collateral Gain')

      const aliceUSDEBalance = await stabilityPool.getCompoundedUSDEDeposit(alice)
      // const aliceUSDEBalance = await usdeToken.balanceOf(alice)
      const aliceExpectedUSDEBalance = toBN('99999999999999997500000000000000000000')
      const aliceUSDEBalDiff = aliceUSDEBalance.sub(aliceExpectedUSDEBalance).abs()

      assert.isTrue(aliceUSDEBalDiff.lte(toBN(dec(1, 27))))

      const bobUSDEBalance = await stabilityPool.getCompoundedUSDEDeposit(bob)
      const bobExpectedUSDEBalance = toBN('99999999999999997500000000000000000000')
      const bobUSDEBalDiff = bobUSDEBalance.sub(bobExpectedUSDEBalance).abs()

      assert.isTrue(bobUSDEBalDiff.lte(toBN('100000000000000000000')))
    })
  })
})

contract('Reset chain state', async accounts => {})