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

  // hint pill: fade after 7s or on first click
  const hint = document.getElementById('hint');
  let hintGone = false;
  function hideHint() { if (hintGone) return; hintGone = true; if (hint) hint.classList.add('hide'); }
  setTimeout(hideHint, 7000);
  canvas.addEventListener('click', hideHint, { once: true });

  // lifecycle: tear the engine down when the page is hidden/unloaded
  window.addEventListener('pagehide', function () { wf.destroy(); });
})();
