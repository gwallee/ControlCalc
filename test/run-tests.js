// Zero-dependency test runner: node test/run-tests.js
'use strict';
var assert = require('assert');
var T = require('../js/triangle-math.js');

var passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.log('FAIL ' + name + '\n  ' + e.message); }
}
function near(actual, expected, tol, label) {
  tol = tol || 1e-6;
  if (!(Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected)))) {
    throw new Error((label || 'value') + ': expected ' + expected + ', got ' + actual);
  }
}
function only(res) {
  assert.ok(!res.error, 'unexpected error: ' + res.error);
  assert.strictEqual(res.solutions.length, 1);
  return res.solutions[0].v;
}

// --- parsing and input picking ---

test('parseNum', function () {
  assert.strictEqual(T.parseNum('12.5'), 12.5);
  assert.strictEqual(T.parseNum(' 3,25 '), 3.25);
  assert.strictEqual(T.parseNum('.5'), 0.5);
  assert.ok(isNaN(T.parseNum('')));
  assert.ok(isNaN(T.parseNum('-')));
  assert.ok(isNaN(T.parseNum('1.2.3')));
});

test('pickInputs takes 3 most recent', function () {
  assert.deepStrictEqual(T.pickInputs(['c', 'b', 'a', 'A']), ['c', 'b', 'a']);
});

test('pickInputs skips a third angle', function () {
  assert.deepStrictEqual(T.pickInputs(['C', 'B', 'A', 'a']), ['C', 'B', 'a']);
  assert.deepStrictEqual(T.pickInputs(['C', 'B', 'A']), ['C', 'B']);
});

test('pickInputs with a pinned right angle', function () {
  assert.deepStrictEqual(T.pickInputs(['a', 'b', 'c'], ['C']), ['C', 'a', 'b']);
  assert.deepStrictEqual(T.pickInputs(['A', 'B', 'a'], ['C']), ['C', 'A', 'a']);
  assert.deepStrictEqual(T.pickInputs(['C', 'b'], ['C']), ['C', 'b']);
});

// --- cases ---

test('SSS 3-4-5', function () {
  var res = T.solve({ a: 3, b: 4, c: 5 });
  assert.strictEqual(res.case, 'SSS');
  var v = only(res);
  near(v.C, 90); near(v.A, 36.86989765); near(v.area, 6); near(v.perimeter, 12);
});

test('SSS impossible', function () {
  assert.ok(/No triangle/.test(T.solve({ a: 1, b: 2, c: 3 }).error));
});

test('SAS', function () {
  var res = T.solve({ a: 3, b: 4, C: 90 });
  assert.strictEqual(res.case, 'SAS');
  var v = only(res);
  near(v.c, 5); near(v.B, 53.13010235);
});

test('SAS obtuse angle resolved correctly', function () {
  var v = only(T.solve({ b: 2, c: 10, A: 30 }));
  // a² = 4 + 100 − 40·cos30
  near(v.a, Math.sqrt(104 - 40 * Math.cos(Math.PI / 6)));
  assert.ok(v.C > 90, 'C should be obtuse, got ' + v.C);
  near(v.A + v.B + v.C, 180);
});

test('ASA / AAS', function () {
  var res = T.solve({ A: 30, B: 60, c: 10 });
  assert.strictEqual(res.case, 'ASA');
  var v = only(res);
  near(v.a, 5); near(v.b, 10 * Math.sqrt(3) / 2); near(v.C, 90);
  assert.strictEqual(T.solve({ A: 30, B: 60, a: 5 }).case, 'AAS');
});

test('angles too big', function () {
  assert.ok(/180/.test(T.solve({ A: 100, B: 80, a: 5 }).error));
});

test('SSA two solutions', function () {
  var res = T.solve({ A: 30, a: 5, b: 7 });
  assert.strictEqual(res.case, 'SSA');
  assert.strictEqual(res.solutions.length, 2);
  near(res.solutions[0].v.B, Math.asin(0.7) * 180 / Math.PI);
  near(res.solutions[1].v.B, 180 - Math.asin(0.7) * 180 / Math.PI);
});

test('SSA one solution when opposite side is longer', function () {
  var res = T.solve({ A: 30, a: 8, b: 7 });
  assert.strictEqual(res.solutions.length, 1);
});

test('SSA right-angle tangent case', function () {
  var res = T.solve({ A: 30, a: 3.5, b: 7 });
  assert.strictEqual(res.solutions.length, 1);
  near(res.solutions[0].v.B, 90, 1e-6);
});

test('SSA no solution', function () {
  assert.ok(/No triangle/.test(T.solve({ A: 30, a: 3, b: 7 }).error));
  assert.ok(T.solve({ A: 120, a: 5, b: 7 }).error);
});

test('incomplete and invalid', function () {
  var r = T.solve({ a: 3, b: 4 });
  assert.ok(r.incomplete);
  assert.strictEqual(r.error, 'Enter 1 more value');
  assert.strictEqual(T.solve({ A: 30, B: 40 }).error, 'Enter a side');
  assert.ok(/> 0/.test(T.solve({ a: -1, b: 4, c: 4 }).error));
  assert.ok(/between/.test(T.solve({ A: 180, b: 4, c: 4 }).error));
});

test('work shows formula, substitution, result', function () {
  var w = T.solve({ a: 3, b: 4, C: 90 }).solutions[0].work.c;
  assert.strictEqual(w.formula, 'c = √(a² + b² − 2·a·b·cos C)');
  assert.strictEqual(w.sub, 'c = √(3² + 4² − 2·3·4·cos 90°)');
  assert.strictEqual(w.result, 'c = 5');
  var area = T.solve({ a: 3, b: 4, C: 90 }).solutions[0].work.area;
  assert.strictEqual(area.sub, 'Area = ½·4·5·sin 36.87°');
});

// --- round trip: every determinate 3-field combo recovers the triangle ---

test('round trip on random triangles', function () {
  var seed = 12345;
  function rand() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  var combos = [];
  var F = T.FIELDS;
  for (var i = 0; i < 6; i++) for (var j = i + 1; j < 6; j++) for (var k = j + 1; k < 6; k++) {
    var c = [F[i], F[j], F[k]];
    if (c.some(function (f) { return !T.isAngle(f); })) combos.push(c);
  }
  assert.strictEqual(combos.length, 19);
  for (var n = 0; n < 200; n++) {
    var A = 5 + rand() * 160, B = 5 + rand() * (170 - A), C = 180 - A - B;
    var scale = 0.1 + rand() * 2000;
    var truth = { A: A, B: B, C: C };
    truth.a = scale * Math.sin(A * Math.PI / 180);
    truth.b = scale * Math.sin(B * Math.PI / 180);
    truth.c = scale * Math.sin(C * Math.PI / 180);
    combos.forEach(function (combo) {
      var given = {};
      combo.forEach(function (f) { given[f] = truth[f]; });
      var res = T.solve(given);
      assert.ok(!res.error, combo.join(',') + ' error ' + res.error);
      var match = res.solutions.some(function (s) {
        return F.every(function (f) {
          return Math.abs(s.v[f] - truth[f]) <= 1e-6 * Math.max(1, truth[f]);
        });
      });
      assert.ok(match, 'no solution matched for ' + combo.join(',') + ' ' + JSON.stringify(truth));
    });
  }
});

// ===== V nest =====
var V = require('../js/vee-math.js');

test('vee: 90° V, r = 10', function () {
  var v = V.solve({ th: 90, r: 10 }).solutions[0].v;
  near(v.d, 10 * Math.SQRT2); near(v.t, 10); near(v.g, 10 * Math.SQRT2 - 10);
  near(v.h, 10 * Math.SQRT2 + 10); near(v.D, 20); near(v.w, 10 * Math.SQRT2); near(v.e, 10 / Math.SQRT2);
});

test('vee: D and θ show work', function () {
  var w = V.solve({ th: 90, D: 20 }).solutions[0].work;
  assert.strictEqual(w.r.sub, 'r = 20 / 2');
  assert.strictEqual(w.d.formula, 'd = r / sin(θ/2)');
  assert.strictEqual(w.d.sub, 'd = 10 / sin(90°/2)');
  assert.strictEqual(w.d.result, 'd = 14.142');
});

test('vee: pickInputs treats r and D as one', function () {
  assert.deepStrictEqual(V.pickInputs(['D', 'r', 'th']), ['D', 'th']);
  assert.deepStrictEqual(V.pickInputs(['h', 'th', 'r']), ['h', 'th']);
});

test('vee: impossible pairs', function () {
  assert.ok(/d > r/.test(V.solve({ r: 10, d: 8 }).error));
  assert.ok(/h > 2·r/.test(V.solve({ r: 10, h: 15 }).error));
  assert.ok(/t < d/.test(V.solve({ d: 5, t: 6 }).error));
  assert.ok(/t > g/.test(V.solve({ t: 2, g: 3 }).error));
  assert.ok(V.solve({ th: 180, r: 1 }).error);
  assert.ok(V.solve({ r: 1 }).incomplete);
});

test('vee: round trip over every input pair', function () {
  var seed = 999;
  function rand() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  var F = V.FIELDS, pairs = [];
  for (var i = 0; i < F.length; i++) for (var j = i + 1; j < F.length; j++) {
    if (!(F[i] === 'r' && F[j] === 'D')) pairs.push([F[i], F[j]]);
  }
  assert.strictEqual(pairs.length, 20);
  for (var n = 0; n < 200; n++) {
    var th = 10 + rand() * 160, r = 0.5 + rand() * 300;
    var truth = V.solve({ th: th, r: r }).solutions[0].v;
    pairs.forEach(function (p) {
      var given = {};
      p.forEach(function (f) { given[f] = truth[f]; });
      var res = V.solve(given);
      assert.ok(!res.error, p.join(',') + ' error ' + res.error + ' ' + JSON.stringify(given));
      F.concat(V.EXTRAS).forEach(function (f) {
        near(res.solutions[0].v[f], truth[f], 1e-6, p.join(',') + ' → ' + f);
      });
    });
  }
});

// ===== Stack index =====
var ST = require('../js/stack-math.js');
function pos(res) { assert.ok(!res.error, res.error); return res.solutions[0].v; }
var ONE = { across: true, first: 1 }, ZERO = { across: true, first: 0 };

test('stack: spreadsheet example 5 cols × 1 row, part 11 (first part = 1)', function () {
  var v = pos(ST.solve({ C: 5, R: 1, n: 11 }, ONE));
  assert.deepStrictEqual([v.col, v.row, v.layer], [1, 1, 3]);
});

test('stack: counting parts on the stack, 0 is the first spot', function () {
  var v = pos(ST.solve({ C: 5, R: 2, n: 0 }, ZERO));
  assert.deepStrictEqual([v.col, v.row, v.layer], [1, 1, 1]);
  v = pos(ST.solve({ C: 5, R: 2, n: 10 }, ZERO));
  assert.deepStrictEqual([v.col, v.row, v.layer], [1, 1, 2]);
});

test('stack: across, 3 × 2, layers', function () {
  var seq = [];
  for (var n = 0; n < 7; n++) { var v = pos(ST.solve({ C: 3, R: 2, n: n }, ZERO)); seq.push([v.col, v.row, v.layer].join()); }
  assert.deepStrictEqual(seq, ['1,1,1', '2,1,1', '3,1,1', '1,2,1', '2,2,1', '3,2,1', '1,1,2']);
});

test('stack: serpentine runs even rows back, restarts each layer', function () {
  var seq = [];
  for (var n = 0; n < 10; n++) {
    var v = pos(ST.solve({ C: 3, R: 3, n: n }, { across: true, first: 0, snake: true }));
    seq.push(v.col + ',' + v.row + ',' + v.layer);
  }
  assert.deepStrictEqual(seq, ['1,1,1', '2,1,1', '3,1,1', '3,2,1', '2,2,1', '1,2,1', '1,3,1', '2,3,1', '3,3,1', '1,1,2']);
});

test('stack: serpentine down, no layers', function () {
  var seq = [];
  for (var n = 0; n < 5; n++) {
    var v = pos(ST.solve({ R: 2, n: n }, { across: false, first: 0, snake: true }));
    seq.push(v.col + ',' + v.row);
  }
  assert.deepStrictEqual(seq, ['1,1', '1,2', '2,2', '2,1', '3,1']);
});

test('stack: work is FANUC-style', function () {
  var w = ST.solve({ C: 5, R: 2, n: 11 }, ONE).solutions[0].work;
  assert.strictEqual(w.col.formula, 'col = (n − 1) MOD C + 1');
  assert.strictEqual(w.col.sub, 'col = (11 − 1) MOD 5 + 1');
  assert.strictEqual(w.row.formula, 'row = ((n − 1) DIV C) MOD R + 1');
  assert.strictEqual(w.layer.sub, 'layer = (11 − 1) DIV (5·2) + 1');
  w = ST.solve({ C: 5, R: 2, n: 7 }, { across: true, first: 0, snake: true }).solutions[0].work;
  assert.strictEqual(w.col.formula, 'col = C − n MOD C');
  assert.strictEqual(w.col.result, 'col = 3  (row 2 runs back)');
});

test('stack: XYZ offsets', function () {
  var v = pos(ST.solve({ C: 5, R: 2, n: 13, px: 50, py: -40, pz: 12.5 }, ZERO));
  assert.deepStrictEqual([v.col, v.row, v.layer], [4, 1, 2]);
  near(v.X, 150); near(v.Y, 0); near(v.Z, 12.5);
  var w = ST.solve({ C: 5, R: 2, n: 13, px: 50 }, ZERO).solutions[0].work;
  assert.strictEqual(w.X.sub, 'X = (4 − 1)·50');
  assert.strictEqual(ST.solve({ C: 5, n: 3, pz: 10 }, ZERO).solutions[0].v.Z, undefined);
});

test('stack: bad input', function () {
  assert.ok(ST.solve({ R: 2, n: 3 }, ZERO).incomplete);
  assert.ok(/whole/.test(ST.solve({ C: 2.5, n: 3 }, ZERO).error));
  assert.ok(/≥ 0/.test(ST.solve({ C: 3, n: -1 }, ZERO).error));
  assert.ok(/≥ 1/.test(ST.solve({ C: 3, n: 0 }, ONE).error));
  assert.ok(/≤ 3/.test(ST.solve({ C: 3, R: 2, col: 4, row: 1, layer: 1 }, ZERO).error));
});

test('stack: position → part # round trip, every option', function () {
  [true, false].forEach(function (across) {
    [0, 1].forEach(function (first) {
      [false, true].forEach(function (snake) {
        [[3, 2], [5, 1], [1, 4], [4, null], [null, 3], [3, 3]].forEach(function (dims) {
          var C = dims[0], R = dims[1];
          if (across ? C == null : R == null) return;
          var o = { across: across, first: first, snake: snake }, seen = {};
          for (var n = first; n < first + 40; n++) {
            var g = {}; if (C != null) g.C = C; if (R != null) g.R = R;
            g.n = n;
            var v = pos(ST.solve(g, o));
            var key = [v.col, v.row, v.layer].join();
            assert.ok(!seen[key], 'two parts in one spot ' + key + ' ' + JSON.stringify(o));
            seen[key] = 1;
            delete g.n; g.col = v.col; g.row = v.row; if (v.layer != null) g.layer = v.layer;
            assert.strictEqual(pos(ST.solve(g, o)).n, n, JSON.stringify([o, g]));
          }
        });
      });
    });
  });
});

// ===== Line / rectangle =====
var LN = require('../js/line-math.js');

test('line: corners → L, W, D, θ, center', function () {
  var v = LN.solve({ x1: 10, y1: 20, x2: 40, y2: 60 }).solutions[0].v;
  near(v.L, 30); near(v.W, 40); near(v.D, 50); near(v.th, Math.atan2(40, 30) * 180 / Math.PI);
  near(v.cx, 25); near(v.cy, 40); near(v.area, 1200);
  assert.deepStrictEqual(v.P3, [40, 20]);
  assert.deepStrictEqual(v.P4, [10, 60]);
  var w = LN.solve({ x1: 10, y1: 20, x2: 40, y2: 60 }).solutions[0].work.P3;
  assert.strictEqual(w.formula, 'P3 = (x2, y1)');
  assert.strictEqual(w.sub, 'P3 = (40, 20)');
});

test('line: angle in every quadrant', function () {
  near(LN.solve({ x1: 0, y1: 0, x2: -1, y2: 1 }).solutions[0].v.th, 135);
  near(LN.solve({ x1: 0, y1: 0, x2: -1, y2: -1 }).solutions[0].v.th, -135);
  near(LN.solve({ x1: 5, y1: 5, x2: 5, y2: 2 }).solutions[0].v.th, -90);
});

test('line: polar from P1', function () {
  var v = LN.solve({ x1: 100, y1: 50, D: 10, th: 30 }).solutions[0].v;
  near(v.x2, 100 + 10 * Math.cos(Math.PI / 6)); near(v.y2, 55);
});

test('line: D with L gives both W signs', function () {
  var r = LN.solve({ x1: 0, y1: 0, D: 5, L: 3 });
  assert.strictEqual(r.solutions.length, 2);
  near(r.solutions[0].v.y2, 4); near(r.solutions[1].v.y2, -4);
  assert.ok(/≤ D/.test(LN.solve({ x1: 0, y1: 0, D: 2, L: 3 }).error));
});

test('line: work substitutes negatives in parentheses', function () {
  var w = LN.solve({ x1: -5, y1: 0, x2: 5, y2: 0 }).solutions[0].work;
  assert.strictEqual(w.L.sub, 'L = 5 − (-5)');
  assert.strictEqual(w.th.formula, 'θ = atan2(W, L)');
});

test('line: pickInputs skips values that over-determine', function () {
  assert.deepStrictEqual(LN.pickInputs(['D', 'L', 'W', 'x1', 'y1']), ['D', 'L', 'x1', 'y1']);
  assert.deepStrictEqual(LN.pickInputs(['x2', 'x1', 'L', 'y1', 'W']), ['x2', 'x1', 'y1', 'W']);
  assert.ok(LN.solve({ x1: 1, y1: 2, x2: 3 }).incomplete);
});

test('line: round trip over every input set of 4', function () {
  var F = LN.FIELDS, sets = [];
  (function walk(start, cur) {
    if (cur.length === 4) {
      if (LN.pickInputs(cur).length === 4 && !LN.solve(cur.reduce(function (o, f) { o[f] = 1; return o; }, { })).incomplete) sets.push(cur);
      return;
    }
    for (var i = start; i < F.length; i++) walk(i + 1, cur.concat(F[i]));
  })(0, []);
  assert.ok(sets.length >= 30, 'only ' + sets.length + ' sets');
  var seed = 4242;
  function rand() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  for (var n = 0; n < 200; n++) {
    var t = { x1: rand() * 2000 - 1000, y1: rand() * 2000 - 1000, L: rand() * 800 - 400, W: rand() * 800 - 400 };
    t.x2 = t.x1 + t.L; t.y2 = t.y1 + t.W; t.D = Math.hypot(t.L, t.W); t.th = Math.atan2(t.W, t.L) * 180 / Math.PI;
    sets.forEach(function (set) {
      var g = {};
      set.forEach(function (f) { g[f] = t[f]; });
      var r = LN.solve(g);
      assert.ok(!r.error, set.join(',') + ' ' + r.error);
      var ok = r.solutions.some(function (s) {
        return F.every(function (f) { return Math.abs(s.v[f] - t[f]) <= 1e-6 * Math.max(1, Math.abs(t[f])); });
      });
      assert.ok(ok, 'no match for ' + set.join(','));
    });
  }
});

test('line: points along the line match the spreadsheet', function () {
  var v = LN.solve({ x1: 3.664, y1: -0.112, x2: 772.866, y2: 0.3905 }).solutions[0].v;
  var r = LN.points(v, 4);
  var want = [[3.664, -0.112], [260.06466666666665, 0.0555], [516.4653333333333, 0.223], [772.866, 0.3905]];
  assert.strictEqual(r.points.length, 4);
  r.points.forEach(function (p, i) { near(p[0], want[i][0]); near(p[1], want[i][1]); });
  near(r.v.sx, 256.40066666666667);
  assert.strictEqual(r.work.sx.sub, 'sx = 769.202 / (4 − 1)');
  var w = LN.solve({ x1: 5.141, y1: 358.687, x2: 770.794, y2: 359.594 }).solutions[0].v;
  near(LN.points(w, 4).points[2][1], 359.2916666666667);
  assert.ok(/≥ 2/.test(LN.points(v, 1).error));
  assert.ok(/whole/.test(LN.points(v, 2.5).error));
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
