/* Stack index — part number ↔ col / row / layer. Pure math, no DOM.
 * Parts fill a grid of C columns × R rows, then wrap to the next layer.
 *   across: col first (1,1 1,2 1,3 … then the next row) — R optional
 *   down:   row first (1,1 2,1 3,1 … then the next col) — C optional
 * The optional dimension left blank means no layers: the outer count just
 * keeps going. base is 1 (first part, col, row, layer = 1) or 0.
 * Formulas use FANUC TP's DIV / MOD. Works as a plain browser script
 * (window.StackMath) and under node. */
(function (root) {
  'use strict';

  var core = typeof module === 'object' && module.exports ? require('./core.js') : root.CalcCore;
  var POS = ['col', 'row', 'layer'];

  function isInt(x) { return isFinite(x) && Math.floor(x) === x; }

  // Record a value and its work; the substituted line swaps each symbol on
  // the right of '=' for its value.
  function put(sol, f, value, formula) {
    sol.v[f] = value;
    var eq = formula.indexOf('=');
    var lhs = formula.slice(0, eq).trim();
    var rhs = formula.slice(eq + 1).replace(/\b(col|row|layer|n|C|R)\b/g, function (k) {
      return String(sol.v[k]);
    });
    sol.work[f] = { formula: formula, sub: lhs + ' =' + rhs, result: lhs + ' = ' + value };
  }

  // Inner dimension (fills first) and outer (wraps to the next layer).
  function axes(across) {
    return across
      ? { inner: 'C', outer: 'R', innerPos: 'col', outerPos: 'row' }
      : { inner: 'R', outer: 'C', innerPos: 'row', outerPos: 'col' };
  }

  // given: { C?, R?, n } or { C?, R?, col, row, layer? }
  // opts: { across: bool, base: 0 | 1 }
  function solve(given, opts) {
    var across = opts.across !== false, b = opts.base === 0 ? 0 : 1;
    var ax = axes(across);
    var inner = given[ax.inner], outer = given[ax.outer];
    var layered = outer != null;

    if (inner == null) return { incomplete: true, error: 'Enter ' + (across ? 'columns C' : 'rows R') };
    if (!isInt(inner) || inner < 1) return { error: ax.inner + ' must be a whole number ≥ 1' };
    if (layered && (!isInt(outer) || outer < 1)) return { error: ax.outer + ' must be a whole number ≥ 1' };

    var sol = { v: {}, work: {}, layered: layered };
    var v = sol.v;
    v[ax.inner] = inner;
    if (layered) v[ax.outer] = outer;
    var m1 = b ? ' − 1' : '', p1 = b ? ' + 1' : '';
    var nm = b ? '(n − 1)' : 'n';

    if (given.n != null) {
      var n = given.n;
      if (!isInt(n) || n < b) return { error: 'Part # must be a whole number ≥ ' + b };
      v.n = n;
      var i = n - b;
      put(sol, ax.innerPos, i % inner + b, ax.innerPos + ' = ' + nm + ' MOD ' + ax.inner + p1);
      if (layered) {
        put(sol, ax.outerPos, Math.floor(i / inner) % outer + b,
          ax.outerPos + ' = (' + nm + ' DIV ' + ax.inner + ') MOD ' + ax.outer + p1);
        put(sol, 'layer', Math.floor(i / (inner * outer)) + b, 'layer = ' + nm + ' DIV (C·R)' + p1);
      } else {
        put(sol, ax.outerPos, Math.floor(i / inner) + b, ax.outerPos + ' = ' + nm + ' DIV ' + ax.inner + p1);
      }
      return { solutions: [sol] };
    }

    // Position → part #.
    var need = layered ? POS : [ax.innerPos, ax.outerPos];
    for (var k = 0; k < need.length; k++) {
      var f = need[k], x = given[f];
      if (x == null) return { incomplete: true, error: 'Enter part # or ' + need.join(' / ') };
      if (!isInt(x) || x < b) return { error: f + ' must be a whole number ≥ ' + b };
      var max = f === 'col' ? given.C : f === 'row' ? given.R : null;
      if (max != null && x > max - 1 + b) return { error: f + ' must be ≤ ' + (max - 1 + b) };
      v[f] = x;
    }
    var op = b ? '(' + ax.outerPos + m1 + ')' : ax.outerPos;
    var n2 = (v[ax.outerPos] - b) * inner + (v[ax.innerPos] - b) + b;
    var f2 = 'n = ' + op + '·' + ax.inner + ' + ' + ax.innerPos;
    if (layered) {
      n2 += (v.layer - b) * inner * outer;
      f2 = 'n = ' + (b ? '(layer − 1)' : 'layer') + '·C·R + ' + op + '·' + ax.inner + ' + ' + ax.innerPos;
    }
    put(sol, 'n', n2, f2);
    return { solutions: [sol] };
  }

  var api = { POS: POS, solve: solve, parseNum: core.parseNum };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StackMath = api;
})(this);
