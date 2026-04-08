const { generateUniqueId } = require("./unique_id");

function normalizeUser(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const user_id = String(source.user_id || source.uid || source.id || source.email || "").trim();
  const email = String(source.email || "").trim();
  const name = String(source.name || source.displayName || "").trim();
  const avatar = String(source.avatar || source.photoURL || source.photo_url || "").trim();

  if (!user_id) return null;
  return {
    user_id,
    email,
    name,
    avatar,
  };
}

function getCurrentUser(source) {
  if (source) return normalizeUser(source);

  if (typeof window !== "undefined") {
    try {
      if (window.Auth && typeof window.Auth.getUser === "function") {
        const authUser = window.Auth.getUser();
        return normalizeUser({
          user_id: authUser && authUser.uid,
          email: authUser && authUser.email,
          name: authUser && authUser.name,
          avatar: authUser && authUser.photoURL,
        });
      }
    } catch (error) {}

    try {
      const cached = window.__PI_AUTH_USER__;
      const normalized = normalizeUser(cached);
      if (normalized) return normalized;
    } catch (error) {}
  }

  return null;
}

function generateUniqueIdentifier(config = {}) {
  const normalized = normalizeUser(config) || { user_id: String(config.user_id || "user").trim() || "user" };
  const unique_id = generateUniqueId({
    user_id: normalized.user_id,
    email: normalized.email || "",
    name: normalized.name || "",
    personalization_data: config.personalization_data || {},
    ai_config: config.ai_config || {},
  });

  return {
    user_id: normalized.user_id,
    unique_id,
  };
}

if (typeof window !== "undefined") {
  window.PIIdentitySystem = Object.assign({}, window.PIIdentitySystem || {}, {
    getCurrentUser,
    generateUniqueIdentifier,
  });
}

module.exports = {
  getCurrentUser,
  generateUniqueIdentifier,
  normalizeUser,
};
