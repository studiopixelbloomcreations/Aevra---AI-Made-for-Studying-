"use strict";

const { executeResearchTask } = require("./research_execution_pipeline");

async function processTask(task, context) {
  const t = task && typeof task === "object" ? task : {};
  const type = String(t.type || "general");
  if (type === "research" || type === "planning" || type === "skill_generation") {
    return executeResearchTask(t, context);
  }
  return {
    ok: true,
    task_id: String(t.id || ""),
    task_type: type,
    output: "No-op worker pass for unsupported task type.",
  };
}

async function runSwarmWorkerTick(queue, context, options) {
  const maxTasks = Number(options && options.max_tasks || 3);
  const backoffBaseMs = Number(options && options.backoff_base_ms || 4000);
  const workerId = String(options && options.worker_id || "");
  const leaseSeconds = Number(options && options.lease_seconds || 30);
  return queue.processPending(
    async (task) => processTask(task, context),
    maxTasks,
    { backoff_base_ms: backoffBaseMs, worker_id: workerId, lease_seconds: leaseSeconds }
  );
}

module.exports = {
  processTask,
  runSwarmWorkerTick,
};
