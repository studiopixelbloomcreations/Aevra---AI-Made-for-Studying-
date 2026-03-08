"use strict";

function ensureWorldModel(state) {
  const st = state && typeof state === "object" ? state : {};
  if (!st.world_model) {
    st.world_model = {
      user: { goals: [], interests: [], habits: [] },
      environment: { apps: [], devices: [], location: "" },
      events: [],
      updated_at: new Date().toISOString(),
    };
  }
  return st.world_model;
}

function pushUnique(arr, value, max) {
  const v = String(value || "").trim();
  if (!v) return arr;
  if (!arr.includes(v)) arr.push(v);
  if (arr.length > max) arr.splice(0, arr.length - max);
  return arr;
}

function updateWorldModel(state, envelope, memorySnapshot) {
  const wm = ensureWorldModel(state);
  const env = envelope && typeof envelope === "object" ? envelope : {};
  const profile = memorySnapshot && memorySnapshot.user_profile_memory ? memorySnapshot.user_profile_memory : {};
  const known = env.known_facts && typeof env.known_facts === "object" ? env.known_facts : {};

  pushUnique(wm.user.goals, known.goal || known.career_goal || "", 50);
  pushUnique(wm.user.interests, known.favorite_subject || known.favorite_sport || "", 50);
  pushUnique(wm.user.habits, profile && profile.habits && profile.habits.common_time_of_use, 30);

  pushUnique(wm.environment.apps, "web_app", 30);
  pushUnique(wm.environment.devices, "browser", 20);
  wm.environment.location = String(profile && profile.location || known.city || known.country || "").slice(0, 120);

  if (env.current_task) {
    wm.events.push({
      kind: "task",
      title: String(env.current_task).slice(0, 120),
      at: new Date().toISOString(),
    });
    if (wm.events.length > 600) wm.events = wm.events.slice(-600);
  }

  wm.updated_at = new Date().toISOString();
  return wm;
}

module.exports = {
  ensureWorldModel,
  updateWorldModel,
};

