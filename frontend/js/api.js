/* ═══════════════════════════════════════════════════════
   Quibizz — API layer
   All calls go through this module.
   ═══════════════════════════════════════════════════════ */

const API_BASE = 'http://localhost:3001/api';

/**
 * Generic fetch wrapper
 */
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `API error: ${res.status}`);
  }

  return data;
}

/**
 * Generate quiz questions
 * @param {string} topic
 * @param {string} difficulty  – 'easy' | 'medium' | 'hard'
 * @param {number} count
 * @returns {Promise<{ questions: Array, topic: string, difficulty: string }>}
 */
export async function generateQuiz(topic, difficulty, count) {
  return apiFetch('/quiz/generate', {
    method: 'POST',
    body: JSON.stringify({ topic, difficulty, count }),
  });
}

/**
 * Health check – tells us if the backend + Gemini key are ready
 */
export async function checkHealth() {
  return apiFetch('/health');
}
