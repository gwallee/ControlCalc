/* App shell: tabs, build stamp, offline service worker. */
(function () {
  'use strict';

  // Add new calcs here.
  var CALCS = [
    { id: 'triangle', label: 'Triangle', mount: function (el) { TriangleUI.mount(el); } },
    { id: 'vee', label: 'Circle in V', mount: function (el) { VeeUI.mount(el); } },
    { id: 'stack', label: 'Stack', mount: function (el) { StackUI.mount(el); } },
    { id: 'line', label: 'Line', mount: function (el) { LineUI.mount(el); } },
    { id: 'screw', label: 'Screw', mount: function (el) { ScrewUI.mount(el); } },
    { id: 'scale', label: 'Scale', mount: function (el) { ScaleUI.mount(el); } }
  ];

  document.getElementById('build').textContent = ROBOTCALC_BUILD;

  var tabs = document.getElementById('tabs');
  var view = document.getElementById('view');

  function show(id) {
    var calc = CALCS.filter(function (c) { return c.id === id; })[0] || CALCS[0];
    view.textContent = '';
    calc.mount(view);
    Array.prototype.forEach.call(tabs.children, function (b) {
      b.classList.toggle('is-on', b.dataset.id === calc.id);
    });
  }

  CALCS.forEach(function (c) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab';
    b.dataset.id = c.id;
    b.textContent = c.label;
    b.addEventListener('click', function () { location.hash = c.id; });
    tabs.appendChild(b);
  });

  window.addEventListener('hashchange', function () { show(location.hash.slice(1)); });
  show(location.hash.slice(1));

  // Service workers need http(s); file:// just runs without offline caching.
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    // A new build takes over as soon as it has downloaded (sw.js calls
    // skipWaiting); reload once onto it so a single visit shows the update.
    // Skipped on the very first install, when there was no old build.
    var hadBuild = !!navigator.serviceWorker.controller, reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadBuild || reloaded) return;
      reloaded = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
      // Check for a new build whenever the app comes back to the screen.
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') reg.update().catch(function () {});
      });
    }).catch(function () {});
  }
})();
