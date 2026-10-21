/* Round part in a V nest — screen. Math lives in vee-math.js.
 * Fixed drawing (a 90° V) with the boxes on it: θ under the vertex, D over
 * the part, t outside the contact on the left face, and g / d / h in a
 * column on the right, each level with the height it measures from the
 * vertex. Radius has no box (r is still solved and shown in the work);
 * e and w are just letters on the drawing, their values under More. */
(function (root) {
  'use strict';

  var M = root.VeeMath, K = root.UIKit;
  var el = K.el, svgEl = K.svgEl;
  var STORE_KEY = 'robotcalc.vee';
  var LABELS = {
    th: 'included angle θ', r: 'radius r', D: 'diameter D', d: 'vertex to center d',
    t: 'vertex to contact t', g: 'vertex to part bottom g', h: 'vertex to part top h'
  };
  var EXTRAS = [{ key: 'w', label: 'w  contact span' }, { key: 'e', label: 'e  contact height' }];
  var BOXES = M.FIELDS.filter(function (f) { return f !== 'r'; });

  function load() {
    var s = K.load(STORE_KEY);
    var ok = Array.isArray(s.order) && s.text;
    // Drop anything without a box (r typed in build 6), so no hidden inputs.
    var order = ok ? s.order.filter(function (f) { return BOXES.indexOf(f) >= 0; }) : [];
    return { order: order, text: ok ? s.text : {}, extras: !!s.extras };
  }

  function mount(container) {
    var root = document.getElementById('tpl-vee').content.firstElementChild.cloneNode(true);
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
    legend.appendChild(el('div', null, 'From vertex: g bottom · e contacts · d center · h top'));
    legend.appendChild(el('div', null, 't along face · w contact span'));
    var current = { sol: null, picked: [] };

    function save() { K.save(STORE_KEY, st); }

    BOXES.forEach(function (f) {
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
        statusEl.textContent = picked.length === 0 ? 'Enter any 2 values' : res.error;
      } else {
        statusEl.textContent = 'From ' + picked.map(function (f) { return M.SYM[f]; }).join(', ');
      }

      BOXES.forEach(function (f) {
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

    var bw = K.boxWidth(W), hh = K.BOX_H / 2;
    var ladderX = W - bw - 10;                // dimension line, left of the right-hand boxes
    var cx = ladderX / 2 + 2, vy = H - hh * 2 - 14; // vertex, centered left of the box column
    var rp = W * 0.2, s45 = Math.SQRT1_2;     // drawn radius; drawn V is 90°
    var cy = vy - rp * Math.SQRT2;            // part center
    var levels = { g: cy + rp, e: vy - rp * s45, d: cy, h: cy - rp };
    var contact = [cx - rp * s45, vy - rp * s45]; // left face
    var reach = Math.min(cx - W * 0.03, vy - H * 0.04); // V legs
    var hl = function (f) { return picked.indexOf(f) >= 0 ? ' is-in' : ''; };

    svg.textContent = '';
    svg.appendChild(svgEl('line', { 'class': 'dg-axis', x1: cx, y1: vy, x2: cx, y2: levels.h - 14 }));
    // Level guides from the center line out to the dimension line.
    ['g', 'e', 'd', 'h'].forEach(function (f) {
      var x1 = f === 'e' ? 2 * cx - contact[0] : cx; // e starts at the right contact
      svg.appendChild(svgEl('line', { 'class': 'dg-guide' + hl(f), x1: x1, y1: levels[f], x2: ladderX + 6, y2: levels[f] }));
    });
    svg.appendChild(svgEl('line', { 'class': 'dg-guide', x1: cx, y1: vy, x2: ladderX + 6, y2: vy }));
    svg.appendChild(svgEl('line', { 'class': 'dg-dim', x1: ladderX, y1: vy, x2: ladderX, y2: levels.h }));
    [vy, levels.g, levels.e, levels.d, levels.h].forEach(function (y) {
      svg.appendChild(svgEl('line', { 'class': 'dg-dim', x1: ladderX - 4, y1: y, x2: ladderX + 4, y2: y }));
    });

    svg.appendChild(svgEl('polyline', {
      'class': 'dg-vee' + (solved ? '' : ' is-blank') + hl('th'),
      points: K.pts([[cx - reach, vy - reach], [cx, vy], [cx + reach, vy - reach]])
    }));
    svg.appendChild(svgEl('line', {
      'class': 'dg-seg' + hl('t'), x1: cx, y1: vy, x2: contact[0], y2: contact[1]
    }));
    svg.appendChild(svgEl('circle', {
      'class': 'dg-part' + (solved ? '' : ' is-blank') + (hl('r') || hl('D')), cx: cx, cy: cy, r: rp
    }));
    svg.appendChild(svgEl('circle', { 'class': 'dg-dot', cx: contact[0], cy: contact[1], r: 3.5 }));
    svg.appendChild(svgEl('circle', { 'class': 'dg-dot', cx: 2 * cx - contact[0], cy: contact[1], r: 3.5 }));
    svg.appendChild(svgEl('path', {
      'class': 'dg-dim', d: 'M' + (cx - 6) + ' ' + cy + 'h12M' + cx + ' ' + (cy - 6) + 'v12'
    }));
    // w: contact to contact; e: its level on the dimension line. Letters only.
    var wx2 = 2 * cx - contact[0];
    svg.appendChild(svgEl('line', { 'class': 'dg-wdim', x1: contact[0], y1: contact[1], x2: wx2, y2: contact[1] }));
    svg.appendChild(svgEl('text', { 'class': 'dg-label', x: cx, y: contact[1] - 8 }, 'w'));
    svg.appendChild(svgEl('text', { 'class': 'dg-label', x: ladderX - 10, y: levels.e - 6 }, 'e'));

    var right = W - bw / 2;
    K.placeBoxes(fields, [
      { f: 'th', x: cx, y: vy + hh + 8 },
      { f: 'D', x: cx, y: levels.h - hh - 8 },
      { f: 't', x: contact[0] - 32, y: contact[1] + 32 }, // outside the left face
      { f: 'g', x: right, y: levels.g },
      { f: 'd', x: right, y: levels.d },
      { f: 'h', x: right, y: levels.h }
    ], W, H);
  }

  root.VeeUI = { mount: mount };
})(this);
