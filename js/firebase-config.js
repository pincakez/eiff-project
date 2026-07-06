import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail }
    from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
    getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp,
    collection, getDocs, addDoc, query, orderBy, limit, arrayUnion, where
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
        isInsider: false,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
        // loginHistory uses Date.now() intentionally — serverTimestamp() cannot be stored inside Firestore arrays.
        loginHistory: [Date.now()]
    });
    return userCred.user;
}

async function eiffSignIn(email, password) {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
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
    const q = query(collection(db, "users"), where("displayName", "==", name), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
        return snap.docs[0].data().email;
    }
    return null;
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

// Admin: toggle the insider (ghost) flag on a user
async function setInsiderFlag(uid, isInsider) {
    await updateDoc(doc(db, "users", uid), { isInsider: Boolean(isInsider) });
}

// Admin: update a student's display name and/or email in Firestore
async function updateUserProfile(uid, { displayName, email }) {
    const updates = { lastSeen: serverTimestamp() };
    if (displayName !== undefined && displayName !== null) updates.displayName = displayName;
    if (email !== undefined && email !== null) updates.email = email;
    await updateDoc(doc(db, "users", uid), updates);
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
    // Delete all attempts in subcollection first
    const attemptsSnap = await getDocs(collection(db, "users", uid, "attempts"));
    await Promise.all(attemptsSnap.docs.map(d => deleteDoc(doc(db, "users", uid, "attempts", d.id))));
    // Delete the user document itself
    await deleteDoc(doc(db, "users", uid));
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
    eiffSignUp, eiffSignIn, eiffSignOut,
    getUserData, getAllUsers, findUserByName,
    unlockNextLevel, unlockNextChapter, setUserLevel, setUserChapter,
    updateUserProfile, sendUserPasswordReset,
    deleteUserData,
    logQuizAttempt, lockUser, checkLockout, clearLockout,
    logQuizResult, getUserAttempts,
    getGlobalConfig, setGlobalConfig,
    sendUserMessage, markMessageRead,
    setInsiderFlag
};