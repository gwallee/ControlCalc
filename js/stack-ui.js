/* Stack index screen. Math lives in stack-math.js.
 * Grid size (C, R) and either the part # or the position are inputs; the
 * other side is solved. Typing into a position box when the part # was the
 * input keeps the other positions (they become inputs too), so nothing has
 * to be re-entered. A grid preview shades placed parts and marks this one. */
(function (root) {
  'use strict';

  var M = root.StackMath, K = root.UIKit;
  var el = K.el, svgEl = K.svgEl;
  var STORE_KEY = 'robotcalc.stack';
  var LABELS = {
    C: 'columns C', R: 'rows R', n: 'part number n', col: 'column col', row: 'row row', layer: 'layer layer'
  };
  var NAMES = { C: 'C', R: 'R', n: 'n', col: 'col', row: 'row', layer: 'lyr' };
  var MAX_DRAW = 12; // rows/cols drawn when that side has no limit

  function load() {
    var s = K.load(STORE_KEY);
    var ok = Array.isArray(s.order) && s.text;
    return {
      order: ok ? s.order : [], text: ok ? s.text : {},
      across: s.across !== false, base: s.base === 0 ? 0 : 1
    };
  }

  function mount(container) {
    var root = document.getElementById('tpl-stack').content.firstElementChild.cloneNode(true);
    container.appendChild(root);

    var st = load();
    var openWork = {};
    var fields = {};
    var statusEl = root.querySelector('.calc-status');
    var workEl = root.querySelector('.calc-work');
    var svg = root.querySelector('.calc-diagram');
    var gridNote = root.querySelector('.stack-note');
    var current = { sol: null, mode: 'n' };

    function save() { K.save(STORE_KEY, st); }

    function addField(f, rowEl) {
      fields[f] = K.field(rowEl, {
        name: NAMES[f],
        label: LABELS[f],
        onInput: function (text) { onType(f, text); },
        onDone: function () { render(); }
      });
      fields[f].box.classList.add('is-flow');
    }
    ['C', 'R', 'n'].forEach(function (f) { addField(f, root.querySelector('.stack-dims')); });
    M.POS.forEach(function (f) { addField(f, root.querySelector('.stack-pos')); });

    // Toggles: fill direction and counting base.
    var toggles = {
      across: [[true, '→ Across'], [false, '↓ Down']],
      base: [[1, 'From 1'], [0, 'From 0']]
    };
    Object.keys(toggles).forEach(function (key) {
      var group = el('div', 'calc-modes');
      toggles[key].forEach(function (opt) {
        var b = el('button', 'seg', opt[1]);
        b.type = 'button';
        b.dataset.key = key;
        b.dataset.val = String(opt[0]);
        b.addEventListener('click', function () {
          st[key] = opt[0];
          save();
          render();
        });
        group.appendChild(b);
      });
      root.querySelector('.stack-opts').appendChild(group);
    });

    root.querySelector('.calc-work-btn').addEventListener('click', function () {
      Object.keys(current.sol ? current.sol.work : {}).forEach(function (k) { openWork[k] = true; });
      render();
      root.querySelector('.work-head').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    root.querySelector('.calc-clear').addEventListener('click', function () {
      st.order = [];
      st.text = {};
      openWork = {};
      save();
      render();
    });

    function onResize() {
      if (!root.isConnected) window.removeEventListener('resize', onResize);
      else drawGrid();
    }
    window.addEventListener('resize', onResize);

    function num(f) {
      var t = st.text[f];
      return t == null || String(t).trim() === '' ? null : M.parseNum(t);
    }

    function onType(f, text) {
      // Switching from part # to position: keep the solved positions as inputs.
      if (M.POS.indexOf(f) >= 0 && current.mode === 'n' && current.sol) {
        M.POS.forEach(function (p) {
          if (p === f || current.sol.v[p] == null) return;
          st.text[p] = String(current.sol.v[p]);
          st.order = st.order.filter(function (k) { return k !== p; });
          st.order.unshift(p);
        });
      }
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
      // Whichever of part # or a position was typed last drives the solve.
      var last = st.order.filter(function (f) { return f === 'n' || M.POS.indexOf(f) >= 0; })[0];
      var mode = last && last !== 'n' ? 'pos' : 'n';
      var given = {}, used = [];
      ['C', 'R'].forEach(function (f) { if (num(f) != null) { given[f] = num(f); used.push(f); } });
      (mode === 'n' ? ['n'] : M.POS).forEach(function (f) {
        if (num(f) != null) { given[f] = num(f); used.push(f); }
      });
      var opts = { across: st.across, base: st.base };
      var res = M.solve(given, opts);
      var sol = res.solutions ? res.solutions[0] : null;
      current = { sol: sol, mode: mode };

      root.querySelectorAll('.stack-opts .seg').forEach(function (b) {
        var on = String(st[b.dataset.key]) === b.dataset.val;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', on);
      });

      statusEl.className = 'calc-status' + (res.error ? (res.incomplete ? ' is-need' : ' is-err') : ' is-ok');
      statusEl.textContent = res.error
        ? res.error
        : (mode === 'n' ? 'Part ' + sol.v.n + ' → position' : 'Position → part ' + sol.v.n) +
          (sol.layered ? '' : ' · no layers');

      Object.keys(fields).forEach(function (f) {
        var t = st.text[f], hasText = t != null && String(t).trim() !== '';
        var dim = f === 'C' || f === 'R';
        var typed = dim ? hasText : used.indexOf(f) >= 0;
        K.paint(fields[f], {
          typed: typed,
          text: t,
          bad: hasText && !isFinite(M.parseNum(t)),
          err: res.error && !res.incomplete,
          solved: sol && sol.work[f] ? String(sol.v[f]) : null
        });
      });
      // The optional dimension: blank means no layers.
      fields[st.across ? 'R' : 'C'].input.placeholder =
        document.activeElement === fields[st.across ? 'R' : 'C'].input ? '' : 'none';

      K.renderWork(workEl, sol, ['col', 'row', 'layer', 'n'].filter(function (f) {
        return used.indexOf(f) < 0;
      }), openWork);
      drawGrid();
    }

    function drawGrid() {
      var sol = current.sol, b = st.base;
      svg.textContent = '';
      gridNote.textContent = '';
      if (!sol) { svg.style.height = '0'; return; }
      var v = sol.v;
      var col = v.col - b, row = v.row - b; // 0-based cell
      var cols = v.C || Math.min(Math.max(col + 2, 4), MAX_DRAW);
      var rows = v.R || Math.min(Math.max(row + 2, 4), MAX_DRAW);
      // Unlimited side: slide the window so the current cell stays in view.
      var c0 = v.C ? 0 : Math.max(0, col - cols + 2), r0 = v.R ? 0 : Math.max(0, row - rows + 2);
      var W = svg.parentNode.clientWidth || 320;
      var cell = Math.min(40, (W - 4) / cols, 200 / rows);
      if (cell < 5) {
        svg.style.height = '0';
        gridNote.textContent = 'Grid too big to draw';
        return;
      }
      var gw = cols * cell, gh = rows * cell, ox = (W - gw) / 2;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + (gh + 2));
      svg.style.height = (gh + 2) + 'px';
      var innerN = st.across ? (v.C || 0) : (v.R || 0);
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var cc = c + c0, rr = r + r0;
          // Order index of this cell within its layer.
          var k = st.across ? rr * innerN + cc : cc * innerN + rr;
          var here = cc === col && rr === row;
          var me = st.across ? row * innerN + col : col * innerN + row;
          var cls = here ? 'cell is-here' : k < me ? 'cell is-done' : 'cell';
          svg.appendChild(svgEl('rect', {
            'class': cls, x: ox + c * cell + 1, y: r * cell + 1, width: cell - 2, height: cell - 2, rx: Math.min(6, cell / 5)
          }));
          if (cell >= 26) {
            svg.appendChild(svgEl('text', {
              'class': 'cell-n' + (here ? ' is-here' : ''), x: ox + (c + 0.5) * cell, y: (r + 0.5) * cell
            }, String(k + b)));
          }
        }
      }
      gridNote.textContent = (sol.layered ? 'Layer ' + v.layer + ' · ' : '') +
        'col 1 left, row 1 top' + (c0 || r0 ? ' · showing part of an unlimited grid' : '') +
        (cell >= 26 ? ' · numbers = order' + (sol.layered ? ' in layer' : '') : '');
      if (b === 0) gridNote.textContent = gridNote.textContent.replace(/1 left, row 1/, '0 left, row 0');
    }

    render();
  }

  root.StackUI = { mount: mount };
})(this);
