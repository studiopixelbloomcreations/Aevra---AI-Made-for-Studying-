"use strict";

function computeRisk(inputs) {
  let risk = 0;
  if (!inputs || !inputs.phase3 || !inputs.phase3.ok) risk += 2;
  if (!inputs || !inputs.phase4 || !inputs.phase4.ok) risk += 2;
  if (!inputs || !inputs.phase6 || !inputs.phase6.ok) risk += 1;
  const dead = Number(inputs && inputs.queue && inputs.queue.dead_letter_count || 0);
  if (dead > 0) risk += Math.min(5, dead);
  return Math.min(10, risk);
}

async function runGovernedRollout(store, inputs) {
  const risk = computeRisk(inputs);
  const mode = risk <= 2 ? "auto_promote" : (risk <= 5 ? "canary" : "hold");
  const loaded = await store.readDoc("governed_rollout", { events: [] });
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const doc = loaded.doc && typeof loaded.doc === "object" ? loaded.doc : { events: [] };
  doc.events = Array.isArray(doc.events) ? doc.events : [];
  const row = {
    id: `rollout_${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    mode,
    risk_score: risk,
    reason: mode === "hold" ? "High runtime risk" : (mode === "canary" ? "Moderate risk" : "Low risk"),
  };
  doc.events.push(row);
  if (doc.events.length > 2000) doc.events = doc.events.slice(-2000);
  const saved = await store.writeDoc("governed_rollout", doc, loaded.sha || "", "pi-os phase9: append governed rollout event");
  if (!saved.ok) return { ok: false, error: saved.error };
  return {
    ok: true,
    rollout_mode: mode,
    risk_score: risk,
    event_id: row.id,
    storage: saved.storage,
  };
}

module.exports = {
  runGovernedRollout,
};

