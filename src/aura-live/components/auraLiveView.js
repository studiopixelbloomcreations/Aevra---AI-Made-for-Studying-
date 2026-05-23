export function createAuraLiveView(root, controller) {
  root.innerHTML = `
    <section class="aura-startup" data-startup>
      <div class="aura-logo-mark">A</div>
      <div class="aura-startup-text">Aura Live</div>
    </section>
    <div class="aura-ambient" aria-hidden="true"><span></span><span></span><span></span></div>
    <section class="aura-shell">
      <header class="aura-topbar">
        <div class="aura-brand"><span>A</span><strong>Aura Live</strong><small>Realtime Intelligence</small></div>
        <div class="aura-status-row">
          <button class="aura-icon-btn" data-action="wake" title="Start wake word listener" aria-label="Start wake word listener">◎</button>
          <button class="aura-icon-btn" data-action="captions" title="Toggle captions" aria-label="Toggle captions">CC</button>
          <button class="aura-icon-btn" data-action="camera" title="Toggle camera intelligence" aria-label="Toggle camera intelligence">◉</button>
          <button class="aura-icon-btn" data-action="close" title="Close Aura" aria-label="Close Aura">×</button>
        </div>
      </header>
      <section class="aura-main-grid">
        <aside class="aura-panel aura-memory-panel">
          <div class="aura-panel-title">Memory</div>
          <div class="aura-memory-list" data-memory></div>
        </aside>
        <section class="aura-core-stage">
          <div class="aura-orb-wrap">
            <div class="aura-orb" data-orb><span></span><i></i></div>
            <canvas class="aura-visualizer" data-visualizer aria-hidden="true"></canvas>
          </div>
          <div class="aura-thinking" data-thinking>Listening for intent</div>
          <div class="aura-conversation" data-conversation></div>
          <form class="aura-composer" data-composer>
            <input data-input autocomplete="off" aria-label="Message Aura" />
            <button type="submit">Send</button>
          </form>
          <div class="aura-suggestions" data-suggestions></div>
        </section>
        <aside class="aura-side-stack">
          <section class="aura-panel aura-vision-panel">
            <div class="aura-panel-title">Vision</div>
            <video data-camera playsinline muted></video>
            <div class="aura-vision-readout" data-vision>Camera intelligence is ready when enabled.</div>
          </section>
          <section class="aura-panel aura-context-panel">
            <div class="aura-panel-title">Live Context</div>
            <div data-context></div>
          </section>
        </aside>
      </section>
      <section class="aura-preview" data-preview>
        <div class="aura-panel-title">Preview Workspace</div>
        <div class="aura-preview-body">Generated previews, drafts, notes, and study plans appear here when Aura has something visual to show.</div>
      </section>
      <section class="aura-captions" data-captions aria-live="polite"></section>
      <section class="aura-notifications" data-notifications></section>
    </section>
  `;

  const els = {
    startup: root.querySelector("[data-startup]"),
    orb: root.querySelector("[data-orb]"),
    conversation: root.querySelector("[data-conversation]"),
    composer: root.querySelector("[data-composer]"),
    input: root.querySelector("[data-input]"),
    suggestions: root.querySelector("[data-suggestions]"),
    memory: root.querySelector("[data-memory]"),
    camera: root.querySelector("[data-camera]"),
    vision: root.querySelector("[data-vision]"),
    context: root.querySelector("[data-context]"),
    captions: root.querySelector("[data-captions]"),
    preview: root.querySelector("[data-preview]"),
    notifications: root.querySelector("[data-notifications]"),
    thinking: root.querySelector("[data-thinking]"),
    visualizer: root.querySelector("[data-visualizer]"),
  };

  els.composer.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = els.input.value.trim();
    if (!value) return;
    els.input.value = "";
    controller.handleUserText(value);
  });

  root.addEventListener("click", (event) => {
    const action = event.target && event.target.closest("[data-action]");
    if (!action) return;
    controller.handleAction(action.dataset.action);
  });

  return {
    els,
    render(state) {
      els.conversation.innerHTML = state.messages.map(renderMessage).join("");
      els.conversation.scrollTop = els.conversation.scrollHeight;
      els.suggestions.innerHTML = state.suggestions.map((item) => `<button type="button" data-suggestion="${escapeAttr(item)}">${escapeHtml(item)}</button>`).join("");
      els.notifications.innerHTML = state.notifications.map((item) => `<div class="aura-note ${item.level}">${escapeHtml(item.text)}</div>`).join("");
      els.captions.classList.toggle("is-hidden", !state.captions);
      els.orb.dataset.state = state.voiceState;
      els.thinking.textContent = state.phase === "thinking" ? "Thinking across live context" : state.voiceState === "speaking" ? "Speaking" : "Listening for intent";
    },
    renderMemory(context) {
      const items = [
        ["Recent", (context.recentSessions || []).slice(-1)[0] && ((context.recentSessions || []).slice(-1)[0].summary || "Session active")],
        ["Next", (context.unfinishedWork || [])[0] && ((context.unfinishedWork || [])[0].title || context.unfinishedWork[0])],
        ["Strengths", (context.strengths || []).join(", ")],
        ["Growth", (context.weaknesses || []).join(", ")],
      ].filter((item) => item[1]);
      els.memory.innerHTML = items.length ? items.map(([label, value]) => `<div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`).join("") : "<p>No saved memory yet. Aura will build continuity as you work.</p>";
    },
    renderContext(context) {
      els.context.innerHTML = `
        <div class="aura-kv"><span>Page</span><strong>${escapeHtml(context.activePage || "Aura Live")}</strong></div>
        <div class="aura-kv"><span>Typing</span><strong>${context.typing && context.typing.active ? "Active" : "Idle"}</strong></div>
        <div class="aura-kv"><span>Actions</span><strong>${(context.recentActions || []).length}</strong></div>
      `;
    },
    renderCaption(item) {
      const node = document.createElement("div");
      node.innerHTML = `<strong>${escapeHtml(item.speaker || "Aura")}</strong><span>${escapeHtml(item.text || "")}</span>`;
      els.captions.appendChild(node);
      while (els.captions.children.length > 8) els.captions.removeChild(els.captions.firstElementChild);
      els.captions.scrollTop = els.captions.scrollHeight;
    },
    renderVision(summary) {
      if (!summary) return;
      els.vision.textContent = summary.status === "frame-ready"
        ? `Frame ready. Brightness ${summary.brightness}. Complexity ${summary.visualComplexity}.`
        : "Waiting for camera frame.";
    },
    renderPreview(preview) {
      const body = els.preview.querySelector(".aura-preview-body");
      if (!preview) {
        body.textContent = "Generated previews, drafts, notes, and study plans appear here when Aura has something visual to show.";
        return;
      }
      body.innerHTML = `<article><strong>${escapeHtml(preview.kind)}</strong><p>${escapeHtml(JSON.stringify(preview.payload, null, 2))}</p></article>`;
      els.preview.classList.add("is-expanded");
    },
    bindSuggestions() {
      els.suggestions.addEventListener("click", (event) => {
        const button = event.target && event.target.closest("[data-suggestion]");
        if (button) controller.handleUserText(button.dataset.suggestion);
      });
    },
  };
}

function renderMessage(message) {
  return `<article class="aura-message ${message.role}"><div>${escapeHtml(message.role === "user" ? "You" : "Aura")}</div><p>${escapeHtml(message.text)}</p></article>`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}
