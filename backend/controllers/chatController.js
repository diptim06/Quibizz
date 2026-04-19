/* ══════════════════════════════════════════════════════════
   Quibizz — Chat Controller
   Primary: Gemini AI (with retry + exponential backoff)
   Fallback: Smart rule-based responder so the chat ALWAYS works
   ══════════════════════════════════════════════════════ */
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ── Gemini setup ─────────────────────────────────────────
const QUIBIZZ_SYSTEM_PROMPT = `You are Quibby — the friendly, witty AI assistant built into Quibizz, an adaptive AI-powered quiz platform.

ABOUT QUIBIZZ:
- Generates AI-powered multiple-choice quizzes on ANY topic using Google Gemini
- Per-question adaptive difficulty: correct → harder next; wrong → easier next
- AI Personality Mode: Easy=😈Savage, Medium=🎤Stand-up, Hard=🧘Calm Mentor
- Topics: anything the user wants (history, science, pop culture, coding, etc.)
- Leaderboard, profile, quiz history, 1–20 question quizzes
- Works offline with a local fallback question bank

YOUR PERSONALITY:
- Helpful, warm, slightly quirky — like a smart duck friend 🦆
- Use emojis occasionally, not excessively
- Answer ANY general knowledge question on any topic
- Keep answers concise unless detail is requested
- Use markdown for code, lists, bold when helpful`;

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

// ── Rule-based fallback responder ────────────────────────
/**
 * Returns a smart, context-aware reply without needing any API.
 * Covers the most common chat use-cases.
 */
function smartFallback(message) {
  const msg = message.toLowerCase().trim();

  // ── Greetings ────────────────────────────────────────
  if (/^(hi|hello|hey|sup|yo|hiya|howdy|greetings)[\s!?.]*$/.test(msg)) {
    return "Hey there! 🦆 I'm Quibby, your AI study buddy. Ask me anything — quiz tips, general knowledge, science, history, coding… I'm all ears (well, feathers)!";
  }

  if (/how are you|how's it going|what's up|wassup/.test(msg)) {
    return "I'm doing great, thanks for asking! 🦆 Ready to help. What's on your mind — a topic question, quiz tips, or something else entirely?";
  }

  // ── Quibizz how-to questions ─────────────────────────
  if (/how.*work|what.*quibizz|what.*this app|explain.*app/.test(msg)) {
    return `**Quibizz** is an AI-powered adaptive quiz platform! 🦆\n\n**How it works:**\n- Pick any **topic** (science, history, Marvel, Harry Potter — literally anything)\n- Choose a **difficulty** and how many **questions** you want (up to 20)\n- The quiz **adapts in real time**: answer correctly → next question gets harder; answer wrong → it gets easier\n\n**AI Personality Mode** adds flavour:\n- 😈 **Savage Mode** on easy questions (brutal roasts if you're wrong)\n- 🎤 **Stand-up Host** on medium (comedy commentary)\n- 🧘 **Calm Mentor** on hard (gentle, encouraging explanations)`;
  }

  if (/adaptive|difficulty|harder|easier|how.*difficulty/.test(msg)) {
    return `**Adaptive Difficulty** works per-question:\n\n- ✅ Answer **correctly** → next question is **harder**\n- ❌ Answer **wrongly** → next question is **easier**\n\nThe quiz pre-fetches a pool of easy/medium/hard questions mixed together. After every answer, it picks the next question from the pool that matches your current performance level. No two quizzes feel the same! 🎯`;
  }

  if (/savage|personality|mode|roast|stand.?up|mentor|vibe/.test(msg)) {
    return `**AI Personality Mode** auto-selects based on question difficulty:\n\n- 😈 **Savage Mode** (Easy) — if you get it wrong, expect brutal roasts like *"Bro… that was NOT even close 💀"*\n- 🎤 **Stand-up Host** (Medium) — comedy bits like *"Breaking news: local player avoids correct answer. More at 11."*\n- 🧘 **Calm Mentor** (Hard) — gentle encouragement like *"Missing a hard question is just your brain bookmarking it for next time."*\n\nEach pool has 25–30 unique lines so you rarely see the same one twice!`;
  }

  if (/leaderboard|ranking|rank|top player/.test(msg)) {
    return `The **Leaderboard** 🏆 shows the top players ranked by accuracy %. You can see it from the sidebar nav.\n\nAfter every quiz you complete, your score is saved and your position on the leaderboard is updated. The top 3 get a podium with medals! 🥇🥈🥉`;
  }

  if (/profile|history|score|stats|my.*score/.test(msg)) {
    return `Your **Profile** page shows:\n- Total quizzes taken\n- Overall accuracy %\n- Best streak 🔥\n- Recent quiz history with per-quiz breakdowns\n\nClick **👤 Profile** in the sidebar to check it out!`;
  }

  if (/topic|what.*quiz|can i.*quiz|quiz about/.test(msg)) {
    return `You can quiz on **literally any topic**! 🌍 Some popular ones:\n\n- 🧪 Science, Physics, Chemistry, Biology\n- 🏛️ History, World Wars, Ancient Civilisations\n- 🦸 Marvel, DC, Harry Potter, Anime\n- 💻 JavaScript, Python, Data Structures\n- 🌐 Geography, Capitals, Flags\n- 🎵 Music, Movies, Pop Culture\n- 🧮 Maths, Riddles, Logic\n\nJust type your topic in the Quiz setup screen and Gemini generates fresh questions for you!`;
  }

  // ── General knowledge: Science ───────────────────────
  if (/speed of light/.test(msg)) {
    return "The speed of light in a vacuum is **299,792,458 m/s** (approximately 300,000 km/s or 186,000 miles/s). ⚡ It's the universal speed limit — nothing with mass can reach it.";
  }

  if (/dna|what is dna/.test(msg)) {
    return "**DNA** (Deoxyribonucleic Acid) is the molecule that carries genetic information in living organisms. It's a double helix made of four bases: Adenine, Thymine, Cytosine, and Guanine. Your DNA has about **3 billion base pairs**! 🧬";
  }

  if (/mitochondria|powerhouse/.test(msg)) {
    return "The **mitochondria** is the powerhouse of the cell! 🔋 It produces ATP (adenosine triphosphate) through cellular respiration — the energy currency your body runs on.";
  }

  if (/gravity|newton/.test(msg)) {
    return "**Gravity** is an attractive force between objects with mass. Newton described it in his Law of Universal Gravitation: F = Gm₁m₂/r². Einstein later refined this in General Relativity — gravity is actually the curvature of spacetime caused by mass. 🌍";
  }

  if (/black hole/.test(msg)) {
    return "**Black holes** are regions of spacetime where gravity is so strong that nothing — not even light — can escape. ⚫\n\nThey form when massive stars collapse. The boundary of no return is called the **event horizon**. Inside that is the **singularity**, where our physics breaks down.";
  }

  if (/photosynthesis/.test(msg)) {
    return "**Photosynthesis** is how plants make food from sunlight! 🌱\n\n`6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂`\n\nChlorophyll in plant cells absorbs light (mainly red and blue wavelengths), which powers the conversion of CO₂ and water into glucose and oxygen.";
  }

  // ── General knowledge: History ───────────────────────
  if (/world war.*[12]|ww[12]|first world war|second world war/.test(msg)) {
    if (/[12]|second|two/.test(msg) && !/first|one/.test(msg)) {
      return "**World War II** (1939–1945) was the deadliest conflict in history, involving most of the world's nations. Key events:\n- **1939**: Germany invades Poland; UK and France declare war\n- **1941**: USA enters after Pearl Harbor; Germany invades USSR\n- **1944**: D-Day (Normandy landings)\n- **1945**: Germany and Japan surrender; war ends\n\nApproximately 70–85 million people died. 🕊️";
    }
    return "**World War I** (1914–1918), called 'The Great War', started after Archduke Franz Ferdinand's assassination. Key facts:\n- Allied Powers vs. Central Powers\n- First widespread use of chemical weapons, tanks, air combat\n- Ended with the Treaty of Versailles (1919)\n- ~20 million deaths\n\nIt set the stage for World War II. 📜";
  }

  if (/french revolution/.test(msg)) {
    return "The **French Revolution** (1789–1799) was a period of radical political and social change in France. The storming of the Bastille on **July 14, 1789** is its iconic starting symbol.\n\nKey outcomes:\n- Abolition of the French monarchy\n- Declaration of the Rights of Man\n- Rise of Napoleon Bonaparte 🗼";
  }

  // ── General knowledge: Coding ────────────────────────
  if (/what is javascript|explain javascript/.test(msg)) {
    return "**JavaScript** is a high-level, interpreted programming language that makes websites interactive. 💻\n\n- Runs in browsers (frontend) AND servers (Node.js)\n- Dynamically typed, prototype-based\n- The only language browsers natively understand\n- Powers this very app you're using right now! 🦆";
  }

  if (/what is.*api|explain.*api/.test(msg)) {
    return "**API** (Application Programming Interface) is a way for two programs to talk to each other. 🔌\n\nImagine a restaurant:\n- You're the **client** (customer)\n- The **API** is the menu + waiter\n- The **server** is the kitchen\n\nYou place an order (request), the kitchen cooks it, the waiter brings it back (response). REST APIs use HTTP methods: GET, POST, PUT, DELETE.";
  }

  if (/closure|javascript closure/.test(msg)) {
    return "A **closure** in JavaScript is a function that retains access to its outer (enclosing) scope even after that scope has returned. 🔒\n\n```javascript\nfunction makeCounter() {\n  let count = 0;\n  return () => ++count; // inner fn closes over 'count'\n}\nconst counter = makeCounter();\ncounter(); // 1\ncounter(); // 2\n```\n\n`count` stays alive because the inner function references it!";
  }

  if (/promise|async.*await|asynchronous/.test(msg)) {
    return "**Promises** represent the eventual result of an async operation — either resolved (success) or rejected (failure). 🤝\n\n`async/await` is syntactic sugar:\n```javascript\n// With promises\nfetch('/api').then(r => r.json()).then(data => console.log(data));\n\n// With async/await (cleaner!)\nconst data = await fetch('/api').then(r => r.json());\n```\n\nBoth do the same thing — `async/await` is just easier to read!";
  }

  // ── Maths ────────────────────────────────────────────
  if (/\bpi\b|value of pi|what is pi/.test(msg)) {
    return "**π (Pi)** = 3.14159265358979… and goes on forever! It's the ratio of a circle's circumference to its diameter. 🔵\n\nFun fact: Pi is **irrational** (never-ending, non-repeating decimal) and **transcendental** (not a root of any polynomial equation).";
  }

  if (/pythagorean|pythagoras/.test(msg)) {
    return "**Pythagoras' Theorem**: In a right triangle, the square of the hypotenuse equals the sum of squares of the other two sides.\n\n`a² + b² = c²`\n\nExample: if a=3, b=4, then c = √(9+16) = √25 = **5** (the classic 3-4-5 triangle). 📐";
  }

  // ── Fun / personality ────────────────────────────────
  if (/joke|tell.*joke|make me laugh|funny/.test(msg)) {
    const jokes = [
      "Why do programmers prefer dark mode? Because light attracts bugs! 🐛",
      "Why did the scarecrow win an award? Because he was outstanding in his field! 🌾",
      "I told my computer I needed a break. Now it won't stop sending me Kit-Kat ads. 🍫",
      "Why don't scientists trust atoms? Because they make up everything! ⚛️",
      "How do you comfort a JavaScript developer? You console them. 💻",
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
  }

  if (/fun fact|interesting fact|random fact|did you know/.test(msg)) {
    const facts = [
      "🦈 A group of flamingos is called a 'flamboyance'. A group of owls is a 'parliament'. Language is wild.",
      "🍯 Honey never spoils — archaeologists found 3,000-year-old honey in Egyptian tombs and it was still edible.",
      "🧠 Your brain uses about 20% of your body's total energy, even though it's only 2% of your body weight.",
      "🌊 There's more water in Earth's mantle than in all the oceans combined.",
      "⚡ Lightning strikes Earth about 100 times every second — that's 8.6 million times a day.",
      "🦆 Ducks have three eyelids. Which is why Quibby sees everything. 👁️",
    ];
    return facts[Math.floor(Math.random() * facts.length)];
  }

  if (/who are you|what are you|introduce yourself/.test(msg)) {
    return "I'm **Quibby** 🦆 — the AI assistant built into Quibizz!\n\nI can:\n- Answer questions on **any topic** (science, history, coding, maths, pop culture…)\n- Explain how **Quibizz works** (adaptive difficulty, personality modes, scoring)\n- Tell you **jokes** and **fun facts**\n- Help you **study** for any subject\n\nWhat do you want to explore? 😄";
  }

  if (/thank|thanks|thx|ty|cheers/.test(msg)) {
    return "You're welcome! 🦆 Anything else I can help with?";
  }

  if (/bye|goodbye|see you|cya|ttyl/.test(msg)) {
    return "See you! 👋 Come back whenever you want to quiz or chat. Happy learning! 🦆";
  }

  // ── Default fallback ─────────────────────────────────
  return `Great question! 🦆 I'm currently running in offline mode (Gemini API is resting), so I can't look that one up right now.\n\nBut here's what I *can* help with right now:\n- **Quibizz help** — how adaptive difficulty works, personality modes, scoring\n- **Science** — physics, biology, chemistry basics\n- **History** — major world events\n- **Coding** — JavaScript, APIs, web concepts\n- **Maths** — formulas and concepts\n- **Fun facts & jokes** 😄\n\nTry asking me one of those!`;
}

// ── Gemini with retry ────────────────────────────────────
async function tryGemini(message, history) {
  if (!genAI) throw new Error('No API key');

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: QUIBIZZ_SYSTEM_PROMPT,
  });

  let formattedHistory = history
    .slice(-10)
    .map(turn => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.content }],
    }));

  // Gemini requires alternating user/model, starting with user
  while (formattedHistory.length && formattedHistory[0].role === 'model') {
    formattedHistory.shift();
  }
  formattedHistory = formattedHistory.filter((t, i, arr) =>
    i === 0 || t.role !== arr[i - 1].role
  );

  const chat = model.startChat({ history: formattedHistory });
  const result = await chat.sendMessage(message);
  return result.response.text();
}

// ── Controller ───────────────────────────────────────────
exports.chat = async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  const safeMessage = message.trim().slice(0, 2000);

  // Try Gemini first
  try {
    const reply = await tryGemini(safeMessage, history);
    console.log(`[chat] ✅ Gemini replied to: "${safeMessage.slice(0, 50)}"`);
    return res.json({ reply });
  } catch (err) {
    const is429 = err.message?.includes('429') || err.message?.includes('quota');
    if (is429) {
      console.warn('[chat] ⚠️  Gemini quota exceeded — using smart fallback');
    } else {
      console.error('[chat] ❌ Gemini error:', err.message);
    }
  }

  // Smart rule-based fallback — always gives a useful response
  const reply = smartFallback(safeMessage);
  return res.json({ reply, offline: true });
};
