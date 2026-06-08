'use strict';

// Defensive: this project does not use a service worker — clear any stale one
// left by a sibling project on a shared origin (see global dev-isolation rule).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function (rs) {
    rs.forEach(function (r) { r.unregister(); });
  });
}

// View layer: owns the <canvas> + lifecycle, builds the config (defaults + debug hash),
// mounts the engine, runs the hint-pill fade. Particle data stays inside the engine.
(function () {
  // Debug hash overrides (the only runtime path to presets now the panel is dropped):
  //   #flow=..&spray=..&splash=..&wind=..&speed=..&zoom=cx,cy,scale
  function parseHash() {
    const out = {};
    const h = location.hash.replace(/^#/, '');
    if (!h) return out;
    h.split('&').forEach(function (kv) {
      const i = kv.indexOf('=');
      if (i < 0) return;
      const k = kv.slice(0, i), v = kv.slice(i + 1);
      if (k === 'zoom') { out.zoom = v.split(',').map(Number); return; }
      const num = parseFloat(v);
      if (!isNaN(num) && ['flow', 'spray', 'splash', 'wind', 'speed'].indexOf(k) >= 0) out[k] = num;
    });
    return out;
  }

  const defaults = window.WaterfallConfigDefaults;
  const overrides = parseHash();
  const config = Object.assign({}, defaults, overrides);
  config.tint = (defaults.tint || [232, 244, 255]).slice(); // own copy

  // Mobile / touch devices: a much lighter load so it stays smooth (this is a
  // desktop-first piece). Fewer particles, no mist, and a lower-res backing store —
  // the geometry ribbons keep the columns looking solid regardless of particle count.
  const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  if (coarse) {
    config.flow *= 0.5;
    config.splash *= 0.45;
    config.mist = false;       // skip the expensive per-droplet mist gradients
    config.dprCap = 1;         // 1x backing store — big fill-rate win on retina phones
    config.widthCap = 900;     // cap canvas resolution
    config.maxStream = 2200;   // bound worst-case draw calls
    config.maxSplash = 900;
  }

  const canvas = document.getElementById('water');
  const spouts = window.WaterfallSpouts;

  // optional debug zoom of the frame
  if (overrides.zoom && overrides.zoom.length === 3) {
    const cx = overrides.zoom[0], cy = overrides.zoom[1], scale = overrides.zoom[2];
    const frame = document.querySelector('.frame');
    if (frame) {
      frame.style.transformOrigin = (cx / 2034 * 100) + '% ' + (cy / 1136 * 100) + '%';
      frame.style.transform = 'scale(' + scale + ')';
    }
  }

  const wf = window.createWaterfall({ canvas: canvas, config: config, spouts: spouts });

  // --- tilt-slosh pool: canvas water + per-frame polygon reveal, steered by gravity ---
  // Flat phone => a level waterline rising over ~5s (the old flood); tilt => the pool
  // sloshes, the reveal follows, the streams lean (engine wind), and spray flies.
  (function setupPool() {
    const details = document.getElementById('wf-details');
    const doc = details && details.querySelector('.wf-doc');
    const pool = document.getElementById('pool');
    const tiltBtn = document.getElementById('tilt-enable');
    const P = window.WaterfallPool;
    if (!details || !doc || !pool || !P) { if (doc) doc.style.clipPath = 'none'; return; } // fail safe: show details
    const K = P.K;
    const ctx = pool.getContext('2d');
    const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

    let W = 0, H = 0;
    function sizePool() {
      const r = details.getBoundingClientRect();
      W = r.width; H = r.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      pool.width = Math.round(W * dpr); pool.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    sizePool();
    window.addEventListener('resize', sizePool);

    const surf = { dir: { x: 0, y: 1 }, vel: { x: 0, y: 0 } };
    let gRaw = { x: 0, y: 1 };          // latest gravity from tilt (unit-ish)
    const gSmooth = { x: 0, y: 1 };     // low-passed gravity
    let tiltOn = false;
    let fill = 0, fillTarget = 1;       // intro fills to full
    const FILL_MS = 5000;
    let startT = 0;
    const SPLASH = [];

    // optional debug/demo: #tilt=beta,gamma forces a tilt (no device needed)
    const th = location.hash.match(/\btilt=(-?[\d.]+),(-?[\d.]+)/);
    if (th) { gRaw = P.tiltToGravity(parseFloat(th[1]), parseFloat(th[2])); tiltOn = true; fill = K.RESTING_FILL; fillTarget = K.RESTING_FILL; }

    function spawnSplashes(n) {
      const dy = surf.dir.y || 1;
      const level = P.surfaceLevel(surf.dir, W, H, fill);
      for (let i = 0; i < n; i++) {
        if (SPLASH.length >= K.SPLASH_CAP) break;
        const x = Math.random() * W;
        let y = (level - x * surf.dir.x) / dy; y = Math.max(0, Math.min(H, y));
        const ux = -surf.dir.x, uy = -surf.dir.y, a = (Math.random() - 0.5) * 1.1;
        const cs = Math.cos(a), sn = Math.sin(a), sp = 120 + Math.random() * 160;
        SPLASH.push({ x: x, y: y, px: x, py: y, vx: (ux * cs - uy * sn) * sp, vy: (ux * sn + uy * cs) * sp, life: K.SPLASH_LIFE });
      }
    }

    function draw(poly) {
      ctx.clearRect(0, 0, W, H);
      if (poly.length >= 3) {
        ctx.beginPath(); ctx.moveTo(poly[0].x, poly[0].y);
        for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
        ctx.closePath();
        const gd = surf.dir;
        const grad = ctx.createLinearGradient(W / 2 - gd.x * H, H / 2 - gd.y * H, W / 2 + gd.x * H, H / 2 + gd.y * H);
        grad.addColorStop(0, 'rgba(' + K.TINT + ', 0.16)');
        grad.addColorStop(1, 'rgba(' + K.TINT + ', 0.40)');
        ctx.fillStyle = grad; ctx.fill();
        ctx.strokeStyle = 'rgba(215, 242, 255, 0.92)'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < poly.length; i++) {
          const A = poly[i], B = poly[(i + 1) % poly.length];
          const border = (A.x < 0.5 && B.x < 0.5) || (A.x > W - 0.5 && B.x > W - 0.5) || (A.y < 0.5 && B.y < 0.5) || (A.y > H - 0.5 && B.y > H - 0.5);
          if (!border) { ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); }
        }
        ctx.stroke();
      }
      if (SPLASH.length) {
        ctx.strokeStyle = 'rgba(225, 245, 255, 0.85)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < SPLASH.length; i++) { const p = SPLASH[i]; ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y); }
        ctx.stroke();
      }
    }

    let last = performance.now(), raf = 0;
    function frame(now) {
      let dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05;
      if (!startT) startT = now;
      if (reduce && !tiltOn) fill = 1;
      else if (!tiltOn) fill = (window.WaterfallFlood ? window.WaterfallFlood.floodLevel(now - startT, FILL_MS) : 1);
      else fill += (fillTarget - fill) * Math.min(1, dt * 3);

      gSmooth.x += (gRaw.x - gSmooth.x) * Math.min(1, dt * 6);
      gSmooth.y += (gRaw.y - gSmooth.y) * Math.min(1, dt * 6);
      const gd = P.gravityDir(gSmooth);
      const ns = P.sloshStep(surf, gd, dt, K.SLOSH_K, K.SLOSH_DAMP);
      surf.dir = ns.dir; surf.vel = ns.vel;

      if (tiltOn) { const n = P.splashCount(Math.hypot(surf.vel.x, surf.vel.y), K.SPLASH_SPEED, 24); if (n) spawnSplashes(n); }
      const ggx = gd.x * K.GRAVITY_SCALE, ggy = gd.y * K.GRAVITY_SCALE;
      for (let i = SPLASH.length - 1; i >= 0; i--) {
        const sp = SPLASH[i]; P.integrate(sp, ggx, ggy, dt, K.SPLASH_DRAG);
        if (sp.life <= 0 || sp.y > H + 40 || sp.x < -40 || sp.x > W + 40) { SPLASH[i] = SPLASH[SPLASH.length - 1]; SPLASH.pop(); }
      }

      if (tiltOn) config.wind = P.clamp(gd.x * K.WIND_GAIN, -K.WIND_CAP, K.WIND_CAP); // leave wind alone until tilt is on (keeps any &wind= debug)

      const level = P.surfaceLevel(surf.dir, W, H, fill);
      const poly = P.clipRectBelow(W, H, surf.dir, level);
      doc.style.clipPath = P.pointsToClipPath(poly);
      draw(poly);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    function onOrient(e) { gRaw = P.tiltToGravity(e.beta || 0, e.gamma || 0); }
    let enabled = false;
    async function enableTilt() {
      if (enabled || !coarse) return; enabled = true;
      try {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
          const res = await DeviceOrientationEvent.requestPermission();
          if (res !== 'granted') { if (tiltBtn) { tiltBtn.textContent = 'motion is off'; setTimeout(function () { tiltBtn.classList.add('hide'); }, 1400); } return; }
        }
      } catch (e) { if (tiltBtn) tiltBtn.classList.add('hide'); return; }
      window.addEventListener('deviceorientation', onOrient);
      tiltOn = true; fillTarget = K.RESTING_FILL;
      if (tiltBtn) tiltBtn.classList.add('hide');
    }
    if (coarse && tiltBtn) {
      tiltBtn.classList.add('show');
      tiltBtn.addEventListener('click', enableTilt);
      window.addEventListener('pointerdown', function () { enableTilt(); }, { once: true });
    }

    window.addEventListener('pagehide', function () {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', sizePool);
      window.removeEventListener('deviceorientation', onOrient);
    });
  })();

  // hint pill: fade after 7s or on first click
  const hint = document.getElementById('hint');
  let hintGone = false;
  function hideHint() { if (hintGone) return; hintGone = true; if (hint) hint.classList.add('hide'); }
  setTimeout(hideHint, 7000);
  canvas.addEventListener('click', hideHint, { once: true });

  // lifecycle: tear the engine down when the page is hidden/unloaded
  window.addEventListener('pagehide', function () { wf.destroy(); });
})();
