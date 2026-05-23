export class AuraPuterVoiceSystem {
  constructor(bus) {
    this.bus = bus;
    this.queue = [];
    this.speaking = false;
    this.enabled = true;
    this.currentUtterance = null;
  }

  async speak(text, options = {}) {
    if (!this.enabled || !text) return;
    this.queue.push({ text, options });
    this.bus.emit("voice:queued", { size: this.queue.length });
    this.drain();
  }

  cancel() {
    this.queue = [];
    this.speaking = false;
    try {
      window.speechSynthesis && window.speechSynthesis.cancel();
    } catch (error) {}
    this.bus.emit("voice:cancelled", {});
  }

  async drain() {
    if (this.speaking || !this.queue.length) return;
    const item = this.queue.shift();
    this.speaking = true;
    this.bus.emit("voice:speaking", { text: item.text });
    try {
      if (window.puter && window.puter.ai && typeof window.puter.ai.txt2speech === "function") {
        const audio = await window.puter.ai.txt2speech(item.text, { voice: item.options.voice || "alloy" });
        if (audio && typeof audio.play === "function") await audio.play();
      } else {
        await this.browserSpeak(item.text, item.options);
      }
    } catch (error) {
      this.bus.emit("voice:error", { error: error.message });
    } finally {
      this.speaking = false;
      this.bus.emit("voice:idle", {});
      this.drain();
    }
  }

  browserSpeak(text, options = {}) {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
        resolve();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = options.emotion === "focused" ? 0.94 : 0.98;
      utterance.pitch = 1;
      utterance.onend = resolve;
      utterance.onerror = resolve;
      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    });
  }
}
