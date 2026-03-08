"use strict";

function runAutonomousResearch(envelope) {
  const e = envelope && typeof envelope === "object" ? envelope : {};
  const text = String(e.message || "").toLowerCase();
  const needed = /research|compare|roadmap|deep|master|how to/.test(text);
  if (!needed) {
    return {
      triggered: false,
      stages: [],
      output: "",
    };
  }

  const stages = [
    { step: 1, label: "collect_sources" },
    { step: 2, label: "analyze_evidence" },
    { step: 3, label: "compare_options" },
    { step: 4, label: "produce_action_roadmap" },
  ];

  return {
    triggered: true,
    stages,
    output: "Research workflow prepared in cloud mode.",
  };
}

module.exports = {
  runAutonomousResearch,
};

