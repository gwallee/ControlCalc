/* Line / rectangle — pure math, no DOM.
 * Two points P1 (x1, y1) and P2 (x2, y2): the ends of a line, or the
 * diagonal corners of an axis-aligned rectangle.
 *   L = x2 − x1, W = y2 − y1   (signed rectangle length / width)
 *   D = √(L² + W²)             (line length, rectangle diagonal)
 *   θ = atan2(W, L)            (line angle, CCW from +X, −180°…180°)
 *   cx, cy = midpoint, area = |L·W|   (solved only)
 *   P3 = (x2, y1), P4 = (x1, y2)      (the other two corners, solved only)
 * points(): N points evenly spaced from P1 to P2, both ends included.
 * Unknowns are x1, y1, L, W, so any 4 independent values solve it. Works as
 * a plain browser script (window.LineMath) and under node. */
(function (root) {
  'use strict';

  var core = typeof module === 'object' && module.exports ? require('./core.js') : root.CalcCore;
  var fmt = core.fmt;
  var RAD = Math.PI / 180;

  var FIELDS = ['x1', 'y1', 'x2', 'y2', 'L', 'W', 'D', 'th'];
  var EXTRAS = ['cx', 'cy', 'area'];
  var CORNERS = ['P3', 'P4'];
  var SYM = { x1: 'x1', y1: 'y1', x2: 'x2', y2: 'y2', L: 'L', W: 'W', D: 'D', th: 'θ', cx: 'cx', cy: 'cy', area: 'area' };
  var XG = ['x1', 'x2', 'L'], YG = ['y1', 'y2', 'W'], PG = ['D', 'th'];

  function isAngle(f) { return f === 'th'; }
  function fmtField(f, n) { return isAngle(f) ? fmt(n) + '°' : fmt(n); }

  function has(list, f) { return list.indexOf(f) >= 0; }

  // What a set of picks pins down: shape = how many of (L, W) it fixes,
  // counting D and θ; xAbs / yAbs = whether an absolute x / y is known.
  function count(picked) {
    var kx = picked.filter(function (f) { return has(XG, f); });
    var ky = picked.filter(function (f) { return has(YG, f); });
    var kp = picked.filter(function (f) { return has(PG, f); }).length;
    var xShape = kx.length === 2 || has(kx, 'L') ? 1 : 0;
    var yShape = ky.length === 2 || has(ky, 'W') ? 1 : 0;
    return {
      kx: kx.length, ky: ky.length, shape: xShape + yShape + kp,
      xAbs: has(kx, 'x1') || has(kx, 'x2'), yAbs: has(ky, 'y1') || has(ky, 'y2')
    };
  }

  // order: typed fields, most recent first. Takes the newest values that
  // don't over-determine the line, up to 4.
  function pickInputs(order) {
    var picked = [];
    for (var i = 0; i < order.length && picked.length < 4; i++) {
      var f = order[i];
      if (!has(FIELDS, f) || has(picked, f)) continue;
      var c = count(picked.concat(f));
      if (c.kx > 2 || c.ky > 2 || c.shape > 2) continue;
      picked.push(f);
    }
    return picked;
  }

  var KEY = { 'θ': 'th' };

  function show(f, n) {
    var s = fmtField(f, n);
    return n < 0 ? '(' + s + ')' : s;
  }

  // Record a solved value and its work; the substituted line swaps each
  // symbol on the right of '=' for its value.
  function put(sol, f, value, formula) {
    sol.v[f] = value;
    var eq = formula.indexOf('=');
    var lhs = formula.slice(0, eq).trim();
    var rhs = formula.slice(eq + 1).replace(/θ|\b(x1|y1|x2|y2|L|W|D|cx|cy)\b/g, function (s) {
      var k = KEY[s] || s;
      return show(k, sol.v[k]);
    });
    sol.work[f] = { formula: formula, sub: lhs + ' =' + rhs, result: lhs + ' = ' + fmtField(f, value) };
  }

  // Fill in the third member of an X or Y group once two are known.
  function closeGroup(sol, p1, p2, d) {
    var v = sol.v;
    if (p1 in v && p2 in v && !(d in v)) put(sol, d, v[p2] - v[p1], d + ' = ' + p2 + ' − ' + p1);
    else if (p1 in v && d in v && !(p2 in v)) put(sol, p2, v[p1] + v[d], p2 + ' = ' + p1 + ' + ' + d);
    else if (p2 in v && d in v && !(p1 in v)) put(sol, p1, v[p2] - v[d], p1 + ' = ' + p2 + ' − ' + d);
  }

  function finish(sol) {
    var v = sol.v;
    if (!('D' in v)) put(sol, 'D', Math.sqrt(v.L * v.L + v.W * v.W), 'D = √(L² + W²)');
    if (!('th' in v)) put(sol, 'th', Math.atan2(v.W, v.L) / RAD, 'θ = atan2(W, L)');
    closeGroup(sol, 'x1', 'x2', 'L');
    closeGroup(sol, 'y1', 'y2', 'W');
    put(sol, 'cx', (v.x1 + v.x2) / 2, 'cx = (x1 + x2) / 2');
    put(sol, 'cy', (v.y1 + v.y2) / 2, 'cy = (y1 + y2) / 2');
    put(sol, 'area', Math.abs(v.L * v.W), 'area = |L·W|');
    // The other two corners, as x, y pairs.
    [['P3', 'x2', 'y1'], ['P4', 'x1', 'y2']].forEach(function (c) {
      var xy = '(' + fmt(v[c[1]]) + ', ' + fmt(v[c[2]]) + ')';
      v[c[0]] = [v[c[1]], v[c[2]]];
      sol.work[c[0]] = { formula: c[0] + ' = (' + c[1] + ', ' + c[2] + ')', sub: c[0] + ' = ' + xy, result: c[0] + ' = ' + xy };
    });
    return sol;
  }

  function seed(given) {
    var sol = { v: {}, work: {} };
    Object.keys(given).forEach(function (k) { sol.v[k] = given[k]; });
    closeGroup(sol, 'x1', 'x2', 'L');
    closeGroup(sol, 'y1', 'y2', 'W');
    return sol;
  }

  // given: { field: number } with the picked inputs.
  // Returns { solutions: [{ v, work }] } or { error, incomplete? }.
  function solve(given) {
    var names = Object.keys(given).filter(function (f) { return has(FIELDS, f); });
    for (var i = 0; i < names.length; i++) {
      if (!isFinite(given[names[i]])) return { error: SYM[names[i]] + ' is not a number' };
    }
    if (has(names, 'D') && given.D <= 0) return { error: 'D must be > 0' };
    var c = count(names);
    if (names.length < 4 || c.shape < 2 || !c.xAbs || !c.yAbs) {
      var need = [];
      if (!c.xAbs) need.push('x1 or x2');
      if (!c.yAbs) need.push('y1 or y2');
      if (c.shape < 2) need.push((2 - c.shape) + ' of L / W / D / θ');
      return { incomplete: true, error: 'Enter ' + need.join(', ') };
    }

    var sol = seed(given), v = sol.v;
    var hasL = 'L' in v, hasW = 'W' in v, hasD = 'D' in v, hasT = 'th' in v;
    if (hasD && hasT) {
      put(sol, 'L', v.D * Math.cos(v.th * RAD), 'L = D·cos θ');
      put(sol, 'W', v.D * Math.sin(v.th * RAD), 'W = D·sin θ');
    } else if (hasL && hasT) {
      if (Math.abs(Math.cos(v.th * RAD)) < 1e-12) return { error: 'θ = ±90° needs W or D, not L' };
      put(sol, 'W', v.L * Math.tan(v.th * RAD), 'W = L·tan θ');
    } else if (hasW && hasT) {
      if (Math.abs(Math.sin(v.th * RAD)) < 1e-12) return { error: 'θ = 0° / 180° needs L or D, not W' };
      put(sol, 'L', v.W / Math.tan(v.th * RAD), 'L = W / tan θ');
    } else if (hasD && (hasL || hasW)) {
      // Two answers: the other side can point either way.
      var known = hasL ? 'L' : 'W', other = hasL ? 'W' : 'L';
      if (Math.abs(v[known]) > v.D) return { error: 'No fit: need |' + known + '| ≤ D' };
      var mag = Math.sqrt(v.D * v.D - v[known] * v[known]);
      var sols = [1, -1].map(function (sign) {
        var s = seed(given);
        put(s, other, sign * mag, other + ' = ' + (sign > 0 ? '' : '−') + '√(D² − ' + known + '²)');
        return finish(s);
      });
      return { solutions: mag < 1e-12 ? [sols[0]] : sols, ambiguous: other };
    }
    return { solutions: [finish(sol)] };
  }

  // N evenly spaced points from P1 to P2 (both ends), on a solved line v.
  // Returns { points: [[x, y], …], v, work } or { error }.
  function points(v, N) {
    if (!isFinite(N) || Math.floor(N) !== N || N < 2) return { error: 'N must be a whole number ≥ 2' };
    var out = { v: { N: N, L: v.L, W: v.W, D: v.D, x1: v.x1, y1: v.y1 }, work: {} };
    var segs = N - 1;
    function put2(f, value, formula, sub) {
      out.v[f] = value;
      out.work[f] = { formula: formula, sub: sub, result: formula.split('=')[0].trim() + ' = ' + fmt(value) };
    }
    put2('sx', v.L / segs, 'sx = L / (N − 1)', 'sx = ' + show('L', v.L) + ' / (' + N + ' − 1)');
    put2('sy', v.W / segs, 'sy = W / (N − 1)', 'sy = ' + show('W', v.W) + ' / (' + N + ' − 1)');
    put2('s', v.D / segs, 's = D / (N − 1)', 's = ' + fmt(v.D) + ' / (' + N + ' − 1)');
    out.work.pt = {
      formula: 'x_k = x1 + (k − 1)·sx,  y_k = y1 + (k − 1)·sy',
      sub: 'x_k = ' + show('x1', v.x1) + ' + (k − 1)·' + show('sx', out.v.sx) +
        ',  y_k = ' + show('y1', v.y1) + ' + (k − 1)·' + show('sy', out.v.sy),
      result: 'k = 1 … ' + N
    };
    out.points = [];
    for (var k = 0; k < N; k++) {
      // The last point is P2 exactly, not P1 plus rounded steps.
      out.points.push(k === segs ? [v.x2, v.y2] : [v.x1 + k * out.v.sx, v.y1 + k * out.v.sy]);
    }
    return out;
  }

  var api = {
    FIELDS: FIELDS, EXTRAS: EXTRAS, CORNERS: CORNERS, SYM: SYM,
    isAngle: isAngle, fmt: fmt, fmtField: fmtField, parseNum: core.parseNum,
    pickInputs: pickInputs, solve: solve, points: points
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LineMath = api;
})(this);
