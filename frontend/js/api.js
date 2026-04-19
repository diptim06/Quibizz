/* ══════════════════════════════════════════════════════════
   Quibizz — API Layer
   All backend calls go through this module.
   ══════════════════════════════════════════════════════ */

const API_BASE = 'http://localhost:3001/api';

function getToken() {
  return localStorage.getItem('qb_token');
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}

/* ── Auth ─────────────────────────────────────────────── */
export async function login(username, password) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function signup(username, password) {
  return apiFetch('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function getProfile() {
  return apiFetch('/auth/profile');
}

export async function saveResult(topic, difficulty, score, total) {
  return apiFetch('/auth/result', {
    method: 'POST',
    body: JSON.stringify({ topic, difficulty, score, total }),
  });
}

export async function getLeaderboard() {
  return apiFetch('/auth/leaderboard');
}

/* ── Quiz ─────────────────────────────────────────────── */

/**
 * Generate a full adaptive quiz batch.
 * @param {string}       topic
 * @param {string}       difficulty  – 'easy' | 'medium' | 'hard'
 * @param {number}       count       – number of questions
 * @param {boolean|null} isCorrect   – previous quiz overall result (null = first time)
 * @returns {Promise<{ questions: Array, topic, difficulty, count }>}
 */
export async function generateQuiz(topic, difficulty, count, isCorrect = null) {
  return apiFetch('/quiz/generate', {
    method: 'POST',
    body: JSON.stringify({ topic, difficulty, count, isCorrect }),
  });
}

export async function checkHealth() {
  return apiFetch('/health');
}
