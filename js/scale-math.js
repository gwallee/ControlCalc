/* Value scaling — pure math, no DOM.
 *   Out = (In − InMin) / (InMax − InMin) · (OutMax − OutMin) + OutMin
 * and back again for In from Out. The four range values are always inputs;
 * whichever of In / Out was typed last is the other input. Also gives the
 * INT a Logix MOV REAL → INT would store (nearest, ties to even) and the
 * line as gain / offset, Out = m·In + b. Works as a plain browser script
 * (window.ScaleMath) and under node. */
(function (root) {
  'use strict';

  var core = typeof module === 'object' && module.exports ? require('./core.js') : root.CalcCore;
  var fmt = core.fmt;

  var RANGE = ['InMin', 'InMax', 'OutMin', 'OutMax'];
  var FIELDS = RANGE.concat(['In', 'Out']);

  function show(n) { var s = fmt(n); return n < 0 ? '(' + s + ')' : s; }

  // Record a value and its work; the substituted line swaps each name on the
  // right of '=' for its value.
  function put(sol, f, value, formula) {
    sol.v[f] = value;
    var eq = formula.indexOf('=');
    var lhs = formula.slice(0, eq).trim();
    var rhs = formula.slice(eq + 1).replace(/\b(InMin|InMax|OutMin|OutMax|In|Out|m)\b/g, function (k) {
      return show(sol.v[k]);
    });
    sol.work[f] = { formula: formula, sub: lhs + ' =' + rhs, result: lhs + ' = ' + fmt(value) };
  }

  // Round half to even, as a Logix REAL → INT move does.
  function toInt(x) {
    var r = Math.round(x);
    if (Math.abs(x % 1) === 0.5 && r % 2 !== 0) r -= 1;
    return r;
  }

  // given: the range values, plus In or Out (from = which one drives).
  function solve(given, from) {
    for (var k = 0; k < RANGE.length; k++) {
      var f = RANGE[k];
      if (given[f] == null) return { incomplete: true, error: 'Enter the input and output ranges' };
      if (!isFinite(given[f])) return { error: f + ' is not a number' };
    }
    if (given.InMax === given.InMin) return { error: 'Input min and max must differ' };
    if (from === 'Out' && given.OutMax === given.OutMin) return { error: 'Output min and max must differ' };
    var x = given[from];
    if (x == null) return { incomplete: true, error: 'Enter an input value (or a scaled value)' };
    if (!isFinite(x)) return { error: from + ' is not a number' };

    var sol = { v: {}, work: {} }, v = sol.v;
    FIELDS.forEach(function (n) { if (given[n] != null && (RANGE.indexOf(n) >= 0 || n === from)) v[n] = given[n]; });
    if (from === 'In') {
      put(sol, 'Out', (v.In - v.InMin) / (v.InMax - v.InMin) * (v.OutMax - v.OutMin) + v.OutMin,
        'Out = (In − InMin) / (InMax − InMin) · (OutMax − OutMin) + OutMin');
    } else {
      put(sol, 'In', (v.Out - v.OutMin) / (v.OutMax - v.OutMin) * (v.InMax - v.InMin) + v.InMin,
        'In = (Out − OutMin) / (OutMax − OutMin) · (InMax − InMin) + InMin');
    }
    v.INT = toInt(v.Out);
    sol.work.INT = { formula: 'INT = round(Out)', sub: 'INT = round(' + fmt(v.Out) + ')', result: 'INT = ' + v.INT };
    put(sol, 'm', (v.OutMax - v.OutMin) / (v.InMax - v.InMin), 'm = (OutMax − OutMin) / (InMax − InMin)');
    put(sol, 'b', v.OutMin - v.m * v.InMin, 'b = OutMin − m·InMin');
    var lo = Math.min(v.InMin, v.InMax), hi = Math.max(v.InMin, v.InMax);
    return { solutions: [sol], outside: v.In < lo || v.In > hi };
  }

  var api = { RANGE: RANGE, FIELDS: FIELDS, fmt: fmt, parseNum: core.parseNum, toInt: toInt, solve: solve };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ScaleMath = api;
})(this);
