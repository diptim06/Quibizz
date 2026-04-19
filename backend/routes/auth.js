const express = require('express');
const router = express.Router();
const { register, login, profile, saveResult, leaderboard } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

router.post('/signup', register);
router.post('/login', login);
router.get('/profile', verifyToken, profile);
router.post('/result', verifyToken, saveResult);
router.get('/leaderboard', leaderboard);

module.exports = router;
