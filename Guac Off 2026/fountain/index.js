'use strict';

// Defensive: this project does not use a service worker — clear any stale one
// left by a sibling project on a shared origin (see global dev-isolation rule).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function (rs) {
    rs.forEach(function (r) { r.unregister(); });
  });
}

// Water-pour interaction for the Vaillancourt Fountain.
// Tilt the phone to steer gravity; droplets pour from each spout and fall.
(function () {
  const H = window.FountainHelpers;
  const C = H.constants;
  const SPOUTS = H.SPOUTS;
  const STROKE_STYLE = 'rgba(' + C.WATER_RGB + ', ' + C.STREAK_ALPHA + ')';  // invariant

  // --- DOM ---
  const fountainImg = document.querySelector('.fountain');
  const canvas = document.getElementById('water');
  const ctx = canvas.getContext('2d');
  const coverEl = document.getElementById('cover');
  const playBtn = document.getElementById('play-btn');
  const hintEl = document.getElementById('hint');

  // --- Layout (recomputed on start + resize) ---
  let DPR = 1, VW = 0, VH = 0, poolY = 0;
  let imgBox = { left: 0, top: 0, width: 0, height: 0 };
  let poolGrad = null;   // pool shimmer gradient, rebuilt on layout change

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
    poolY = VH * C.POOL_FRAC;
    poolGrad = ctx.createLinearGradient(0, poolY, 0, VH);
    poolGrad.addColorStop(0, 'rgba(' + C.WATER_RGB + ', 0.04)');
    poolGrad.addColorStop(1, 'rgba(' + C.WATER_RGB + ', 0.12)');
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

  // --- Per-spout emission accumulators ---
  const acc = SPOUTS.map(function () { return 0; });

  // --- Render loop ---
  let last = 0;
  const bounds = { w: 0, h: 0, margin: C.CULL_MARGIN, poolY: 0 };

  function tick(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;   // clamp big steps after backgrounding

    const g = H.gravityPx(smoothBeta, smoothGamma);

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

    // Integrate + cull (swap-remove dead from active)
    bounds.w = VW; bounds.h = VH; bounds.poolY = poolY;
    for (let k = active.length - 1; k >= 0; k--) {
      const i = active[k];
      const p = pool[i];
      H.integrate(p, g.x, g.y, dt, C.DRAG);
      if (H.isDead(p, bounds)) {
        active[k] = active[active.length - 1];
        active.pop();
        free.push(i);
      }
    }

    // Faint pool shimmer at the bottom
    ctx.clearRect(0, 0, VW, VH);
    ctx.fillStyle = poolGrad;
    ctx.fillRect(0, poolY, VW, VH - poolY);

    // Draw streaks (one batched path)
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
    // The fountain image may finish decoding after start(); re-measure when it does.
    if (!fountainImg.complete) fountainImg.addEventListener('load', computeLayout);
    last = performance.now();
    requestAnimationFrame(tick);
    // After a beat, tailor the hint to whether real tilt is arriving.
    setTimeout(function () {
      showHint(tiltActive
        ? 'Tilt your phone to steer the water 💧'
        : 'Motion is off — water falls straight down 💧');
    }, 1200);
  }

  playBtn.addEventListener('click', async function () {
    // First await MUST be the permission request to stay inside the gesture frame.
    await requestMotionPermission();
    start();
  });
})();
