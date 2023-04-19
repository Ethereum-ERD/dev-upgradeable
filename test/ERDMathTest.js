const ERDMathTester = artifacts.require("./ERDMathTester.sol")

contract('ERDMath', async accounts => {
  let erdMathTester
  beforeEach('deploy tester', async () => {
    erdMathTester = await ERDMathTester.new()
  })

  const checkFunction = async (func, cond, params) => {
    assert.equal(await erdMathTester[func](...params), cond(...params))
  }

  it('max works if a > b', async () => {
    await checkFunction('callMax', (a, b) => Math.max(a, b), [2, 1])
  })

  it('max works if a = b', async () => {
    await checkFunction('callMax', (a, b) => Math.max(a, b), [2, 2])
  })

  it('max works if a < b', async () => {
    await checkFunction('callMax', (a, b) => Math.max(a, b), [1, 2])
  })
})
