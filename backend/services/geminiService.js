const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate quiz questions using Gemini API
 * @param {string} topic - Quiz topic
 * @param {string} difficulty - easy | medium | hard
 * @param {number} count - Number of questions
 * @returns {Promise<Array>} Array of question objects
 */
async function generateQuestions(topic, difficulty, count) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `You are a quiz master. Generate ${count} multiple-choice quiz questions about "${topic}" at ${difficulty} difficulty level.

Return ONLY a valid JSON array (no markdown, no explanation) with this exact structure:
[
  {
    "id": 1,
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Brief explanation why the answer is correct.",
    "difficulty": "${difficulty}"
  }
]

Rules:
- correctIndex is the 0-based index of the correct option in the options array
- Make options plausible and relevant — avoid obvious wrong answers
- For ${difficulty} difficulty: ${getDifficultyHint(difficulty)}
- Keep questions clear and unambiguous
- Explanation should be 1-2 sentences max
- Return ONLY the JSON array, nothing else`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Strip markdown code blocks if present
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const questions = JSON.parse(cleaned);

  if (!Array.isArray(questions)) {
    throw new Error('Gemini did not return an array of questions');
  }

  return questions.map((q, i) => ({
    id: i + 1,
    question: q.question,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    difficulty: q.difficulty || difficulty,
  }));
}

/**
 * Validate a single answer and get explanation
 */
async function validateAnswer(question, selectedIndex) {
  const isCorrect = selectedIndex === question.correctIndex;
  return {
    isCorrect,
    correctIndex: question.correctIndex,
    explanation: question.explanation,
  };
}

function getDifficultyHint(difficulty) {
  switch (difficulty) {
    case 'easy':
      return 'use basic, well-known facts that beginners would know';
    case 'medium':
      return 'use intermediate concepts requiring some prior knowledge';
    case 'hard':
      return 'use advanced, nuanced concepts for experts';
    default:
      return 'use appropriate difficulty';
  }
}

module.exports = { generateQuestions, validateAnswer };
