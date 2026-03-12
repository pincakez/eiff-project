# EiFF Project — English is F#!%ing Fun 🎉

> A vocabulary learning web app for Arabic-speaking students.  
> Students study English words with Arabic (MSA) and Egyptian dialect translations,  
> then take timed quizzes to unlock progress chapter by chapter.

---

## ⚠️ CRITICAL WARNING — READ BEFORE TOUCHING ANYTHING

```
🚨 DO NOT open, read, analyze, or include js/data-sector1A.js in any context window.

The file is 153,434+ characters of raw vocabulary data (vocabData object).
It will consume the entire token budget and contribute NOTHING to debugging or logic.

The vocabData object is already loaded globally via ES module import on every page.
Just trust that vocabData[chapter][level] = [ { en, ar, eg }, ... ] works.
Treat it as a black box. Never analyze it.
```

---

## 🗂️ Project Structure

```
d:\testarea\
│
├── index.html          # Landing page + Firebase Auth (sign in / sign up)
├── dashboard.html      # Level selection grid — chapters 1–10, levels 1–6 each
├── study.html          # Vocabulary study table for a specific chapter+level
├── quiz.html           # Quiz shell (HTML only, logic in quiz.js)
├── admin.html          # Admin Command Center (login: sudo / 239995)
├── leaderboard.html    # Leaderboard page (WIP)
│
├── js/
│   ├── firebase-config.js   # All Firebase logic + exported functions
│   ├── quiz.js              # Full quiz engine (level, master, grand types)
│   ├── auth-ui.js           # showToast() helper + auth form logic
│   ├── mesh-wave.js         # Background animation on landing page
│   └── data-sector1A.js     # ⚠️ VOCAB DATA — DO NOT ANALYZE (153k chars)
│
├── css/
│   └── style.css            # Single stylesheet for the entire app
│
└── assets/                  # Logo, favicon, images
```

---

## 🔥 Firebase Setup

- **Project ID:** `eiff-project`
- **Auth:** Email/Password (Firebase Authentication)
- **Database:** Firestore (primary data store)
- **SDK Version:** 12.9.0 (loaded via CDN URLs)
- **Analytics:** Removed (was useless, now gone)

### Firestore Collections

```
users/{uid}
  ├── displayName       string
  ├── email             string
  ├── unlockedLevel     number   # 1–60  (global level index)
  ├── unlockedChapter   number   # 1–10  (unlocked after passing Master Quiz)
  ├── lastAttempt       timestamp | null   # null = not locked
  ├── lastSeen          timestamp
  └── createdAt         timestamp

users/{uid}/attempts/{autoId}     # subcollection — one doc per quiz taken
  ├── type              'level' | 'master' | 'grand'
  ├── chapter           number
  ├── level             number
  ├── score             number
  ├── total             number
  ├── passed            boolean
  ├── wrongCount        number
  ├── pct               number   # 0–100
  └── timestamp         timestamp

config/quiz                       # Global settings (written by admin panel)
  ├── timeLimit         number   # seconds per question (default 8)
  ├── maxMistakesLevel  number   # ejection threshold level quiz (default 2)
  └── maxMistakesMaster number   # ejection threshold master quiz (default 3)
```

### Required Firestore Security Rules

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      allow read: if true;  // admin panel reads all users
    }
    match /users/{uid}/attempts/{attemptId} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      allow read, write: if true;  // admin panel
    }
    match /config/{doc} {
      allow read, write: if true;  // quiz.js reads, admin writes
    }
  }
}
```

---

## 📐 Data Model — Levels & Chapters

```
Global Level = (chapter - 1) * 6 + localLevel

Chapter 1: levels 1–6   → global levels  1–6
Chapter 2: levels 1–6   → global levels  7–12
...
Chapter 10: levels 1–6  → global levels 55–60

vocabData[chapter][level] = array of word objects
Each word: { en: "word", ar: "كلمة", eg: "كلمة بالعامية" }
```

---

## 🎮 Quiz System

### Types
| Type | Questions | Pass Rate | Mistake Limit | Timer |
|------|-----------|-----------|---------------|-------|
| `level` | 10 | 9/10 (90%) | 2 wrong = ejected | ✅ 8 sec (configurable) |
| `master` | 50 | 48/50 (96%) | 3 wrong = ejected | ❌ No timer |
| `grand` | 250 | 240/250 (96%) | — | ❌ No timer |

### Quiz Flow
```
Study page → Warning modal → quiz.html?type=level&chapter=X&level=Y
  → Pass level 6 of chapter → quiz.html?type=master&chapter=X
    → Pass master quiz → chapter X+1 unlocked
```

### Lockout System
- **On quiz start:** `lastAttempt` = now (12-hour lockout begins)
- **On PASS:** `lastAttempt` = null (lockout immediately cleared)
- **On FAIL / ejection:** Lockout stays. Student waits 12 hours.
- Lockout countdown is shown live on the study page button.

### Ejection Modal (GET OUT LOOSER)
- Fires when wrong answer limit is hit (2 for level, 3 for master)
- Dark red modal, skull emoji, pulsing "YES I AM" button
- Redirects to `study.html?chapter=X&level=Y`

### Master Quiz Guarantee
- `buildMasterQuizWords(ch)` always returns exactly 50 questions
- If word pool < 50, it cycles through shuffled passes until 50 is reached
- This handles chapters with partial data gracefully

### Global Config (Admin-controlled, live)
- On quiz page load, `getGlobalConfig()` is called from Firestore
- `timeLimit`, `maxMistakesLevel`, `maxMistakesMaster` override JS defaults
- Changes in admin panel take effect on next quiz page load — no deploy needed

---

## 🖥️ Admin Panel — `/admin.html`

**Login:** username `sudo`, password `239995` (sessionStorage, clears on tab close)

### Features
| Section | What it does |
|---------|-------------|
| **Dashboard** | Total students, locked count, recent activity table |
| **Students** | Searchable table of all users; quick lock/unlock buttons |
| **Student Detail Modal** | Full quiz history (last 30 attempts), force-set level/chapter, remove or apply lockout |
| **Global Config** | Sliders for timer (2–20s) and mistake limits → saves to Firestore config/quiz |

### Firebase Functions Used by Admin (all in firebase-config.js)
- `getAllUsers()` — reads entire `users` collection
- `getUserAttempts(uid)` — reads `users/{uid}/attempts` subcollection
- `clearLockout(uid)` — sets `lastAttempt: null`
- `lockUser(uid)` — sets `lastAttempt: serverTimestamp()` (triggers 12h lockout)
- `setUserLevel(uid, level)` — force-writes `unlockedLevel`
- `setUserChapter(uid, chapter)` — force-writes `unlockedChapter`
- `getGlobalConfig()` / `setGlobalConfig(config)` — reads/writes `config/quiz`

---

## 🎨 Design System

- **Font:** Inter (UI) + Cairo (Arabic text, RTL)
- **Mode:** Light mode (main app) / Dark navy mode (master quiz + admin panel)
- **Master quiz page:** `body.master-quiz-active` class → full dark navy theme (#0f0f1a)
- **CSS file:** Single `css/style.css` — all quiz, dashboard, study, modal styles here

### Key CSS Classes
| Class | Purpose |
|-------|---------|
| `.quiz-card--master` | Dark navy card for master quiz questions |
| `.quiz-result-card--master` | Dark result screen for master quiz |
| `.master-card` | Gold-bordered Master Quiz card in dashboard grid |
| `.choice-ar` | Arabic answer text (Cairo 800, 1.25rem) |
| `.choice-eg` | Egyptian dialect text (Cairo 600, dark grey #5f6368) |
| `.timer-wrapper` | 8-second countdown bar (green→yellow→red) |
| `.looser-modal` | GET OUT LOOSER ejection modal (dark red) |
| `.btn-looser` | Pulsing red ejection confirmation button |
| `.chapter-unlock-msg` | Green pill shown when master quiz unlocks next chapter |

---

## 📦 Exported Functions — `js/firebase-config.js`

```js
// Auth
eiffSignUp(email, password, displayName)
eiffSignIn(email, password)
eiffSignOut()

// User data
getUserData(uid)          → { unlockedLevel, unlockedChapter, lastAttempt, ... }
getAllUsers()              → [{ uid, ...data }, ...]

// Progress
unlockNextLevel(uid, currentLevel)
unlockNextChapter(uid, currentChapter)
setUserLevel(uid, level)        // admin force-set
setUserChapter(uid, chapter)    // admin force-set

// Lockout
logQuizAttempt(uid)       // starts 12h lockout
checkLockout(uid)         → { isLocked: bool, timeLeftMs: number }
clearLockout(uid)         // clears on pass
lockUser(uid)             // admin force-lock

// Quiz stats
logQuizResult(uid, { type, chapter, level, score, total, passed, wrongCount, pct })
getUserAttempts(uid)      → last 30 attempt docs

// Global config
getGlobalConfig()         → { timeLimit, maxMistakesLevel, maxMistakesMaster }
setGlobalConfig(config)   // admin writes
```

---

## 🚧 Known Limitations / Future Ideas

- **No real-time presence** — online/offline status not implemented (would need Firebase Realtime Database + `.onDisconnect()`)
- **Leaderboard** — `leaderboard.html` exists but is not fully wired
- **Grand Quiz** — logic exists in `quiz.js` (`buildGrandQuizWords`) but no UI entry point yet
- **Firestore rules** — currently may be in test mode (allow all). Update rules before going live with students.
- **Admin security** — password is client-side only. Fine for a classroom tool, not for production.

---

## 🛠️ Dev Server

```powershell
cd d:\testarea
npx serve
# Serves at http://localhost:3000
```

---

*Built session by session with Antigravity AI — March 2026*
