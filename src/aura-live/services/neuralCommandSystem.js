import { CLOSE_PATTERNS } from "../core/config.js";

export class AuraNeuralCommandSystem {
  classify(text, context = {}) {
    const input = String(text || "").trim();
    const lower = input.toLowerCase();
    const closing = CLOSE_PATTERNS.some((pattern) => pattern.test(input));
    const vision = /\b(holding|object|page|front of me|camera|see|look|read this|document)\b/i.test(input);
    const preview = /\b(preview|design|draft|plan|workspace|show|open)\b/i.test(input);
    const study = /\b(study|explain|summarize|notes|exam|math|science|english|project)\b/i.test(input);
    const complexity = input.length > 260 || /\b(compare|analyze|plan|strategy|debug|prove|research)\b/i.test(input) ? "deep" : "fast";
    return {
      intent: closing ? "close" : vision ? "vision" : preview ? "preview" : study ? "study" : "conversation",
      reasoningDepth: complexity,
      useMemory: true,
      useVision: vision,
      usePreview: preview,
      personality: context.typing && context.typing.cadenceMs > 0 && context.typing.cadenceMs < 120 ? "calm-slow" : "natural",
    };
  }
}
