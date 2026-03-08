"use strict";

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${String(prefix || "task")}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultQueue() {
  return {
    schema_version: 1,
    file_kind: "PI Swarm Queue",
    updated_at: nowIso(),
    tasks: [],
    dead_letter: [],
    metrics: {
      enqueued: 0,
      done: 0,
      retried: 0,
      failed_terminal: 0,
    },
  };
}

class SwarmTaskQueue {
  constructor(cloudStateStore) {
    this.store = cloudStateStore;
    this.key = "swarm_task_queue";
  }

  async load() {
    const got = await this.store.readDoc(this.key, defaultQueue());
    if (!got.ok) return { ok: false, error: got.error };
    const doc = got.doc && typeof got.doc === "object" ? got.doc : defaultQueue();
    doc.tasks = Array.isArray(doc.tasks) ? doc.tasks : [];
    doc.dead_letter = Array.isArray(doc.dead_letter) ? doc.dead_letter : [];
    doc.metrics = doc.metrics && typeof doc.metrics === "object" ? doc.metrics : defaultQueue().metrics;
    return { ok: true, queue: doc, sha: got.sha || "", storage: got.storage };
  }

  async save(queue, sha) {
    const doc = queue && typeof queue === "object" ? queue : defaultQueue();
    doc.updated_at = nowIso();
    const out = await this.store.writeDoc(this.key, doc, sha, "pi-os phase2: update swarm task queue");
    if (!out.ok) return { ok: false, error: out.error };
    return { ok: true, sha: out.sha || "", storage: out.storage };
  }

  _taskTypeFromMessage(message) {
    const t = String(message || "").toLowerCase();
    if (/research|compare|roadmap|master|deep/.test(t)) return "research";
    if (/plan|schedule|strategy|goal/.test(t)) return "planning";
    if (/build|create|generate.*skill/.test(t)) return "skill_generation";
    return "";
  }

  _isReady(task, nowMs) {
    const at = Date.parse(String(task && task.available_at || ""));
    if (!Number.isFinite(at)) return true;
    return at <= nowMs;
  }

  async enqueueFromInteraction(envelope) {
    const taskType = this._taskTypeFromMessage(envelope && envelope.message);
    if (!taskType) return { ok: true, enqueued: false, reason: "no_task_type" };
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const q = loaded.queue;
    const payload = {
      message: String(envelope && envelope.message || "").slice(0, 1200),
      known_facts: envelope && envelope.known_facts && typeof envelope.known_facts === "object" ? envelope.known_facts : {},
      created_from: "interaction",
    };
    const duplicate = q.tasks.find((t) =>
      t && t.status === "pending" &&
      t.type === taskType &&
      String(t && t.payload && t.payload.message || "") === payload.message
    );
    if (duplicate) {
      return { ok: true, enqueued: false, reason: "duplicate_pending", task_id: duplicate.id };
    }

    q.tasks.push({
      id: makeId(taskType),
      type: taskType,
      status: "pending",
      priority: taskType === "research" ? 9 : 6,
      attempts: 0,
      max_retries: 3,
      created_at: nowIso(),
      updated_at: nowIso(),
      available_at: nowIso(),
      payload,
      result: null,
      error: "",
    });
    q.metrics.enqueued = Number(q.metrics.enqueued || 0) + 1;
    if (q.tasks.length > 3000) q.tasks = q.tasks.slice(-3000);
    const saved = await this.save(q, loaded.sha);
    if (!saved.ok) return saved;
    return { ok: true, enqueued: true, task_id: q.tasks[q.tasks.length - 1].id, storage: saved.storage };
  }

  async processPending(processor, maxTasks, options) {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const q = loaded.queue;
    const n = Number(maxTasks);
    const limit = Number.isFinite(n) && n > 0 ? Math.min(10, Math.floor(n)) : 3;
    const backoffBaseMs = Math.max(1000, Number(options && options.backoff_base_ms || 4000));
    const workerId = String(options && options.worker_id || "");
    const leaseSeconds = Math.max(5, Number(options && options.lease_seconds || 30));
    const nowMs = Date.now();
    const pending = q.tasks
      .filter((t) => t && t.status === "pending" && this._isReady(t, nowMs))
      .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
      .slice(0, limit);

    const processed = [];
    let retried = 0;
    let deadLettered = 0;
    for (const task of pending) {
      task.status = "in_progress";
      task.updated_at = nowIso();
      task.lease = {
        worker_id: workerId || "single_worker",
        leased_at: nowIso(),
        lease_expires_at: new Date(Date.now() + leaseSeconds * 1000).toISOString(),
      };
      let output = null;
      try {
        output = await processor(task);
        task.status = "done";
        task.available_at = nowIso();
        task.result = output && typeof output === "object" ? output : { ok: true, output: String(output || "") };
        task.error = "";
        q.metrics.done = Number(q.metrics.done || 0) + 1;
      } catch (e) {
        task.attempts = Number(task.attempts || 0) + 1;
        const maxRetries = Math.max(0, Number(task.max_retries || 0));
        task.error = String(e && e.message || e || "task failed");
        if (task.attempts <= maxRetries) {
          const waitMs = backoffBaseMs * Math.pow(2, Math.max(0, task.attempts - 1));
          task.status = "pending";
          task.available_at = new Date(Date.now() + waitMs).toISOString();
          retried += 1;
          q.metrics.retried = Number(q.metrics.retried || 0) + 1;
        } else {
          task.status = "dead_letter";
          task.available_at = nowIso();
          deadLettered += 1;
          q.metrics.failed_terminal = Number(q.metrics.failed_terminal || 0) + 1;
          q.dead_letter.push({
            id: task.id,
            type: task.type,
            attempts: task.attempts,
            max_retries: maxRetries,
            payload: task.payload,
            error: task.error,
            moved_at: nowIso(),
          });
          if (q.dead_letter.length > 800) q.dead_letter = q.dead_letter.slice(-800);
        }
      }
      task.updated_at = nowIso();
      processed.push({
        id: task.id,
        type: task.type,
        status: task.status,
        worker_id: task.lease && task.lease.worker_id ? task.lease.worker_id : "",
      });
    }

    const saved = await this.save(q, loaded.sha);
    if (!saved.ok) return saved;
    return {
      ok: true,
      processed,
      retried_count: retried,
      dead_lettered_count: deadLettered,
      queue_size: q.tasks.length,
      pending_count: q.tasks.filter((t) => t && t.status === "pending").length,
      dead_letter_count: q.dead_letter.length,
      metrics: q.metrics,
      storage: saved.storage,
    };
  }
}

module.exports = {
  SwarmTaskQueue,
};
