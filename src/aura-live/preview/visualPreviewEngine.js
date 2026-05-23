export class AuraVisualPreviewEngine {
  constructor(bus) {
    this.bus = bus;
    this.current = null;
  }

  show(kind, payload) {
    this.current = { kind, payload, at: new Date().toISOString() };
    this.bus.emit("preview:show", this.current);
  }

  clear() {
    this.current = null;
    this.bus.emit("preview:clear", {});
  }
}
