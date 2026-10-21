/* Triangle solver screen. Math lives in triangle-math.js.
 * Two modes, each a fixed drawing with the input boxes on it (angles inside
 * the corners, sides on the edges):
 *   right — C is 90° and drawn square; enter any 2 more values.
 *   any   — enter any 3 values. */
(function (root) {
  'use strict';

  var T = root.TriangleMath, K = root.UIKit;
  var el = K.el, svgEl = K.svgEl, pts = K.pts;
  var STORE_KEY = 'robotcalc.triangle';
  var EXTRAS = [{ key: 'area', label: 'Area' }, { key: 'perimeter', label: 'Perimeter' }];
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
    var s = K.load(STORE_KEY);
    if (Array.isArray(s.order)) s = { any: s, extras: s.extras, mode: 'any' }; // build ≤ 4
    if (MODES[s.mode]) st.mode = s.mode;
    st.extras = !!s.extras;
    ['right', 'any'].forEach(function (m) {
      if (s[m] && Array.isArray(s[m].order) && s[m].text) {
        st[m] = { order: s[m].order, text: s[m].text, pick: s[m].pick || 0 };
      }
    });
    return st;
  }

  function save(st) { K.save(STORE_KEY, st); }

  function mount(container) {
    var root = document.getElementById('tpl-triangle').content.firstElementChild.cloneNode(true);
    container.appendChild(root);

    var st = load();
    var openWork = {};
    var fields = {}, extraVals = {}, modeBtns = {};
    var stage = root.querySelector('.calc-stage');
    var statusEl = root.querySelector('.calc-status');
    var pickEl = root.querySelector('.calc-pick');
    var workEl = root.querySelector('.calc-work');
    var extrasEl = root.querySelector('.calc-extras');
    var extrasBtn = root.querySelector('.calc-extras-btn');
    var modesEl = root.querySelector('.calc-modes');
    var svg = root.querySelector('.calc-diagram');
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

    T.FIELDS.forEach(function (f) {
      fields[f] = K.field(stage, {
        name: f,
        label: (T.isAngle(f) ? 'angle ' : 'side ') + f,
        angle: T.isAngle(f),
        onInput: function (text) { onType(f, text); },
        onDone: function () { render(); }
      });
    });

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

    K.workToggle(root, function () { return openWork; }, function () { render(); });

    root.querySelector('.calc-clear').addEventListener('click', function () {
      st[st.mode] = blank();
      openWork = {};
      save(st);
      render();
    });

    function onResize() {
      if (!root.isConnected) window.removeEventListener('resize', onResize);
      else layout();
    }
    window.addEventListener('resize', onResize);

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
      statusEl.className = 'calc-status' + (res.error ? (res.incomplete ? ' is-need' : ' is-err') : ' is-ok');
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
        var hidden = pinned.indexOf(f) >= 0;
        fields[f].box.hidden = hidden;
        if (hidden) return;
        var hasText = s.text[f] != null && s.text[f] !== '';
        K.paint(fields[f], {
          typed: picked.indexOf(f) >= 0,
          text: s.text[f],
          bad: hasText && !isFinite(T.parseNum(s.text[f])),
          err: res.error && !res.incomplete,
          solved: sol && sol.work[f] ? T.fmt(sol.v[f]) : null
        });
      });

      extrasEl.hidden = !st.extras;
      extrasBtn.setAttribute('aria-expanded', st.extras);
      extrasBtn.classList.toggle('is-on', st.extras);
      EXTRAS.forEach(function (x) {
        extraVals[x.key].textContent = sol ? T.fmt(sol.v[x.key]) : '—';
      });

      K.renderWork(workEl, sol, T.FIELDS.filter(function (f) { return picked.indexOf(f) < 0; })
        .concat(EXTRAS.map(function (x) { return x.key; })), openWork);
      layout();
    }

    function layout() {
      drawStage(stage, svg, fields, mode(), !!current.sol, current.picked);
    }

    render();
  }

  // --- drawing -------------------------------------------------------------

  function svgIcon(m) {
    var s = svgEl('svg', { viewBox: '0 0 24 20', 'class': 'mode-icon', 'aria-hidden': 'true' });
    var V = MODES[m].V;
    s.appendChild(svgEl('polygon', {
      points: pts(['A', 'B', 'C'].map(function (g) { return [2 + V[g][0] * 20, 1 + V[g][1] * 18]; }))
    }));
    return s;
  }

  // Fixed drawing for the mode: angle boxes part way from each corner toward
  // the middle, side boxes on the middle of each edge.
  function drawStage(stage, svg, fields, m, solved, picked) {
    var W = stage.clientWidth || 320;
    var H = Math.round(W * m.aspect);
    stage.style.height = H + 'px';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

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
    K.placeBoxes(fields, list, W, H);
  }

  root.TriangleUI = { mount: mount };
})(this);
