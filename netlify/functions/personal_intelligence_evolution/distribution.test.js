"use strict";

const assert = require("assert");
const { CloudStateStore } = require("./cloud_state_store");
const { SwarmTaskQueue } = require("./swarm_task_queue");
const { runSwarmWorkerTick } = require("./cloud_swarm_worker");
const { runDistributedSwarm } = require("./distributed_swarm");

async function enqueueMany(queue, n) {
  for (let i = 0; i < n; i += 1) {
    const out = await queue.enqueueFromInteraction({
      message: `research topic ${i} deeply and compare options`,
      known_facts: { name: "Load Test User" },
    });
    assert.strictEqual(out.ok, true);
  }
}

async function testDistributedProcessing() {
  const store = new CloudStateStore();
  const queue = new SwarmTaskQueue(store);
  await enqueueMany(queue, 5);

  const out = await runDistributedSwarm(
    store,
    queue,
    async (q, opts) => runSwarmWorkerTick(q, { graph_summary: { node_count: 1, edge_count: 1 } }, opts),
    { worker_count: 3, lease_seconds: 20 }
  );

  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.worker_count, 3);
  const processed = [];
  (out.ticks || []).forEach((t) => {
    (t.processed || []).forEach((p) => processed.push(p));
  });
  assert(processed.length >= 1, "expected at least one processed task");
  const uniqueTaskIds = new Set(processed.map((p) => p.id));
  assert.strictEqual(uniqueTaskIds.size, processed.length, "expected no duplicate task processing in a single distributed tick");
}

async function run() {
  await testDistributedProcessing();
  console.log("distribution tests: ok");
}

run().catch((e) => {
  console.error("distribution tests: failed", e);
  process.exit(1);
});

