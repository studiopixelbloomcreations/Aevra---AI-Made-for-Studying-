import { AuraLiveOrchestrator } from "./core/orchestrator.js";

const root = document.getElementById("auraLiveRoot");

if (root) {
  const auraLive = new AuraLiveOrchestrator(root);
  window.AuraLive = auraLive;
  auraLive.start();
}
