/* ══════════════════════════════════════════════════════════
   Quibizz — UI Helpers (updated for new design)
   ══════════════════════════════════════════════════════ */

/* ── Toast ────────────────────────────────────────────── */
let toastTimer = null;
export function showToast(message, duration = 3200) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

/* ── Progress ─────────────────────────────────────────── */
export function setProgress(current, total) {
  const fill = document.getElementById('progress-fill');
  if (fill) fill.style.width = `${Math.round((current / total) * 100)}%`;
}

/* ── Counter ──────────────────────────────────────────── */
export function setCounter(current, total) {
  const el = document.getElementById('question-counter');
  if (el) el.textContent = `Q ${current} / ${total}`;
}

/* ── Score ────────────────────────────────────────────── */
export function setScore(score) {
  const el = document.getElementById('score-display');
  if (el) el.textContent = `⭐ ${score}`;
}

/* ── Difficulty badge ─────────────────────────────────── */
export function setDiffBadge(diff) {
  const el = document.getElementById('quiz-diff-badge');
  if (!el) return;
  el.textContent = diff;
  el.className = `diff-badge ${diff}`;
}

/* ── Render question ──────────────────────────────────── */
const LETTERS = ['A', 'B', 'C', 'D'];

export function renderQuestion(question, topic) {
  const qText = document.getElementById('question-text');
  if (qText) qText.textContent = question.question;

  const topicBadge = document.getElementById('quiz-topic-badge');
  if (topicBadge) topicBadge.textContent = topic || '';

  const grid = document.getElementById('options-grid');
  if (!grid) return;
  grid.innerHTML = '';

  question.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.id = `option-${i}`;
    btn.setAttribute('data-index', i);
    btn.innerHTML = `
      <span class="option-letter">${LETTERS[i]}</span>
      <span class="option-text">${opt}</span>
    `;
    grid.appendChild(btn);
  });

  // Reset UI state
  const expBox = document.getElementById('explanation-box');
  if (expBox) { expBox.classList.remove('visible'); expBox.innerHTML = ''; }

  const nextBtn = document.getElementById('btn-next');
  if (nextBtn) nextBtn.classList.remove('visible');

  const hintBox = document.getElementById('hint-box');
  if (hintBox) hintBox.classList.add('hidden');

  setDuckReaction('neutral');
}

/* ── Answer feedback ──────────────────────────────────── */
/**
 * @param {number} selectedIndex
 * @param {number} correctIndex
 * @param {string} explanation
 * @param {boolean} isCorrect
 * @param {{ mode, meta, line }|null} personality
 */
export function showAnswerFeedback(selectedIndex, correctIndex, explanation, isCorrect, personality = null) {
  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.disabled = true;
    const idx = parseInt(btn.getAttribute('data-index'));
    if (idx === correctIndex)                   btn.classList.add('correct');
    else if (idx === selectedIndex && !isCorrect) btn.classList.add('wrong');
  });

  const expBox = document.getElementById('explanation-box');
  if (expBox) {
    // Personality bubble
    let personalityHTML = '';
    if (personality) {
      const { mode, meta, line } = personality;
      personalityHTML = `
        <div class="personality-bubble personality-${mode}">
          <span class="personality-icon">${meta.emoji}</span>
          <p class="personality-line">${line}</p>
        </div>
      `;
    }
    expBox.innerHTML = `
      ${personalityHTML}
      <span class="exp-label">💡 Explanation</span>${explanation}
    `;
    expBox.classList.add('visible');
  }

  const nextBtn = document.getElementById('btn-next');
  if (nextBtn) nextBtn.classList.add('visible');

  setDuckReaction(isCorrect ? 'happy' : 'sad');
  showFloatingFeedback(isCorrect);
}

/* ── Duck reaction ────────────────────────────────────── */
export function setDuckReaction(mood) {
  const duck = document.getElementById('duck-reaction');
  if (!duck) return;
  duck.className = 'q-duck';
  void duck.offsetWidth;
  if (mood === 'happy') duck.classList.add('happy');
  else if (mood === 'sad') duck.classList.add('sad');
}

/* ── Floating feedback ────────────────────────────────── */
export function showFloatingFeedback(isCorrect) {
  const existing = document.querySelector('.feedback-float');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = `feedback-float ${isCorrect ? 'correct-fb' : 'wrong-fb'}`;
  el.textContent = isCorrect ? '✓ Correct!' : '✗ Wrong!';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

/* ── Confetti ─────────────────────────────────────────── */
export function launchConfetti(count = 80) {
  const colors = ['#FFB7D5','#A78BFA','#60A5FA','#34D399','#FBB040','#FF8FAB'];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    const color = colors[Math.floor(Math.random() * colors.length)];
    el.style.cssText = `
      left: ${Math.random() * 100}vw;
      top: ${Math.random() * 25}vh;
      background: ${color};
      --duration: ${1.2 + Math.random() * 1.6}s;
      --drop: ${400 + Math.random() * 400}px;
      --spin: ${Math.random() > 0.5 ? '' : '-'}${180 + Math.random() * 360}deg;
      width: ${6 + Math.random() * 8}px;
      height: ${6 + Math.random() * 8}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation-delay: ${Math.random() * 0.4}s;
    `;
    document.body.appendChild(el);
    const dur = parseFloat(el.style.getPropertyValue('--duration') || '2') * 1000 + 500;
    setTimeout(() => el.remove(), dur + 600);
  }
}

/* ── Results ──────────────────────────────────────────── */
export function renderResults(scorePct, score, total, answers, questions, timeTaken, label) {
  const ring = document.getElementById('score-ring-fill');
  const circumference = 2 * Math.PI * 54;
  if (ring) {
    ring.style.strokeDasharray  = circumference;
    ring.style.strokeDashoffset = circumference;
    requestAnimationFrame(() => {
      ring.style.strokeDashoffset = circumference - (circumference * scorePct) / 100;
    });
  }

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('score-pct', `${scorePct}%`);
  set('results-title', `${label.emoji} ${label.text}`);
  set('results-subtitle', label.sub);
  set('stat-correct', score);
  set('stat-wrong', total - score);
  set('stat-time', `${timeTaken}s`);

  const breakdownEl = document.getElementById('breakdown-list');
  if (breakdownEl) {
    breakdownEl.innerHTML = answers.map((ans, i) => {
      const q = questions[ans.questionIndex];
      const cls = ans.isCorrect ? 'correct' : 'wrong';
      const icon = ans.isCorrect ? '✓' : '✗';
      const yourAnswer = q?.options?.[ans.selectedIndex] ?? '—';
      const correctAnswer = q?.options?.[q.correctIndex] ?? '—';
      return `
        <div class="breakdown-item">
          <div class="breakdown-icon ${cls}">${icon}</div>
          <div>
            <div class="breakdown-q">${i + 1}. ${q?.question ?? ''}</div>
            ${ans.isCorrect
              ? `<div class="breakdown-answer correct">✓ ${correctAnswer}</div>`
              : `<div class="breakdown-answer wrong">Your: ${yourAnswer} · Correct: ${correctAnswer}</div>`
            }
          </div>
        </div>
      `;
    }).join('');
  }
}
