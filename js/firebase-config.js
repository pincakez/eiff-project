import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
    getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp,
    collection, getDocs, addDoc, query, orderBy, limit
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

async function eiffSignUp(email, password, displayName) {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCred.user.uid;
    await setDoc(doc(db, "users", uid), {
        displayName: displayName || email.split('@')[0],
        email,
        unlockedLevel: 1,
        unlockedChapter: 1,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp()
    });
    return userCred.user;
}

async function eiffSignIn(email, password) {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    await updateDoc(doc(db, "users", userCred.user.uid), { lastSeen: serverTimestamp() });
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
    const elapsed = Date.now() - data.lastAttempt.toDate().getTime();
    const timeLeft = 12 * 60 * 60 * 1000 - elapsed;
    return { isLocked: timeLeft > 0, timeLeftMs: Math.max(0, timeLeft) };
}

// ── Level / Chapter Progress ──────────────────────────────────────

async function unlockNextLevel(uid, currentLevel) {
    const data = await getUserData(uid);
    if (!data) return false;
    const next = currentLevel + 1;
    if (data.unlockedLevel === currentLevel && next <= 60) {
        await updateDoc(doc(db, "users", uid), { unlockedLevel: next, lastSeen: serverTimestamp() });
        return true;
    }
    return false;
}

async function unlockNextChapter(uid, currentChapter) {
    const data = await getUserData(uid);
    if (!data) return false;
    const next = currentChapter + 1;
    if (currentChapter >= (data.unlockedChapter ?? 1) && next <= 10) {
        await updateDoc(doc(db, "users", uid), { unlockedChapter: next, lastSeen: serverTimestamp() });
        return true;
    }
    return false;
}

// Admin: force-set level or chapter for a user
async function setUserLevel(uid, level) {
    await updateDoc(doc(db, "users", uid), { unlockedLevel: parseInt(level), lastSeen: serverTimestamp() });
}

async function setUserChapter(uid, chapter) {
    await updateDoc(doc(db, "users", uid), { unlockedChapter: parseInt(chapter), lastSeen: serverTimestamp() });
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

// ── Global Config ─────────────────────────────────────────────────

async function getGlobalConfig() {
    const snap = await getDoc(doc(db, "config", "quiz"));
    return snap.exists() ? snap.data() : null;
}

async function setGlobalConfig(config) {
    await setDoc(doc(db, "config", "quiz"), config, { merge: true });
}

// ── Exports ───────────────────────────────────────────────────────

export {
    auth, db, onAuthStateChanged,
    eiffSignUp, eiffSignIn, eiffSignOut,
    getUserData, getAllUsers,
    unlockNextLevel, unlockNextChapter, setUserLevel, setUserChapter,
    logQuizAttempt, lockUser, checkLockout, clearLockout,
    logQuizResult, getUserAttempts,
    getGlobalConfig, setGlobalConfig
};