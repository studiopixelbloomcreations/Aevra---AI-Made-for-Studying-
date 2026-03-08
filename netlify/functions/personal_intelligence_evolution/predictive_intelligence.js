"use strict";

function inferTimeBucket() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function buildPredictions(memorySnapshot, worldModel) {
  const profile = memorySnapshot && memorySnapshot.user_profile_memory ? memorySnapshot.user_profile_memory : {};
  const interests = worldModel && worldModel.user && Array.isArray(worldModel.user.interests)
    ? worldModel.user.interests
    : [];
  const bucket = inferTimeBucket();
  const predicts = [];

  if (bucket === "morning") predicts.push("show_day_plan");
  if (bucket !== "morning") predicts.push("summarize_progress");
  if (interests.length) predicts.push(`suggest_practice:${interests[interests.length - 1]}`);
  if (profile && profile.preferences && profile.preferences.subject) {
    predicts.push(`next_best_topic:${profile.preferences.subject}`);
  }

  return {
    time_bucket: bucket,
    predictions: predicts.slice(0, 8),
  };
}

module.exports = {
  buildPredictions,
};

