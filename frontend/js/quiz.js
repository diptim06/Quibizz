/* ═══════════════════════════════════════════════════════
   Quibizz — Quiz State Machine
   States: IDLE → LOADING → ACTIVE → REVIEWING → COMPLETE
   ═══════════════════════════════════════════════════════ */

export const State = Object.freeze({
  IDLE:      'IDLE',
  LOADING:   'LOADING',
  ACTIVE:    'ACTIVE',
  REVIEWING: 'REVIEWING',
  COMPLETE:  'COMPLETE',
});

let _state = State.IDLE;

let questions    = [];
let currentIndex = 0;
let score        = 0;
let answers      = [];   // { questionIndex, selectedIndex, isCorrect }
let topic        = '';
let difficulty   = 'medium';
let startTime    = null;

/* ── State getters ─────────────────────────────────────── */
export const getState      = () => _state;
export const getQuestions  = () => questions;
export const getCurrentQ   = () => questions[currentIndex] ?? null;
export const getIndex      = () => currentIndex;
export const getScore      = () => score;
export const getAnswers    = () => answers;
export const getTopic      = () => topic;
export const getDifficulty = () => difficulty;
export const getTotal      = () => questions.length;
export const isLast        = () => currentIndex >= questions.length - 1;
export const getTimeTaken  = () => startTime ? Math.round((Date.now() - startTime) / 1000) : 0;

export function getScorePct() {
  return questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
}

export function getResultLabel(pct) {
  if (pct === 100) return { emoji: '🎉', text: 'Perfect Score!', sub: "You're a genius duck!" };
  if (pct >= 80)  return { emoji: '🌟', text: 'Excellent!',     sub: 'You really know your stuff!' };
  if (pct >= 60)  return { emoji: '👍', text: 'Good Job!',      sub: 'Keep practising, you\'re getting there!' };
  if (pct >= 40)  return { emoji: '🦆', text: 'Not Bad!',       sub: 'The duck believes in you!' };
  return           { emoji: '💪', text: 'Keep Going!',          sub: 'Every expert was once a beginner.' };
}

/* ── Transitions ───────────────────────────────────────── */
export function startLoading(t, d) {
  topic      = t;
  difficulty = d;
  _state     = State.LOADING;
}

export function startQuiz(qs) {
  questions    = qs;
  currentIndex = 0;
  score        = 0;
  answers      = [];
  startTime    = Date.now();
  _state       = State.ACTIVE;
}

export function submitAnswer(selectedIndex) {
  if (_state !== State.ACTIVE) return null;

  const q = questions[currentIndex];
  const isCorrect = selectedIndex === q.correctIndex;

  if (isCorrect) score++;

  answers.push({ questionIndex: currentIndex, selectedIndex, isCorrect });

  _state = State.REVIEWING;
  return { isCorrect, correctIndex: q.correctIndex, explanation: q.explanation };
}

export function nextQuestion() {
  if (isLast()) {
    _state = State.COMPLETE;
    return false;
  }
  currentIndex++;
  _state = State.ACTIVE;
  return true;
}

export function reset() {
  _state       = State.IDLE;
  questions    = [];
  currentIndex = 0;
  score        = 0;
  answers      = [];
  topic        = '';
  startTime    = null;
}
