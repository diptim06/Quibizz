# Quibizz – AI Quiz Generator System

Quibizz is an intelligent web-based quiz application that generates dynamic questions using AI and adapts difficulty based on user performance. It enhances learning through real-time feedback, leaderboard tracking, and an integrated chatbot for explanations.

---

## Features

* AI-based question generation using Gemini API
* Adaptive difficulty based on user performance
* Leaderboard system for ranking users
* User dashboard with score tracking and history
* Chatbot for explanations and assistance
* Logging system for tracking user activity
* Clean and interactive user interface

---

## Tech Stack

Frontend:

* HTML, CSS, JavaScript

Backend:

* Node.js

Database:

* MongoDB

AI Integration:

* Gemini API

---

## How It Works

1. User selects topic, difficulty, and number of questions
2. System sends request to AI model
3. AI generates quiz questions dynamically
4. User answers questions
5. System evaluates responses
6. Difficulty adjusts based on performance
7. Results are displayed on dashboard and leaderboard

---

## Project Structure

```
/frontend
/backend
```

---

## Installation

```
git clone https://github.com/diptim06/Quibizz.git
cd Quibizz
npm install
npm start
```

---

## Environment Variables

Create a `.env` file:

```
GEMINI_API_KEY=your_api_key
MONGODB_URI=your_database_url
```

---

## Example Output

Score: 4 / 5
Performance: Good
Suggestion: Improve weak topics

---

## Limitations

* Depends on AI-generated responses
* Requires internet connection
* Output may vary based on prompts

---

## Future Scope

* Mobile application
* Gamification features (badges, streaks)
* Advanced personalization
* Integration with learning platforms

---

## Author

Dipti

---

## License

For academic and learning purposes.

