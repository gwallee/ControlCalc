/* Line / rectangle screen. Math lives in line-math.js.
 * Fixed drawing: a rectangle with P1 bottom-left and P2 top-right, the line
 * being its diagonal. x1 / y1 under P1, x2 / y2 over P2, L along the bottom
 * edge, W up the right edge, D on the diagonal, θ in the arc at P1. */
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
    return { order: ok ? s.order : [], text: ok ? s.text : {}, pick: s.pick || 0, extras: !!s.extras };
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

      K.renderWork(workEl, sol, M.FIELDS.filter(function (f) { return picked.indexOf(f) < 0; })
        .concat(M.EXTRAS), openWork);
      layout();
    }

    function layout() {
      drawStage(stage, svg, fields, !!current.sol, current.picked);
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
    var p1 = [W * 0.1, H - hh * 2 - 16], p2 = [W * 0.9, hh * 2 + 16];
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
    [p1, p2].forEach(function (p, i) {
      svg.appendChild(svgEl('circle', { 'class': 'dg-dot', cx: p[0], cy: p[1], r: 4.5 }));
      svg.appendChild(svgEl('text', {
        'class': 'dg-label', x: p[0] + (i ? -22 : -4), y: p[1] + (i ? 2 : -14)
      }, i ? 'P2' : 'P1'));
    });

    var nrm = [-Math.sin(ang), -Math.cos(ang)]; // screen normal, up-left of the line
    K.placeBoxes(fields, [
      { f: 'x1', x: hw + 2, y: p1[1] + hh + 10 },
      { f: 'y1', x: hw * 3 + 10, y: p1[1] + hh + 10 },
      { f: 'x2', x: W - hw * 3 - 10, y: p2[1] - hh - 10 },
      { f: 'y2', x: W - hw - 2, y: p2[1] - hh - 10 },
      { f: 'th', x: p1[0] + ar + hw - 6, y: p1[1] - hh - 8 },
      { f: 'L', x: p2[0] - hw - 8, y: p1[1] - hh - 8 },
      { f: 'W', x: p2[0] - hw - 8, y: mid[1] + 10 },
      { f: 'D', x: mid[0] + nrm[0] * 46, y: mid[1] + nrm[1] * 46 }
    ], W, H);
  }

  root.LineUI = { mount: mount };
})(this);
