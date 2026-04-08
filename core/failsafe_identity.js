const { generateUniqueId } = require("./unique_id");

function generateFailsafeIdentity(input = {}) {
  const user_id = String(input.user_id || "").trim();
  try {
    const unique_id = generateUniqueId({
      user_id,
      personalization_data: input.personalization_data || {},
      ai_config: input.ai_config || {},
    });
    if (unique_id) {
      return {
        user_id,
        unique_id,
        source: "config_hash",
      };
    }
  } catch (error) {}

  return {
    user_id,
    unique_id: `${user_id || "user"}_${Date.now()}`,
    source: "user_timestamp",
  };
}

module.exports = {
  generateFailsafeIdentity,
};
