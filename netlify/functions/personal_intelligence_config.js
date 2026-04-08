const { getUserProfile, getUserProfileByUniqueId, saveUserProfile } = require("../../core/agent_comm");
const { buildUserProfileRecord } = require("../../core/personalization_engine");
const { getCurrentUser } = require("../../core/identity_system");
const { generateUniqueId } = require("../../core/unique_id");
const { generateFailsafeIdentity } = require("../../core/failsafe_identity");

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
      const user_id = String((event.queryStringParameters && event.queryStringParameters.user_id) || "").trim();
      const unique_id = String((event.queryStringParameters && event.queryStringParameters.unique_id) || "").trim();
      if (!user_id && !unique_id) {
        return json(400, { ok: false, error: "user_id or unique_id is required" });
      }

      const profile = user_id ? await getUserProfile(user_id) : await getUserProfileByUniqueId(unique_id);
      return json(200, { ok: true, profile });
    }

    if (event.httpMethod === "POST") {
      let payload = {};
      try {
        payload = JSON.parse(event.body || "{}");
      } catch (error) {
        return json(400, { ok: false, error: "Invalid JSON body" });
      }

      const identity = getCurrentUser(payload.identity || payload.user || payload) || {};
      const built = buildUserProfileRecord({
        ...payload,
        identity,
        user_id: payload.user_id || identity.user_id,
      });
      const unique_id = generateUniqueId({
        user_id: built.user_id,
        personalization_data: built.personalization_data,
        ai_config: built.ai_config,
      });
      const fallback = generateFailsafeIdentity(built);
      const saved = await saveUserProfile(built.user_id, {
        personalization_data: built.personalization_data,
        ai_config: Object.assign({}, built.ai_config, {
          personalization_prompt: built.personalization_prompt,
        }),
        unique_id: unique_id || fallback.unique_id,
      });

      return json(200, {
        ok: true,
        profile: saved,
        identity: {
          user_id: built.user_id,
          unique_id: unique_id || fallback.unique_id,
        },
      });
    }

    return json(405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    return json(500, { ok: false, error: String(error && error.message ? error.message : error) });
  }
};
