(function () {
  const tabBtn = document.getElementById("personalIntelligenceTab");
  const inputBox = document.getElementById("inputBox");
  const sendBtn = document.getElementById("sendBtn");
  const micBtn = document.getElementById("micBtn");
  const messagesEl = document.getElementById("messages");
  const welcomePanel = document.getElementById("welcomePanel");

  if (!tabBtn || !inputBox || !sendBtn || !messagesEl) return;

  const STORAGE_KEY = "g9_personal_intelligence_enabled";
  const EMAIL = "guest@student.com";
  let enabled = localStorage.getItem(STORAGE_KEY) === "true";
  let recognition = null;
  let speaking = false;
  let assistantOpen = false;
  let realtimeConnected = false;
  let realtimePc = null;
  let realtimeDc = null;
  let realtimeStream = null;
  let realtimeAudio = null;

  let integrationState = {
    spotify_connected: false,
    google_maps_connected: true,
    home_address: "",
  };

  const panel = document.createElement("div");
  panel.className = "pi-panel";
  panel.innerHTML = `
    <div class="pi-header">
      <div class="pi-title-wrap">
        <div class="pi-section">Perosnla IIntelligence</div>
        <div class="pi-name">Tutor</div>
      </div>
      <button class="pi-close" type="button" aria-label="Close assistant">x</button>
    </div>
    <div class="pi-orb-wrap">
      <button class="pi-orb idle" type="button" aria-label="Start voice conversation">
        <span class="pi-orb-core"></span>
      </button>
      <div class="pi-state">Idle</div>
    </div>
    <div class="pi-controls">
      <button class="pi-btn pi-listen" type="button">Start Listening</button>
      <button class="pi-btn pi-stop" type="button">Stop Voice</button>
      <button class="pi-btn pi-realtime-connect" type="button">Connect ChatGPT Voice</button>
      <button class="pi-btn pi-realtime-disconnect" type="button">Disconnect ChatGPT Voice</button>
    </div>
    <div class="pi-log" aria-live="polite"></div>
  `;
  document.body.appendChild(panel);

  const closeBtn = panel.querySelector(".pi-close");
  const orbBtn = panel.querySelector(".pi-orb");
  const stateEl = panel.querySelector(".pi-state");
  const listenBtn = panel.querySelector(".pi-listen");
  const stopBtn = panel.querySelector(".pi-stop");
  const realtimeConnectBtn = panel.querySelector(".pi-realtime-connect");
  const realtimeDisconnectBtn = panel.querySelector(".pi-realtime-disconnect");
  const logEl = panel.querySelector(".pi-log");

  function isExamModeEnabled() {
    try {
      return !!(window.ExamModeContext && window.ExamModeContext.getEnabled && window.ExamModeContext.getEnabled());
    } catch (e) {
      return false;
    }
  }

  function setAssistantState(kind, label) {
    orbBtn.classList.remove("idle", "listening", "thinking", "speaking");
    orbBtn.classList.add(kind);
    stateEl.textContent = label;
  }

  function addLog(role, text) {
    const row = document.createElement("div");
    row.className = "pi-log-row " + (role === "user" ? "user" : "assistant");
    row.textContent = text;
    logEl.appendChild(row);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function setEnabled(next) {
    enabled = !!next;
    localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
    tabBtn.classList.toggle("active", enabled);
    tabBtn.setAttribute("aria-pressed", enabled ? "true" : "false");
    inputBox.placeholder = enabled ? "Talk to Tutor..." : "Ask me anything...";
    panel.classList.toggle("show", enabled && assistantOpen);
  }

  function togglePanel(open) {
    assistantOpen = !!open;
    panel.classList.toggle("show", enabled && assistantOpen);
  }

  function appendMainMessage(role, content) {
    const m = document.createElement("div");
    m.className = "msg " + (role === "user" ? "user" : "ai") + " show";
    m.textContent = String(content || "");
    messagesEl.appendChild(m);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return m;
  }

  function collectHistory(limit) {
    const nodes = messagesEl.querySelectorAll(".msg");
    const out = [];
    const start = Math.max(0, nodes.length - (limit || 20));
    for (let i = start; i < nodes.length; i++) {
      const n = nodes[i];
      if (!n || !n.textContent) continue;
      out.push({
        role: n.classList.contains("user") ? "user" : "assistant",
        content: String(n.textContent).slice(0, 1200),
      });
    }
    return out;
  }

  async function fetchJson(path, options) {
    const res = await (window.Api && window.Api.apiFetch ? window.Api.apiFetch(path, options) : fetch(path, options));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data && (data.detail || data.error)) || "Request failed");
    return data;
  }

  function speak(text) {
    if (!("speechSynthesis" in window) || !text) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(String(text));
      utter.rate = 1.0;
      utter.pitch = 1.0;
      speaking = true;
      setAssistantState("speaking", "Speaking");
      utter.onend = function () {
        speaking = false;
        setAssistantState("idle", "Idle");
      };
      window.speechSynthesis.speak(utter);
    } catch (e) {
      speaking = false;
      setAssistantState("idle", "Idle");
    }
  }

  function stopSpeaking() {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
    speaking = false;
    setAssistantState("idle", "Idle");
  }

  async function refreshStatus() {
    try {
      const data = await fetchJson("/personal-intelligence/status?email=" + encodeURIComponent(EMAIL), { method: "GET" });
      integrationState = (data && data.integration_state) || integrationState;
    } catch (e) {}
  }

  async function handleAction(action) {
    if (!action || !action.type) return;
    if (action.type === "connect_spotify" || (action.type === "play_spotify_liked" && action.requires_connection)) {
      const shouldConnect = window.confirm("Tutor needs Spotify connected. Connect now?");
      if (!shouldConnect) return;
      await fetchJson("/personal-intelligence/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: EMAIL, service: "spotify" }),
      });
      await refreshStatus();
      return;
    }
    if (action.type === "save_home_address" && action.home_address) {
      await fetchJson("/personal-intelligence/set-home", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: EMAIL, address: action.home_address }),
      });
      await refreshStatus();
      return;
    }
    if (action.type === "directions_home" && action.maps_url) {
      window.open(action.maps_url, "_blank", "noopener,noreferrer");
      return;
    }
  }

  async function askTutor(messageText) {
    if (!messageText) return;
    if (isExamModeEnabled()) return;

    if (welcomePanel) welcomePanel.style.display = "none";
    messagesEl.style.display = "flex";
    addLog("user", "You: " + messageText);
    appendMainMessage("user", messageText);
    const thinkingNode = appendMainMessage("ai", "Thinking...");
    setAssistantState("thinking", "Thinking");

    const payload = {
      message: messageText,
      email: EMAIL,
      language: localStorage.getItem("g9_language") || "English",
      subject: localStorage.getItem("g9_subject") || "General",
      title: "Perosnla IIntelligence",
      history: collectHistory(20),
    };

    try {
      const data = await fetchJson("/personal-intelligence/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const answer = data && data.answer ? String(data.answer) : "I could not complete that request.";
      thinkingNode.textContent = answer;
      addLog("assistant", "Tutor: " + answer);
      if (data && data.integration_state) integrationState = data.integration_state;
      if (data && data.action) await handleAction(data.action);
      speak(answer);
    } catch (e) {
      const msg = "Request failed. Please try again.";
      thinkingNode.textContent = msg;
      addLog("assistant", "Tutor: " + msg);
      setAssistantState("idle", "Idle");
    }
  }

  function initRecognition() {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) return null;
    const rec = new Rec();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onstart = function () {
      setAssistantState("listening", "Listening");
      addLog("assistant", "Tutor: Listening...");
    };
    rec.onresult = function (ev) {
      const t = ev && ev.results && ev.results[0] && ev.results[0][0] ? ev.results[0][0].transcript : "";
      if (!t) return;
      askTutor(String(t));
    };
    rec.onerror = function () {
      setAssistantState("idle", "Idle");
    };
    rec.onend = function () {
      if (!speaking) setAssistantState("idle", "Idle");
    };
    return rec;
  }

  recognition = initRecognition();

  function startListening() {
    if (!enabled) return;
    if (!recognition) {
      addLog("assistant", "Tutor: Voice recognition is not available in this browser.");
      return;
    }
    try {
      recognition.start();
    } catch (e) {}
  }

  function stopListening() {
    try {
      if (recognition) recognition.abort();
    } catch (e) {}
    stopSpeaking();
  }

  function disconnectRealtimeVoice() {
    try {
      if (realtimeDc) realtimeDc.close();
    } catch (e) {}
    try {
      if (realtimePc) realtimePc.close();
    } catch (e) {}
    try {
      if (realtimeStream) realtimeStream.getTracks().forEach(function (t) { t.stop(); });
    } catch (e) {}
    try {
      if (realtimeAudio) {
        realtimeAudio.pause();
        realtimeAudio.srcObject = null;
      }
    } catch (e) {}
    realtimeConnected = false;
    realtimeDc = null;
    realtimePc = null;
    realtimeStream = null;
    realtimeAudio = null;
    setAssistantState("idle", "Idle");
    addLog("assistant", "Tutor: ChatGPT voice disconnected.");
  }

  async function connectRealtimeVoice() {
    if (realtimeConnected) return;
    setAssistantState("thinking", "Connecting ChatGPT voice...");
    addLog("assistant", "Tutor: Connecting ChatGPT voice...");

    let session;
    try {
      session = await fetchJson("/personal-intelligence/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: EMAIL }),
      });
    } catch (e) {
      setAssistantState("idle", "Idle");
      addLog("assistant", "Tutor: Could not create realtime session.");
      return;
    }

    if (!session || !session.ok || !session.client_secret || !session.client_secret.value) {
      const errMsg = (session && session.error) ? String(session.error) : "Realtime session unavailable.";
      setAssistantState("idle", "Idle");
      addLog("assistant", "Tutor: " + errMsg);
      return;
    }

    const ephemeralKey = session.client_secret.value;
    const model = session.model || "gpt-realtime";
    const realtimeUrl = "https://api.openai.com/v1/realtime?model=" + encodeURIComponent(model);

    try {
      realtimePc = new RTCPeerConnection();
      realtimeAudio = document.createElement("audio");
      realtimeAudio.autoplay = true;
      realtimeAudio.style.display = "none";
      document.body.appendChild(realtimeAudio);

      realtimePc.ontrack = function (ev) {
        try {
          realtimeAudio.srcObject = ev.streams[0];
          setAssistantState("speaking", "Speaking");
        } catch (e) {}
      };

      realtimeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      realtimeStream.getTracks().forEach(function (track) {
        realtimePc.addTrack(track, realtimeStream);
      });

      realtimeDc = realtimePc.createDataChannel("oai-events");
      realtimeDc.onopen = function () {
        realtimeConnected = true;
        setAssistantState("idle", "Voice Connected");
        addLog("assistant", "Tutor: ChatGPT voice connected. Speak naturally.");
        try {
          realtimeDc.send(
            JSON.stringify({
              type: "session.update",
              session: {
                instructions:
                  "You are Tutor, a warm personal assistant. Keep replies natural, short, and helpful.",
              },
            })
          );
        } catch (e) {}
      };
      realtimeDc.onmessage = function (ev) {
        try {
          const event = JSON.parse(ev.data);
          if (event && event.type === "input_audio_buffer.speech_started") {
            setAssistantState("listening", "Listening");
          } else if (event && event.type === "input_audio_buffer.speech_stopped") {
            setAssistantState("thinking", "Thinking");
          } else if (event && event.type === "response.done") {
            setAssistantState("idle", "Voice Connected");
          } else if (event && event.type === "conversation.item.input_audio_transcription.completed") {
            if (event.transcript) addLog("user", "You: " + event.transcript);
          } else if (event && event.type === "response.audio_transcript.done") {
            if (event.transcript) addLog("assistant", "Tutor: " + event.transcript);
          }
        } catch (e) {}
      };
      realtimeDc.onclose = function () {
        realtimeConnected = false;
        setAssistantState("idle", "Idle");
      };

      const offer = await realtimePc.createOffer();
      await realtimePc.setLocalDescription(offer);

      const sdpResp = await fetch(realtimeUrl, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: "Bearer " + ephemeralKey,
          "Content-Type": "application/sdp",
        },
      });
      if (!sdpResp.ok) {
        throw new Error("Failed to connect realtime voice");
      }
      const answerSdp = await sdpResp.text();
      await realtimePc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (e) {
      addLog("assistant", "Tutor: Realtime voice connection failed.");
      disconnectRealtimeVoice();
    }
  }

  tabBtn.addEventListener("click", function () {
    setEnabled(!enabled);
    togglePanel(enabled);
    if (enabled) refreshStatus();
  });

  closeBtn.addEventListener("click", function () {
    togglePanel(false);
  });

  orbBtn.addEventListener("click", function () {
    if (!enabled) return;
    startListening();
  });

  listenBtn.addEventListener("click", function () {
    startListening();
  });

  stopBtn.addEventListener("click", function () {
    stopListening();
  });

  realtimeConnectBtn.addEventListener("click", function () {
    if (!enabled) return;
    connectRealtimeVoice();
  });

  realtimeDisconnectBtn.addEventListener("click", function () {
    disconnectRealtimeVoice();
  });

  sendBtn.addEventListener(
    "click",
    function (e) {
      if (!enabled) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const text = inputBox.value.trim();
      inputBox.value = "";
      if (micBtn) micBtn.classList.remove("hidden");
      sendBtn.classList.remove("show");
      askTutor(text);
    },
    true
  );

  inputBox.addEventListener(
    "keydown",
    function (e) {
      if (!enabled) return;
      if (e.key !== "Enter" || e.shiftKey) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const text = inputBox.value.trim();
      inputBox.value = "";
      askTutor(text);
    },
    true
  );

  setEnabled(enabled);
  togglePanel(enabled);
  refreshStatus();
  try {
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  } catch (e) {}
})();
