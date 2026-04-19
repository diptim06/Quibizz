/* ══════════════════════════════════════════════════════════════
   Quibizz — Quiz Controller
   POST /api/quiz/generate  — generates an adaptive batch
   POST /api/quiz/validate  — validates a single answer locally
   ══════════════════════════════════════════════════════════ */

const { generateAdaptiveBatch, validateAnswer } = require('../services/geminiService');

const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];

/**
 * POST /api/quiz/generate
 * Body: { topic, difficulty, count, isCorrect }
 *
 * isCorrect (optional) — overall result of user's PREVIOUS quiz:
 *   true  → they did well, make it harder
 *   false → they struggled, make it easier
 *   null  → first quiz, use stated difficulty as-is
 */
async function generate(req, res) {
  try {
    // ── Input validation & sanitisation ──────────────────────
    const rawTopic      = req.body.topic;
    const rawDifficulty = req.body.difficulty;
    const rawCount      = req.body.count;
    const rawIsCorrect  = req.body.isCorrect;

    // topic is required
    if (!rawTopic || typeof rawTopic !== 'string' || rawTopic.trim().length === 0) {
      return res.status(400).json({ error: 'topic is required and must be a non-empty string' });
    }

    const topic      = rawTopic.trim().slice(0, 100); // max 100 chars
    const difficulty = VALID_DIFFICULTIES.includes(rawDifficulty) ? rawDifficulty : 'medium';
    const count      = Math.min(Math.max(parseInt(rawCount, 10) || 5, 1), 60);
    const isCorrect  = rawIsCorrect === true ? true : rawIsCorrect === false ? false : null;

    console.log(`[generate] "${topic}" | diff=${difficulty} | count=${count} | prevCorrect=${isCorrect}`);

    // ── Generate (cache → Gemini → fallback) ─────────────────
    const questions = await generateAdaptiveBatch(topic, count, difficulty, isCorrect);

    // Detect if dynamic (generic) fallback was used — questions reference the topic
    // by name but aren't truly topic-specific trivia
    const isDynamic = questions.length > 0 &&
      questions[0].question?.startsWith('Which of the following is most closely associated with');

    return res.json({
      success:   true,
      topic,
      difficulty,
      count:     questions.length,
      questions,
      offline:   isDynamic, // hint to frontend to show a notice
    });

  } catch (err) {
    // This should never be reached — generateAdaptiveBatch never throws.
    // Kept as a last-resort safety net.
    console.error('[generate] Unexpected error:', err.message);
    return res.status(500).json({
      error:  'An unexpected error occurred. Please try again.',
      detail: err.message,
    });
  }
}

/**
 * POST /api/quiz/validate
 * Body: { question, selectedIndex }
 */
async function validate(req, res) {
  try {
    const { question, selectedIndex } = req.body;

    if (!question || typeof selectedIndex !== 'number') {
      return res.status(400).json({ error: 'question object and selectedIndex (number) are required' });
    }

    const result = validateAnswer(question, selectedIndex);
    return res.json({ success: true, ...result });

  } catch (err) {
    console.error('[validate] Error:', err.message);
    return res.status(500).json({ error: 'Failed to validate answer.' });
  }
}

module.exports = { generate, validate };
