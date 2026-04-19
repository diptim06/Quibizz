/* ══════════════════════════════════════════════════════════
   Quibizz — Quiz State Machine (Per-Question Adaptive Mode)
   States: IDLE → LOADING → ACTIVE → REVIEWING → COMPLETE

   Adaptive logic:
     - Correct answer  → next question difficulty goes UP
     - Wrong answer    → next question difficulty goes DOWN
     - Questions are picked on-the-fly from a pre-fetched pool
   ══════════════════════════════════════════════════════ */

export const State = Object.freeze({
  IDLE:      'IDLE',
  LOADING:   'LOADING',
  ACTIVE:    'ACTIVE',
  REVIEWING: 'REVIEWING',
  COMPLETE:  'COMPLETE',
});

const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];

// ── State ─────────────────────────────────────────────────────
let _state          = State.IDLE;
let pool            = [];   // full pool returned by API (mixed difficulties)
let usedPoolIndices = new Set(); // track which pool items have been used
let playedQuestions = [];   // sequence of questions actually shown to user
let currentIndex    = 0;    // index into playedQuestions
let currentDiff     = 'medium';
let score           = 0;
let answers         = [];   // { questionIndex, selectedIndex, isCorrect }
let topic           = '';
let difficulty      = 'medium'; // initial difficulty chosen by user
let totalCount      = 5;
let startTime       = null;

/* ── Getters ──────────────────────────────────────────────── */
export const getState      = () => _state;
export const getQuestions  = () => playedQuestions;
export const getCurrentQ   = () => playedQuestions[currentIndex] ?? null;
export const getIndex      = () => currentIndex;
export const getScore      = () => score;
export const getAnswers    = () => answers;
export const getTopic      = () => topic;
export const getDifficulty = () => difficulty;
export const getTotal      = () => totalCount;
export const isLast        = () => currentIndex >= totalCount - 1;
export const getTimeTaken  = () => startTime ? Math.round((Date.now() - startTime) / 1000) : 0;

export function getScorePct() {
  return answers.length > 0 ? Math.round((score / answers.length) * 100) : 0;
}

export function getFinalScorePct() {
  return totalCount > 0 ? Math.round((score / totalCount) * 100) : 0;
}

export function getResultLabel(pct) {
  if (pct === 100) return { emoji: '🎉', text: 'Perfect Score!',  sub: "You're a genius duck!" };
  if (pct >= 80)  return { emoji: '🌟', text: 'Excellent!',      sub: 'You really know your stuff!' };
  if (pct >= 60)  return { emoji: '👍', text: 'Good Job!',       sub: "Keep practising, you're getting there!" };
  if (pct >= 40)  return { emoji: '🦆', text: 'Not Bad!',        sub: 'The duck believes in you!' };
  return           { emoji: '💪', text: 'Keep Going!',           sub: 'Every expert was once a beginner.' };
}

/* ── Difficulty helpers ───────────────────────────────────── */
function stepUp(diff) {
  const idx = DIFFICULTY_ORDER.indexOf(diff);
  return DIFFICULTY_ORDER[Math.min(idx + 1, DIFFICULTY_ORDER.length - 1)];
}

function stepDown(diff) {
  const idx = DIFFICULTY_ORDER.indexOf(diff);
  return DIFFICULTY_ORDER[Math.max(idx - 1, 0)];
}

/**
 * Pick a question from the pool following this priority:
 *  1. Matches targetDiff AND hasn't been shown to user yet (by question text)
 *  2. Any difficulty, hasn't been shown yet
 *  3. Matches targetDiff, already shown (last resort when bank is tiny)
 *  4. Absolutely anything unused by index
 */
function pickFromPool(targetDiff) {
  // Build set of question texts already shown to the user
  const seenTexts = new Set(playedQuestions.map(q => q.question));

  // Priority 1: right difficulty + unseen text
  for (let i = 0; i < pool.length; i++) {
    if (!usedPoolIndices.has(i) && pool[i].difficulty === targetDiff && !seenTexts.has(pool[i].question)) {
      usedPoolIndices.add(i);
      return pool[i];
    }
  }

  // Priority 2: any difficulty + unseen text
  for (let i = 0; i < pool.length; i++) {
    if (!usedPoolIndices.has(i) && !seenTexts.has(pool[i].question)) {
      usedPoolIndices.add(i);
      return pool[i];
    }
  }

  // Priority 3: right difficulty, already seen (pool smaller than quiz count)
  for (let i = 0; i < pool.length; i++) {
    if (!usedPoolIndices.has(i) && pool[i].difficulty === targetDiff) {
      usedPoolIndices.add(i);
      return pool[i];
    }
  }

  // Priority 4: any unused index
  for (let i = 0; i < pool.length; i++) {
    if (!usedPoolIndices.has(i)) {
      usedPoolIndices.add(i);
      return pool[i];
    }
  }

  // Pool fully exhausted — reset and cycle from start so quiz always completes
  // This only happens if the pool has fewer questions than the quiz length
  usedPoolIndices.clear();
  const best = pool.find(q => q.difficulty === targetDiff) ?? pool[0];
  if (best) usedPoolIndices.add(pool.indexOf(best));
  return best ?? pool[0];
}

/* ── Transitions ──────────────────────────────────────────── */
export function startLoading(t, d, count) {
  topic      = t;
  difficulty = d;
  totalCount = count;
  _state     = State.LOADING;
}

/**
 * Initialise the quiz from the fetched pool.
 * @param {Array} fetchedPool  — all questions returned by the API
 */
export function startQuiz(fetchedPool) {
  pool            = fetchedPool;
  usedPoolIndices = new Set();
  playedQuestions = [];
  currentIndex    = 0;
  score           = 0;
  answers         = [];
  currentDiff     = difficulty; // start at user-chosen difficulty
  startTime       = Date.now();

  // Pick the very first question at the chosen difficulty
  const first = pickFromPool(currentDiff);
  if (first) playedQuestions.push(first);

  _state = State.ACTIVE;
}

export function submitAnswer(selectedIndex) {
  if (_state !== State.ACTIVE) return null;
  const q = playedQuestions[currentIndex];
  const isCorrect = selectedIndex === q.correctIndex;
  if (isCorrect) score++;
  answers.push({ questionIndex: currentIndex, selectedIndex, isCorrect });
  _state = State.REVIEWING;

  // Adapt difficulty for NEXT question right now
  currentDiff = isCorrect ? stepUp(currentDiff) : stepDown(currentDiff);

  return { isCorrect, correctIndex: q.correctIndex, explanation: q.explanation || '' };
}

export function skipQuestion() {
  if (_state !== State.ACTIVE) return;
  answers.push({ questionIndex: currentIndex, selectedIndex: -1, isCorrect: false });
  // Treat skip as wrong → easier next question
  currentDiff = stepDown(currentDiff);

  if (currentIndex >= totalCount - 1) { _state = State.COMPLETE; return; }
  _advanceToNext();
}

export function nextQuestion() {
  if (currentIndex >= totalCount - 1) { _state = State.COMPLETE; return false; }
  _advanceToNext();
  return true;
}

/** Internal: pick next question from pool and advance pointer */
function _advanceToNext() {
  const next = pickFromPool(currentDiff);
  if (next) playedQuestions.push(next);
  currentIndex++;
  _state = State.ACTIVE;
}

export function reset() {
  _state          = State.IDLE;
  pool            = [];
  usedPoolIndices = new Set();
  playedQuestions = [];
  currentIndex    = 0;
  score           = 0;
  answers         = [];
  topic           = '';
  difficulty      = 'medium';
  totalCount      = 5;
  startTime       = null;
  currentDiff     = 'medium';
}
