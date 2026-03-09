(function () {
  function nowIso() {
    return new Date().toISOString();
  }

  function sanitizeUsername(raw) {
    return String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60);
  }

  function buildSystemUserId() {
    return "vis_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
  }

  function buildProfileFileName(username) {
    const safe = sanitizeUsername(username) || "user";
    return safe + ".piuser.json";
  }

  function buildDefaultProfile(username, accountIdentifier, facialSignature) {
    const safe = sanitizeUsername(username) || "user";
    const fileName = buildProfileFileName(safe);
    return {
      file_name: fileName,
      profile_version: 1,
      user_identity: {
        username: safe,
        account_identifier: String(accountIdentifier || "unknown"),
        system_user_id: buildSystemUserId(),
        creation_timestamp: nowIso(),
      },
      facial_signature: facialSignature || {},
      personalization_profile: {
        interests: [],
        behavior_patterns: [],
        conversation_habits: [],
        preferred_interaction_style: "balanced",
        frequently_discussed_topics: [],
        tone_preferences: "adaptive",
      },
      conversation_memory: {
        history: [],
        important_facts: {},
      },
      learned_preferences: {},
      ai_behavior_configuration: {
        preferred_conversation_tone: "adaptive",
        formality_level: "balanced",
        response_length_preference: "balanced",
        technical_explanation_depth: "adaptive",
        humor_professional_balance: "balanced",
      },
      session_state: {
        paused: false,
        assistant_state: "idle",
        pending_messages: [],
        pending_response: null,
        speech_state: {
          active: false,
          text: "",
          started_at_ms: 0,
          provider: "",
        },
        user_instance: {
          profile_file: fileName,
          runtime_key: "vis_instance_" + fileName + "_" + Date.now().toString(36),
        },
        last_active_timestamp: nowIso(),
      },
    };
  }

  window.PI_VIS_PROFILE = {
    nowIso: nowIso,
    sanitizeUsername: sanitizeUsername,
    buildProfileFileName: buildProfileFileName,
    buildDefaultProfile: buildDefaultProfile,
  };
})();
