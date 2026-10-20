/* Shared number handling for all calcs — pure, no DOM.
 * Works as a plain browser script (window.CalcCore) and under node. */
(function (root) {
  'use strict';

  var DECIMALS = 3;

  function fmt(n) {
    if (!isFinite(n)) return '—';
    var s = n.toFixed(DECIMALS);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s === '-0' ? '0' : s;
  }

  // Accepts "12", "12.5", ".5", "12,5". Anything else is NaN.
  function parseNum(text) {
    var s = String(text == null ? '' : text).trim().replace(',', '.');
    if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    return parseFloat(s);
  }

  var api = { fmt: fmt, parseNum: parseNum };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CalcCore = api;
})(this);
