/* Triangle solver screen. Math lives in triangle-math.js. */
(function (root) {
  'use strict';

  var T = root.TriangleMath;
  var STORE_KEY = 'robotcalc.triangle';
  var EXTRAS = [{ key: 'area', label: 'Area' }, { key: 'perimeter', label: 'Perimeter' }];
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && Array.isArray(s.order) && s.text) return { order: s.order, text: s.text, pick: s.pick || 0 };
    } catch (e) { /* no storage */ }
    return { order: [], text: {}, pick: 0 };
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
    var inputs = {}, fxButtons = {}, extraVals = {};
    var grid = root.querySelector('.tri-grid');
    var statusEl = root.querySelector('.tri-status');
    var pickEl = root.querySelector('.tri-pick');
    var workEl = root.querySelector('.tri-work');
    var extrasEl = root.querySelector('.tri-extras');
    var svg = root.querySelector('.tri-diagram');

    function field(f) {
      var wrap = el('div', 'fld');
      var label = el('label', 'fld-box');
      label.appendChild(el('span', 'fld-name', f));
      var input = el('input', 'fld-input');
      input.type = 'text';
      input.inputMode = 'decimal';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.setAttribute('aria-label', (T.isAngle(f) ? 'angle ' : 'side ') + f);
      label.appendChild(input);
      wrap.appendChild(label);
      var fx = el('button', 'fx', 'ƒx');
      fx.type = 'button';
      fx.setAttribute('aria-label', 'Show work for ' + f);
      fx.addEventListener('click', function () { showWork(f); });
      wrap.appendChild(fx);

      input.addEventListener('focus', function () {
        // Typing into a solved field starts fresh; the solved value stays visible as a hint.
        if (input.classList.contains('is-out')) {
          input.placeholder = input.value;
          input.value = '';
        }
      });
      input.addEventListener('input', function () { onType(f, input.value); });
      input.addEventListener('blur', function () { render(); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') input.blur();
      });

      inputs[f] = input;
      fxButtons[f] = fx;
      return wrap;
    }

    for (var i = 0; i < 3; i++) {
      grid.appendChild(field(T.SIDES[i]));
      grid.appendChild(field(T.ANGLES[i]));
    }

    EXTRAS.forEach(function (x) {
      var row = el('div', 'extra');
      row.appendChild(el('span', 'extra-name', x.label));
      var val = el('span', 'extra-val', '—');
      row.appendChild(val);
      var fx = el('button', 'fx', 'ƒx');
      fx.type = 'button';
      fx.setAttribute('aria-label', 'Show work for ' + x.label);
      fx.addEventListener('click', function () { showWork(x.key); });
      row.appendChild(fx);
      extrasEl.appendChild(row);
      extraVals[x.key] = val;
      fxButtons[x.key] = fx;
    });

    root.querySelector('.tri-clear').addEventListener('click', function () {
      state = { order: [], text: {}, pick: 0 };
      openWork = {};
      save(state);
      render();
    });

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

    function showWork(key) {
      openWork[key] = true;
      render();
      var d = workEl.querySelector('[data-key="' + key + '"]');
      if (d) d.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

      // Fields
      T.FIELDS.forEach(function (f) {
        var input = inputs[f];
        var isIn = picked.indexOf(f) >= 0;
        var hasText = state.text[f] != null && state.text[f] !== '';
        var bad = hasText && !isFinite(T.parseNum(state.text[f]));
        var solved = !isIn && !bad && sol && sol.work[f];
        var cls = 'fld-input' + (isIn || bad ? ' is-in' : ' is-out') + (bad ? ' is-bad' : '') +
          (isIn && res.error && !res.incomplete ? ' is-bad' : '');
        input.className = cls;
        input.parentNode.parentNode.classList.toggle('has-work', !!solved);
        fxButtons[f].disabled = !solved;
        if (document.activeElement === input) return;
        input.placeholder = '';
        if (isIn || bad) input.value = state.text[f];
        else input.value = solved ? T.fmt(sol.v[f]) : '';
      });

      EXTRAS.forEach(function (x) {
        extraVals[x.key].textContent = sol ? T.fmt(sol.v[x.key]) : '—';
        fxButtons[x.key].disabled = !sol;
      });

      renderWork(sol, picked);
      drawDiagram(svg, sol, picked);
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

  var BLANK = T.solve({ a: 6, b: 5, c: 7 }).solutions[0].v;
  var MIN_ANGLE = 15; // smaller angles are drawn opened up to this

  // Drawn to scale from the solution, longest side as the base. Triangles with
  // a tiny angle are drawn as a schematic from adjusted angles (right angles
  // stay square) and flagged. A generic outline until solved.
  function drawDiagram(svg, sol, picked) {
    var W = 320, H = 190, pad = 30;
    var v = sol ? sol.v : BLANK;
    var g = T.diagramAngles([v.A, v.B, v.C], MIN_ANGLE);
    var schematic = g.some(function (x, i) { return x !== [v.A, v.B, v.C][i]; });
    // Law of sines: side lengths in proportion to the sines of the drawn angles.
    var s = schematic ? g.map(function (x) { return Math.sin(x * Math.PI / 180); }) : [v.a, v.b, v.c];
    var L = s.indexOf(Math.max.apply(null, s));
    var j = (L + 1) % 3, k = (L + 2) % 3;
    var rad = g[j] * Math.PI / 180;
    var P = {};
    P[T.ANGLES[j]] = [0, 0];
    P[T.ANGLES[k]] = [s[L], 0];
    P[T.ANGLES[L]] = [s[k] * Math.cos(rad), s[k] * Math.sin(rad)];

    var w = s[L], h = P[T.ANGLES[L]][1];
    var sc = Math.min((W - 2 * pad) / w, (H - 2 * pad) / h);
    var offX = (W - w * sc) / 2, offY = (H - h * sc) / 2;
    function map(p) { return [offX + p[0] * sc, H - offY - p[1] * sc]; }
    var Q = { A: map(P.A), B: map(P.B), C: map(P.C) };
    var cx = (Q.A[0] + Q.B[0] + Q.C[0]) / 3, cy = (Q.A[1] + Q.B[1] + Q.C[1]) / 3;

    function away(p, dist) {
      var dx = p[0] - cx, dy = p[1] - cy, len = Math.hypot(dx, dy) || 1;
      return [p[0] + dx / len * dist, p[1] + dy / len * dist];
    }

    svg.textContent = '';
    svg.appendChild(svgEl('polygon', {
      'class': 'dg-tri' + (sol ? '' : ' is-blank'),
      points: [Q.A, Q.B, Q.C].map(function (p) { return p.join(','); }).join(' ')
    }));

    // Right-angle squares, built along the drawn edges.
    T.ANGLES.forEach(function (gName, i) {
      if (Math.abs(g[i] - 90) > 1e-6) return;
      var o = [(i + 1) % 3, (i + 2) % 3].map(function (n) {
        var p = Q[gName], q = Q[T.ANGLES[n]];
        var dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
        var m = Math.min(12, len / 3);
        return [dx / len * m, dy / len * m];
      });
      var p = Q[gName];
      svg.appendChild(svgEl('polyline', {
        'class': 'dg-right',
        points: [[p[0] + o[0][0], p[1] + o[0][1]],
          [p[0] + o[0][0] + o[1][0], p[1] + o[0][1] + o[1][1]],
          [p[0] + o[1][0], p[1] + o[1][1]]].map(function (q) { return q.join(','); }).join(' ')
      }));
    });

    if (sol && schematic) {
      svg.appendChild(svgEl('text', { 'class': 'dg-note', x: W - 8, y: 14 }, 'not to scale'));
    }

    var hl = function (f) { return picked.indexOf(f) >= 0 ? ' is-in' : ''; };
    // Side x is opposite vertex X.
    [['a', 'B', 'C'], ['b', 'A', 'C'], ['c', 'A', 'B']].forEach(function (e) {
      var m = [(Q[e[1]][0] + Q[e[2]][0]) / 2, (Q[e[1]][1] + Q[e[2]][1]) / 2];
      var p = away(m, 14);
      svg.appendChild(svgEl('text', { 'class': 'dg-side' + hl(e[0]), x: p[0], y: p[1] }, e[0]));
    });
    T.ANGLES.forEach(function (g) {
      var p = away(Q[g], 16);
      svg.appendChild(svgEl('text', { 'class': 'dg-vert' + hl(g), x: p[0], y: p[1] }, g));
    });
  }

  root.TriangleUI = { mount: mount };
})(this);
