function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function splitQueries(message) {
  const text = normalizeText(message);
  if (!text) return [];

  const coarse = text
    .split(/\?(?:\s+|$)|\n{2,}|(?:^|\s)(?:\d+[\).]|[-*])\s+/)
    .map(normalizeText)
    .filter(Boolean);

  const expanded = [];
  for (const part of (coarse.length ? coarse : [text])) {
    if (/\b(and|also|plus)\b/i.test(part) && part.length > 120) {
      const pieces = part.split(/\b(?:and|also|plus)\b/i).map(normalizeText).filter(Boolean);
      if (pieces.length > 1) {
        expanded.push(...pieces);
        continue;
      }
    }
    expanded.push(part);
  }
  return expanded.length ? expanded : [text];
}

function classifyType(query) {
  const text = normalizeText(query).toLowerCase();
  if (/(^|\b)(code|debug|bug|stack trace|api|function|javascript|python|sql|react|deploy)(\b|$)/.test(text)) return "code";
  if (/(^|\b)(write|story|poem|creative|brainstorm|idea|design copy)(\b|$)/.test(text)) return "creative";
  if (/(^|\b)(research|compare|analyze deeply|evidence|sources|study this|investigate)(\b|$)/.test(text)) return "deep_research";
  if (/(^|\b)(teach|tutorial|explain|walk me through|step by step|how do i)(\b|$)/.test(text)) return "tutorial";
  if ((text.match(/\?/g) || []).length > 1 || /\b(first|second|third|multiple|several|all of these)\b/.test(text)) return "multi_question";
  return "casual";
}

function classifyComplexity(query, type) {
  const text = normalizeText(query);
  if (type === "deep_research" || type === "code") return "high";
  if (type === "tutorial" || type === "multi_question") return text.length > 140 ? "high" : "medium";
  return text.length > 180 ? "medium" : "low";
}

function requiresMultiModels(type, complexity, queryCount) {
  if (queryCount > 1) return true;
  if (type === "deep_research" || type === "multi_question") return true;
  return complexity === "high";
}

function analyzeQuery(query, index, total) {
  const type = classifyType(query);
  const complexity = classifyComplexity(query, type);
  return {
    id: `q_${index + 1}`,
    text: normalizeText(query),
    type,
    complexity,
    requires_multi_models: requiresMultiModels(type, complexity, total),
  };
}

function analyzeInput(message, options = {}) {
  const queries = splitQueries(message).map((query, index, all) => analyzeQuery(query, index, all.length));
  return {
    queries,
    context_analysis: {
      original_message: normalizeText(message),
      total_queries: queries.length,
      dominant_type: queries[0] ? queries[0].type : "casual",
      max_complexity: queries.some((q) => q.complexity === "high")
        ? "high"
        : (queries.some((q) => q.complexity === "medium") ? "medium" : "low"),
      requires_multi_models: queries.some((q) => q.requires_multi_models),
      has_history: Array.isArray(options.history) && options.history.length > 0,
      has_identity_context: !!(options.user_id || options.unique_identifier),
    },
  };
}

module.exports = {
  analyzeInput,
  analyzeQuery,
  splitQueries,
};

