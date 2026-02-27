import { vocabData } from './data-sector1A.js';
import { auth, onAuthStateChanged, getUserData, unlockNextLevel, eiffSignOut, logQuizAttempt } from './firebase-config.js';
import { showToast } from './auth-ui.js';

// ─── Config ────────────────────────────────
const PASS_SCORE_LEVEL = 0.8;
const PASS_SCORE_MASTER = 48 / 50; 
const PASS_SCORE_GRAND = 240 / 250;

// ─── State ─────────────────────────────────
let currentUser = null;
let quizWords = [];
let allWords = [];   
let qIndex = 0;
let score = 0;
let answered = false;
let passesRemaining = 2;

// ─── Parse URL ─────────────────────────────
const params = new URLSearchParams(window.location.search);
const type = params.get('type') || 'level'; // 'level', 'master', 'grand'
const chapter = parseInt(params.get('chapter')) || 1;
const level = parseInt(params.get('level')) || 1;
const globalLevel = (chapter - 1) * 6 + level;

// ─── Auth Guard ────────────────────────────
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    currentUser = user;
    
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
    showQuestion();
}

function buildMasterQuizWords(ch) {
    let pool = [];
    for (let l = 1; l <= 6; l++) {
        if (vocabData[ch] && vocabData[ch][l]) pool.push(...vocabData[ch][l]);
    }
    allWords = [...pool];
    return shuffle(pool).slice(0, 50);
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

// ─── Render a Question ─────────────────────
function showQuestion() {
    if (qIndex >= quizWords.length) { showResults(); return; }

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

    // Choices
    const distractors = shuffle(allWords.filter(w => w.en !== word.en)).slice(0, 3);
    const choices = shuffle([word, ...distractors]);

    const area = document.getElementById('quiz-area');
    area.innerHTML = `
        <div class="quiz-card">
            <div class="quiz-q-label">What is the Arabic meaning of…</div>
            <div class="quiz-question">${word.en}</div>
            <div class="quiz-choices">
                ${choices.map((c, i) => `
                    <button class="quiz-choice" data-en="${c.en}">
                        ${c.ar}<br><small>${c.eg}</small>
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
}

// ─── Handle Answer ─────────────────────────
function handleAnswer(selectedBtn, correctEn) {
    if (answered) return;
    answered = true;

    const isCorrect = selectedBtn.dataset.en === correctEn;
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
        feedbackEl.textContent = '❌ Incorrect!';
    }
    feedbackEl.style.display = 'block';
    if (btnNext) btnNext.style.display = 'block';
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
        // We probably need to reshuffle quizWords or just move to a "new" word
        // The user said "swap the question", so let's just pick another random one for this slot
        const newWord = shuffle(allWords)[0];
        quizWords[qIndex] = newWord; 
        
        modal.remove();
        showQuestion();
    };

    modal.querySelector('#btn-cancel-pass').onclick = () => modal.remove();
}

// ─── Results ───────────────────────────────
async function showResults() {
    const total = quizWords.length;
    const pct = score / total;
    
    let passThreshold = PASS_SCORE_LEVEL;
    if (type === 'master') passThreshold = PASS_SCORE_MASTER;
    if (type === 'grand') passThreshold = PASS_SCORE_GRAND;
    
    const passed = pct >= passThreshold;
    
    // Logic for next level unlock if applicable
    if (passed && type === 'level' && currentUser) {
        await unlockNextLevel(currentUser.uid, globalLevel);
    }

    const area = document.getElementById('quiz-area');
    area.innerHTML = `
        <div class="quiz-result-card">
            <h2>${passed ? 'You Passed!' : 'Failed'}</h2>
            <div class="result-score-big">${Math.round(pct * 100)}%</div>
            <p>You got ${score} out of ${total} correct.</p>
            <button class="btn-result" onclick="window.location.href='dashboard.html'">
                Back to Dashboard
            </button>
        </div>
    `;
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
