import { AURA_ENDPOINTS, MODEL_PROVIDERS } from "../core/config.js";
import { clampText } from "../utils/storage.js";

export class AuraMultiAgentHarmony {
  constructor(bus) {
    this.bus = bus;
  }

  async ask({ prompt, memory, context, vision }) {
    const payload = {
      message: prompt,
      prompt,
      context: { memory, live: context, vision },
      providers: MODEL_PROVIDERS.map((provider) => provider.id),
      mode: "aura-live",
    };
    const candidates = await Promise.allSettled([
      this.callHarmony(payload),
      this.callPersonalIntelligence(payload),
      this.callPuter(payload),
    ]);
    const usable = candidates
      .filter((item) => item.status === "fulfilled" && item.value && item.value.text)
      .map((item) => item.value);
    if (!usable.length) {
      throw new Error("Aura Live could not reach an AI provider. Check Puter sign-in or backend connectivity.");
    }
    const best = usable.sort((a, b) => b.confidence - a.confidence)[0];
    const answer = this.synthesize(usable, best);
    this.bus.emit("harmony:complete", { providers: usable, best });
    return { text: answer, providers: usable, confidence: best.confidence };
  }

  async callHarmony(payload) {
    const response = await fetch(AURA_ENDPOINTS.harmonyAsk, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`harmony ${response.status}`);
    const data = await response.json();
    return {
      provider: data.model_used || "harmony",
      text: data.answer || data.text || data.message,
      confidence: Number(data.confidence || 0.78),
    };
  }

  async callPersonalIntelligence(payload) {
    const response = await fetch(AURA_ENDPOINTS.personalAsk, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: payload.prompt, aura_live: true, context: payload.context }),
    });
    if (!response.ok) throw new Error(`personal intelligence ${response.status}`);
    const data = await response.json();
    return {
      provider: data.agent_harmony && data.agent_harmony.model_used ? data.agent_harmony.model_used : "personal-intelligence",
      text: data.answer || data.text || data.message,
      confidence: data.agent_harmony && data.agent_harmony.fallback_used ? 0.62 : 0.82,
    };
  }

  async callPuter(payload) {
    if (!window.puter || !window.puter.ai || typeof window.puter.ai.chat !== "function") {
      throw new Error("Puter chat unavailable");
    }
    const system = [
      "You are Aura Live, a realtime intelligence environment.",
      "Use the supplied memory, context, and vision signals. Do not invent unavailable sensor data.",
      "Be natural, concise, and action-oriented.",
    ].join(" ");
    const result = await window.puter.ai.chat(`${system}\n\nContext:\n${JSON.stringify(payload.context)}\n\nUser:\n${payload.prompt}`);
    const text = result && result.message && result.message.content ? result.message.content : String(result || "");
    return { provider: "puter", text, confidence: 0.72 };
  }

  synthesize(candidates, best) {
    const agreement = candidates.length > 1 ? `\n\nConfidence: ${Math.round(best.confidence * 100)}% via ${best.provider}.` : "";
    return clampText(best.text, 2200) + agreement;
  }
}
