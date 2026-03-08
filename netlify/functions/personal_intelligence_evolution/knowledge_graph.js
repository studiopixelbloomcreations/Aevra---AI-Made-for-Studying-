"use strict";

function ensureGraph(state) {
  const st = state && typeof state === "object" ? state : {};
  if (!st.knowledge_graph) {
    st.knowledge_graph = {
      nodes: {},
      edges: [],
      updated_at: new Date().toISOString(),
    };
  }
  return st.knowledge_graph;
}

function upsertNode(graph, id, type, payload) {
  const nodeId = String(id || "").trim();
  if (!nodeId) return;
  graph.nodes[nodeId] = {
    id: nodeId,
    type: String(type || "fact"),
    payload: payload && typeof payload === "object" ? payload : {},
    updated_at: new Date().toISOString(),
  };
}

function addEdge(graph, from, to, relation) {
  const f = String(from || "").trim();
  const t = String(to || "").trim();
  if (!f || !t || f === t) return;
  const rel = String(relation || "related_to");
  const key = `${f}|${rel}|${t}`;
  const exists = graph.edges.some((e) => `${e.from}|${e.relation}|${e.to}` === key);
  if (exists) return;
  graph.edges.push({ from: f, to: t, relation: rel, at: new Date().toISOString() });
  if (graph.edges.length > 5000) graph.edges = graph.edges.slice(-5000);
}

function updateGraphFromFacts(state, knownFacts) {
  const graph = ensureGraph(state);
  const facts = knownFacts && typeof knownFacts === "object" ? knownFacts : {};
  upsertNode(graph, "user:self", "user", { label: "self" });
  Object.keys(facts).forEach((k) => {
    const v = facts[k];
    const text = typeof v === "boolean" ? String(v) : String(v || "").trim();
    if (!text) return;
    const factId = `fact:${k}`;
    upsertNode(graph, factId, "fact", { key: k, value: text.slice(0, 220) });
    addEdge(graph, "user:self", factId, "has_fact");
  });
  graph.updated_at = new Date().toISOString();
  return graph;
}

module.exports = {
  ensureGraph,
  updateGraphFromFacts,
};

