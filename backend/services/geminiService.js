/* ══════════════════════════════════════════════════════════════
   Quibizz — Gemini Service
   Handles quiz generation with:
     1. Retry logic (exponential backoff on 429)
     2. In-memory cache (10-min TTL, keyed by topic+difficulty)
     3. Local fallback generator (never returns an error)
   ══════════════════════════════════════════════════════════ */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ── Constants ─────────────────────────────────────────────────
const CACHE_TTL_MS   = 10 * 60 * 1000;   // 10 minutes
const MAX_RETRIES    = 3;
const RETRY_DELAYS   = [2000, 5000, 10000]; // exponential backoff (ms)
const LETTER_TO_IDX  = { A: 0, B: 1, C: 2, D: 3 };

// ── Cache ─────────────────────────────────────────────────────
/** @type {Map<string, { questions: Array, expiresAt: number }>} */
const quizCache = new Map();

function getCacheKey(topic, difficulty) {
  return `${topic.toLowerCase().trim()}::${difficulty}`;
}

/**
 * Return cached questions if still valid, otherwise null.
 */
function getCachedQuiz(topic, difficulty) {
  const key   = getCacheKey(topic, difficulty);
  const entry = quizCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    quizCache.delete(key);
    return null;
  }
  console.log(`[cache] HIT  — "${topic}" (${difficulty})`);
  return entry.questions;
}

/**
 * Store questions in the cache.
 */
function setCachedQuiz(topic, difficulty, questions) {
  const key = getCacheKey(topic, difficulty);
  quizCache.set(key, { questions, expiresAt: Date.now() + CACHE_TTL_MS });
  console.log(`[cache] SET  — "${topic}" (${difficulty}) — expires in 10 min`);
}

// ── JSON helpers ──────────────────────────────────────────────
function cleanJSON(text) {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

function normalizeQuestion(q, fallbackDiff) {
  const options      = ['A', 'B', 'C', 'D'].map(l => (q.options?.[l] ?? ''));
  const correctIndex = LETTER_TO_IDX[(q.answer ?? 'A').toUpperCase()] ?? 0;
  return {
    question:    q.question    || '',
    options,
    correctIndex,
    explanation: q.explanation || '',
    difficulty:  q.difficulty  || fallbackDiff,
  };
}

// ── Gemini API call (single attempt) ─────────────────────────
async function callGemini(topic, count, difficulty, isCorrect) {
  const model      = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const prevResult = isCorrect === null ? 'None' : isCorrect ? 'Correct' : 'Incorrect';

  const prompt = `You are an intelligent adaptive quiz engine.

TASK:
Generate a pool of multiple choice questions for a per-question adaptive quiz.

INPUT:
- Topic: ${topic}
- Total Questions Needed: ${count}
- Starting Difficulty: ${difficulty} (easy, medium, hard)
- Previous Session Result: ${prevResult}

DIFFICULTY DISTRIBUTION (IMPORTANT):
Since this is used for PER-QUESTION adaptive difficulty, spread the questions across difficulties:
- ~1/3 easy questions
- ~1/3 medium questions
- ~1/3 hard questions
This ensures there are always questions available at any difficulty level during the quiz.

QUESTION RULES:
- Generate EXACTLY ${count} questions
- Questions must be unique (no repetition or rephrasing)
- Maintain strict topic relevance
- Tag each question with its actual difficulty level

FORMAT REQUIREMENTS — Each question must include:
  - "question": string
  - "difficulty": "easy" | "medium" | "hard"
  - "options": { A, B, C, D }
  - "answer": "A/B/C/D"
  - "explanation": short 1-sentence explanation of the correct answer

STRICT OUTPUT (JSON ONLY, NO EXTRA TEXT):
{
  "quiz": [
    {
      "question": "string",
      "difficulty": "easy/medium/hard",
      "options": { "A": "text", "B": "text", "C": "text", "D": "text" },
      "answer": "A/B/C/D",
      "explanation": "string"
    }
  ]
}

FAIL-SAFE: If requirements are not met, return: { "quiz": [] }`;

  const result = await model.generateContent(prompt);
  const text   = result.response.text();
  const parsed = JSON.parse(cleanJSON(text));

  if (!Array.isArray(parsed.quiz) || parsed.quiz.length === 0) {
    throw new Error('Gemini returned an empty or invalid quiz array.');
  }

  return parsed.quiz.map(q => normalizeQuestion(q, difficulty));
}

// ── Gemini with retry (exponential backoff) ───────────────────
/**
 * Attempt Gemini up to MAX_RETRIES times.
 * On 429 / quota errors, wait then retry.
 * Returns null if all retries fail (caller must use fallback).
 */
async function generateWithGemini(topic, count, difficulty, isCorrect) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const questions = await callGemini(topic, count, difficulty, isCorrect);
      console.log(`[gemini] ✅ Success — "${topic}" (attempt ${attempt + 1})`);
      return questions;
    } catch (err) {
      const is429 = err.message?.includes('429') || err.message?.includes('quota');

      if (attempt < MAX_RETRIES && is429) {
        const delay = RETRY_DELAYS[attempt];
        console.warn(`[gemini] ⚠️  Retrying Gemini... (attempt ${attempt + 1}/${MAX_RETRIES}) — waiting ${delay / 1000}s`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      // Non-429 error or out of retries
      console.error(`[gemini] ❌ Failed after ${attempt + 1} attempt(s): ${err.message}`);
      return null; // signal fallback
    }
  }
  return null;
}

// ── Fallback question bank ────────────────────────────────────
/**
 * Massive bank of pre-written questions, keyed by topic keywords.
 * Each entry has questions across easy / medium / hard.
 */
const FALLBACK_BANK = {
  history: [
    // easy
    { question: 'In which year did World War II end?', options: ['1943','1944','1945','1946'], correctIndex: 2, explanation: 'WWII ended in 1945 with the surrender of Germany and Japan.', difficulty: 'easy' },
    { question: 'Who was the first President of the United States?', options: ['John Adams','Thomas Jefferson','George Washington','Benjamin Franklin'], correctIndex: 2, explanation: 'George Washington served as the first U.S. President from 1789 to 1797.', difficulty: 'easy' },
    { question: 'In which city was the Titanic built?', options: ['London','Belfast','Glasgow','Liverpool'], correctIndex: 1, explanation: 'The Titanic was built in Belfast, Northern Ireland, by Harland and Wolff.', difficulty: 'easy' },
    { question: 'Who was known as the "Iron Lady"?', options: ['Queen Elizabeth','Angela Merkel','Margaret Thatcher','Indira Gandhi'], correctIndex: 2, explanation: 'Margaret Thatcher, UK Prime Minister 1979–1990, earned the nickname "Iron Lady".', difficulty: 'easy' },
    { question: 'Which country gifted the Statue of Liberty to the USA?', options: ['UK','Italy','France','Spain'], correctIndex: 2, explanation: 'France gifted the Statue of Liberty to the United States in 1886.', difficulty: 'easy' },
    { question: 'In which year did man first land on the Moon?', options: ['1965','1967','1969','1971'], correctIndex: 2, explanation: 'Neil Armstrong and Buzz Aldrin landed on the Moon on July 20, 1969 (Apollo 11).', difficulty: 'easy' },
    { question: 'What was the name of the first World War?', options: ['The Great War','The Grand War','The Global War','The Kaiser War'], correctIndex: 0, explanation: 'World War I (1914–1918) was originally called "The Great War".', difficulty: 'easy' },
    { question: 'Which wall divided East and West Berlin?', options: ['Iron Curtain','Berlin Wall','Brandenburg Gate','Checkpoint Charlie Wall'], correctIndex: 1, explanation: 'The Berlin Wall divided East and West Berlin from 1961 until it fell in 1989.', difficulty: 'easy' },
    // medium
    { question: 'The French Revolution began in which year?', options: ['1776','1789','1799','1804'], correctIndex: 1, explanation: 'The French Revolution started in 1789 with the storming of the Bastille.', difficulty: 'medium' },
    { question: 'Which empire was ruled by Genghis Khan?', options: ['Ottoman Empire','Roman Empire','Mongol Empire','British Empire'], correctIndex: 2, explanation: 'Genghis Khan founded and ruled the Mongol Empire in the 13th century.', difficulty: 'medium' },
    { question: 'Who was the Egyptian queen who allied with Julius Caesar?', options: ['Nefertiti','Cleopatra','Hatshepsut','Isis'], correctIndex: 1, explanation: 'Cleopatra VII formed political and romantic alliances with Julius Caesar and Mark Antony.', difficulty: 'medium' },
    { question: 'The Renaissance period began in which country?', options: ['France','England','Germany','Italy'], correctIndex: 3, explanation: 'The Renaissance began in Italy in the 14th century before spreading across Europe.', difficulty: 'medium' },
    { question: 'Which ancient civilization built Machu Picchu?', options: ['Aztecs','Maya','Inca','Olmec'], correctIndex: 2, explanation: 'The Inca Empire built Machu Picchu in the 15th century in present-day Peru.', difficulty: 'medium' },
    { question: 'What was the main cause of the Black Death in Europe?', options: ['Virus','Bacteria from fleas on rats','Toxic water','Volcanic ash'], correctIndex: 1, explanation: 'The Black Death (bubonic plague) was caused by Yersinia pestis bacteria spread by fleas on rats.', difficulty: 'medium' },
    { question: 'Which war was fought between the North and South of the United States?', options: ['War of Independence','The Mexican War','The Civil War','The Spanish War'], correctIndex: 2, explanation: 'The American Civil War (1861–1865) was fought between Union (North) and Confederate (South) states.', difficulty: 'medium' },
    { question: 'Who led the Cuban Revolution in 1959?', options: ['Che Guevara','Fulgencio Batista','Fidel Castro','Raúl Castro'], correctIndex: 2, explanation: 'Fidel Castro led the Cuban Revolution, overthrowing Batista and establishing a communist government.', difficulty: 'medium' },
    // hard
    { question: 'The Treaty of Versailles was signed in which year?', options: ['1917','1918','1919','1920'], correctIndex: 2, explanation: 'The Treaty of Versailles was signed on June 28, 1919, formally ending WWI.', difficulty: 'hard' },
    { question: 'Which ancient wonder was located in Alexandria?', options: ['Colossus of Rhodes','Lighthouse of Alexandria','Hanging Gardens','Temple of Artemis'], correctIndex: 1, explanation: 'The Lighthouse of Alexandria was one of the Seven Wonders of the Ancient World.', difficulty: 'hard' },
    { question: 'The Peloponnesian War was fought between which two city-states?', options: ['Athens and Corinth','Sparta and Thebes','Athens and Sparta','Macedonia and Athens'], correctIndex: 2, explanation: 'The Peloponnesian War (431–404 BC) was fought between Athens and Sparta.', difficulty: 'hard' },
    { question: 'Which dynasty built the Great Wall of China?', options: ['Han','Tang','Qin','Ming'], correctIndex: 2, explanation: 'The first major Great Wall was built by Qin Shi Huang of the Qin dynasty around 221 BC.', difficulty: 'hard' },
    { question: 'In what year did the Rwandan Genocide occur?', options: ['1990','1992','1994','1998'], correctIndex: 2, explanation: 'The Rwandan Genocide occurred in 1994 when Hutu extremists massacred Tutsi people.', difficulty: 'hard' },
    { question: 'Who was the last Tsar of Russia?', options: ['Alexander III','Nicholas I','Nicholas II','Alexander II'], correctIndex: 2, explanation: 'Nicholas II was the last Russian Tsar, abdicated in 1917 during the Russian Revolution.', difficulty: 'hard' },
    { question: 'What was the name of the operation for the Allied invasion of Normandy?', options: ['Operation Overlord','Operation Neptune','Operation Torch','Operation Market Garden'], correctIndex: 0, explanation: 'Operation Overlord was the codename for the Allied invasion of Normandy on June 6, 1944.', difficulty: 'hard' },
    { question: 'Which empire was the largest by land area in history?', options: ['British Empire','Roman Empire','Mongol Empire','Ottoman Empire'], correctIndex: 0, explanation: 'The British Empire was the largest empire in history, covering about 24% of Earth\'s land area.', difficulty: 'hard' },
  ],
  space: [
    // easy
    { question: 'Which planet is known as the Red Planet?', options: ['Venus','Jupiter','Mars','Saturn'], correctIndex: 2, explanation: 'Mars appears red due to iron oxide (rust) on its surface.', difficulty: 'easy' },
    { question: 'How many planets are in our solar system?', options: ['7','8','9','10'], correctIndex: 1, explanation: 'There are 8 planets: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune.', difficulty: 'easy' },
    { question: 'What is the closest star to Earth?', options: ['Sirius','Alpha Centauri','Proxima Centauri','Betelgeuse'], correctIndex: 2, explanation: 'Proxima Centauri is the closest star to Earth at about 4.24 light-years away.', difficulty: 'easy' },
    { question: 'In which galaxy do we live?', options: ['Andromeda','Triangulum','Milky Way','Whirlpool'], correctIndex: 2, explanation: 'We live in the Milky Way galaxy, a barred spiral galaxy.', difficulty: 'easy' },
    { question: 'What is the name of Earth\'s natural satellite?', options: ['Titan','Europa','Ganymede','Moon'], correctIndex: 3, explanation: 'Earth has one natural satellite simply called the Moon.', difficulty: 'easy' },
    { question: 'Which planet has rings visible from Earth?', options: ['Jupiter','Saturn','Uranus','Neptune'], correctIndex: 1, explanation: 'Saturn\'s rings are the most prominent and easily visible with a small telescope.', difficulty: 'easy' },
    { question: 'What is a shooting star?', options: ['A dying star','A comet','A meteoroid burning in atmosphere','A satellite'], correctIndex: 2, explanation: 'A "shooting star" is a meteoroid burning up as it enters Earth\'s atmosphere.', difficulty: 'easy' },
    { question: 'Which planet is closest to the Sun?', options: ['Venus','Earth','Mercury','Mars'], correctIndex: 2, explanation: 'Mercury is the closest planet to the Sun in our solar system.', difficulty: 'easy' },
    // medium
    { question: 'What is the largest planet in our solar system?', options: ['Saturn','Neptune','Jupiter','Uranus'], correctIndex: 2, explanation: 'Jupiter is the largest planet, with a mass greater than all other planets combined.', difficulty: 'medium' },
    { question: 'What is the name of the first artificial satellite?', options: ['Apollo 1','Sputnik 1','Vostok 1','Explorer 1'], correctIndex: 1, explanation: 'Sputnik 1, launched by the Soviet Union in 1957, was the first artificial satellite.', difficulty: 'medium' },
    { question: 'Which space telescope was launched in 1990?', options: ['James Webb','Spitzer','Hubble','Chandra'], correctIndex: 2, explanation: 'The Hubble Space Telescope was launched into orbit in April 1990.', difficulty: 'medium' },
    { question: 'What is the Great Red Spot on Jupiter?', options: ['A volcano','A storm','A crater','A lake'], correctIndex: 1, explanation: 'The Great Red Spot is a massive anticyclonic storm that has lasted hundreds of years.', difficulty: 'medium' },
    { question: 'How long does it take sunlight to reach Earth?', options: ['About 1 minute','About 8 minutes','About 1 hour','About 8 hours'], correctIndex: 1, explanation: 'Sunlight takes approximately 8 minutes and 20 seconds to travel from the Sun to Earth.', difficulty: 'medium' },
    { question: 'What is a black hole?', options: ['A star that exploded','A region where gravity traps everything including light','An empty void in space','A type of nebula'], correctIndex: 1, explanation: 'A black hole is a region of spacetime with gravity so strong that nothing — including light — can escape.', difficulty: 'medium' },
    { question: 'Which planet rotates on its side?', options: ['Neptune','Pluto','Uranus','Saturn'], correctIndex: 2, explanation: 'Uranus has an axial tilt of about 98°, effectively rotating on its side.', difficulty: 'medium' },
    { question: 'What is the International Space Station\'s orbital altitude (approx.)?', options: ['200 km','400 km','800 km','2,000 km'], correctIndex: 1, explanation: 'The ISS orbits Earth at approximately 400 km altitude.', difficulty: 'medium' },
    // hard
    { question: 'What is a light-year?', options: ['Speed of light per second','Distance light travels in one year','Time for light to reach the Moon','Brightness of a star'], correctIndex: 1, explanation: 'A light-year is the distance light travels in one year (~9.46 trillion km).', difficulty: 'hard' },
    { question: 'Which mission first landed humans on the Moon?', options: ['Apollo 10','Apollo 11','Apollo 12','Gemini 9'], correctIndex: 1, explanation: 'Apollo 11 landed Neil Armstrong and Buzz Aldrin on the Moon on July 20, 1969.', difficulty: 'hard' },
    { question: 'What is the Chandrasekhar limit?', options: ['Maximum mass of a neutron star','Maximum mass of a white dwarf','Minimum mass to form a black hole','Speed of light in dense matter'], correctIndex: 1, explanation: 'The Chandrasekhar limit (~1.4 solar masses) is the maximum mass a white dwarf star can have.', difficulty: 'hard' },
    { question: 'What causes a pulsar?', options: ['Colliding black holes','A rapidly rotating neutron star emitting radiation','A supernova remnant cloud','Two stars orbiting each other'], correctIndex: 1, explanation: 'A pulsar is a highly magnetized rotating neutron star emitting beams of electromagnetic radiation.', difficulty: 'hard' },
    { question: 'What is the Oort Cloud?', options: ['A type of nebula','A region of comets at the outer solar system','Saturn\'s sixth ring','The debris field from an asteroid belt'], correctIndex: 1, explanation: 'The Oort Cloud is a vast shell of icy bodies surrounding the solar system, source of long-period comets.', difficulty: 'hard' },
    { question: 'Which spacecraft first left the solar system?', options: ['Pioneer 10','Voyager 1','New Horizons','Voyager 2'], correctIndex: 1, explanation: 'Voyager 1, launched in 1977, became the first spacecraft to enter interstellar space in 2012.', difficulty: 'hard' },
    { question: 'What is gravitational lensing?', options: ['A telescope lens type','Bending of light by massive objects\' gravity','Dark matter detection method','The event horizon of a black hole'], correctIndex: 1, explanation: 'Gravitational lensing occurs when massive objects bend light from objects behind them, per general relativity.', difficulty: 'hard' },
    { question: 'What is the Fermi Paradox about?', options: ['Why stars burn out','The contradiction between probable alien life and lack of evidence','Why the universe is expanding','How neutron stars form'], correctIndex: 1, explanation: 'The Fermi Paradox asks: given the probability of extraterrestrial civilizations, why haven\'t we detected them?', difficulty: 'hard' },
  ],
  science: [
    // easy
    { question: 'What is the chemical symbol for water?', options: ['WA','H2O','HO2','W2O'], correctIndex: 1, explanation: 'Water is H₂O: two hydrogen atoms and one oxygen atom.', difficulty: 'easy' },
    { question: 'What is the powerhouse of the cell?', options: ['Nucleus','Ribosome','Mitochondria','Golgi apparatus'], correctIndex: 2, explanation: 'Mitochondria produce ATP, the cell\'s main energy currency.', difficulty: 'easy' },
    { question: 'How many bones are in the adult human body?', options: ['186','206','226','246'], correctIndex: 1, explanation: 'The adult human body has 206 bones.', difficulty: 'easy' },
    { question: 'What gas do plants absorb from the atmosphere?', options: ['Oxygen','Nitrogen','Carbon Dioxide','Hydrogen'], correctIndex: 2, explanation: 'Plants absorb CO₂ during photosynthesis and release oxygen.', difficulty: 'easy' },
    { question: 'What is the most abundant gas in Earth\'s atmosphere?', options: ['Oxygen','Carbon Dioxide','Argon','Nitrogen'], correctIndex: 3, explanation: 'Nitrogen makes up about 78% of Earth\'s atmosphere.', difficulty: 'easy' },
    { question: 'What is the freezing point of water in Celsius?', options: ['-10°C','0°C','4°C','32°C'], correctIndex: 1, explanation: 'Water freezes at 0°C (32°F) under standard pressure.', difficulty: 'easy' },
    { question: 'How many chambers does the human heart have?', options: ['2','3','4','5'], correctIndex: 2, explanation: 'The human heart has four chambers: two atria and two ventricles.', difficulty: 'easy' },
    { question: 'What force keeps planets in orbit around the Sun?', options: ['Magnetism','Friction','Gravity','Centrifugal force'], correctIndex: 2, explanation: 'Gravity is the force that keeps planets in their orbital paths around the Sun.', difficulty: 'easy' },
    // medium
    { question: 'What is the speed of light in a vacuum?', options: ['300,000 km/s','150,000 km/s','3,000 km/s','30,000 km/s'], correctIndex: 0, explanation: 'Light travels at approximately 299,792 km/s in a vacuum.', difficulty: 'medium' },
    { question: 'What is Newton\'s Second Law of Motion?', options: ['Every action has an equal reaction','F = ma','Objects at rest stay at rest','Energy is conserved'], correctIndex: 1, explanation: 'Newton\'s Second Law states Force = mass × acceleration.', difficulty: 'medium' },
    { question: 'What is the pH of pure water?', options: ['5','6','7','8'], correctIndex: 2, explanation: 'Pure water has a neutral pH of 7.', difficulty: 'medium' },
    { question: 'What type of bond holds water molecules together?', options: ['Covalent bond','Ionic bond','Hydrogen bond','Metallic bond'], correctIndex: 2, explanation: 'Water molecules are held together by hydrogen bonds between O and H atoms.', difficulty: 'medium' },
    { question: 'What is the chemical formula for table salt?', options: ['NaCl','KCl','MgCl','CaCl'], correctIndex: 0, explanation: 'Table salt is sodium chloride, NaCl.', difficulty: 'medium' },
    { question: 'What is osmosis?', options: ['Movement of solute across a membrane','Movement of water across a semi-permeable membrane','Evaporation of saltwater','Dissolving sugar in water'], correctIndex: 1, explanation: 'Osmosis is the movement of water molecules through a semi-permeable membrane from low to high solute concentration.', difficulty: 'medium' },
    { question: 'What type of energy is stored in chemical bonds?', options: ['Kinetic energy','Thermal energy','Chemical potential energy','Electrical energy'], correctIndex: 2, explanation: 'Energy stored in chemical bonds is chemical potential energy, released during reactions.', difficulty: 'medium' },
    { question: 'Which organ produces insulin in the human body?', options: ['Liver','Kidney','Pancreas','Spleen'], correctIndex: 2, explanation: 'The pancreas produces insulin, which regulates blood glucose levels.', difficulty: 'medium' },
    // hard
    { question: 'What is the atomic number of carbon?', options: ['4','6','8','12'], correctIndex: 1, explanation: 'Carbon has 6 protons, giving it atomic number 6.', difficulty: 'hard' },
    { question: 'What does DNA stand for?', options: ['Deoxyribonucleic Acid','Deoxyribose Nitrogen Acid','Dinitric Amino Acid','Dynamic Nucleic Acid'], correctIndex: 0, explanation: 'DNA stands for Deoxyribonucleic Acid, the molecule carrying genetic information.', difficulty: 'hard' },
    { question: 'What is the Heisenberg Uncertainty Principle?', options: ['Objects cannot travel faster than light','You cannot know exact position and momentum of a particle simultaneously','Energy is quantized','Electrons orbit in fixed shells'], correctIndex: 1, explanation: 'The Uncertainty Principle states that you cannot simultaneously know a particle\'s exact position and momentum.', difficulty: 'hard' },
    { question: 'What is CRISPR-Cas9 used for?', options: ['Brain scanning','Gene editing','Protein synthesis','Cancer detection'], correctIndex: 1, explanation: 'CRISPR-Cas9 is a revolutionary gene-editing tool that allows precise modification of DNA sequences.', difficulty: 'hard' },
    { question: 'Which particle has no charge?', options: ['Proton','Electron','Neutron','Positron'], correctIndex: 2, explanation: 'Neutrons have no electric charge; they are found in the atomic nucleus alongside protons.', difficulty: 'hard' },
    { question: 'What is entropy in thermodynamics?', options: ['Amount of heat produced','Measure of disorder in a system','Efficiency of an engine','Temperature of absolute zero'], correctIndex: 1, explanation: 'Entropy is a measure of the disorder or randomness of a system; the Second Law states it always increases.', difficulty: 'hard' },
    { question: 'What is the difference between eukaryotes and prokaryotes?', options: ['Size only','Eukaryotes have a membrane-bound nucleus','Prokaryotes have more DNA','Eukaryotes have no cell wall'], correctIndex: 1, explanation: 'Eukaryotic cells have a membrane-bound nucleus; prokaryotes (bacteria) do not.', difficulty: 'hard' },
    { question: 'What principle explains why planes fly?', options: ['Newton\'s Second Law only','Archimedes\' Principle','Bernoulli\'s Principle combined with Newton\'s Third Law','Ohm\'s Law'], correctIndex: 2, explanation: 'Lift on a plane is explained by Bernoulli\'s principle (pressure difference) and Newton\'s third law (deflected air).', difficulty: 'hard' },
  ],
  javascript: [
    // easy
    { question: 'Which keyword declares a block-scoped variable in JS?', options: ['var','let','def','dim'], correctIndex: 1, explanation: '`let` is block-scoped, unlike `var` which is function-scoped.', difficulty: 'easy' },
    { question: 'Which method adds an element to the end of an array?', options: ['push()','pop()','shift()','unshift()'], correctIndex: 0, explanation: '`push()` adds one or more elements to the end of an array.', difficulty: 'easy' },
    { question: 'What does `console.log()` do?', options: ['Saves data','Prints to the browser console','Creates an alert','Terminates the script'], correctIndex: 1, explanation: '`console.log()` outputs information to the browser developer console.', difficulty: 'easy' },
    { question: 'What symbol is used for single-line comments in JavaScript?', options: ['#','<!--','//','**'], correctIndex: 2, explanation: 'Single-line comments in JavaScript use `//`.', difficulty: 'easy' },
    { question: 'Which method removes the last element of an array?', options: ['push()','pop()','shift()','splice()'], correctIndex: 1, explanation: '`pop()` removes and returns the last element of an array.', difficulty: 'easy' },
    { question: 'What does `NaN` stand for?', options: ['Not a Node','Null and Null','Not a Number','No Assigned Name'], correctIndex: 2, explanation: '`NaN` stands for "Not a Number", returned when arithmetic operations fail.', difficulty: 'easy' },
    { question: 'Which HTML tag links a JS file to an HTML page?', options: ['<js>','<link>','<script>','<code>'], correctIndex: 2, explanation: 'The `<script>` tag is used to embed or reference JavaScript files in HTML.', difficulty: 'easy' },
    { question: 'What does `===` check in JavaScript?', options: ['Value only','Type only','Value and type','Reference'], correctIndex: 2, explanation: 'Strict equality (`===`) checks both value and type, unlike `==`.', difficulty: 'easy' },
    // medium
    { question: 'What does `typeof null` return in JavaScript?', options: ['"null"','"undefined"','"object"','"number"'], correctIndex: 2, explanation: 'This is a legacy JavaScript bug — `typeof null` returns "object".', difficulty: 'medium' },
    { question: 'What is a Promise in JavaScript?', options: ['A variable type','A guarantee of async operation resolution','A loop construct','A CSS property'], correctIndex: 1, explanation: 'A Promise represents the eventual completion (or failure) of an asynchronous operation.', difficulty: 'medium' },
    { question: 'What does `Array.map()` do?', options: ['Finds an element','Filters elements','Creates a new array from transformed elements','Sorts the array'], correctIndex: 2, explanation: '`map()` creates a new array by applying a function to each element.', difficulty: 'medium' },
    { question: 'What is the difference between `null` and `undefined`?', options: ['They are the same','`null` is assigned; `undefined` means not assigned','`undefined` is an object; `null` is not','`null` is newer than `undefined`'], correctIndex: 1, explanation: '`null` is an intentional absence of value; `undefined` means a variable was declared but not assigned.', difficulty: 'medium' },
    { question: 'What is `this` in JavaScript?', options: ['The current file','Current object context','The global window always','A reserved keyword that means nothing'], correctIndex: 1, explanation: '`this` refers to the object that is executing the current function (context-dependent).', difficulty: 'medium' },
    { question: 'What does `JSON.stringify()` do?', options: ['Parses JSON to object','Converts object to JSON string','Deletes a JSON file','Validates JSON'], correctIndex: 1, explanation: '`JSON.stringify()` converts a JavaScript object or value to a JSON string.', difficulty: 'medium' },
    { question: 'What is the spread operator `...` used for?', options: ['Only for strings','Expanding iterables into individual elements','Deleting array items','Creating functions'], correctIndex: 1, explanation: 'The spread operator expands arrays/objects into individual elements or properties.', difficulty: 'medium' },
    { question: 'What is `async/await` used for?', options: ['Styling elements','Handling asynchronous operations in a synchronous style','Creating classes','Defining modules'], correctIndex: 1, explanation: '`async/await` is syntactic sugar over Promises, allowing async code to be written synchronously.', difficulty: 'medium' },
    // hard
    { question: 'What is a closure in JavaScript?', options: ['A loop construct','A function with access to its outer scope','A CSS class','A type of error'], correctIndex: 1, explanation: 'A closure is a function that retains access to its enclosing scope even after that scope has finished.', difficulty: 'hard' },
    { question: 'What is the event loop in JavaScript?', options: ['A type of for-loop','Mechanism to handle async operations','A CSS animation loop','A database loop'], correctIndex: 1, explanation: 'The event loop handles execution of callbacks and async code in JS\'s single-threaded environment.', difficulty: 'hard' },
    { question: 'What is prototypal inheritance?', options: ['Copying properties from a class','Objects inheriting directly from other objects','A type of closure','Multiple class inheritance'], correctIndex: 1, explanation: 'In JS, objects can inherit properties and methods from other objects via the prototype chain.', difficulty: 'hard' },
    { question: 'What does the `debounce` pattern do?', options: ['Speeds up function calls','Delays execution until after events stop firing','Cancels a Promise','Prevents memory leaks'], correctIndex: 1, explanation: 'Debounce limits function execution rate by waiting until events have stopped for a set delay.', difficulty: 'hard' },
    { question: 'What is a generator function in JavaScript?', options: ['Creates random numbers','A function that can pause and resume execution','Generates HTML','Creates worker threads'], correctIndex: 1, explanation: 'Generator functions use `function*` and `yield` to pause and resume execution, returning an iterator.', difficulty: 'hard' },
    { question: 'What is the difference between `call`, `apply`, and `bind`?', options: ['They are identical','`call`/`apply` invoke functions; `bind` returns new function with bound `this`','`bind` invokes immediately','`apply` only works on arrays'], correctIndex: 1, explanation: '`call` and `apply` invoke a function with a specified `this`; `bind` returns a new function with `this` bound.', difficulty: 'hard' },
    { question: 'What is the Virtual DOM?', options: ['A fake browser','In-memory JS representation of the real DOM for efficient updates','A 3D rendering API','A CSS preprocessor'], correctIndex: 1, explanation: 'The Virtual DOM is a lightweight JS copy of the real DOM used by React to batch and minimize DOM changes.', difficulty: 'hard' },
    { question: 'What is a WeakMap in JavaScript?', options: ['A Map that can only hold strings','A collection with weak references to keys allowing garbage collection','A limited-size Map','An encrypted Map'], correctIndex: 1, explanation: 'A WeakMap holds weak references to its keys — they are garbage collected when no other reference exists.', difficulty: 'hard' },
  ],
  harry_potter: [
    // easy
    { question: 'What school does Harry Potter attend?', options: ['Durmstrang','Beauxbatons','Hogwarts','Castelobruxo'], correctIndex: 2, explanation: 'Harry attends Hogwarts School of Witchcraft and Wizardry.', difficulty: 'easy' },
    { question: 'What is the name of Harry\'s owl?', options: ['Crookshanks','Scabbers','Hedwig','Errol'], correctIndex: 2, explanation: 'Hedwig is Harry\'s white snowy owl, a birthday gift from Hagrid.', difficulty: 'easy' },
    { question: 'Which house does Harry Potter belong to?', options: ['Slytherin','Ravenclaw','Hufflepuff','Gryffindor'], correctIndex: 3, explanation: 'Harry is sorted into Gryffindor, known for bravery and courage.', difficulty: 'easy' },
    { question: 'What sport do students play at Hogwarts?', options: ['Quodpot','Quidditch','Broom Racing','Wizardball'], correctIndex: 1, explanation: 'Quidditch is the popular wizarding sport played on broomsticks at Hogwarts.', difficulty: 'easy' },
    { question: 'What is the name of Hagrid\'s dragon in the first book?', options: ['Buckbeak','Norbert','Nagini','Fang'], correctIndex: 1, explanation: 'Hagrid hatches a Norwegian Ridgeback dragon named Norbert in the first book.', difficulty: 'easy' },
    { question: 'What does the spell "Expelliarmus" do?', options: ['Kills instantly','Petrifies','Disarms the opponent','Makes you invisible'], correctIndex: 2, explanation: '`Expelliarmus` is the Disarming Charm — Harry\'s signature spell.', difficulty: 'easy' },
    { question: 'What is the name of Harry\'s best friend with red hair?', options: ['Neville Longbottom','Draco Malfoy','Ron Weasley','Dean Thomas'], correctIndex: 2, explanation: 'Ron Weasley is Harry\'s best friend throughout the series.', difficulty: 'easy' },
    { question: 'What is the name of the magical newspaper in Harry Potter?', options: ['The Daily Prophet','The Wizard Times','The Hogwarts Herald','The Magic Post'], correctIndex: 0, explanation: 'The Daily Prophet is the primary wizarding newspaper in the Harry Potter universe.', difficulty: 'easy' },
    // medium
    { question: 'What is the core of Harry\'s wand?', options: ['Dragon heartstring','Unicorn hair','Phoenix feather','Veela hair'], correctIndex: 2, explanation: 'Harry\'s wand has a phoenix feather core; it is a twin to Voldemort\'s wand.', difficulty: 'medium' },
    { question: 'What is the name of Hermione\'s cat?', options: ['Scabbers','Hedwig','Trevor','Crookshanks'], correctIndex: 3, explanation: 'Crookshanks is Hermione\'s half-Kneazle cat who appears from the third book.', difficulty: 'medium' },
    { question: 'What does the Mirror of Erised show?', options: ['The future','The viewer\'s deepest desire','The past','Hidden truths'], correctIndex: 1, explanation: 'The Mirror of Erised shows the viewer their deepest desire ("desire" spelled backwards).', difficulty: 'medium' },
    { question: 'What is the Three Broomsticks?', options: ['A Quidditch team','A pub in Hogsmeade','A spell','An inn in Diagon Alley'], correctIndex: 1, explanation: 'The Three Broomsticks is a popular pub and inn in the wizarding village of Hogsmeade.', difficulty: 'medium' },
    { question: 'Which creature guards the entrance to Dumbledore\'s office?', options: ['A troll','A gargoyle','A phoenix','A hippogriff'], correctIndex: 1, explanation: 'A stone gargoyle guards the entrance to Dumbledore\'s office at Hogwarts.', difficulty: 'medium' },
    { question: 'What is the name of the wizarding bank in London?', options: ['Vaultco','Diagon Bank','Gringotts','Wizard Trust'], correctIndex: 2, explanation: 'Gringotts Wizarding Bank is run by goblins and located in Diagon Alley, London.', difficulty: 'medium' },
    { question: 'What does "Accio" do?', options: ['Locks a door','Summons an object','Creates fire','Makes you fly'], correctIndex: 1, explanation: '"Accio" is the Summoning Charm, bringing objects to the caster.', difficulty: 'medium' },
    { question: 'What animal is Sirius Black\'s Animagus form?', options: ['A wolf','A raven','A stag','A black dog'], correctIndex: 3, explanation: 'Sirius Black\'s Animagus form is a large black dog.', difficulty: 'medium' },
    // hard
    { question: 'Who is the Half-Blood Prince?', options: ['Harry Potter','Albus Dumbledore','Severus Snape','Tom Riddle'], correctIndex: 2, explanation: 'Severus Snape is the Half-Blood Prince — son of a witch named Eileen Prince.', difficulty: 'hard' },
    { question: 'What does the spell "Avada Kedavra" do?', options: ['Disarms','Causes pain','Kills instantly','Petrifies'], correctIndex: 2, explanation: 'Avada Kedavra is the Killing Curse, one of the three Unforgivable Curses.', difficulty: 'hard' },
    { question: 'What are the Deathly Hallows?', options: ['Three cursed artifacts','The Elder Wand, Resurrection Stone, and Invisibility Cloak','Three Horcruxes','Three dark spells'], correctIndex: 1, explanation: 'The Deathly Hallows are three legendary objects: the Elder Wand, Resurrection Stone, and Invisibility Cloak.', difficulty: 'hard' },
    { question: 'What is a Horcrux?', options: ['A dark spell','An object containing a piece of a wizard\'s soul','A cursed artifact','A type of dark creature'], correctIndex: 1, explanation: 'A Horcrux is an object in which a dark wizard hides a fragment of their soul, achieving near-immortality.', difficulty: 'hard' },
    { question: 'What is the Patronus of Severus Snape?', options: ['A wolf','A doe','A phoenix','A stag'], correctIndex: 1, explanation: 'Snape\'s Patronus is a doe — the same as Lily Potter\'s — symbolizing his eternal love for her.', difficulty: 'hard' },
    { question: 'What position does Harry play in Quidditch?', options: ['Keeper','Chaser','Beater','Seeker'], correctIndex: 3, explanation: 'Harry plays Seeker — the player who catches the Golden Snitch.', difficulty: 'hard' },
    { question: 'What is the prophecy about Harry and Voldemort?', options: ['One must die at the other\'s hand','Neither can live while the other survives','They are connected by blood','They share the same soul'], correctIndex: 1, explanation: 'The prophecy states: "Neither can live while the other survives" — one must kill the other.', difficulty: 'hard' },
    { question: 'Which of the following is NOT a Horcrux?', options: ['Tom Riddle\'s Diary','Slytherin\'s Locket','Hufflepuff\'s Cup','Gryffindor\'s Sword'], correctIndex: 3, explanation: 'Gryffindor\'s Sword was never a Horcrux — it was used to destroy them.', difficulty: 'hard' },
  ],
  marvel: [
    // easy
    { question: 'What is Iron Man\'s real name?', options: ['Steve Rogers','Bruce Banner','Tony Stark','Peter Parker'], correctIndex: 2, explanation: 'Tony Stark is the billionaire genius who built the Iron Man armor.', difficulty: 'easy' },
    { question: 'Who was the first Avenger?', options: ['Iron Man','Thor','Captain America','Black Widow'], correctIndex: 2, explanation: 'Captain America (Steve Rogers) is officially "The First Avenger".', difficulty: 'easy' },
    { question: 'What is Spider-Man\'s real name?', options: ['Miles Morales','Peter Parker','Eddie Brock','Flash Thompson'], correctIndex: 1, explanation: 'The most famous Spider-Man is Peter Parker, a high school student from Queens, New York.', difficulty: 'easy' },
    { question: 'What color is the Hulk?', options: ['Red','Blue','Green','Purple'], correctIndex: 2, explanation: 'The Hulk is famously green, a byproduct of gamma radiation exposure.', difficulty: 'easy' },
    { question: 'What is Thor\'s hammer called?', options: ['Gungnir','Mjolnir','Stormbreaker','Hofud'], correctIndex: 1, explanation: 'Mjolnir is Thor\'s enchanted hammer, which can only be lifted by those deemed worthy.', difficulty: 'easy' },
    { question: 'Which organization does Nick Fury lead?', options: ['HYDRA','AIM','SHIELD','Stark Industries'], correctIndex: 2, explanation: 'Nick Fury is the director of S.H.I.E.L.D. (Strategic Homeland Intervention, Enforcement and Logistics Division).', difficulty: 'easy' },
    { question: 'What is the name of Black Panther\'s kingdom?', options: ['Attilan','Latveria','Genosha','Wakanda'], correctIndex: 3, explanation: 'Black Panther (T\'Challa) is the king of Wakanda, an advanced African nation.', difficulty: 'easy' },
    { question: 'What radioactive substance is Kryptonite to... wait, which gem powers Captain Marvel?', options: ['Tesseract','Infinity Stone','Photon Crystal','No gem — cosmic energy'], correctIndex: 3, explanation: 'Captain Marvel draws her power from cosmic energy — she was given powers by a Kree device, not a gem.', difficulty: 'easy' },
    // medium
    { question: 'Which stone gives its user control over all minds?', options: ['Space Stone','Power Stone','Mind Stone','Reality Stone'], correctIndex: 2, explanation: 'The Mind Stone, housed in Vision\'s forehead, controls minds.', difficulty: 'medium' },
    { question: 'What is the name of Thor\'s home realm?', options: ['Vanaheim','Jotunheim','Svartalfheim','Asgard'], correctIndex: 3, explanation: 'Thor is the prince of Asgard, one of the Nine Realms.', difficulty: 'medium' },
    { question: 'Who is Thanos\'s adoptive daughter who later joins the Guardians?', options: ['Nebula','Gamora','Mantis','Moondragon'], correctIndex: 1, explanation: 'Gamora is Thanos\'s adoptive daughter and a core member of the Guardians of the Galaxy.', difficulty: 'medium' },
    { question: 'What element did Tony Stark invent a new form of?', options: ['Carbon','Palladium','Vibranium','Ironium'], correctIndex: 1, explanation: 'Tony Stark synthesized a new element (based on his father\'s research) to replace the palladium in his arc reactor.', difficulty: 'medium' },
    { question: 'Who snapped half the universe back in Avengers: Endgame?', options: ['Thor','Captain America','Tony Stark','Bruce Banner'], correctIndex: 2, explanation: 'Tony Stark (Iron Man) made the final snap using the Infinity Stones, sacrificing his life.', difficulty: 'medium' },
    { question: 'What is Ant-Man\'s real name (the original)?', options: ['Scott Lang','Hank Pym','Eric O\'Grady','Bill Foster'], correctIndex: 1, explanation: 'Hank Pym is the original Ant-Man who created the Pym Particles allowing size manipulation.', difficulty: 'medium' },
    { question: 'Doctor Strange is the Sorcerer Supreme of which sanctum?', options: ['London','Hong Kong','New York','Kathmandu'], correctIndex: 2, explanation: 'Doctor Strange oversees the New York Sanctum Sanctorum.', difficulty: 'medium' },
    { question: 'What is vibranium primarily used for in Wakanda?', options: ['Fuel','Weapons and advanced technology','Currency only','Communication'], correctIndex: 1, explanation: 'Vibranium is Wakanda\'s most valuable resource, used for advanced weapons, technology, and Captain America\'s shield.', difficulty: 'medium' },
    // hard
    { question: 'Who created Ultron?', options: ['Tony Stark','Bruce Banner','Both Tony Stark & Bruce Banner','Nick Fury'], correctIndex: 2, explanation: 'Both Tony Stark and Bruce Banner created Ultron using the Mind Stone\'s AI.', difficulty: 'hard' },
    { question: 'What is the Darkhold?', options: ['A dark realm dimension','A book of dark magic spells','Dormammu\'s weapon','A type of Infinity Stone'], correctIndex: 1, explanation: 'The Darkhold is an ancient book of dark magic, appearing in Doctor Strange and WandaVision.', difficulty: 'hard' },
    { question: 'Which Infinity Stone was on Vormir?', options: ['Time Stone','Space Stone','Soul Stone','Reality Stone'], correctIndex: 2, explanation: 'The Soul Stone was located on Vormir, requiring sacrifice of someone loved to obtain.', difficulty: 'hard' },
    { question: 'What does HYDRA\'s motto translate to?', options: ['Cut off one head, two more shall grow','For the glory of war','Science conquers all','Power corrupts everything'], correctIndex: 0, explanation: 'HYDRA\'s motto is "Cut off one head, two more shall take its place."', difficulty: 'hard' },
    { question: 'Who are the Celestials in the Marvel universe?', options: ['Elder gods','Primordial cosmic beings who shaped the universe','Asgardian ancestors','A type of Infinity Stone guardian'], correctIndex: 1, explanation: 'The Celestials are immensely powerful cosmic entities involved in the creation of life and the universe.', difficulty: 'hard' },
    { question: 'What is the Multiverse Saga about (MCU Phases 4–6)?', options: ['Time travel consequences','Threats from alternate universes and the multiverse','The rise of mutants','A second Infinity War'], correctIndex: 1, explanation: 'The Multiverse Saga explores threats and stories emerging from the multiverse, including Kang the Conqueror.', difficulty: 'hard' },
    { question: 'Who is the true identity of the villain Mysterio?', options: ['Adrian Toomes','Quentin Beck','Wilson Fisk','Norman Osborn'], correctIndex: 1, explanation: 'Mysterio\'s real name is Quentin Beck — a former Stark Industries employee.', difficulty: 'hard' },
    { question: 'What is the Ten Rings organization named after in Shang-Chi?', options: ['Ten founding warriors','Ten magical artifacts worn as rings','Ten ancient temples','Ten legendary battles'], correctIndex: 1, explanation: 'The Ten Rings are actual magical rings — ancient weapons wielded by Xu Wenwu for thousands of years.', difficulty: 'hard' },
  ],
  geography: [
    // easy
    { question: 'What is the capital of France?', options: ['London','Berlin','Paris','Rome'], correctIndex: 2, explanation: 'Paris is the capital and largest city of France.', difficulty: 'easy' },
    { question: 'What is the largest country by area?', options: ['China','USA','Canada','Russia'], correctIndex: 3, explanation: 'Russia is the world\'s largest country by area at 17.1 million km².', difficulty: 'easy' },
    { question: 'What is the capital of Japan?', options: ['Osaka','Kyoto','Hiroshima','Tokyo'], correctIndex: 3, explanation: 'Tokyo is the capital and most populous city of Japan.', difficulty: 'easy' },
    { question: 'On which continent is the Sahara Desert?', options: ['Asia','Australia','South America','Africa'], correctIndex: 3, explanation: 'The Sahara is the world\'s largest hot desert, located in North Africa.', difficulty: 'easy' },
    { question: 'What is the capital of the United States?', options: ['New York','Los Angeles','Washington D.C.','Chicago'], correctIndex: 2, explanation: 'Washington D.C. (District of Columbia) is the capital of the United States.', difficulty: 'easy' },
    { question: 'Which ocean is the largest?', options: ['Atlantic','Indian','Arctic','Pacific'], correctIndex: 3, explanation: 'The Pacific Ocean is the largest, covering more than 30% of Earth\'s surface.', difficulty: 'easy' },
    { question: 'How many continents does Earth have?', options: ['5','6','7','8'], correctIndex: 2, explanation: 'Earth has 7 continents: Africa, Antarctica, Asia, Australia/Oceania, Europe, North America, South America.', difficulty: 'easy' },
    { question: 'What is the capital of Brazil?', options: ['São Paulo','Rio de Janeiro','Brasília','Salvador'], correctIndex: 2, explanation: 'Brasília, not Rio, has been the capital of Brazil since 1960.', difficulty: 'easy' },
    // medium
    { question: 'Which river is the longest in the world?', options: ['Amazon','Yangtze','Nile','Mississippi'], correctIndex: 2, explanation: 'The Nile River (~6,650 km) is generally considered the world\'s longest river.', difficulty: 'medium' },
    { question: 'Mount Everest lies on the border of which two countries?', options: ['India and Tibet','Nepal and Tibet','Nepal and India','Bhutan and Tibet'], correctIndex: 1, explanation: 'Mount Everest sits on the Nepal–Tibet (China) border.', difficulty: 'medium' },
    { question: 'Which country has the most natural lakes?', options: ['Russia','USA','Brazil','Canada'], correctIndex: 3, explanation: 'Canada has the most lakes of any country — approximately 879,000 lakes.', difficulty: 'medium' },
    { question: 'In which European country is Transylvania located?', options: ['Hungary','Bulgaria','Romania','Ukraine'], correctIndex: 2, explanation: 'Transylvania is a historical region in central Romania.', difficulty: 'medium' },
    { question: 'What is the longest mountain range in the world?', options: ['Himalayas','Rocky Mountains','Andes','Alps'], correctIndex: 2, explanation: 'The Andes in South America are the world\'s longest mountain range at ~7,000 km.', difficulty: 'medium' },
    { question: 'Which country has the most time zones?', options: ['Russia','USA','China','France'], correctIndex: 3, explanation: 'France has the most time zones (12) due to its overseas territories around the world.', difficulty: 'medium' },
    { question: 'What is the deepest lake in the world?', options: ['Lake Superior','Lake Titicaca','Lake Baikal','Caspian Sea'], correctIndex: 2, explanation: 'Lake Baikal in Siberia is the world\'s deepest lake at 1,642 meters.', difficulty: 'medium' },
    { question: 'Which country is home to the most pyramids?', options: ['Egypt','Mexico','Peru','Sudan'], correctIndex: 3, explanation: 'Sudan has more pyramids than Egypt — over 200 ancient Nubian pyramids.', difficulty: 'medium' },
    // hard
    { question: 'Which is the smallest country in the world?', options: ['Monaco','San Marino','Vatican City','Liechtenstein'], correctIndex: 2, explanation: 'Vatican City at 0.44 km² is the world\'s smallest independent state.', difficulty: 'hard' },
    { question: 'What is the capital of Australia?', options: ['Sydney','Melbourne','Brisbane','Canberra'], correctIndex: 3, explanation: 'Canberra is Australia\'s capital, chosen as a compromise between Sydney and Melbourne.', difficulty: 'hard' },
    { question: 'Which country has the most official languages?', options: ['India','South Africa','Switzerland','Papua New Guinea'], correctIndex: 1, explanation: 'South Africa has 11 official languages — the most of any country.', difficulty: 'hard' },
    { question: 'What is the name of the disputed territory between India and Pakistan?', options: ['Punjab','Kashmir','Sindh','Balochistan'], correctIndex: 1, explanation: 'Kashmir has been a disputed territory between India and Pakistan since 1947.', difficulty: 'hard' },
    { question: 'Which African country has the most pyramids?', options: ['Egypt','Libya','Ethiopia','Sudan'], correctIndex: 3, explanation: 'Sudan (ancient Nubia) has over 200 pyramids — more than Egypt.', difficulty: 'hard' },
    { question: 'What is the capital of Kazakhstan?', options: ['Almaty','Astana','Shymkent','Atyrau'], correctIndex: 1, explanation: 'Astana (formerly Nur-Sultan) is the capital of Kazakhstan since 1997.', difficulty: 'hard' },
    { question: 'Which country has the longest coastline?', options: ['Russia','Australia','Norway','Canada'], correctIndex: 3, explanation: 'Canada has the world\'s longest coastline at approximately 202,080 km.', difficulty: 'hard' },
    { question: 'What is the Mariana Trench?', options: ['A mountain range under the sea','The deepest part of Earth\'s oceans','A volcanic hotspot','An underwater plateau'], correctIndex: 1, explanation: 'The Mariana Trench in the Pacific Ocean is the deepest point on Earth at ~11,000 meters.', difficulty: 'hard' },
  ],
  default: [
    // easy
    { question: 'What is 2 + 2?', options: ['3','4','5','6'], correctIndex: 1, explanation: '2 + 2 = 4.', difficulty: 'easy' },
    { question: 'How many continents are on Earth?', options: ['5','6','7','8'], correctIndex: 2, explanation: 'Earth has 7 continents.', difficulty: 'easy' },
    { question: 'What is the color of the sky on a clear day?', options: ['Green','Yellow','Blue','White'], correctIndex: 2, explanation: 'The sky appears blue because of Rayleigh scattering of sunlight.', difficulty: 'easy' },
    { question: 'How many days are in a week?', options: ['5','6','7','8'], correctIndex: 2, explanation: 'A week has 7 days.', difficulty: 'easy' },
    { question: 'What is the capital of England?', options: ['Manchester','Birmingham','Edinburgh','London'], correctIndex: 3, explanation: 'London is the capital city of England and the United Kingdom.', difficulty: 'easy' },
    { question: 'What is H2O commonly known as?', options: ['Salt','Sugar','Water','Vinegar'], correctIndex: 2, explanation: 'H₂O is the chemical formula for water.', difficulty: 'easy' },
    { question: 'How many sides does a triangle have?', options: ['2','3','4','5'], correctIndex: 1, explanation: 'A triangle has exactly 3 sides.', difficulty: 'easy' },
    { question: 'What is the largest mammal on Earth?', options: ['Elephant','Giraffe','Blue Whale','Hippopotamus'], correctIndex: 2, explanation: 'The blue whale is the largest animal ever known to have lived on Earth.', difficulty: 'easy' },
    // medium
    { question: 'What is the boiling point of water at sea level?', options: ['90°C','95°C','100°C','110°C'], correctIndex: 2, explanation: 'Water boils at 100°C (212°F) at standard atmospheric pressure.', difficulty: 'medium' },
    { question: 'Who painted the Mona Lisa?', options: ['Michelangelo','Rembrandt','Van Gogh','Leonardo da Vinci'], correctIndex: 3, explanation: 'Leonardo da Vinci painted the Mona Lisa between approximately 1503 and 1519.', difficulty: 'medium' },
    { question: 'What is the chemical symbol for gold?', options: ['Go','Gd','Au','Ag'], correctIndex: 2, explanation: 'Gold\'s symbol is Au, from the Latin word "aurum".', difficulty: 'medium' },
    { question: 'What is the largest organ in the human body?', options: ['Heart','Brain','Liver','Skin'], correctIndex: 3, explanation: 'The skin is the body\'s largest organ, covering the entire external surface.', difficulty: 'medium' },
    { question: 'How many strings does a standard guitar have?', options: ['4','5','6','7'], correctIndex: 2, explanation: 'A standard guitar has 6 strings.', difficulty: 'medium' },
    { question: 'What is the currency of Japan?', options: ['Yuan','Won','Yen','Ringgit'], correctIndex: 2, explanation: 'The Japanese Yen (¥) is the official currency of Japan.', difficulty: 'medium' },
    { question: 'In what year did the Berlin Wall fall?', options: ['1987','1988','1989','1990'], correctIndex: 2, explanation: 'The Berlin Wall fell on November 9, 1989.', difficulty: 'medium' },
    { question: 'What is the smallest prime number?', options: ['0','1','2','3'], correctIndex: 2, explanation: '2 is the smallest prime number and the only even prime.', difficulty: 'medium' },
    // hard
    { question: 'What is the square root of 144?', options: ['11','12','13','14'], correctIndex: 1, explanation: '√144 = 12, because 12 × 12 = 144.', difficulty: 'hard' },
    { question: 'In which year was the internet publicly introduced?', options: ['1983','1989','1991','1995'], correctIndex: 2, explanation: 'The World Wide Web was publicly launched in 1991 by Tim Berners-Lee.', difficulty: 'hard' },
    { question: 'What is the Fibonacci sequence?', options: ['Squares of natural numbers','Each number is the sum of the two before it','Prime numbers in order','Alternating even-odd numbers'], correctIndex: 1, explanation: 'The Fibonacci sequence: 1, 1, 2, 3, 5, 8... where each number is the sum of the two preceding.', difficulty: 'hard' },
    { question: 'What does "Cogito, ergo sum" mean?', options: ['I think, therefore I am','Knowledge is power','To be is to perceive','The world is my idea'], correctIndex: 0, explanation: '"Cogito, ergo sum" is a Latin phrase by Descartes meaning "I think, therefore I am".', difficulty: 'hard' },
    { question: 'What is the only country to have used nuclear weapons in warfare?', options: ['Russia','Germany','USA','UK'], correctIndex: 2, explanation: 'The USA dropped atomic bombs on Hiroshima and Nagasaki, Japan in August 1945.', difficulty: 'hard' },
    { question: 'What is the Turing Test?', options: ['A speed test for computers','A test of whether a machine can exhibit intelligent behavior indistinguishable from a human','A programming language test','An encryption algorithm'], correctIndex: 1, explanation: 'The Turing Test, proposed by Alan Turing in 1950, checks if a machine can pass as human in conversation.', difficulty: 'hard' },
    { question: 'What is Occam\'s Razor?', options: ['A medieval weapon','The principle that the simplest explanation is usually correct','A shaving technique','A mathematical theorem'], correctIndex: 1, explanation: 'Occam\'s Razor is the problem-solving principle that the simplest solution is most likely correct.', difficulty: 'hard' },
    { question: 'What is the Dunning-Kruger effect?', options: ['A type of optical illusion','Cognitive bias where incompetent people overestimate their ability','A memory recall disorder','A social conformity phenomenon'], correctIndex: 1, explanation: 'The Dunning-Kruger effect is a cognitive bias where people with limited knowledge overestimate their competence.', difficulty: 'hard' },
  ],
};

/**
 * Detect which bank topic best matches user topic string.
 * Now covers many more keywords so fewer topics fall to 'default'.
 */
function detectBankKey(topic) {
  const t = topic.toLowerCase();
  if (/histor|war|empire|ancient|revolution|dynasty|civiliz|medieval|colonial|napoleon|roman|greek|viking|pharaoh|feudal|mongol|ottoman|british raj/.test(t)) return 'history';
  if (/space|astronom|planet|star|galaxy|nasa|moon|orbit|cosmos|comet|meteor|nebula|rocket|astronaut|solar system|universe|telescope|satellite|mars|jupiter|saturn/.test(t)) return 'space';
  if (/^science$|biology|physics|chemistry|dna|cell|atom|molecule|element|periodic|evolution|genetics|quantum|relativity|thermodynamic|organic|anatomy|ecology|zoology|botany|microbio|neuroscience/.test(t)) return 'science';
  if (/javascript|js\b|coding|programming|react|node|python|java\b|typescript|css\b|html\b|software|algorithm|data structure|computer science|web dev|frontend|backend|api\b|database|sql\b|git\b/.test(t)) return 'javascript';
  if (/harry potter|hogwarts|wizard|hermione|dumbledore|voldemort|gryffindor|slytherin|hufflepuff|ravenclaw|quidditch|horcrux|weasley|hogwart|jk rowling/.test(t)) return 'harry_potter';
  if (/marvel|avenger|iron man|thor|spider.?man|captain america|wakanda|thanos|hulk|black panther|guardians|dr strange|loki|wolverine|x.?men|fantastic four|ant.?man/.test(t)) return 'marvel';
  if (/geograph|capital city|country|continent|mountain|river|ocean|lake|desert|island|population|flag|map|border|europe|asia|africa|america|australia/.test(t)) return 'geography';
  return null; // null = unknown topic, use dynamic generator
}

/**
 * Generate topic-specific placeholder questions when Gemini is down
 * and the topic isn't in the fallback bank.
 * These aren't perfect quiz questions but they ARE about the right topic
 * and clearly labelled as offline placeholders.
 */
function generateDynamicFallback(topic, count) {
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
  const topicName = cap(topic.trim());

  // Build a pool of templated questions that reference the exact topic
  const pool = [
    {
      question: `Which of the following is most closely associated with ${topicName}?`,
      options: [`Core concepts of ${topicName}`, `Unrelated field A`, `Unrelated field B`, `Unrelated field C`],
      correctIndex: 0,
      explanation: `${topicName} encompasses its own core concepts and terminology that distinguish it from unrelated fields.`,
      difficulty: 'easy',
    },
    {
      question: `${topicName} is primarily studied or practised in which domain?`,
      options: [`Its own dedicated field`, `Mathematics only`, `Literature only`, `Engineering only`],
      correctIndex: 0,
      explanation: `${topicName} has its own dedicated domain, methodology, and body of knowledge.`,
      difficulty: 'easy',
    },
    {
      question: `What is a key characteristic that defines ${topicName}?`,
      options: [`Its unique principles and methods`, `Random chance`, `It has no defining features`, `It borrows everything from physics`],
      correctIndex: 0,
      explanation: `Every field, including ${topicName}, is defined by a set of unique principles, methods, and foundational ideas.`,
      difficulty: 'easy',
    },
    {
      question: `When learning ${topicName}, which approach is most effective?`,
      options: [`Start with fundamentals and build up`, `Jump straight to advanced topics`, `Skip theory entirely`, `Memorise without understanding`],
      correctIndex: 0,
      explanation: `Building a strong foundational understanding before advancing is the most effective learning strategy for ${topicName}.`,
      difficulty: 'easy',
    },
    {
      question: `Which statement best describes the importance of ${topicName}?`,
      options: [`It has real-world applications and relevance`, `It is purely theoretical with no use`, `It is obsolete`, `It only applies to one country`],
      correctIndex: 0,
      explanation: `${topicName} has real-world relevance and applications that make it worth studying.`,
      difficulty: 'medium',
    },
    {
      question: `Experts in ${topicName} typically need which type of skill?`,
      options: [`Critical thinking and domain knowledge`, `Only memorisation`, `No special skills`, `Physical strength only`],
      correctIndex: 0,
      explanation: `Like all fields, ${topicName} requires a combination of critical thinking and specialised domain knowledge.`,
      difficulty: 'medium',
    },
    {
      question: `How has ${topicName} evolved over time?`,
      options: [`It has grown through research, discovery and innovation`, `It has stayed completely static`, `It disappeared in the 20th century`, `It was invented last year`],
      correctIndex: 0,
      explanation: `Most fields including ${topicName} evolve as new research, technologies, and perspectives emerge.`,
      difficulty: 'medium',
    },
    {
      question: `Which of the following would most likely be a subtopic within ${topicName}?`,
      options: [`A specialised branch or sub-discipline of ${topicName}`, `An entirely unrelated subject`, `A sport`, `A cooking technique`],
      correctIndex: 0,
      explanation: `Large fields like ${topicName} are typically divided into smaller sub-disciplines or specialised areas of study.`,
      difficulty: 'medium',
    },
    {
      question: `At an advanced level, what do practitioners of ${topicName} focus on?`,
      options: [`Solving complex, open-ended problems in the field`, `Repeating beginner exercises`, `Switching to a different field`, `Avoiding all theory`],
      correctIndex: 0,
      explanation: `Advanced practitioners of ${topicName} tackle complex, nuanced problems that require deep understanding and creative thinking.`,
      difficulty: 'hard',
    },
    {
      question: `What distinguishes a novice from an expert in ${topicName}?`,
      options: [`Depth of understanding, experience and ability to handle complexity`, `Age only`, `Access to better tools only`, `Having more free time`],
      correctIndex: 0,
      explanation: `Expertise in ${topicName} comes from accumulated knowledge, practice, and the ability to navigate complex situations effectively.`,
      difficulty: 'hard',
    },
    {
      question: `How does ${topicName} intersect with other disciplines?`,
      options: [`It often borrows from and contributes to related fields`, `It exists in complete isolation`, `It only intersects with mathematics`, `It never influences other fields`],
      correctIndex: 0,
      explanation: `Modern disciplines, including ${topicName}, rarely exist in isolation — they intersect with and enrich related fields of study.`,
      difficulty: 'hard',
    },
    {
      question: `What role does evidence and critical evaluation play in ${topicName}?`,
      options: [`Central — claims must be supported by evidence and reasoning`, `None — intuition is sufficient`, `Minimal — tradition overrides evidence`, `Evidence is only needed in science`],
      correctIndex: 0,
      explanation: `In any serious field including ${topicName}, claims and conclusions should be grounded in evidence and rigorous critical evaluation.`,
      difficulty: 'hard',
    },
  ];

  // Shuffle and tile to fill count
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const selected = [];
  for (let i = 0; i < count; i++) {
    selected.push({ ...shuffled[i % shuffled.length] });
  }
  return selected;
}

/**
 * Generate a quiz locally from the built-in bank, or dynamically for unknown topics.
 */
function generateFallbackQuiz(topic, difficulty, count) {
  const bankKey = detectBankKey(topic);

  if (bankKey) {
    // Known topic — use the full bank
    console.log(`[fallback] 🦆 Using "${bankKey}" bank for topic "${topic}"`);
    const allQ    = FALLBACK_BANK[bankKey];
    const shuffled = [...allQ].sort(() => Math.random() - 0.5);
    const selected = [];
    for (let i = 0; i < count; i++) {
      selected.push({ ...shuffled[i % shuffled.length] });
    }
    return selected.map(q => ({
      question:     q.question,
      options:      q.options,
      correctIndex: q.correctIndex,
      explanation:  q.explanation,
      difficulty:   q.difficulty,
    }));
  }

  // Unknown topic — generate dynamic placeholder questions about the actual topic
  // instead of serving unrelated "default" questions
  console.log(`[fallback] ⚡ Generating dynamic questions for unknown topic "${topic}"`);
  return generateDynamicFallback(topic, count);
}

// ── Main export ───────────────────────────────────────────────
/**
 * Generate an adaptive batch of questions.
 * Order of operations:
 *   1. Check cache
 *   2. Try Gemini (with retries)
 *   3. Fallback to local bank
 *
 * NEVER throws — always returns a valid question array.
 */
async function generateAdaptiveBatch(topic, count, difficulty, isCorrect) {
  // 1. Cache check
  const cached = getCachedQuiz(topic, difficulty);
  if (cached) {
    const shuffled = [...cached].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  // 2. Try Gemini
  let questions = null;
  if (process.env.GEMINI_API_KEY) {
    questions = await generateWithGemini(topic, count, difficulty, isCorrect);
  } else {
    console.warn('[gemini] ⚠️  No GEMINI_API_KEY set — skipping API call');
  }

  // 3. Fallback if Gemini failed
  if (!questions || questions.length === 0) {
    questions = generateFallbackQuiz(topic, difficulty, count);
    // Don't cache fallback — try Gemini again next time
    return questions;
  }

  // Cache successful Gemini response
  setCachedQuiz(topic, difficulty, questions);
  return questions;
}

/**
 * Validate a single answer — pure local logic, no API call.
 */
function validateAnswer(question, selectedIndex) {
  const isCorrect = selectedIndex === question.correctIndex;
  return {
    isCorrect,
    correctIndex: question.correctIndex,
    explanation:  question.explanation,
  };
}

module.exports = { generateAdaptiveBatch, validateAnswer };
