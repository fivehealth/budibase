jest.mock("../../utilities/usageQuota")
jest.mock("../thread")
jest.spyOn(global.console, "error")
jest.mock("worker-farm", () => {
  return () => {
    const value = jest
      .fn()
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce("Error")
    return (input, callback) => {
      workerJob = input
      if (callback) {
        callback(value())
      }
    }
  }
})

require("../../environment")
const automation = require("../index")
const usageQuota = require("../../utilities/usageQuota")
const thread = require("../thread")
const triggers = require("../triggers")
const { basicAutomation } = require("../../tests/utilities/structures")
const { wait } = require("../../utilities")
const { makePartial } = require("../../tests/utilities")
const { cleanInputValues } = require("../automationUtils")
const setup = require("./utilities")

let workerJob

usageQuota.getAPIKey.mockReturnValue({ apiKey: "test" })

describe("Run through some parts of the automations system", () => {
  let config = setup.getConfig()

  beforeEach(async () => {
    await automation.init()
    await config.init()
  })

  afterAll(setup.afterAll)

  it("should be able to init in builder", async () => {
    await triggers.externalTrigger(basicAutomation(), { a: 1 })
    await wait(100)
    expect(workerJob).toBeUndefined()
    expect(thread).toHaveBeenCalled()
  })

  it("should be able to init in prod", async () => {
    await setup.runInProd(async () => {
      await triggers.externalTrigger(basicAutomation(), { a: 1 })
      await wait(100)
      // haven't added a mock implementation so getAPIKey of usageQuota just returns undefined
      expect(usageQuota.update).toHaveBeenCalledWith("test", "automationRuns", 1)
      expect(workerJob).toBeDefined()
    })
  })

  it("try error scenario", async () => {
    await setup.runInProd(async () => {
      // the second call will throw an error
      const response = await triggers.externalTrigger(basicAutomation(), {a: 1}, {getResponses: true})
      await wait(100)
      expect(console.error).toHaveBeenCalled()
      expect(response.err).toBeDefined()
    })
  })

  it("should check coercion", async () => {
    const table = await config.createTable()
    const automation = basicAutomation()
    automation.definition.trigger.inputs.tableId = table._id
    automation.definition.trigger.stepId = "APP"
    automation.definition.trigger.inputs.fields = { a: "number" }
    await triggers.externalTrigger(automation, {
      appId: config.getAppId(),
      fields: {
        a: "1"
      }
    })
    await wait(100)
    expect(thread).toHaveBeenCalledWith(makePartial({
      data: {
        event: {
          fields: {
            a: 1
          }
        }
      }
    }), expect.any(Function))
  })

  it("should be able to clean inputs with the utilities", () => {
    // can't clean without a schema
    let output = cleanInputValues({a: "1"})
    expect(output.a).toBe("1")
    output = cleanInputValues({a: "1", b: "true", c: "false", d: 1, e: "help"}, {
      properties: {
        a: {
          type: "number",
        },
        b: {
          type: "boolean",
        },
        c: {
          type: "boolean",
        }
      }
    })
    expect(output.a).toBe(1)
    expect(output.b).toBe(true)
    expect(output.c).toBe(false)
    expect(output.d).toBe(1)
    expect(output.e).toBe("help")
  })
})