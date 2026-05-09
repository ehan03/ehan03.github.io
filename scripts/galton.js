(() => {
    const canvas = document.getElementById('galton');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const hero = canvas.closest('.hero');
    const socials = hero ? hero.querySelector('.socials') : null;
    let W, H;

    const ALIGN_EXTRA_WHITESPACE = 10;
    const MIN_CANVAS_HEIGHT = 150;
    const MAX_CANVAS_HEIGHT = 420;

    function syncCanvasHeightToSocials() {
        if (!socials) return;

        const canvasTop = canvas.getBoundingClientRect().top;
        const socialsBottom = socials.getBoundingClientRect().bottom;
        const target = Math.round(socialsBottom - canvasTop + ALIGN_EXTRA_WHITESPACE);

        if (!Number.isFinite(target) || target <= 0) return;

        const clamped = Math.max(MIN_CANVAS_HEIGHT, Math.min(MAX_CANVAS_HEIGHT, target));
        canvas.style.height = `${clamped}px`;
        canvas.setAttribute('height', String(clamped));
    }

    function resize() {
        syncCanvasHeightToSocials();
        W = canvas.offsetWidth;
        H = canvas.offsetHeight || Number(canvas.getAttribute('height')) || 195;
        canvas.width = W * devicePixelRatio;
        canvas.height = H * devicePixelRatio;
        ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }

    resize();

    const ROWS = 12;
    const BINS = ROWS + 1;
    const BASE_HEIGHT = 340;
    const BALLS_PER_RUN = 200;
    const SPAWN_MS = 74;
    const TOP_PAD = 14;
    const BOTTOM_PAD = 8;
    const PEG_SHARE = 0.5;
    const PEG_TIGHTEN_X = 0.9;
    const PEG_TIGHTEN_Y = 0.9;
    const GAP = 5;
    const FUNNEL_GRAVITY = 0.058;
    const FUNNEL_DRAG_X = 0.972;
    const FUNNEL_CENTER_PULL_BASE = 0.00028;
    const FUNNEL_CENTER_PULL_END = 0.00135;
    const FUNNEL_MAX_VY = 1.18;
    const PATH_GRAVITY = 0.095;
    const PATH_DRAG_X = 0.91;
    const PATH_MAX_VY = 1.55;
    const ARC_GRAVITY = 0.11;
    const ARC_DRAG_X = 0.986;
    const DROP_GRAVITY = 0.13;
    const DROP_DRAG_X = 0.94;
    const DROP_MAX_VY = 2.35;

    function scale() {
        return Math.max(0.55, Math.min(1, H / BASE_HEIGHT));
    }
    function BALL_R() {
        return Math.max(0.72, Math.min(1.38, 1.1 * scale()));
    }
    function PEG_R() {
        return Math.max(0.78, Math.min(1.55, 1.32 * scale()));
    }

    function playTop() {
        return TOP_PAD;
    }
    function playBottom() {
        return H - BOTTOM_PAD;
    }
    function playHeight() {
        return Math.max(90, playBottom() - playTop());
    }
    function pegTop() {
        return playTop() + 4;
    }
    function pegBottom() {
        return playTop() + playHeight() * PEG_SHARE;
    }
    function binTop() {
        return pegFieldBottom() + GAP;
    }
    function binBottom() {
        return playBottom();
    }
    function baseColW() {
        return Math.min((W - 28) / (BINS + 1.5), 15);
    }
    function colW() {
        return baseColW() * PEG_TIGHTEN_X;
    }
    function baseRowSp() {
        return (pegBottom() - pegTop()) / ROWS;
    }
    function rowSp() {
        return baseRowSp() * PEG_TIGHTEN_Y;
    }
    function pegFieldBottom() {
        return pegTop() + rowSp() * ROWS;
    }
    function pegX(r, c) {
        return W / 2 + (c - r / 2) * colW();
    }
    function pegY(r) {
        return pegTop() + (r + 0.5) * rowSp();
    }
    function funnelGeom() {
        const r = BALL_R();
        return {
            topY: Math.max(2, TOP_PAD - 14),
            mouthY: TOP_PAD - 5,
            halfTop: Math.max(8, colW() * 1.95),
            halfMouth: Math.max(r * 1.8, 2.6)
        };
    }
    function binCX(i) {
        return W / 2 + (i - ROWS / 2) * colW();
    }
    function binWX(i) {
        return W / 2 + (i - BINS / 2) * colW();
    }

    let pegs = [];
    function buildPegs() {
        pegs = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c <= r; c++) {
                pegs.push({ x: pegX(r, c), y: pegY(r) });
            }
        }
    }
    buildPegs();

    function buildPath(dirs) {
        const fg = funnelGeom();
        const pts = [{ x: W / 2, y: fg.mouthY, kick: 0 }];
        let col = 0;
        for (let r = 0; r < ROWS; r++) {
            const kick = dirs[r];
            const contact = pegContact(r, col, kick);
            pts.push({ x: contact.x, y: contact.y, kick });
            if (dirs[r] > 0) col++;
        }
        pts.push({ x: binCX(col), y: -1, kick: 0 });
        return pts;
    }

    function pegContact(r, c, kick) {
        const reach = PEG_R() + BALL_R() * 0.9;
        return {
            // Hit the upper shoulder of the peg so the ball appears to glance off before dropping.
            x: pegX(r, c) - kick * reach * 0.95,
            y: pegY(r) - reach * 0.35
        };
    }

    function nChooseK(n, k) {
        if (k < 0 || k > n) return 0;
        if (k === 0 || k === n) return 1;
        const kk = Math.min(k, n - k);
        let val = 1;
        for (let i = 1; i <= kk; i++) {
            val = (val * (n - kk + i)) / i;
        }
        return val;
    }

    const PMF = Array.from({ length: BINS }, (_, k) => nChooseK(ROWS, k) * (0.5 ** ROWS));
    const PMF_PEAK = Math.max(...PMF);

    let bitPool = 0;
    let bitIndex = 32;
    function randomBit() {
        if (bitIndex >= 32) {
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const arr = new Uint32Array(1);
                crypto.getRandomValues(arr);
                bitPool = arr[0] >>> 0;
            } else {
                bitPool = (Math.random() * 0x100000000) >>> 0;
            }
            bitIndex = 0;
        }
        const bit = (bitPool >>> bitIndex) & 1;
        bitIndex++;
        return bit;
    }

    let binCounts, binLanding, balls, spawned, spawnTimer, lastT, runBallTarget;
    let fadeAlpha, fadeT, phase, holdTimer, holdMs;

    function initState() {
        binCounts = new Array(BINS).fill(0);
        binLanding = new Array(BINS).fill(0);
        balls = [];
        spawned = 0;
        runBallTarget = BALLS_PER_RUN;
        spawnTimer = 0;
        fadeAlpha = 0;
        fadeT = 0;
        phase = 'fadein';
        holdTimer = 0;
        holdMs = 2400;
    }
    initState();

    function stackPitch() {
        const r = BALL_R();
        return r * 2 + 0.26;
    }

    function slotY(slot) {
        const r = BALL_R();
        const y = binBottom() - r - slot * stackPitch();
        return Math.max(binTop() + r, y);
    }

    class Ball {
        constructor() {
            const dropSide = randomBit() === 0 ? -1 : 1;
            const dirs = Array.from({ length: ROWS }, () => (randomBit() === 0 ? -1 : 1));
            // Preserve 50/50 branching, while making first peg deflect opposite the funnel entry side.
            dirs[0] = -dropSide;
            this.bin = dirs.reduce((acc, d) => acc + (d > 0 ? 1 : 0), 0);
            this.pts = buildPath(dirs);
            const fg = funnelGeom();
            const r = BALL_R();
            const sideFrac = 0.26 + Math.random() * 0.68;
            const sideJitter = (Math.random() * 2 - 1) * r * 0.35;
            const maxOffset = Math.max(r, fg.halfTop - r * 0.9);
            this.dropSide = dropSide;
            this.entryBoost = 0.15 + Math.random() * 0.05;
            this.arcJitter = (Math.random() * 2 - 1) * 0.025;
            this.seg = 0;
            this.x = W / 2 + Math.max(-maxOffset, Math.min(maxOffset, dropSide * fg.halfTop * sideFrac + sideJitter));
            this.y = fg.topY - r - Math.random() * 6;
            this.vx = dropSide * (0.05 + Math.random() * 0.04);
            this.vy = 0.02 + Math.random() * 0.08;
            this.done = false;
            this.counted = false;
            this.slot = null;
            this.phase = 'funnel';
            this.funnelAge = 0;
            this.arcFrames = 0;
            this.spd = 1.35 + Math.random() * 0.55;
        }

        updateFunnel() {
            const fg = funnelGeom();
            const r = BALL_R();
            this.funnelAge++;

            const t = Math.max(0, Math.min(1, (this.y - fg.topY) / Math.max(1, fg.mouthY - fg.topY)));
            const gravityNow = FUNNEL_GRAVITY * (0.55 + 0.9 * t);
            const centerPull = FUNNEL_CENTER_PULL_BASE + (FUNNEL_CENTER_PULL_END - FUNNEL_CENTER_PULL_BASE) * t * t;

            this.vy = Math.min(FUNNEL_MAX_VY, this.vy + gravityNow);
            this.vx += (W / 2 - this.x) * centerPull;
            this.vx *= FUNNEL_DRAG_X;
            this.x += this.vx;
            this.y += this.vy;

            if (this.y >= fg.topY && this.y <= fg.mouthY + r) {
                const t = (this.y - fg.topY) / Math.max(1, fg.mouthY - fg.topY);
                const half = fg.halfTop + (fg.halfMouth - fg.halfTop) * t;
                const leftX = W / 2 - half;
                const rightX = W / 2 + half;

                if (this.x - r < leftX) {
                    this.x = leftX + r;
                    this.vx = Math.abs(this.vx) * 0.3 + 0.02;
                    this.vy *= 0.9;
                }
                if (this.x + r > rightX) {
                    this.x = rightX - r;
                    this.vx = -Math.abs(this.vx) * 0.3 - 0.02;
                    this.vy *= 0.9;
                }
            }

            if (this.y >= fg.mouthY - r * 0.2
                && (Math.abs(this.x - W / 2) <= fg.halfMouth + r * 1.25 || this.funnelAge > 250)) {
                this.phase = 'path';
                this.y = this.pts[0].y;
                this.x = this.x * 0.6 + this.pts[0].x * 0.4;
                this.vx *= 0.45;
                this.vy = Math.max(0.16, this.vy * 0.34);
            }
        }

        launchArc(kick) {
            const jitter = this.arcJitter + (Math.random() * 2 - 1) * 0.02;
            this.vx = kick * (0.58 + jitter);
            this.vy = -(0.52 + jitter * 0.5);
            this.arcFrames = 6 + (Math.random() < 0.5 ? 0 : 1);
            // Keep some funnel-entry momentum at first peg to sell the side-to-side handoff.
            if (this.seg === 1) {
                this.vx += -this.dropSide * this.entryBoost;
            }
        }

        update() {
            if (this.done) return;
            if (this.phase === 'funnel') {
                this.updateFunnel();
                return;
            }

            const ni = this.seg + 1;
            if (ni >= this.pts.length) {
                this.done = true;
                return;
            }

            if (ni === this.pts.length - 1 && this.slot === null) {
                this.slot = binCounts[this.bin] + binLanding[this.bin];
                binLanding[this.bin]++;
            }

            const tx = this.pts[ni].x;
            const ty = this.pts[ni].y === -1 ? slotY(this.slot) : this.pts[ni].y;

            if (ni === this.pts.length - 1) {
                // Final bin entry uses ballistic motion so the ball visibly accelerates into the stack.
                this.vy = Math.min(DROP_MAX_VY, this.vy + DROP_GRAVITY);
                const xErr = tx - this.x;
                this.vx *= DROP_DRAG_X * 0.72;
                this.vx += xErr * 0.03;
                const nextX = this.x + this.vx + xErr * 0.1;
                // Clamp to the target if this step would overshoot, preventing side-to-side shimmy.
                if ((tx - this.x) * (tx - nextX) <= 0) {
                    this.x = tx;
                    this.vx = 0;
                } else {
                    this.x = nextX;
                }
                this.y += this.vy;

                if (this.y >= ty) {
                    this.y = ty;
                    this.x = tx;
                    this.done = true;
                    if (!this.counted) {
                        this.counted = true;
                        binLanding[this.bin] = Math.max(0, binLanding[this.bin] - 1);
                        binCounts[this.bin]++;
                    }
                }
                return;
            }

            if (this.arcFrames > 0) {
                this.arcFrames--;
                this.vy = Math.min(PATH_MAX_VY, this.vy + ARC_GRAVITY);
                this.vx *= ARC_DRAG_X;
                this.x += this.vx;
                this.y += this.vy;

                const adx = tx - this.x;
                const ady = ty - this.y;
                if (Math.sqrt(adx * adx + ady * ady) < this.spd + 0.44) {
                    this.x = tx;
                    this.y = ty;
                    this.seg++;
                    if (ni < this.pts.length - 1) {
                        const kick = this.pts[ni].kick;
                        this.launchArc(kick);
                    } else {
                        this.done = true;
                        if (!this.counted) {
                            this.counted = true;
                            binLanding[this.bin] = Math.max(0, binLanding[this.bin] - 1);
                            binCounts[this.bin]++;
                        }
                    }
                    return;
                }

                if (this.arcFrames > 0) {
                    return;
                }
            }

            const dx = tx - this.x;
            const dy = ty - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < this.spd + 0.32) {
                this.x = tx;
                this.y = ty;
                this.seg++;
                if (ni < this.pts.length - 1) {
                    const kick = this.pts[ni].kick;
                    this.launchArc(kick);
                } else {
                    this.done = true;
                    if (!this.counted) {
                        this.counted = true;
                        binLanding[this.bin] = Math.max(0, binLanding[this.bin] - 1);
                        binCounts[this.bin]++;
                    }
                }
            } else {
                this.vy = Math.min(PATH_MAX_VY, this.vy + PATH_GRAVITY * 0.45);
                this.vx *= PATH_DRAG_X;
                const nx = dx / dist;
                const ny = dy / dist;
                this.x += nx * this.spd + this.vx * 0.32;
                this.y += ny * this.spd + this.vy * 0.24;
                if (Math.abs(this.x - tx) > colW() * 1.1) this.x += (tx - this.x) * 0.16;
            }
        }
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);
        ctx.globalAlpha = fadeAlpha;
        const cw = colW();
        const bt = binTop();
        const bb = binBottom();
        const ballR = BALL_R();
        const pegR = PEG_R();
        const pitch = stackPitch();
        const fg = funnelGeom();

        ctx.beginPath();
        ctx.moveTo(W / 2 - fg.halfTop, fg.topY);
        ctx.lineTo(W / 2 - fg.halfMouth, fg.mouthY);
        ctx.moveTo(W / 2 + fg.halfTop, fg.topY);
        ctx.lineTo(W / 2 + fg.halfMouth, fg.mouthY);
        ctx.strokeStyle = '#d3d1c7';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        ctx.strokeStyle = '#e2dfd6';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(binWX(0), bt);
        ctx.lineTo(binWX(BINS), bt);
        ctx.stroke();

        ctx.strokeStyle = '#d3d1c7';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= BINS; i++) {
            ctx.beginPath();
            ctx.moveTo(binWX(i), bt);
            ctx.lineTo(binWX(i), bb);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(binWX(0), bb);
        ctx.lineTo(binWX(BINS), bb);
        ctx.stroke();

        for (let i = 0; i < BINS; i++) {
            const bx = binCX(i);
            for (let j = 0; j < binCounts[i]; j++) {
                const by = bb - ballR - j * pitch;
                if (by < bt) break;
                ctx.beginPath();
                ctx.arc(bx, by, ballR, 0, Math.PI * 2);
                ctx.fillStyle = '#2a6b4e';
                ctx.globalAlpha = fadeAlpha * 0.78;
                ctx.fill();
            }
        }

        const mean = ROWS / 2;
        const sigma = Math.sqrt(ROWS * 0.25);
        const peakExpected = PMF_PEAK * runBallTarget;
        const peakG = 1 / (sigma * Math.sqrt(2 * Math.PI));
        ctx.beginPath();
        let started = false;
        const x0 = binWX(0);
        const x1 = binWX(BINS);
        for (let px = x0; px <= x1; px += 0.5) {
            // Convert x to bin-center coordinates so the normal curve peaks at the middle bin.
            const binI = (px - x0) / cw - 0.5;
            const g = Math.exp(-0.5 * ((binI - mean) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
            const y = bb - (g / peakG) * peakExpected * pitch;
            if (y < bt) {
                started = false;
                continue;
            }
            if (started) {
                ctx.lineTo(px, y);
            } else {
                ctx.moveTo(px, y);
                started = true;
            }
        }
        ctx.strokeStyle = '#c84b2a';
        ctx.lineWidth = 1.3;
        ctx.globalAlpha = fadeAlpha * 0.88;
        ctx.stroke();

        for (const b of balls) {
            if (b.done) continue;
            ctx.beginPath();
            ctx.arc(b.x, b.y, ballR, 0, Math.PI * 2);
            ctx.fillStyle = '#2a6b4e';
            ctx.globalAlpha = fadeAlpha * 0.88;
            ctx.fill();
        }

        // Draw pegs in the foreground so contacts read as actual collisions, not pass-through.
        for (const p of pegs) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, pegR, 0, Math.PI * 2);
            ctx.fillStyle = '#b4b2a9';
            ctx.globalAlpha = fadeAlpha;
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    }

    function frame(now) {
        const dt = Math.min(now - lastT || 0, 32);
        lastT = now;

        if (phase === 'fadein') {
            fadeT += dt;
            fadeAlpha = Math.min(1, fadeT / 500);
            if (fadeAlpha >= 1) {
                fadeAlpha = 1;
                phase = 'run';
            }
        } else if (phase === 'run') {
            spawnTimer += dt;
            while (spawnTimer >= SPAWN_MS && spawned < runBallTarget) {
                balls.push(new Ball());
                spawned++;
                spawnTimer -= SPAWN_MS;
            }
            for (const b of balls) b.update();
            if (spawned >= runBallTarget && balls.every((b) => b.done)) {
                phase = 'hold';
                holdTimer = 0;
                holdMs = 1800 + Math.random() * 1200;
            }
        } else if (phase === 'hold') {
            holdTimer += dt;
            if (holdTimer > holdMs) {
                phase = 'fadeout';
                fadeT = 0;
            }
        } else if (phase === 'fadeout') {
            fadeT += dt;
            fadeAlpha = Math.max(0, 1 - fadeT / 700);
            if (fadeAlpha <= 0) {
                initState();
            }
        }

        draw();
        requestAnimationFrame(frame);
    }

    lastT = 0;
    requestAnimationFrame((ts) => {
        lastT = ts;
        frame(ts);
    });

    window.addEventListener('resize', () => {
        resize();
        buildPegs();
        initState();
    });

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            resize();
            buildPegs();
            initState();
        });
    }
})();
