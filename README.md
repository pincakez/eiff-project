# EiFF Project — English is F#!%ing Fun 📚

## 🚀 Overview

The **EiFF Project** (English is F#!%ing Fun) is a comprehensive English teaching "Super Method" designed by **Mohamed Yakot**. It focuses on helping learners master **3,300 English vocabulary words** through a unique approach that includes translations into both formal Arabic and the Egyptian dialect.

## ✨ Key Features

- **3,300 Words**: A massive database of curated vocabulary.
- **Hierarchical Learning**: Content is organized into **10 Chapters**, with **6 Levels** per chapter (50 words each).
- **Gamified Progression**: Locked levels that only open when you pass a quiz with an **80% or higher score**.
- **Dual Translations**: Provides both Standard Arabic (Fusha) and Egyptian Arabic (Ammiya) translations.
- **Audio Support**: Integrated Text-to-Speech (TTS) to hear correct English pronunciation.
- **User Progress**: Real-time progress tracking and cloud-based authentication via Firebase.

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, and JavaScript (ES6+ Modules).
- **Styling**: Custom CSS with a modern, responsive design and smooth animations.
- **Backend / Auth**: [Firebase](https://firebase.google.com/) (Authentication & Firestore).
- **Fonts**: Inter, Cairo, and Pacifico (via Google Fonts).

## 📂 Project Structure

```text
├── assets/             # Images, logos, and icons
├── css/
│   └── style.css       # Core design system and component styles
├── js/
│   ├── auth-ui.js      # Auth UI logic, splash screen, and toast notifications
│   ├── data-sector1A.js # The primary vocabulary database
│   └── firebase-config.js # Firebase initialization and database interactions
├── index.html          # Landing page with Sign In / Sign Up
├── dashboard.html      # Level selection and progress tracking
├── study.html          # Interactive study table with TTS
└── quiz.html           # Level assessment and unlocking logic
```

## 📖 How to Use

1.  **Register/Login**: Start by creating an account on the landing page.
2.  **Dashboard**: View your current progress and select an unlocked level.
3.  **Study**: Review the words for your chosen level. You can listen to the pronunciation of individual words or the entire list.
4.  **Quiz**: Once confident, start the quiz. You'll be tested on 10 random words from the level.
5.  **Unlock**: Score 8/10 or better to unlock the next level and continue your journey!

## 🔧 Setup & Configuration

To run this project locally:

1.  Clone or download the repository.
2.  Open `js/firebase-config.js` and replace the placeholder configuration with your own Firebase project credentials.
3.  Serve the files using a local development server (e.g., VS Code Live Server).

## 👤 Credits

Developed and designed by **Mohamed Yakot**, a self-taught learner who quit school at 18 to follow his own path.

---

_V1.1 - 2026/2018_
