// src/aura-live/vision/object-detector.js
"use strict";

class ObjectDetector {
  constructor(options = {}) {
    this.confidenceThreshold = options.confidenceThreshold || 0.6;
    this.modelUrl = options.modelUrl || 'https://tfhub.dev/google/tfjs-model/ssd_mobilenet_v1/1/default/1';
    this.model = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return { success: true };
    this.isInitialized = true;
    return { success: true };
  }

  async detect(imageData) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    try {
      if (typeof tf !== 'undefined' && window.cocoSsd) {
        const model = await window.cocoSsd.load();
        const predictions = await model.detect(imageData);
        return predictions
          .filter(p => p.score >= this.confidenceThreshold)
          .map(p => ({
            label: p.class,
            confidence: parseFloat(p.score.toFixed(4)),
            bbox: { x: p.bbox[0], y: p.bbox[1], width: p.bbox[2], height: p.bbox[3] }
          }));
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  async shutdown() {
    this.isInitialized = false;
    return { success: true };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = ObjectDetector;
} else {
  window.ObjectDetector = ObjectDetector;
}