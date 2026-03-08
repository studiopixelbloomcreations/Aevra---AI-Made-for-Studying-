"use strict";

function defaultDoc() {
  return {
    schema_version: 1,
    layers: {
      user: { nodes: {}, edges: [] },
      skills: { nodes: {}, edges: [] },
      tasks: { nodes: {}, edges: [] },
      interests: { nodes: {}, edges: [] },
      emotion: { nodes: {}, edges: [] },
    },
    updated_at: new Date().toISOString(),
  };
}

function upsertLayerNode(layer, id, payload) {
  const target = layer && typeof layer === "object" ? layer : { nodes: {}, edges: [] };
  target.nodes[id] = { id, payload: payload || {}, updated_at: new Date().toISOString() };
}

async function updateMultiLayerGraph(store, envelope, memorySnapshot) {
  const loaded = await store.readDoc("multilayer_graph", defaultDoc());
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const doc = loaded.doc && typeof loaded.doc === "object" ? loaded.doc : defaultDoc();
  const layers = doc.layers || defaultDoc().layers;

  const facts = envelope && envelope.known_facts && typeof envelope.known_facts === "object" ? envelope.known_facts : {};
  upsertLayerNode(layers.user, "self", {
    name: String(facts.name || ""),
    school: String(facts.school || ""),
    city: String(facts.city || ""),
  });
  const interests = [
    String(facts.favorite_subject || "").trim(),
    String(facts.favorite_sport || "").trim(),
    String(facts.favorite_color || "").trim(),
  ].filter(Boolean);
  interests.forEach((it) => {
    const key = it.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (!key) return;
    upsertLayerNode(layers.interests, `interest:${key}`, { label: it });
  });
  const recent = memorySnapshot && memorySnapshot.short_term_memory && memorySnapshot.short_term_memory.recent_conversation
    ? memorySnapshot.short_term_memory.recent_conversation
    : [];
  upsertLayerNode(layers.tasks, "active_context", { size: recent.length });

  doc.layers = layers;
  doc.updated_at = new Date().toISOString();
  const saved = await store.writeDoc("multilayer_graph", doc, loaded.sha || "", "pi-os phase5: update multilayer graph");
  if (!saved.ok) return { ok: false, error: saved.error };

  return {
    ok: true,
    summary: {
      user_nodes: Object.keys(layers.user.nodes || {}).length,
      skill_nodes: Object.keys(layers.skills.nodes || {}).length,
      task_nodes: Object.keys(layers.tasks.nodes || {}).length,
      interest_nodes: Object.keys(layers.interests.nodes || {}).length,
      emotion_nodes: Object.keys(layers.emotion.nodes || {}).length,
    },
    storage: saved.storage,
  };
}

module.exports = {
  updateMultiLayerGraph,
};

