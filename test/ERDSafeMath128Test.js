const testHelpers = require("../utils/testHelpersUpgrade.js")
const th = testHelpers.TestHelper

const ERDSafeMath128Tester = artifacts.require("ERDSafeMath128Tester")

contract('ERDSafeMath128Tester', async accounts => {
  let mathTester

  beforeEach(async () => {
    mathTester = await ERDSafeMath128Tester.new()
  })

  it('add(): reverts if overflows', async () => {
    const MAX_UINT_128 = th.toBN(2).pow(th.toBN(128)).sub(th.toBN(1))
    await th.assertRevert(mathTester.add(MAX_UINT_128, 1), 'reverted with panic code 0x11')
  })

  it('sub(): reverts if underflows', async () => {
    await th.assertRevert(mathTester.sub(1, 2), 'ERDSafeMath128: subtraction overflow')
  })
})
