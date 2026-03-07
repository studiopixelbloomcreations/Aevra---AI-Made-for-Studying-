(function () {
  var TOKEN_KEY = 'g9_token';
  var TOKEN_EXP_KEY = 'g9_token_exp';
  var THEME_KEY = 'tutor_landing_theme';

  function isTokenValid() {
    try {
      var token = localStorage.getItem(TOKEN_KEY);
      var expRaw = localStorage.getItem(TOKEN_EXP_KEY);
      var exp = expRaw ? parseInt(expRaw, 10) : 0;
      if (!token || !exp) return false;
      return Date.now() < (exp - 60000);
    } catch (e) {
      return false;
    }
  }

  function launchTutor() {
    if (isTokenValid()) {
      window.location.href = 'index.html';
      return;
    }
    window.location.href = 'login.html?return=index.html';
  }

  function applyTheme(theme) {
    var root = document.documentElement;
    var next = theme === 'light' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    var themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
      themeBtn.textContent = next === 'light' ? 'Dark Mode' : 'Light Mode';
    }
  }

  function initTheme() {
    var stored = null;
    try { stored = localStorage.getItem(THEME_KEY); } catch (e) {}
    applyTheme(stored || 'dark');
  }

  function initReveal() {
    var reveals = document.querySelectorAll('.lp-reveal');
    if (!('IntersectionObserver' in window) || !reveals.length) {
      reveals.forEach(function (node) { node.classList.add('lp-reveal-on'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('lp-reveal-on');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18 });

    reveals.forEach(function (node, idx) {
      node.style.transitionDelay = (idx * 80) + 'ms';
      observer.observe(node);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    initReveal();

    var launchButtons = [
      document.getElementById('launchTutorBtn'),
      document.getElementById('launchTutorBtn2')
    ];
    document.querySelectorAll('.launch-now').forEach(function (btn) { launchButtons.push(btn); });
    launchButtons.forEach(function (btn) {
      if (btn) btn.addEventListener('click', launchTutor);
    });

    var themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', function () {
        var current = document.documentElement.getAttribute('data-theme') || 'dark';
        applyTheme(current === 'dark' ? 'light' : 'dark');
      });
    }
  });
})();
