# EiFF Project — Implementation Plan

## 📋 Scope

All changes requested on 2026-05-15. Admin authorized full execution, no confirmation needed.

---

## Task List

### 🔐 1. Admin Password Update
- **File:** `admin.html`
- **Change:** `ADMIN_PASS = '239995'` → `ADMIN_PASS = 'Mashakel#2'`
- **Note:** Admin username stays `sudo`

---

### 👤 2. Edit Student Profile (Name / Email / Password Reset)
New "Edit Profile" section inside the Student Detail Modal.

#### What is possible via client-side Firebase:
| Field | Action | How |
|-------|--------|-----|
| Display Name | ✅ Full update | Write to Firestore `users/{uid}.displayName` |
| Email (display) | ✅ Full update | Write to Firestore `users/{uid}.email` |
| Password | 🔄 Reset via email | `sendPasswordResetEmail(auth, email)` — Firebase sends reset link |

#### Files changed:
- `js/firebase-config.js` — Add `updateUserProfile(uid, {displayName, email})` helper + export `sendPasswordResetEmail` ref
- `admin.html` — Add "✏️ Edit Profile" control group in Student Detail Modal

---

### 🐛 3. Bug Fix — Looser Modal Text
- **File:** `js/quiz.js`
- **Issue:** Modal always says "غلطتين" (2 mistakes) regardless of quiz type
- **Fix:** Dynamically build message using the actual `limit` variable

---

### 🐛 4. Bug Fix — loginHistory Timestamp Annotation
- **File:** `js/firebase-config.js`
- **Note:** `loginHistory` must use `Date.now()` — `serverTimestamp()` cannot be used inside arrays. Added comment to clarify.

---

### 🎮 5. Grand Quiz Entry Point on Dashboard
- **File:** `dashboard.html`
- **Change:** When all 60 levels are unlocked (`unlockedLevel >= 60`), show a GRAND QUIZ card

---

### 📄 6. Create `plan.md` ✅ (this file)
### 📄 7. Create `status.md`
### 📄 8. Update `README.md`

---

## Execution Order

1. `plan.md` — ✅ done
2. `status.md` — create
3. `js/firebase-config.js` — add `updateUserProfile`, annotate `loginHistory`
4. `admin.html` — update password + add Edit Profile section + wire events
5. `js/quiz.js` — fix looser modal dynamic text
6. `dashboard.html` — add Grand Quiz card
7. `README.md` — update docs

---

*Plan created: 2026-05-15*
