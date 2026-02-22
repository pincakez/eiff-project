// =============================================
// EiFF PROJECT — FIREBASE CONFIGURATION
// Project: eiff-project
// SDK Version: 12.9.0
// =============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-analytics.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp }
    from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCezQwknw42rKnO3kwaaAmLEcUmUeJlkPU",
    authDomain: "eiff-project.firebaseapp.com",
    projectId: "eiff-project",
    storageBucket: "eiff-project.firebasestorage.app",
    messagingSenderId: "779318802519",
    appId: "1:779318802519:web:931e52f38afd73c9350b12",
    measurementId: "G-QTPBVL3ZBW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// =============================================
// AUTH HELPERS
// =============================================

/**
 * Sign up a new user with email/password.
 * Creates a Firestore document for the new user with default progress.
 */
async function eiffSignUp(email, password, displayName) {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCred.user.uid;
    // Create user progress document in Firestore
    await setDoc(doc(db, "users", uid), {
        displayName: displayName || email.split('@')[0],
        email: email,
        unlockedLevel: 1,      // Default — can only access Level 1
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp()
    });
    return userCred.user;
}

/**
 * Sign in existing user.
 */
async function eiffSignIn(email, password) {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    // Update lastSeen
    await updateDoc(doc(db, "users", userCred.user.uid), { lastSeen: serverTimestamp() });
    return userCred.user;
}

/**
 * Sign out current user.
 */
async function eiffSignOut() {
    await signOut(auth);
}

// =============================================
// FIRESTORE HELPERS
// =============================================

/**
 * Get a user's progress document from Firestore.
 * @returns {Object} User data including unlockedLevel
 */
async function getUserData(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) return snap.data();
    return null;
}

/**
 * Unlock the next level for the current user.
 * Called when a student passes a quiz (score >= 80%).
 * @param {string} uid         - Firebase user ID
 * @param {number} currentLevel - The level they just passed
 */
async function unlockNextLevel(uid, currentLevel) {
    const userData = await getUserData(uid);
    if (!userData) return;

    const maxLevels = 60; // 10 chapters × 6 levels each
    const nextLevel = currentLevel + 1;

    // Only unlock if it's actually the next level to unlock
    if (userData.unlockedLevel === currentLevel && nextLevel <= maxLevels) {
        await updateDoc(doc(db, "users", uid), {
            unlockedLevel: nextLevel,
            lastSeen: serverTimestamp()
        });
        return true; // Indicates a new level was unlocked
    }
    return false;
}

// =============================================
// AUTH STATE OBSERVER (Used on each page)
// =============================================
// Pages call this to know if user is logged in.
// Usage: onAuthStateChanged(auth, callback)

export {
    auth,
    db,
    onAuthStateChanged,
    eiffSignUp,
    eiffSignIn,
    eiffSignOut,
    getUserData,
    unlockNextLevel
};
