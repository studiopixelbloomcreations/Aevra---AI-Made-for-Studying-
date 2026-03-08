"use strict";

function runAgentCivilization(envelope, context) {
  const e = envelope && typeof envelope === "object" ? envelope : {};
  const c = context && typeof context === "object" ? context : {};
  const text = String(e.message || "").toLowerCase();

  const strategic = [
    { agent: "chief_intelligence", decision: "orchestrate_cycle" },
    { agent: "planning_agent", decision: /exam|study|plan/.test(text) ? "build_learning_plan" : "maintain_dialog_strategy" },
    { agent: "world_model_agent", decision: "update_user_simulation" },
    { agent: "evolution_agent", decision: "queue_improvement_if_weakness_detected" },
    { agent: "safety_agent", decision: "apply_policy_guardrails" },
  ];

  const operational = [
    { agent: "conversation_agent", task: "respond_to_user" },
    { agent: "research_agent", task: /research|compare|roadmap/.test(text) ? "deep_research" : "light_retrieval" },
    { agent: "skill_agent", task: "select_or_create_skill" },
    { agent: "memory_agent", task: "persist_interaction_memory" },
    { agent: "automation_agent", task: "prepare_tool_actions" },
    { agent: "reflection_agent", task: "score_outcome_and_feedback" },
  ];

  return {
    strategic,
    operational,
    coordination_mode: c.route && c.route.target === "cloud" ? "cloud_swarm" : "local_fastpath",
  };
}

module.exports = {
  runAgentCivilization,
};

