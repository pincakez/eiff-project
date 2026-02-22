// =============================================
// EiFF PROJECT — AUTH MODALS & SHARED UI
// Handles Sign In / Sign Up modal behavior
// =============================================

import { eiffSignUp, eiffSignIn, eiffSignOut, auth, onAuthStateChanged } from './firebase-config.js';

// --- Splash Screen ---
export function initSplash() {
    const splash = document.getElementById('splash-screen');
    if (!splash) return;
    setTimeout(() => splash.classList.add('fade-out'), 1200);
}

// --- Toast Notification ---
export function showToast(message, duration = 3000) {
    let toast = document.getElementById('eiff-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'eiff-toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
}

// --- Modal Logic ---
export function initAuthModals() {
    const signInModal = document.getElementById('modal-signin');
    const signUpModal = document.getElementById('modal-signup');
    const btnOpenSignIn = document.getElementById('btn-open-signin');
    const btnOpenSignUp = document.getElementById('btn-open-signup');

    function openModal(modal) {
        if (modal) modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    function closeModal(modal) {
        if (modal) modal.classList.remove('active');
        document.body.style.overflow = '';
        // Clear errors
        modal?.querySelectorAll('.auth-error').forEach(el => { el.style.display = 'none'; el.textContent = ''; });
    }

    // Open buttons
    btnOpenSignIn?.addEventListener('click', () => openModal(signInModal));
    btnOpenSignUp?.addEventListener('click', () => openModal(signUpModal));

    // Close on overlay click
    [signInModal, signUpModal].forEach(modal => {
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });
    });

    // Close buttons (×)
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(signInModal);
            closeModal(signUpModal);
        });
    });

    // Switch between modals
    document.getElementById('switch-to-signup')?.addEventListener('click', () => {
        closeModal(signInModal);
        openModal(signUpModal);
    });
    document.getElementById('switch-to-signin')?.addEventListener('click', () => {
        closeModal(signUpModal);
        openModal(signInModal);
    });

    // --- SIGN IN FORM ---
    document.getElementById('form-signin')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signin-email').value.trim();
        const password = document.getElementById('signin-password').value;
        const errEl = document.getElementById('signin-error');
        const btn = e.target.querySelector('button[type="submit"]');

        errEl.style.display = 'none';
        btn.disabled = true;
        btn.textContent = 'Signing in...';

        try {
            await eiffSignIn(email, password);
            closeModal(signInModal);
            showToast('✅ Welcome back!');
            // Redirect to dashboard
            setTimeout(() => window.location.href = 'dashboard.html', 600);
        } catch (err) {
            errEl.textContent = friendlyAuthError(err.code);
            errEl.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Sign In';
        }
    });

    // --- SIGN UP FORM ---
    document.getElementById('form-signup')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const errEl = document.getElementById('signup-error');
        const btn = e.target.querySelector('button[type="submit"]');

        errEl.style.display = 'none';

        if (password.length < 6) {
            errEl.textContent = 'Password must be at least 6 characters.';
            errEl.style.display = 'block';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Creating account...';

        try {
            await eiffSignUp(email, password, name);
            closeModal(signUpModal);
            showToast('🎉 Account created! Welcome to EiFF!');
            setTimeout(() => window.location.href = 'dashboard.html', 800);
        } catch (err) {
            errEl.textContent = friendlyAuthError(err.code);
            errEl.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Create Account';
        }
    });

    // --- SIGN OUT ---
    document.getElementById('btn-signout')?.addEventListener('click', async () => {
        await eiffSignOut();
        showToast('Signed out successfully');
        setTimeout(() => window.location.href = 'index.html', 500);
    });
}

// --- Auth State Helper (update nav) ---
export function watchAuthState(onLoggedIn, onLoggedOut) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            onLoggedIn(user);
        } else {
            onLoggedOut();
        }
    });
}

// --- Convert Firebase error codes to friendly messages ---
function friendlyAuthError(code) {
    const map = {
        'auth/email-already-in-use': 'This email is already registered. Try signing in.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/too-many-requests': 'Too many attempts. Please wait a moment.',
        'auth/invalid-credential': 'Invalid email or password.',
        'auth/network-request-failed': 'Network error. Check your connection.',
    };
    return map[code] || 'Something went wrong. Please try again.';
}
