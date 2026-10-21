/* Ball screw thrust — pure math, no DOM.
 *   T  motor torque          metric N·m    imperial lbf·in
 *   i  gear ratio, motor turns per screw turn (2 = 2:1 reduction)
 *   p  screw lead, per turn  metric mm     imperial in
 *   η  efficiency, %
 *   F  thrust (push force)   metric N      imperial lbf
 *   metric:   F = 2π·(η/100)·i·T / (p/1000)   (lead in mm, torque in N·m)
 *   imperial: F = 2π·(η/100)·i·T / p          (inches cancel)
 * One equation in five values: any 4 solve the 5th. Works as a plain
 * browser script (window.ScrewMath) and under node. */
(function (root) {
  'use strict';

  var core = typeof module === 'object' && module.exports ? require('./core.js') : root.CalcCore;
  var fmt = core.fmt;

  var FIELDS = ['T', 'i', 'p', 'eta', 'F'];
  var SYM = { T: 'T', i: 'i', p: 'p', eta: 'η', F: 'F' };
  var UNITS = {
    metric: { T: 'N·m', p: 'mm', F: 'N', eta: '%', i: '' },
    imperial: { T: 'lbf·in', p: 'in', F: 'lbf', eta: '%', i: '' }
  };
  var TWO_PI_ETA = 2 * Math.PI / 100;

  // k scales the lead to the torque's length unit: mm → m (1000), or 1 for in.
  function rules(k) {
    var P = k === 1 ? 'p' : '(p/1000)';
    return {
      F: { f: 'F = 2π·(η/100)·i·T / ' + P, fn: function (v) { return TWO_PI_ETA * v.eta * v.i * v.T / (v.p / k); } },
      T: { f: 'T = F·' + P + ' / (2π·(η/100)·i)', fn: function (v) { return v.F * v.p / k / (TWO_PI_ETA * v.eta * v.i); } },
      i: { f: 'i = F·' + P + ' / (2π·(η/100)·T)', fn: function (v) { return v.F * v.p / k / (TWO_PI_ETA * v.eta * v.T); } },
      p: {
        f: k === 1 ? 'p = 2π·(η/100)·i·T / F' : 'p = 1000·2π·(η/100)·i·T / F',
        fn: function (v) { return k * TWO_PI_ETA * v.eta * v.i * v.T / v.F; }
      },
      eta: { f: 'η = 100·F·' + P + ' / (2π·i·T)', fn: function (v) { return 100 * v.F * v.p / k / (2 * Math.PI * v.i * v.T); } }
    };
  }
  var RULES = { metric: rules(1000), imperial: rules(1) };

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
    var unit = units[f] ? ' ' + units[f] : '';
    sol.work[f] = { formula: formula, sub: lhs + ' =' + rhs, result: lhs + ' = ' + fmt(value) + unit };
  }

  // system: 'metric' (default) or 'imperial'.
  function solve(given, system) {
    system = system === 'imperial' ? 'imperial' : 'metric';
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
    var rule = RULES[system][target];
    put(sol, target, rule.fn(sol.v), rule.f, UNITS[system]);
    if (target === 'eta' && sol.v.eta > 100) {
      return { error: 'No fit: η would be ' + fmt(sol.v.eta) + '% (over 100)' };
    }
    return { solutions: [sol], target: target };
  }

  var api = {
    FIELDS: FIELDS, SYM: SYM, UNITS: UNITS,
    isPct: isPct, fmt: fmt, parseNum: core.parseNum,
    pickInputs: pickInputs, solve: solve
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ScrewMath = api;
})(this);
