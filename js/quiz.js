import { vocabData } from './data-sector1A.js';
import {
    auth, onAuthStateChanged, getUserData, unlockNextLevel, unlockNextChapter, eiffSignOut,
    logQuizAttempt, checkLockout, clearLockout, logQuizResult, getGlobalConfig
} from './firebase-config.js';
import { showToast } from './auth-ui.js';

// ─── Config (defaults — overridden by Firestore config/quiz) ────
const PASS_SCORE_LEVEL = 9 / 10;
const PASS_SCORE_MASTER = 48 / 50;
const PASS_SCORE_GRAND = 240 / 250;
let TIME_LIMIT = 8;  // seconds per level-quiz question
let MAX_MISTAKES_LEVEL = 2;  // mistakes before ejection (level)
let MAX_MISTAKES_MASTER = 3;  // mistakes before ejection (master)

// ─── State ─────────────────────────────────
let currentUser = null;
let quizWords = [];
let allWords = [];
let qIndex = 0;
let score = 0;
let answered = false;
let passesRemaining = 2;
let wrongCount = 0;       // tracks mistakes for level quiz ejection
let timerInterval = null; // reference to the countdown setInterval

// ─── Parse URL ─────────────────────────────
const params = new URLSearchParams(window.location.search);
const type = params.get('type') || 'level'; // 'level', 'master', 'grand'
const chapter = parseInt(params.get('chapter')) || 1;
const level = parseInt(params.get('level')) || 1;
const globalLevel = (chapter - 1) * 6 + level;

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    currentUser = user;

    // Load remote config (timer, mistake limits) — falls back to defaults
    try {
        const cfg = await getGlobalConfig();
        if (cfg) {
            if (cfg.timeLimit != null) TIME_LIMIT = cfg.timeLimit;
            if (cfg.maxMistakesLevel != null) MAX_MISTAKES_LEVEL = cfg.maxMistakesLevel;
            if (cfg.maxMistakesMaster != null) MAX_MISTAKES_MASTER = cfg.maxMistakesMaster;
        }
    } catch (_) { /* use defaults if config unreadable */ }

    // Safety Layer: Double check lockout here in case they bypassed the button
    const lockout = await checkLockout(user.uid);
    if (lockout.isLocked) {
        alert('أنت محظور من الاختبارات لمدة 12 ساعة يا باشة.');
        window.location.href = 'dashboard.html';
        return;
    }

    // Start Lockout as soon as user lands here
    await logQuizAttempt(user.uid);

    initQuiz();
});

// ─── Build Quiz ────────────────────────────
function initQuiz() {
    if (type === 'grand') {
        quizWords = buildGrandQuizWords();
    } else if (type === 'master') {
        quizWords = buildMasterQuizWords(chapter);
    } else {
        const levelWords = (vocabData[chapter] && vocabData[chapter][level]) ? vocabData[chapter][level] : [];
        if (levelWords.length < 10) {
            renderMissingData();
            return;
        }
        allWords = [...levelWords];
        quizWords = shuffle(levelWords).slice(0, 10);
    }

    document.title = `EiFF ${type.toUpperCase()} Quiz`;
    // Add body class so CSS can theme the whole page for master
    if (type === 'master') document.body.classList.add('master-quiz-active');
    showQuestion();
}

function buildMasterQuizWords(ch) {
    let pool = [];
    for (let l = 1; l <= 6; l++) {
        if (vocabData[ch] && vocabData[ch][l]) pool.push(...vocabData[ch][l]);
    }
    if (pool.length === 0) return [];

    allWords = [...pool]; // full pool used for distractor generation

    // Always produce exactly 50 questions.
    // If pool < 50, cycle through shuffled copies until we reach 50.
    const TARGET = 50;
    let result = [];
    while (result.length < TARGET) {
        const needed = TARGET - result.length;
        result.push(...shuffle(pool).slice(0, needed));
    }
    return result; // exactly 50 items
}

function buildGrandQuizWords() {
    let ch1_3 = [], ch4_6 = [], ch7_10 = [];

    for (let c = 1; c <= 10; c++) {
        for (let l = 1; l <= 6; l++) {
            const words = (vocabData[c] && vocabData[c][l]) ? vocabData[c][l] : [];
            if (c <= 3) ch1_3.push(...words);
            else if (c <= 6) ch4_6.push(...words);
            else ch7_10.push(...words);
        }
    }

    // Balanced selection: 25% (63), 25% (62), 50% (125) -> 250 total
    const q1 = shuffle(ch1_3).slice(0, 63);
    const q2 = shuffle(ch4_6).slice(0, 62);
    const q3 = shuffle(ch7_10).slice(0, 125);

    allWords = [...ch1_3, ...ch4_6, ...ch7_10];
    return shuffle([...q1, ...q2, ...q3]);
}

// ─── Timer Helpers ─────────────────────────
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function startTimer(correctEn) {
    stopTimer();
    let secondsLeft = TIME_LIMIT;
    const timerBar = document.getElementById('timer-bar-fill');
    const timerText = document.getElementById('timer-text');

    // Initialise bar
    if (timerBar) timerBar.style.width = '100%';
    if (timerText) timerText.textContent = secondsLeft;

    timerInterval = setInterval(() => {
        secondsLeft--;
        const pct = (secondsLeft / TIME_LIMIT) * 100;

        if (timerBar) {
            timerBar.style.width = `${Math.max(0, pct)}%`;
            // Colour shifts: green → yellow → red
            if (secondsLeft <= 2) timerBar.style.background = 'var(--g-red, #ef4444)';
            else if (secondsLeft <= 4) timerBar.style.background = '#f59e0b';
            else timerBar.style.background = 'var(--g-green, #22c55e)';
        }
        if (timerText) timerText.textContent = secondsLeft;

        if (secondsLeft <= 0) {
            stopTimer();
            // Time's up — treat as wrong answer
            if (!answered) {
                // Find any answerbutton to pass as "wrong"
                const anyBtn = document.querySelector('.quiz-choice:not([data-en="' + correctEn + '"])');
                handleAnswer(anyBtn || document.querySelector('.quiz-choice'), correctEn, true);
            }
        }
    }, 1000);
}

// ─── Render a Question ─────────────────────
function showQuestion() {
    if (qIndex >= quizWords.length) { showResults(); return; }

    stopTimer();
    answered = false;
    const word = quizWords[qIndex];
    const total = quizWords.length;

    const progressFill = document.getElementById('progress-fill');
    const counter = document.getElementById('q-counter');
    const scoreBadge = document.getElementById('score-badge');
    const btnNext = document.getElementById('btn-next');

    if (progressFill) progressFill.style.width = `${(qIndex / total) * 100}%`;
    if (counter) counter.textContent = `Question ${qIndex + 1} of ${total}`;
    if (scoreBadge) scoreBadge.textContent = `Score: ${score}`;
    if (btnNext) btnNext.style.display = 'none';

    // ── Choices: guarantee 4 fully-unique options (by english key) ──
    const usedKeys = new Set([word.en]);
    const candidatePool = shuffle(allWords.filter(w => w.en !== word.en));
    const distractors = [];
    for (const candidate of candidatePool) {
        if (!usedKeys.has(candidate.en)) {
            usedKeys.add(candidate.en);
            distractors.push(candidate);
            if (distractors.length === 3) break;
        }
    }
    const choices = shuffle([word, ...distractors]);

    const area = document.getElementById('quiz-area');
    area.innerHTML = `
        <div class="quiz-card${type === 'master' ? ' quiz-card--master' : ''}">
            <div class="quiz-q-label">${type === 'master' ? '🏆 MASTER QUIZ — ' : ''}What is the Arabic meaning of…</div>
            <div class="quiz-question">${word.en}</div>

            ${type === 'level' ? `
            <div class="timer-wrapper">
                <div class="timer-bar-track">
                    <div class="timer-bar-fill" id="timer-bar-fill"></div>
                </div>
                <span class="timer-text" id="timer-text">${TIME_LIMIT}</span>
            </div>` : ''}

            <div class="quiz-choices">
                ${choices.map((c) => `
                    <button class="quiz-choice" data-en="${c.en}">
                        <span class="choice-ar">${c.ar}</span>
                        <span class="choice-eg">${c.eg}</span>
                    </button>
                `).join('')}
            </div>

            ${(type !== 'level' && passesRemaining > 0) ? `
                <button class="btn-pass" id="btn-pass-question">
                    Skip / Pass (${passesRemaining} left)
                </button>
            ` : ''}

            <div class="quiz-feedback" id="quiz-feedback"></div>
        </div>`;

    document.querySelectorAll('.quiz-choice').forEach(btn => {
        btn.addEventListener('click', () => handleAnswer(btn, word.en));
    });

    document.getElementById('btn-pass-question')?.addEventListener('click', showPassModal);

    // Start 8-second countdown only for level quizzes
    if (type === 'level') startTimer(word.en);
}

// ─── Handle Answer ─────────────────────────
function handleAnswer(selectedBtn, correctEn, timedOut = false) {
    if (answered) return;
    answered = true;
    stopTimer();

    const isCorrect = !timedOut && selectedBtn && selectedBtn.dataset.en === correctEn;
    const feedbackEl = document.getElementById('quiz-feedback');
    const btnNext = document.getElementById('btn-next');

    document.querySelectorAll('.quiz-choice').forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.en === correctEn) btn.classList.add('correct');
        else if (btn === selectedBtn && !isCorrect) btn.classList.add('wrong');
    });

    if (isCorrect) {
        score++;
        feedbackEl.className = 'quiz-feedback correct';
        feedbackEl.textContent = '✅ Correct!';
    } else {
        feedbackEl.className = 'quiz-feedback wrong';
        feedbackEl.textContent = timedOut ? '⏰ Time\'s up!' : '❌ Incorrect!';

        // ── Mistake ejection ──
        if (type === 'level' || type === 'master') {
            wrongCount++;
            const limit = type === 'master' ? MAX_MISTAKES_MASTER : MAX_MISTAKES_LEVEL;
            if (wrongCount >= limit) {
                feedbackEl.style.display = 'block';
                if (btnNext) btnNext.style.display = 'none';
                setTimeout(() => showLooserModal(), 800);
                return;
            }
        }
    }

    feedbackEl.style.display = 'block';
    if (btnNext) btnNext.style.display = 'block';
}

// ─── GET OUT LOOSER Modal ───────────────────
function showLooserModal() {
    const limit = type === 'master' ? MAX_MISTAKES_MASTER : MAX_MISTAKES_LEVEL;
    const mistakeText = limit === 1 ? 'غلطة واحدة' : limit === 2 ? 'غلطتين' : `${limit} غلطات`;
    const quizTypeName = type === 'master' ? 'ماستر كويز' : 'الاختبار';
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-box arabic-modal looser-modal">
            <div class="looser-emoji">💀</div>
            <h2>GET OUT LOOSER</h2>
            <p>لقيت ${mistakeText} في ${quizTypeName}... يلا بره! ارجع ذاكر وارجعلنا بعد فترة يا باشة 🚪</p>
            <button class="btn-looser" id="btn-looser-confirm">YES I AM</button>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#btn-looser-confirm').onclick = () => {
        // Redirect back to the quiz page for this same level (they can't enter — lockout is active)
        window.location.href = `study.html?chapter=${chapter}&level=${level}`;
    };
}

// ─── Pass Logic ────────────────────────────
function showPassModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-box arabic-modal">
            <h2>ده أخرك يعني؟</h2>
            <p>هتهرب من السؤال؟ ماشي.. ومالو اصاحبي بس ارجعلي كده سؤالين لورا عشان تبقى تذاكر صح</p>
            <div style="display:flex; gap:10px; margin-top:20px;">
                <button class="btn-primary" id="btn-confirm-pass">غير السؤال ورجعني ياعم</button>
                <button class="btn-secondary" id="btn-cancel-pass">لا، أنا سندال</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#btn-confirm-pass').onclick = () => {
        passesRemaining--;
        qIndex = Math.max(0, qIndex - 2); // Penalty
        const newWord = shuffle(allWords)[0];
        quizWords[qIndex] = newWord;

        modal.remove();
        showQuestion();
    };

    modal.querySelector('#btn-cancel-pass').onclick = () => modal.remove();
}

// ─── Results ───────────────────────────────
async function showResults() {
    stopTimer();
    const total = quizWords.length;
    const pct = score / total;

    let passThreshold = PASS_SCORE_LEVEL;
    if (type === 'master') passThreshold = PASS_SCORE_MASTER;
    if (type === 'grand') passThreshold = PASS_SCORE_GRAND;

    const passed = pct >= passThreshold;

    // Clear lockout immediately on pass
    if (passed && currentUser) {
        await clearLockout(currentUser.uid);
    }

    // Level quiz pass: unlock next level
    if (passed && type === 'level' && currentUser) {
        await unlockNextLevel(currentUser.uid, globalLevel);
    }

    // Master quiz pass: unlock next chapter
    let chapterUnlocked = false;
    if (passed && type === 'master' && currentUser) {
        chapterUnlocked = await unlockNextChapter(currentUser.uid, chapter);
    }

    // Log this quiz result for admin stats
    if (currentUser) {
        try {
            await logQuizResult(currentUser.uid, {
                type, chapter, level, score, total: quizWords.length, passed,
                wrongCount, pct: Math.round(pct * 100)
            });
        } catch (_) { /* non-critical */ }
    }

    // Determine where the button goes — smart context-aware navigation
    let btnText = `← Back to Chapter ${chapter}`;
    let btnUrl  = `dashboard.html?chapter=${chapter}`;

    if (passed && type === 'level' && level === 6) {
        // Finished last level — go take the Master Quiz
        btnText = '🏆 Take Master Quiz';
        btnUrl  = `quiz.html?type=master&chapter=${chapter}`;
    } else if (passed && type === 'master' && chapterUnlocked) {
        // Master quiz passed and a new chapter was unlocked
        const nextCh = chapter + 1;
        btnText = `Go to Chapter ${nextCh} →`;
        btnUrl  = `dashboard.html?chapter=${nextCh}`;
    } else if (type === 'grand') {
        btnText = '🏠 Back to Dashboard';
        btnUrl  = 'dashboard.html';
    }

    // Hide the bottom "Next" button immediately
    const nav = document.querySelector('.quiz-nav');
    if (nav) nav.style.display = 'none';

    // Show Fireworks!
    if (passed && typeof confetti === 'function') {
        const duration = 3000;
        const end = Date.now() + duration;

        (function frame() {
            confetti({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']
            });
            confetti({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }());
    }

    const area = document.getElementById('quiz-area');
    const resultClass = type === 'master' ? 'quiz-result-card quiz-result-card--master' : 'quiz-result-card';

    area.innerHTML = `
        <div class="${resultClass}">
            <h2>${passed ? '🎉 You Passed!' : '😬 Failed'}</h2>
            <div class="result-score-big">${Math.round(pct * 100)}%</div>
            <p>You got ${score} out of ${total} correct.</p>
            ${passed && type === 'level' && level === 6
            ? `<p class="master-unlock-msg">🏆 All 6 levels complete! Master Quiz unlocked.</p>`
            : ''}
            ${chapterUnlocked
            ? `<p class="chapter-unlock-msg">🔓 Chapter ${chapter + 1} is now unlocked!</p>`
            : ''}
            <button class="btn-primary" id="btn-quiz-done" style="margin-top: 15px; padding: 14px 40px; font-size: 1.1rem; border-radius: 50px;">
                ${btnText}
            </button>
        </div>
    `;

    document.getElementById('btn-quiz-done').addEventListener('click', () => {
        window.location.href = btnUrl;
    });
}

// ─── Helpers ───────────────────────────────
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function renderMissingData() {
    document.getElementById('quiz-area').innerHTML = `<p>Not enough data for this quiz.</p>`;
}

// Navigation
document.getElementById('btn-next')?.addEventListener('click', () => {
    qIndex++;
    showQuestion();
});
