/**
 * Prisma Device — detecção flexível PC / tablet / mobile
 * Usa matchMedia (preferível) + toque + viewport; atualiza em resize/orientação.
 * Expõe window.PrismaDevice e atributos em <html> para CSS/JS.
 */
(function (root) {
  'use strict';

  var BREAKPOINTS = {
    mobileMax: 767,
    tabletMax: 1023
  };

  var state = {
    type: 'desktop',       // mobile | tablet | desktop
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isTouch: false,
    isCoarsePointer: false,
    isStandalone: false,
    isPortrait: true,
    width: 0,
    height: 0,
    dpr: 1
  };

  var listeners = [];
  var mqMobile = null;
  var mqTablet = null;
  var mqTouch = null;
  var mqCoarse = null;
  var mqPortrait = null;
  var resizeTimer = null;

  function safeMatch(query) {
    try {
      return root.matchMedia ? root.matchMedia(query) : { matches: false, addEventListener: function () {}, addListener: function () {} };
    } catch (_) {
      return { matches: false, addEventListener: function () {}, addListener: function () {} };
    }
  }

  function detectTouch() {
    try {
      if (navigator.maxTouchPoints > 0) return true;
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
      if ('ontouchstart' in window) return true;
    } catch (_) { }
    return false;
  }

  function detectStandalone() {
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
      if (navigator.standalone === true) return true;
    } catch (_) { }
    return false;
  }

  function compute() {
    var w = window.innerWidth || document.documentElement.clientWidth || 0;
    var h = window.innerHeight || document.documentElement.clientHeight || 0;
    var isMobile = w <= BREAKPOINTS.mobileMax;
    var isTablet = w > BREAKPOINTS.mobileMax && w <= BREAKPOINTS.tabletMax;
    // Reforço: telas largas com pointer coarse ainda são tratadas como "touch-first"
    var isTouch = detectTouch();
    var isCoarse = false;
    try {
      isCoarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    } catch (_) { }

    // Se a largura for desktop mas o user-agent for claramente mobile (teclado bluetooth etc.),
    // prioriza viewport — é o que define o layout.
    var type = isMobile ? 'mobile' : (isTablet ? 'tablet' : 'desktop');

    var next = {
      type: type,
      isMobile: isMobile,
      isTablet: isTablet,
      isDesktop: !isMobile && !isTablet,
      isTouch: isTouch,
      isCoarsePointer: isCoarse,
      isStandalone: detectStandalone(),
      isPortrait: h >= w,
      width: w,
      height: h,
      dpr: window.devicePixelRatio || 1
    };
    return next;
  }

  function applyDom(s) {
    var html = document.documentElement;
    if (!html) return;
    html.setAttribute('data-device', s.type);
    html.setAttribute('data-touch', s.isTouch ? 'true' : 'false');
    html.setAttribute('data-pointer', s.isCoarsePointer ? 'coarse' : 'fine');
    html.setAttribute('data-orientation', s.isPortrait ? 'portrait' : 'landscape');
    html.setAttribute('data-standalone', s.isStandalone ? 'true' : 'false');
    html.classList.toggle('is-mobile', s.isMobile);
    html.classList.toggle('is-tablet', s.isTablet);
    html.classList.toggle('is-desktop', s.isDesktop);
    html.classList.toggle('is-touch', s.isTouch);
    try {
      document.body && document.body.classList.toggle('prisma-mobile', s.isMobile);
      document.body && document.body.classList.toggle('prisma-tablet', s.isTablet);
      document.body && document.body.classList.toggle('prisma-desktop', s.isDesktop);
    } catch (_) { }
  }

  function emit(prev, next) {
    var detail = { previous: prev, current: next };
    listeners.forEach(function (fn) {
      try { fn(next, prev); } catch (_) { }
    });
    try {
      window.dispatchEvent(new CustomEvent('prisma:devicechange', { detail: detail }));
    } catch (_) { }
  }

  function refresh(force) {
    var prev = Object.assign({}, state);
    var next = compute();
    var changed =
      force ||
      prev.type !== next.type ||
      prev.isTouch !== next.isTouch ||
      prev.isPortrait !== next.isPortrait ||
      prev.isStandalone !== next.isStandalone;

    state = next;
    applyDom(state);

    if (changed) emit(prev, state);
    return state;
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      refresh(false);
    }, 120);
  }

  function bindMq(mq, handler) {
    if (!mq) return;
    try {
      if (typeof mq.addEventListener === 'function') mq.addEventListener('change', handler);
      else if (typeof mq.addListener === 'function') mq.addListener(handler);
    } catch (_) { }
  }

  function init() {
    mqMobile = safeMatch('(max-width: ' + BREAKPOINTS.mobileMax + 'px)');
    mqTablet = safeMatch('(min-width: ' + (BREAKPOINTS.mobileMax + 1) + 'px) and (max-width: ' + BREAKPOINTS.tabletMax + 'px)');
    mqTouch = safeMatch('(hover: none) and (pointer: coarse)');
    mqCoarse = safeMatch('(pointer: coarse)');
    mqPortrait = safeMatch('(orientation: portrait)');

    refresh(true);

    bindMq(mqMobile, function () { refresh(false); });
    bindMq(mqTablet, function () { refresh(false); });
    bindMq(mqTouch, function () { refresh(false); });
    bindMq(mqCoarse, function () { refresh(false); });
    bindMq(mqPortrait, function () { refresh(false); });

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', function () {
      setTimeout(function () { refresh(true); }, 200);
    }, { passive: true });
  }

  var api = {
    getState: function () { return Object.assign({}, state); },
    isMobile: function () { return !!state.isMobile; },
    isTablet: function () { return !!state.isTablet; },
    isDesktop: function () { return !!state.isDesktop; },
    isTouch: function () { return !!state.isTouch; },
    isStandalone: function () { return !!state.isStandalone; },
    type: function () { return state.type; },
    refresh: function () { return refresh(true); },
    onChange: function (fn) {
      if (typeof fn === 'function') listeners.push(fn);
      return function unsubscribe() {
        listeners = listeners.filter(function (f) { return f !== fn; });
      };
    },
    breakpoints: BREAKPOINTS
  };

  root.PrismaDevice = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
