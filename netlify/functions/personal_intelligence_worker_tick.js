const { env } = require("../../core/env");
const { CloudStateStore } = require("./personal_intelligence_evolution/cloud_state_store");
const { SwarmTaskQueue } = require("./personal_intelligence_evolution/swarm_task_queue");
const { runSwarmWorkerTick } = require("./personal_intelligence_evolution/cloud_swarm_worker");
const { requireAdmin, enforceRateLimit } = require("./personal_intelligence_evolution/security_ops");

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization,x-admin-token",
    },
    body: JSON.stringify(obj),
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const rl = enforceRateLimit(event, "worker_tick", Number(env("PI_WORKER_RATE_LIMIT_PER_MIN") || 240), 60000);
  if (!rl.allowed) return json(429, { error: "Rate limit exceeded", rate_limit: rl });

  const auth = requireAdmin(event);
  if (!auth.ok) return json(401, { error: auth.reason });

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) {}
  const store = new CloudStateStore();
  const queue = new SwarmTaskQueue(store);
  const result = await runSwarmWorkerTick(
    queue,
    { graph_summary: { node_count: 0, edge_count: 0 } },
    {
      worker_id: String(body.worker_id || ""),
      max_tasks: Number(body.max_tasks || 1),
      backoff_base_ms: Number(body.backoff_base_ms || 4000),
      lease_seconds: Number(body.lease_seconds || 30),
    }
  );
  return json(200, Object.assign({ ok: true }, result));
};

