'use strict';
// Node test runner for find/helpers.js — run: node "Guac Off 2026/find/helpers.test.js"
const H = require('./helpers.js');

let passed = 0, failed = 0;
function eq(name, actual, expected, tol = 0) {
  const ok = (typeof actual === 'object')
    ? JSON.stringify(actual) === JSON.stringify(expected)
    : (tol ? Math.abs(actual - expected) <= tol : actual === expected);
  if (ok) { passed++; }
  else { failed++; console.log(`✗ ${name}\n    expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`); }
}

// --- bearing: great-circle initial bearing, degrees [0,360) ---
eq('bearing due north', H.bearing({lat:0,lng:0}, {lat:1,lng:0}), 0, 0.001);
eq('bearing due east',  H.bearing({lat:0,lng:0}, {lat:0,lng:1}), 90, 0.001);
eq('bearing due west',  H.bearing({lat:0,lng:0}, {lat:0,lng:-1}), 270, 0.001);
eq('bearing due south', H.bearing({lat:1,lng:0}, {lat:0,lng:0}), 180, 0.001);

// --- haversineMeters ---
eq('haversine same point', H.haversineMeters({lat:0,lng:0}, {lat:0,lng:0}), 0, 0.001);
eq('haversine 1deg lng @equator ~111195m', H.haversineMeters({lat:0,lng:0}, {lat:0,lng:1}), 111195, 60);

// --- isNearVenue (constant NEAR_VENUE_M = 120) ---
eq('isNearVenue 50m true', H.isNearVenue(50), true);
eq('isNearVenue 200m false', H.isNearVenue(200), false);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
