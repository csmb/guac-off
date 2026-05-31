'use strict';

(function () {
  const { Engine, World, Bodies, Body, Composite } = Matter;
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
  engine.gravity.y = 1.0;   // hardcoded straight down for now

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

  // --- Render loop ---
  function tick() {
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
