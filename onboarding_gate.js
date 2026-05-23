// onboarding_gate.js
// Blocks first app entry until Google identity, PI unique id, and LUMEN profile are ready.
(function () {
  const READY_KEY_PREFIX = "aura_onboarding_ready:";
  const PROFILE_KEY_PREFIX = "aura_profile:";

  const QUESTIONS = [
    { id: "preferred_name", label: "What should Aura call you?", type: "text", required: true },
    { id: "grade", label: "What grade are you in?", type: "text", value: "Grade 9" },
    { id: "school", label: "What school do you go to?", type: "text" },
    { id: "preferred_language", label: "Which language should Aura prefer?", type: "select", options: ["English", "Sinhala", "English and Sinhala"] },
    { id: "favorite_subjects", label: "Favorite subjects?", type: "text", placeholder: "Science, ICT, Math" },
    { id: "hard_subjects", label: "Subjects that feel hard right now?", type: "text", placeholder: "Math, History..." },
    { id: "learning_style", label: "How do you learn best?", type: "select", options: ["Step by step", "Examples first", "Fast and direct", "Quiz me"] },
    { id: "preferred_tone", label: "What kind of Aura should help you?", type: "select", options: ["Warm and calm", "Energetic", "Strict and focused", "Funny but useful"] },
    { id: "main_goal", label: "What is your main learning goal?", type: "text", placeholder: "Improve marks, understand science..." },
  ];

  function safeJson(value) {
    try { return JSON.parse(value); } catch (e) { return null; }
  }

  function getIdentity() {
    try {
      const user = window.Auth && window.Auth.getUser ? window.Auth.getUser() : null;
      if (user && (user.uid || user.email)) {
        return {
          user_id: String(user.uid || user.email || "").trim(),
          email: String(user.email || "").trim(),
          name: String(user.name || "").trim(),
          avatar: String(user.photoURL || "").trim(),
        };
      }
    } catch (e) {}
    return null;
  }

  function readyKey(identity) {
    return READY_KEY_PREFIX + String(identity && identity.user_id || "");
  }

  function profileKey(identity) {
    return PROFILE_KEY_PREFIX + String(identity && identity.user_id || "");
  }

  function hasBasicAnswers(profile) {
    const data = profile && profile.personalization_data && typeof profile.personalization_data === "object" ? profile.personalization_data : {};
    const answers = data.onboarding_answers && typeof data.onboarding_answers === "object" ? data.onboarding_answers : {};
    return !!(answers.preferred_name && Object.keys(answers).length >= 5);
  }

  function uniqueId(profile) {
    return String(profile && (profile.unique_id || profile.unique_identifier) || "").trim();
  }

  function profileFile(identity, profile) {
    const safe = String((identity && identity.user_id) || (identity && identity.email) || "user").replace(/[^a-zA-Z0-9._-]+/g, "_");
    return String(profile && (profile.profile_file || profile.file_name) || (safe + ".piuser.json")).trim();
  }

  async function api(path, options) {
    const fetcher = window.Api && window.Api.apiFetch ? window.Api.apiFetch : fetch;
    const res = await fetcher(path, options || {});
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data && data.error ? data.error : "HTTP " + res.status);
    return data;
  }

  async function fetchProfile(identity) {
    const data = await api("/personal-intelligence/config?user_id=" + encodeURIComponent(identity.user_id), { method: "GET" });
    return data && (data.profile || (data.data && data.data.profile)) || null;
  }

  async function saveProfile(identity, answers) {
    const data = await api("/personal-intelligence/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: identity.user_id,
        email: identity.email,
        name: identity.name,
        avatar: identity.avatar,
        identity: identity,
        answers: answers,
        onboarding_answers: answers,
      }),
    });
    return data && (data.profile || (data.data && data.data.profile)) || null;
  }

  async function waitForStrictProfile(identity, seedProfile) {
    let profile = seedProfile || null;
    for (let i = 0; i < 24; i += 1) {
      if (profile && uniqueId(profile)) {
        return { profile: profile, unique_id: uniqueId(profile), profile_file: profileFile(identity, profile) };
      }
      await new Promise(function (resolve) { setTimeout(resolve, 650); });
      profile = await fetchProfile(identity).catch(function () { return null; });
    }
    throw new Error("Unique id/profile retrieval timed out.");
  }

  function createOverlay() {
    let overlay = document.getElementById("auraOnboardingGate");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "auraOnboardingGate";
    overlay.className = "onboarding-gate active";
    overlay.innerHTML =
      '<div class="onboarding-panel">' +
      '<div class="onboarding-kicker">Aura first run</div>' +
      "<h2>Personalize your AI</h2>" +
      '<p class="onboarding-copy">Answer these once. Aura will bind your Google account to one unique id and one private LUMEN profile before the app opens.</p>' +
      '<form id="auraOnboardingForm" class="onboarding-form"></form>' +
      '<div id="auraOnboardingStatus" class="onboarding-status" aria-live="polite"></div>' +
      "</div>";
    document.body.appendChild(overlay);
    return overlay;
  }

  function renderForm(overlay, identity) {
    const form = overlay.querySelector("#auraOnboardingForm");
    const fallbackName = String(identity && identity.name || "").split(" ")[0] || "";
    form.innerHTML = QUESTIONS.map(function (q) {
      const value = q.id === "preferred_name" ? fallbackName : (q.value || "");
      const required = q.required ? " required" : "";
      if (q.type === "select") {
        return '<label><span>' + q.label + '</span><select name="' + q.id + '"' + required + ">" +
          q.options.map(function (opt) { return '<option value="' + opt + '">' + opt + "</option>"; }).join("") +
          "</select></label>";
      }
      return '<label><span>' + q.label + '</span><input name="' + q.id + '" value="' + value + '" placeholder="' + (q.placeholder || "") + '"' + required + " /></label>";
    }).join("") + '<button type="submit" class="onboarding-submit">Continue</button>';
  }

  function setStatus(overlay, text, busy) {
    const status = overlay.querySelector("#auraOnboardingStatus");
    if (!status) return;
    status.innerHTML = (busy ? '<span class="onboarding-spinner"></span>' : "") + "<span>" + text + "</span>";
  }

  function collectAnswers(form, identity) {
    const answers = {};
    QUESTIONS.forEach(function (q) {
      const el = form.elements[q.id];
      answers[q.id] = el ? String(el.value || "").trim() : "";
    });
    answers.full_name = String(identity && identity.name || answers.preferred_name || "").trim();
    answers.email = String(identity && identity.email || "").trim();
    return answers;
  }

  async function writeWelcome(identity, strictProfile) {
    const answers = strictProfile.profile && strictProfile.profile.personalization_data && strictProfile.profile.personalization_data.onboarding_answers || {};
    const name = String(answers.preferred_name || identity.name || "there").trim();
    const fallback = "Welcome, " + name.split(" ")[0] + ". Your Aura profile is ready and your Personal Intelligence is linked.";
    const messageEl = document.querySelector(".welcome-message");
    const descEl = document.querySelector(".welcome-description");
    if (messageEl) messageEl.textContent = fallback;
    try {
      const data = await api("/personal-intelligence/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Create a short warm welcome for " + name + " after first Aura setup. Mention that their unique personal intelligence is ready. One sentence.",
          user_id: identity.user_id,
          email: identity.email,
          identity: identity,
          unique_id: strictProfile.unique_id,
          profile_file: strictProfile.profile_file,
          title: "Aura Welcome",
        }),
      });
      const answer = String(data && data.answer || "").trim();
      if (answer && messageEl) messageEl.textContent = answer;
      if (window.AuraHarmonySystem && data) window.AuraHarmonySystem.ingest(data);
    } catch (e) {}
    if (descEl) descEl.textContent = "Unique id: " + strictProfile.unique_id + " | Profile: " + strictProfile.profile_file;
  }

  function markReady(identity, strictProfile) {
    try { localStorage.setItem(readyKey(identity), JSON.stringify({ unique_id: strictProfile.unique_id, profile_file: strictProfile.profile_file, at: Date.now() })); } catch (e) {}
    try { localStorage.setItem(profileKey(identity), JSON.stringify(strictProfile.profile)); } catch (e) {}
    try { localStorage.setItem("g9_email", identity.email || ""); } catch (e) {}
    window.dispatchEvent(new CustomEvent("aura:onboarding_ready", { detail: strictProfile }));
  }

  async function run() {
    try {
      if (window.__VIS_TEST_USE_MOCK || new URLSearchParams(window.location.search || "").get("visMock") === "1") return;
    } catch (e) {
      if (window.__VIS_TEST_USE_MOCK) return;
    }
    document.documentElement.classList.add("onboarding-lock");
    const user = window.Auth && window.Auth.requireAuth ? await window.Auth.requireAuth() : null;
    const identity = getIdentity() || (user && { user_id: user.uid || user.email, email: user.email, name: user.name, avatar: user.photoURL });
    if (!identity || !identity.user_id) {
      if (window.Auth && window.Auth.redirectToLogin) window.Auth.redirectToLogin();
      return;
    }

    const profile = await fetchProfile(identity).catch(function () { return null; });
    const ready = safeJson(localStorage.getItem(readyKey(identity)) || "");
    if (ready && ready.unique_id && profile && uniqueId(profile) === ready.unique_id && hasBasicAnswers(profile)) {
      const strictProfile = await waitForStrictProfile(identity, profile);
      markReady(identity, strictProfile);
      await writeWelcome(identity, strictProfile);
      document.documentElement.classList.remove("onboarding-lock");
      return;
    }

    const overlay = createOverlay();
    renderForm(overlay, identity);
    setStatus(overlay, "Waiting for your answers.", false);
    const form = overlay.querySelector("#auraOnboardingForm");
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      form.querySelectorAll("input,select,button").forEach(function (el) { el.disabled = true; });
      try {
        setStatus(overlay, "Sending basic profile to Harmony and creating your private LUMEN identity...", true);
        const saved = await saveProfile(identity, collectAnswers(form, identity));
        setStatus(overlay, "Waiting for the actual unique id and profile file retrieval...", true);
        const strictProfile = await waitForStrictProfile(identity, saved);
        markReady(identity, strictProfile);
        await writeWelcome(identity, strictProfile);
        overlay.classList.remove("active");
        setTimeout(function () { overlay.remove(); }, 320);
        document.documentElement.classList.remove("onboarding-lock");
      } catch (e) {
        form.querySelectorAll("input,select,button").forEach(function (el) { el.disabled = false; });
        setStatus(overlay, "Setup could not finish: " + String(e && e.message || e), false);
      }
    });
  }

  window.AuraOnboardingGate = { run: run };
  document.addEventListener("DOMContentLoaded", function () {
    run().catch(function () {
      document.documentElement.classList.remove("onboarding-lock");
    });
  });
})();
