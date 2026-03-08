"use strict";

function runReasoningHierarchy(envelope, state) {
  const e = envelope && typeof envelope === "object" ? envelope : {};
  const text = String(e.message || "");
  const low = text.toLowerCase();
  const interests = (state && state.world_model && state.world_model.user && state.world_model.user.interests) || [];

  const l1 = {
    level: 1,
    type: "fast_response",
    intent: /homework|explain|help|what|who|when|where|why|how/.test(low) ? "qa_support" : "general_support",
  };
  const l2 = {
    level: 2,
    type: "analysis",
    complexity: /research|compare|plan|project|strategy/.test(low) ? "high" : "medium",
    task: String(e.current_task || l1.intent),
  };
  const l3 = {
    level: 3,
    type: "strategy",
    focus: interests.length ? `align_with_interest:${interests[interests.length - 1]}` : "align_with_goals",
  };
  const l4 = {
    level: 4,
    type: "long_term",
    horizon: "weeks_to_months",
    objective: "compounding_personal_intelligence",
  };

  return {
    levels: [l1, l2, l3, l4],
    chosen_path: l2.complexity === "high" ? "cloud_deep_reasoning" : "cloud_standard_reasoning",
  };
}

module.exports = {
  runReasoningHierarchy,
};

