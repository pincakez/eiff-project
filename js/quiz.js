import { vocabData } from './data-sector1A.js';
import {
    auth, onAuthStateChanged, getUserData, unlockNextLevel, unlockNextChapter, eiffSignOut,
    logQuizAttempt, checkLockout, clearLockout, logQuizResult, getGlobalConfig,
    setGrandQuizPassed, setFinalBossPassed
} from './firebase-config.js';
import { showToast } from './auth-ui.js';

// ─── Config (defaults — overridden by Firestore config/quiz) ────
let PASS_SCORE_LEVEL = 9 / 10;
let PASS_SCORE_MASTER = 48 / 50;
let PASS_SCORE_GRAND = 240 / 250;
let PASS_SCORE_BOSS = 90 / 100;

let TIME_LIMIT = 8;             // level quiz timer
let MASTER_TIME_LIMIT = 0;      // master quiz timer (0 = off)
let GRAND_TIME_LIMIT = 0;       // grand quiz timer (0 = off)
let BOSS_TIME_LIMIT = 0;        // boss quiz timer (0 = off)

let MAX_MISTAKES_LEVEL = 2;
let MAX_MISTAKES_MASTER = 3;
let MAX_MISTAKES_GRAND = 5;
let MAX_MISTAKES_BOSS = 10;

let BOSS_QUESTIONS = 100;

let GRAND_ENTRY_MSG = "⚠️ WARNING: You are entering the GRAND QUIZ. 250 Questions across all 10 chapters. Stay focused!";
let BOSS_ENTRY_MSG = "👹 THE FINAL BOSS HAS AWAKENED! Prepare to face questions from all master quizzes randomly. Prove your absolute mastery!";

let GRAND_PCT = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10]; // default 10% per chapter

// ─── State ─────────────────────────────────
let currentUser = null;
let quizWords = [];
let allWords = [];
let qIndex = 0;
let score = 0;
let answered = false;
let passesRemaining = 2;
let wrongCount = 0;       // tracks mistakes for ejection
let timerInterval = null; // reference to countdown setInterval
let globalConfig = null;

// ─── Parse URL ─────────────────────────────
const params = new URLSearchParams(window.location.search);
const type = params.get('type') || 'level'; // 'level', 'master', 'grand', 'boss'
const chapter = parseInt(params.get('chapter')) || 1;
const level = parseInt(params.get('level')) || 1;
const globalLevel = (chapter - 1) * 6 + level;

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    currentUser = user;

    // Load remote config (timer, mistake limits, thresholds)
    try {
        const cfg = await getGlobalConfig();
        globalConfig = cfg;
        if (cfg) {
            if (cfg.timeLimit != null) TIME_LIMIT = cfg.timeLimit;
            if (cfg.masterTimeLimit != null) MASTER_TIME_LIMIT = cfg.masterTimeLimit;
            if (cfg.grandTimeLimit != null) GRAND_TIME_LIMIT = cfg.grandTimeLimit;
            if (cfg.bossTimeLimit != null) BOSS_TIME_LIMIT = cfg.bossTimeLimit;

            if (cfg.maxMistakesLevel != null) MAX_MISTAKES_LEVEL = cfg.maxMistakesLevel;
            if (cfg.maxMistakesMaster != null) MAX_MISTAKES_MASTER = cfg.maxMistakesMaster;
            if (cfg.maxMistakesGrand != null) MAX_MISTAKES_GRAND = cfg.maxMistakesGrand;
            if (cfg.bossMaxMistakes != null) MAX_MISTAKES_BOSS = cfg.bossMaxMistakes;

            if (cfg.masterPassPct != null) PASS_SCORE_MASTER = cfg.masterPassPct / 100;
            if (cfg.grandPassPct != null) PASS_SCORE_GRAND = cfg.grandPassPct / 100;
            if (cfg.bossPassPct != null) PASS_SCORE_BOSS = cfg.bossPassPct / 100;

            if (cfg.bossQuestions != null) BOSS_QUESTIONS = cfg.bossQuestions;

            if (cfg.grandEntryMessage) GRAND_ENTRY_MSG = cfg.grandEntryMessage;
            if (cfg.bossEntryMessage) BOSS_ENTRY_MSG = cfg.bossEntryMessage;

            if (Array.isArray(cfg.grandPct) && cfg.grandPct.length === 10) {
                GRAND_PCT = cfg.grandPct;
            }
        }
    } catch (_) { /* use defaults */ }

    // Double check lockout
    const lockout = await checkLockout(user.uid);
    if (lockout.isLocked) {
        alert('أنت محظور من الاختبارات لمدة 12 ساعة يا باشة.');
        window.location.href = 'dashboard.html';
        return;
    }

    // Start Lockout as soon as user lands here
    await logQuizAttempt(user.uid);

    // Show entry warning modal for Grand Quiz or Final Boss before starting
    if (type === 'grand' || type === 'boss') {
        showEntryModal(() => initQuiz());
    } else {
        initQuiz();
    }
});

// ─── Entry Modal ───────────────────────────
function showEntryModal(onConfirm) {
    const isBoss = type === 'boss';
    const title = isBoss ? '👹 THE FINAL BOSS' : '🌟 GRAND QUIZ';
    const msg = isBoss ? BOSS_ENTRY_MSG : GRAND_ENTRY_MSG;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-box arabic-modal" style="max-width: 500px; text-align: center; ${isBoss ? 'background: #0f172a; color: #f87171; border: 2px solid #ef4444;' : 'background: #0f172a; color: #f8fafc; border: 2px solid #3b82f6;'}">
            <div style="font-size: 3rem; margin-bottom: 10px;">${isBoss ? '👹' : '🌟'}</div>
            <h2 style="font-size: 1.8rem; margin-bottom: 12px; color: ${isBoss ? '#ef4444' : '#60a5fa'};">${title}</h2>
            <div style="font-size: 1.05rem; line-height: 1.6; margin-bottom: 24px; color: #cbd5e1; white-space: pre-wrap;">${msg}</div>
            <button class="btn-primary" id="btn-entry-start" style="padding: 14px 36px; font-size: 1.1rem; width: 100%; border-radius: 12px; background: ${isBoss ? 'linear-gradient(135deg,#dc2626,#991b1b)' : 'linear-gradient(135deg,#2563eb,#1d4ed8)'}">
                ${isBoss ? '⚔️ ACCEPTS THE CHALLENGE' : '🚀 START GRAND QUIZ'}
            </button>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#btn-entry-start').onclick = () => {
        modal.remove();
        onConfirm();
    };
}

// ─── Build Quiz ────────────────────────────
function initQuiz() {
    if (type === 'boss') {
        quizWords = buildBossQuizWords();
    } else if (type === 'grand') {
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

    if (type === 'master') document.body.classList.add('master-quiz-active');
    if (type === 'boss') document.body.classList.add('master-quiz-active');

    showQuestion();
}

function buildMasterQuizWords(ch) {
    let pool = [];
    for (let l = 1; l <= 6; l++) {
        if (vocabData[ch] && vocabData[ch][l]) pool.push(...vocabData[ch][l]);
    }
    if (pool.length === 0) return [];

    allWords = [...pool];

    const TARGET = 50;
    let result = [];
    while (result.length < TARGET) {
        const needed = TARGET - result.length;
        result.push(...shuffle(pool).slice(0, needed));
    }
    return result;
}

function buildGrandQuizWords() {
    let grandPool = [];
    let fullAllWords = [];
    const TOTAL_TARGET = 250;

    for (let c = 1; c <= 10; c++) {
        let chPool = [];
        for (let l = 1; l <= 6; l++) {
            if (vocabData[c] && vocabData[c][l]) chPool.push(...vocabData[c][l]);
        }
        fullAllWords.push(...chPool);

        // Allocate questions for chapter c based on GRAND_PCT array
        const pct = GRAND_PCT[c - 1] ?? 10;
        const count = Math.max(1, Math.round((pct / 100) * TOTAL_TARGET));

        if (chPool.length > 0) {
            let chResult = [];
            while (chResult.length < count) {
                const needed = count - chResult.length;
                chResult.push(...shuffle(chPool).slice(0, needed));
            }
            grandPool.push(...chResult);
        }
    }

    allWords = fullAllWords;
    return shuffle(grandPool).slice(0, TOTAL_TARGET);
}

function buildBossQuizWords() {
    let fullPool = [];
    for (let c = 1; c <= 10; c++) {
        for (let l = 1; l <= 6; l++) {
            if (vocabData[c] && vocabData[c][l]) fullPool.push(...vocabData[c][l]);
        }
    }
    allWords = [...fullPool];

    let result = [];
    const TARGET = BOSS_QUESTIONS;
    while (result.length < TARGET && fullPool.length > 0) {
        const needed = TARGET - result.length;
        result.push(...shuffle(fullPool).slice(0, needed));
    }
    return result;
}

// ─── Timer Helpers ─────────────────────────
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function getActiveTimerSeconds() {
    if (type === 'level') return TIME_LIMIT;
    if (type === 'master') return MASTER_TIME_LIMIT;
    if (type === 'grand') return GRAND_TIME_LIMIT;
    if (type === 'boss') return BOSS_TIME_LIMIT;
    return 0;
}

function startTimer(correctEn) {
    stopTimer();
    const limit = getActiveTimerSeconds();
    if (limit <= 0) return;

    let secondsLeft = limit;
    const timerBar = document.getElementById('timer-bar-fill');
    const timerText = document.getElementById('timer-text');

    if (timerBar) timerBar.style.width = '100%';
    if (timerText) timerText.textContent = secondsLeft;

    timerInterval = setInterval(() => {
        secondsLeft--;
        const pct = (secondsLeft / limit) * 100;

        if (timerBar) {
            timerBar.style.width = `${Math.max(0, pct)}%`;
            if (secondsLeft <= 2) timerBar.style.background = 'var(--g-red, #ef4444)';
            else if (secondsLeft <= 4) timerBar.style.background = '#f59e0b';
            else timerBar.style.background = 'var(--g-green, #22c55e)';
        }
        if (timerText) timerText.textContent = secondsLeft;

        if (secondsLeft <= 0) {
            stopTimer();
            if (!answered) {
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

    // Choices: 4 unique options
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

    const timerSecs = getActiveTimerSeconds();
    const isMasterOrBoss = (type === 'master' || type === 'boss' || type === 'grand');
    const titleLabel = type === 'boss' ? '👹 THE FINAL BOSS — ' : type === 'grand' ? '🌟 GRAND QUIZ — ' : type === 'master' ? '🏆 MASTER QUIZ — ' : '';

    const area = document.getElementById('quiz-area');
    area.innerHTML = `
        <div class="quiz-card${isMasterOrBoss ? ' quiz-card--master' : ''}">
            <div class="quiz-q-label">${titleLabel}What is the Arabic meaning of…</div>
            <div class="quiz-question">${word.en}</div>

            ${timerSecs > 0 ? `
            <div class="timer-wrapper">
                <div class="timer-bar-track">
                    <div class="timer-bar-fill" id="timer-bar-fill"></div>
                </div>
                <span class="timer-text" id="timer-text">${timerSecs}</span>
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

    if (timerSecs > 0) startTimer(word.en);
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

        // Mistake ejection check for all quiz types
        wrongCount++;
        let limit = MAX_MISTAKES_LEVEL;
        if (type === 'master') limit = MAX_MISTAKES_MASTER;
        if (type === 'grand') limit = MAX_MISTAKES_GRAND;
        if (type === 'boss') limit = MAX_MISTAKES_BOSS;

        if (wrongCount >= limit) {
            feedbackEl.style.display = 'block';
            if (btnNext) btnNext.style.display = 'none';
            setTimeout(() => showLooserModal(), 800);
            return;
        }
    }

    feedbackEl.style.display = 'block';
    if (btnNext) btnNext.style.display = 'block';
}

// ─── GET OUT LOOSER Modal ───────────────────
function showLooserModal() {
    let limit = MAX_MISTAKES_LEVEL;
    if (type === 'master') limit = MAX_MISTAKES_MASTER;
    if (type === 'grand') limit = MAX_MISTAKES_GRAND;
    if (type === 'boss') limit = MAX_MISTAKES_BOSS;

    const mistakeText = limit === 1 ? 'غلطة واحدة' : limit === 2 ? 'غلطتين' : `${limit} غلطات`;
    const quizTypeName = type === 'boss' ? 'THE FINAL BOSS' : type === 'grand' ? 'جراند كويز' : type === 'master' ? 'ماستر كويز' : 'الاختبار';
    
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
        if (type === 'grand' || type === 'boss') {
            window.location.href = `dashboard.html?chapter=11`;
        } else {
            window.location.href = `study.html?chapter=${chapter}&level=${level}`;
        }
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
        qIndex = Math.max(0, qIndex - 2);
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
    if (type === 'boss') passThreshold = PASS_SCORE_BOSS;

    const passed = pct >= passThreshold;

    // Clear lockout on pass
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

    // Grand quiz pass: record in Firestore
    if (passed && type === 'grand' && currentUser) {
        await setGrandQuizPassed(currentUser.uid);
    }

    // Final boss pass: record in Firestore
    if (passed && type === 'boss' && currentUser) {
        await setFinalBossPassed(currentUser.uid);
    }

    // Log attempt
    if (currentUser) {
        try {
            await logQuizResult(currentUser.uid, {
                type, chapter, level, score, total: quizWords.length, passed,
                wrongCount, pct: Math.round(pct * 100)
            });
        } catch (_) { /* non-critical */ }
    }

    // Smart context-aware navigation button
    let btnText = `← Back to Chapter ${chapter}`;
    let btnUrl  = `dashboard.html?chapter=${chapter}`;

    if (passed && type === 'level' && level === 6) {
        btnText = '🏆 Take Master Quiz';
        btnUrl  = `quiz.html?type=master&chapter=${chapter}`;
    } else if (passed && type === 'master' && chapterUnlocked) {
        const nextCh = chapter + 1;
        if (nextCh === 11) {
            btnText = '⭐ Go to Chapter X →';
            btnUrl  = `dashboard.html?chapter=11`;
        } else {
            btnText = `Go to Chapter ${nextCh} →`;
            btnUrl  = `dashboard.html?chapter=${nextCh}`;
        }
    } else if (type === 'grand' || type === 'boss') {
        btnText = '⭐ Back to Chapter X';
        btnUrl  = 'dashboard.html?chapter=11';
    }

    // Hide bottom "Next" button
    const nav = document.querySelector('.quiz-nav');
    if (nav) nav.style.display = 'none';

    // Fireworks on pass
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
    const isDarkResult = (type === 'master' || type === 'grand' || type === 'boss');
    const resultClass = isDarkResult ? 'quiz-result-card quiz-result-card--master' : 'quiz-result-card';

    let passHeading = '🎉 You Passed!';
    if (passed && type === 'boss') passHeading = '🏆 YOU ARE THE FINAL BOSS!';
    else if (passed && type === 'grand') passHeading = '🌟 GRAND QUIZ CONQUERED!';

    area.innerHTML = `
        <div class="${resultClass}">
            <h2>${passed ? passHeading : '😬 Failed'}</h2>
            <div class="result-score-big">${Math.round(pct * 100)}%</div>
            <p>You got ${score} out of ${total} correct.</p>
            ${passed && type === 'level' && level === 6
            ? `<p class="master-unlock-msg">🏆 All 6 levels complete! Master Quiz unlocked.</p>`
            : ''}
            ${chapterUnlocked
            ? `<p class="chapter-unlock-msg">🔓 ${chapter === 10 ? 'Chapter X' : 'Chapter ' + (chapter + 1)} is now unlocked!</p>`
            : ''}
            ${passed && type === 'grand'
            ? `<p class="chapter-unlock-msg" style="background: linear-gradient(135deg,#f59e0b,#ef4444); color: #fff;">👹 THE FINAL BOSS HAS BEEN UNLOCKED IN CHAPTER X!</p>`
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

