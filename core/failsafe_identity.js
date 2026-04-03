const crypto = require("crypto");

function generateFallbackIdentity(input = {}) {
  const seed = JSON.stringify({
    user_id: input.user_id || "user",
    prompt: input.prompt || "",
    profile_file: input.profile_file || "",
    at: new Date().toISOString().slice(0, 10),
  });
  const hash = crypto.createHash("md5").update(seed).digest("hex");
  return {
    fallback_id: `fallback_${hash.slice(0, 18)}`,
  };
}

module.exports = {
  generateFallbackIdentity,
};

