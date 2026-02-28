// ─────────────────────────────────────────────────────────────────────────────
//  EiFF Hero — Vanilla-Canvas Wire-mesh Wave Background
//  No Three.js dependency — pure Canvas 2D, works on GitHub Pages & local
// ─────────────────────────────────────────────────────────────────────────────
(function () {
    const container = document.getElementById('wave-canvas-container');
    if (!container) return;

    // Create canvas
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    // Grid settings
    const COLS = 55;   // horizontal points
    const ROWS = 28;   // vertical points
    let W, H, colGap, rowGap;

    function resize() {
        W = canvas.width = container.offsetWidth;
        H = canvas.height = container.offsetHeight;
        colGap = W / (COLS - 1);
        rowGap = H / (ROWS - 1);
    }
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // Pre-compute phase offsets per vertex for organic variation
    const phase = [];
    for (let r = 0; r < ROWS; r++) {
        phase[r] = [];
        for (let c = 0; c < COLS; c++) {
            phase[r][c] = Math.random() * Math.PI * 2;
        }
    }

    // Get displaced Y for a grid vertex
    function vy(r, c, t) {
        const baseY = r * rowGap;
        const xNorm = c / COLS;
        const rNorm = r / ROWS;
        const amp = H * 0.055 * (0.4 + rNorm * 0.6);   // deeper rows move more
        return baseY
            + Math.sin(xNorm * 6 + t * 0.55 + phase[r][c]) * amp
            + Math.cos(xNorm * 3.5 + t * 0.35 + rNorm * 2) * amp * 0.45;
    }

    // Get displaced X for a grid vertex (subtle horizontal drift)
    function vx(r, c, t) {
        const baseX = c * colGap;
        const drift = colGap * 0.06;
        return baseX + Math.sin(r * 0.7 + t * 0.3) * drift;
    }

    let t = 0;
    function draw() {
        requestAnimationFrame(draw);
        t += 0.005;   // slow drift

        // Clear
        ctx.clearRect(0, 0, W, H);

        // Draw horizontal lines (row-by-row)
        for (let r = 0; r < ROWS; r++) {
            ctx.beginPath();
            for (let c = 0; c < COLS; c++) {
                const x = vx(r, c, t);
                const y = vy(r, c, t);
                if (c === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            // Fade near edges
            const alpha = 0.10 + 0.18 * Math.sin((r / ROWS) * Math.PI);
            ctx.strokeStyle = `rgba(100, 155, 220, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
        }

        // Draw vertical lines (col-by-col)
        for (let c = 0; c < COLS; c++) {
            ctx.beginPath();
            for (let r = 0; r < ROWS; r++) {
                const x = vx(r, c, t);
                const y = vy(r, c, t);
                if (r === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            const alpha = 0.07 + 0.12 * Math.sin((c / COLS) * Math.PI);
            ctx.strokeStyle = `rgba(100, 155, 220, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
        }
    }

    draw();
})();
