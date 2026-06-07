'use strict';

// Defensive: this project does not use a service worker — clear any stale one
// left by a sibling project on a shared origin (see global dev-isolation rule).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function (rs) {
    rs.forEach(function (r) { r.unregister(); });
  });
}

// Water-pour interaction for the Vaillancourt Fountain.
// Tilt the phone to steer gravity; droplets pour from each spout, fall, and
// collect into a rising pool whose surface stays level to gravity. Tap to drain.
(function () {
  const H = window.FountainHelpers;
  const C = H.constants;
  const SPOUTS = H.SPOUTS;
  const STROKE_STYLE   = 'rgba(' + C.WATER_RGB + ', ' + C.STREAK_ALPHA + ')';      // streaks (invariant)
  const POOL_BODY_TOP  = 'rgba(' + C.WATER_RGB + ', ' + (C.POOL_ALPHA * 0.55) + ')';
  const POOL_BODY_DEEP = 'rgba(' + C.WATER_RGB + ', ' + C.POOL_ALPHA + ')';
  const SURFACE_STYLE  = 'rgba(' + C.WATER_RGB + ', 0.85)';

  // --- DOM ---
  const fountainImg = document.querySelector('.fountain');
  const canvas = document.getElementById('water');
  const ctx = canvas.getContext('2d');
  const coverEl = document.getElementById('cover');
  const playBtn = document.getElementById('play-btn');
  const hintEl = document.getElementById('hint');

  // --- Layout (recomputed on start + resize) ---
  let DPR = 1, VW = 0, VH = 0;
  let imgBox = { left: 0, top: 0, width: 0, height: 0 };

  function computeLayout() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    VW = window.innerWidth;
    VH = window.innerHeight;
    canvas.width = Math.round(VW * DPR);
    canvas.height = Math.round(VH * DPR);
    canvas.style.width = VW + 'px';
    canvas.style.height = VH + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);   // draw in CSS pixels
    const r = fountainImg.getBoundingClientRect();
    imgBox = { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  // --- Particle pool (fixed size, recycled via a free-index stack) ---
  const N = C.MAX_PARTICLES;
  const pool = new Array(N);
  for (let i = 0; i < N; i++) pool[i] = { x: 0, y: 0, vx: 0, vy: 0, px: 0, py: 0, life: 0 };
  const free = [];
  for (let i = N - 1; i >= 0; i--) free.push(i);
  const active = [];

  function spawn(x, y, vx, vy) {
    if (free.length === 0) return;
    const i = free.pop();
    const p = pool[i];
    p.x = x; p.y = y; p.px = x; p.py = y;
    p.vx = vx; p.vy = vy; p.life = C.PARTICLE_LIFE;
    active.push(i);
  }

  // --- Tilt input (default upright so water falls before the first event) ---
  let smoothBeta = 90, smoothGamma = 0, tiltActive = false;
  function onOrientation(e) {
    tiltActive = true;
    // gamma = left/right roll, beta = front/back pitch. The mapping is verified by
    // math but NOT yet on a device: tilt-left should pour water left. If it reads
    // mirrored in prod, negate the offending axis here, e.g.:
    //   const gamma = -(e.gamma || 0);   // flip if left/right is reversed
    const beta = e.beta || 0;
    const gamma = e.gamma || 0;
    smoothBeta = smoothBeta * 0.85 + beta * 0.15;
    smoothGamma = smoothGamma * 0.85 + gamma * 0.15;
  }

  // --- Pool state ---
  let poolVol = 0;                 // absorbed droplet count
  let draining = false;            // tap-to-drain in progress
  const surfDir = { x: 0, y: 1 };  // smoothed surface normal ("down"), eased for slosh

  // --- Per-spout emission accumulators ---
  const acc = SPOUTS.map(function () { return 0; });

  // --- Render loop ---
  let last = 0;
  const bounds = { w: 0, h: 0, margin: C.CULL_MARGIN, poolY: Infinity };  // pool handled separately

  function tick(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;   // clamp big steps after backgrounding

    const g = H.gravityPx(smoothBeta, smoothGamma);

    // Ease the surface normal toward gravity (slosh lag), then renormalize.
    const gd = H.gravityDir(g);
    surfDir.x += (gd.x - surfDir.x) * C.SURFACE_SMOOTH;
    surfDir.y += (gd.y - surfDir.y) * C.SURFACE_SMOOTH;
    const sm = Math.hypot(surfDir.x, surfDir.y) || 1;
    surfDir.x /= sm; surfDir.y /= sm;

    // Drain, then derive the current fill level.
    if (draining) {
      poolVol -= (C.POOL_CAPACITY / C.DRAIN_TIME) * dt;
      if (poolVol <= 0) { poolVol = 0; draining = false; }
    }
    const fillFrac = Math.min(poolVol / C.POOL_CAPACITY, 1);
    const level = H.surfaceLevel(surfDir, VW, VH, fillFrac);

    // Emit from each spout (framerate-independent via the accumulator)
    for (let s = 0; s < SPOUTS.length; s++) {
      const sp = SPOUTS[s];
      const rate = sp.rate || C.EMIT_RATE;
      const spread = (sp.spread != null) ? sp.spread : C.SPREAD;
      const speed = sp.speed || C.INIT_SPEED;
      acc[s] += rate * dt;
      const scr = H.spoutToScreen(sp, imgBox);
      while (acc[s] >= 1) {
        acc[s] -= 1;
        if (free.length === 0) { acc[s] = 0; break; }
        const v = H.spawnVelocity(sp.dir, spread, speed, Math.random());
        spawn(scr.x, scr.y, v.vx, v.vy);
      }
    }

    // Integrate; absorb submerged droplets into the pool, else cull off-screen/expired.
    bounds.w = VW; bounds.h = VH;
    for (let k = active.length - 1; k >= 0; k--) {
      const i = active[k];
      const p = pool[i];
      H.integrate(p, g.x, g.y, dt, C.DRAG);
      let gone = false;
      if (!draining && H.isSubmerged(p, surfDir, level)) {
        if (poolVol < C.POOL_CAPACITY) poolVol++;   // gate on live volume — never overshoot
        gone = true;
      } else if (H.isDead(p, bounds)) {
        gone = true;
      }
      if (gone) {
        active[k] = active[active.length - 1];
        active.pop();
        free.push(i);
      }
    }

    // --- Draw ---
    ctx.clearRect(0, 0, VW, VH);

    // Streaks first, so they dim into the pool.
    ctx.strokeStyle = STROKE_STYLE;
    ctx.lineWidth = C.LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let k = 0; k < active.length; k++) {
      const p = pool[active[k]];
      ctx.moveTo(p.px, p.py);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // Pool body + waterline, over the fountain so it submerges as it fills.
    if (fillFrac > 0) {
      const poly = H.clipRectBelow(VW, VH, surfDir, level);
      if (poly.length >= 3) {
        // Depth gradient along the surface normal: lighter at the waterline, deeper below.
        const cdot = (VW / 2) * surfDir.x + (VH / 2) * surfDir.y;
        const maxProj = H.surfaceLevel(surfDir, VW, VH, 0);   // deepest projection
        const sx = VW / 2 + surfDir.x * (level - cdot);
        const sy = VH / 2 + surfDir.y * (level - cdot);
        const dx = VW / 2 + surfDir.x * (maxProj - cdot);
        const dy = VH / 2 + surfDir.y * (maxProj - cdot);
        const grad = ctx.createLinearGradient(sx, sy, dx, dy);
        grad.addColorStop(0, POOL_BODY_TOP);
        grad.addColorStop(1, POOL_BODY_DEEP);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(poly[0].x, poly[0].y);
        for (let v = 1; v < poly.length; v++) ctx.lineTo(poly[v].x, poly[v].y);
        ctx.closePath();
        ctx.fill();

        // Waterline: stroke only the surface edge (skip edges lying on a screen border).
        ctx.strokeStyle = SURFACE_STYLE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let v = 0; v < poly.length; v++) {
          const A = poly[v], B = poly[(v + 1) % poly.length];
          const onBorder =
            (A.x < 0.5 && B.x < 0.5) ||
            (A.x > VW - 0.5 && B.x > VW - 0.5) ||
            (A.y < 0.5 && B.y < 0.5) ||
            (A.y > VH - 0.5 && B.y > VH - 0.5);
          if (!onBorder) { ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); }
        }
        ctx.stroke();
      }
    }

    requestAnimationFrame(tick);
  }

  // --- iOS 13+ motion permission (reused discipline from tilt/) ---
  async function requestMotionPermission() {
    const need = typeof DeviceOrientationEvent !== 'undefined'
      && typeof DeviceOrientationEvent.requestPermission === 'function';
    if (!need) return 'granted';   // non-iOS browsers fire events freely
    try {
      const r = await DeviceOrientationEvent.requestPermission();
      return r === 'granted' ? 'granted' : 'denied';
    } catch (e) { return 'denied'; }
  }

  function showHint(text) {
    hintEl.textContent = text;
    hintEl.classList.add('show');
    hintEl.setAttribute('aria-hidden', 'false');
    setTimeout(function () {
      hintEl.classList.remove('show');
      hintEl.setAttribute('aria-hidden', 'true');
    }, 3200);
  }

  function start() {
    coverEl.hidden = true;
    coverEl.setAttribute('aria-hidden', 'true');
    computeLayout();
    window.addEventListener('deviceorientation', onOrientation);
    window.addEventListener('resize', computeLayout);
    window.addEventListener('orientationchange', function () { setTimeout(computeLayout, 200); });
    if (!fountainImg.complete) fountainImg.addEventListener('load', computeLayout);
    // Tap anywhere to drain the pool.
    window.addEventListener('pointerdown', function () { if (poolVol > 0) draining = true; });
    last = performance.now();
    requestAnimationFrame(tick);
    setTimeout(function () {
      showHint(tiltActive
        ? 'Tilt to steer · tap to drain 💧'
        : 'Motion is off — water falls straight down · tap to drain 💧');
    }, 1200);
  }

  playBtn.addEventListener('click', async function () {
    // First await MUST be the permission request to stay inside the gesture frame.
    await requestMotionPermission();
    start();
  });
})();
