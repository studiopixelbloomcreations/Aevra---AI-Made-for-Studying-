function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function getConfig() {
  return {
    supabaseUrl: env("SUPABASE_URL").replace(/\/$/, ""),
    apiKey: env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SERVICE_ROLE") || env("SUPABASE_ANON_KEY"),
    table: env("SUPABASE_PI_PROFILE_TABLE", "user_profiles"),
  };
}

function ensureConfig() {
  const config = getConfig();
  if (!config.supabaseUrl || !config.apiKey) {
    throw new Error("Missing Supabase configuration for Personal Intelligence profiles");
  }
  return config;
}

function headers(config) {
  return {
    apikey: config.apiKey,
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=representation",
  };
}

async function parseResponse(response) {
  return response.json().catch(() => ({}));
}

async function getUserProfile(user_id) {
  const config = ensureConfig();
  const url = `${config.supabaseUrl}/rest/v1/${config.table}?select=*&user_id=eq.${encodeURIComponent(String(user_id || "").trim())}&limit=1`;
  const response = await fetch(url, { method: "GET", headers: headers(config) });
  const rows = await parseResponse(response);
  if (!response.ok) throw new Error((rows && rows.message) || `Supabase get failed (${response.status})`);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function getUserProfileByUniqueId(unique_id) {
  const config = ensureConfig();
  const url = `${config.supabaseUrl}/rest/v1/${config.table}?select=*&unique_id=eq.${encodeURIComponent(String(unique_id || "").trim())}&limit=1`;
  const response = await fetch(url, { method: "GET", headers: headers(config) });
  const rows = await parseResponse(response);
  if (!response.ok) throw new Error((rows && rows.message) || `Supabase unique_id lookup failed (${response.status})`);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function saveUserProfile(user_id, data = {}) {
  const config = ensureConfig();
  const payload = {
    user_id: String(user_id || data.user_id || "").trim(),
    personalization_data: data.personalization_data || {},
    ai_config: data.ai_config || {},
    unique_id: String(data.unique_id || "").trim(),
    updated_at: new Date().toISOString(),
  };

  const response = await fetch(`${config.supabaseUrl}/rest/v1/${config.table}?on_conflict=user_id`, {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify(payload),
  });
  const rows = await parseResponse(response);
  if (!response.ok) throw new Error((rows && rows.message) || `Supabase save failed (${response.status})`);
  return Array.isArray(rows) && rows.length ? rows[0] : payload;
}

async function updateUserMemory(user_id, memory = {}) {
  const existing = await getUserProfile(user_id);
  const personalization_data = Object.assign({}, existing && existing.personalization_data || {}, {
    memory: Object.assign({}, existing && existing.personalization_data && existing.personalization_data.memory || {}, memory || {}),
  });
  return saveUserProfile(user_id, {
    personalization_data,
    ai_config: existing && existing.ai_config || {},
    unique_id: existing && existing.unique_id || "",
  });
}

module.exports = {
  getUserProfile,
  getUserProfileByUniqueId,
  saveUserProfile,
  updateUserMemory,
};
