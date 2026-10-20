/* Triangle solver screen. Math lives in triangle-math.js.
 * The input boxes sit on the drawn triangle: angles at the corners, sides on
 * the edges. The drawing (and the boxes with it) only reshapes when no box
 * has focus, so nothing moves while the user is typing. */
(function (root) {
  'use strict';

  var T = root.TriangleMath;
  var STORE_KEY = 'robotcalc.triangle';
  var EXTRAS = [{ key: 'area', label: 'Area' }, { key: 'perimeter', label: 'Perimeter' }];
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var BOX_H = 44;

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && Array.isArray(s.order) && s.text) {
        return { order: s.order, text: s.text, pick: s.pick || 0, extras: !!s.extras };
      }
    } catch (e) { /* no storage */ }
    return { order: [], text: {}, pick: 0, extras: false };
  }

  function save(state) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* no storage */ }
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function mount(container) {
    var root = document.getElementById('tpl-triangle').content.firstElementChild.cloneNode(true);
    container.appendChild(root);

    var state = load();
    var openWork = {};
    var inputs = {}, boxes = {}, extraVals = {};
    var stage = root.querySelector('.tri-stage');
    var statusEl = root.querySelector('.tri-status');
    var pickEl = root.querySelector('.tri-pick');
    var workEl = root.querySelector('.tri-work');
    var extrasEl = root.querySelector('.tri-extras');
    var extrasBtn = root.querySelector('.tri-extras-btn');
    var svg = root.querySelector('.tri-diagram');
    var current = { sol: null, picked: [] };

    function field(f) {
      var box = el('label', 'fld');
      box.appendChild(el('span', 'fld-name', f));
      var input = el('input', 'fld-input');
      input.type = 'text';
      input.inputMode = 'decimal';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.setAttribute('aria-label', (T.isAngle(f) ? 'angle ' : 'side ') + f);
      box.appendChild(input);

      input.addEventListener('focus', function () {
        // Typing into a solved field starts fresh; the solved value stays visible as a hint.
        if (input.classList.contains('is-out')) {
          input.placeholder = input.value;
          input.value = '';
        }
      });
      input.addEventListener('input', function () { onType(f, input.value); });
      input.addEventListener('blur', function () {
        // Wait to see whether focus moved to another box before reshaping.
        setTimeout(render, 0);
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') input.blur();
      });

      inputs[f] = input;
      boxes[f] = box;
      stage.appendChild(box);
    }

    T.FIELDS.forEach(field);

    EXTRAS.forEach(function (x) {
      var row = el('div', 'extra');
      row.appendChild(el('span', 'extra-name', x.label));
      var val = el('span', 'extra-val', '—');
      row.appendChild(val);
      extrasEl.appendChild(row);
      extraVals[x.key] = val;
    });

    extrasBtn.addEventListener('click', function () {
      state.extras = !state.extras;
      save(state);
      render();
    });

    root.querySelector('.tri-work-btn').addEventListener('click', function () {
      Object.keys(current.sol ? current.sol.work : {}).forEach(function (k) { openWork[k] = true; });
      render();
      root.querySelector('.work-head').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    root.querySelector('.tri-clear').addEventListener('click', function () {
      state = { order: [], text: {}, pick: 0, extras: state.extras };
      openWork = {};
      save(state);
      render();
    });

    window.addEventListener('resize', function () { if (!typing()) layout(); });

    function typing() {
      return T.FIELDS.some(function (f) { return document.activeElement === inputs[f]; });
    }

    function onType(f, text) {
      state.order = state.order.filter(function (k) { return k !== f; });
      if (String(text).trim() === '') {
        delete state.text[f];
      } else {
        state.text[f] = text;
        state.order.unshift(f);
      }
      save(state);
      render();
    }

    function render() {
      var valid = state.order.filter(function (f) { return isFinite(T.parseNum(state.text[f])); });
      var picked = T.pickInputs(valid);
      var given = {};
      picked.forEach(function (f) { given[f] = T.parseNum(state.text[f]); });
      var res = T.solve(given);
      var sols = res.solutions || [];
      if (state.pick >= sols.length) state.pick = 0;
      var sol = sols[state.pick] || null;
      current = { sol: sol, picked: picked };

      // Status line
      statusEl.className = 'tri-status' + (res.error ? (res.incomplete ? ' is-need' : ' is-err') : ' is-ok');
      if (res.error) {
        statusEl.textContent = picked.length === 0 ? 'Enter any 3 values (at least 1 side)' : res.error;
      } else {
        statusEl.textContent = res.case + ' · from ' + picked.join(', ') +
          (sols.length > 1 ? ' · 2 solutions' : '');
      }

      // Ambiguous SSA toggle
      pickEl.hidden = sols.length < 2;
      pickEl.textContent = '';
      if (sols.length > 1) {
        var solvedAngle = T.ANGLES.filter(function (g) {
          return picked.indexOf(g) < 0 && sols[0].work[g] && /asin/.test(sols[0].work[g].formula);
        })[0];
        sols.forEach(function (s, n) {
          var b = el('button', 'seg' + (n === state.pick ? ' is-on' : ''),
            (n + 1) + ': ' + solvedAngle + ' = ' + T.fmtField(solvedAngle, s.v[solvedAngle]));
          b.type = 'button';
          b.setAttribute('aria-pressed', n === state.pick);
          b.addEventListener('click', function () { state.pick = n; save(state); render(); });
          pickEl.appendChild(b);
        });
      }

      // Boxes
      T.FIELDS.forEach(function (f) {
        var input = inputs[f];
        var isIn = picked.indexOf(f) >= 0;
        var hasText = state.text[f] != null && state.text[f] !== '';
        var bad = hasText && !isFinite(T.parseNum(state.text[f]));
        var solved = !isIn && !bad && sol && sol.work[f];
        input.className = 'fld-input' + (isIn || bad ? ' is-in' : ' is-out') +
          (bad || (isIn && res.error && !res.incomplete) ? ' is-bad' : '');
        boxes[f].className = 'fld' + (isIn || bad ? ' is-in' : ' is-out');
        if (document.activeElement === input) return;
        input.placeholder = '';
        if (isIn || bad) input.value = state.text[f];
        else input.value = solved ? T.fmt(sol.v[f]) : '';
      });

      extrasEl.hidden = !state.extras;
      extrasBtn.setAttribute('aria-expanded', state.extras);
      extrasBtn.classList.toggle('is-on', state.extras);
      EXTRAS.forEach(function (x) {
        extraVals[x.key].textContent = sol ? T.fmt(sol.v[x.key]) : '—';
      });

      renderWork(sol, picked);
      if (!typing()) layout();
    }

    function layout() {
      drawStage(stage, svg, boxes, current.sol, current.picked);
    }

    function renderWork(sol, picked) {
      workEl.textContent = '';
      if (!sol) {
        workEl.appendChild(el('p', 'work-empty', 'Solved values show their formulas here.'));
        return;
      }
      var keys = T.FIELDS.filter(function (f) { return picked.indexOf(f) < 0 && sol.work[f]; })
        .concat(EXTRAS.map(function (x) { return x.key; }));
      keys.forEach(function (k) {
        var w = sol.work[k];
        var d = el('details', 'work-item');
        d.dataset.key = k;
        d.open = !!openWork[k];
        d.appendChild(el('summary', 'work-result', w.result));
        d.appendChild(el('div', 'work-formula', w.formula));
        d.appendChild(el('div', 'work-sub', w.sub));
        d.appendChild(el('div', 'work-final', w.result));
        d.addEventListener('toggle', function () { openWork[k] = d.open; });
        workEl.appendChild(d);
      });
    }

    render();
  }

  // --- diagram -------------------------------------------------------------

  function svgEl(tag, attrs, text) {
    var n = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }

  // Fixed shapes, not to scale: a regular triangle, or a right triangle with
  // the square corner wherever the solution has exactly 90°. c is the base,
  // A left, B right, C on top.
  var SHAPES = {
    none: { C: [0.5, 0.8], g: [60, 60, 60] },
    A: { C: [0, 0.75], g: [90, 45, 45] },
    B: { C: [1, 0.75], g: [45, 90, 45] },
    C: { C: [0.5, 0.5], g: [45, 45, 90] }
  };

  function shape(v) {
    var right = T.ANGLES.filter(function (g) { return v && Math.abs(v[g] - 90) < 1e-6; })[0] || 'none';
    var s = SHAPES[right];
    return { g: s.g, P: { A: [0, 0], B: [1, 0], C: s.C }, top: 'C', left: 'A', right: 'B',
      base: 'c', leftSide: 'b', rightSide: 'a' };
  }

  // Center for a box of half-size hw x hh pushed off point p along unit dir d
  // until its edge clears p by gap.
  function clear(p, d, hw, hh, gap) {
    var t = 1 / Math.max(Math.abs(d[0]) / hw, Math.abs(d[1]) / hh, 1e-9) + gap;
    return [p[0] + d[0] * t, p[1] + d[1] * t];
  }

  function unit(dx, dy) {
    var len = Math.hypot(dx, dy) || 1;
    return [dx / len, dy / len];
  }

  // Push overlapping boxes apart, then keep them inside the stage.
  function separate(list, W, H, gap) {
    for (var it = 0; it < 40; it++) {
      var moved = false;
      for (var i = 0; i < list.length; i++) {
        for (var j = i + 1; j < list.length; j++) {
          var p = list[i], q = list[j];
          var dx = q.x - p.x, dy = q.y - p.y;
          var ox = p.hw + q.hw + gap - Math.abs(dx), oy = p.hh + q.hh + gap - Math.abs(dy);
          if (ox <= 0 || oy <= 0) continue;
          moved = true;
          if (ox < oy) {
            var sx = (dx >= 0 ? 1 : -1) * ox / 2;
            p.x -= sx; q.x += sx;
          } else {
            var sy = (dy >= 0 ? 1 : -1) * oy / 2;
            p.y -= sy; q.y += sy;
          }
        }
      }
      list.forEach(function (b) {
        b.x = Math.max(b.hw, Math.min(W - b.hw, b.x));
        b.y = Math.max(b.hh, Math.min(H - b.hh, b.y));
      });
      if (!moved) break;
    }
  }

  function drawStage(stage, svg, boxes, sol, picked) {
    var W = stage.clientWidth || 320;

    var PAD = 4, GAP = 6;
    var bw = Math.min(108, Math.floor((W - 2 * PAD - 2 * GAP) / 3)); // bottom row must fit
    var hw = bw / 2, hh = BOX_H / 2;
    var sh = shape(sol && sol.v);
    var EDGES = [['a', 'B', 'C'], ['b', 'A', 'C'], ['c', 'A', 'B']]; // side x is opposite vertex X

    // Triangle at scale sc (y up → screen y down), plus box centers: top
    // corner box above it, left corner · base · right corner in a row under
    // the base, the other two sides just outside the middle of their edges.
    function place(sh, sc, ox, oy) {
      var Q = {};
      T.ANGLES.forEach(function (g) { Q[g] = [ox + sh.P[g][0] * sc, oy - sh.P[g][1] * sc]; });
      var gap = GAP, below = oy + gap + hh;
      var lft = Q[sh.left], rgt = Q[sh.right], top = Q[sh.top];
      var list = [
        // Top box tucks in like the corners, so it never sticks out past the row.
        { f: sh.top, x: Math.max(lft[0] + hw - 14, Math.min(rgt[0] - hw + 14, top[0])), y: top[1] - gap - hh },
        { f: sh.left, x: lft[0] + hw - 14, y: below }, // tucked in under its corner
        { f: sh.base, x: (lft[0] + rgt[0]) / 2, y: below },
        { f: sh.right, x: rgt[0] - hw + 14, y: below }
      ];
      [[sh.leftSide, lft, -1], [sh.rightSide, rgt, 1]].forEach(function (e) {
        var p = e[1], m = [(p[0] + top[0]) / 2, (p[1] + top[1]) / 2];
        var n = unit(top[1] - p[1], p[0] - top[0]);
        if (n[0] * e[2] < 0) n = [-n[0], -n[1]];
        // A vertical edge (right angle at A or B) gets its box on the line;
        // beside it there's no room next to the bottom row.
        var c = Math.abs(n[0]) > 0.95 ? m : clear(m, n, hw, hh, 2);
        list.push({ f: e[0], x: c[0], y: c[1] });
      });
      list.forEach(function (bx) { bx.hw = hw; bx.hh = hh; });
      // Keep the bottom row in order and clear of each other.
      var row = [list[1], list[2], list[3]];
      for (var i = 1; i < 3; i++) row[i].x = Math.max(row[i].x, row[i - 1].x + bw + gap);
      for (i = 1; i >= 0; i--) row[i].x = Math.min(row[i].x, row[i + 1].x - bw - gap);
      return { Q: Q, list: list };
    }

    // Extent of the drawing. The slanted sides' boxes only count vertically:
    // on a narrow stage they slide in over their edge (separate() keeps them
    // inside) rather than shrinking the triangle.
    function bounds(pl) {
      var r = { l: Infinity, r: -Infinity, t: Infinity, b: -Infinity };
      function addX(x) { r.l = Math.min(r.l, x); r.r = Math.max(r.r, x); }
      function addY(y) { r.t = Math.min(r.t, y); r.b = Math.max(r.b, y); }
      T.ANGLES.forEach(function (g) { addX(pl.Q[g][0]); addY(pl.Q[g][1]); });
      pl.list.forEach(function (bx) {
        if (bx.f !== sh.leftSide && bx.f !== sh.rightSide) { addX(bx.x - bx.hw); addX(bx.x + bx.hw); }
        addY(bx.y - bx.hh); addY(bx.y + bx.hh);
      });
      return r;
    }

    // Largest triangle whose boxes still fit in W x H. Scanned down from the
    // stage width: a small triangle pushes the side boxes out past the bottom
    // row, so "fits" isn't monotonic and a bisection would miss.
    function fit(sh, H) {
      for (var sc = W; sc > 20; sc *= 0.98) {
        var bb = bounds(place(sh, sc, 0, 0));
        if (bb.r - bb.l <= W - 2 * PAD && bb.b - bb.t <= H - 2 * PAD) return sc;
      }
      return 20;
    }

    // Stage height fits the tallest shape (the regular one), so the controls
    // below don't jump when a right angle comes or goes.
    var tall = shape(null), bt = bounds(place(tall, fit(tall, 1e4), 0, 0));
    var H = Math.round(Math.min(420, bt.b - bt.t + 2 * PAD + 8));
    stage.style.height = H + 'px';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

    var sc = fit(sh, H), bb0 = bounds(place(sh, sc, 0, 0));
    var pl = place(sh, sc, (W - (bb0.r - bb0.l)) / 2 - bb0.l, (H - (bb0.b - bb0.t)) / 2 - bb0.t);
    var Q = pl.Q, list = pl.list;

    svg.textContent = '';
    var hl = function (f) { return picked.indexOf(f) >= 0 ? ' is-in' : ''; };
    svg.appendChild(svgEl('polygon', {
      'class': 'dg-fill',
      points: [Q.A, Q.B, Q.C].map(function (p) { return p.join(','); }).join(' ')
    }));
    EDGES.forEach(function (e) {
      svg.appendChild(svgEl('line', {
        'class': 'dg-edge' + (sol ? '' : ' is-blank') + hl(e[0]),
        x1: Q[e[1]][0], y1: Q[e[1]][1], x2: Q[e[2]][0], y2: Q[e[2]][1]
      }));
    });

    // Right-angle squares, built along the drawn edges.
    T.ANGLES.forEach(function (gName, i) {
      if (Math.abs(sh.g[i] - 90) > 1e-6) return;
      var p = Q[gName];
      var o = [(i + 1) % 3, (i + 2) % 3].map(function (n) {
        var q = Q[T.ANGLES[n]], u = unit(q[0] - p[0], q[1] - p[1]);
        var m = Math.min(14, Math.hypot(q[0] - p[0], q[1] - p[1]) / 3);
        return [u[0] * m, u[1] * m];
      });
      svg.appendChild(svgEl('polyline', {
        'class': 'dg-right',
        points: [[p[0] + o[0][0], p[1] + o[0][1]],
          [p[0] + o[0][0] + o[1][0], p[1] + o[0][1] + o[1][1]],
          [p[0] + o[1][0], p[1] + o[1][1]]].map(function (q) { return q.join(','); }).join(' ')
      }));
    });

    separate(list, W, H, 6);
    list.forEach(function (b) {
      var s = boxes[b.f].style;
      s.width = bw + 'px';
      s.height = BOX_H + 'px';
      s.fontSize = bw < 96 ? '14px' : bw < 108 ? '16px' : '';
      s.left = (b.x - hw) + 'px';
      s.top = (b.y - hh) + 'px';
    });
  }

  root.TriangleUI = { mount: mount };
})(this);
