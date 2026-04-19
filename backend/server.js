require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const quizRoutes   = require('./routes/quiz');
const healthRoutes = require('./routes/health');
const authRoutes   = require('./routes/auth');
const chatRoutes   = require('./routes/chat');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────────────
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || '*',
    methods: ['GET', 'POST'],
  })
);

// Rate limiter: max 30 quiz generation requests per 15 min per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many requests. Please wait a bit before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/quiz/generate', limiter);

// ── Routes ─────────────────────────────────────────────────
app.use('/api/health', healthRoutes);
app.use('/api/auth',   authRoutes);
app.use('/api/quiz',   quizRoutes);
app.use('/api/chat',   chatRoutes);

// ── API 404 handler ─────────────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Serve Frontend Static Files ──────────────────────────────
const FRONTEND = path.join(__dirname, '../frontend');
app.use(express.static(FRONTEND));

// SPA fallback — always serve index.html for non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🦆 Quibizz backend running at http://localhost:${PORT}`);
  console.log(`   🌐 Open the app at:  http://localhost:${PORT}`);
  console.log(`   Health check:       http://localhost:${PORT}/api/health`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('\n⚠️  WARNING: GEMINI_API_KEY is not set in .env file!');
    console.warn('   Copy backend/.env.example to backend/.env and add your key.\n');
  } else {
    console.log('   ✅ Gemini API key detected\n');
  }
});

module.exports = app;
