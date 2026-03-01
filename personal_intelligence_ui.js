(function () {
  const tabBtn = document.getElementById('personalIntelligenceTab');
  const inputBox = document.getElementById('inputBox');
  const sendBtn = document.getElementById('sendBtn');
  const micBtn = document.getElementById('micBtn');
  const messagesEl = document.getElementById('messages');
  const welcomePanel = document.getElementById('welcomePanel');

  if (!tabBtn || !inputBox || !sendBtn || !messagesEl) return;

  let enabled = localStorage.getItem('g9_personal_intelligence_enabled') === 'true';
  const STORAGE_KEY = 'g9_personal_intelligence_enabled';

  function isExamModeEnabled() {
    try {
      return !!(window.ExamModeContext && window.ExamModeContext.getEnabled && window.ExamModeContext.getEnabled());
    } catch (e) {
      return false;
    }
  }

  function setEnabled(next) {
    enabled = !!next;
    localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    tabBtn.classList.toggle('active', enabled);
    tabBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    inputBox.placeholder = enabled ? 'Talk to Tutor (personal assistant)...' : 'Ask me anything...';
  }

  function appendMessage(role, content) {
    const m = document.createElement('div');
    m.className = 'msg ' + (role === 'user' ? 'user' : 'ai') + ' show';
    m.textContent = String(content || '');
    messagesEl.appendChild(m);
    try {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } catch (e) {}
    return m;
  }

  function collectHistory(limit) {
    const items = [];
    const nodes = messagesEl.querySelectorAll('.msg');
    const start = Math.max(0, nodes.length - (limit || 16));
    for (let i = start; i < nodes.length; i++) {
      const n = nodes[i];
      if (!n || !n.textContent) continue;
      const role = n.classList.contains('user') ? 'user' : 'assistant';
      items.push({ role, content: String(n.textContent).slice(0, 1200) });
    }
    return items;
  }

  async function sendViaPersonalIntelligence() {
    const text = inputBox.value.trim();
    if (!text) return;
    if (isExamModeEnabled()) return;

    if (welcomePanel) welcomePanel.style.display = 'none';
    messagesEl.style.display = 'flex';

    appendMessage('user', text);
    const thinkingNode = appendMessage('ai', 'Thinking...');
    inputBox.value = '';
    if (micBtn) micBtn.classList.remove('hidden');
    sendBtn.classList.remove('show');

    const payload = {
      message: text,
      email: 'guest@student.com',
      language: localStorage.getItem('g9_language') || 'English',
      subject: localStorage.getItem('g9_subject') || 'General',
      title: 'Perosnla IIntelligence',
      history: collectHistory(18),
    };

    try {
      const res = await (window.Api && window.Api.apiFetch
        ? window.Api.apiFetch('/personal-intelligence/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : fetch('/personal-intelligence/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }));

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data && (data.detail || data.error)) || 'Personal assistant request failed');
      }
      const answer = (data && data.answer) ? String(data.answer) : 'Tutor returned an empty response.';
      thinkingNode.textContent = answer;
    } catch (e) {
      thinkingNode.textContent = 'Request failed. Please try again.';
    }
  }

  tabBtn.addEventListener('click', function () {
    setEnabled(!enabled);
  });

  sendBtn.addEventListener('click', function (e) {
    if (!enabled) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    sendViaPersonalIntelligence();
  }, true);

  inputBox.addEventListener('keydown', function (e) {
    if (!enabled) return;
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    sendViaPersonalIntelligence();
  }, true);

  setEnabled(enabled);
  try {
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  } catch (e) {}
})();
