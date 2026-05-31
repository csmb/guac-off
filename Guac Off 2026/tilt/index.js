'use strict';

(function () {
  const { Engine, World, Bodies, Body, Composite } = Matter;

  // Register attractors plugin (must happen before Engine.create).
  Matter.use(MatterAttractors);

  // --- Audio ---
  let audioCtx = null;
  function ensureAudio() {
    if (audioCtx) return audioCtx;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { /* audio not available — silent fallback */ }
    return audioCtx;
  }

  function playThunk() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Low-frequency body
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.0, now);
    oscGain.gain.linearRampToValueAtTime(0.5, now + 0.005);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.2);
    // Noise burst
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 600;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    noise.connect(lp).connect(noiseGain).connect(ctx.destination);
    noise.start(now);
  }

  function playChime() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach(function (freq, i) {  // C5, E5, G5
      const t0 = now + i * 0.12;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t0);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.25, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.55);
    });
  }

  const H = window.TiltHelpers;

  // --- DOM ---
  const board = document.getElementById('board');
  const ingredientEls = Array.from(document.querySelectorAll('.ingredient'));

  // --- Board dimensions (read once at start; if we add resize later, redo) ---
  const rect = board.getBoundingClientRect();
  const W = rect.width;
  const Hh = rect.height;
  const WALL_T = 40;        // wall thickness (kept outside the viewport)
  const ING_R = 28;         // ingredient body radius

  // --- Engine ---
  const engine = Engine.create();
  engine.gravity.x = 0;
  engine.gravity.y = 0;

  // Walls — placed just outside the board edges
  const walls = [
    Bodies.rectangle(W / 2,  -WALL_T / 2,        W + WALL_T * 2, WALL_T, { isStatic: true, restitution: 0.55 }),
    Bodies.rectangle(W / 2,  Hh + WALL_T / 2,    W + WALL_T * 2, WALL_T, { isStatic: true, restitution: 0.55 }),
    Bodies.rectangle(-WALL_T / 2,       Hh / 2,  WALL_T, Hh + WALL_T * 2, { isStatic: true, restitution: 0.55 }),
    Bodies.rectangle(W + WALL_T / 2,    Hh / 2,  WALL_T, Hh + WALL_T * 2, { isStatic: true, restitution: 0.55 }),
  ];
  Composite.add(engine.world, walls);

  // Ingredients — Matter bodies paired with DOM elements
  const ingredients = ingredientEls.map(function (el, i) {
    // Spread starting positions across the top half of the board
    const startX = W * (0.2 + 0.3 * i);
    const startY = Hh * 0.15;
    const body = Bodies.circle(startX, startY, ING_R, {
      restitution: 0.35,
      friction: 0.02,
      frictionAir: 0.02,
      density: 0.001,
    });
    Composite.add(engine.world, body);
    return { el, body, locked: false };
  });

  // --- Bowl ---
  const BOWL_CX = W * 0.5;
  const BOWL_CY = Hh * 0.55;
  const BOWL_R = W * 0.21;         // matches .bowl width: 42% / 2
  const BOWL_PULL_RADIUS = W * 0.35;
  const PULL_GAIN = 0.00018;

  const bowl = Bodies.circle(BOWL_CX, BOWL_CY, BOWL_R, {
    isStatic: true,
    isSensor: true,                 // no collision response
    render: { visible: false },
    plugin: {
      attractors: [
        function (bowlBody, otherBody) {
          const dx = bowlBody.position.x - otherBody.position.x;
          const dy = bowlBody.position.y - otherBody.position.y;
          const dist = Math.hypot(dx, dy);
          if (dist > BOWL_PULL_RADIUS) return null;
          const strength = (1 - dist / BOWL_PULL_RADIUS) * PULL_GAIN;
          return { x: dx * strength, y: dy * strength };
        }
      ]
    }
  });
  Composite.add(engine.world, bowl);
  const slots = H.slotPositions({ x: BOWL_CX, y: BOWL_CY }, BOWL_R, ingredients.length);

  // --- Tilt input ---
  let smoothBeta = 0;
  let smoothGamma = 0;
  let tiltActive = false;

  function onOrientation(event) {
    tiltActive = true;
    const beta = event.beta || 0;     // front-back, deg
    const gamma = event.gamma || 0;   // left-right, deg
    smoothBeta = smoothBeta * 0.85 + beta * 0.15;
    smoothGamma = smoothGamma * 0.85 + gamma * 0.15;
  }
  window.addEventListener('deviceorientation', onOrientation);

  const wonEl = document.getElementById('won');
  let gameWon = false;

  function enterWon() {
    if (gameWon) return;
    gameWon = true;
    board.classList.add('dimmed');
    board.classList.add('won');
    wonEl.hidden = false;
    wonEl.setAttribute('aria-hidden', 'false');
    playChime();
  }

  function resetGame() {
    gameWon = false;
    board.classList.remove('dimmed');
    board.classList.remove('won');
    wonEl.hidden = true;
    wonEl.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < ingredients.length; i++) {
      const ing = ingredients[i];
      Body.setStatic(ing.body, false);
      Body.setVelocity(ing.body, { x: 0, y: 0 });
      Body.setAngularVelocity(ing.body, 0);
      const startX = W * (0.15 + Math.random() * 0.7);
      const startY = Hh * (0.1 + Math.random() * 0.15);
      Body.setPosition(ing.body, { x: startX, y: startY });
      ing.locked = false;
      ing.el.classList.remove('locked');
    }
  }

  wonEl.addEventListener('click', resetGame);

  // --- Render loop ---
  function tick() {
    const g = H.tiltToGravity(smoothBeta, smoothGamma);
    engine.gravity.x = g.x;
    engine.gravity.y = g.y;
    Engine.update(engine, 1000 / 60);

    // Lock-and-snap pass
    for (let i = 0; i < ingredients.length; i++) {
      const ing = ingredients[i];
      if (ing.locked) continue;
      const dx = BOWL_CX - ing.body.position.x;
      const dy = BOWL_CY - ing.body.position.y;
      const dist = Math.hypot(dx, dy);
      const speed = Math.hypot(ing.body.velocity.x, ing.body.velocity.y);
      if (H.shouldLock(dist, speed)) {
        ing.locked = true;
        Body.setStatic(ing.body, true);
        Body.setVelocity(ing.body, { x: 0, y: 0 });
        Body.setPosition(ing.body, slots[i]);
        ing.el.classList.add('locked');
        playThunk();
      }
    }

    if (!gameWon && H.allLocked(ingredients)) {
      enterWon();
    }

    for (const ing of ingredients) {
      const { x, y } = ing.body.position;
      const a = ing.body.angle;
      // The DOM element is positioned top-left at (0,0); translate to body center minus its visual half-size.
      // Visual half-size ≈ ING_R, since the emoji glyph at 3rem ≈ 48px ≈ ING_R*2 wide.
      ing.el.style.transform =
        `translate(${x - ING_R}px, ${y - ING_R}px) rotate(${a}rad)`;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
