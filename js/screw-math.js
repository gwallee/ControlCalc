/* Ball screw thrust — pure math, no DOM.
 *   F = 2π·(η/100)·i·T / (p/1000)
 *   T  motor torque, N·m
 *   i  gear ratio, motor turns per screw turn (2 = 2:1 reduction)
 *   p  screw lead, mm per screw turn
 *   η  efficiency, %
 *   F  thrust (push force), N
 * One equation in five values: any 4 solve the 5th. kgf / lbf / lbf·in
 * conversions are solved only. Works as a plain browser script
 * (window.ScrewMath) and under node. */
(function (root) {
  'use strict';

  var core = typeof module === 'object' && module.exports ? require('./core.js') : root.CalcCore;
  var fmt = core.fmt;

  var FIELDS = ['T', 'i', 'p', 'eta', 'F'];
  var EXTRAS = ['Fkgf', 'Flbf', 'Tlbin'];
  var SYM = { T: 'T', i: 'i', p: 'p', eta: 'η', F: 'F' };
  var UNIT = { T: 'N·m', i: '', p: 'mm', eta: '%', F: 'N', Fkgf: 'kgf', Flbf: 'lbf', Tlbin: 'lbf·in' };
  var G = 9.80665, LBF = 4.4482216152605, LBF_IN = 0.1129848290276167; // N per kgf, N per lbf, N·m per lbf·in

  var RULES = {
    F: { f: 'F = 2π·(η/100)·i·T / (p/1000)', fn: function (v) { return 2 * Math.PI * v.eta / 100 * v.i * v.T / (v.p / 1000); } },
    T: { f: 'T = F·(p/1000) / (2π·(η/100)·i)', fn: function (v) { return v.F * v.p / 1000 / (2 * Math.PI * v.eta / 100 * v.i); } },
    i: { f: 'i = F·(p/1000) / (2π·(η/100)·T)', fn: function (v) { return v.F * v.p / 1000 / (2 * Math.PI * v.eta / 100 * v.T); } },
    p: { f: 'p = 1000·2π·(η/100)·i·T / F', fn: function (v) { return 1000 * 2 * Math.PI * v.eta / 100 * v.i * v.T / v.F; } },
    eta: { f: 'η = 100·F·(p/1000) / (2π·i·T)', fn: function (v) { return 100 * v.F * v.p / 1000 / (2 * Math.PI * v.i * v.T); } }
  };

  function isPct(f) { return f === 'eta'; }
  function fmtField(f, n) { return fmt(n) + (isPct(f) ? '%' : ''); }

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
  function put(sol, f, value, formula) {
    sol.v[f] = value;
    var eq = formula.indexOf('=');
    var lhs = formula.slice(0, eq).trim();
    var rhs = formula.slice(eq + 1).replace(/η|\b[TipF]\b/g, function (s) { return fmt(sol.v[KEY[s] || s]); });
    var unit = UNIT[f] ? ' ' + UNIT[f] : '';
    sol.work[f] = { formula: formula, sub: lhs + ' =' + rhs, result: lhs + ' = ' + fmt(value) + unit };
  }

  function solve(given) {
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
    put(sol, target, RULES[target].fn(sol.v), RULES[target].f);
    if (target === 'eta' && sol.v.eta > 100) {
      return { error: 'No fit: η would be ' + fmt(sol.v.eta) + '% (over 100)' };
    }
    var v = sol.v;
    put(sol, 'Fkgf', v.F / G, 'F_kgf = F / 9.80665');
    put(sol, 'Flbf', v.F / LBF, 'F_lbf = F / 4.44822');
    put(sol, 'Tlbin', v.T / LBF_IN, 'T_lbin = T / 0.112985');
    return { solutions: [sol], target: target };
  }

  var api = {
    FIELDS: FIELDS, EXTRAS: EXTRAS, SYM: SYM, UNIT: UNIT,
    isPct: isPct, fmt: fmt, fmtField: fmtField, parseNum: core.parseNum,
    pickInputs: pickInputs, solve: solve
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ScrewMath = api;
})(this);
