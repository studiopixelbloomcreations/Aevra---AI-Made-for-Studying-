const crypto = require("crypto");

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function generateUniqueId(config = {}) {
  return crypto
    .createHash("sha256")
    .update(stableStringify(config))
    .digest("hex");
}

module.exports = {
  generateUniqueId,
};
