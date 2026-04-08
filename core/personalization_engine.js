function cleanText(value, fallback = "") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function asArray(value, limit = 12) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item)).filter(Boolean).slice(0, limit);
  }
  return cleanText(value)
    .split(/[,;\n]/)
    .map((item) => cleanText(item))
    .filter(Boolean)
    .slice(0, limit);
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
}

function buildStructuredProfile(input = {}) {
  const answers = asObject(input.answers || input.personalization_answers || input.personalization_data);
  const identity = asObject(input.identity || input.user || {});

  return {
    interests: asArray(answers.interests),
    communication_style: cleanText(
      answers.communication_style || answers.preferred_tone || answers.preferred_style,
      "adaptive"
    ),
    tone: cleanText(answers.tone || answers.preferred_tone, "adaptive"),
    goals: asArray(answers.goals),
    behavior_preferences: Object.assign(
      {
        learning_style: cleanText(answers.learning_style, "adaptive"),
        response_length: cleanText(answers.response_length, "balanced"),
        language: cleanText(answers.preferred_language || input.language, "English"),
      },
      asObject(answers.behavior_preferences)
    ),
    identity_snapshot: {
      name: cleanText(identity.name || answers.preferred_name || answers.full_name),
      email: cleanText(identity.email),
      avatar: cleanText(identity.avatar),
    },
    onboarding_answers: answers,
  };
}

function generateAIConfig(profile = {}) {
  const interests = asArray(profile.interests);
  const goals = asArray(profile.goals);
  const behavior = asObject(profile.behavior_preferences);
  const tone = cleanText(profile.tone, "adaptive");
  const communicationStyle = cleanText(profile.communication_style, "adaptive");

  return {
    tone,
    communication_style: communicationStyle,
    response_preferences: {
      length: cleanText(behavior.response_length, "balanced"),
      depth: cleanText(behavior.depth, "adaptive"),
      format: cleanText(behavior.format, "adaptive"),
    },
    memory_policy: {
      save_user_preferences: true,
      save_conversation_facts: true,
      instant_reload: true,
    },
    routing_hints: {
      preferred_models: asArray(behavior.preferred_models, 6),
      strong_topics: interests.slice(0, 6),
      active_goals: goals.slice(0, 6),
    },
  };
}

function buildPersonalizationPrompt(input = {}) {
  const profile = input.personalization_data ? input.personalization_data : buildStructuredProfile(input);
  const aiConfig = input.ai_config ? input.ai_config : generateAIConfig(profile);
  const name = cleanText(profile.identity_snapshot && profile.identity_snapshot.name, "the user");

  return [
    "Personalization Profile",
    `User: ${name}`,
    `Tone: ${cleanText(aiConfig.tone, "adaptive")}`,
    `Communication Style: ${cleanText(aiConfig.communication_style, "adaptive")}`,
    `Interests: ${asArray(profile.interests).join(", ") || "none yet"}`,
    `Goals: ${asArray(profile.goals).join(", ") || "none yet"}`,
    `Behavior Preferences: ${JSON.stringify(asObject(profile.behavior_preferences))}`,
    "Personalize responses to be consistent with this profile while staying accurate and concise.",
  ].join("\n");
}

function buildUserProfileRecord(input = {}) {
  const identity = asObject(input.identity || input.user || {});
  const personalization_data = buildStructuredProfile(input);
  const ai_config = generateAIConfig(personalization_data);

  return {
    user_id: cleanText(input.user_id || identity.user_id || identity.uid || identity.email),
    personalization_data,
    ai_config,
    personalization_prompt: buildPersonalizationPrompt({ personalization_data, ai_config }),
  };
}

module.exports = {
  buildStructuredProfile,
  generateAIConfig,
  buildPersonalizationPrompt,
  buildUserProfileRecord,
};
