/* Round part in a V nest — pure math, no DOM.
 * θ is the included angle of the V. All distances are from the V's vertex,
 * along its center line, except t (along a face) and w (across).
 *   r, D  radius, diameter
 *   d     vertex → part center      d = r / sin(θ/2)
 *   t     vertex → contact (face)   t = r / tan(θ/2)
 *   g     vertex → part bottom      g = d − r
 *   h     vertex → part top         h = d + r
 *   w     contact span (output)     w = 2·t·sin(θ/2)
 *   e     contact height (output)   e = t·cos(θ/2)
 * Two values fix everything (θ and r). Works as a plain browser script
 * (window.VeeMath) and under node. */
(function (root) {
  'use strict';

  var core = typeof module === 'object' && module.exports ? require('./core.js') : root.CalcCore;
  var fmt = core.fmt;
  var RAD = Math.PI / 180;

  var FIELDS = ['th', 'r', 'D', 'd', 't', 'g', 'h']; // typable
  var EXTRAS = ['w', 'e'];                           // solved only
  var SYM = { th: 'θ', r: 'r', D: 'D', d: 'd', t: 't', g: 'g', h: 'h', w: 'w', e: 'e' };
  var LENGTHS = ['d', 't', 'g', 'h'];

  function sin(x) { return Math.sin(x * RAD); }
  function tan(x) { return Math.tan(x * RAD); }
  function asinD(x) { return Math.asin(x) / RAD; }
  function acosD(x) { return Math.acos(x) / RAD; }
  function atanD(x) { return Math.atan(x) / RAD; }

  function isAngle(f) { return f === 'th'; }
  function fmtField(f, n) { return isAngle(f) ? fmt(n) + '°' : fmt(n); }

  // order: typed fields, most recent first. The 2 most recent, skipping r if
  // D is already picked (and vice versa) — they're the same unknown.
  function pickInputs(order) {
    var picked = [];
    for (var i = 0; i < order.length && picked.length < 2; i++) {
      var f = order[i];
      if (FIELDS.indexOf(f) < 0 || picked.indexOf(f) >= 0) continue;
      if ((f === 'r' && picked.indexOf('D') >= 0) || (f === 'D' && picked.indexOf('r') >= 0)) continue;
      picked.push(f);
    }
    return picked;
  }

  var KEY = { 'θ': 'th', r: 'r', D: 'D', d: 'd', t: 't', g: 'g', h: 'h', w: 'w', e: 'e' };

  // Record a solved value and its work; the substituted line swaps each
  // symbol on the right of '=' for its current value.
  function put(sol, f, value, formula) {
    sol.v[f] = value;
    var eq = formula.indexOf('=');
    var lhs = formula.slice(0, eq).trim();
    var rhs = formula.slice(eq + 1).replace(/θ|\b[rDdtghwe]\b/g, function (s) {
      return fmtField(KEY[s], sol.v[KEY[s]]);
    });
    sol.work[f] = { formula: formula, sub: lhs + ' =' + rhs, result: lhs + ' = ' + fmtField(f, value) };
  }

  // θ from r and one length.
  var THETA_FROM_R = {
    d: { f: 'θ = 2·asin(r / d)', need: 'd > r', fn: function (v) { return 2 * asinD(v.r / v.d); } },
    t: { f: 'θ = 2·atan(r / t)', fn: function (v) { return 2 * atanD(v.r / v.t); } },
    g: { f: 'θ = 2·asin(r / (r + g))', fn: function (v) { return 2 * asinD(v.r / (v.r + v.g)); } },
    h: { f: 'θ = 2·asin(r / (h − r))', need: 'h > 2·r', fn: function (v) { return 2 * asinD(v.r / (v.h - v.r)); } }
  };

  // θ from two lengths (keys sorted as in LENGTHS).
  var THETA_FROM_PAIR = {
    'd,t': { f: 'θ = 2·acos(t / d)', need: 't < d', fn: function (v) { return 2 * acosD(v.t / v.d); } },
    'd,g': { f: 'θ = 2·asin(1 − g / d)', need: 'g < d', fn: function (v) { return 2 * asinD(1 - v.g / v.d); } },
    'd,h': { f: 'θ = 2·asin(h / d − 1)', need: 'd < h < 2·d', fn: function (v) { return 2 * asinD(v.h / v.d - 1); } },
    't,g': { f: 'θ = 4·atan(t / g) − 180°', need: 't > g', fn: function (v) { return 4 * atanD(v.t / v.g) - 180; } },
    't,h': { f: 'θ = 180° − 4·atan(t / h)', need: 't < h', fn: function (v) { return 180 - 4 * atanD(v.t / v.h); } },
    'g,h': { f: 'θ = 2·asin((h − g) / (h + g))', need: 'g < h', fn: function (v) { return 2 * asinD((v.h - v.g) / (v.h + v.g)); } }
  };

  // r from θ and one length.
  var R_FROM_THETA = {
    d: { f: 'r = d·sin(θ/2)', fn: function (v) { return v.d * sin(v.th / 2); } },
    t: { f: 'r = t·tan(θ/2)', fn: function (v) { return v.t * tan(v.th / 2); } },
    g: { f: 'r = g·sin(θ/2) / (1 − sin(θ/2))', fn: function (v) { var s = sin(v.th / 2); return v.g * s / (1 - s); } },
    h: { f: 'r = h·sin(θ/2) / (1 + sin(θ/2))', fn: function (v) { var s = sin(v.th / 2); return v.h * s / (1 + s); } }
  };

  function bad(x) { return !isFinite(x) || isNaN(x); }

  // given: { field: number } with the picked inputs.
  // Returns { solutions: [{ v, work }] } or { error, incomplete? }.
  function solve(given) {
    var names = Object.keys(given).filter(function (f) { return FIELDS.indexOf(f) >= 0; });
    for (var n = 0; n < names.length; n++) {
      var f = names[n], val = given[f];
      if (!isFinite(val)) return { error: SYM[f] + ' is not a number' };
      if (isAngle(f) && (val <= 0 || val >= 180)) return { error: 'θ must be between 0° and 180°' };
      if (!isAngle(f) && val <= 0) return { error: SYM[f] + ' must be > 0' };
    }
    if (names.length < 2) {
      return { incomplete: true, error: 'Enter ' + (2 - names.length) + ' more value' + (names.length ? '' : 's') };
    }

    var sol = { v: {}, work: {} };
    names.forEach(function (k) { sol.v[k] = given[k]; });
    var v = sol.v;

    if (names.indexOf('D') >= 0) put(sol, 'r', v.D / 2, 'r = D / 2');
    var lens = LENGTHS.filter(function (k) { return names.indexOf(k) >= 0; });

    var rule;
    if (names.indexOf('th') < 0) {
      rule = 'r' in v ? THETA_FROM_R[lens[0]] : THETA_FROM_PAIR[lens.join(',')];
      put(sol, 'th', rule.fn(v), rule.f);
      if (bad(v.th) || v.th <= 1e-9 || v.th >= 180 - 1e-9) {
        return { error: 'No fit: need ' + (rule.need || 'a smaller part') };
      }
    }
    if (!('r' in v)) {
      rule = R_FROM_THETA[lens[0]];
      put(sol, 'r', rule.fn(v), rule.f);
    }
    if (!('D' in v)) put(sol, 'D', 2 * v.r, 'D = 2·r');
    if (!('d' in v)) put(sol, 'd', v.r / sin(v.th / 2), 'd = r / sin(θ/2)');
    if (!('t' in v)) put(sol, 't', v.r / tan(v.th / 2), 't = r / tan(θ/2)');
    if (!('g' in v)) put(sol, 'g', v.d - v.r, 'g = d − r');
    if (!('h' in v)) put(sol, 'h', v.d + v.r, 'h = d + r');
    put(sol, 'w', 2 * v.t * sin(v.th / 2), 'w = 2·t·sin(θ/2)');
    put(sol, 'e', v.t * Math.cos(v.th / 2 * RAD), 'e = t·cos(θ/2)');
    return { solutions: [sol] };
  }

  var api = {
    FIELDS: FIELDS,
    EXTRAS: EXTRAS,
    SYM: SYM,
    isAngle: isAngle,
    fmt: fmt,
    fmtField: fmtField,
    parseNum: core.parseNum,
    pickInputs: pickInputs,
    solve: solve
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VeeMath = api;
})(this);
