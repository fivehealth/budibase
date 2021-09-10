const CouchDB = require("../../db")
const actions = require("../../automations/actions")
const logic = require("../../automations/logic")
const triggers = require("../../automations/triggers")
const { getAutomationParams, generateAutomationID } = require("../../db/utils")
const {
  checkForWebhooks,
  updateTestHistory,
} = require("../../automations/utils")

/*************************
 *                       *
 *   BUILDER FUNCTIONS   *
 *                       *
 *************************/

function cleanAutomationInputs(automation) {
  if (automation == null) {
    return automation
  }
  let steps = automation.definition.steps
  let trigger = automation.definition.trigger
  let allSteps = [...steps, trigger]
  // live is not a property used anymore
  if (automation.live != null) {
    delete automation.live
  }
  for (let step of allSteps) {
    if (step == null) {
      continue
    }
    for (let inputName of Object.keys(step.inputs)) {
      if (!step.inputs[inputName] || step.inputs[inputName] === "") {
        delete step.inputs[inputName]
      }
    }
  }
  return automation
}

exports.create = async function (ctx) {
  const db = new CouchDB(ctx.appId)
  let automation = ctx.request.body
  automation.appId = ctx.appId

  // call through to update if already exists
  if (automation._id && automation._rev) {
    return exports.update(ctx)
  }

  automation._id = generateAutomationID()

  automation.type = "automation"
  automation = cleanAutomationInputs(automation)
  automation = await checkForWebhooks({
    appId: ctx.appId,
    newAuto: automation,
  })
  const response = await db.put(automation)
  automation._rev = response.rev

  ctx.status = 200
  ctx.body = {
    message: "Automation created successfully",
    automation: {
      ...automation,
      ...response,
    },
  }
}

exports.update = async function (ctx) {
  const db = new CouchDB(ctx.appId)
  let automation = ctx.request.body
  automation.appId = ctx.appId
  const oldAutomation = await db.get(automation._id)
  automation = cleanAutomationInputs(automation)
  automation = await checkForWebhooks({
    appId: ctx.appId,
    oldAuto: oldAutomation,
    newAuto: automation,
  })
  const response = await db.put(automation)
  automation._rev = response.rev

  ctx.status = 200
  ctx.body = {
    message: `Automation ${automation._id} updated successfully.`,
    automation: {
      ...automation,
      _rev: response.rev,
      _id: response.id,
    },
  }
}

exports.fetch = async function (ctx) {
  const db = new CouchDB(ctx.appId)
  const response = await db.allDocs(
    getAutomationParams(null, {
      include_docs: true,
    })
  )
  ctx.body = response.rows.map(row => row.doc)
}

exports.find = async function (ctx) {
  const db = new CouchDB(ctx.appId)
  ctx.body = await db.get(ctx.params.id)
}

exports.destroy = async function (ctx) {
  const db = new CouchDB(ctx.appId)
  const oldAutomation = await db.get(ctx.params.id)
  await checkForWebhooks({
    appId: ctx.appId,
    oldAuto: oldAutomation,
  })
  ctx.body = await db.remove(ctx.params.id, ctx.params.rev)
}

exports.getActionList = async function (ctx) {
  ctx.body = actions.ACTION_DEFINITIONS
}

exports.getTriggerList = async function (ctx) {
  ctx.body = triggers.TRIGGER_DEFINITIONS
}

exports.getLogicList = async function (ctx) {
  ctx.body = logic.LOGIC_DEFINITIONS
}

module.exports.getDefinitionList = async function (ctx) {
  ctx.body = {
    logic: logic.LOGIC_DEFINITIONS,
    trigger: triggers.TRIGGER_DEFINITIONS,
    action: actions.ACTION_DEFINITIONS,
  }
}

/*********************
 *                   *
 *   API FUNCTIONS   *
 *                   *
 *********************/

exports.trigger = async function (ctx) {
  const appId = ctx.appId
  const db = new CouchDB(appId)
  let automation = await db.get(ctx.params.id)
  await triggers.externalTrigger(automation, {
    ...ctx.request.body,
    appId,
  })
  ctx.body = {
    message: `Automation ${automation._id} has been triggered.`,
    automation,
  }
}

exports.test = async function (ctx) {
  const appId = ctx.appId
  const db = new CouchDB(appId)
  let automation = await db.get(ctx.params.id)
  const response = await triggers.externalTrigger(
    automation,
    {
      ...ctx.request.body,
      appId,
    },
    { getResponses: true }
  )
  // save a test history run
  await updateTestHistory(ctx.appId, automation, {
    ...ctx.request.body,
    occurredAt: new Date().toISOString(),
  })
  ctx.body = response
}
