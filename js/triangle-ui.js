/* Triangle solver screen. Math lives in triangle-math.js.
 * Two modes, each a fixed drawing with the input boxes on it (angles inside
 * the corners, sides on the edges):
 *   right — C is 90° and drawn square; enter any 2 more values.
 *   any   — enter any 3 values. */
(function (root) {
  'use strict';

  var T = root.TriangleMath;
  var STORE_KEY = 'robotcalc.triangle';
  var EXTRAS = [{ key: 'area', label: 'Area' }, { key: 'perimeter', label: 'Perimeter' }];
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var BOX_H = 44;
  var EDGES = [['a', 'B', 'C'], ['b', 'A', 'C'], ['c', 'A', 'B']]; // side x is opposite vertex X

  // Vertices as fractions of the stage. Right: A bottom-left, C (90°)
  // bottom-right, B top-right, so c is the hypotenuse.
  var MODES = {
    right: {
      label: 'Right', pinned: ['C'], aspect: 0.9,
      V: { A: [0.05, 0.92], B: [0.93, 0.06], C: [0.93, 0.92] },
      hint: 'Enter any 2 values (at least 1 side)'
    },
    any: {
      label: 'Any', pinned: [], aspect: 0.9,
      V: { A: [0.05, 0.92], B: [0.95, 0.92], C: [0.5, 0.06] },
      hint: 'Enter any 3 values (at least 1 side)'
    }
  };

  function blank() { return { order: [], text: {}, pick: 0 }; }

  function load() {
    var st = { mode: 'right', extras: false, right: blank(), any: blank() };
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
      if (Array.isArray(s.order)) s = { any: s, extras: s.extras, mode: 'any' }; // build ≤ 4
      if (MODES[s.mode]) st.mode = s.mode;
      st.extras = !!s.extras;
      ['right', 'any'].forEach(function (m) {
        if (s[m] && Array.isArray(s[m].order) && s[m].text) {
          st[m] = { order: s[m].order, text: s[m].text, pick: s[m].pick || 0 };
        }
      });
    } catch (e) { /* no storage */ }
    return st;
  }

  function save(st) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(st)); } catch (e) { /* no storage */ }
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

    var st = load();
    var openWork = {};
    var inputs = {}, boxes = {}, extraVals = {}, modeBtns = {};
    var stage = root.querySelector('.tri-stage');
    var statusEl = root.querySelector('.tri-status');
    var pickEl = root.querySelector('.tri-pick');
    var workEl = root.querySelector('.tri-work');
    var extrasEl = root.querySelector('.tri-extras');
    var extrasBtn = root.querySelector('.tri-extras-btn');
    var modesEl = root.querySelector('.tri-modes');
    var svg = root.querySelector('.tri-diagram');
    var current = { sol: null, picked: [] };

    function cur() { return st[st.mode]; }
    function mode() { return MODES[st.mode]; }

    Object.keys(MODES).forEach(function (m) {
      var b = el('button', 'seg mode-' + m);
      b.type = 'button';
      b.appendChild(svgIcon(m));
      b.appendChild(document.createTextNode(MODES[m].label));
      b.addEventListener('click', function () {
        st.mode = m;
        openWork = {};
        save(st);
        render();
      });
      modesEl.appendChild(b);
      modeBtns[m] = b;
    });

    function field(f) {
      var box = el('label', 'fld' + (T.isAngle(f) ? ' is-angle' : ''));
      box.appendChild(el('span', 'fld-name', f));
      var input = el('input', 'fld-input');
      input.type = 'text';
      input.inputMode = 'decimal';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.setAttribute('aria-label', (T.isAngle(f) ? 'angle ' : 'side ') + f);
      box.appendChild(input);
      if (T.isAngle(f)) box.appendChild(el('span', 'fld-unit', '°'));

      input.addEventListener('focus', function () {
        // Typing into a solved field starts fresh; the solved value stays visible as a hint.
        if (input.classList.contains('is-out')) {
          input.placeholder = input.value;
          input.value = '';
        }
      });
      input.addEventListener('input', function () { onType(f, input.value); });
      input.addEventListener('blur', function () { setTimeout(render, 0); });
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
      st.extras = !st.extras;
      save(st);
      render();
    });

    root.querySelector('.tri-work-btn').addEventListener('click', function () {
      Object.keys(current.sol ? current.sol.work : {}).forEach(function (k) { openWork[k] = true; });
      render();
      root.querySelector('.work-head').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    root.querySelector('.tri-clear').addEventListener('click', function () {
      st[st.mode] = blank();
      openWork = {};
      save(st);
      render();
    });

    window.addEventListener('resize', function () { layout(); });

    function onType(f, text) {
      var s = cur();
      s.order = s.order.filter(function (k) { return k !== f; });
      if (String(text).trim() === '') {
        delete s.text[f];
      } else {
        s.text[f] = text;
        s.order.unshift(f);
      }
      save(st);
      render();
    }

    function render() {
      var s = cur(), m = mode();
      var pinned = m.pinned;
      var valid = s.order.filter(function (f) {
        return pinned.indexOf(f) < 0 && isFinite(T.parseNum(s.text[f]));
      });
      var picked = T.pickInputs(valid, pinned);
      var given = {};
      picked.forEach(function (f) { given[f] = pinned.indexOf(f) >= 0 ? 90 : T.parseNum(s.text[f]); });
      var res = T.solve(given);
      var sols = res.solutions || [];
      if (s.pick >= sols.length) s.pick = 0;
      var sol = sols[s.pick] || null;
      var typedPicked = picked.filter(function (f) { return pinned.indexOf(f) < 0; });
      current = { sol: sol, picked: typedPicked };

      Object.keys(modeBtns).forEach(function (k) {
        modeBtns[k].classList.toggle('is-on', k === st.mode);
        modeBtns[k].setAttribute('aria-pressed', k === st.mode);
      });

      // Status line
      statusEl.className = 'tri-status' + (res.error ? (res.incomplete ? ' is-need' : ' is-err') : ' is-ok');
      if (res.error) {
        statusEl.textContent = typedPicked.length === 0 ? m.hint : res.error;
      } else {
        statusEl.textContent = (pinned.length ? 'Right' : res.case) + ' · from ' + typedPicked.join(', ') +
          (sols.length > 1 ? ' · 2 solutions' : '');
      }

      // Ambiguous SSA toggle (any mode only; a right triangle is never ambiguous)
      pickEl.hidden = sols.length < 2;
      pickEl.textContent = '';
      if (sols.length > 1) {
        var solvedAngle = T.ANGLES.filter(function (g) {
          return picked.indexOf(g) < 0 && sols[0].work[g] && /asin/.test(sols[0].work[g].formula);
        })[0];
        sols.forEach(function (sl, n) {
          var b = el('button', 'seg' + (n === s.pick ? ' is-on' : ''),
            (n + 1) + ': ' + solvedAngle + ' = ' + T.fmtField(solvedAngle, sl.v[solvedAngle]));
          b.type = 'button';
          b.setAttribute('aria-pressed', n === s.pick);
          b.addEventListener('click', function () { s.pick = n; save(st); render(); });
          pickEl.appendChild(b);
        });
      }

      // Boxes
      T.FIELDS.forEach(function (f) {
        var input = inputs[f];
        var hidden = pinned.indexOf(f) >= 0;
        boxes[f].hidden = hidden;
        if (hidden) return;
        var isIn = picked.indexOf(f) >= 0;
        var hasText = s.text[f] != null && s.text[f] !== '';
        var bad = hasText && !isFinite(T.parseNum(s.text[f]));
        var solved = !isIn && !bad && sol && sol.work[f];
        input.className = 'fld-input' + (isIn || bad ? ' is-in' : ' is-out') +
          (bad || (isIn && res.error && !res.incomplete) ? ' is-bad' : '');
        boxes[f].className = 'fld' + (T.isAngle(f) ? ' is-angle' : '') + (isIn || bad ? ' is-in' : ' is-out');
        if (document.activeElement === input) return;
        input.placeholder = '';
        if (isIn || bad) input.value = s.text[f];
        else input.value = solved ? T.fmt(sol.v[f]) : '';
      });

      extrasEl.hidden = !st.extras;
      extrasBtn.setAttribute('aria-expanded', st.extras);
      extrasBtn.classList.toggle('is-on', st.extras);
      EXTRAS.forEach(function (x) {
        extraVals[x.key].textContent = sol ? T.fmt(sol.v[x.key]) : '—';
      });

      renderWork(sol, picked);
      layout();
    }

    function layout() {
      drawStage(stage, svg, boxes, mode(), !!current.sol, current.picked);
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

  // --- drawing -------------------------------------------------------------

  function svgEl(tag, attrs, text) {
    var n = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }

  function pts(list) { return list.map(function (p) { return p.join(','); }).join(' '); }

  function svgIcon(m) {
    var s = svgEl('svg', { viewBox: '0 0 24 20', 'class': 'mode-icon', 'aria-hidden': 'true' });
    var V = MODES[m].V;
    s.appendChild(svgEl('polygon', {
      points: pts(['A', 'B', 'C'].map(function (g) { return [2 + V[g][0] * 20, 1 + V[g][1] * 18]; }))
    }));
    return s;
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

  // Fixed drawing for the mode: angle boxes part way from each corner toward
  // the middle, side boxes on the middle of each edge.
  function drawStage(stage, svg, boxes, m, solved, picked) {
    var W = stage.clientWidth || 320;
    var H = Math.round(W * m.aspect);
    stage.style.height = H + 'px';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

    var bw = Math.min(120, Math.floor(W * 0.33));
    var hw = bw / 2, hh = BOX_H / 2;
    var Q = {};
    T.ANGLES.forEach(function (g) { Q[g] = [m.V[g][0] * W, m.V[g][1] * H]; });
    var cx = (Q.A[0] + Q.B[0] + Q.C[0]) / 3, cy = (Q.A[1] + Q.B[1] + Q.C[1]) / 3;

    svg.textContent = '';
    var hl = function (f) { return picked.indexOf(f) >= 0 ? ' is-in' : ''; };
    svg.appendChild(svgEl('polygon', { 'class': 'dg-fill', points: pts([Q.A, Q.B, Q.C]) }));
    EDGES.forEach(function (e) {
      svg.appendChild(svgEl('line', {
        'class': 'dg-edge' + (solved ? '' : ' is-blank') + hl(e[0]),
        x1: Q[e[1]][0], y1: Q[e[1]][1], x2: Q[e[2]][0], y2: Q[e[2]][1]
      }));
    });

    var list = [];
    m.pinned.forEach(function (g) {
      // The pinned right angle: a square, no box.
      var i = T.ANGLES.indexOf(g), p = Q[g];
      var o = [(i + 1) % 3, (i + 2) % 3].map(function (n) {
        var q = Q[T.ANGLES[n]], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        return [(q[0] - p[0]) / len * 18, (q[1] - p[1]) / len * 18];
      });
      svg.appendChild(svgEl('polyline', {
        'class': 'dg-right',
        points: pts([[p[0] + o[0][0], p[1] + o[0][1]],
          [p[0] + o[0][0] + o[1][0], p[1] + o[0][1] + o[1][1]],
          [p[0] + o[1][0], p[1] + o[1][1]]])
      }));
    });
    T.ANGLES.forEach(function (g) {
      if (m.pinned.indexOf(g) >= 0) return;
      var p = Q[g];
      list.push({ f: g, x: p[0] + (cx - p[0]) * 0.45, y: p[1] + (cy - p[1]) * 0.45 });
    });
    EDGES.forEach(function (e) {
      var p1 = Q[e[1]], p2 = Q[e[2]];
      list.push({ f: e[0], x: (p1[0] + p2[0]) / 2, y: (p1[1] + p2[1]) / 2 });
    });
    list.forEach(function (b) { b.hw = hw; b.hh = hh; });
    separate(list, W, H, 6);

    var font = bw < 96 ? '14px' : bw < 108 ? '15px' : '';
    list.forEach(function (b) {
      var s = boxes[b.f].style;
      s.width = bw + 'px';
      s.height = BOX_H + 'px';
      s.fontSize = font;
      s.left = (b.x - hw) + 'px';
      s.top = (b.y - hh) + 'px';
    });
  }

  root.TriangleUI = { mount: mount };
})(this);
