/* ═══════════════════════════════════════════════════════
   Quibizz — UI Helpers
   Pure DOM manipulation — no state logic here
   ═══════════════════════════════════════════════════════ */

/* ── Screen transitions ────────────────────────────────── */
export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) {
    target.classList.add('active');
  }
}

/* ── Toast notifications ───────────────────────────────── */
let toastTimer = null;
export function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

/* ── Progress bar ──────────────────────────────────────── */
export function setProgress(current, total) {
  const fill = document.getElementById('progress-fill');
  if (fill) fill.style.width = `${Math.round((current / total) * 100)}%`;
}

/* ── Question counter ──────────────────────────────────── */
export function setCounter(current, total) {
  const el = document.getElementById('question-counter');
  if (el) el.textContent = `Question ${current} of ${total}`;
}

/* ── Score display ─────────────────────────────────────── */
export function setScore(score, total) {
  const el = document.getElementById('score-display');
  if (el) {
    el.textContent = `⭐ ${score}/${total}`;
    el.classList.remove('streak');
    void el.offsetWidth; // force reflow for animation
    el.classList.add('streak');
  }
}

/* ── Render a question ─────────────────────────────────── */
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function renderQuestion(question) {
  const qText = document.getElementById('question-text');
  if (qText) qText.textContent = question.question;

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

  // Hide explanation + next btn
  const expBox = document.getElementById('explanation-box');
  if (expBox)  { expBox.classList.remove('visible'); expBox.textContent = ''; }

  const nextBtn = document.getElementById('btn-next');
  if (nextBtn) nextBtn.classList.remove('visible');

  // Reset duck reaction
  setDuckReaction('neutral');
}

/* ── Show answer feedback ──────────────────────────────── */
export function showAnswerFeedback(selectedIndex, correctIndex, explanation, isCorrect) {
  const opts = document.querySelectorAll('.option-btn');

  opts.forEach(btn => {
    btn.disabled = true;
    const idx = parseInt(btn.getAttribute('data-index'));
    if (idx === correctIndex) btn.classList.add('correct');
    else if (idx === selectedIndex && !isCorrect) btn.classList.add('wrong');
  });

  // Explanation
  const expBox = document.getElementById('explanation-box');
  if (expBox) {
    expBox.innerHTML = `<span class="exp-label">💡 Explanation</span>${explanation}`;
    expBox.classList.add('visible');
  }

  // Next btn
  const nextBtn = document.getElementById('btn-next');
  if (nextBtn) nextBtn.classList.add('visible');

  // Duck reaction
  setDuckReaction(isCorrect ? 'happy' : 'sad');

  // Floating feedback
  showFloatingFeedback(isCorrect);
}

/* ── Duck reactions ────────────────────────────────────── */
export function setDuckReaction(mood) {
  const wrap = document.getElementById('duck-reaction');
  if (!wrap) return;
  wrap.className = `duck-reaction ${mood !== 'neutral' ? mood : ''}`;

  const img = wrap.querySelector('img');
  if (!img) return;

  img.style.animation = 'none';
  void img.offsetWidth;

  if (mood === 'happy') img.style.animation = 'duckHappy 0.6s ease forwards';
  else if (mood === 'sad') img.style.animation = 'duckSad 0.6s ease forwards';
  else img.style.animation = 'duckWaddle 3s ease-in-out infinite';
}

/* ── Floating feedback badge ───────────────────────────── */
export function showFloatingFeedback(isCorrect) {
  const existing = document.querySelector('.feedback-float');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = `feedback-float ${isCorrect ? 'correct-fb' : 'wrong-fb'} show`;
  el.textContent = isCorrect ? '✓ Correct!' : '✗ Wrong';
  document.body.appendChild(el);

  setTimeout(() => el.remove(), 1400);
}

/* ── Confetti ──────────────────────────────────────────── */
export function launchConfetti(count = 80) {
  const colors = ['#FFD93D', '#FF922B', '#A78BFA', '#22C55E', '#38BDF8', '#FB7185'];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    const color = colors[Math.floor(Math.random() * colors.length)];
    el.style.cssText = `
      left: ${Math.random() * 100}vw;
      top: ${Math.random() * 30}vh;
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
    setTimeout(() => el.remove(), dur + 500);
  }
}

/* ── Results screen ────────────────────────────────────── */
export function renderResults(scorePct, score, total, answers, questions, timeTaken, label) {
  // Score ring
  const ring = document.getElementById('score-ring-fill');
  const circumference = 2 * Math.PI * 54; // r=54
  if (ring) {
    ring.style.strokeDasharray = circumference;
    ring.style.strokeDashoffset = circumference;
    requestAnimationFrame(() => {
      ring.style.strokeDashoffset = circumference - (circumference * scorePct) / 100;
    });
  }

  const pctEl = document.getElementById('score-pct');
  if (pctEl) pctEl.textContent = `${scorePct}%`;

  const titleEl = document.getElementById('results-title');
  if (titleEl) titleEl.textContent = `${label.emoji} ${label.text}`;

  const subEl = document.getElementById('results-subtitle');
  if (subEl) subEl.textContent = label.sub;

  // Stats
  const correctEl  = document.getElementById('stat-correct');
  const wrongEl    = document.getElementById('stat-wrong');
  const timeEl     = document.getElementById('stat-time');
  if (correctEl) correctEl.textContent = score;
  if (wrongEl)   wrongEl.textContent   = total - score;
  if (timeEl)    timeEl.textContent    = `${timeTaken}s`;

  // Breakdown
  const breakdownEl = document.getElementById('breakdown-list');
  if (breakdownEl) {
    breakdownEl.innerHTML = answers.map((ans, i) => {
      const q = questions[ans.questionIndex];
      const cls = ans.isCorrect ? 'correct' : 'wrong';
      const icon = ans.isCorrect ? '✓' : '✗';
      const yourAnswer = q.options[ans.selectedIndex] ?? '—';
      const correctAnswer = q.options[q.correctIndex];
      return `
        <div class="breakdown-item">
          <div class="breakdown-icon ${cls}">${icon}</div>
          <div>
            <div class="breakdown-q">${i + 1}. ${q.question}</div>
            ${ans.isCorrect
              ? `<div class="breakdown-answer correct">✓ ${correctAnswer}</div>`
              : `<div class="breakdown-answer wrong">Your answer: ${yourAnswer} &nbsp;|&nbsp; Correct: ${correctAnswer}</div>`
            }
          </div>
        </div>
      `;
    }).join('');
  }
}
