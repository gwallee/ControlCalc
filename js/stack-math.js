/* Stack index — part number ↔ col / row / layer, plus XYZ offsets.
 * Pure math, no DOM.
 * Parts fill a grid of C columns × R rows, then wrap to 1,1 on the next layer.
 *   across: col first (1,1 1,2 1,3 … then the next row) — R optional
 *   down:   row first (1,1 2,1 3,1 … then the next col) — C optional
 * The optional dimension left blank means no layers: the outer count just
 * keeps going. snake (serpentine): every even row (col, filling down) runs
 * back the other way. first is the part number of the first spot: 0 when
 * counting parts already on the stack, or 1. Positions are always 1-based.
 * Offsets from optional pitches: X = (col − 1)·px, Y = (row − 1)·py,
 * Z = (layer − 1)·pz. Formulas use FANUC TP's DIV / MOD. Works as a plain
 * browser script (window.StackMath) and under node. */
(function (root) {
  'use strict';

  var core = typeof module === 'object' && module.exports ? require('./core.js') : root.CalcCore;
  var fmt = core.fmt;
  var POS = ['col', 'row', 'layer'];
  var OFFSETS = [['X', 'col', 'px'], ['Y', 'row', 'py'], ['Z', 'layer', 'pz']];

  function isInt(x) { return isFinite(x) && Math.floor(x) === x; }

  // Record a value and its work; the substituted line swaps each symbol on
  // the right of '=' for its value. note is added after the result.
  function put(sol, f, value, formula, note) {
    sol.v[f] = value;
    var eq = formula.indexOf('=');
    var lhs = formula.slice(0, eq).trim();
    var rhs = formula.slice(eq + 1).replace(/\b(col|row|layer|n|C|R|px|py|pz)\b/g, function (k) {
      return fmt(sol.v[k]);
    });
    sol.work[f] = {
      formula: formula, sub: lhs + ' =' + rhs,
      result: lhs + ' = ' + fmt(value) + (note ? '  (' + note + ')' : '')
    };
  }

  // Inner dimension (fills first) and outer (wraps to the next layer).
  function axes(across) {
    return across
      ? { inner: 'C', outer: 'R', innerPos: 'col', outerPos: 'row' }
      : { inner: 'R', outer: 'C', innerPos: 'row', outerPos: 'col' };
  }

  // given: { C?, R?, n } or { C?, R?, col, row, layer? }, plus px / py / pz
  // opts: { across: bool, first: 0 | 1, snake: bool }
  function solve(given, opts) {
    var across = opts.across !== false, first = opts.first === 1 ? 1 : 0, snake = !!opts.snake;
    var ax = axes(across);
    var I = ax.inner, O = ax.outer, ip = ax.innerPos, op = ax.outerPos;
    var inner = given[I], outer = given[O];
    var layered = outer != null;

    if (inner == null) return { incomplete: true, error: 'Enter ' + (across ? 'columns C' : 'rows R') };
    if (!isInt(inner) || inner < 1) return { error: I + ' must be a whole number ≥ 1' };
    if (layered && (!isInt(outer) || outer < 1)) return { error: O + ' must be a whole number ≥ 1' };
    for (var p = 0; p < OFFSETS.length; p++) {
      var pk = OFFSETS[p][2];
      if (given[pk] != null && !isFinite(given[pk])) return { error: pk + ' is not a number' };
    }

    var sol = { v: {}, work: {}, layered: layered };
    var v = sol.v;
    v[I] = inner;
    if (layered) v[O] = outer;
    var N = first ? '(n − 1)' : 'n';
    // With snake, even outer lines run back: inner index counts down.
    function reversed(outerPos) { return snake && outerPos % 2 === 0; }
    var backNote = function () { return op + ' ' + v[op] + ' runs back'; };

    if (given.n != null) {
      var n = given.n;
      if (!isInt(n) || n < first) return { error: 'Part # must be a whole number ≥ ' + first };
      v.n = n;
      var i = n - first;
      if (layered) {
        put(sol, op, Math.floor(i / inner) % outer + 1, op + ' = (' + N + ' DIV ' + I + ') MOD ' + O + ' + 1');
      } else {
        put(sol, op, Math.floor(i / inner) + 1, op + ' = ' + N + ' DIV ' + I + ' + 1');
      }
      if (reversed(v[op])) {
        put(sol, ip, inner - i % inner, ip + ' = ' + I + ' − ' + N + ' MOD ' + I, backNote());
      } else {
        put(sol, ip, i % inner + 1, ip + ' = ' + N + ' MOD ' + I + ' + 1');
      }
      if (layered) put(sol, 'layer', Math.floor(i / (inner * outer)) + 1, 'layer = ' + N + ' DIV (C·R) + 1');
    } else {
      // Position → part #.
      var need = layered ? POS : [ip, op];
      for (var k = 0; k < need.length; k++) {
        var f = need[k], x = given[f];
        if (x == null) return { incomplete: true, error: 'Enter part # or ' + need.join(' / ') };
        if (!isInt(x) || x < 1) return { error: f + ' must be a whole number ≥ 1' };
        var max = f === 'col' ? given.C : f === 'row' ? given.R : null;
        if (max != null && x > max) return { error: f + ' must be ≤ ' + max };
        v[f] = x;
      }
      var back = reversed(v[op]);
      var j = back ? inner - v[ip] : v[ip] - 1; // 0-based place along the inner line
      var tail = back ? I + ' − ' + ip + (first ? ' + 1' : '') : ip + (first ? '' : ' − 1');
      var formula = 'n = (' + op + ' − 1)·' + I + ' + ' + tail;
      var n2 = (v[op] - 1) * inner + j + first;
      if (layered) {
        n2 += (v.layer - 1) * inner * outer;
        formula = 'n = (layer − 1)·C·R + (' + op + ' − 1)·' + I + ' + ' + tail;
      }
      put(sol, 'n', n2, formula, back ? backNote() : null);
    }

    // Offsets for the pitches given (Z only with layers).
    OFFSETS.forEach(function (o) {
      var axis = o[0], posKey = o[1], pitch = o[2];
      if (given[pitch] == null || v[posKey] == null) return;
      v[pitch] = given[pitch];
      put(sol, axis, (v[posKey] - 1) * given[pitch], axis + ' = (' + posKey + ' − 1)·' + pitch);
    });
    return { solutions: [sol] };
  }

  var api = { POS: POS, OFFSETS: OFFSETS, solve: solve, parseNum: core.parseNum, fmt: fmt };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StackMath = api;
})(this);
