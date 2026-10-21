/* Value scaling screen. Math lives in scale-math.js.
 * Input range and output range (min / max) on top, a graph of the line with
 * this point on it, then In → Out (and the INT a PLC would store). Typing In
 * scales it; typing Out works back to the In that gives it. */
(function (root) {
  'use strict';

  var M = root.ScaleMath, K = root.UIKit;
  var el = K.el, svgEl = K.svgEl;
  var STORE_KEY = 'robotcalc.scale';
  var LABELS = {
    InMin: 'input min', InMax: 'input max', OutMin: 'output min', OutMax: 'output max',
    In: 'input value In', Out: 'scaled value Out', INT: 'as INT'
  };
  var NAMES = { InMin: 'min', InMax: 'max', OutMin: 'min', OutMax: 'max', In: 'In', Out: 'Out', INT: 'INT' };

  function load() {
    var s = K.load(STORE_KEY);
    var ok = Array.isArray(s.order) && s.text;
    return { order: ok ? s.order : [], text: ok ? s.text : {} };
  }

  function mount(container) {
    var root = document.getElementById('tpl-scale').content.firstElementChild.cloneNode(true);
    container.appendChild(root);

    var st = load();
    var openWork = {};
    var fields = {};
    var statusEl = root.querySelector('.calc-status');
    var workEl = root.querySelector('.calc-work');
    var svg = root.querySelector('.calc-diagram');
    var current = { sol: null, from: 'In' };

    function save() { K.save(STORE_KEY, st); }

    function addField(f, rowEl) {
      fields[f] = K.field(rowEl, {
        name: NAMES[f], label: LABELS[f],
        onInput: function (text) { onType(f, text); },
        onDone: function () { render(); }
      });
      fields[f].box.classList.add('is-flow');
    }
    [['in', 'Input', ['InMin', 'InMax']], ['out', 'Output', ['OutMin', 'OutMax']]].forEach(function (r) {
      var row = root.querySelector('.scale-' + r[0]);
      row.appendChild(el('span', 'scale-head', r[1]));
      r[2].forEach(function (f) { addField(f, row); });
    });
    ['In', 'Out', 'INT'].forEach(function (f) { addField(f, root.querySelector('.scale-val')); });
    fields.INT.input.readOnly = true; // solved only

    K.workToggle(root, function () { return openWork; }, function () { render(); });

    root.querySelector('.calc-clear').addEventListener('click', function () {
      // Keep the ranges (they're the setup); clear the value being scaled.
      ['In', 'Out'].forEach(function (f) { delete st.text[f]; });
      st.order = st.order.filter(function (f) { return f !== 'In' && f !== 'Out'; });
      openWork = {};
      save();
      render();
    });

    function onResize() {
      if (!root.isConnected) window.removeEventListener('resize', onResize);
      else drawGraph();
    }
    window.addEventListener('resize', onResize);

    function num(f) {
      var t = st.text[f];
      return t == null || String(t).trim() === '' ? null : M.parseNum(t);
    }

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
      var from = st.order.filter(function (f) { return f === 'In' || f === 'Out'; })[0] || 'In';
      var given = {};
      M.RANGE.concat(from).forEach(function (f) { if (num(f) != null) given[f] = num(f); });
      var res = M.solve(given, from);
      var sol = res.solutions ? res.solutions[0] : null;
      current = { sol: sol, from: from };

      statusEl.className = 'calc-status' + (res.error ? (res.incomplete ? ' is-need' : ' is-err') : ' is-ok');
      statusEl.textContent = res.error
        ? res.error
        : (from === 'In' ? 'In → Out' : 'Out → In') + (res.outside ? ' · outside the input range' : '');

      Object.keys(fields).forEach(function (f) {
        var t = st.text[f], hasText = t != null && String(t).trim() !== '';
        var typed = M.RANGE.indexOf(f) >= 0 ? hasText : f === from && hasText;
        K.paint(fields[f], {
          typed: typed,
          text: t,
          bad: hasText && !isFinite(M.parseNum(t)),
          err: res.error && !res.incomplete,
          solved: sol && f in sol.v && !typed ? (f === 'INT' ? String(sol.v.INT) : M.fmt(sol.v[f])) : null
        });
      });

      K.renderWork(workEl, sol, [from === 'In' ? 'Out' : 'In', 'INT', 'm', 'b'], openWork);
      drawGraph();
    }

    // The scaling line from (InMin, OutMin) to (InMax, OutMax), with this point.
    function drawGraph() {
      var sol = current.sol;
      svg.textContent = '';
      if (!sol) { svg.style.height = '0'; return; }
      var v = sol.v, W = svg.parentNode.clientWidth - 12 || 300, H = 150, pad = 22, padL = 46; // room for y labels
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.style.height = H + 'px';
      // Extend the view if the point is outside the range.
      var x0 = Math.min(v.InMin, v.InMax, v.In), x1 = Math.max(v.InMin, v.InMax, v.In);
      var y0 = Math.min(v.OutMin, v.OutMax, v.Out), y1 = Math.max(v.OutMin, v.OutMax, v.Out);
      if (y1 === y0) { y0 -= 1; y1 += 1; }
      function X(x) { return padL + (x - x0) / (x1 - x0) * (W - padL - pad); }
      function Y(y) { return H - pad - (y - y0) / (y1 - y0) * (H - 2 * pad); }
      svg.appendChild(svgEl('path', { 'class': 'dg-dim', d: 'M' + padL + ' ' + (H - pad) + 'H' + (W - pad / 2) + 'M' + padL + ' ' + (H - pad) + 'V' + pad / 2 }));
      svg.appendChild(svgEl('line', { 'class': 'dg-line', x1: X(v.InMin), y1: Y(v.OutMin), x2: X(v.InMax), y2: Y(v.OutMax) }));
      var px = X(v.In), py = Y(v.Out);
      svg.appendChild(svgEl('path', { 'class': 'dg-guide is-in', d: 'M' + px + ' ' + (H - pad) + 'V' + py + 'H' + padL }));
      svg.appendChild(svgEl('circle', { 'class': 'dg-pt', cx: px, cy: py, r: 6 }));
      [[v.InMin, X(v.InMin)], [v.InMax, X(v.InMax)]].forEach(function (t) {
        svg.appendChild(svgEl('text', { 'class': 'dg-tick', x: t[1], y: H - 8 }, M.fmt(t[0])));
      });
      [[v.OutMin, Y(v.OutMin)], [v.OutMax, Y(v.OutMax)]].forEach(function (t) {
        svg.appendChild(svgEl('text', { 'class': 'dg-tick is-y', x: padL - 5, y: t[1] }, M.fmt(t[0])));
      });
    }

    render();
  }

  root.ScaleUI = { mount: mount };
})(this);
