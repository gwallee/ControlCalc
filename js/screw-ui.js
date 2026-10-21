/* Ball screw screen. Math lives in screw-math.js.
 * Units (behind a button) picks the unit for torque, lead and force; the
 * boxes show them, and changing one converts the values already typed.
 * Fixed drawing: motor → gear pair → screw → nut pushing. T over the motor,
 * i over the gears, F over the push arrow; p under the threads, η beside it. */
(function (root) {
  'use strict';

  var M = root.ScrewMath, K = root.UIKit;
  var el = K.el, svgEl = K.svgEl;
  var STORE_KEY = 'robotcalc.screw';
  var LABELS = {
    T: 'motor torque T', i: 'gear ratio i motor turns per screw turn', p: 'screw lead p',
    eta: 'efficiency η %', F: 'thrust F'
  };
  var UNIT_ROWS = [['T', 'Torque'], ['p', 'Lead'], ['F', 'Force']];
  var IMPERIAL = { T: 'lbf·in', p: 'in', F: 'lbf' };

  function load() {
    var s = K.load(STORE_KEY), units = {};
    if (s.system) { // build 20: a metric / imperial switch, values kept per system
      s = { order: (s[s.system] || {}).order, text: (s[s.system] || {}).text, units: s.system === 'imperial' ? IMPERIAL : null };
    }
    var ok = Array.isArray(s.order) && s.text;
    UNIT_ROWS.forEach(function (r) {
      var f = r[0], u = s.units && s.units[f];
      units[f] = M.UNITS[f][u] ? u : M.METRIC[f];
    });
    return {
      order: ok ? s.order : [], text: ok ? s.text : {}, exact: (ok && s.exact) || {},
      units: units, unitsOpen: !!s.unitsOpen
    };
  }

  // A converted value shows like any other (3 decimals); the exact value is
  // kept in st.exact for solving, so converting back and forth doesn't drift.
  function fmtConverted(n) {
    return M.fmt(n);
  }

  function mount(container) {
    var root = document.getElementById('tpl-screw').content.firstElementChild.cloneNode(true);
    container.appendChild(root);

    var st = load();
    var openWork = {};
    var fields = {}, unitBtns = {};
    var stage = root.querySelector('.calc-stage');
    var statusEl = root.querySelector('.calc-status');
    var workEl = root.querySelector('.calc-work');
    var unitsEl = root.querySelector('.calc-extras');
    var unitsBtn = root.querySelector('.calc-extras-btn');
    var svg = root.querySelector('.calc-diagram');
    var legend = root.querySelector('.calc-legend');
    legend.appendChild(el('div', null, 'i motor turns per screw turn (2 = 2:1) · p lead/turn'));
    var current = { sol: null, picked: [] };

    function save() { K.save(STORE_KEY, st); }

    M.FIELDS.forEach(function (f) {
      fields[f] = K.field(stage, {
        name: M.SYM[f],
        label: LABELS[f],
        unit: { eta: '%', i: ':1' }[f],
        sub: st.units[f],
        onInput: function (text) { onType(f, text); },
        onDone: function () { render(); }
      });
    });

    // One row of unit choices per quantity.
    UNIT_ROWS.forEach(function (r) {
      var f = r[0], row = el('div', 'unit-row');
      row.appendChild(el('span', 'unit-name', r[1]));
      var group = el('div', 'calc-modes');
      unitBtns[f] = {};
      Object.keys(M.UNITS[f]).forEach(function (u) {
        var b = el('button', 'seg', u);
        b.type = 'button';
        b.addEventListener('click', function () { setUnit(f, u); });
        group.appendChild(b);
        unitBtns[f][u] = b;
      });
      row.appendChild(group);
      unitsEl.appendChild(row);
    });

    // Change a unit, converting a typed value so it means the same amount.
    function setUnit(f, u) {
      var from = st.units[f];
      if (u === from) return;
      var n = st.exact[f] != null ? st.exact[f] : M.parseNum(st.text[f]);
      if (st.text[f] != null && isFinite(n)) {
        st.exact[f] = M.convert(f, n, from, u);
        st.text[f] = fmtConverted(st.exact[f]);
      }
      st.units[f] = u;
      save();
      render();
    }

    unitsBtn.addEventListener('click', function () {
      st.unitsOpen = !st.unitsOpen;
      save();
      render();
    });

    K.workToggle(root, function () { return openWork; }, function () { render(); });

    root.querySelector('.calc-clear').addEventListener('click', function () {
      st.order = [];
      st.text = {};
      st.exact = {};
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
      delete st.exact[f]; // typed by hand now
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
      var units = st.units;
      var valid = st.order.filter(function (f) { return isFinite(M.parseNum(st.text[f])); });
      var picked = M.pickInputs(valid);
      var given = {};
      picked.forEach(function (f) { given[f] = st.exact[f] != null ? st.exact[f] : M.parseNum(st.text[f]); });
      var res = M.solve(given, units);
      var sol = res.solutions ? res.solutions[0] : null;
      current = { sol: sol, picked: picked };

      statusEl.className = 'calc-status' + (res.error ? (res.incomplete ? ' is-need' : ' is-err') : ' is-ok');
      if (res.error) {
        statusEl.textContent = picked.length === 0 ? 'Enter any 4 of T, i, p, η, F' : res.error;
      } else {
        statusEl.textContent = 'From ' + picked.map(function (f) { return M.SYM[f]; }).join(', ') +
          ' → ' + M.SYM[res.target];
      }

      unitsEl.hidden = !st.unitsOpen;
      unitsBtn.classList.toggle('is-on', st.unitsOpen);
      unitsBtn.setAttribute('aria-expanded', st.unitsOpen);
      UNIT_ROWS.forEach(function (r) {
        Object.keys(unitBtns[r[0]]).forEach(function (u) {
          var on = units[r[0]] === u;
          unitBtns[r[0]][u].classList.toggle('is-on', on);
          unitBtns[r[0]][u].setAttribute('aria-pressed', on);
        });
      });

      M.FIELDS.forEach(function (f) {
        var sub = fields[f].box.querySelector('.fld-sub');
        if (sub) {
          sub.textContent = units[f];
          fields[f].box.classList.toggle('is-short-sub', units[f].length < 2);
          fields[f].input.setAttribute('aria-label', LABELS[f] + ' ' + units[f]);
        }
        var hasText = st.text[f] != null && st.text[f] !== '';
        K.paint(fields[f], {
          typed: picked.indexOf(f) >= 0,
          text: st.text[f],
          bad: hasText && !isFinite(M.parseNum(st.text[f])),
          err: res.error && !res.incomplete,
          solved: sol && sol.work[f] ? M.fmt(sol.v[f]) : null
        });
      });

      K.renderWork(workEl, sol, M.FIELDS.filter(function (f) { return picked.indexOf(f) < 0; }), openWork);
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
