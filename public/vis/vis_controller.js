// vis_controller.js
// Netlify-safe, auto-starts VIS, ES module

import { initHuman, detectFace } from './human_engine.js';
import { initCamera } from './camera_engine.js';
import { createPresenceEngine } from './presence_engine.js';
import { loadProfiles, saveProfile, matchIdentity } from './identity_engine.js';
import { createConfidenceEngine } from './confidence_engine.js';
import { topEmotion } from './emotion_engine.js';
import { saveSession, loadSession } from './session_manager.js';
import { loadAI, pauseAI, resumeAI } from './ai_router.js';

const DETECT_INTERVAL_MS = 300;
const EMBED_FRAMES = 12;

let profiles = [];
let activeUser = null;
let unknownSince = 0;

const presence = createPresenceEngine();
const confidence = createConfidenceEngine();

async function startVIS() {
  // 1️⃣ Init Human.js
  const human = await initHuman();

  // 2️⃣ Init Camera
  const video = await initCamera();

  // 3️⃣ Load Profiles
  profiles = await loadProfiles();

  // 4️⃣ Detection loop
  setInterval(async () => {
    try {
      const result = await human.detect(video);

      if (result.face && result.face.length > 0) {
        const face = result.face[0];

        // 5️⃣ Presence detection
        presence.update(face);

        // 6️⃣ Identity matching
        const match = await matchIdentity(face.embedding, profiles);
        if (match) {
          confidence.update(match.user_id);
          activeUser = match.user_id;
          loadAI(activeUser);
        } else {
          unknownSince += DETECT_INTERVAL_MS;
          if (unknownSince > 700) {
            pauseAI();
          }
        }

        // 7️⃣ Emotion tracking
        const emotion = topEmotion(face.emotion);
        // optionally send emotion to AI for tone adaptation
        // console.log("Emotion:", emotion);
      } else {
        unknownSince += DETECT_INTERVAL_MS;
        if (unknownSince > 700) pauseAI();
      }
    } catch (err) {
      console.error('VIS detection loop error:', err);
    }
  }, DETECT_INTERVAL_MS);
}

// Auto-start VIS on page load
startVIS();

export { startVIS };