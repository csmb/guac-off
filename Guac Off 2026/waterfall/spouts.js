'use strict';
// Hand-tuned spout table for the waterfall, authored against assets/fountain.png
// (image space 2034x1136). THIS IS THE FILE TO RE-AUTHOR if the background changes.
// Fields: x,y = emission point; w = sheet width (also scales flow); v0 = initial down
// speed; lean = horizontal velocity (negative pours left); splashY = pool/landing line;
// on = visible; behind = pours behind a foreground block (no splash, fades out).
// kind 'fall' = downward stream ('jet' = upward plume; supported by the engine, unused).
// Spout layout from design_handoff_waterfall 3 (6 streams; A/B dropped, BL/DH/R moved).
window.WaterfallSpouts = [
  { id: 'BL', kind: 'fall', x: 238,  y: 648, w: 30, v0: 2.0, lean: -3.2,  splashY: 812, on: true },
  { id: 'L',  kind: 'fall', x: 462,  y: 480, w: 42, v0: 4.6, lean: -0.30, splashY: 804, on: true },
  { id: 'H',  kind: 'fall', x: 842,  y: 440, w: 19, v0: 3.0, lean: -1.15, splashY: 566, on: true, behind: true },
  { id: 'DH', kind: 'fall', x: 1248, y: 312, w: 20, v0: 3.0, lean: -0.55, splashY: 884, on: true },
  { id: 'D',  kind: 'fall', x: 1118, y: 716, w: 16, v0: 5.2, lean:  0.10, splashY: 802, on: true },
  { id: 'R',  kind: 'fall', x: 1500, y: 716, w: 34, v0: 4.8, lean:  0.08, splashY: 816, on: true },
];
window.WaterfallConfigDefaults = {
  flow: 1.0, spray: 1.0, splash: 1.4, wind: 0.0, speed: 0.6,
  ripples: true, mist: true, tint: [232, 244, 255],
};
