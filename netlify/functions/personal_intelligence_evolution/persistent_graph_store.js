"use strict";

function defaultGraph() {
  return {
    schema_version: 1,
    file_kind: "PI Graph Store",
    updated_at: new Date().toISOString(),
    nodes: {},
    edges: [],
  };
}

class PersistentGraphStore {
  constructor(cloudStateStore) {
    this.store = cloudStateStore;
    this.key = "graph_store";
  }

  async load() {
    const got = await this.store.readDoc(this.key, defaultGraph());
    if (!got.ok) return { ok: false, error: got.error };
    return { ok: true, graph: got.doc, sha: got.sha || "", storage: got.storage };
  }

  async save(graph, sha) {
    const doc = graph && typeof graph === "object" ? graph : defaultGraph();
    doc.updated_at = new Date().toISOString();
    const out = await this.store.writeDoc(this.key, doc, sha, "pi-os phase2: update persistent graph store");
    if (!out.ok) return { ok: false, error: out.error };
    return { ok: true, sha: out.sha || "", storage: out.storage };
  }

  async upsertFromFacts(knownFacts) {
    const got = await this.load();
    if (!got.ok) return got;
    const graph = got.graph;
    graph.nodes = graph.nodes && typeof graph.nodes === "object" ? graph.nodes : {};
    graph.edges = Array.isArray(graph.edges) ? graph.edges : [];

    const facts = knownFacts && typeof knownFacts === "object" ? knownFacts : {};
    graph.nodes["user:self"] = {
      id: "user:self",
      type: "user",
      payload: { label: "self" },
      updated_at: new Date().toISOString(),
    };

    Object.keys(facts).forEach((k) => {
      const v = facts[k];
      const value = typeof v === "boolean" ? String(v) : String(v || "").trim();
      if (!value) return;
      const id = `fact:${k}`;
      graph.nodes[id] = {
        id,
        type: "fact",
        payload: { key: k, value: value.slice(0, 220) },
        updated_at: new Date().toISOString(),
      };
      const relation = "has_fact";
      const edgeKey = `user:self|${relation}|${id}`;
      const exists = graph.edges.some((e) => `${e.from}|${e.relation}|${e.to}` === edgeKey);
      if (!exists) graph.edges.push({ from: "user:self", relation, to: id, at: new Date().toISOString() });
    });

    if (graph.edges.length > 8000) graph.edges = graph.edges.slice(-8000);
    const saved = await this.save(graph, got.sha);
    if (!saved.ok) return saved;
    return {
      ok: true,
      graph,
      sha: saved.sha,
      storage: saved.storage,
      summary: {
        node_count: Object.keys(graph.nodes || {}).length,
        edge_count: Array.isArray(graph.edges) ? graph.edges.length : 0,
      },
    };
  }
}

module.exports = {
  PersistentGraphStore,
};

