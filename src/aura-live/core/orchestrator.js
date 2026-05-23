import { AuraEventBus } from "./eventBus.js";
import { AuraMemoryGraphEngine } from "../memory/memoryGraphEngine.js";
import { AuraLiveContextEngine } from "../context/liveContextEngine.js";
import { AuraWakeWordEngine } from "../wakeword/wakeWordEngine.js";
import { AuraPuterVoiceSystem } from "../voice/puterVoiceSystem.js";
import { AuraCameraIntelligence } from "../vision/cameraIntelligence.js";
import { AuraMultiAgentHarmony } from "../services/multiAgentHarmony.js";
import { AuraNeuralCommandSystem } from "../services/neuralCommandSystem.js";
import { AuraVisualPreviewEngine } from "../preview/visualPreviewEngine.js";
import { AuraLiveStore } from "../store/auraLiveStore.js";
import { createAuraLiveView } from "../components/auraLiveView.js";

export class AuraLiveOrchestrator {
  constructor(root) {
    this.bus = new AuraEventBus();
    this.store = new AuraLiveStore(this.bus);
    this.memory = new AuraMemoryGraphEngine(this.bus);
    this.context = new AuraLiveContextEngine(this.bus);
    this.wakeword = new AuraWakeWordEngine(this.bus);
    this.voice = new AuraPuterVoiceSystem(this.bus);
    this.vision = new AuraCameraIntelligence(this.bus);
    this.harmony = new AuraMultiAgentHarmony(this.bus);
    this.commands = new AuraNeuralCommandSystem();
    this.preview = new AuraVisualPreviewEngine(this.bus);
    this.view = createAuraLiveView(root, this);
    this.vision.bind(this.view.els.camera);
    this.bindEvents();
  }

  async start() {
    document.title = "Aura Live";
    this.context.start();
    await this.memory.loadRemoteState(this.getIdentity());
    const greeting = this.memory.buildGreeting();
    this.store.addMessage({ role: "assistant", text: greeting, at: new Date().toISOString() });
    this.context.addConversation("assistant", greeting);
    this.view.renderMemory(this.memory.retrieveContext());
    this.store.set({ phase: "ready", suggestions: this.suggest() });
    this.voice.speak(greeting, { emotion: "focused" });
    window.setTimeout(() => this.view.els.startup.classList.add("is-done"), 1100);
  }

  bindEvents() {
    this.bus.on("store:updated", ({ state }) => this.view.render(state));
    this.bus.on("memory:updated", () => this.view.renderMemory(this.memory.retrieveContext()));
    this.bus.on("context:updated", ({ context }) => this.view.renderContext(context));
    this.bus.on("captions:update", (item) => this.view.renderCaption(item));
    this.bus.on("vision:frame", ({ summary }) => this.view.renderVision(summary));
    this.bus.on("preview:show", (preview) => this.view.renderPreview(preview));
    this.bus.on("voice:speaking", ({ text }) => {
      this.store.set({ voiceState: "speaking" });
      this.view.renderCaption({ speaker: "Aura", text });
    });
    this.bus.on("voice:idle", () => this.store.set({ voiceState: "idle" }));
    this.bus.on("wakeword:detected", async () => {
      this.store.notify("Wake word detected. Aura Live is active.");
      await this.activate();
    });
    this.bus.on("wakeword:error", ({ error }) => this.store.notify(error, "warning"));
    this.bus.on("vision:error", ({ error }) => this.store.notify(error, "warning"));
    this.view.bindSuggestions();
  }

  async activate() {
    await this.memory.loadRemoteState(this.getIdentity());
    this.store.set({ phase: "ready", suggestions: this.suggest() });
  }

  async handleUserText(text) {
    this.voice.cancel();
    const liveContext = this.context.snapshot();
    const command = this.commands.classify(text, liveContext);
    this.store.addMessage({ role: "user", text, at: new Date().toISOString() });
    this.context.addConversation("user", text);
    this.memory.rememberInteraction("user", text, { focus: command.intent });
    if (command.intent === "close") {
      await this.closeFlow();
      return;
    }
    this.store.set({ phase: "thinking", suggestions: [] });
    try {
      const result = await this.harmony.ask({
        prompt: text,
        memory: this.memory.retrieveContext(),
        context: liveContext,
        vision: command.useVision ? this.vision.context() : null,
      });
      this.store.addMessage({ role: "assistant", text: result.text, at: new Date().toISOString() });
      this.context.addConversation("assistant", result.text);
      this.memory.rememberInteraction("assistant", result.text, { providers: result.providers });
      if (command.usePreview) this.preview.show("workspace", { prompt: text, response: result.text });
      this.store.set({ phase: "ready", providerStatus: result.providers, suggestions: this.suggest(text, result.text) });
      await this.voice.speak(result.text, { emotion: command.personality === "calm-slow" ? "focused" : "natural" });
    } catch (error) {
      const message = error.message || "Aura Live could not complete the request.";
      this.store.addMessage({ role: "assistant", text: message, at: new Date().toISOString() });
      this.store.set({ phase: "ready", suggestions: this.suggest() });
      this.store.notify(message, "error");
    }
  }

  async closeFlow() {
    this.store.set({ phase: "closing", voiceState: "closing" });
    const session = this.memory.closeSession();
    const goodbye = session.summary ? `Session saved. I compressed today's work so we can continue next time.` : "Session saved. Goodnight.";
    this.store.addMessage({ role: "assistant", text: goodbye, at: new Date().toISOString() });
    await this.voice.speak(goodbye, { emotion: "focused" });
    document.querySelector(".aura-live-root").classList.add("is-closing");
  }

  async handleAction(action) {
    if (action === "wake") this.wakeword.start();
    if (action === "captions") this.store.set({ captions: !this.store.state.captions });
    if (action === "camera") {
      if (this.store.state.camera) {
        this.vision.stop();
        this.store.set({ camera: false });
      } else {
        const started = await this.vision.start();
        this.store.set({ camera: started });
      }
    }
    if (action === "close") this.closeFlow();
  }

  suggest(input = "", answer = "") {
    const memory = this.memory.retrieveContext();
    const base = [];
    if (memory.unfinishedWork && memory.unfinishedWork[0]) base.push("Continue project");
    if (/notes|explain|study|summary/i.test(`${input} ${answer}`)) base.push("Create summary", "Generate notes");
    if (/draft|preview|design|plan/i.test(`${input} ${answer}`)) base.push("Open previous draft");
    base.push("Make a study plan", "Review weak areas");
    return Array.from(new Set(base)).slice(0, 4);
  }

  getIdentity() {
    try {
      if (window.Auth && typeof window.Auth.getUser === "function") return window.Auth.getUser();
    } catch (error) {}
    return { user_id: localStorage.getItem("g9_email") || "guest@student.com" };
  }
}
