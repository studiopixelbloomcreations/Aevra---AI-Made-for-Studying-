"use strict";

const { CloudStateStore } = require("./cloud_state_store");
const { PersistentGraphStore } = require("./persistent_graph_store");
const { SwarmTaskQueue } = require("./swarm_task_queue");
const { runSwarmWorkerTick } = require("./cloud_swarm_worker");

async function runPhase2Cycle(envelope) {
  const store = new CloudStateStore();
  const graphStore = new PersistentGraphStore(store);
  const queue = new SwarmTaskQueue(store);

  const facts = envelope && envelope.known_facts && typeof envelope.known_facts === "object"
    ? envelope.known_facts
    : {};

  const graphResult = await graphStore.upsertFromFacts(facts);

  const enqueueResult = await queue.enqueueFromInteraction(envelope);

  const processResult = await runSwarmWorkerTick(queue, {
    graph_summary: graphResult && graphResult.summary ? graphResult.summary : { node_count: 0, edge_count: 0 },
  }, {
    max_tasks: 3,
    backoff_base_ms: Number(process.env.PI_SWARM_BACKOFF_BASE_MS || 4000),
  });

  return {
    enabled: true,
    storage: {
      mode: store.enabled ? "github" : "memory_fallback",
      base_path: store.basePath,
      branch: store.branch,
    },
    graph: {
      ok: !!(graphResult && graphResult.ok),
      node_count: graphResult && graphResult.summary ? graphResult.summary.node_count : 0,
      edge_count: graphResult && graphResult.summary ? graphResult.summary.edge_count : 0,
      error: graphResult && graphResult.ok ? "" : String(graphResult && graphResult.error || ""),
    },
    queue: {
      enqueued: !!(enqueueResult && enqueueResult.enqueued),
      enqueue_reason: String(enqueueResult && enqueueResult.reason || ""),
      task_id: String(enqueueResult && enqueueResult.task_id || ""),
      processed: processResult && processResult.ok ? processResult.processed : [],
      pending_count: processResult && processResult.ok ? Number(processResult.pending_count || 0) : 0,
      retried_count: processResult && processResult.ok ? Number(processResult.retried_count || 0) : 0,
      dead_lettered_count: processResult && processResult.ok ? Number(processResult.dead_lettered_count || 0) : 0,
      dead_letter_count: processResult && processResult.ok ? Number(processResult.dead_letter_count || 0) : 0,
      metrics: processResult && processResult.ok && processResult.metrics ? processResult.metrics : {},
      error: processResult && processResult.ok ? "" : String(processResult && processResult.error || ""),
    },
    research_pipeline: {
      executed_tasks: processResult && processResult.ok ? processResult.processed.length : 0,
      status: processResult && processResult.ok ? "ok" : "degraded",
    },
  };
}

module.exports = {
  runPhase2Cycle,
};
