"use strict";

const PROTECTED_DOMAINS = [
  "core_brain_logic",
  "security_systems",
  "evolution_controller",
  "main_entrypoint",
];

function evaluateSafety(envelope, proposedDomain) {
  const domain = String(proposedDomain || "").trim();
  const blocked = PROTECTED_DOMAINS.includes(domain);
  return {
    allow: !blocked,
    protected_domains: PROTECTED_DOMAINS.slice(),
    blocked_domain: blocked ? domain : "",
    policy: "cloud_runtime_only_mutation_for_tools_plugins_workflows_behavior",
    timestamp: new Date().toISOString(),
    message_preview: String(envelope && envelope.message || "").slice(0, 200),
  };
}

module.exports = {
  evaluateSafety,
  PROTECTED_DOMAINS,
};

