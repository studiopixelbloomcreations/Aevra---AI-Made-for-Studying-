const { getUserConfig, saveUserConfig } = require("../../core/agent_comm");
const { buildUserConfig } = require("../../core/personalization_engine");
const { generateUniqueIdentifier } = require("../../core/identity_system");
const { generateFallbackIdentity } = require("../../core/failsafe_identity");

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization",
    },
    body: JSON.stringify(obj),
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  try {
    if (event.httpMethod === "GET") {
      const userId = String((event.queryStringParameters && event.queryStringParameters.user_id) || "").trim();
      if (!userId) return json(400, { ok: false, error: "user_id is required" });
      const config = await getUserConfig(userId);
      return json(200, { ok: true, config });
    }

    if (event.httpMethod === "POST") {
      let payload = {};
      try {
        payload = JSON.parse(event.body || "{}");
      } catch (error) {
        return json(400, { ok: false, error: "Invalid JSON body" });
      }

      const built = buildUserConfig(payload);
      const identity = built.user_id
        ? generateUniqueIdentifier(built)
        : generateFallbackIdentity(payload);
      const config = {
        ...built,
        unique_identifier: identity.unique_identifier || identity.fallback_id,
        source_profile_file: String((payload.profile && payload.profile.file_name) || payload.source_profile_file || "").trim(),
      };
      const saved = await saveUserConfig(config);
      return json(200, {
        ok: true,
        config: saved && saved.user_config ? saved.user_config : config,
        identity,
      });
    }

    return json(405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    return json(500, { ok: false, error: String(error && error.message ? error.message : error) });
  }
};

