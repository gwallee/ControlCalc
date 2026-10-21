/* Shared screen pieces for the calcs: input boxes, box layout, work list,
 * storage. Window global UIKit. */
(function (root) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var BOX_H = 44;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function svgEl(tag, attrs, text) {
    var n = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }

  function pts(list) { return list.map(function (p) { return p.join(','); }).join(' '); }

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; }
  }

  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* no storage */ }
  }

  // An input box: label, number input, optional ° mark. Typing into a solved
  // box starts fresh, with the solved value left as a hint.
  // opts: { name, label, angle, unit, sub, onInput(text), onDone() } — angle
  // adds a ° mark; unit puts any other short mark (%, :1) at the right; sub
  // is a unit set small under the name, on the left (N·m, mm).
  function field(stage, opts) {
    var unit = opts.angle ? '°' : opts.unit;
    var box = el('label', 'fld' + (opts.angle ? ' is-angle' : '') + (unit && !opts.angle ? ' has-unit' : '') +
      (opts.name.length > 1 ? ' is-long-name' : '') + (opts.sub ? ' has-sub' + (opts.sub.length < 2 ? ' is-short-sub' : '') : ''));
    var name = el('span', 'fld-name', opts.name);
    if (opts.sub) name.appendChild(el('span', 'fld-sub', opts.sub));
    box.appendChild(name);
    var input = el('input', 'fld-input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', opts.label);
    box.appendChild(input);
    if (unit) box.appendChild(el('span', 'fld-unit', unit));

    input.addEventListener('focus', function () {
      if (input.classList.contains('is-out') && !input.readOnly) { // read-only boxes keep their value
        input.placeholder = input.value;
        input.value = '';
      }
    });
    input.addEventListener('input', function () { opts.onInput(input.value); });
    input.addEventListener('blur', function () { setTimeout(opts.onDone, 0); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') input.blur();
    });
    stage.appendChild(box);
    return { box: box, input: input, angle: !!opts.angle };
  }

  // Shrink a box's text until its value fits (down to 11px), so long values
  // never get cut off. Called once the box has its final width.
  function fit(input) {
    input.style.fontSize = '';
    if (!input.value || input.clientWidth === 0) return;
    var size = parseFloat(getComputedStyle(input).fontSize);
    while (input.scrollWidth > input.clientWidth && size > 11) {
      size -= 0.5;
      input.style.fontSize = size + 'px';
    }
  }

  // Show a box as typed (is-in) or solved (is-out). Leaves the value alone
  // while the user is typing in it.
  // s: { typed, text, bad, err, solved }
  function paint(fd, s) {
    var isIn = s.typed || s.bad;
    fd.input.className = 'fld-input' + (isIn ? ' is-in' : ' is-out') + (s.bad || (s.typed && s.err) ? ' is-bad' : '');
    fd.box.classList.toggle('is-in', isIn);
    fd.box.classList.toggle('is-out', !isIn);
    if (document.activeElement === fd.input) return;
    fd.input.placeholder = '';
    fd.input.value = isIn ? s.text : (s.solved == null ? '' : s.solved);
    if (fd.box.classList.contains('is-flow')) fit(fd.input); // in-flow boxes are already sized
  }

  // Push overlapping boxes apart, then keep them inside the stage.
  function separate(list, W, H, gap) {
    for (var it = 0; it < 40; it++) {
      var moved = false;
      for (var i = 0; i < list.length; i++) {
        for (var j = i + 1; j < list.length; j++) {
          var p = list[i], q = list[j];
          var dx = q.x - p.x, dy = q.y - p.y;
          var ox = p.hw + q.hw + gap - Math.abs(dx), oy = p.hh + q.hh + gap - Math.abs(dy);
          if (ox <= 0 || oy <= 0) continue;
          moved = true;
          if (ox < oy) {
            var sx = (dx >= 0 ? 1 : -1) * ox / 2;
            p.x -= sx; q.x += sx;
          } else {
            var sy = (dy >= 0 ? 1 : -1) * oy / 2;
            p.y -= sy; q.y += sy;
          }
        }
      }
      list.forEach(function (b) {
        b.x = Math.max(b.hw, Math.min(W - b.hw, b.x));
        b.y = Math.max(b.hh, Math.min(H - b.hh, b.y));
      });
      if (!moved) break;
    }
  }

  function boxWidth(W) { return Math.min(120, Math.floor(W * 0.33)); }

  // Place boxes at centers [{ f, x, y }] (keyed into fields), nudged apart.
  function placeBoxes(fields, list, W, H) {
    var bw = boxWidth(W);
    var hw = bw / 2, hh = BOX_H / 2;
    list.forEach(function (b) { b.hw = hw; b.hh = hh; });
    separate(list, W, H, 6);
    var font = bw < 96 ? '14px' : bw < 108 ? '15px' : '';
    list.forEach(function (b) {
      var s = fields[b.f].box.style;
      s.width = bw + 'px';
      s.height = BOX_H + 'px';
      s.fontSize = font;
      s.left = (b.x - hw) + 'px';
      s.top = (b.y - hh) + 'px';
      var input = fields[b.f].input;
      if (input && document.activeElement !== input) fit(input);
    });
  }

  // The screen's ƒx Work button: lit while every formula is open.
  function workBtn(workEl) {
    var section = workEl.closest('section');
    return section && section.querySelector('.calc-work-btn');
  }

  function syncWorkBtn(workEl) {
    var btn = workBtn(workEl);
    if (!btn) return;
    var items = workEl.querySelectorAll('.work-item');
    var all = items.length > 0 && Array.prototype.every.call(items, function (d) { return d.open; });
    btn.classList.toggle('is-on', all);
    btn.setAttribute('aria-pressed', all);
  }

  // Wire ƒx Work to show all formulas (and scroll to them), or hide them
  // all and scroll back up when they're already showing. getOpen returns
  // the screen's current open-state map (screens replace it on Clear).
  function workToggle(section, getOpen, render) {
    section.querySelector('.calc-work-btn').addEventListener('click', function () {
      var items = section.querySelectorAll('.work-item');
      var show = !Array.prototype.every.call(items, function (d) { return d.open; }) || !items.length;
      var openWork = getOpen();
      Array.prototype.forEach.call(items, function (d) { openWork[d.dataset.key] = show; });
      render();
      if (show && items.length) section.querySelector('.work-head').scrollIntoView({ behavior: 'smooth', block: 'start' });
      else window.scrollTo({ top: 0, behavior: 'smooth' }); // back to the calc
    });
  }

  // Collapsible formula → numbers → result for each key in keys.
  function renderWork(workEl, sol, keys, openWork) {
    workEl.textContent = '';
    if (!sol) {
      workEl.appendChild(el('p', 'work-empty', 'Solved values show their formulas here.'));
      syncWorkBtn(workEl);
      return;
    }
    keys.forEach(function (k) {
      var w = sol.work[k];
      if (!w) return;
      var d = el('details', 'work-item');
      d.dataset.key = k;
      d.open = !!openWork[k];
      // Result, with the formula's right-hand side beside it.
      var sum = el('summary', 'work-result');
      sum.appendChild(el('span', 'work-value', w.result));
      sum.appendChild(el('span', 'work-rule', w.formula.slice(w.formula.indexOf('=') + 1).trim()));
      d.appendChild(sum);
      d.appendChild(el('div', 'work-formula', w.formula));
      d.appendChild(el('div', 'work-sub', w.sub));
      d.appendChild(el('div', 'work-final', w.result));
      d.addEventListener('toggle', function () { openWork[k] = d.open; syncWorkBtn(workEl); });
      workEl.appendChild(d);
    });
    syncWorkBtn(workEl);
  }

  root.UIKit = {
    el: el, svgEl: svgEl, pts: pts, load: load, save: save,
    field: field, paint: paint, separate: separate, boxWidth: boxWidth, BOX_H: BOX_H,
    placeBoxes: placeBoxes, renderWork: renderWork, workToggle: workToggle
  };
})(this);
