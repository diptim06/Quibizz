/* ══════════════════════════════════════════════════════════
   Quibizz — Chatbot Module (Quibby the AI Assistant)
   Self-contained: injects its own DOM, handles all state.
   ══════════════════════════════════════════════════════ */

const API_URL = '/api/chat';

// Conversation history (role: 'user' | 'assistant')
let history = [];
let isOpen  = false;
let isTyping = false;

/* ── Suggested quick prompts ────────────────────────────── */
const SUGGESTIONS = [
  "How does adaptive difficulty work?",
  "What is Savage Mode?",
  "Explain black holes simply",
  "How do I improve my quiz score?",
  "Tell me a fun science fact",
  "What topics can I quiz on?",
];

/* ── Inject HTML ────────────────────────────────────────── */
function injectChatbot() {
  const shell = document.createElement('div');
  shell.id = 'chatbot-shell';
  shell.innerHTML = `
    <!-- Floating toggle button -->
    <button class="chat-fab" id="chat-fab" aria-label="Open Quibby chatbot" title="Ask Quibby">
      <span class="chat-fab-icon" id="chat-fab-icon">🦆</span>
      <span class="chat-fab-pulse"></span>
    </button>

    <!-- Chat panel -->
    <div class="chat-panel" id="chat-panel" aria-hidden="true">
      <!-- Header -->
      <div class="chat-header">
        <div class="chat-header-info">
          <div class="chat-avatar">🦆</div>
          <div>
            <div class="chat-name">Quibby</div>
            <div class="chat-status" id="chat-status">AI Assistant · Online</div>
          </div>
        </div>
        <div class="chat-header-actions">
          <button class="chat-header-btn" id="chat-clear" title="Clear chat">🗑️</button>
          <button class="chat-header-btn" id="chat-close" aria-label="Close chat">✕</button>
        </div>
      </div>

      <!-- Messages -->
      <div class="chat-messages" id="chat-messages">
        <div class="chat-welcome">
          <div class="chat-welcome-duck">🦆</div>
          <p class="chat-welcome-text">Hey! I'm <strong>Quibby</strong> — your AI study buddy.<br>Ask me anything about any topic, or how to use Quibizz!</p>
          <div class="chat-suggestions" id="chat-suggestions">
            ${SUGGESTIONS.map(s => `<button class="chat-suggestion">${s}</button>`).join('')}
          </div>
        </div>
      </div>

      <!-- Input -->
      <div class="chat-input-wrap">
        <textarea
          class="chat-input"
          id="chat-input"
          placeholder="Ask Quibby anything…"
          rows="1"
          maxlength="2000"
          aria-label="Chat message input"
        ></textarea>
        <button class="chat-send" id="chat-send" aria-label="Send message">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(shell);
}

/* ── Markdown → safe HTML (minimal parser) ──────────────── */
function parseMarkdown(text) {
  return text
    // code blocks
    .replace(/```([\w]*)\n?([\s\S]*?)```/g, (_, _lang, code) =>
      `<pre class="chat-code-block"><code>${escHtml(code.trim())}</code></pre>`)
    // inline code
    .replace(/`([^`]+)`/g, (_, c) => `<code class="chat-inline-code">${escHtml(c)}</code>`)
    // bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // bullet points
    .replace(/^[\-\*] (.+)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    // newlines
    .replace(/\n/g, '<br>');
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ── Typewriter effect ───────────────────────────────────── */
function typewriterAppend(el, html, speed = 8) {
  // We render the full HTML but animate character reveal via clip
  el.innerHTML = html;
  el.style.opacity = '0';
  // Simple fade-in for HTML content (true char-level typewriter breaks HTML tags)
  requestAnimationFrame(() => {
    el.style.transition = 'opacity 0.3s ease';
    el.style.opacity = '1';
  });
}

/* ── Render a message bubble ────────────────────────────── */
function appendMessage(role, content, isLoading = false) {
  const messages = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `chat-msg chat-msg-${role}${isLoading ? ' chat-msg-loading' : ''}`;

  if (role === 'assistant') {
    div.innerHTML = `
      <div class="chat-msg-avatar">🦆</div>
      <div class="chat-msg-bubble">
        <div class="chat-msg-content" ${isLoading ? '' : ''}>${
          isLoading
            ? `<div class="chat-typing-dots"><span></span><span></span><span></span></div>`
            : parseMarkdown(content)
        }</div>
      </div>`;
  } else {
    div.innerHTML = `
      <div class="chat-msg-bubble chat-msg-bubble-user">
        <div class="chat-msg-content">${escHtml(content)}</div>
      </div>`;
  }

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

/* ── Send a message ─────────────────────────────────────── */
async function sendMessage(text) {
  if (isTyping || !text.trim()) return;
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const status = document.getElementById('chat-status');

  // Hide suggestions after first message
  const suggestions = document.getElementById('chat-suggestions');
  if (suggestions) suggestions.style.display = 'none';

  // Snapshot existing history BEFORE adding current message
  // (backend receives current message via 'message' field separately —
  //  sending it again inside history causes two consecutive user turns
  //  which breaks Gemini's alternating role requirement)
  const historySnapshot = [...history];

  // Render user bubble & update local history
  appendMessage('user', text);
  history.push({ role: 'user', content: text });

  // Reset input
  input.value = '';
  input.style.height = 'auto';

  // Show typing indicator
  isTyping = true;
  sendBtn.disabled = true;
  status.textContent = 'Quibby is thinking…';
  const loadingEl = appendMessage('assistant', '', true);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Send only PREVIOUS turns in history, not the current one
      body: JSON.stringify({ message: text, history: historySnapshot.slice(-10) }),
    });

    const data = await res.json();
    const reply = data.reply || 'Hmm, I had trouble answering that. Try again!';

    // Replace loading bubble with actual reply
    const contentEl = loadingEl.querySelector('.chat-msg-content');
    loadingEl.classList.remove('chat-msg-loading');
    const offlineBadge = data.offline
      ? `<div class="chat-offline-badge">📡 Offline mode — Gemini quota reached</div>`
      : '';
    contentEl.innerHTML = parseMarkdown(reply) + offlineBadge;
    contentEl.style.opacity = '0';
    requestAnimationFrame(() => { contentEl.style.transition = 'opacity 0.3s'; contentEl.style.opacity = '1'; });

    history.push({ role: 'assistant', content: reply });
  } catch (err) {
    const contentEl = loadingEl.querySelector('.chat-msg-content');
    loadingEl.classList.remove('chat-msg-loading');
    contentEl.innerHTML = "⚠️ Couldn't reach my brain right now. Check your connection!";
  } finally {
    isTyping = false;
    sendBtn.disabled = false;
    status.textContent = 'AI Assistant · Online';
    document.getElementById('chat-messages').scrollTop = 9999;
  }
}

/* ── Toggle panel open/closed ───────────────────────────── */
function toggleChat(forceOpen) {
  const panel  = document.getElementById('chat-panel');
  const fabIcon = document.getElementById('chat-fab-icon');
  isOpen = forceOpen !== undefined ? forceOpen : !isOpen;
  panel.classList.toggle('chat-panel-open', isOpen);
  panel.setAttribute('aria-hidden', String(!isOpen));
  fabIcon.textContent = isOpen ? '✕' : '🦆';
  if (isOpen) setTimeout(() => document.getElementById('chat-input')?.focus(), 200);
}

/* ── Clear chat ─────────────────────────────────────────── */
function clearChat() {
  history = [];
  const messages = document.getElementById('chat-messages');
  messages.innerHTML = `
    <div class="chat-welcome">
      <div class="chat-welcome-duck">🦆</div>
      <p class="chat-welcome-text">Hey! I'm <strong>Quibby</strong> — your AI study buddy.<br>Ask me anything about any topic, or how to use Quibizz!</p>
      <div class="chat-suggestions" id="chat-suggestions">
        ${SUGGESTIONS.map(s => `<button class="chat-suggestion">${s}</button>`).join('')}
      </div>
    </div>`;
  bindSuggestions();
}

/* ── Bind suggestion chips ──────────────────────────────── */
function bindSuggestions() {
  document.querySelectorAll('.chat-suggestion').forEach(btn => {
    btn.addEventListener('click', () => sendMessage(btn.textContent));
  });
}

/* ── Auto-resize textarea ───────────────────────────────── */
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

/* ── Init ───────────────────────────────────────────────── */
export function initChatbot() {
  injectChatbot();

  const fab     = document.getElementById('chat-fab');
  const closeBtn = document.getElementById('chat-close');
  const clearBtn = document.getElementById('chat-clear');
  const sendBtn  = document.getElementById('chat-send');
  const input    = document.getElementById('chat-input');

  fab.addEventListener('click',   () => toggleChat());
  closeBtn.addEventListener('click', () => toggleChat(false));
  clearBtn.addEventListener('click', clearChat);

  sendBtn.addEventListener('click', () => sendMessage(input.value));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input.value);
    }
  });

  input.addEventListener('input', () => autoResize(input));

  bindSuggestions();

  // Sidebar chat button (added separately in HTML)
  document.getElementById('nav-chat')?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleChat(true);
  });
}

/* ── Export toggle so other modules can open the chat ───── */
export { toggleChat };
