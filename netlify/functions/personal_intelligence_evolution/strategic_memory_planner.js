"use strict";

function defaultStrategic() {
  return {
    schema_version: 1,
    horizons: {
      short: [],
      medium: [],
      long: [],
    },
    updated_at: new Date().toISOString(),
  };
}

function extractGoals(facts, message) {
  const out = [];
  if (facts.goal) out.push(String(facts.goal).slice(0, 160));
  const m = String(message || "");
  const match = m.match(/\b(?:my goal is|i want to|i need to)\s+(.{3,140})/i);
  if (match && match[1]) out.push(String(match[1]).trim().slice(0, 160));
  return out;
}

async function runStrategicPlanner(store, envelope) {
  const loaded = await store.readDoc("strategic_memory", defaultStrategic());
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const doc = loaded.doc && typeof loaded.doc === "object" ? loaded.doc : defaultStrategic();
  const facts = envelope && envelope.known_facts && typeof envelope.known_facts === "object" ? envelope.known_facts : {};
  const goals = extractGoals(facts, envelope && envelope.message);

  goals.forEach((g) => {
    const row = { id: `goal_${Date.now().toString(36)}`, text: g, at: new Date().toISOString() };
    doc.horizons.long.push(row);
  });
  if (doc.horizons.long.length > 500) doc.horizons.long = doc.horizons.long.slice(-500);
  doc.updated_at = new Date().toISOString();
  const saved = await store.writeDoc("strategic_memory", doc, loaded.sha || "", "pi-os phase5: update strategic memory");
  if (!saved.ok) return { ok: false, error: saved.error };

  return {
    ok: true,
    long_horizon_goals: doc.horizons.long.length,
    storage: saved.storage,
  };
}

module.exports = {
  runStrategicPlanner,
};

