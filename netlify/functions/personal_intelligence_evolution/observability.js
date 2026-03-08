"use strict";

function nowIso() {
  return new Date().toISOString();
}

async function appendObservabilityEvent(store, eventType, payload) {
  const loaded = await store.readDoc("observability_events", { events: [] });
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const doc = loaded.doc && typeof loaded.doc === "object" ? loaded.doc : { events: [] };
  doc.events = Array.isArray(doc.events) ? doc.events : [];
  doc.events.push({
    id: `obs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    at: nowIso(),
    type: String(eventType || "event"),
    payload: payload && typeof payload === "object" ? payload : {},
  });
  if (doc.events.length > 3000) doc.events = doc.events.slice(-3000);
  const saved = await store.writeDoc("observability_events", doc, loaded.sha || "", "pi-os observability event");
  if (!saved.ok) return { ok: false, error: saved.error };
  return { ok: true, storage: saved.storage };
}

module.exports = {
  appendObservabilityEvent,
};

