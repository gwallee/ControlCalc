/* Ball screw thrust — pure math, no DOM.
 *   T  motor torque      N·m, lbf·in, lbf·ft, oz·in
 *   i  gear ratio, motor turns per screw turn (2 = 2:1 reduction)
 *   p  screw lead, per screw turn   mm, in
 *   η  efficiency, %
 *   F  thrust (push force)          N, lbf, kgf
 *   F = 2π·(η/100)·i·T / p, with one unit factor c = T·p·F scale folded
 *   into the lead: (p/1000) for N·m, mm, N; nothing for lbf·in, in, lbf.
 * One equation in five values: any 4 solve the 5th. Works as a plain
 * browser script (window.ScrewMath) and under node. */
(function (root) {
  'use strict';

  var core = typeof module === 'object' && module.exports ? require('./core.js') : root.CalcCore;
  var fmt = core.fmt;

  var FIELDS = ['T', 'i', 'p', 'eta', 'F'];
  var SYM = { T: 'T', i: 'i', p: 'p', eta: 'η', F: 'F' };
  // Size of each unit in SI (N·m, m, N).
  var UNITS = {
    T: { 'N·m': 1, 'lbf·in': 0.1129848290276167, 'lbf·ft': 1.3558179483314004, 'oz·in': 0.007061551814226 },
    p: { mm: 0.001, 'in': 0.0254 },
    F: { N: 1, lbf: 4.4482216152605, kgf: 9.80665 }
  };
  var METRIC = { T: 'N·m', p: 'mm', F: 'N' };

  // The unit factor c for a set of units: F[unit] = c·2π·η·i·T[unit] / p[unit].
  function factor(u) {
    var c = UNITS.T[u.T] / (UNITS.p[u.p] * UNITS.F[u.F]);
    return Math.abs(c - 1) < 1e-9 ? 1 : Math.abs(c - 1000) < 1e-6 ? 1000 : c;
  }

  function fmtC(c) { return c === 1000 ? '1000' : String(+c.toPrecision(6)); }

  function rules(c) {
    var P = c === 1 ? 'p' : '(p/' + fmtC(c) + ')', C = c === 1 ? '' : fmtC(c) + '·';
    var k = 2 * Math.PI / 100;
    return {
      F: { f: 'F = 2π·(η/100)·i·T / ' + P, fn: function (v) { return k * v.eta * v.i * v.T * c / v.p; } },
      T: { f: 'T = F·' + P + ' / (2π·(η/100)·i)', fn: function (v) { return v.F * v.p / c / (k * v.eta * v.i); } },
      i: { f: 'i = F·' + P + ' / (2π·(η/100)·T)', fn: function (v) { return v.F * v.p / c / (k * v.eta * v.T); } },
      p: { f: 'p = ' + C + '2π·(η/100)·i·T / F', fn: function (v) { return c * k * v.eta * v.i * v.T / v.F; } },
      eta: { f: 'η = 100·F·' + P + ' / (2π·i·T)', fn: function (v) { return 100 * v.F * v.p / c / (2 * Math.PI * v.i * v.T); } }
    };
  }

  // A value of field f in unit `from`, expressed in unit `to`.
  function convert(f, value, from, to) {
    return value * UNITS[f][from] / UNITS[f][to];
  }

  function isPct(f) { return f === 'eta'; }

  // order: typed fields, most recent first → the 4 most recent.
  function pickInputs(order) {
    var picked = [];
    for (var k = 0; k < order.length && picked.length < 4; k++) {
      if (FIELDS.indexOf(order[k]) >= 0 && picked.indexOf(order[k]) < 0) picked.push(order[k]);
    }
    return picked;
  }

  var KEY = { 'η': 'eta' };

  // Record a solved value and its work; the substituted line swaps each
  // symbol on the right of '=' for its value.
  function put(sol, f, value, formula, units) {
    sol.v[f] = value;
    var eq = formula.indexOf('=');
    var lhs = formula.slice(0, eq).trim();
    var rhs = formula.slice(eq + 1).replace(/η|\b[TipF]\b/g, function (s) { return fmt(sol.v[KEY[s] || s]); });
    var unit = f === 'eta' ? '%' : units[f] ? ' ' + units[f] : '';
    sol.work[f] = { formula: formula, sub: lhs + ' =' + rhs, result: lhs + ' = ' + fmt(value) + unit };
  }

  // units: { T, p, F } unit names (default N·m, mm, N).
  function solve(given, units) {
    units = units || METRIC;
    var names = Object.keys(given).filter(function (f) { return FIELDS.indexOf(f) >= 0; });
    for (var n = 0; n < names.length; n++) {
      var f = names[n];
      if (!isFinite(given[f])) return { error: SYM[f] + ' is not a number' };
      if (given[f] <= 0) return { error: SYM[f] + ' must be > 0' };
    }
    if (names.indexOf('eta') >= 0 && given.eta > 100) return { error: 'η must be ≤ 100%' };
    if (names.length < 4) {
      var k = 4 - names.length;
      return { incomplete: true, error: 'Enter ' + k + ' more value' + (k === 1 ? '' : 's') };
    }
    var sol = { v: {}, work: {} };
    names.forEach(function (x) { sol.v[x] = given[x]; });
    var target = FIELDS.filter(function (x) { return names.indexOf(x) < 0; })[0];
    var rule = rules(factor(units))[target];
    put(sol, target, rule.fn(sol.v), rule.f, units);
    if (target === 'eta' && sol.v.eta > 100) {
      return { error: 'No fit: η would be ' + fmt(sol.v.eta) + '% (over 100)' };
    }
    return { solutions: [sol], target: target };
  }

  var api = {
    FIELDS: FIELDS, SYM: SYM, UNITS: UNITS, METRIC: METRIC,
    isPct: isPct, fmt: fmt, parseNum: core.parseNum,
    convert: convert, factor: factor, pickInputs: pickInputs, solve: solve
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ScrewMath = api;
})(this);
