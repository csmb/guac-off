// Pure flood-level math for the waterfall page's rising-water reveal.
// UMD: loads in Node (module.exports) and the browser (window.WaterfallFlood).
(function (factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.WaterfallFlood = api;
})(function () {
  'use strict';

  // Decelerating ease for t in [0,1] — water rushes in, then settles as it tops off.
  function easeOutCubic(t) {
    const c = 1 - t;
    return 1 - c * c * c;
  }

  // Eased fill fraction (0..1) at `elapsedMs` into a `durationMs` flood.
  // Clamped at both ends; a non-positive duration floods instantly.
  function floodLevel(elapsedMs, durationMs) {
    if (!(durationMs > 0)) return 1;
    const t = elapsedMs / durationMs;
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return easeOutCubic(t);
  }

  return { easeOutCubic: easeOutCubic, floodLevel: floodLevel };
});
