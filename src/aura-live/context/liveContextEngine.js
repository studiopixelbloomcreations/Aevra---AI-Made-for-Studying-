export class AuraLiveContextEngine {
  constructor(bus) {
    this.bus = bus;
    this.state = {
      activePage: document.title || "Aura Live",
      recentActions: [],
      typing: { active: false, lastInputAt: null, cadenceMs: 0 },
      currentTools: [],
      recentUploads: [],
      conversationHistory: [],
      updatedAt: new Date().toISOString(),
    };
    this.lastKeyAt = 0;
  }

  start() {
    document.addEventListener("visibilitychange", () => this.capture("visibility", document.visibilityState));
    window.addEventListener("focus", () => this.capture("window", "focus"));
    window.addEventListener("blur", () => this.capture("window", "blur"));
    document.addEventListener("input", (event) => this.onInput(event), true);
    document.addEventListener("change", (event) => this.onChange(event), true);
    this.bus.emit("context:updated", { context: this.state });
  }

  capture(type, label, detail = {}) {
    this.state.recentActions.unshift({ type, label, detail, at: new Date().toISOString() });
    this.state.recentActions = this.state.recentActions.slice(0, 40);
    this.state.activePage = document.title || this.state.activePage;
    this.state.updatedAt = new Date().toISOString();
    this.bus.emit("context:updated", { context: this.state });
  }

  onInput(event) {
    const now = performance.now();
    this.state.typing = {
      active: true,
      lastInputAt: new Date().toISOString(),
      cadenceMs: this.lastKeyAt ? Math.round(now - this.lastKeyAt) : 0,
    };
    this.lastKeyAt = now;
    const target = event.target;
    this.capture("typing", target && target.id ? target.id : "input");
  }

  onChange(event) {
    const target = event.target;
    if (target && target.type === "file") {
      this.state.recentUploads = Array.from(target.files || []).map((file) => ({ name: file.name, type: file.type, size: file.size, at: new Date().toISOString() }));
      this.capture("upload", "files", { count: this.state.recentUploads.length });
    }
  }

  addConversation(role, text) {
    this.state.conversationHistory.push({ role, text, at: new Date().toISOString() });
    this.state.conversationHistory = this.state.conversationHistory.slice(-80);
    this.bus.emit("context:updated", { context: this.state });
  }

  snapshot() {
    return { ...this.state, recentActions: this.state.recentActions.slice(0, 12), conversationHistory: this.state.conversationHistory.slice(-12) };
  }
}
