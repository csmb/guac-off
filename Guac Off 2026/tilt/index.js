'use strict';

(function () {
  const { Engine, World, Bodies, Body, Composite } = Matter;

  // Register attractors plugin (must happen before Engine.create).
  Matter.use(MatterAttractors);

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

  // --- Render loop ---
  function tick() {
    const g = H.tiltToGravity(smoothBeta, smoothGamma);
    engine.gravity.x = g.x;
    engine.gravity.y = g.y;
    Engine.update(engine, 1000 / 60);
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
