// =============================================
// EiFF — game feel: sounds, damage, speed streaks, the 5-second countdown
// Every sound is made by the browser (Web Audio): no sound files to load.
// =============================================

let ctx = null;
function audio() {
    if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => { });
    return ctx;
}
// Browsers allow sound only after a tap: wake the sound on the first one.
['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
    window.addEventListener(ev, () => audio(), { once: true, passive: true }));

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function tone(freq, start, dur, { type = 'sine', gain = 0.2, slideTo = null } = {}) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + start;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
}

function noise(start, dur, { gain = 0.3, hp = 1200 } = {}) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + start;
    const buf = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; f.type = 'highpass'; f.frequency.value = hp; g.gain.value = gain;
    src.connect(f).connect(g).connect(a.destination);
    src.start(t);
}

// One "Ah!": a buzzing voice through the two mouth shapes of the vowel «a» (formants ~750 and ~1150 Hz).
function ah(start, pitch, dur = 0.32, gain = 0.22) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + start;
    const o = a.createOscillator(), out = a.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(pitch * 1.25, t);
    o.frequency.exponentialRampToValueAtTime(pitch * 0.8, t + dur);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const [fq, q, lvl] of [[750, 8, 1], [1150, 9, 0.6], [2500, 12, 0.25]]) {
        const f = a.createBiquadFilter(), fg = a.createGain();
        f.type = 'bandpass'; f.frequency.value = fq; f.Q.value = q; fg.gain.value = lvl;
        o.connect(f).connect(fg).connect(out);
    }
    out.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.05);
}

// The "headshot": a sharp crack, a low thump and a metal ping.
function headshot(start, ping) {
    noise(start, 0.05, { gain: 0.5, hp: 2500 });
    tone(110, start, 0.18, { type: 'sine', gain: 0.45, slideTo: 40 });
    tone(ping, start + 0.01, 0.25, { type: 'triangle', gain: 0.12, slideTo: ping * 0.97 });
}

// Five different hits, picked so the same one never plays twice in a row.
const HITS = [
    () => { headshot(0, 2400); ah(0.06, 150); ah(0.12, 118); },
    () => { headshot(0, 1900); ah(0.05, 190, 0.28); ah(0.1, 160, 0.3); ah(0.16, 130); },
    () => { headshot(0, 2900); ah(0.08, 105, 0.42); },
    () => { headshot(0, 2200); ah(0.04, 210, 0.22); ah(0.2, 140, 0.34); },
    () => { headshot(0, 1600); ah(0.06, 170); ah(0.09, 125); ah(0.13, 95, 0.4); },
];
let lastHit = -1;
export function playHit() {
    let i; do { i = Math.floor(Math.random() * HITS.length); } while (i === lastHit && HITS.length > 1);
    lastHit = i;
    HITS[i]();
}

// Speed streak: a quick rising arpeggio that climbs higher every streak.
export function playStreak(n) {
    const base = 523.25 * Math.pow(2, Math.min(n - 1, 12) / 12);
    [0, 4, 7].forEach((st, k) => tone(base * Math.pow(2, st / 12), k * 0.06, 0.16, { type: 'triangle', gain: 0.16 }));
}

// Coins: from a 3-streak, one more coin every streak (up to 14).
export function playCoins(n) {
    const count = Math.min(14, Math.max(1, n - 1));
    for (let i = 0; i < count; i++) {
        const t = 0.12 + i * 0.07 + Math.random() * 0.03;
        tone(988, t, 0.07, { type: 'square', gain: 0.07 });
        tone(1319, t + 0.06, 0.18, { type: 'square', gain: 0.07 });
    }
}

export function playTick(go = false) {
    tone(go ? 1046 : 660, 0, go ? 0.35 : 0.12, { type: 'triangle', gain: 0.18 });
}

export function playLife() {
    [523, 659, 784, 1046].forEach((f, k) => tone(f, k * 0.07, 0.2, { type: 'triangle', gain: 0.15 }));
}

// ── Screen effects ────────────────────────────────────────────────
function flash(cls, ms) {
    const el = document.createElement('div');
    el.className = `fx-flash ${cls}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
}

// Damage: the screen shakes and goes red at once, then the red fades fast.
export function damage() {
    flash('fx-red', 600);
    if (reduceMotion()) return;
    const box = document.querySelector('.quiz-card') || document.querySelector('main') || document.body;
    box.classList.remove('fx-shake'); void box.offsetWidth; box.classList.add('fx-shake');
    setTimeout(() => box.classList.remove('fx-shake'), 450);
}

// Streak look: 3+ = green flashes and a green glow, 5+ = green and blue.
export function streakLook(n) {
    document.body.classList.toggle('streak-hot', n >= 3 && n < 5);
    document.body.classList.toggle('streak-fire', n >= 5);
    if (n >= 5) flash('fx-greenblue', 700);
    else if (n >= 3) flash('fx-green', 600);
}

// ── The 5-second countdown before every quiz ─────────────────────
// rules: { title, mistakes, extraLives, seconds }  → calls onGo when the count ends (or «Start now»).
export function countdown(rules, onGo) {
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const m = document.createElement('div');
    m.className = 'modal-overlay active fx-countdown';
    m.innerHTML = `
        <div class="modal-box fx-count-box">
            <div class="fx-count-title">${esc(rules.title)}</div>
            <div class="fx-rule"><span>❌ ALLOWED MISTAKES</span><b>${rules.mistakes}</b></div>
            ${rules.extraLives > 0 ? `<div class="fx-rule"><span>❤️ EXTRA LIVES</span><b>+${rules.extraLives}</b></div>` : ''}
            <div class="fx-rule"><span>⏱️ ${rules.seconds > 0 ? 'EACH QUESTION TIME LIMIT' : 'NO TIMER THIS TIME'}</span><b>${rules.seconds > 0 ? rules.seconds + ' SEC' : '∞'}</b></div>
            <div class="fx-hint">⚡ Answer right in under 2 seconds for a speed streak!</div>
            <div class="fx-count-num" aria-live="assertive">5</div>
            <button class="btn-primary fx-count-go" type="button">Start now</button>
        </div>`;
    document.body.appendChild(m);
    const num = m.querySelector('.fx-count-num');
    let n = 5, done = false;
    const go = () => {
        if (done) return; done = true;
        clearInterval(iv);
        playTick(true);
        num.textContent = 'GO!';
        setTimeout(() => { m.remove(); onGo(); }, 350);
    };
    playTick();
    const iv = setInterval(() => {
        n--;
        if (n <= 0) return go();
        num.textContent = n;
        num.classList.remove('pop'); void num.offsetWidth; num.classList.add('pop');
        playTick();
    }, 1000);
    m.querySelector('.fx-count-go').onclick = go;
}
