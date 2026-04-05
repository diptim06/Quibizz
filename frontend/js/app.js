/* ═══════════════════════════════════════════════════════
   Quibizz — App Bootstrap & Event Wiring
   ═══════════════════════════════════════════════════════ */

import { generateQuiz } from './api.js';
import * as Quiz from './quiz.js';
import * as UI from './ui.js';

/* ── Elements ──────────────────────────────────────────── */
const topicInput     = document.getElementById('topic-input');
const difficultyEl   = document.getElementById('difficulty-select');
const countEl        = document.getElementById('count-select');
const startBtn       = document.getElementById('btn-start');
const optionsGrid    = document.getElementById('options-grid');
const nextBtn        = document.getElementById('btn-next');
const playAgainBtn   = document.getElementById('btn-play-again');
const newTopicBtn    = document.getElementById('btn-new-topic');

/* ── Start Quiz ────────────────────────────────────────── */
startBtn.addEventListener('click', async () => {
  const topic      = topicInput.value.trim();
  const difficulty = difficultyEl.value;
  const count      = parseInt(countEl.value, 10);

  if (!topic) {
    UI.showToast('🦆 Quack! Please enter a topic first!');
    topicInput.focus();
    return;
  }

  Quiz.startLoading(topic, difficulty);
  UI.showScreen('screen-loading');

  const loadingMsg = document.getElementById('loading-topic');
  if (loadingMsg) loadingMsg.textContent = topic;

  try {
    const data = await generateQuiz(topic, difficulty, count);
    Quiz.startQuiz(data.questions);
    showQuestion();
  } catch (err) {
    console.error(err);
    UI.showToast(`❌ ${err.message || 'Failed to generate quiz. Is the backend running?'}`);
    Quiz.reset();
    UI.showScreen('screen-landing');
  }
});

/* ── Render current question ───────────────────────────── */
function showQuestion() {
  UI.showScreen('screen-quiz');
  const q = Quiz.getCurrentQ();
  if (!q) return;

  UI.renderQuestion(q);
  UI.setCounter(Quiz.getIndex() + 1, Quiz.getTotal());
  UI.setProgress(Quiz.getIndex(), Quiz.getTotal());
  UI.setScore(Quiz.getScore(), Quiz.getTotal());

  // Update topic badge
  const topicBadge = document.getElementById('quiz-topic-badge');
  if (topicBadge) topicBadge.textContent = Quiz.getTopic();

  const diffBadge = document.getElementById('quiz-diff-badge');
  if (diffBadge) {
    diffBadge.textContent = Quiz.getDifficulty();
    diffBadge.className   = `badge badge-${Quiz.getDifficulty()}`;
  }
}

/* ── Option selection ──────────────────────────────────── */
optionsGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.option-btn');
  if (!btn || Quiz.getState() !== Quiz.State.ACTIVE) return;

  const selectedIndex = parseInt(btn.getAttribute('data-index'), 10);
  const result = Quiz.submitAnswer(selectedIndex);
  if (!result) return;

  UI.showAnswerFeedback(selectedIndex, result.correctIndex, result.explanation, result.isCorrect);
  UI.setScore(Quiz.getScore(), Quiz.getTotal());

  if (result.isCorrect && Quiz.getScorePct() === 100 && Quiz.isLast()) {
    setTimeout(() => UI.launchConfetti(120), 600);
  }
});

/* ── Next question ─────────────────────────────────────── */
nextBtn.addEventListener('click', () => {
  const hasNext = Quiz.nextQuestion();
  if (hasNext) {
    showQuestion();
  } else {
    showResults();
  }
});

/* ── Results ───────────────────────────────────────────── */
function showResults() {
  UI.showScreen('screen-results');

  const pct   = Quiz.getScorePct();
  const label = Quiz.getResultLabel(pct);

  UI.renderResults(
    pct,
    Quiz.getScore(),
    Quiz.getTotal(),
    Quiz.getAnswers(),
    Quiz.getQuestions(),
    Quiz.getTimeTaken(),
    label,
  );

  if (pct >= 80) {
    setTimeout(() => UI.launchConfetti(pct >= 100 ? 150 : 80), 500);
  }
}

/* ── Play again (same topic) ───────────────────────────── */
playAgainBtn.addEventListener('click', async () => {
  const topic      = Quiz.getTopic();
  const difficulty = Quiz.getDifficulty();
  const count      = Quiz.getTotal();

  Quiz.reset();
  Quiz.startLoading(topic, difficulty);
  UI.showScreen('screen-loading');

  const loadingMsg = document.getElementById('loading-topic');
  if (loadingMsg) loadingMsg.textContent = topic;

  try {
    const data = await generateQuiz(topic, difficulty, count);
    Quiz.startQuiz(data.questions);
    showQuestion();
  } catch (err) {
    UI.showToast(`❌ ${err.message}`);
    Quiz.reset();
    UI.showScreen('screen-landing');
  }
});

/* ── New topic ─────────────────────────────────────────── */
newTopicBtn.addEventListener('click', () => {
  Quiz.reset();
  topicInput.value = '';
  UI.showScreen('screen-landing');
  topicInput.focus();
});

/* ── Allow Enter key to start ──────────────────────────── */
topicInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startBtn.click();
});

/* ── Init ──────────────────────────────────────────────── */
UI.showScreen('screen-landing');
topicInput.focus();
