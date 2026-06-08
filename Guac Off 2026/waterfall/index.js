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

    // full-page sim so water can crash UP past the seam (over the fountain), then settle to it
    let W = 0, H = 0, seamY = 0, detailsH = 0, restFill = 1;
    function sizePool() {
      const vv = window.visualViewport;
      W = vv ? vv.width : window.innerWidth;
      H = vv ? vv.height : window.innerHeight;     // the actually-visible height (excludes the mobile URL bar)
      document.body.style.height = H + 'px';       // pin the page to the visible viewport so the details don't run below the fold (scroll stops at the footer)
      pool.style.width = W + 'px'; pool.style.height = H + 'px'; // match display size to the backing store -> no vertical stretch
      const r = details.getBoundingClientRect();
      seamY = r.top; detailsH = r.height;
      restFill = Math.max(0, Math.min(1, 1 - seamY / H)); // resting waterline sits at the seam (event top)
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      pool.width = Math.round(W * dpr); pool.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (doc) doc.scrollTop = Math.min(doc.scrollTop, Math.max(0, doc.scrollHeight - doc.clientHeight)); // never leave the panel scrolled past its content (no empty space below the footer)
    }
    sizePool();
    window.addEventListener('resize', sizePool);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', sizePool); // URL-bar show/hide

    const surf = { dir: { x: 0, y: 1 }, vel: { x: 0, y: 0 } };
    let rawGamma = 0;   // latest left/right tilt (degrees) from the device
    let sGamma = 0;     // smoothed tilt; streams & pool read it with different sensitivity
    let wavePhase = 0;  // animates the surface ripples
    let tiltOn = false;
    let surge = 0;                      // transient crash-up above the seam, driven by slosh speed
    let fill = 0, fillTarget = 1;       // intro fills to the seam
    const FILL_MS = 5000;
    let startT = 0;
    const SPLASH = [];

    // optional debug/demo: #tilt=beta,gamma forces a tilt (no device needed)
    const th = location.hash.match(/\btilt=(-?[\d.]+),(-?[\d.]+)(?:,(-?[\d.]+))?/);
    let forceSurge = null;
    if (th) { rawGamma = parseFloat(th[2]); sGamma = rawGamma; tiltOn = true; fill = restFill; fillTarget = restFill; if (th[3] != null) forceSurge = parseFloat(th[3]); }

    function spawnSplashes(n) {
      const dy = surf.dir.y || 1;
      const level = P.surfaceLevel(surf.dir, W, H, fill);
      const slosh = Math.hypot(surf.vel.x, surf.vel.y);   // harder slosh => spray crashes higher (over the fountain)
      for (let i = 0; i < n; i++) {
        if (SPLASH.length >= K.SPLASH_CAP) break;
        const x = Math.random() * W;
        let y = (level - x * surf.dir.x) / dy; y = Math.max(0, Math.min(H, y));
        const ux = -surf.dir.x, uy = -surf.dir.y, a = (Math.random() - 0.5) * 1.1;
        const cs = Math.cos(a), sn = Math.sin(a), sp = 300 + Math.random() * 280 + Math.min(slosh * 220, 520);
        SPLASH.push({ x: x, y: y, px: x, py: y, vx: (ux * cs - uy * sn) * sp, vy: (ux * sn + uy * cs) * sp, life: K.SPLASH_LIFE });
      }
    }

    function draw(poly) {
      ctx.clearRect(0, 0, W, H);
      if (poly.length >= 3) {
        // find the water surface edge (the polygon edge not lying on a screen border)
        let si = -1;
        for (let i = 0; i < poly.length; i++) {
          const A = poly[i], B = poly[(i + 1) % poly.length];
          const border = (A.x < 0.5 && B.x < 0.5) || (A.x > W - 0.5 && B.x > W - 0.5) || (A.y < 0.5 && B.y < 0.5) || (A.y > H - 0.5 && B.y > H - 0.5);
          if (!border) { si = i; break; }
        }
        // sample a rippling line across that edge (perpendicular sine offset, two waves)
        let surfPts = null;
        if (si >= 0) {
          const A = poly[si], B = poly[(si + 1) % poly.length];
          const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len, ny = dx / len, SEG = 28;
          surfPts = [];
          for (let k = 0; k <= SEG; k++) {
            const t = k / SEG;
            const w = K.WAVE_AMP * Math.sin(t * K.WAVE_FREQ * 6.2832 + wavePhase) + K.WAVE_AMP2 * Math.sin(t * K.WAVE_FREQ2 * 6.2832 - wavePhase * 1.3);
            surfPts.push({ x: A.x + dx * t + nx * w, y: A.y + dy * t + ny * w });
          }
        }
        // water body — rippling top where we found a surface edge, else the raw polygon
        ctx.beginPath();
        if (surfPts) {
          ctx.moveTo(surfPts[0].x, surfPts[0].y);
          for (let k = 1; k < surfPts.length; k++) ctx.lineTo(surfPts[k].x, surfPts[k].y);
          for (let k = 2; k < poly.length; k++) { const v = poly[(si + k) % poly.length]; ctx.lineTo(v.x, v.y); }
        } else {
          ctx.moveTo(poly[0].x, poly[0].y);
          for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
        }
        ctx.closePath();
        const gd = surf.dir;
        const grad = ctx.createLinearGradient(W / 2 - gd.x * H, H / 2 - gd.y * H, W / 2 + gd.x * H, H / 2 + gd.y * H);
        grad.addColorStop(0, 'rgba(' + K.TINT + ', 0.16)');
        grad.addColorStop(1, 'rgba(' + K.TINT + ', 0.40)');
        ctx.fillStyle = grad; ctx.fill();
        // single, slightly-blue rippling waterline
        if (surfPts) {
          ctx.strokeStyle = 'rgba(170, 214, 240, 0.9)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(surfPts[0].x, surfPts[0].y);
          for (let k = 1; k < surfPts.length; k++) ctx.lineTo(surfPts[k].x, surfPts[k].y);
          ctx.stroke();
        }
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
      if (reduce && !tiltOn) fill = restFill;
      else if (!tiltOn) fill = restFill * (window.WaterfallFlood ? window.WaterfallFlood.floodLevel(now - startT, FILL_MS) : 1);
      else fill += (fillTarget - fill) * Math.min(1, dt * 3);

      // smooth the raw left/right tilt; streams & pool read it with DIFFERENT sensitivity
      sGamma += ((tiltOn ? rawGamma : 0) - sGamma) * Math.min(1, dt * 5);
      // fountain streams: aggressive, soft-saturated (tanh => move far, never a hard stop)
      if (tiltOn) config.wind = P.clamp(K.WIND_MAG * Math.tanh(sGamma / K.STREAM_FULL_DEG), -K.WIND_CAP, K.WIND_CAP);
      // pool surface: gentle + less sensitive — a small soft-saturated slope toward the tilt
      const slope = K.POOL_MAX_SLOPE * Math.tanh(sGamma / K.POOL_FULL_DEG);
      const pm = Math.hypot(slope, 1), poolTarget = { x: slope / pm, y: 1 / pm };
      const ns = P.sloshStep(surf, poolTarget, dt, K.SLOSH_K, K.SLOSH_DAMP);
      surf.dir = ns.dir; surf.vel = ns.vel;
      const surgeT = tiltOn ? Math.min(Math.hypot(surf.vel.x, surf.vel.y) * K.SURGE_GAIN, K.SURGE_MAX) : 0;
      if (forceSurge != null) surge = forceSurge; // debug/demo override (#tilt=beta,gamma,surge)
      else surge += (surgeT - surge) * Math.min(1, dt * 8); // crash up on a fast slosh, settle back to the seam
      wavePhase += dt * K.WAVE_SPEED;

      if (tiltOn) { const n = P.splashCount(Math.hypot(surf.vel.x, surf.vel.y), K.SPLASH_SPEED, 30); if (n) spawnSplashes(n); }
      const ggx = poolTarget.x * K.GRAVITY_SCALE, ggy = poolTarget.y * K.GRAVITY_SCALE;
      for (let i = SPLASH.length - 1; i >= 0; i--) {
        const sp = SPLASH[i]; P.integrate(sp, ggx, ggy, dt, K.SPLASH_DRAG);
        if (sp.life <= 0 || sp.y > H + 40 || sp.x < -40 || sp.x > W + 40) { SPLASH[i] = SPLASH[SPLASH.length - 1]; SPLASH.pop(); }
      }

      const level = P.surfaceLevel(surf.dir, W, H, Math.min(1, fill + surge)); // fill (to the seam) + transient crash-up
      const poly = P.clipRectBelow(W, H, surf.dir, level);          // full-page water body
      const levelD = level - seamY * surf.dir.y;                    // same surface, expressed in details-local space
      doc.style.clipPath = P.pointsToClipPath(P.clipRectBelow(W, detailsH, surf.dir, levelD)); // reveal follows the surface
      draw(poly);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    function onOrient(e) { rawGamma = e.gamma || 0; }
    // iOS Safari only shows the motion-permission dialog for a click/tap gesture — a
    // pointerdown/touchstart-initiated requestPermission() silently hangs. So enable
    // ONLY from the pill's click (matching the working /fountain/ page), and don't latch
    // "active" until permission actually succeeds, so a denied/failed tap can retry.
    let tiltActive = false, requesting = false;
    async function enableTilt() {
      if (tiltActive || requesting || !coarse) return;
      requesting = true;
      try {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
          const res = await DeviceOrientationEvent.requestPermission();
          if (res !== 'granted') { requesting = false; if (tiltBtn) tiltBtn.textContent = 'motion is off'; return; }
        }
      } catch (e) { requesting = false; if (tiltBtn) tiltBtn.textContent = 'tap again to allow motion'; return; }
      window.addEventListener('deviceorientation', onOrient);
      tiltActive = true; tiltOn = true; fillTarget = restFill;
      if (tiltBtn) tiltBtn.classList.add('hide');
      if (doc) { doc.classList.remove('wf-has-pill'); doc.scrollTop = Math.min(doc.scrollTop, Math.max(0, doc.scrollHeight - doc.clientHeight)); } // pill gone -> drop the reserved space + re-clamp
    }
    if (coarse && tiltBtn) {
      tiltBtn.classList.add('show');
      if (doc) doc.classList.add('wf-has-pill'); // reserve room so the pill doesn't cover the footer
      tiltBtn.addEventListener('click', enableTilt);
    }

    // "scroll down" button: tap to scroll the details; visible while there's more below
    const scrollBtn = document.getElementById('scroll-down');
    if (scrollBtn) {
      const updateScroll = function () {
        if (doc.scrollHeight > doc.clientHeight + 4) scrollBtn.classList.add('show');
        else scrollBtn.classList.remove('show');
        scrollBtn.classList.toggle('atbottom', doc.scrollHeight - doc.clientHeight - doc.scrollTop <= 8);
      };
      updateScroll();
      doc.addEventListener('scroll', updateScroll, { passive: true });
      window.addEventListener('resize', updateScroll);
      if (window.visualViewport) window.visualViewport.addEventListener('resize', updateScroll); // URL-bar show/hide
      scrollBtn.addEventListener('click', function () {
        doc.scrollBy({ top: Math.round(doc.clientHeight * 0.82), behavior: 'smooth' });
      });
    }

    window.addEventListener('pagehide', function () {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', sizePool);
      window.removeEventListener('deviceorientation', onOrient);
    });
  })();

  // lifecycle: tear the engine down when the page is hidden/unloaded
  window.addEventListener('pagehide', function () { wf.destroy(); });
})();
