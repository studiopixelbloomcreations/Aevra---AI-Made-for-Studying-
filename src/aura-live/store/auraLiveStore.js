export class AuraLiveStore {
  constructor(bus) {
    this.bus = bus;
    this.state = {
      phase: "startup",
      voiceState: "idle",
      captions: true,
      camera: false,
      messages: [],
      suggestions: [],
      notifications: [],
      providerStatus: [],
    };
  }

  set(partial) {
    this.state = { ...this.state, ...partial };
    this.bus.emit("store:updated", { state: this.state });
  }

  addMessage(message) {
    this.state.messages = [...this.state.messages, { id: `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`, ...message }];
    this.bus.emit("store:updated", { state: this.state });
  }

  notify(text, level = "info") {
    this.state.notifications = [{ text, level, at: new Date().toISOString() }, ...this.state.notifications].slice(0, 6);
    this.bus.emit("store:updated", { state: this.state });
  }
}
