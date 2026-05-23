export const FEATURES = Object.freeze({
  legacyPersonalIntelligence: false,
  auraLive: true,
});

export const AURA_ENDPOINTS = Object.freeze({
  personalConfig: "/personal-intelligence/config",
  personalAsk: "/personal-intelligence/ask",
  realtimeSession: "/personal-intelligence/realtime/session",
  memoryGraph: "/memory/graph",
  harmonyAsk: "/harmony/ask",
});

export const WAKE_PHRASES = Object.freeze(["aura", "hey aura"]);

export const CLOSE_PATTERNS = Object.freeze([
  /that's all for today\s+aura/i,
  /goodnight\s+aura/i,
  /close\s+aura/i,
  /shutdown\s+aura/i,
]);

export const STORAGE_KEYS = Object.freeze({
  memory: "aura_live_memory_graph_v1",
  sessions: "aura_live_sessions_v1",
  preferences: "aura_live_preferences_v1",
  state: "aura_live_state_v1",
});

export const MODEL_PROVIDERS = Object.freeze([
  { id: "groq", label: "Groq", endpoint: "/harmony/ask" },
  { id: "openrouter", label: "OpenRouter", endpoint: "/personal-intelligence/ask" },
  { id: "mistral", label: "Mistral", endpoint: "/personal-intelligence/ask" },
  { id: "huggingface", label: "HuggingFace", endpoint: "/personal-intelligence/ask" },
  { id: "deepseek", label: "DeepSeek", endpoint: "/personal-intelligence/ask" },
]);
