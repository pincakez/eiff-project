import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail,
    GoogleAuthProvider, signInWithPopup, linkWithPopup
}
    from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
    getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp,
    collection, getDocs, addDoc, query, orderBy, limit, arrayUnion, where, writeBatch, collectionGroup
}
    from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const app = initializeApp({
    apiKey: "AIzaSyCezQwknw42rKnO3kwaaAmLEcUmUeJlkPU",
    authDomain: "eiff-project.firebaseapp.com",
    projectId: "eiff-project",
    storageBucket: "eiff-project.firebasestorage.app",
    messagingSenderId: "779318802519",
    appId: "1:779318802519:web:931e52f38afd73c9350b12"
});

const auth = getAuth(app);
const db = getFirestore(app);

// ── Auth ──────────────────────────────────────────────────────────

// A sign-in name: the first word, no "/" (a database path character), at most 30 letters.
function cleanName(raw, fallback) {
    const first = String(raw || '').trim().split(/\s+/)[0].replace(/\//g, '').slice(0, 30);
    return first || String(fallback || 'student').replace(/\//g, '').slice(0, 30) || 'student';
}

// True when a sign-in name is already used by someone.
async function isNameTaken(name) {
    if (!name || name.includes('/')) return true;
    return (await getDoc(doc(db, "usernames", name))).exists();
}

// The student record + its sign-in name. Firebase keeps emails in lower case, and the database rules
// compare with that, so the email is stored lower-case too.
async function createStudentRecord(user, name) {
    const email = (user.email || '').toLowerCase();
    await setDoc(doc(db, "users", user.uid), {
        displayName: name,
        email,
        unlockedLevel: 1,
        unlockedChapter: 1,
        isInsider: false,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
        // loginHistory uses Date.now() intentionally — serverTimestamp() cannot be stored inside Firestore arrays.
        loginHistory: [Date.now()]
    });
    // Sign-in by username reads this small lookup (the database rules never let a visitor list the users).
    try { await setDoc(doc(db, "usernames", name), { email, uid: user.uid }); } catch (e) { /* taken a moment ago: email sign-in still works */ }
}

async function eiffSignUp(email, password, displayName) {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    await createStudentRecord(userCred.user, cleanName(displayName, email.split('@')[0]));
    return userCred.user;
}

// A removed student (deleted by the admin) cannot sign in again, by password or by Google.
async function refuseIfRemoved(user) {
    if ((await getDoc(doc(db, "removed", user.uid))).exists()) {
        await signOut(auth);
        throw { code: 'eiff/removed' };
    }
    const me = await getUserData(user.uid);
    if (me?.paused === true) {
        await signOut(auth);
        throw { code: 'eiff/paused' };
    }
}

// Connect Google to an existing password account: afterwards the student can sign in either way,
// same account, same progress.
function hasGoogle(user) {
    return !!user?.providerData?.some(p => p.providerId === 'google.com');
}
async function linkGoogle() {
    if (!auth.currentUser) throw { code: 'auth/no-current-user' };
    await linkWithPopup(auth.currentUser, new GoogleAuthProvider());
}

// "Continue with Google": signs in, and makes the student record the first time.
async function eiffGoogleSignIn() {
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    const user = cred.user;
    await refuseIfRemoved(user);
    if (await getUserData(user.uid)) {
        await updateDoc(doc(db, "users", user.uid), { lastSeen: serverTimestamp(), loginHistory: arrayUnion(Date.now()) });
        return { user, isNew: false };
    }
    let base = cleanName(user.displayName, (user.email || '').split('@')[0]);
    let name = base;
    for (let n = 2; await isNameTaken(name) && n < 100; n++) name = `${base}${n}`;
    await createStudentRecord(user, name);
    return { user, isNew: true, name };
}

// Admin sign-in: a real Firebase account that carries the "admin" mark (set on the server, never in this code).
async function adminSignIn(email, password) {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    if (!(await isAdminUser(userCred.user))) {
        await signOut(auth);
        throw { code: 'auth/not-admin' };
    }
    return userCred.user;
}

async function isAdminUser(user) {
    if (!user) return false;
    const t = await user.getIdTokenResult(true);
    return t.claims.admin === true;
}

async function eiffSignIn(email, password) {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    await refuseIfRemoved(userCred.user);
    if (!(await getUserData(userCred.user.uid))) {
        // Signed up but the record was never made (a network cut): make it now instead of failing.
        await createStudentRecord(userCred.user, cleanName(userCred.user.displayName, email.split('@')[0]));
        return userCred.user;
    }
    await updateDoc(doc(db, "users", userCred.user.uid), {
        lastSeen: serverTimestamp(),
        loginHistory: arrayUnion(Date.now()) // Date.now() intentional — serverTimestamp() not allowed in arrays
    });
    return userCred.user;
}

async function eiffSignOut() { await signOut(auth); }

// ── User Data ─────────────────────────────────────────────────────

async function getUserData(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
}

async function getAllUsers() {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

async function findUserByName(name) {
    if (!name || name.includes('/')) return null;
    const snap = await getDoc(doc(db, "usernames", name));
    return snap.exists() ? snap.data().email : null;
}

// ── Lockout ───────────────────────────────────────────────────────

async function logQuizAttempt(uid) {
    await updateDoc(doc(db, "users", uid), { lastAttempt: serverTimestamp() });
}

async function clearLockout(uid) {
    await updateDoc(doc(db, "users", uid), { lastAttempt: null });
}

async function lockUser(uid) {
    await updateDoc(doc(db, "users", uid), { lastAttempt: serverTimestamp() });
}

async function checkLockout(uid) {
    const data = await getUserData(uid);
    if (!data || !data.lastAttempt) return { isLocked: false, timeLeftMs: 0 };
    
    // Get variable penalty time
    const config = await getGlobalConfig();
    const penaltyHours = config?.penaltyHours ?? 12;
    const lockoutMs = penaltyHours * 60 * 60 * 1000;
    
    const elapsed = Date.now() - data.lastAttempt.toDate().getTime();
    const timeLeft = lockoutMs - elapsed;
    return { isLocked: timeLeft > 0, timeLeftMs: Math.max(0, timeLeft), penaltyHours };
}

// ── Level / Chapter Progress ──────────────────────────────────────

async function unlockNextLevel(uid, currentLevel) {
    const data = await getUserData(uid);
    if (!data) return false;
    const next = currentLevel + 1;
    if (data.unlockedLevel === currentLevel && next <= 61) {
        await updateDoc(doc(db, "users", uid), { unlockedLevel: next, lastSeen: serverTimestamp() });
        return true;
    }
    return false;
}

async function unlockNextChapter(uid, currentChapter) {
    const data = await getUserData(uid);
    if (!data) return false;
    const next = currentChapter + 1;
    // Only the chapter the student is really on moves them on (a quiz for a later chapter never skips ahead).
    if (currentChapter === (data.unlockedChapter ?? 1) && next <= 11) {
        await updateDoc(doc(db, "users", uid), { unlockedChapter: next, lastSeen: serverTimestamp() });
        return true;
    }
    return false;
}

async function setGrandQuizPassed(uid) {
    await updateDoc(doc(db, "users", uid), { grandQuizPassed: true, lastSeen: serverTimestamp() });
}

async function setFinalBossPassed(uid) {
    await updateDoc(doc(db, "users", uid), { finalBossPassed: true, lastSeen: serverTimestamp() });
}

// Admin: force-set level or chapter for a user
async function setUserLevel(uid, level) {
    await updateDoc(doc(db, "users", uid), { unlockedLevel: parseInt(level), lastSeen: serverTimestamp() });
}

async function setUserChapter(uid, chapter) {
    await updateDoc(doc(db, "users", uid), { unlockedChapter: parseInt(chapter), lastSeen: serverTimestamp() });
}

// Admin: toggle the insider (ghost) flag on a user
async function setInsiderFlag(uid, isInsider) {
    await updateDoc(doc(db, "users", uid), { isInsider: Boolean(isInsider) });
}

// Admin: rename a student. The sign-in name moves with it (usernames/{new} made, usernames/{old} removed),
// so the student signs in with the NEW name. The email is never changed here: the sign-in email lives in
// Firebase Auth and a page cannot change it.
async function updateUserProfile(uid, { displayName }) {
    const name = (displayName || '').trim();
    if (!name || name.includes('/')) throw { code: 'eiff/bad-name' };
    const user = await getUserData(uid);
    if (!user) throw { code: 'eiff/no-user' };
    const oldName = user.displayName;
    const batch = writeBatch(db);
    if (name !== oldName) {
        const taken = await getDoc(doc(db, "usernames", name));
        if (taken.exists() && taken.data().uid !== uid) throw { code: 'eiff/name-taken' };
        batch.set(doc(db, "usernames", name), { email: (user.email || '').toLowerCase(), uid });
        if (oldName && !oldName.includes('/')) {
            const old = await getDoc(doc(db, "usernames", oldName));
            if (old.exists() && old.data().uid === uid) batch.delete(doc(db, "usernames", oldName));
        }
    }
    batch.update(doc(db, "users", uid), { displayName: name, lastSeen: serverTimestamp() });
    await batch.commit();
}

// Admin: send a password reset email via Firebase Auth
async function sendUserPasswordReset(email) {
    await sendPasswordResetEmail(auth, email);
}

// ── Quiz Attempt Logging ──────────────────────────────────────────

async function logQuizResult(uid, result) {
    // result: { type, chapter, level, score, total, passed }
    await addDoc(collection(db, "users", uid, "attempts"), {
        ...result,
        timestamp: serverTimestamp()
    });
}

async function getUserAttempts(uid) {
    const q = query(collection(db, "users", uid, "attempts"), orderBy("timestamp", "desc"), limit(30));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Admin: permanently delete a student and all their quiz history
async function deleteUserData(uid) {
    const user = await getUserData(uid);
    // Mark the account removed FIRST: a sign-in (password or Google) checks this and refuses,
    // so a removed student can never come back as a fresh account.
    await setDoc(doc(db, "removed", uid), { at: serverTimestamp(), email: user?.email || '' });
    const attemptsSnap = await getDocs(collection(db, "users", uid, "attempts"));
    await Promise.all(attemptsSnap.docs.map(d => deleteDoc(doc(db, "users", uid, "attempts", d.id))));
    // Free the sign-in name
    const name = user?.displayName;
    if (name && !name.includes('/')) {
        const u = await getDoc(doc(db, "usernames", name));
        if (u.exists() && u.data().uid === uid) await deleteDoc(doc(db, "usernames", name));
    }
    await deleteDoc(doc(db, "users", uid));
}

// ── Admin powers (2026-11-14) ─────────────────────────────────────

// One message to many students (500 per write, Firestore's batch limit)
async function sendMessageToAll(uids, text) {
    const stamp = Date.now();
    for (let i = 0; i < uids.length; i += 450) {
        const batch = writeBatch(db);
        uids.slice(i, i + 450).forEach((uid, k) => batch.update(doc(db, "users", uid), {
            messages: arrayUnion({ id: `${stamp}-all-${i + k}`, text, timestamp: stamp, read: false })
        }));
        await batch.commit();
    }
}

// Pause = the student cannot sign in or take quizzes; nothing is deleted. Unpause any time.
async function setPaused(uid, paused) {
    await updateDoc(doc(db, "users", uid), { paused: Boolean(paused) });
}

// Back to the very start: level 1, chapter 1, no Grand / Boss passes, no lock. Quiz history stays.
async function resetProgress(uid) {
    await updateDoc(doc(db, "users", uid), {
        unlockedLevel: 1, unlockedChapter: 1, grandQuizPassed: false, finalBossPassed: false, lastAttempt: null
    });
}

// Every quiz attempt of every student (admin only — the rules refuse anyone else)
async function getAllAttempts() {
    const snap = await getDocs(collectionGroup(db, "attempts"));
    return snap.docs.map(d => ({ uid: d.ref.parent.parent.id, ...d.data() }));
}

// ── Global Config ─────────────────────────────────────────────────

async function getGlobalConfig() {
    const snap = await getDoc(doc(db, "config", "quiz"));
    return snap.exists() ? snap.data() : null;
}

async function setGlobalConfig(config) {
    await setDoc(doc(db, "config", "quiz"), config, { merge: true });
}

// ── Messaging ─────────────────────────────────────────────────────

async function sendUserMessage(uid, text) {
    const newMessage = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        text: text,
        timestamp: new Date().getTime(),
        read: false
    };
    await updateDoc(doc(db, "users", uid), {
        messages: arrayUnion(newMessage)
    });
}

async function markMessageRead(uid, msgId) {
    const data = await getUserData(uid);
    if (!data || !data.messages) return;
    
    // Find message and update read status
    const updatedMessages = data.messages.map(m => 
        m.id === msgId ? { ...m, read: true } : m
    );
    
    await updateDoc(doc(db, "users", uid), {
        messages: updatedMessages
    });
}

// ── Exports ───────────────────────────────────────────────────────

export {
    auth, db, onAuthStateChanged,
    eiffSignUp, eiffSignIn, eiffSignOut, adminSignIn, isAdminUser, eiffGoogleSignIn, isNameTaken, cleanName, hasGoogle, linkGoogle,
    sendMessageToAll, setPaused, resetProgress, getAllAttempts,
    getUserData, getAllUsers, findUserByName,
    unlockNextLevel, unlockNextChapter, setUserLevel, setUserChapter,
    updateUserProfile, sendUserPasswordReset,
    deleteUserData,
    logQuizAttempt, lockUser, checkLockout, clearLockout,
    logQuizResult, getUserAttempts,
    getGlobalConfig, setGlobalConfig,
    sendUserMessage, markMessageRead,
    setInsiderFlag,
    setGrandQuizPassed, setFinalBossPassed
};