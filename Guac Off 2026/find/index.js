'use strict';

(function () {
  const H = window.FindHelpers;
  const { bearing, haversineMeters, isNearVenue, warmth,
          pointingVector, bearingVector, angleBetween, rotateAboutUp, smoothVector,
          shouldLock, dec } = H;
  const C = H.constants;

  // ===== EDIT THIS ONE BLOCK (real venue) =====
  // Generate replacements (run in a terminal — do NOT paste the plaintext lat/lng or
  // address back into a comment here, or view-source spoils the hunt):
  //   node -e "const H=require('./helpers.js'); console.log(H.enc(JSON.stringify({lat:LAT,lng:LNG}))); console.log(H.enc('FULL ADDRESS'));"
  const VENUE_GEO  = 'HFcNAhtEXFRCT1RaX1BLVw0NCERcSkRTUUFSVFFMHA==';   // encoded venue coords (placeholder)
  const VENUE_ADDR = 'IxoNDB0DFUclABEESkY0FA9DKRQHCRYIEAwJSkc2IA==';  // encoded venue address (placeholder)
  const MAGNETIC_DECLINATION_DEG = 13;          // SF; retune per venue (only applied to iOS magnetic heading)
  // ============================================

  const STORE_KEY = 'guacPartyFound';
  const venue = JSON.parse(dec(VENUE_GEO)); // {lat,lng} — decoded at load for the live math

  // --- DOM ---
  const $ = function (id) { return document.getElementById(id); };
  const stage = $('stage'), glow = $('glow');
  const cover = $('cover'), prime = $('prime'), status = $('status'), statusText = $('status-text');
  const hunt = $('hunt'), huntHint = $('hunt-hint');
  const reveal = $('reveal'), revealAddress = $('reveal-address'), mapsLink = $('maps-link'), playAgain = $('play-again');
  const escape = $('escape');

  function show(el) { el.hidden = false; el.setAttribute('aria-hidden', 'false'); }
  function hide(el) { el.hidden = true; el.setAttribute('aria-hidden', 'true'); }
  function setStatus(msg) { statusText.textContent = msg; hide(cover); hide(prime); hide(hunt); show(status); }

  // --- Audio (self-contained; mirrors tilt's chime + a warmth tone) ---
  let audioCtx = null, toneOsc = null, toneGain = null;
  function ensureAudio() {
    if (audioCtx) return audioCtx;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
    return audioCtx;
  }
  function startTone() {
    const ctx = ensureAudio(); if (!ctx || toneOsc) return;
    toneOsc = ctx.createOscillator(); toneOsc.type = 'sine';
    toneGain = ctx.createGain(); toneGain.gain.value = 0;
    toneOsc.connect(toneGain).connect(ctx.destination); toneOsc.start();
  }
  function updateTone(w) {
    const ctx = ensureAudio(); if (!ctx || !toneOsc) return;
    const now = ctx.currentTime;
    toneOsc.frequency.setTargetAtTime(220 + w * 660, now, 0.05); // 220Hz cool -> 880Hz hot
    toneGain.gain.setTargetAtTime(w > 0.05 ? w * 0.12 : 0, now, 0.05);
  }
  function stopTone() {
    if (toneGain) toneGain.gain.setTargetAtTime(0, ensureAudio().currentTime, 0.05);
  }
  function playChime() {
    const ctx = ensureAudio(); if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach(function (freq, i) {
      const t0 = now + i * 0.12;
      const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.setValueAtTime(freq, t0);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.25, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
      osc.connect(gain).connect(ctx.destination); osc.start(t0); osc.stop(t0 + 0.55);
    });
  }

  // --- Haptics ---
  let lastVibe = 0;
  function tickHaptic(w) {
    if (!navigator.vibrate || w < 0.15) return;
    const now = performance.now();
    const interval = 700 - w * 620; // 700ms cool -> 80ms hot
    if (now - lastVibe >= interval) { navigator.vibrate(15); lastVibe = now; }
  }

  // --- Reveal + persistence ---
  function doReveal(persist) {
    running = false;
    removeOrientationListeners();
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    stopTone();
    const addr = dec(VENUE_ADDR);
    revealAddress.textContent = addr;
    mapsLink.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr);
    hide(cover); hide(prime); hide(status); hide(hunt); hide(escape);
    show(reveal);
    reveal.focus();
    if (persist) { try { localStorage.setItem(STORE_KEY, '1'); } catch (e) {} playChime(); }
    if (persist) show(playAgain);
  }

  // --- Hunt loop ---
  let aim = null;             // smoothed 3D pointing direction {e,n,u}
  let targetVec = null;       // 3D direction to the party (horizon-level)
  let gotOrientation = false;
  let gotAbsolute = false;    // true once a deviceorientationabsolute event has fired
  let lockStart = 0;
  let running = false;
  let rafId = null;

  function onOrientation(e) {
    gotOrientation = true;
    let vec;
    if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
      if (typeof e.webkitCompassAccuracy === 'number' && (e.webkitCompassAccuracy < 0 || e.webkitCompassAccuracy > 25)) {
        huntHint.textContent = 'Wave your phone in a figure-8 to calibrate 🧭';
        return; // don't update aim while accuracy is unusable
      }
      // iOS: anchor absolute (magnetic) north; webkitCompassHeading ~ 360 - alpha when flat.
      vec = pointingVector(360 - e.webkitCompassHeading, e.beta ?? 0, e.gamma ?? 0);
      vec = rotateAboutUp(vec, MAGNETIC_DECLINATION_DEG); // magnetic -> true north (azimuth only)
    } else if (e.absolute === true && typeof e.alpha === 'number') {
      vec = pointingVector(e.alpha, e.beta ?? 0, e.gamma ?? 0); // Android absolute ~ true north
    } else {
      return; // relative-only orientation: not usable as a compass
    }
    aim = aim ? smoothVector(aim, vec) : vec;
  }

  // Android fires BOTH events; only let the relative one drive the compass if no
  // absolute event is available, so onOrientation runs once per sensor cycle.
  function absHandler(e) { gotAbsolute = true; onOrientation(e); }
  function relHandler(e) { if (!gotAbsolute) onOrientation(e); }
  function addOrientationListeners() {
    window.addEventListener('deviceorientationabsolute', absHandler);
    window.addEventListener('deviceorientation', relHandler);
  }
  function removeOrientationListeners() {
    window.removeEventListener('deviceorientationabsolute', absHandler);
    window.removeEventListener('deviceorientation', relHandler);
  }

  function tick() {
    if (!running) { rafId = null; return; }
    if (aim && targetVec) {
      const diff = angleBetween(aim, targetVec);
      const w = warmth(diff);
      glow.style.setProperty('--warmth', w.toFixed(3));
      // "hold it steady" is tied to the actual lock cone, not just warmth — the glow
      // now ramps up from much farther out than the 5° lock.
      huntHint.textContent =
          diff < C.LOCK_DEG ? "🔥 RIGHT THERE — hold it steady!"
        : w > 0.66 ? "🔥 Almost — keep aiming…"
        : w > 0.33 ? "Getting warmer… 🔥"
        : "❄️ Cold — sweep around to find the party";
      updateTone(w); tickHaptic(w);
      if (diff < C.LOCK_DEG) {
        if (!lockStart) lockStart = performance.now();
        if (shouldLock(diff, performance.now() - lockStart)) { doReveal(true); return; }
      } else { lockStart = 0; }
    }
    rafId = requestAnimationFrame(tick);
  }

  function startHunt() {
    hide(cover); hide(prime); hide(status); show(hunt);
    targetVec = bearingVector(bearing(currentPos, venue));
    addOrientationListeners();
    running = true; startTone();
    if (rafId === null) rafId = requestAnimationFrame(tick);
    // Escape hatch fades in after the delay.
    setTimeout(function () { if (running) show(escape); }, C.ESCAPE_DELAY_MS);
    // Watchdog: no orientation events => desktop / unsupported.
    setTimeout(function () {
      if (!gotOrientation) {
        setStatus("Best on a phone — open this page on your phone 📱");
        show(escape);
      }
    }, 3000);
  }

  // --- Geolocation ---
  let currentPos = null;
  function getLocation() {
    setStatus('Getting your location… 📍');
    if (!navigator.geolocation) { setStatus("I need your location to point you at the party 🧭"); show(escape); return; }
    navigator.geolocation.getCurrentPosition(
      function (p) {
        currentPos = { lat: p.coords.latitude, lng: p.coords.longitude };
        if (isNearVenue(haversineMeters(currentPos, venue))) {
          huntHint.textContent = '';
          doReveal(true); // basically here — skip the hunt
        } else {
          startHunt();
        }
      },
      function () { setStatus("I need your location to point you at the party 🧭"); show(escape); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }

  // --- Motion permission (iOS) — mirrors tilt's gesture-safe flow ---
  async function requestMotionPermission() {
    const need = typeof DeviceOrientationEvent !== 'undefined'
      && typeof DeviceOrientationEvent.requestPermission === 'function';
    if (typeof DeviceOrientationEvent === 'undefined') return 'unsupported';
    if (!need) return 'granted';
    try { return (await DeviceOrientationEvent.requestPermission()) === 'granted' ? 'granted' : 'denied'; }
    catch (e) { return 'denied'; }
  }

  // --- Wiring ---
  $('start-btn').addEventListener('click', function () { hide(cover); show(prime); });

  $('prime-btn').addEventListener('click', async function () {
    // Audio init synchronously inside the gesture (no await before it).
    ensureAudio(); if (audioCtx) audioCtx.resume().catch(function () {});
    // requestPermission MUST be the first await (iOS gesture window).
    const motionPermission = await requestMotionPermission();
    if (motionPermission === 'unsupported') { setStatus("Best on a phone — open this page on your phone 📱"); show(escape); return; }
    if (motionPermission === 'denied') { setStatus("Motion access is needed — refresh and tap Allow."); show(escape); return; }
    getLocation();
  });

  escape.addEventListener('click', function () { doReveal(false); });
  playAgain.addEventListener('click', function () {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    aim = null; targetVec = null; gotOrientation = false; gotAbsolute = false; lockStart = 0;
    hide(reveal); show(cover);
  });

  // Already found before? Open straight to the reveal.
  let alreadyFound = false;
  try { alreadyFound = localStorage.getItem(STORE_KEY) === '1'; } catch (e) {}
  if (alreadyFound) { doReveal(false); show(playAgain); }
})();
