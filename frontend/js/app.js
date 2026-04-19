/* ══════════════════════════════════════════════════════════
   Quibizz — App Bootstrap & Hash Router
   Routes: #auth | #dashboard | #quiz | #profile | #leaderboard
   ══════════════════════════════════════════════════════ */

import { initAuth, isAuthenticated, getUsername, logout, isGuest } from './auth.js';
import { getProfile, getLeaderboard, saveResult, generateQuiz } from './api.js';
import * as Quiz from './quiz.js';
import * as UI from './ui.js';
import { getPersonalityComment } from './personality.js';
import { initChatbot } from './chatbot.js';

/* ── Router ───────────────────────────────────────────── */
const PAGES = ['auth', 'dashboard', 'quiz', 'profile', 'leaderboard'];

function showPage(name) {
  PAGES.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.toggle('active', p === name);
  });

  const sidebar = document.getElementById('sidebar');
  const topbar  = document.getElementById('topbar');
  if (name === 'auth') {
    sidebar?.classList.add('hidden');
    topbar?.classList.add('hidden');
  } else {
    sidebar?.classList.remove('hidden');
    topbar?.classList.remove('hidden');
    updateTopbarAvatar();
  }

  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.dataset.page === name);
  });

  const pageEl = document.getElementById(`page-${name}`);
  if (pageEl) {
    pageEl.classList.remove('page-enter');
    void pageEl.offsetWidth;
    pageEl.classList.add('page-enter');
  }

  if (name === 'dashboard')   mountDashboard();
  if (name === 'profile')     mountProfile();
  if (name === 'leaderboard') mountLeaderboard();
  if (name === 'quiz')        mountQuizSetup();
}

function navigate(hash) { window.location.hash = hash; }

window.addEventListener('hashchange', handleRoute);
window.addEventListener('load',        handleRoute);

function handleRoute() {
  if (!isAuthenticated()) { showPage('auth'); return; }
  const hash  = window.location.hash.replace('#', '') || 'dashboard';
  const valid = PAGES.filter(p => p !== 'auth');
  showPage(valid.includes(hash) ? hash : 'dashboard');
}

/* ── Topbar ───────────────────────────────────────────── */
function updateTopbarAvatar() {
  const el = document.getElementById('topbar-avatar');
  if (el) el.textContent = getUsername().charAt(0).toUpperCase();
}

/* ── Mobile sidebar ───────────────────────────────────── */
document.getElementById('topbar-menu')?.addEventListener('click', () => {
  document.getElementById('sidebar')?.classList.add('mobile-open');
  document.getElementById('sidebar-overlay')?.classList.add('active');
});
document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
  document.getElementById('sidebar')?.classList.remove('mobile-open');
  document.getElementById('sidebar-overlay')?.classList.remove('active');
});
document.querySelectorAll('.nav-link').forEach(a => {
  a.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.remove('mobile-open');
    document.getElementById('sidebar-overlay')?.classList.remove('active');
  });
});

/* ── Auth ─────────────────────────────────────────────── */
initAuth(() => navigate('dashboard'));

/* ── Logout ───────────────────────────────────────────── */
document.getElementById('btn-logout')?.addEventListener('click', () => {
  logout();
  Quiz.reset();
  window.location.hash = 'auth';
  showPage('auth');
});

/* ═══════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════ */
async function mountDashboard() {
  document.getElementById('dash-username').textContent = getUsername();

  if (!isGuest()) {
    try {
      const stats = await getProfile();
      document.getElementById('dash-streak').textContent   = stats.streak;
      document.getElementById('dash-accuracy').textContent = `${stats.avgScore}%`;
      document.getElementById('dash-quizzes').textContent  = stats.totalQuizzes;
      renderActivity(stats.recentHistory || []);
    } catch (_) { loadLocalDashboard(); }
  } else {
    loadLocalDashboard();
  }

  // Daily challenge — rotates by day of week
  const DAILY = ['Space Exploration','World History','Human Biology','JavaScript','Greek Mythology','Marvel Universe','Science & Physics'];
  const dailyTopic = DAILY[new Date().getDay() % DAILY.length];
  const dailyEl = document.getElementById('daily-topic');
  if (dailyEl) dailyEl.textContent = dailyTopic;

  document.getElementById('btn-start-from-dash')?.addEventListener('click', () => navigate('quiz'), { once: true });
  document.getElementById('btn-daily')?.addEventListener('click', () => {
    localStorage.setItem('qb_auto_topic', dailyTopic);
    navigate('quiz');
  }, { once: true });
}

function loadLocalDashboard() {
  const stats = JSON.parse(localStorage.getItem('qb_local_stats') || '{}');
  document.getElementById('dash-streak').textContent   = stats.streak || 0;
  document.getElementById('dash-accuracy').textContent = `${stats.avgScore || 0}%`;
  document.getElementById('dash-quizzes').textContent  = stats.totalQuizzes || 0;
  renderActivity(JSON.parse(localStorage.getItem('qb_local_history') || '[]'));
}

function renderActivity(history) {
  const list = document.getElementById('activity-list');
  if (!list) return;
  if (!history.length) {
    list.innerHTML = '<div class="activity-empty">No quizzes yet — take your first one! 🚀</div>';
    return;
  }
  list.innerHTML = history.slice(0, 6).map(h => {
    const pct = Math.round(((h.score ?? 0) / (h.total || 1)) * 100);
    return `
      <div class="activity-item">
        <span class="activity-icon">📚</span>
        <span class="activity-topic">${h.topic || 'Quiz'}</span>
        <span class="activity-pct ${pct >= 60 ? 'good' : 'bad'}">${pct}%</span>
      </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════
   QUIZ PAGE — batch adaptive flow
   ═══════════════════════════════════════════════════ */
function mountQuizSetup() {
  showQuizSection('quiz-setup');
  Quiz.reset();

  // Auto-fill from daily challenge
  const autoTopic = localStorage.getItem('qb_auto_topic');
  if (autoTopic) {
    const el = document.getElementById('topic-input');
    if (el) el.value = autoTopic;
    localStorage.removeItem('qb_auto_topic');
  }

  // Topic chips
  document.querySelectorAll('.topic-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const el = document.getElementById('topic-input');
      if (el) el.value = chip.dataset.topic;
      document.querySelectorAll('.topic-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
    });
  });

  document.getElementById('btn-start')?.addEventListener('click', startQuizFlow, { once: true });
}

async function startQuizFlow() {
  const topic      = document.getElementById('topic-input')?.value.trim();
  const difficulty = document.getElementById('difficulty-select')?.value || 'medium';
  const count      = parseInt(document.getElementById('count-select')?.value || '5', 10);

  if (!topic) {
    UI.showToast('🦆 Quack! Please enter a topic!');
    document.getElementById('topic-input')?.focus();
    document.getElementById('btn-start')?.addEventListener('click', startQuizFlow, { once: true });
    return;
  }

  // Read adaptive context — did user do well in their LAST quiz?
  const lastResult = localStorage.getItem('qb_last_result');
  const isCorrect  = lastResult === null ? null : lastResult === 'true';

  Quiz.startLoading(topic, difficulty, count);
  const loadingEl = document.getElementById('loading-topic');
  if (loadingEl) loadingEl.textContent = topic;
  showQuizSection('quiz-loading');

  try {
    // Request a 3× pool so per-question adaptive picker always has options at each difficulty
    // Pool = count + 50% buffer so adaptive picker has easy/medium/hard options.
    // Backend caps at 60 so large quizzes are fully supported.
    const poolSize = Math.max(count + Math.ceil(count * 0.5), 10);
    const data = await generateQuiz(topic, difficulty, poolSize, isCorrect);

    if (!data.questions || data.questions.length === 0) {
      throw new Error('No questions returned. Please try again.');
    }

    Quiz.startQuiz(data.questions);   // pass full pool
    renderCurrentQuestion();
    showQuizSection('quiz-active');
    wireQuizControls();
  } catch (err) {
    UI.showToast(`❌ ${err.message}`);
    Quiz.reset();
    showQuizSection('quiz-setup');
    document.getElementById('btn-start')?.addEventListener('click', startQuizFlow, { once: true });
  }
}

function showQuizSection(id) {
  ['quiz-setup','quiz-loading','quiz-active','quiz-results'].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.toggle('hidden', s !== id);
  });
}

function renderCurrentQuestion() {
  const q = Quiz.getCurrentQ();
  if (!q) return;
  UI.renderQuestion(q, Quiz.getTopic());
  UI.setCounter(Quiz.getIndex() + 1, Quiz.getTotal());
  UI.setProgress(Quiz.getIndex(), Quiz.getTotal());
  UI.setScore(Quiz.getScore());
  UI.setDiffBadge(q.difficulty || Quiz.getDifficulty());
}

function wireQuizControls() {
  // Options grid (delegate)
  const grid = document.getElementById('options-grid');
  grid?.addEventListener('click', (e) => {
    const btn = e.target.closest('.option-btn');
    if (!btn || Quiz.getState() !== Quiz.State.ACTIVE) return;
    const idx      = parseInt(btn.getAttribute('data-index'), 10);
    const result   = Quiz.submitAnswer(idx);
    if (!result) return;

    // Generate personality comment based on current question's difficulty
    const currentQ   = Quiz.getQuestions()[Quiz.getIndex()];
    const difficulty = currentQ?.difficulty || Quiz.getDifficulty();
    const personality = getPersonalityComment(difficulty, result.isCorrect);

    UI.showAnswerFeedback(idx, result.correctIndex, result.explanation, result.isCorrect, personality);
    UI.setScore(Quiz.getScore());
    if (result.isCorrect && Quiz.isLast()) setTimeout(() => UI.launchConfetti(90), 500);
  });

  // Next button
  document.getElementById('btn-next')?.addEventListener('click', () => {
    const prevDiff = Quiz.getCurrentQ()?.difficulty;
    const hasNext  = Quiz.nextQuestion();
    if (!hasNext) { showResults(); return; }
    const nextDiff = Quiz.getCurrentQ()?.difficulty;
    // Show difficulty change toast
    if (prevDiff && nextDiff && prevDiff !== nextDiff) {
      const harder = ['easy','medium','hard'].indexOf(nextDiff) > ['easy','medium','hard'].indexOf(prevDiff);
      UI.showToast(harder ? '🔥 Nice! Stepping it up a notch!' : '💡 Let\'s ease in a bit...');
    }
    renderCurrentQuestion();
  });

  // Hint button
  document.getElementById('btn-hint')?.addEventListener('click', () => {
    const q = Quiz.getCurrentQ();
    if (!q) return;
    const hintBox  = document.getElementById('hint-box');
    const hintText = document.getElementById('hint-text');
    if (!hintBox || !hintText) return;
    const correct = q.options[q.correctIndex];
    hintText.textContent = `💡 The correct answer starts with "${correct.charAt(0)}" and has ${correct.length} characters.`;
    hintBox.classList.toggle('hidden');
  });

  // Skip button
  document.getElementById('btn-skip')?.addEventListener('click', () => {
    Quiz.skipQuestion();
    if (Quiz.getState() === Quiz.State.COMPLETE) { showResults(); return; }
    renderCurrentQuestion();
  });
}

function showResults() {
  const pct   = Quiz.getFinalScorePct();
  const label = Quiz.getResultLabel(pct);

  UI.renderResults(
    pct, Quiz.getScore(), Quiz.getTotal(),
    Quiz.getAnswers(), Quiz.getQuestions(),
    Quiz.getTimeTaken(), label,
  );

  showQuizSection('quiz-results');
  if (pct >= 80) setTimeout(() => UI.launchConfetti(pct >= 100 ? 150 : 80), 400);

  persistResult();

  // Result action buttons
  document.getElementById('btn-new-topic')?.addEventListener('click', () => {
    Quiz.reset();
    navigate('dashboard');
  }, { once: true });
  document.getElementById('btn-play-again')?.addEventListener('click', async () => {
    const topic = Quiz.getTopic(), diff = Quiz.getDifficulty(), count = Quiz.getTotal();
    const lastResult = localStorage.getItem('qb_last_result');
    const isCorrect  = lastResult === null ? null : lastResult === 'true';

    Quiz.reset();
    Quiz.startLoading(topic, diff, count);
    showQuizSection('quiz-loading');
    const loadingEl = document.getElementById('loading-topic');
    if (loadingEl) loadingEl.textContent = topic;

    try {
      const poolSize = Math.max(count + Math.ceil(count * 0.5), 10);
      const data = await generateQuiz(topic, diff, poolSize, isCorrect);
      if (!data.questions?.length) throw new Error('No questions returned.');
      Quiz.startQuiz(data.questions);
      renderCurrentQuestion();
      showQuizSection('quiz-active');
      wireQuizControls();
    } catch (err) {
      UI.showToast(`❌ ${err.message}`);
      showQuizSection('quiz-setup');
    }
  }, { once: true });
}

function persistResult() {
  const score = Quiz.getScore();
  const total = Quiz.getTotal();
  const pct   = Quiz.getFinalScorePct();

  // Store overall pass/fail for next adaptive quiz
  localStorage.setItem('qb_last_result', String(pct >= 60));

  const entry = {
    topic:      Quiz.getTopic(),
    difficulty: Quiz.getDifficulty(),
    score, total,
    timestamp:  new Date().toISOString(),
  };

  // Local history
  const history = JSON.parse(localStorage.getItem('qb_local_history') || '[]');
  history.unshift(entry);
  localStorage.setItem('qb_local_history', JSON.stringify(history.slice(0, 20)));

  // Local stats
  const raw   = localStorage.getItem('qb_local_stats');
  const stats = raw ? JSON.parse(raw) : { streak: 0, totalCorrect: 0, totalQuestions: 0, totalQuizzes: 0, avgScore: 0 };
  stats.totalQuizzes++;
  stats.totalCorrect   += score;
  stats.totalQuestions += total;
  stats.avgScore = Math.round((stats.totalCorrect / stats.totalQuestions) * 100);
  const today = new Date().toDateString();
  if (stats.lastDate === today) { /* same day */ }
  else if (stats.lastDate === new Date(Date.now() - 86400000).toDateString()) { stats.streak = (stats.streak || 0) + 1; }
  else { stats.streak = 1; }
  stats.lastDate = today;
  localStorage.setItem('qb_local_stats', JSON.stringify(stats));

  // Remote save (logged-in users)
  if (!isGuest()) {
    saveResult(Quiz.getTopic(), Quiz.getDifficulty(), score, total).catch(() => {});
  }
}

/* ═══════════════════════════════════════════════════════
   PROFILE
   ═══════════════════════════════════════════════════ */
async function mountProfile() {
  const username = getUsername();
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('profile-name', username);
  set('profile-avatar', username.charAt(0).toUpperCase());

  let streak = 0, accuracy = 0, quizzes = 0, bestTopic = '—';

  if (!isGuest()) {
    try {
      const stats = await getProfile();
      streak    = stats.streak;
      accuracy  = stats.avgScore;
      quizzes   = stats.totalQuizzes;
      bestTopic = stats.bestTopic;
    } catch (_) {}
  } else {
    const s = JSON.parse(localStorage.getItem('qb_local_stats') || '{}');
    streak   = s.streak || 0;
    accuracy = s.avgScore || 0;
    quizzes  = s.totalQuizzes || 0;
  }

  set('profile-streak', streak);
  set('profile-accuracy', `${accuracy}%`);
  set('profile-quizzes', quizzes);
  set('profile-best-topic', bestTopic);
  renderAchievements(quizzes, streak, accuracy);
}

function renderAchievements(quizzes, streak, accuracy) {
  const grid = document.getElementById('achievements-grid');
  if (!grid) return;
  const ach = [
    { icon: '🎯', name: 'First Quiz',   unlocked: quizzes >= 1  },
    { icon: '🔥', name: '3-Day Streak', unlocked: streak  >= 3  },
    { icon: '📚', name: '10 Quizzes',   unlocked: quizzes >= 10 },
    { icon: '⭐', name: '100% Score',   unlocked: accuracy === 100 },
    { icon: '🚀', name: '25 Quizzes',   unlocked: quizzes >= 25 },
    { icon: '🏆', name: 'Quiz Master',  unlocked: quizzes >= 50 },
  ];
  grid.innerHTML = ach.map(a => `
    <div class="achievement ${a.unlocked ? '' : 'locked'}">
      <span class="ach-icon">${a.icon}</span>
      <span class="ach-name">${a.name}</span>
    </div>`).join('');
}

/* ═══════════════════════════════════════════════════════
   LEADERBOARD
   ═══════════════════════════════════════════════════ */
async function mountLeaderboard() {
  const listEl  = document.getElementById('lb-list');
  const emptyEl = document.getElementById('lb-empty');
  const podium  = document.getElementById('podium');
  if (!listEl) return;

  try {
    const { leaderboard } = await getLeaderboard();
    if (!leaderboard.length) { emptyEl?.classList.remove('hidden'); return; }

    const me = getUsername();

    // Podium (2nd | 1st | 3rd layout)
    const top3 = leaderboard.slice(0, 3);
    const order = [top3[1], top3[0], top3[2]].filter(Boolean);
    if (podium) {
      const medals = ['🥇','🥈','🥉'];
      const heights = [2, 1, 3]; // 2nd is center-tall
      podium.innerHTML = order.map((u, i) => {
        const rank = order.indexOf(u) === 1 ? 0 : order.indexOf(u) === 0 ? 1 : 2;
        return `
          <div class="podium-item">
            <div class="podium-avatar">${u.username.charAt(0).toUpperCase()}</div>
            <div class="podium-name">${u.username}${u.username === me ? ' 👈' : ''}</div>
            <div class="podium-score">${u.accuracy}%</div>
            <div class="podium-block">${medals[rank]}</div>
          </div>`;
      }).join('');
    }

    listEl.innerHTML = leaderboard.map((u, i) => `
      <div class="lb-row ${u.username === me ? 'you' : ''}">
        <span class="lb-rank ${i < 3 ? 'top' : ''}">${i < 3 ? ['🥇','🥈','🥉'][i] : `#${i + 1}`}</span>
        <div class="lb-avatar">${u.username.charAt(0).toUpperCase()}</div>
        <span class="lb-username">
          ${u.username}
          ${u.username === me ? '<span class="lb-you-tag">You</span>' : ''}
        </span>
        <span class="lb-stat">${u.accuracy}%</span>
        <span class="lb-streak">🔥 ${u.streak}</span>
      </div>`).join('');

  } catch (_) {
    emptyEl?.classList.remove('hidden');
    listEl.innerHTML = '';
  }
}

/* ── Start ────────────────────────────────────────────── */
handleRoute();
initChatbot();
