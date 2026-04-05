# 🦆 Quibizz

> AI-powered adaptive quiz platform with dynamic question generation, real-time feedback, and performance analytics.

## Project Structure

```
Quibizz/
├── frontend/               # SPA (HTML + CSS + JS)
│   ├── index.html          # App entry point — open this in browser
│   ├── css/
│   │   ├── main.css        # Design tokens, global styles
│   │   ├── components.css  # Screen & component styles
│   │   └── animations.css  # Duck animations, effects
│   ├── js/
│   │   ├── app.js          # App bootstrap & event wiring
│   │   ├── api.js          # Backend API calls
│   │   ├── quiz.js         # Quiz state machine
│   │   └── ui.js           # DOM manipulation helpers
│   └── assets/
│       └── duck.svg        # Duck mascot
│
└── backend/                # Node.js + Express + Gemini API
    ├── server.js           # Entry point  →  PORT 3001
    ├── package.json
    ├── .env.example        # Copy to .env and add your key
    ├── routes/
    │   ├── quiz.js         # POST /api/quiz/generate, /validate
    │   └── health.js       # GET  /api/health
    ├── controllers/
    │   └── quizController.js
    └── services/
        └── geminiService.js  # Gemini 1.5 Flash integration
```

## Quick Start

### 1. Set up the backend

```bash
cd backend
npm install

# Copy the env template and add your Gemini API key
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=your_key_here
# Get a free key at https://aistudio.google.com/app/apikey

npm start         # production
# OR
npm run dev       # development (auto-reload with nodemon)
```

### 2. Open the frontend

Since the frontend is plain HTML/CSS/JS with ES modules, you need to serve it via a local server (required for ES module imports):

```bash
# Option A: Python (usually already installed)
cd frontend && python3 -m http.server 3000

# Option B: Node http-server
npx http-server frontend -p 3000

# Option C: VS Code Live Server extension
# Right-click frontend/index.html → "Open with Live Server"
```

Then open **http://localhost:3000** in your browser.

## API Reference

| Method | Endpoint              | Body                               | Description                  |
|--------|-----------------------|------------------------------------|------------------------------|
| GET    | /api/health           | —                                  | Check server & API key status |
| POST   | /api/quiz/generate    | `{ topic, difficulty, count }`     | Generate quiz questions       |
| POST   | /api/quiz/validate    | `{ question, selectedIndex }`      | Validate a single answer      |

## Features

- 🦆 Cute animated duck mascot (happy/sad reactions)
- ✨ AI question generation via Gemini 1.5 Flash
- 🎯 Three difficulty levels (Easy / Medium / Hard)
- 📊 Score ring + per-question breakdown on results
- 🎉 Confetti on high scores
- 💡 Instant explanations after each answer
- 🌙 Dark mode glass-morphism design
