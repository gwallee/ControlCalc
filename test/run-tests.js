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

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
