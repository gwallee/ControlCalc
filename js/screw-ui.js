/* Ball screw screen. Math lives in screw-math.js.
 * Fixed drawing: motor → gear pair → screw → nut pushing. T over the motor,
 * i over the gears, F over the push arrow; p under the threads, η beside it. */
(function (root) {
  'use strict';

  var M = root.ScrewMath, K = root.UIKit;
  var el = K.el, svgEl = K.svgEl;
  var STORE_KEY = 'robotcalc.screw';
  var LABELS = {
    T: 'motor torque T N·m', i: 'gear ratio i motor turns per screw turn', p: 'screw lead p mm',
    eta: 'efficiency η %', F: 'thrust F N'
  };
  var EXTRAS = [
    { key: 'Fkgf', label: 'F  kgf' }, { key: 'Flbf', label: 'F  lbf' }, { key: 'Tlbin', label: 'T  lbf·in' }
  ];

  function load() {
    var s = K.load(STORE_KEY);
    var ok = Array.isArray(s.order) && s.text;
    return { order: ok ? s.order : [], text: ok ? s.text : {}, extras: !!s.extras };
  }

  function mount(container) {
    var root = document.getElementById('tpl-screw').content.firstElementChild.cloneNode(true);
    container.appendChild(root);

    var st = load();
    var openWork = {};
    var fields = {}, extraVals = {};
    var stage = root.querySelector('.calc-stage');
    var statusEl = root.querySelector('.calc-status');
    var workEl = root.querySelector('.calc-work');
    var extrasEl = root.querySelector('.calc-extras');
    var extrasBtn = root.querySelector('.calc-extras-btn');
    var svg = root.querySelector('.calc-diagram');
    var legend = root.querySelector('.calc-legend');
    legend.appendChild(el('div', null, 'i = motor turns per screw turn (2 = 2:1) · p = lead per screw turn'));
    var current = { sol: null, picked: [] };

    function save() { K.save(STORE_KEY, st); }

    M.FIELDS.forEach(function (f) {
      fields[f] = K.field(stage, {
        name: M.SYM[f],
        label: LABELS[f],
        unit: { eta: '%', i: ':1' }[f],
        sub: { T: 'N·m', p: 'mm', F: 'N' }[f],
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
      var sol = res.solutions ? res.solutions[0] : null;
      current = { sol: sol, picked: picked };

      statusEl.className = 'calc-status' + (res.error ? (res.incomplete ? ' is-need' : ' is-err') : ' is-ok');
      if (res.error) {
        statusEl.textContent = picked.length === 0 ? 'Enter any 4 of T, i, p, η, F' : res.error;
      } else {
        statusEl.textContent = 'From ' + picked.map(function (f) { return M.SYM[f]; }).join(', ') +
          ' → ' + M.SYM[res.target];
      }

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
    var bw = K.boxWidth(W), hw = bw / 2, hh = K.BOX_H / 2;
    var rowTop = hh + 4;
    var cl = rowTop + hh + 46;                 // screw centerline
    var rowBot = cl + 34 + hh;
    var H = Math.round(rowBot + hh + 6);
    stage.style.height = H + 'px';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var hl = function (f) { return picked.indexOf(f) >= 0 ? ' is-in' : ''; };
    var blank = solved ? '' : ' is-blank';

    var mx0 = 8, mx1 = W * 0.2;                // motor body
    var g1 = [mx1 + 12, cl - 14], r1 = 9;      // small (motor) gear, over the motor shaft
    var g2 = [g1[0] + r1 + 16, cl], r2 = 16;   // big (screw) gear on the screw
    var s0 = g2[0], s1 = W - 8;                // screw
    var nut = [W * 0.66, 22, 18];              // nut center x, half-width, half-height

    svg.textContent = '';
    // Motor: a solid body with cooling fins and an "M", so it can't be
    // mistaken for an input box.
    var my0 = cl - 30, mh = 44;
    svg.appendChild(svgEl('rect', { 'class': 'dg-solid' + hl('T'), x: mx0, y: my0, width: mx1 - mx0, height: mh, rx: 1 }));
    var fins = '';
    for (var fx = mx0 + 6; fx < mx1 - 4; fx += 6) fins += 'M' + fx + ' ' + (my0 + 4) + 'v' + (mh - 8);
    svg.appendChild(svgEl('path', { 'class': 'dg-fin', d: fins }));
    svg.appendChild(svgEl('text', { 'class': 'dg-tag dg-label is-on-line', x: (mx0 + mx1) / 2, y: my0 + mh / 2 }, 'M'));
    svg.appendChild(svgEl('line', { 'class': 'dg-shaft', x1: mx1, y1: g1[1], x2: g1[0], y2: g1[1] }));
    svg.appendChild(svgEl('circle', { 'class': 'dg-part2' + blank + hl('i'), cx: g1[0], cy: g1[1], r: r1 }));
    svg.appendChild(svgEl('circle', { 'class': 'dg-part2' + blank + hl('i'), cx: g2[0], cy: g2[1], r: r2 }));
    // Screw with thread ticks.
    svg.appendChild(svgEl('line', { 'class': 'dg-shaft', x1: s0, y1: cl, x2: s1, y2: cl }));
    var ticks = '';
    for (var x = s0 + r2 + 4; x < s1 - 4; x += 9) ticks += 'M' + x + ' ' + (cl + 7) + 'l6 -14';
    svg.appendChild(svgEl('path', { 'class': 'dg-thread' + hl('p'), d: ticks }));
    svg.appendChild(svgEl('rect', {
      'class': 'dg-solid', x: nut[0] - nut[1], y: cl - nut[2], width: nut[1] * 2, height: nut[2] * 2, rx: 2
    }));
    // Push arrow off the nut.
    var ay = cl - nut[2] - 12, ax0 = nut[0] - nut[1], ax1 = Math.min(s1, nut[0] + nut[1] + 46);
    svg.appendChild(svgEl('path', {
      'class': 'dg-force' + hl('F'),
      d: 'M' + ax0 + ' ' + ay + 'H' + ax1 + 'M' + (ax1 - 9) + ' ' + (ay - 6) + 'L' + ax1 + ' ' + ay + 'L' + (ax1 - 9) + ' ' + (ay + 6)
    }));
    // Lead: one pitch marked under the threads.
    var lx = nut[0] - 70;
    svg.appendChild(svgEl('path', {
      'class': 'dg-dim', d: 'M' + lx + ' ' + (cl + 12) + 'v10M' + (lx + 18) + ' ' + (cl + 12) + 'v10M' + lx + ' ' + (cl + 17) + 'h18'
    }));

    K.placeBoxes(fields, [
      { f: 'T', x: Math.max(hw + 2, (mx0 + mx1) / 2), y: rowTop },
      { f: 'i', x: hw * 3 + 10, y: rowTop },
      { f: 'F', x: W - hw - 2, y: rowTop },
      { f: 'p', x: Math.max(hw * 3 + 10, lx + 9), y: rowBot },
      { f: 'eta', x: W - hw - 2, y: rowBot }
    ], W, H);
  }

  root.ScrewUI = { mount: mount };
})(this);
