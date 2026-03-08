"use strict";

function ensureSkillTree(state) {
  const st = state && typeof state === "object" ? state : {};
  if (!st.skill_tree) {
    st.skill_tree = {
      learning_skills: ["study_planner", "flashcard_generator", "exam_simulator"],
      productivity_skills: ["task_planner", "focus_tracker", "daily_review"],
      automation_skills: ["file_explorer_open", "maps_navigation", "music_playback"],
      updated_at: new Date().toISOString(),
    };
  }
  return st.skill_tree;
}

function maybeGrowSkillTree(state, envelope, weaknesses) {
  const tree = ensureSkillTree(state);
  const text = String(envelope && envelope.message || "").toLowerCase();
  const weak = Array.isArray(weaknesses) ? weaknesses : [];
  let created = "";

  const shouldAddStudyTracker = /track study time|study time|study tracker/.test(text);
  if (shouldAddStudyTracker && !tree.productivity_skills.includes("study_tracker_skill")) {
    tree.productivity_skills.push("study_tracker_skill");
    created = "study_tracker_skill";
  }

  const missingCapability = weak.find((w) => String(w && w.type || "") === "missing_capability");
  if (!created && missingCapability) {
    const key = String(missingCapability.problem || "new_skill").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const skill = `${key || "new"}_skill`.slice(0, 48);
    if (!tree.automation_skills.includes(skill)) {
      tree.automation_skills.push(skill);
      created = skill;
    }
  }

  tree.updated_at = new Date().toISOString();
  return {
    skill_tree: tree,
    created_skill: created,
  };
}

module.exports = {
  ensureSkillTree,
  maybeGrowSkillTree,
};

