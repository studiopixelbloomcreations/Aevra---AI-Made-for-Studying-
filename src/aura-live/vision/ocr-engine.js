// src/aura-live/vision/ocr-engine.js
"use strict";

class OCREngine {
  constructor(options = {}) {
    this.confidenceThreshold = options.confidenceThreshold || 0.6;
    this.lang = options.lang || 'eng';
    this.worker = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return { success: true };
    try {
      if (typeof Tesseract === 'undefined') {
        return { success: true };
      }
      this.worker = Tesseract.createWorker({ logger: () => {} });
      await this.worker.load();
      await this.worker.loadLanguage(this.lang);
      await this.worker.initialize(this.lang);
      this.isInitialized = true;
      return { success: true };
    } catch (error) {
      this.isInitialized = false;
      return { success: false, error: error.message };
    }
  }

  async recognize(imageData) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    if (!this.worker) {
      return "";
    }
    try {
      let img;
      if (imageData instanceof ImageData) {
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);
        img = canvas;
      } else if (imageData instanceof HTMLImageElement ||
                 imageData instanceof HTMLVideoElement ||
                 imageData instanceof HTMLCanvasElement) {
        img = imageData;
      } else {
        return "";
      }
      const result = await this.worker.recognize(img);
      return (result.data.text || "").trim();
    } catch (error) {
      return "";
    }
  }

  async shutdown() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
    this.isInitialized = false;
    return { success: true };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = OCREngine;
} else {
  window.OCREngine = OCREngine;
}