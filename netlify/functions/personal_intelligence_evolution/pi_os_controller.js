"use strict";

const { routeRequest } = require("./hybrid_router");
const { updateGraphFromFacts } = require("./knowledge_graph");
const { updateWorldModel } = require("./world_model");
const { runReasoningHierarchy } = require("./hierarchical_reasoning");
const { runAgentCivilization } = require("./agent_civilization");
const { runAutonomousResearch } = require("./autonomous_research");
const { buildPredictions } = require("./predictive_intelligence");
const { evaluateSafety } = require("./safety_governor");
const { maybeGrowSkillTree } = require("./skill_tree");

function runPIOsCycle(state, envelope, memorySnapshot, weaknesses) {
  const route = routeRequest(envelope);
  const graph = updateGraphFromFacts(state, envelope && envelope.known_facts);
  const worldModel = updateWorldModel(state, envelope, memorySnapshot);
  const reasoning = runReasoningHierarchy(envelope, state);
  const agents = runAgentCivilization(envelope, { route, reasoning });
  const research = runAutonomousResearch(envelope);
  const predictive = buildPredictions(memorySnapshot, worldModel);
  const safety = evaluateSafety(envelope, envelope && envelope.module_id);
  const tree = maybeGrowSkillTree(state, envelope, weaknesses);

  return {
    runtime: {
      mode: route.runtime_mode,
      target: route.target,
      route_reason: route.reason,
    },
    knowledge_graph: {
      node_count: Object.keys(graph.nodes || {}).length,
      edge_count: Array.isArray(graph.edges) ? graph.edges.length : 0,
      updated_at: graph.updated_at,
    },
    world_model: {
      goals: (worldModel.user && worldModel.user.goals ? worldModel.user.goals.length : 0),
      interests: (worldModel.user && worldModel.user.interests ? worldModel.user.interests.length : 0),
      events: Array.isArray(worldModel.events) ? worldModel.events.length : 0,
      location: worldModel.environment && worldModel.environment.location ? worldModel.environment.location : "",
    },
    hierarchical_reasoning: reasoning,
    agent_civilization: agents,
    autonomous_research: research,
    predictive_intelligence: predictive,
    safety,
    skill_tree: tree,
    sri_lanka_layer: {
      languages: ["Sinhala", "Tamil", "English"],
      locale_mode: "LK_context_ready",
    },
  };
}

module.exports = {
  runPIOsCycle,
};

