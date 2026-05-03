"use strict";

function parseEnv() {
  if (typeof window !== "undefined") {
    const raw =
      (window.__AEVRA_ENV && JSON.stringify(window.__AEVRA_ENV)) ||
      (window.__PUBLIC_AEVRA_ENV && JSON.stringify(window.__PUBLIC_AEVRA_ENV)) ||
      "{}";
    try { return typeof raw === "string" ? JSON.parse(raw || "{}") : raw || {}; } catch (error) { return {}; }
  }
  try { return JSON.parse(process.env.AEVRA_ENV || "{}"); } catch (error) { return {}; }
}

const ENV = parseEnv();

function env(name, fallback) {
  const value = ENV && Object.prototype.hasOwnProperty.call(ENV, name) ? ENV[name] : undefined;
  if (value === undefined || value === null || value === "") return fallback === undefined ? "" : fallback;
  return value;
}

function validateEnv(required) {
  const keys = Array.isArray(required) && required.length ? required : [
    "GROQ_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
  ];
  const missing = keys.filter((key) => !env(key));
  missing.forEach((key) => {
    if (typeof console !== "undefined" && console.error) console.error(`Missing ENV key: ${key}`);
  });
  return missing;
}

function allowedOrigin() {
  const origins = String(env("ALLOWED_ORIGINS", "https://aevrav1.netlify.app")).split(",").map((s) => s.trim()).filter(Boolean);
  return origins[0] || "https://aevrav1.netlify.app";
}

if (typeof module !== "undefined") module.exports = { ENV, env, validateEnv, allowedOrigin };
if (typeof window !== "undefined") {
  window.AevraEnv = { ENV, env, validateEnv, allowedOrigin };
  validateEnv();
}
