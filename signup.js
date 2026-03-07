document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('signupForm');
  const toast = document.getElementById('toast');
  const TOKEN_KEY = 'g9_token';
  const TOKEN_EXP_KEY = 'g9_token_exp';

  function getReturnTarget(){
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('return') || 'index.html';
    } catch (e) {
      return 'index.html';
    }
  }

  async function storeTokenFromUser(user){
    if(!user) return false;
    try {
      const res = await user.getIdTokenResult(true);
      const expMs = Date.parse(res.expirationTime);
      localStorage.setItem(TOKEN_KEY, res.token);
      localStorage.setItem(TOKEN_EXP_KEY, String(expMs));
      return true;
    } catch (e) {
      return false;
    }
  }

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    toast.style.opacity = '1';
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(()=> (toast.hidden = true), 400);
    }, 2600);
  }

  function validEmail(e){ return /\S+@\S+\.\S+/.test(e); }

  (async function(){
    try {
      const res = await auth.getRedirectResult();
      if(res && res.user){
        const ok = await storeTokenFromUser(res.user);
        if(ok){
          showToast('Account ready. Redirecting...');
          setTimeout(()=> window.location.href = getReturnTarget(), 900);
        }
      }
    } catch (e) {
      console.error('Signup redirect error:', e);
    }
  })();

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const pw = form.password.value;
    const confirm = form.confirm.value;
    const terms = form.terms.checked;

    if (!name) return showToast('Please enter your name.');
    if (!validEmail(email)) return showToast('Enter a valid email.');
    if (!pw || pw.length < 6) return showToast('Password must be 6+ characters.');
    if (pw !== confirm) return showToast('Passwords do not match.');
    if (!terms) return showToast('Please accept the terms.');

    try {
      const cred = await auth.createUserWithEmailAndPassword(email, pw);
      // update profile
      if (cred.user) {
        await cred.user.updateProfile({ displayName: name });
        // optional: send verification email
        try { await cred.user.sendEmailVerification(); showToast('Account created. Verification sent to email.'); }
        catch(e){ console.warn('Verification email failed', e); showToast('Account created. (Verify email failed)'); }
      }
      await storeTokenFromUser(cred && cred.user);
      setTimeout(()=> window.location.href = getReturnTarget(), 1000);
    } catch (err) {
      showToast(err.message || 'Signup failed');
    }
  });

  document.querySelectorAll('.btn-social[data-provider="google"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('email');
        let cred = null;
        try {
          cred = await auth.signInWithPopup(provider);
        } catch (popupErr) {
          const code = popupErr && popupErr.code ? String(popupErr.code) : '';
          if(code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user'){
            await auth.signInWithRedirect(provider);
            return;
          }
          throw popupErr;
        }
        const ok = await storeTokenFromUser(cred && cred.user);
        if (!ok) {
          showToast('Unable to complete signup. Please try again.');
          return;
        }
        showToast('Account ready. Redirecting...');
        setTimeout(()=> window.location.href = getReturnTarget(), 900);
      } catch (err) {
        showToast((err && err.message) ? err.message : 'Google signup failed');
      }
    });
  });

  // small UX: Enter handling
  [form.name, form.email, form.password, form.confirm].forEach(el => {
    el && el.addEventListener('keydown', (e) => { if (e.key === 'Enter') form.dispatchEvent(new Event('submit', {cancelable:true})); });
  });
});
