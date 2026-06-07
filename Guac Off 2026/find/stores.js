// Finds supermarkets/greengrocers in the corridor between you and the party, via the free
// OpenStreetMap Overpass API. Loads in Node (module.exports) and the browser (window.FindStores).
// PRIVACY: findAvocadoStops sends a bbox covering you->venue to overpass-api.de. It runs only
// AFTER the address is revealed, so it does not leak the secret location early.
(function (factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.FindStores = api;
})(function () {
  'use strict';

  const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
  const SHOPS = ['supermarket', 'greengrocer'];
  const BUFFER_METERS = 1609.344;  // ~1 mile corridor half-width
  const PAD_METERS = 1609.344;     // bbox padding around the line
  const MAX_RESULTS = 8;
  const FETCH_TIMEOUT_MS = 12000;

  function buildOverpassQuery(bbox) {
    const b = bbox.south + ',' + bbox.west + ',' + bbox.north + ',' + bbox.east;
    const parts = SHOPS.map(function (s) {
      return 'node["shop"="' + s + '"](' + b + ');way["shop"="' + s + '"](' + b + ');';
    }).join('');
    return '[out:json][timeout:25];(' + parts + ');out center tags;';
  }

  function parseOverpass(json) {
    const els = (json && json.elements) || [];
    const out = [], seen = {};
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      const lat = (typeof el.lat === 'number') ? el.lat : (el.center && el.center.lat);
      const lng = (typeof el.lon === 'number') ? el.lon : (el.center && el.center.lon);
      const name = el.tags && el.tags.name;
      if (!name || typeof lat !== 'number' || typeof lng !== 'number') continue;
      const key = name + '@' + lat.toFixed(4) + ',' + lng.toFixed(4);
      if (seen[key]) continue;
      seen[key] = true;
      out.push({ name: name, lat: lat, lng: lng });
    }
    return out;
  }

  // Async: returns [{name, miFromUser, mapsUrl}] sorted you->venue, capped. Throws on fetch error.
  async function findAvocadoStops(from, to) {
    const H = window.FindHelpers;
    const query = buildOverpassQuery(H.bboxAround(from, to, PAD_METERS));
    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, FETCH_TIMEOUT_MS);
    let json;
    try {
      const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error('Overpass HTTP ' + res.status);
      json = await res.json();
    } finally {
      clearTimeout(timer);
    }
    return H.corridorFilter(parseOverpass(json), from, to, BUFFER_METERS)
      .slice(0, MAX_RESULTS)
      .map(function (s) {
        return {
          name: s.name,
          miFromUser: H.metersToMiles(H.haversineMeters(from, { lat: s.lat, lng: s.lng })),
          mapsUrl: 'https://www.google.com/maps/search/?api=1&query=' +
                   encodeURIComponent(s.name + ' ' + s.lat + ',' + s.lng),
        };
      });
  }

  return {
    findAvocadoStops, buildOverpassQuery, parseOverpass,
    constants: { BUFFER_METERS, PAD_METERS, MAX_RESULTS, FETCH_TIMEOUT_MS },
  };
});
