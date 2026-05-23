import { WAKE_PHRASES } from "../core/config.js";

export class AuraWakeWordEngine {
  constructor(bus) {
    this.bus = bus;
    this.recognition = null;
    this.active = false;
  }

  start() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.bus.emit("wakeword:unavailable", { reason: "Speech recognition is not supported by this browser." });
      return false;
    }
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";
    this.recognition.onresult = (event) => this.handleResult(event);
    this.recognition.onerror = (event) => this.bus.emit("wakeword:error", { error: event.error || "wakeword error" });
    this.recognition.onend = () => {
      if (this.active) window.setTimeout(() => this.recognition && this.recognition.start(), 300);
    };
    this.active = true;
    try {
      this.recognition.start();
      this.bus.emit("wakeword:listening", { phrases: WAKE_PHRASES });
      return true;
    } catch (error) {
      this.bus.emit("wakeword:error", { error: error.message });
      return false;
    }
  }

  stop() {
    this.active = false;
    if (this.recognition) this.recognition.stop();
  }

  handleResult(event) {
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = String(result[0] && result[0].transcript || "").toLowerCase().trim();
      const phrase = WAKE_PHRASES.find((item) => transcript.includes(item));
      if (phrase) this.bus.emit("wakeword:detected", { phrase, transcript });
      this.bus.emit("captions:update", { speaker: "You", text: transcript, final: result.isFinal });
    }
  }
}
