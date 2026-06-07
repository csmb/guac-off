'use strict';
// Node tests for find/stores.js pure functions — run: node "Guac Off 2026/find/stores.test.js"
const S = require('./stores.js');

let passed = 0, failed = 0;
function eq(name, actual, expected, tol = 0) {
  const ok = (typeof actual === 'object')
    ? JSON.stringify(actual) === JSON.stringify(expected)
    : (tol ? Math.abs(actual - expected) <= tol : actual === expected);
  if (ok) { passed++; }
  else { failed++; console.log(`✗ ${name}\n    expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`); }
}

// buildOverpassQuery: includes both shop filters and the bbox numbers
const q = S.buildOverpassQuery({ south: 1, west: 2, north: 3, east: 4 });
eq('query has supermarket', q.includes('"shop"="supermarket"'), true);
eq('query has greengrocer', q.includes('"shop"="greengrocer"'), true);
eq('query has bbox', q.includes('(1,2,3,4)'), true);
eq('query asks for json', q.includes('[out:json]'), true);
eq('query asks center for ways', q.includes('out center'), true);

// parseOverpass: node coords, way center coords, drop unnamed, dedupe
const json = { elements: [
  { type:'node', lat:37.75, lon:-122.42, tags:{ name:'Bi-Rite', shop:'greengrocer' } },
  { type:'way', center:{ lat:37.76, lon:-122.43 }, tags:{ name:'Safeway', shop:'supermarket' } },
  { type:'node', lat:37.77, lon:-122.44, tags:{ shop:'supermarket' } },           // no name -> drop
  { type:'node', lat:37.75, lon:-122.42, tags:{ name:'Bi-Rite', shop:'greengrocer' } }, // dupe -> drop
  { type:'node', tags:{ name:'NoCoords', shop:'supermarket' } },                  // no coords -> drop
] };
const parsed = S.parseOverpass(json);
eq('parseOverpass keeps 2', parsed.length, 2);
eq('parseOverpass first is Bi-Rite', parsed[0].name, 'Bi-Rite');
eq('parseOverpass uses way center', parsed[1].lat, 37.76, 1e-9);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
