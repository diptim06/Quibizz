const { generateQuestions, validateAnswer } = require('../services/geminiService');

/**
 * POST /api/quiz/generate
 * Body: { topic, difficulty, count }
 */
async function generate(req, res) {
  try {
    const { topic, difficulty = 'medium', count = 5 } = req.body;

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return res.status(400).json({ error: 'topic is required and must be a non-empty string' });
    }

    const safeCount = Math.min(Math.max(parseInt(count, 10) || 5, 1), 20);
    const safeDifficulty = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';

    console.log(`Generating ${safeCount} ${safeDifficulty} questions about: ${topic}`);

    const questions = await generateQuestions(topic.trim(), safeDifficulty, safeCount);

    return res.json({
      success: true,
      topic: topic.trim(),
      difficulty: safeDifficulty,
      count: questions.length,
      questions,
    });
  } catch (err) {
    console.error('Error generating questions:', err.message);
    if (err.message?.includes('API_KEY') || err.message?.includes('api key')) {
      return res.status(500).json({ error: 'Invalid or missing Gemini API key. Check your .env file.' });
    }
    return res.status(500).json({ error: 'Failed to generate questions. Please try again.', detail: err.message });
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

    const result = await validateAnswer(question, selectedIndex);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error validating answer:', err.message);
    return res.status(500).json({ error: 'Failed to validate answer.' });
  }
}

module.exports = { generate, validate };
