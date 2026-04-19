const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { findUserByUsername, createUser, getDashboardStats, saveQuizResult } = require('../services/userService');
const { JWT_SECRET } = require('../middleware/auth');

async function register(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
    if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters.' });
    if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters.' });

    const existing = findUserByUsername(username);
    if (existing) return res.status(409).json({ error: 'Username already taken. Choose another.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = createUser(username, passwordHash);

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    return res.status(201).json({ success: true, token, username: user.username });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
}

async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });

    const user = findUserByUsername(username);
    if (!user) return res.status(401).json({ error: 'Invalid username or password.' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid username or password.' });

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ success: true, token, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
}

module.exports = { register, login };

/* GET /api/auth/profile  (protected) */
function profile(req, res) {
  const stats = getDashboardStats(req.userId);
  if (!stats) return res.status(404).json({ error: 'User not found.' });
  return res.json(stats);
}

/* POST /api/auth/result  (protected) */
function saveResult(req, res) {
  try {
    const { topic, difficulty, score, total } = req.body;
    if (!topic || score == null || !total)
      return res.status(400).json({ error: 'topic, score, and total are required.' });
    const entry = saveQuizResult(req.userId, { topic, difficulty, score, total });
    return res.json({ success: true, entry });
  } catch (err) {
    return res.status(500).json({ error: 'Could not save result.' });
  }
}

/* GET /api/auth/leaderboard */
function leaderboard(req, res) {
  try {
    const usersFile = path.join(__dirname, '../data/users.json');
    if (!fs.existsSync(usersFile)) return res.json({ leaderboard: [] });
    const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    const board = users
      .map(u => ({
        username: u.username,
        totalQuizzes: u.stats.totalQuizzes,
        accuracy: u.stats.totalQuestions > 0
          ? Math.round((u.stats.totalCorrect / u.stats.totalQuestions) * 100)
          : 0,
        streak: u.stats.streak,
      }))
      .sort((a, b) => b.accuracy - a.accuracy || b.totalQuizzes - a.totalQuizzes);
    return res.json({ leaderboard: board });
  } catch (err) {
    return res.status(500).json({ error: 'Could not fetch leaderboard.' });
  }
}

module.exports = { register, login, profile, saveResult, leaderboard };
