const express = require('express');
const router = express.Router();
const { generate, validate } = require('../controllers/quizController');

// POST /api/quiz/generate
router.post('/generate', generate);

// POST /api/quiz/validate
router.post('/validate', validate);

module.exports = router;
