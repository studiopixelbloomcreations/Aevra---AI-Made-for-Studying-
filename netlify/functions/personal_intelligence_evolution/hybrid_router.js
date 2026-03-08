"use strict";

function routeRequest(envelope) {
  const e = envelope && typeof envelope === "object" ? envelope : {};
  const mode = String(process.env.PI_RUNTIME_MODE || "cloud_only").trim().toLowerCase();
  const text = String(e.message || "").toLowerCase();
  const wantsResearch = /research|compare|analy|roadmap|deep|plan/i.test(text);
  const wantsLongReasoning = /step by step|strategy|long term|project|career/i.test(text);

  if (mode === "cloud_only") {
    return {
      runtime_mode: "cloud_only",
      target: "cloud",
      reason: wantsResearch || wantsLongReasoning ? "complex_cloud_reasoning" : "cloud_policy_forced",
    };
  }

  if (wantsResearch || wantsLongReasoning) {
    return { runtime_mode: "hybrid", target: "cloud", reason: "complex_cloud_reasoning" };
  }
  return { runtime_mode: "hybrid", target: "local", reason: "fast_local_reasoning" };
}

module.exports = {
  routeRequest,
};

