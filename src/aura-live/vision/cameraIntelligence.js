export class AuraCameraIntelligence {
  constructor(bus) {
    this.bus = bus;
    this.video = null;
    this.stream = null;
    this.lastFrameSummary = null;
    this.processing = false;
  }

  bind(video) {
    this.video = video;
  }

  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.bus.emit("vision:error", { error: "Camera is not supported by this browser." });
      return false;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      if (this.video) {
        this.video.srcObject = this.stream;
        await this.video.play();
      }
      this.bus.emit("vision:started", {});
      this.loop();
      return true;
    } catch (error) {
      this.bus.emit("vision:error", { error: error.message });
      return false;
    }
  }

  stop() {
    if (this.stream) this.stream.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.bus.emit("vision:stopped", {});
  }

  async loop() {
    if (!this.stream || this.processing) return;
    this.processing = true;
    try {
      this.lastFrameSummary = await this.captureFrameSummary();
      this.bus.emit("vision:frame", { summary: this.lastFrameSummary });
    } finally {
      this.processing = false;
      if (this.stream) window.setTimeout(() => this.loop(), 1400);
    }
  }

  async captureFrameSummary() {
    if (!this.video || !this.video.videoWidth) return { status: "waiting-for-frame", at: new Date().toISOString() };
    const canvas = document.createElement("canvas");
    const width = Math.min(640, this.video.videoWidth);
    const scale = width / this.video.videoWidth;
    canvas.width = width;
    canvas.height = Math.round(this.video.videoHeight * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
    const sample = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let brightness = 0;
    let edges = 0;
    for (let i = 0; i < sample.length; i += 64) {
      brightness += (sample[i] + sample[i + 1] + sample[i + 2]) / 3;
      if (Math.abs(sample[i] - sample[i + 4]) > 28) edges += 1;
    }
    const points = Math.max(1, Math.floor(sample.length / 64));
    return {
      status: "frame-ready",
      brightness: Math.round(brightness / points),
      visualComplexity: Math.min(100, Math.round((edges / points) * 100)),
      dimensions: { width: canvas.width, height: canvas.height },
      at: new Date().toISOString(),
    };
  }

  context() {
    return this.lastFrameSummary;
  }
}
