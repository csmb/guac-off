'use strict';
// Waterfall simulation engine — ported from docs/design_handoff_waterfall/waterfall.js.
// Factory: createWaterfall({ canvas, config, spouts }) -> { destroy, resize }.
// All physics authored in image space (2034x1136), scaled to the canvas each frame.
(function () {
  const H = window.WaterfallHelpers;
  const K = H.K;
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function createWaterfall(opts) {
    const canvas = opts.canvas;
    const CFG = opts.config;
    const SPOUTS = opts.spouts;
    const ctx = canvas.getContext('2d', { alpha: true });

    let CW = 0, CH = 0, S = 1; // S = canvas px per image px
    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, CFG.dprCap || K.DPR_CAP);
      const targetW = Math.min(rect.width * dpr, CFG.widthCap || K.WIDTH_CAP);
      S = targetW / K.IMG_W;
      CW = Math.round(K.IMG_W * S);
      CH = Math.round(K.IMG_H * S);
      canvas.width = CW;
      canvas.height = CH;
    }

    // particle pools (plain mutable arrays — never reactive)
    const stream = [], mist = [], splash = [], ripples = [];

    // mouse wind
    const mouse = { x: -999, y: -999, px: -999, py: -999, vx: 0, vy: 0, active: false };
    function imgFromEvent(e) {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width * K.IMG_W, y: (e.clientY - r.top) / r.height * K.IMG_H };
    }
    function onMove(e) {
      const p = imgFromEvent(e);
      mouse.vx = p.x - mouse.x; mouse.vy = p.y - mouse.y;
      mouse.px = mouse.x; mouse.py = mouse.y;
      mouse.x = p.x; mouse.y = p.y; mouse.active = true;
    }
    function onLeave() { mouse.active = false; mouse.x = mouse.y = -999; }
    function onClick(e) {
      const p = imgFromEvent(e);
      let best = null, bd = 1e9;
      for (const s of SPOUTS) {
        const cx = s.x, cy = (s.y + s.splashY) / 2;
        const d = Math.hypot(p.x - cx, (p.y - cy) * 0.6);
        if (d < bd) { bd = d; best = s; }
      }
      if (best && bd < 170) {
        best.on = !best.on;
        if (typeof CFG.onSpoutToggle === 'function') CFG.onSpoutToggle();
      }
    }
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('click', onClick);
    window.addEventListener('resize', resize);

    // ---- spawning ----
    function spawnStream(s, dt) {
      if (!s.on) return;
      if (s.kind === 'jet') { spawnJet(s, dt); return; }
      const rate = CFG.flow * s.w * K.FALL_EMIT * dt;
      const step = H.emitStep(s._acc || 0, rate);
      s._acc = step.acc;
      let n = step.n;
      if (stream.length > (CFG.maxStream || K.MAX_STREAM)) n = 0;
      for (let i = 0; i < n; i++) {
        const off = rnd(-s.w / 2, s.w / 2);
        stream.push({
          x: s.x + off, y: s.y + rnd(-3, 3),
          px: s.x + off, py: s.y,
          vx: s.lean + off * 0.008 + rnd(-0.1, 0.1),
          vy: s.v0 + rnd(-0.4, 0.8),
          w: rnd(1.1, 2.6) + Math.max(0, 1.4 - Math.abs(off) / (s.w / 2) * 1.4),
          b: rnd(0.55, 1.0),
          splashY: s.splashY + rnd(-6, 6),
          sp: s, jet: false,
        });
      }
      if (!s.behind && CFG.mist && Math.random() < 0.5 * CFG.spray * dt) spawnMist(s.x + rnd(-s.w / 2, s.w / 2), s.y + rnd(0, 40), 0.5);
    }

    function spawnJet(s, dt) {
      const rate = CFG.flow * s.w * K.JET_EMIT * dt;
      const step = H.emitStep(s._acc || 0, rate);
      s._acc = step.acc;
      let n = step.n;
      if (stream.length > (CFG.maxStream || K.MAX_STREAM)) n = 0;
      for (let i = 0; i < n; i++) {
        const ang = rnd(-0.22, 0.22);
        const sp = s.v0 * rnd(0.62, 1.05);
        stream.push({
          x: s.x + rnd(-7, 7), y: s.y, px: s.x, py: s.y,
          vx: Math.sin(ang) * sp + rnd(-0.25, 0.25), vy: -Math.cos(ang) * sp,
          w: rnd(1.0, 2.2), b: rnd(0.55, 1.0),
          splashY: s.splashY + rnd(-4, 4), sp: s, jet: true,
        });
      }
      if (CFG.mist && Math.random() < 1.4 * CFG.spray * dt) spawnMist(s.x + rnd(-22, 22), s.y - rnd(0, 150), 1.0);
    }

    function spawnMist(x, y, scale) {
      if (mist.length > (CFG.maxMist || K.MAX_MIST)) return;
      mist.push({ x, y, vx: rnd(-0.3, 0.3), vy: rnd(-0.5, -0.05), r: rnd(6, 22) * scale, life: 0, max: rnd(40, 95), a: rnd(0.05, 0.16) });
    }

    function doSplash(x, y, power) {
      const n = Math.round(rnd(4, 9) * CFG.splash * power);
      for (let i = 0; i < n; i++) {
        if (splash.length > (CFG.maxSplash || K.MAX_SPLASH)) break;
        const ang = -Math.PI / 2 + rnd(-1.05, 1.05);
        const sp = rnd(1.6, 5.2) * (0.7 + power * 0.4);
        splash.push({ x, y, px: x, py: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0, max: rnd(16, 34), w: rnd(1.0, 2.2) });
      }
      if (CFG.mist) for (let i = 0; i < 2 * CFG.spray; i++) spawnMist(x + rnd(-12, 12), y - rnd(0, 14), 0.6);
      if (CFG.ripples && Math.random() < 0.35) ripples.push({ x, y, r: rnd(3, 7), vr: rnd(0.7, 1.2), life: 0, max: rnd(55, 90) });
    }

    // ---- update ----
    function update(dt) {
      const wind = CFG.wind;
      let w = 0;
      for (let i = 0; i < stream.length; i++) {
        const p = stream[i];
        p.px = p.x; p.py = p.y;
        p.vy += K.GRAV * dt;
        p.vx += wind * K.WIND_COEFF * dt;
        p.vx += rnd(-0.03, 0.03) * dt;
        if (mouse.active) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y; const d2 = dx * dx + dy * dy;
          if (d2 < K.GUST_R1) {
            const f = (1 - d2 / K.GUST_R1) * 0.5;
            p.vx += (dx >= 0 ? 1 : -1) * f * (1.5 + Math.abs(mouse.vx) * 0.25) * dt;
            p.vy += mouse.vy * 0.04 * f * dt;
          }
        }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (!p.sp.behind && CFG.mist && p.vy > 4 && Math.random() < 0.006 * CFG.spray * dt) spawnMist(p.x, p.y, 0.4);
        const landed = p.y >= p.splashY && p.vy > 0;
        if (landed) {
          if (!p.sp.behind) doSplash(p.x, p.splashY, Math.min(1.6, 0.9 + p.vy * 0.08));
          continue;
        }
        if (p.y > K.IMG_H + 30 || p.x < -60 || p.x > K.IMG_W + 60) continue;
        stream[w++] = p;
      }
      stream.length = w;

      w = 0;
      for (let i = 0; i < mist.length; i++) {
        const m = mist[i];
        m.life += dt; m.vx += wind * 0.01 * dt;
        if (mouse.active) {
          const dx = m.x - mouse.x, dy = m.y - mouse.y; const d2 = dx * dx + dy * dy;
          if (d2 < K.GUST_R2) { const f = (1 - d2 / K.GUST_R2) * 0.4; m.vx += (dx >= 0 ? 1 : -1) * f * dt; m.vy += mouse.vy * 0.03 * f * dt; }
        }
        m.x += m.vx * dt; m.y += m.vy * dt; m.vy -= 0.004 * dt; m.r += 0.18 * dt;
        if (m.life < m.max) mist[w++] = m;
      }
      mist.length = w;

      w = 0;
      for (let i = 0; i < splash.length; i++) {
        const p = splash[i];
        p.px = p.x; p.py = p.y; p.vy += K.GRAV * 1.05 * dt; p.vx += wind * 0.02 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.life += dt;
        if (p.life < p.max) splash[w++] = p;
      }
      splash.length = w;

      w = 0;
      for (let i = 0; i < ripples.length; i++) {
        const r = ripples[i]; r.life += dt; r.r += r.vr * dt;
        if (r.life < r.max) ripples[w++] = r;
      }
      ripples.length = w;
    }

    // ---- render ----
    function tint(a, lighten) { return H.tintStr(CFG.tint, a, lighten); }

    function drawPlumeGlow(s, time) {
      const peak = s.y - (s.v0 * s.v0) / (2 * K.GRAV) * 0.62;
      const topW = s.w * 2.2, baseW = s.w * 0.5;
      const wob = Math.sin(time * 0.005 + s.x) * 4;
      ctx.beginPath();
      ctx.moveTo(s.x - baseW, s.y);
      ctx.quadraticCurveTo(s.x - topW * 0.5 + wob, (s.y + peak) / 2, s.x - topW * 0.5 + wob, peak);
      ctx.lineTo(s.x + topW * 0.5 + wob, peak);
      ctx.quadraticCurveTo(s.x + topW * 0.5 + wob, (s.y + peak) / 2, s.x + baseW, s.y);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, s.y, 0, peak);
      g.addColorStop(0, tint(0.22 * CFG.flow, 14));
      g.addColorStop(0.5, tint(0.12 * CFG.flow * CFG.spray, 10));
      g.addColorStop(1, tint(0.02 * CFG.flow));
      ctx.fillStyle = g; ctx.fill();
    }

    function drawRibbon(s, time) {
      const y0 = s.y, y1 = s.splashY, drop = y1 - y0;
      const v0 = s.v0;
      const tFall = H.timeOfFlight(v0, K.GRAV, drop);
      const wind = CFG.wind;
      const segs = 14;
      const wTop = s.w * 0.82, wBot = Math.max(4, s.w * 0.34);
      const tw = time * 0.004;
      const sway = (s.wobble == null ? 0 : s.wobble); // default 0: sheet/spine track the droplets (no independent swing that reads as a guide-line); set wobble>0 per-spout to re-enable
      function pt(f) {
        const t = f * tFall;
        const x = s.x + s.lean * t + 0.5 * wind * K.WIND_COEFF * t * t
          + Math.sin(tw + f * 3.4 + s.x * 0.01) * (1.5 + f * f * 9) * sway;
        const y = y0 + v0 * t + 0.5 * K.GRAV * t * t;
        return [x, y];
      }
      function edge(f, sign, hw) {
        const a = pt(Math.max(0, f - 0.02)), b = pt(Math.min(1, f + 0.02));
        let dx = b[0] - a[0], dy = b[1] - a[1];
        const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
        const p = pt(f);
        return [p[0] - dy * sign * hw, p[1] + dx * sign * hw];
      }
      const hwAt = (f) => (wTop + (wBot - wTop) * f) * 0.5;
      ctx.beginPath();
      for (let i = 0; i <= segs; i++) { const f = i / segs, e = edge(f, 1, hwAt(f)); i === 0 ? ctx.moveTo(e[0], e[1]) : ctx.lineTo(e[0], e[1]); }
      for (let i = segs; i >= 0; i--) { const f = i / segs, e = edge(f, -1, hwAt(f)); ctx.lineTo(e[0], e[1]); }
      ctx.closePath();
      let g = ctx.createLinearGradient(0, y0, 0, y1);
      if (s.behind) {
        g.addColorStop(0, tint(0.46 * CFG.flow, 14));
        g.addColorStop(0.4, tint(0.2 * CFG.flow, 8));
        g.addColorStop(0.72, tint(0));
        g.addColorStop(1, tint(0));
      } else {
        g.addColorStop(0, tint(0.5 * CFG.flow, 14));
        g.addColorStop(0.45, tint(0.26 * CFG.flow, 8));
        g.addColorStop(1, tint(0.05 * CFG.flow));
      }
      ctx.fillStyle = g; ctx.fill();
      if (s.spine === false) return; // skip the bright centerline — its animated swing reads as a guide-line on long streams
      ctx.beginPath();
      for (let i = 0; i <= segs; i++) { const f = i / segs, p = pt(f); i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]); }
      g = ctx.createLinearGradient(0, y0, 0, y1);
      if (s.behind) {
        g.addColorStop(0, tint(0.46 * CFG.flow, 24));
        g.addColorStop(0.45, tint(0.16 * CFG.flow, 14));
        g.addColorStop(0.72, tint(0));
      } else {
        g.addColorStop(0, tint(0.5 * CFG.flow, 24));
        g.addColorStop(0.6, tint(0.2 * CFG.flow, 14));
        g.addColorStop(1, tint(0));
      }
      ctx.strokeStyle = g; ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(2, s.w * 0.26);
      ctx.stroke();
    }

    function render(time) {
      ctx.clearRect(0, 0, CW, CH);
      ctx.save();
      ctx.scale(S, S);
      ctx.globalCompositeOperation = 'screen';

      if (CFG.mist) {
        for (let i = 0; i < mist.length; i++) {
          const m = mist[i];
          const k = m.life / m.max;
          const a = m.a * Math.sin(Math.min(1, k) * Math.PI) * CFG.spray;
          if (a <= 0.002) continue;
          const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
          g.addColorStop(0, tint(a, 18));
          g.addColorStop(1, tint(0));
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.2832); ctx.fill();
        }
      }

      if (CFG.ripples) {
        ctx.lineWidth = 1.4;
        for (let i = 0; i < ripples.length; i++) {
          const r = ripples[i];
          const k = r.life / r.max;
          const a = (1 - k) * 0.22;
          ctx.strokeStyle = tint(a, 6);
          ctx.beginPath();
          ctx.ellipse(r.x, r.y, r.r, r.r * K.RIPPLE_SQUASH, 0, 0, 6.2832);
          ctx.stroke();
        }
      }

      for (const s of SPOUTS) {
        if (!s.on) continue;
        if (s.kind === 'jet') { drawPlumeGlow(s, time); continue; }
        drawRibbon(s, time);
      }

      ctx.lineCap = 'round';
      for (let i = 0; i < stream.length; i++) {
        const p = stream[i];
        let a = Math.min(0.85, 0.30 + p.b * 0.5);
        if (p.sp.behind) {
          const frac = (p.y - p.sp.y) / (p.splashY - p.sp.y);
          a *= frac > 0.5 ? Math.max(0, 1 - (frac - 0.5) / 0.5) : 1;
        }
        if (a <= 0.01) continue;
        ctx.strokeStyle = tint(a, 14);
        ctx.lineWidth = p.w;
        const TAIL = K.TAIL_STREAM;
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * TAIL, p.y - p.vy * TAIL);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }

      ctx.lineCap = 'round';
      for (let i = 0; i < splash.length; i++) {
        const p = splash[i];
        const a = (1 - p.life / p.max) * 0.9;
        ctx.strokeStyle = tint(a, 20);
        ctx.lineWidth = p.w;
        const ST = K.TAIL_SPLASH;
        ctx.beginPath(); ctx.moveTo(p.x - p.vx * ST, p.y - p.vy * ST); ctx.lineTo(p.x, p.y); ctx.stroke();
      }

      for (const s of SPOUTS) {
        if (!s.on || s.behind) continue;
        const fx = H.impactX(s, K.GRAV, CFG.wind, K.WIND_COEFF), fy = s.splashY;
        const fl = (0.5 + 0.5 * Math.sin(time * 0.006 + s.x));
        const rad = (26 + s.w * 0.7) * (0.85 + 0.3 * fl);
        const a = 0.16 * CFG.splash * (0.7 + 0.3 * fl) * CFG.flow;
        const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, rad);
        g.addColorStop(0, tint(a, 18));
        g.addColorStop(0.6, tint(a * 0.5, 8));
        g.addColorStop(1, tint(0));
        ctx.fillStyle = g;
        ctx.save();
        ctx.translate(fx, fy); ctx.scale(1, K.FOAM_SQUASH); ctx.translate(-fx, -fy);
        ctx.beginPath(); ctx.arc(fx, fy, rad, 0, 6.2832); ctx.fill();
        ctx.restore();
        // clock-driven speckles (seeded off `time`, never re-randomized) so they shimmer
        const nSp = Math.round(4 * CFG.splash);
        for (let i = 0; i < nSp; i++) {
          const seed = i * 12.9898 + s.x * 0.7;
          const ang = (time * 0.0011 + seed) % 6.2832;
          const rr = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 0.0018 + seed * 1.7))) * rad;
          const sx = fx + Math.cos(ang) * rr, sy = fy + Math.sin(ang) * rr * 0.36;
          const tw = 0.5 + 0.5 * Math.sin(time * 0.009 + seed * 3.1);
          ctx.fillStyle = tint(tw * 0.4 * CFG.splash, 24);
          ctx.fillRect(sx, sy, 1.6, 1.4);
        }
      }

      ctx.restore();
    }

    // ---- main loop ----
    let last = performance.now();
    let rafId = 0;
    let running = false;
    let frames = 0; // exposed via stats() for the #debug fps/leak readout
    function frame(now) {
      let dtMs = now - last; last = now;
      if (dtMs > 60) dtMs = 60; // clamp after tab-away
      const dt = (dtMs / 16.6667) * CFG.speed;
      for (const s of SPOUTS) spawnStream(s, dt);
      update(dt);
      render(now);
      frames++;
      rafId = requestAnimationFrame(frame);
    }
    // pause/resume so we can stop pegging the GPU when nobody's looking (hidden tab / hero off-screen)
    function resume() { if (running) return; running = true; last = performance.now(); rafId = requestAnimationFrame(frame); }
    function pause() { if (!running) return; running = false; if (rafId) cancelAnimationFrame(rafId); rafId = 0; }
    function stats() { return { frames: frames, stream: stream.length, mist: mist.length, splash: splash.length, ripples: ripples.length }; }

    resize();
    resume();

    function destroy() {
      pause();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('click', onClick);
      window.removeEventListener('resize', resize);
    }
    return { destroy: destroy, resize: resize, pause: pause, resume: resume, stats: stats };
  }

  window.createWaterfall = createWaterfall;
})();
