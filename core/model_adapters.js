const { getModelApiKey } = require("./model_api_registry");

const { env: readEnv } = require("./env");

function env(name, fallback = "") {
  return String(readEnv(name, fallback)).trim();
}

function providerConfig() {
  return {
    openrouter: {
      apiKey: getModelApiKey("openrouter") || env("OPENROUTER_API_KEY"),
      baseUrl: env("PI_OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
      model: env("PI_OPENROUTER_MODEL", "openai/gpt-4o-mini"),
      headers: {
        "HTTP-Referer": env("PI_OPENROUTER_REFERER", "https://aevrav1.netlify.app"),
        "X-Title": env("PI_OPENROUTER_TITLE", "Personal Intelligence"),
      },
    },
    groq: {
      apiKey: getModelApiKey("groq") || env("GROQ_API_KEY"),
      baseUrl: env("PI_GROQ_BASE_URL", "https://api.groq.com/openai/v1"),
      model: env("PI_GROQ_MODEL", "llama-3.1-8b-instant"),
      headers: {},
    },
    grok: {
      apiKey: getModelApiKey("grok"),
      baseUrl: env("PI_GROK_BASE_URL", "https://api.x.ai/v1"),
      model: env("PI_GROK_MODEL", "grok-3-mini"),
      headers: {},
    },
    mistral: {
      apiKey: getModelApiKey("mistral") || env("MISTRAL_API_KEY"),
      baseUrl: env("PI_MISTRAL_BASE_URL", "https://api.mistral.ai/v1"),
      model: env("PI_MISTRAL_MODEL", "mistral-small-latest"),
      headers: {},
    },
    huggingface: {
      apiKey: getModelApiKey("huggingface") || env("HUGGINGFACE_API_KEY"),
      baseUrl: env("PI_HUGGINGFACE_BASE_URL", "https://api-inference.huggingface.co/models"),
      model: env("PI_HUGGINGFACE_MODEL", "meta-llama/Llama-3.1-8B-Instruct"),
      headers: {},
    },
    deepseek: {
      apiKey: getModelApiKey("deepseek") || env("DEEPSEEK_API_KEY"),
      baseUrl: env("PI_DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
      model: env("PI_DEEPSEEK_MODEL", "deepseek-chat"),
      headers: {},
    },
  };
}

function buildMessages(context) {
  const analysis = context && context.analysis ? context.analysis : {};
  const guidance = [
    "You are part of the Personal Intelligence agent system.",
    `Query type: ${String(analysis.type || "casual")}`,
    `Complexity: ${String(analysis.complexity || "low")}`,
    context && context.analysis && context.analysis.requires_multi_models
      ? "Multiple models may contribute. Focus on a concise, high-quality final answer."
      : "Provide the best direct answer you can.",
  ].join("\n");

  return [
    { role: "system", content: guidance },
    { role: "user", content: String((context && (context.council_prompt || context.query || context.seed_answer)) || "").trim() },
  ];
}

async function postChatCompletion(config, context) {
  if (!config || !config.apiKey || !config.baseUrl || !config.model) {
    return { answer: "", error: "provider_not_configured" };
  }
  if (config.provider === "huggingface") return postHuggingFaceInference(config, context);
  const url = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const headers = Object.assign({
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  }, config.headers || {});
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: buildMessages(context),
      temperature: Number(env("PI_MODEL_TEMPERATURE", "0.4")),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      answer: "",
      error: String((data && (data.error && data.error.message || data.error || data.message)) || `http_${response.status}`),
    };
  }
  const answer = String((((data || {}).choices || [])[0] || {}).message && (((data || {}).choices || [])[0] || {}).message.content || "").trim();
  return {
    answer,
    raw: data,
    error: answer ? "" : "empty_answer",
  };
}

function buildHarmonyAdapters() {
  const configs = providerConfig();
  return {
    openrouter: async (context) => postChatCompletion(Object.assign({ provider: "openrouter" }, configs.openrouter), context),
    groq: async (context) => postChatCompletion(Object.assign({ provider: "groq" }, configs.groq), context),
    grok: async (context) => postChatCompletion(Object.assign({ provider: "grok" }, configs.grok), context),
    mistral: async (context) => postChatCompletion(Object.assign({ provider: "mistral" }, configs.mistral), context),
    huggingface: async (context) => postChatCompletion(Object.assign({ provider: "huggingface" }, configs.huggingface), context),
    deepseek: async (context) => postChatCompletion(Object.assign({ provider: "deepseek" }, configs.deepseek), context),
  };
}

async function postHuggingFaceInference(config, context) {
  if (!config || !config.apiKey || !config.baseUrl || !config.model) {
    return { answer: "", error: "provider_not_configured" };
  }
  const prompt = buildMessages(context).map((message) => `${message.role}: ${message.content}`).join("\n\n");
  const url = `${config.baseUrl.replace(/\/$/, "")}/${encodeURIComponent(config.model)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        temperature: Number(env("PI_MODEL_TEMPERATURE", "0.4")),
        max_new_tokens: Number(env("PI_HUGGINGFACE_MAX_NEW_TOKENS", "700")),
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      answer: "",
      error: String((data && (data.error && data.error.message || data.error || data.message)) || `http_${response.status}`),
    };
  }
  const first = Array.isArray(data) ? data[0] : data;
  const generated = String((first && (first.generated_text || first.summary_text || first.text)) || "").trim();
  const answer = generated.startsWith(prompt) ? generated.slice(prompt.length).trim() : generated;
  return { answer, raw: data, error: answer ? "" : "empty_answer" };
}

module.exports = {
  buildHarmonyAdapters,
  providerConfig,
};
