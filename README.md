# EiFF Project — English is F#!%ing Fun 🎉

> A vocabulary learning web app for Arabic-speaking students.  
> Students study English words with Arabic (MSA) and Egyptian dialect translations,  
> then take timed quizzes to unlock progress chapter by chapter.

---

## ⚠️ CRITICAL WARNINGS — READ BEFORE TOUCHING ANYTHING

```
🚨 RULE 1: DO NOT open, read, analyze, or include js/data-sector1A.js in any context window.
The file is 153,434+ characters of raw vocabulary data (vocabData object).
It will consume the entire token budget and contribute NOTHING to debugging or logic.
The vocabData object is already loaded globally via ES module import on every page.
Just trust that vocabData[chapter][level] = [ { en, ar, eg }, ... ] works.
Treat it as a black box. Never analyze it.

🚨 RULE 2: LIVE DEPLOYMENT WARNING (GitHub Pages)
The user reviews their changes on: https://pincakez.github.io/eiff-project/
Modifying local files in 'C:\Users\pinca\Desktop\testarea' is NOT enough for them to see it!
Any changes you make locally MUST be committed and pushed to the GitHub repository so 
GitHub Pages can build and deploy the updates.
Always run 'git add . ; git commit -m "..." ; git push' when you finish a task, 
then wait ~60 seconds for the deploy to complete.
```

---

## 🗂️ Project Structure

```
testarea\
│
├── index.html          # Landing page + Firebase Auth (sign in / sign up)
├── dashboard.html      # Level selection grid — chapters 1–10, levels 1–6 each + Grand Quiz card
├── study.html          # Vocabulary study table for a specific chapter+level
├── quiz.html           # Quiz shell (HTML only, logic in quiz.js)
├── admin.html          # Admin Command Center (login: sudo / Mashakel#2)
├── plan.md             # Implementation plan
├── status.md           # Task completion tracker
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

### Firestore Collections

```
users/{uid}
  ├── displayName       string
  ├── email             string
  ├── unlockedLevel     number   # 1–60  (global level index)
  ├── unlockedChapter   number   # 1–10  (unlocked after passing Master Quiz)
  ├── lastAttempt       timestamp | null   # null = not locked
  ├── lastSeen          timestamp
  ├── createdAt         timestamp
  ├── loginHistory[]    number[]  # array of Date.now() timestamps
  │                               # (Date.now() intentional — serverTimestamp not allowed in arrays)
  └── messages[]        object[]  # admin-sent messages with read/unread state

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
  ├── maxMistakesMaster number   # ejection threshold master quiz (default 3)
  └── penaltyHours      number   # lockout duration in hours (default 12)
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

> ⚠️ **Update these rules before going live with students.**

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
      → Pass ALL 10 chapters → Grand Quiz card appears on dashboard
```

### Lockout System
- **On quiz start:** `lastAttempt` = now (lockout duration = `penaltyHours` from config)
- **On PASS:** `lastAttempt` = null (lockout immediately cleared)
- **On FAIL / ejection:** Lockout stays. Student waits `penaltyHours`.
- Lockout countdown is shown live on the study page button.

### Ejection Modal (GET OUT LOOSER)
- Fires when wrong answer limit is hit
- Message **dynamically reflects** the actual mistake limit for the quiz type
- Dark red modal, skull emoji, pulsing "YES I AM" button
- Redirects to `study.html?chapter=X&level=Y`

### Master Quiz Guarantee
- `buildMasterQuizWords(ch)` always returns exactly 50 questions
- If word pool < 50, it cycles through shuffled passes until 50 is reached

### Grand Quiz Entry Point
- A **🌟 GRAND QUIZ** card appears on the dashboard when `unlockedLevel >= 60`
- Links to `quiz.html?type=grand`
- 250 questions, no timer, no mistake limit, 96% pass rate required

### Global Config (Admin-controlled, live)
- On quiz page load, `getGlobalConfig()` is called from Firestore
- `timeLimit`, `maxMistakesLevel`, `maxMistakesMaster`, `penaltyHours` override JS defaults
- Changes in admin panel take effect on next quiz page load — no deploy needed

---

## 🖥️ Admin Panel — `/admin.html`

**Login:** username `sudo`, password `Mashakel#2` (sessionStorage, clears on tab close)

### Features
| Section | What it does |
|---------|-------------|
| **Dashboard** | Total students, locked count, recent activity table |
| **Students** | Searchable table of all users; quick lock/unlock buttons |
| **Student Detail Modal** | Full quiz history (last 30 attempts), force-set level/chapter, remove or apply lockout, **edit profile**, send message |
| **Global Config** | Sliders for timer (2–20s), mistake limits, penalty hours → saves to Firestore config/quiz |

### Edit Profile (V1.5)
Inside the Student Detail Modal:
- **Save Name** — updates `displayName` in Firestore; table refreshes immediately
- **Save Email** — updates `email` field in Firestore (display only — Firebase Auth login email requires Admin SDK to change)
- **Send Password Reset Email** — calls `sendPasswordResetEmail()` via Firebase. Student gets a link to reset their own password. You then tell them what to change it to in person.

### Firebase Functions Used by Admin (all in firebase-config.js)
- `getAllUsers()` — reads entire `users` collection
- `getUserAttempts(uid)` — reads `users/{uid}/attempts` subcollection
- `clearLockout(uid)` — sets `lastAttempt: null`
- `lockUser(uid)` — sets `lastAttempt: serverTimestamp()` (triggers lockout)
- `setUserLevel(uid, level)` — force-writes `unlockedLevel`
- `setUserChapter(uid, chapter)` — force-writes `unlockedChapter`
- `updateUserProfile(uid, { displayName, email })` — updates student name/email in Firestore
- `sendUserPasswordReset(email)` — sends Firebase password reset email to student
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
| `.grand-card` | Rainbow-gradient Grand Quiz card (all 10 chapters done) |
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

// Profile editing (admin)
updateUserProfile(uid, { displayName, email })  // update name/email in Firestore
sendUserPasswordReset(email)                     // send Firebase password reset email

// Lockout
logQuizAttempt(uid)       // starts lockout
checkLockout(uid)         → { isLocked: bool, timeLeftMs: number, penaltyHours: number }
clearLockout(uid)         // clears on pass
lockUser(uid)             // admin force-lock

// Quiz stats
logQuizResult(uid, { type, chapter, level, score, total, passed, wrongCount, pct })
getUserAttempts(uid)      → last 30 attempt docs

// Global config
getGlobalConfig()         → { timeLimit, maxMistakesLevel, maxMistakesMaster, penaltyHours }
setGlobalConfig(config)   // admin writes

// Messaging
sendUserMessage(uid, text)
markMessageRead(uid, msgId)
```

---

## 🚧 Known Limitations / Future Ideas

- **No real-time presence** — online/offline status not implemented
- **Leaderboard** — `leaderboard.html` is referenced but not wired yet
- **Admin security** — password is client-side only. Fine for a classroom tool, not for production.
- **Edit Email (login)** — updating a student's sign-in email in Firebase Auth requires the Admin SDK (Cloud Functions). Admin panel updates the Firestore display only.

---

## 🛠️ Dev Server

```powershell
cd c:\Users\pinca\Desktop\testarea
npx serve
# Serves at http://localhost:3000
```

---

## 📋 Changelog

### V1.6 — 2026-07-06
- **Username Login Support**: Users can now log in using either their email OR their username (`displayName`). When logging in, the system checks for the presence of `@`. If absent, it queries Firestore using `findUserByName()` to resolve the email.
- **First Name Username Rule**: New signups automatically truncate the display name to the first word (using `.split(' ')[0]`) to ensure clean usernames.
- **Insider/Ghost Accounts**: Added `isInsider` boolean flag in Firestore. When set to `true`, the user is excluded from the public leaderboard (`leaderboard.html`) but remains fully manageable in `admin.html` (designated by a purple `👻 INSIDER` badge).
- **Grand Quiz Mistake Slider**: Added a slider to the Admin panel to configure `maxMistakesGrand` dynamically in Firestore `config/quiz`.
- **Warning for AI Collaborators**: Added deployment and local-vs-live warnings to this README.

### V1.5 — 2026-05-15
- **Admin password** changed to `Mashakel#2` (username: `sudo`)
- **Edit Profile** section added to Student Detail Modal:
  - Change student display name → saves to Firestore instantly
  - Change student email (Firestore display) → updates DB record
  - Send password reset email → Firebase sends link to student
- **Grand Quiz entry point** — card now appears on dashboard when all 60 levels are unlocked
- **Bug fix:** Ejection modal text now dynamically reflects the actual mistake limit per quiz type (was hardcoded to "2")
- **Code quality:** `loginHistory` timestamp intentionally uses `Date.now()` — documented with comment
- Added `plan.md` and `status.md` to project root

### V1.4 — 2026-04-21
- Admin messaging system (push messages to individual students)
- Penalty hours now configurable from admin Global Config panel
- Dark mode as default launch theme

### V1.0–V1.3 — 2026-03-04 to 2026-04-20
- Initial EiFF project build
- Firebase Auth + Firestore integration
- Quiz engine with level/master/grand types
- Lockout system with live countdown
- Admin panel — dashboard, student management, global config

---

*Built session by session with Antigravity AI — July 2026*
