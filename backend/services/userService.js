const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

function ensureFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
  if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '[]');
}

function getUsers() {
  ensureFiles();
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUsers(users) {
  ensureFiles();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function findUserByUsername(username) {
  return getUsers().find(u => u.username.toLowerCase() === username.toLowerCase());
}

function findUserById(id) {
  return getUsers().find(u => u.id === id);
}

function createUser(username, passwordHash) {
  const users = getUsers();
  const user = {
    id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    username,
    passwordHash,
    createdAt: new Date().toISOString(),
    stats: { totalQuizzes: 0, totalCorrect: 0, totalQuestions: 0, streak: 0, lastQuizDate: null },
  };
  users.push(user);
  saveUsers(users);
  return user;
}

function getHistory() {
  ensureFiles();
  return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
}

function saveHistory(history) {
  ensureFiles();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function getUserHistory(userId) {
  return getHistory().filter(h => h.userId === userId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function saveQuizResult(userId, quizData) {
  const history = getHistory();
  const entry = { id: `q_${Date.now()}`, userId, ...quizData, timestamp: new Date().toISOString() };
  history.push(entry);
  saveHistory(history);

  // Update user stats
  const users = getUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx !== -1) {
    const s = users[idx].stats;
    s.totalQuizzes += 1;
    s.totalCorrect += quizData.score;
    s.totalQuestions += quizData.total;

    const today = new Date().toDateString();
    const lastDate = s.lastQuizDate ? new Date(s.lastQuizDate).toDateString() : null;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (lastDate === today) { /* same day, no streak change */ }
    else if (lastDate === yesterday) { s.streak += 1; }
    else { s.streak = 1; }
    s.lastQuizDate = new Date().toISOString();
    saveUsers(users);
  }
  return entry;
}

function getDashboardStats(userId) {
  const user = findUserById(userId);
  if (!user) return null;
  const history = getUserHistory(userId);
  const recentScores = history.slice(0, 10).map(h => ({ topic: h.topic, pct: Math.round((h.score / h.total) * 100), timestamp: h.timestamp, difficultyEnd: h.difficultyEnd || 10 })).reverse();

  // Best topic
  const topicMap = {};
  history.forEach(h => {
    if (!topicMap[h.topic]) topicMap[h.topic] = { count: 0, totalPct: 0 };
    topicMap[h.topic].count++;
    topicMap[h.topic].totalPct += Math.round((h.score / h.total) * 100);
  });
  let bestTopic = '—';
  let bestAvg = 0;
  Object.entries(topicMap).forEach(([t, v]) => {
    const avg = v.totalPct / v.count;
    if (avg > bestAvg) { bestAvg = avg; bestTopic = t; }
  });

  const avgScore = user.stats.totalQuestions > 0
    ? Math.round((user.stats.totalCorrect / user.stats.totalQuestions) * 100)
    : 0;

  return {
    username: user.username,
    totalQuizzes: user.stats.totalQuizzes,
    avgScore,
    bestTopic,
    streak: user.stats.streak,
    recentScores,
    recentHistory: history.slice(0, 8),
  };
}

module.exports = { findUserByUsername, findUserById, createUser, saveQuizResult, getDashboardStats };
