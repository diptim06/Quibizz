/* ══════════════════════════════════════════════════════════
   Quibizz — Auth Module
   Handles login, signup, guest mode, token persistence
   ══════════════════════════════════════════════════════ */

import { login as apiLogin, signup as apiSignup } from './api.js';

const TOKEN_KEY    = 'qb_token';
const USERNAME_KEY = 'qb_username';
const GUEST_KEY    = 'qb_guest';

/* ── Storage helpers ──────────────────────────────────── */
export function saveAuth(token, username) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, username);
  localStorage.removeItem(GUEST_KEY);
}

export function setGuest() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.setItem(USERNAME_KEY, 'Guest');
  localStorage.setItem(GUEST_KEY, '1');
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(GUEST_KEY);
}

export function isLoggedIn() {
  return !!localStorage.getItem(TOKEN_KEY);
}

export function isGuest() {
  return localStorage.getItem(GUEST_KEY) === '1';
}

export function isAuthenticated() {
  return isLoggedIn() || isGuest();
}

export function getUsername() {
  return localStorage.getItem(USERNAME_KEY) || 'friend';
}

/* ── Auth page logic ──────────────────────────────────── */
export function initAuth(onSuccess) {
  const tabLogin  = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const formLogin = document.getElementById('form-login');
  const formSignup = document.getElementById('form-signup');
  const btnGuest  = document.getElementById('btn-guest');

  // Tab switching
  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    formLogin.classList.add('active');
    formSignup.classList.remove('active');
    clearErrors();
  });

  tabSignup.addEventListener('click', () => {
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    formSignup.classList.add('active');
    formLogin.classList.remove('active');
    clearErrors();
  });

  // Login submit
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    let valid = true;
    if (!username) { showFieldErr('login-username-err', 'Username is required'); valid = false; }
    if (!password) { showFieldErr('login-password-err', 'Password is required'); valid = false; }
    if (!valid) return;

    setLoading('btn-login', true);
    try {
      const data = await apiLogin(username, password);
      saveAuth(data.token, data.username);
      onSuccess();
    } catch (err) {
      showFormErr('login-error', err.message);
    } finally {
      setLoading('btn-login', false);
    }
  });

  // Signup submit
  formSignup.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value;

    let valid = true;
    if (!username || username.length < 3) { showFieldErr('signup-username-err', 'Min 3 characters'); valid = false; }
    if (!password || password.length < 6) { showFieldErr('signup-password-err', 'Min 6 characters'); valid = false; }
    if (!valid) return;

    setLoading('btn-signup', true);
    try {
      const data = await apiSignup(username, password);
      saveAuth(data.token, data.username);
      onSuccess();
    } catch (err) {
      showFormErr('signup-error', err.message);
    } finally {
      setLoading('btn-signup', false);
    }
  });

  // Guest mode
  btnGuest.addEventListener('click', () => {
    setGuest();
    onSuccess();
  });

  // Enter key handling
  document.getElementById('login-username').addEventListener('keydown', e => { if (e.key === 'Enter') formLogin.requestSubmit(); });
  document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') formLogin.requestSubmit(); });
  document.getElementById('signup-username').addEventListener('keydown', e => { if (e.key === 'Enter') formSignup.requestSubmit(); });
  document.getElementById('signup-password').addEventListener('keydown', e => { if (e.key === 'Enter') formSignup.requestSubmit(); });
}

/* Helpers */
function showFieldErr(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}
function showFormErr(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.add('show'); }
}
function clearErrors() {
  ['login-username-err','login-password-err','login-error','signup-username-err','signup-password-err','signup-error']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = ''; el.classList.remove('show'); }
    });
}
function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const label  = btn.querySelector('.btn-label');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled = loading;
  if (label)  label.classList.toggle('hidden', loading);
  if (loader) loader.classList.toggle('hidden', !loading);
}
