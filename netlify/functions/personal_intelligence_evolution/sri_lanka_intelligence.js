"use strict";

function detectLocaleHints(envelope) {
  const text = String(envelope && envelope.message || "").toLowerCase();
  const hasSinhala = /සිංහල|sinhala/.test(text);
  const hasTamil = /தமிழ்|tamil/.test(text);
  const hasLk = /sri lanka|colombo|kandy|galle|kurunegala|lk/.test(text);
  return { hasSinhala, hasTamil, hasLk };
}

async function runSriLankaLayer(store, envelope) {
  const hints = detectLocaleHints(envelope);
  const loaded = await store.readDoc("sri_lanka_layer", { runs: [] });
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const doc = loaded.doc && typeof loaded.doc === "object" ? loaded.doc : { runs: [] };
  doc.runs = Array.isArray(doc.runs) ? doc.runs : [];
  doc.runs.push({
    at: new Date().toISOString(),
    locale_hints: hints,
    supported_languages: ["Sinhala", "Tamil", "English"],
  });
  if (doc.runs.length > 800) doc.runs = doc.runs.slice(-800);
  const saved = await store.writeDoc("sri_lanka_layer", doc, loaded.sha || "", "pi-os phase8: update sri lanka intelligence layer");
  if (!saved.ok) return { ok: false, error: saved.error };

  return {
    ok: true,
    locale_detected: hints.hasLk || hints.hasSinhala || hints.hasTamil,
    language_mode: hints.hasSinhala ? "Sinhala" : (hints.hasTamil ? "Tamil" : "English"),
    storage: saved.storage,
  };
}

module.exports = {
  runSriLankaLayer,
};

