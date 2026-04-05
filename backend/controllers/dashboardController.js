const { getDashboardStats, saveQuizResult } = require('../services/userService');

async function getDashboard(req, res) {
  try {
    const stats = getDashboardStats(req.userId);
    if (!stats) return res.status(404).json({ error: 'User not found.' });
    return res.json({ success: true, ...stats });
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ error: 'Failed to load dashboard.' });
  }
}

async function saveQuiz(req, res) {
  try {
    const { topic, score, total, difficultyStart, difficultyEnd, difficultyJourney, timeTaken, answers } = req.body;
    if (!topic || score === undefined || !total) {
      return res.status(400).json({ error: 'topic, score, total are required.' });
    }
    const entry = saveQuizResult(req.userId, {
      topic, score, total, difficultyStart, difficultyEnd, difficultyJourney, timeTaken, answers,
    });
    return res.json({ success: true, entry });
  } catch (err) {
    console.error('Save quiz error:', err);
    return res.status(500).json({ error: 'Failed to save quiz.' });
  }
}

module.exports = { getDashboard, saveQuiz };
