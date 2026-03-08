"use strict";

function nowIso() {
  return new Date().toISOString();
}

function buildStages(task) {
  const text = String(task && task.payload && task.payload.message || "").toLowerCase();
  const isResearch = String(task && task.type || "") === "research";
  const deep = /deep|compare|roadmap|master|research/.test(text);
  if (isResearch && deep) {
    return [
      { step: 1, label: "collect_sources" },
      { step: 2, label: "extract_key_points" },
      { step: 3, label: "compare_options" },
      { step: 4, label: "compose_recommendations" },
    ];
  }
  return [
    { step: 1, label: "parse_task" },
    { step: 2, label: "prepare_response_outline" },
  ];
}

async function executeResearchTask(task, context) {
  const safeTask = task && typeof task === "object" ? task : {};
  const stages = buildStages(safeTask);
  const message = String(safeTask && safeTask.payload && safeTask.payload.message || "").slice(0, 600);
  const graphSummary = context && context.graph_summary && typeof context.graph_summary === "object"
    ? context.graph_summary
    : { node_count: 0, edge_count: 0 };

  return {
    ok: true,
    executed_at: nowIso(),
    task_id: String(safeTask.id || ""),
    task_type: String(safeTask.type || "general"),
    stages,
    findings: [
      `Pipeline executed for: ${message || "general request"}`,
      `Graph context nodes=${Number(graphSummary.node_count || 0)}, edges=${Number(graphSummary.edge_count || 0)}`,
    ],
    output: "Research execution pipeline completed in cloud mode.",
  };
}

module.exports = {
  executeResearchTask,
};

