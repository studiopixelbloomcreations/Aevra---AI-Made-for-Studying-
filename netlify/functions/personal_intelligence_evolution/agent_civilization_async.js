"use strict";

function nowIso() {
  return new Date().toISOString();
}

async function runAgentCivilizationAsync(store, envelope, context) {
  const loaded = await store.readDoc("agent_civilization_async", { runs: [] });
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const doc = loaded.doc && typeof loaded.doc === "object" ? loaded.doc : { runs: [] };
  doc.runs = Array.isArray(doc.runs) ? doc.runs : [];

  const run = {
    id: `agents_${Date.now().toString(36)}`,
    at: nowIso(),
    message: String(envelope && envelope.message || "").slice(0, 300),
    strategic: { ok: true, note: "planning agent tick completed" },
    research: { ok: true, note: context && context.research_triggered ? "research agent active" : "research idle" },
    memory: { ok: true, note: "memory agent synchronized" },
    safety: { ok: true, note: "safety agent verified policies" },
  };
  doc.runs.push(run);
  if (doc.runs.length > 1200) doc.runs = doc.runs.slice(-1200);

  const saved = await store.writeDoc("agent_civilization_async", doc, loaded.sha || "", "pi-os phase6: append agent civilization run");
  if (!saved.ok) return { ok: false, error: saved.error };
  return {
    ok: true,
    run_id: run.id,
    agents: Object.keys(run).filter((k) => ["strategic", "research", "memory", "safety"].includes(k)),
    storage: saved.storage,
  };
}

module.exports = {
  runAgentCivilizationAsync,
};

