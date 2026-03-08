"use strict";

function nowIso() {
  return new Date().toISOString();
}

function makeWorkerId(prefix) {
  return `${String(prefix || "worker")}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultSwarmState() {
  return {
    schema_version: 1,
    file_kind: "PI Distributed Swarm State",
    updated_at: nowIso(),
    workers: {},
    leases: {},
    task_history: [],
  };
}

async function runRemoteWorker(workerId, options) {
  const fanoutUrl = String(process.env.PI_SWARM_FANOUT_URL || "").trim();
  if (!fanoutUrl) return null;
  const adminToken = String(process.env.PI_ADMIN_TOKEN || "").trim();
  const res = await fetch(fanoutUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(adminToken ? { "x-admin-token": adminToken } : {}),
    },
    body: JSON.stringify({
      worker_id: workerId,
      max_tasks: Number(options && options.max_tasks || 1),
      backoff_base_ms: Number(options && options.backoff_base_ms || 4000),
      lease_seconds: Number(options && options.lease_seconds || 30),
    }),
  });
  if (!res.ok) return { ok: false, error: `HTTP_${res.status}`, processed: [] };
  return await res.json().catch(() => ({ ok: false, error: "invalid_json", processed: [] }));
}

async function runDistributedSwarm(store, queue, workerRunner, options) {
  const workerCount = Math.max(1, Math.min(8, Number(options && options.worker_count || 3)));
  const leaseSeconds = Math.max(5, Number(options && options.lease_seconds || 30));
  const loaded = await store.readDoc("distributed_swarm_state", defaultSwarmState());
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const state = loaded.doc && typeof loaded.doc === "object" ? loaded.doc : defaultSwarmState();
  state.workers = state.workers && typeof state.workers === "object" ? state.workers : {};
  state.task_history = Array.isArray(state.task_history) ? state.task_history : [];

  const workerIds = [];
  for (let i = 0; i < workerCount; i += 1) {
    const key = `w_${i + 1}`;
    if (!state.workers[key]) state.workers[key] = { id: makeWorkerId(key), created_at: nowIso(), runs: 0 };
    state.workers[key].runs = Number(state.workers[key].runs || 0) + 1;
    state.workers[key].last_seen_at = nowIso();
    workerIds.push(state.workers[key].id);
  }

  const ticks = [];
  for (const wid of workerIds) {
    const params = {
      max_tasks: 1,
      backoff_base_ms: Number(process.env.PI_SWARM_BACKOFF_BASE_MS || 4000),
      worker_id: wid,
      lease_seconds: leaseSeconds,
    };
    const remoteTick = await runRemoteWorker(wid, params);
    const tick = remoteTick || await workerRunner(queue, params);
    ticks.push({
      worker_id: wid,
      ok: !!(tick && tick.ok),
      processed: tick && tick.processed ? tick.processed : [],
      retried_count: Number(tick && tick.retried_count || 0),
      dead_lettered_count: Number(tick && tick.dead_lettered_count || 0),
    });
    state.task_history.push({
      at: nowIso(),
      worker_id: wid,
      processed: tick && tick.processed ? tick.processed : [],
    });
  }

  if (state.task_history.length > 2000) state.task_history = state.task_history.slice(-2000);
  state.updated_at = nowIso();
  const saved = await store.writeDoc("distributed_swarm_state", state, loaded.sha || "", "pi-os phase3: update distributed swarm state");
  if (!saved.ok) return { ok: false, error: saved.error };

  return {
    ok: true,
    worker_count: workerIds.length,
    worker_ids: workerIds,
    lease_seconds: leaseSeconds,
    ticks,
    storage: saved.storage,
  };
}

module.exports = {
  runDistributedSwarm,
};
