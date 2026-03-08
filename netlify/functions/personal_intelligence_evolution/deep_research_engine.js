"use strict";

function nowIso() {
  return new Date().toISOString();
}

function scoreSource(text, source) {
  const q = String(text || "").toLowerCase();
  const title = String(source && source.title || "").toLowerCase();
  const tags = Array.isArray(source && source.tags) ? source.tags.join(" ").toLowerCase() : "";
  let s = 0;
  if (q && title.includes(q.slice(0, 16))) s += 4;
  const words = q.split(/\s+/).filter(Boolean).slice(0, 10);
  words.forEach((w) => {
    if (title.includes(w)) s += 2;
    if (tags.includes(w)) s += 1;
  });
  return s;
}

function getLocalSourceCatalog() {
  return [
    { id: "lk_moe", title: "Sri Lanka Ministry of Education", url: "https://moe.gov.lk", tags: ["sri lanka", "education", "school"] },
    { id: "nie_lk", title: "National Institute of Education Sri Lanka", url: "https://nie.lk", tags: ["curriculum", "grade 9", "learning"] },
    { id: "khan", title: "Khan Academy", url: "https://www.khanacademy.org", tags: ["math", "science", "practice"] },
    { id: "geeksforgeeks", title: "GeeksforGeeks", url: "https://www.geeksforgeeks.org", tags: ["coding", "algorithms", "ict"] },
  ];
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs || 6000))) : null;
  try {
    const res = await fetch(url, { method: "GET", signal: controller ? controller.signal : undefined });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function getLiveSourceCatalog() {
  const feeds = String(process.env.PI_RESEARCH_SOURCE_FEEDS || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6);
  if (!feeds.length) return [];
  const merged = [];
  for (const url of feeds) {
    const data = await fetchWithTimeout(url, Number(process.env.PI_RESEARCH_FETCH_TIMEOUT_MS || 6000));
    const rows = Array.isArray(data) ? data : (data && Array.isArray(data.sources) ? data.sources : []);
    rows.forEach((r, idx) => {
      const title = String(r && r.title || "").trim();
      const link = String(r && r.url || "").trim();
      if (!title || !link) return;
      merged.push({
        id: String(r && r.id || `live_${merged.length}_${idx}`),
        title,
        url: link,
        tags: Array.isArray(r && r.tags) ? r.tags.map((x) => String(x)) : [],
        source_type: "live",
      });
    });
  }
  return merged.slice(0, 120);
}

async function runDeepResearch(store, envelope, options) {
  const text = String(envelope && envelope.message || "");
  const shouldRun = /research|compare|roadmap|plan|study|master|deep/i.test(text);
  if (!shouldRun) {
    return { ok: true, triggered: false, citations: [], summary: "" };
  }
  const liveCatalog = await getLiveSourceCatalog();
  const catalog = (liveCatalog.length ? liveCatalog : getLocalSourceCatalog());
  const ranked = catalog
    .map((s) => Object.assign({}, s, { score: scoreSource(text, s) }))
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 3);

  const report = {
    id: `research_${Date.now().toString(36)}`,
    at: nowIso(),
    query: text.slice(0, 600),
    stages: ["collect_sources", "rank_sources", "synthesize_findings", "emit_citations"],
    summary: "Deep research report generated with ranked sources and citations.",
    citations: ranked.map((r) => ({ title: r.title, url: r.url, score: r.score, source_type: r.source_type || "catalog" })),
  };

  const loaded = await store.readDoc("deep_research_reports", { reports: [] });
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const doc = loaded.doc && typeof loaded.doc === "object" ? loaded.doc : { reports: [] };
  doc.reports = Array.isArray(doc.reports) ? doc.reports : [];
  doc.reports.push(report);
  if (doc.reports.length > 800) doc.reports = doc.reports.slice(-800);
  const saved = await store.writeDoc("deep_research_reports", doc, loaded.sha || "", "pi-os phase4: append deep research report");
  if (!saved.ok) return { ok: false, error: saved.error };

  return {
    ok: true,
    triggered: true,
    summary: report.summary,
    citations: report.citations,
    report_id: report.id,
    storage: saved.storage,
  };
}

module.exports = {
  runDeepResearch,
};
