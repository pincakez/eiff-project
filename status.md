# EiFF Project — Status & Change Log
# ============================================================
# This file is maintained by AI collaborators working on the project.
# It documents every session's work for full continuity.
#
# CRITICAL RULE FOR ANY AI READING THIS:
#   The user checks their LIVE site at: https://pincakez.github.io/eiff-project/
#   Local edits in C:\Users\pinca\Desktop\testarea are NOT visible to them.
#   After EVERY task, run:
#     git add . ; git commit -m "..." ; git push
#   Then tell the user to wait ~60 seconds for GitHub Pages to rebuild.
#
# For credentials, Firebase config, and full architecture notes see: .env
# For full technical docs see: README.md
#
# ============================================================
# 🚨 IMPORTANT — IF THIS IS A NEW SESSION OR A NEW PC:
# ============================================================
#
#   1. GIT CREDENTIALS (new PC only):
#      The .env file copies fine when the folder is moved manually,
#      but git push requires GitHub credentials on the new machine.
#      Before trying to push, run:
#        git config --global user.email "pincakez@github.com"
#        git config --global user.name "pincakez"
#      Then set up a GitHub Personal Access Token (PAT) if prompted.
#      Without this, the AI can edit files but CANNOT push to GitHub.
#
#   2. .ENV IS LOCAL ONLY — NOT ON GITHUB:
#      The .env file is listed in .gitignore and was NEVER committed.
#      If you cloned this repo fresh from GitHub, .env will be MISSING.
#      You must recreate it manually from README.md or ask the user.
#      If the folder was physically copied (not git-cloned), .env is there.
#      Check with: dir .env  (Windows) or ls -la .env (Mac/Linux)
#
# ============================================================

---

## Session 5 — V1.6.2 Changes (2026-07-18)

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 24 | Create `.env` with all credentials and access info for AI collaborators | ✅ Done | `.env` |
| 25 | Update `status.md` with full session history and AI guidance header | ✅ Done | `status.md` |

---

## Session 4 — V1.6.1 Changes (2026-07-06)

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 17 | Migrate all vocabulary (Chapters 1–10, 2,967 words) into `data-sector1A.js` | ✅ Done | `js/data-sector1A.js` |
| 18 | Insider/Ghost account system (`isInsider` Firestore flag) | ✅ Done | `js/firebase-config.js`, `admin.html`, `leaderboard.html` |
| 19 | Create `sudox` insider account via Node.js REST API | ✅ Done | `create-sudox.html` (utility) |
| 20 | Username login support (login with name OR email) | ✅ Done | `js/auth-ui.js`, `js/firebase-config.js` |
| 21 | First-name-only rule on signup (`split(' ')[0]`) | ✅ Done | `js/auth-ui.js` |
| 22 | Grand Quiz mistake limit slider in admin Global Config | ✅ Done | `admin.html` |
| 23 | Update `README.md` with AI collaborator rules and V1.6 changelog | ✅ Done | `README.md` |

### Change Details — Session 4

#### ✅ 18. Insider / Ghost Account System
- Added `isInsider: false` to all new user documents (set on signup via `eiffSignUp`)
- New admin helper: `setInsiderFlag(uid, boolean)` exported from `firebase-config.js`
- Leaderboard (`leaderboard.html`) filters: `.filter(u => !u.isInsider)` before sorting
- Admin panel shows insider rows with purple row background and a `👻 INSIDER` badge
- Student Detail Modal shows "Toggle Insider Status" button (purple) which calls `setInsiderFlag`
- Purple CSS classes added: `.badge-purple`, `.btn-sm-purple`

#### ✅ 19. sudox Insider Account
- Email: `sudox@eiff.com` | Password: `Mashakel#2` | UID: `7WetHyLtsbQkgPjsk7ie1Ub6XtJ2`
- `unlockedLevel: 61`, `unlockedChapter: 10`, `isInsider: true`
- Created via Node.js REST API (Firebase Identity Toolkit + Firestore REST PATCH)
- To recreate: open `create-sudox.html` in browser while served locally, OR re-run the Node script from `create-sudox.html`

#### ✅ 20–21. Username Login
- Sign In field now accepts email OR first name
- Logic in `js/auth-ui.js` form-signin handler:
  - If input contains `@` → treat as email, sign in directly
  - If no `@` → call `findUserByName(name)` in `firebase-config.js`
  - `findUserByName` queries Firestore: `where("displayName", "==", name), limit(1)`
  - Returns the stored email, then calls `eiffSignIn(email, password)` as normal
- Signup now trims display name to first word: `name.split(' ')[0]`

#### ✅ 22. Grand Quiz Mistake Slider
- New slider `#rng-mg` / label `#lbl-mg` added to "💥 Mistake Limits" card in Global Config
- Range: 1–15, default: 5
- Saved as `maxMistakesGrand` in Firestore `config/quiz` document
- `loadSettings()` reads `cfg.maxMistakesGrand ?? 5` on admin panel load
- Input listener updates label live; save button includes it in `setGlobalConfig()`

---

## Session 3 — V1.5.2 Changes (2026-05-15)

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 14 | Login History in Student Detail Modal (last 10 logins) | ✅ Done | `admin.html` |
| 15 | Admin: Send message to individual student | ✅ Done | `admin.html`, `js/firebase-config.js` |
| 16 | Student unread message badge on dashboard | ✅ Done | `dashboard.html`, `js/firebase-config.js` |

---

## Session 2 — V1.5.1 Changes (2026-05-15)

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 9  | Delete student (with confirmation modal) | ✅ Done | `admin.html`, `js/firebase-config.js` |
| 10 | Mobile hamburger menu for chapter nav | ✅ Done | `dashboard.html`, `css/style.css` |
| 11 | UX fix: quiz result → back to same chapter | ✅ Done | `js/quiz.js` |
| 12 | UX fix: master quiz pass → "Go to Chapter X+1" button | ✅ Done | `js/quiz.js` |
| 13 | UX fix: level quiz pass last level → "Take Master Quiz" button | ✅ Done | `js/quiz.js` |

---

## Session 1 — V1.5 Changes (2026-05-15)

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 1 | Admin password → `Mashakel#2` | ✅ Done | `admin.html` |
| 2 | Edit Student Profile (Name / Email / Password Reset) | ✅ Done | `admin.html`, `js/firebase-config.js` |
| 3 | Bug Fix: Looser modal dynamic mistake count | ✅ Done | `js/quiz.js` |
| 4 | Bug Fix: loginHistory timestamp comment | ✅ Done | `js/firebase-config.js` |
| 5 | Grand Quiz entry point on dashboard | ✅ Done | `dashboard.html` |
| 6 | Create `plan.md` | ✅ Done | `plan.md` |
| 7 | Create `status.md` | ✅ Done | `status.md` |
| 8 | Update `README.md` | ✅ Done | `README.md` |
