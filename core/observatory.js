function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function splitQueries(message) {
  const text = normalizeText(message);
  if (!text) return [];

  const parts = text
    .split(/(?:\?\s+)|(?:\n{2,})|(?:\s+(?:also|plus)\s+)/i)
    .map(normalizeText)
    .filter(Boolean);

  if (parts.length > 1) return parts;

  return text
    .split(/\?(?=\s|$)|\.(?=\s+(?:can you|also|and|what|how|why|when)\b)/i)
    .map(normalizeText)
    .filter(Boolean);
}

function classifyType(query) {
  const text = normalizeText(query).toLowerCase();
  if (/(^|\b)(code|coding|debug|bug|stack trace|api|function|javascript|python|sql|react|deploy)(\b|$)/.test(text)) return "coding";
  if (/(^|\b)(research|compare|sources|investigate|deep dive|analyze deeply|evidence|timeline|history of|in depth|detailed analysis|report|pros and cons|tradeoffs)(\b|$)/.test(text)) return "deep_research";
  if ((text.length > 140 && /\b(why|how|compare|analyze|explain|timeline|history|impact|differences)\b/.test(text))) return "deep_research";
  if (/(^|\b)(tutorial|teach|explain|walk me through|step by step|how do i)(\b|$)/.test(text)) return "tutorial";
  if (/(^|\b)(write|story|poem|creative|brainstorm|ideas|lyrics|caption)(\b|$)/.test(text)) return "creative";
  return "casual";
}

function classifyComplexity(query, type, queryCount) {
  const text = normalizeText(query);
  if (type === "deep_research") return "high";
  if (type === "coding") return text.length > 90 ? "high" : "medium";
  if (queryCount > 1) return text.length > 120 ? "high" : "medium";
  if (text.length > 180) return "medium";
  return "low";
}

function requiresMultiModels(type, complexity, queryCount) {
  return queryCount > 1 || type === "deep_research" || complexity === "high";
}

function analyzeInput(message) {
  const original = normalizeText(message);
  const split = splitQueries(original);
  const queries = (split.length ? split : (original ? [original] : [])).map((text, index, all) => {
    const type = classifyType(text);
    const complexity = classifyComplexity(text, type, all.length);
    return {
      id: `q_${index + 1}`,
      text,
      type,
      complexity,
      requires_multi_models: requiresMultiModels(type, complexity, all.length),
    };
  });

  const type = queries[0] ? queries[0].type : "casual";
  const complexity = queries.some((item) => item.complexity === "high")
    ? "high"
    : (queries.some((item) => item.complexity === "medium") ? "medium" : "low");

  return {
    queries,
    type,
    complexity,
    requires_multi_models: requiresMultiModels(type, complexity, queries.length),
  };
}

module.exports = {
  analyzeInput,
  splitQueries,
};
