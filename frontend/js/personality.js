/* ══════════════════════════════════════════════════════════════
   Quibizz — AI Personality Engine
   Auto-selects personality based on question difficulty:
     easy   → 😈 Savage Mode
     medium → 🎤 Stand-up Host
     hard   → 🧘 Calm Mentor
   ══════════════════════════════════════════════════════════ */

/* ── 😈 Savage Mode — Easy questions, WRONG ──────────────── */
const SAVAGE_WRONG = [
  "Bro… that was NOT even close 💀",
  "This was literally an EASY question and you still fumbled 😭",
  "My grandma would've gotten that. She's been dead for 10 years. 💀",
  "You just failed a question that a 5-year-old aced yesterday. Impressive.",
  "The answer was RIGHT THERE and you still walked away from it 🤦",
  "That answer was so wrong it looped back around… and was still wrong.",
  "Deleting your quiz history rn out of respect for you 🙏",
  "Are you speed-running a fail-% run? Because it's working brilliantly.",
  "That was so confidently wrong. The audacity. The AUDACITY. 💀",
  "Sir/Ma'am the exit is to your left. The correct answer was to your brain.",
  "I've seen better guesses from a random number generator. No cap.",
  "You chose literally the most wrong option available. Talent, honestly.",
  "Not even *close*. Not even in the same zip code as correct. 🗺️",
  "Oof. OOF. I felt that second-hand embarrassment from here. 😬",
  "The correct answer was literally staring at you. You looked away. 👁️",
  "This is giving 'studied the wrong chapter' energy fr fr 📚",
  "I'm not mad. I'm just... profoundly disappointed. 😔",
  "You picked that like it was a snack at a party. It was NOT the snack. 🍿",
  "That answer committed no crimes and you still sent it to jail. 🚔",
  "Even autocorrect wouldn't have done that to you. Yikes bro.",
  "The confidence to get that wrong should be studied by scientists. 🔬",
  "You answered faster than you thought. That was the problem. ⏱️",
  "Buddy. BUDDY. Look at me. That was the tutorial. 😭",
  "I actually gasped. Out loud. In front of everyone. 😮",
  "That wrong answer had no survivors. Including your dignity. 💀",
  "Did you even read the question? Be honest. Did you? 👀",
  "I'm writing this down. This goes in the hall of shame. 📝",
  "You played yourself. Professionally. Without even trying. 🎭",
  "That was so wrong the correct answer changed just to get away from yours. 😂",
  "Imagine explaining this to your parents. Go on. Imagine it. 👨‍👩‍👧",
];

/* ── 😈 Savage Mode — Easy questions, CORRECT ───────────── */
const SAVAGE_RIGHT = [
  "Ok fine... you barely survived that one. It WAS easy though 🙄",
  "Wow, you got the easy one. Award yourself a participation trophy. 🏅",
  "That was literally the tutorial level. But hey… you passed it. Barely.",
  "Even a broken clock is right twice a day. Today is your day. 🕐",
  "Don't get too comfortable. That was the baby mode question. 😏",
  "Yes, correct. We set the bar on the floor and you STEPPED OVER IT. Growth!",
  "You got it!! ...it was easy but shhhh we celebrate wins here. 🎉",
  "One correct answer won't save your reputation but it's a start 💅",
  "Oh wow look at you knowing an easy fact. A STAR IS BORN. ⭐... maybe.",
  "Right answer! The duck is... mildly impressed. MILDLY. 🦆",
  "Ok ok ok. You got it. Don't let it go to your head. It won't fit. 💆",
  "That's correct! Shocking, truly shocking. But correct. ✅",
  "Nail it on the easy ones, crumble on the hard ones — classic you. 😂",
  "Correct! I mean... it wasn't hard. But you got it so. Clap clap 👏",
  "Right answer. The bar was underground and you cleared it. Barely. 🥂",
  "Honestly expected you to fumble this too so congrats on the surprise. 🎁",
  "Correct. Now don't you dare get cocky about an easy question. 🫵",
  "You got one right! Quick, take a screenshot before it happens again. 📸",
];

/* ── 🎤 Stand-up Mode — Medium questions, WRONG ─────────── */
const STANDUP_WRONG = [
  "Plot twist: that answer was wrong! Nobody saw that coming (we all did) 🎭",
  "You know what, I respect the confidence. Wrong, but CONFIDENT. 🎤",
  "You picked that answer like it owed you money. It did not. 💸",
  "That was a creative choice. Not a *correct* choice, but creative. 🎨",
  "Somewhere out there, the correct answer is sitting alone wondering why you didn't pick it 😂",
  "Breaking news: local player avoids correct answer for second time. More at 11. 📺",
  "Bold strategy. Let's see if it pays off. *checks notes* it did not. 📋",
  "The audacity to get that wrong while looking so confident. Iconic behavior. 🫠",
  "Your brain said 'that one!' and your hand agreed. Together they were wrong. 🤝",
  "I've seen people guess correctly on coin flips more often. Coins don't have brains. 🪙",
  "You and the correct answer were this close 🤏 ...and then you went the other way.",
  "Wrong! But delivered with such effortless grace that I can't even be mad 😌",
  "That answer was like a pizza with no cheese. Technically food, something is very wrong. 🍕",
  "That's NOT it chief 😭 but the spirit was there!",
  "Ladies and gentlemen, we've found the one person who got this wrong. Give 'em a round! 👏",
  "You chose violence. Against yourself. And the quiz. And me. 💣",
  "That answer walked so the wrong answer could run. Into a wall. 🏃",
  "I love when people pick the trap option. Didn't even hesitate. That's character. 🎪",
  "So close, yet so geographically distant from correct. 🌍",
  "The correct answer was RIGHT THERE having a great time and you ghosted it. 👻",
  "That was the kind of wrong that makes the question feel bad for asking. 😢",
  "You just answered a different question. From a different quiz. On a different app. 📱",
  "There's a 25% chance of guessing right and you found the 75%. Statistically impressive. 🎲",
  "Wrong, but honestly? The feral confidence carried it. 🦁",
  "Plot twist of the century: it wasn't the one you picked. I know. Shocking. 🎬",
  "The correct answer has filed a restraining order against your cursor. 📄",
  "You said that answer with your whole chest and your whole chest was wrong. 💪❌",
  "Somewhere a trivia champion just flinched and they don't know why. 👁️",
  "The answer you chose: very brave. Very wrong. But very brave. 🫡",
  "Ok so you skipped a step. Like 4 steps. And the destination. 🗺️",
];

/* ── 🎤 Stand-up Mode — Medium questions, CORRECT ───────── */
const STANDUP_RIGHT = [
  "CORRECT! The crowd goes absolutely mental!! 🎤🎉",
  "Nailed it! The duck is vibing rn 🦆✨",
  "YES! That's the one! Take a bow, you've earned it 🙇",
  "Correct! I'd have a drumroll but I already spent my budget on jokes 🥁",
  "You got it right on the FIRST try! Unlike most of my stand-up sets. 🎭",
  "Genius level play right there. Medium difficulty. HANDLED. 💪",
  "Is it the correct answer? Yes! Are you surprised or were you cooking? 🍳",
  "BOOM. Right answer, right energy. You're on fire! 🔥",
  "Correct! And done with style. Whatever you're doing, keep doing it. ✨",
  "I didn't expect that from you and I mean that in the BEST way. 🎊",
  "RIGHT! Give yourself a little shimmy. You've earned it. 🕺",
  "Correct! The duck has entered its happy era. 🦆🎶",
  "Look at you go! Medium difficulty and you didn't even sweat. Respect. 😤",
  "Behold: someone who did their homework. Rare. Beautiful. 🦋",
  "That was the correct answer and you KNEW it. I could tell. You had that look. 👀",
  "Pop off!! Correct answer with energy to spare!! 🎆",
  "Nailed it like a carpenter on their best day. 🔨✅",
  "RIGHT and we're moving ON because that's just how the pros do it. 😎",
  "One for the highlight reel! Correct answer activated! 🎥",
  "That answer just walked into the room like it owned the place. Because it did. 🚪",
];

/* ── 🧘 Calm Mentor Mode — Hard questions, WRONG ───────── */
const MENTOR_WRONG = [
  "That was a tough one — don't sweat it. Even experts get tripped up here 🧘",
  "Hard questions are designed to challenge you. You're learning by seeing the answer now. 💡",
  "Wrong this time, but that's how deep knowledge gets built. One layer at a time. 🌱",
  "No worries — this concept trips up a lot of people. Read the explanation and it'll click. ✨",
  "Hard difficulty means it's supposed to be hard. You saw it, now you know it. 📚",
  "Missing a hard question is just your brain bookmarking it for next time. 🔖",
  "That's genuinely difficult material. Take a moment to absorb the explanation. 🧠",
  "The gap between where you are and where you want to be is exactly what learning is made of. 🌟",
  "Not quite — but you now know the correct answer, which means you're already better than a minute ago. ⏱️",
  "This kind of question rewards careful study. You'll get it next time. 💪",
  "Every expert was once where you are right now. Keep going. 🚀",
  "Take a breath. This is hard-level material for a reason. The explanation below will help. 📖",
  "A wrong answer to a hard question is still a learning opportunity. That's the whole point. 🎯",
  "Don't be discouraged. The fact that you're tackling hard questions at all is the real win. 🏅",
  "Mistakes at this level are how mastery gets built. You're on the right track. 🛤️",
  "Hard questions are where growth lives. You're exactly where you need to be. 🌿",
  "This one's tricky — even people who know the topic well sometimes get it wrong. 🧩",
  "Knowledge isn't about never being wrong — it's about understanding why after. 💫",
  "Wrong answer, valuable lesson. That's a trade worth making. 📈",
  "Think of each hard question you miss as a brick you're laying toward expertise. 🧱",
  "It's okay. Learning this took people years — you're compressing that into minutes. ⚡",
  "The correct answer surprised you — that surprise is knowledge sticking. 🌊",
  "You gave it a genuine try on a hard question. That matters more than you think. 🤍",
  "Struggle is just learning in disguise. Read the explanation slowly. 🔍",
  "Hard questions exist to show you your frontier. Now you know where to go next. 🧭",
];

/* ── 🧘 Calm Mentor Mode — Hard questions, CORRECT ─────── */
const MENTOR_RIGHT = [
  "Excellent! That was genuinely hard and you nailed it. Well done 🌟",
  "Impressive — hard difficulty, correct answer. Your knowledge runs deep. 🧠",
  "That's the kind of answer that comes from real understanding. Beautifully done. ✨",
  "Hard question, perfect answer. You should be proud of yourself. 🏆",
  "Outstanding! This is the level of knowledge that sets you apart. 💎",
  "You made that look effortless. It wasn't easy — you're just that good. 🌙",
  "Correct, and at hard difficulty no less. The duck bows in respect. 🦆🙏",
  "That's a deeply impressive answer. You've clearly studied this well. 📚",
  "Right on target. Hard questions can't stop someone who's well-prepared. 🎯",
  "Brilliant! Keep that energy — you're operating at a high level today. ⭐",
  "That answer required real depth of knowledge and you delivered it. Remarkable. 🔬",
  "This is what mastery looks like. Take a moment to appreciate what you just did. 🌸",
  "Not many people get this one right. You're clearly among the few who truly know this. 👁️",
  "Hard difficulty. Correct answer. Delivered calmly. Truly impressive composure. 🎖️",
  "You didn't just guess — you *knew*. That's the difference. That's expertise. 🌠",
  "Knowledge like this takes time to build. You've clearly put in that time. 🕰️",
  "That was a test of genuine understanding and you passed it beautifully. 🌺",
  "Exceptional. I'm genuinely proud of that answer. 💙",
  "Correct — and it shows. You're not just memorizing, you're understanding. 🧬",
  "That's the kind of answer that earns respect in any room. Well played. 🤝",
];

/* ── Personality selector ────────────────────────────────── */

export function getPersonalityMode(difficulty) {
  if (difficulty === 'easy')   return 'savage';
  if (difficulty === 'medium') return 'standup';
  return 'mentor';
}

export function getPersonalityMeta(mode) {
  return {
    savage:  { emoji: '😈', label: 'Savage Mode',   color: 'savage'  },
    standup: { emoji: '🎤', label: 'Stand-up Host', color: 'standup' },
    mentor:  { emoji: '🧘', label: 'Calm Mentor',   color: 'mentor'  },
  }[mode];
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getPersonalityComment(difficulty, isCorrect) {
  const mode = getPersonalityMode(difficulty);
  const meta = getPersonalityMeta(mode);

  let line;
  if (mode === 'savage') {
    line = isCorrect ? pick(SAVAGE_RIGHT)  : pick(SAVAGE_WRONG);
  } else if (mode === 'standup') {
    line = isCorrect ? pick(STANDUP_RIGHT) : pick(STANDUP_WRONG);
  } else {
    line = isCorrect ? pick(MENTOR_RIGHT)  : pick(MENTOR_WRONG);
  }

  return { mode, meta, line };
}
