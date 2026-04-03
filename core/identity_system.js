const crypto = require("crypto");

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function generateUniqueIdentifier(config = {}) {
  const userId = String(config.user_id || "user");
  const digest = crypto.createHash("sha256").update(stableStringify(config)).digest("hex");
  return {
    user_id: userId,
    unique_identifier: `${userId}_${digest.slice(0, 24)}`,
    binary_signature: digest
      .slice(0, 16)
      .split("")
      .map((ch) => parseInt(ch, 16).toString(2).padStart(4, "0"))
      .join(""),
  };
}

module.exports = {
  generateUniqueIdentifier,
};

