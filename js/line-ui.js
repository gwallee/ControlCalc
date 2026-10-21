/* Line / rectangle screen. Math lives in line-math.js.
 * Fixed drawing: a rectangle with P1 bottom-left and P2 top-right, the line
 * being its diagonal. x1 / y1 under P1, x2 / y2 over P2, L centered on the
 * bottom edge, W on the right edge, D on the diagonal, θ in the arc at P1.
 * The other corners, P3 (bottom-right) and P4 (top-left), show as x, y.
 * Points (behind a button) spaces N points from P1 to P2 and lists them. */
(function (root) {
  'use strict';

  var M = root.LineMath, K = root.UIKit;
  var el = K.el, svgEl = K.svgEl;
  var STORE_KEY = 'robotcalc.line';
  var LABELS = {
    x1: 'start x x1', y1: 'start y y1', x2: 'end x x2', y2: 'end y y2',
    L: 'length L', W: 'width W', D: 'diagonal D', th: 'angle θ'
  };
  var EXTRAS = [{ key: 'cx', label: 'Center x  cx' }, { key: 'cy', label: 'Center y  cy' }, { key: 'area', label: 'Area' }];

  function load() {
    var s = K.load(STORE_KEY);
    var ok = Array.isArray(s.order) && s.text;
    return {
      order: ok ? s.order : [], text: ok ? s.text : {}, pick: s.pick || 0, extras: !!s.extras,
      pts: !!s.pts, N: s.N != null ? String(s.N) : ''
    };
  }

  function mount(container) {
    var root = document.getElementById('tpl-line').content.firstElementChild.cloneNode(true);
    container.appendChild(root);

    var st = load();
    var openWork = {};
    var fields = {}, extraVals = {};
    var stage = root.querySelector('.calc-stage');
    var statusEl = root.querySelector('.calc-status');
    var pickEl = root.querySelector('.calc-pick');
    var workEl = root.querySelector('.calc-work');
    var extrasEl = root.querySelector('.calc-extras');
    var extrasBtn = root.querySelector('.calc-extras-btn');
    var svg = root.querySelector('.calc-diagram');
    var ptsEl = root.querySelector('.line-pts'), ptsBtn = root.querySelector('.line-pts-btn');
    var ptsTable = root.querySelector('.line-pts-table'), ptsStep = root.querySelector('.line-pts-step');
    var legend = root.querySelector('.calc-legend');
    legend.appendChild(el('div', null, 'L = x2 − x1 · W = y2 − y1 (signed)'));
    legend.appendChild(el('div', null, 'D = line length · θ = angle CCW from +X'));
    var current = { sol: null, picked: [] };

    function save() { K.save(STORE_KEY, st); }

    M.FIELDS.forEach(function (f) {
      fields[f] = K.field(stage, {
        name: M.SYM[f],
        label: LABELS[f],
        angle: M.isAngle(f),
        onInput: function (text) { onType(f, text); },
        onDone: function () { render(); }
      });
    });

    // N for the points panel: always an input.
    var nField = K.field(root.querySelector('.line-pts-n'), {
      name: 'N', label: 'number of points N',
      onInput: function (text) { st.N = text; save(); render(); },
      onDone: function () { render(); }
    });
    nField.box.classList.add('is-flow');
    ptsBtn.addEventListener('click', function () {
      st.pts = !st.pts;
      save();
      render();
    });

    EXTRAS.forEach(function (x) {
      var row = el('div', 'extra');
      row.appendChild(el('span', 'extra-name', x.label));
      var val = el('span', 'extra-val', '—');
      row.appendChild(val);
      extrasEl.appendChild(row);
      extraVals[x.key] = val;
    });

    // The other corners: solved only, plain "x, y" text beside the corner
    // (the drawing labels which corner). P3 lines up right, P4 left.
    var pairs = {};
    M.CORNERS.forEach(function (c) {
      var box = el('div', 'fld is-pair' + (c === 'P3' ? ' is-right' : ''));
      box.setAttribute('aria-label', 'corner ' + c);
      var val = el('div', 'pair-val');
      box.appendChild(val);
      stage.appendChild(box);
      fields[c] = { box: box };
      pairs[c] = val;
    });

    extrasBtn.addEventListener('click', function () {
      st.extras = !st.extras;
      save();
      render();
    });

    K.workToggle(root, function () { return openWork; }, function () { render(); });

    root.querySelector('.calc-clear').addEventListener('click', function () {
      st.order = [];
      st.text = {};
      st.pick = 0;
      openWork = {};
      save();
      render();
    });

    function onResize() {
      if (!root.isConnected) window.removeEventListener('resize', onResize);
      else layout();
    }
    window.addEventListener('resize', onResize);

    function onType(f, text) {
      st.order = st.order.filter(function (k) { return k !== f; });
      if (String(text).trim() === '') {
        delete st.text[f];
      } else {
        st.text[f] = text;
        st.order.unshift(f);
      }
      save();
      render();
    }

    function render() {
      var valid = st.order.filter(function (f) { return isFinite(M.parseNum(st.text[f])); });
      var picked = M.pickInputs(valid);
      var given = {};
      picked.forEach(function (f) { given[f] = M.parseNum(st.text[f]); });
      var res = M.solve(given);
      var sols = res.solutions || [];
      if (st.pick >= sols.length) st.pick = 0;
      var sol = sols[st.pick] || null;
      current = { sol: sol, picked: picked };

      statusEl.className = 'calc-status' + (res.error ? (res.incomplete ? ' is-need' : ' is-err') : ' is-ok');
      if (res.error) {
        statusEl.textContent = picked.length === 0 ? 'Enter 2 points, or a point + 2 of L / W / D / θ' : res.error;
      } else {
        statusEl.textContent = 'From ' + picked.map(function (f) { return M.SYM[f]; }).join(', ') +
          (sols.length > 1 ? ' · 2 solutions' : '');
      }

      // D with L (or W): the other side can point either way.
      pickEl.hidden = sols.length < 2;
      pickEl.textContent = '';
      sols.length > 1 && sols.forEach(function (s, n) {
        var k = res.ambiguous;
        var b = el('button', 'seg' + (n === st.pick ? ' is-on' : ''), (n + 1) + ': ' + k + ' = ' + M.fmt(s.v[k]));
        b.type = 'button';
        b.setAttribute('aria-pressed', n === st.pick);
        b.addEventListener('click', function () { st.pick = n; save(); render(); });
        pickEl.appendChild(b);
      });

      M.FIELDS.forEach(function (f) {
        var hasText = st.text[f] != null && st.text[f] !== '';
        K.paint(fields[f], {
          typed: picked.indexOf(f) >= 0,
          text: st.text[f],
          bad: hasText && !isFinite(M.parseNum(st.text[f])),
          err: res.error && !res.incomplete,
          solved: sol && sol.work[f] ? M.fmt(sol.v[f]) : null
        });
      });

      extrasEl.hidden = !st.extras;
      extrasBtn.setAttribute('aria-expanded', st.extras);
      extrasBtn.classList.toggle('is-on', st.extras);
      EXTRAS.forEach(function (x) {
        extraVals[x.key].textContent = sol ? M.fmt(sol.v[x.key]) : '—';
      });
      M.CORNERS.forEach(function (c) {
        pairs[c].textContent = '';
        if (!sol) return;
        pairs[c].textContent = M.fmt(sol.v[c][0]) + ', ' + M.fmt(sol.v[c][1]);
      });

      // Points along the line.
      ptsEl.hidden = !st.pts;
      ptsBtn.classList.toggle('is-on', st.pts);
      ptsBtn.setAttribute('aria-expanded', st.pts);
      var nText = String(st.N || '').trim(), pr = null;
      K.paint(nField, { typed: nText !== '', text: st.N, bad: nText !== '' && !isFinite(M.parseNum(nText)) });
      ptsTable.textContent = '';
      ptsStep.textContent = '';
      if (st.pts && sol && nText !== '') {
        pr = M.points(sol.v, M.parseNum(nText));
        if (pr.error) {
          ptsStep.textContent = pr.error;
          pr = null;
        } else {
          ptsStep.textContent = 'step  x ' + M.fmt(pr.v.sx) + '  ·  y ' + M.fmt(pr.v.sy) + '  ·  along ' + M.fmt(pr.v.s);
          var head = el('div', 'pt-row pt-head');
          ['#', 'x', 'y'].forEach(function (h) { head.appendChild(el('span', null, h)); });
          ptsTable.appendChild(head);
          pr.points.forEach(function (pt, i) {
            var row = el('div', 'pt-row');
            row.appendChild(el('span', null, String(i + 1)));
            row.appendChild(el('span', null, M.fmt(pt[0])));
            row.appendChild(el('span', null, M.fmt(pt[1])));
            ptsTable.appendChild(row);
          });
        }
      } else if (st.pts) {
        ptsStep.textContent = sol ? 'Enter N, the number of points (ends included)' : 'Solve the line first';
      }

      var keys = M.FIELDS.filter(function (f) { return picked.indexOf(f) < 0; }).concat(M.CORNERS, M.EXTRAS);
      var shown = sol;
      if (pr) {
        shown = { v: sol.v, work: Object.assign({}, sol.work, pr.work) };
        keys = keys.concat(['sx', 'sy', 's', 'pt']);
      }
      K.renderWork(workEl, shown, keys, openWork);
      layout();
    }

    function layout() {
      drawStage(stage, svg, fields, !!current.sol, current.picked);
      // Long corner values shrink to stay on one line in their slot.
      M.CORNERS.forEach(function (c) {
        var val = pairs[c], room = fields[c].box.clientWidth;
        val.style.fontSize = '';
        var size = parseFloat(getComputedStyle(val).fontSize);
        while (val.scrollWidth > room && size > 10) {
          size -= 0.5;
          val.style.fontSize = size + 'px';
        }
      });
    }

    render();
  }

  // --- drawing -------------------------------------------------------------

  function drawStage(stage, svg, fields, solved, picked) {
    var W = stage.clientWidth || 320;
    var H = Math.round(W * 0.95);
    stage.style.height = H + 'px';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

    var bw = K.boxWidth(W), hw = bw / 2, hh = K.BOX_H / 2;
    // Box rows above and below the rectangle; L sits on the bottom edge, so
    // the bottom row clears it.
    var rowTop = hh + 4, rowBot = H - hh - 4;
    var p1 = [W * 0.08, rowBot - hh * 3 - 6], p2 = [W - hw - 4, rowTop + hh + 10];
    var mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    var ang = Math.atan2(p1[1] - p2[1], p2[0] - p1[0]); // screen angle of the diagonal
    var hl = function (f) { return picked.indexOf(f) >= 0 ? ' is-in' : ''; };
    var blank = solved ? '' : ' is-blank';

    svg.textContent = '';
    // Rectangle: bottom edge is L, right edge is W.
    svg.appendChild(svgEl('line', { 'class': 'dg-rect' + hl('L'), x1: p1[0], y1: p1[1], x2: p2[0], y2: p1[1] }));
    svg.appendChild(svgEl('line', { 'class': 'dg-rect' + hl('W'), x1: p2[0], y1: p1[1], x2: p2[0], y2: p2[1] }));
    svg.appendChild(svgEl('polyline', {
      'class': 'dg-rect is-faint', points: K.pts([[p1[0], p1[1]], [p1[0], p2[1]], [p2[0], p2[1]]])
    }));
    // The line.
    svg.appendChild(svgEl('line', {
      'class': 'dg-line' + blank + (hl('D') || hl('th')), x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1]
    }));
    // θ arc from +X to the line.
    var ar = 46;
    svg.appendChild(svgEl('path', {
      'class': 'dg-arc' + hl('th'),
      d: 'M' + (p1[0] + ar) + ' ' + p1[1] + 'A' + ar + ' ' + ar + ' 0 0 0 ' +
        (p1[0] + ar * Math.cos(ang)) + ' ' + (p1[1] - ar * Math.sin(ang))
    }));
    [[p1, 'P1', 10, -12], [p2, 'P2', -20, 18], [[p2[0], p1[1]], 'P3', -20, -12], [[p1[0], p2[1]], 'P4', 14, 18]]
      .forEach(function (c) {
        svg.appendChild(svgEl('circle', { 'class': 'dg-dot', cx: c[0][0], cy: c[0][1], r: 4.5 }));
        svg.appendChild(svgEl('text', { 'class': 'dg-label', x: c[0][0] + c[2], y: c[0][1] + c[3] }, c[1]));
      });

    var nrm = [-Math.sin(ang), -Math.cos(ang)]; // screen normal, up-left of the line
    var c1 = hw + 2, c2 = W / 2, c3 = W - hw - 2; // three box slots across
    K.placeBoxes(fields, [
      { f: 'P4', x: c1, y: rowTop },
      { f: 'x2', x: c2, y: rowTop },
      { f: 'y2', x: c3, y: rowTop },
      { f: 'x1', x: c1, y: rowBot },
      { f: 'y1', x: c2, y: rowBot },
      { f: 'P3', x: c3, y: rowBot },
      { f: 'L', x: mid[0], y: p1[1] },            // on the bottom edge
      { f: 'W', x: p2[0], y: mid[1] + 24 },        // on the right edge
      { f: 'th', x: p1[0] + ar + hw - 6, y: p1[1] - hh * 2 - 10 },
      { f: 'D', x: mid[0] + nrm[0] * 46, y: mid[1] + nrm[1] * 46 }
    ], W, H);
  }

  root.LineUI = { mount: mount };
})(this);
