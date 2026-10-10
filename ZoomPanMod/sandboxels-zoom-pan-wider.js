// =====================================================================
//  Sandboxels mod: Even Wider canvas + smooth zoom + middle-mouse pan
//
//  1. Settings > Canvas Size gets a new option, "Even Wider": the
//     simulation is twice as wide as "Wide" (fitted to your screen).
//  2. Mouse wheel = SMOOTH zoom, centred on the mouse cursor.
//     (Shift + wheel still changes the brush size.)
//  3. Hold the MIDDLE mouse button and drag to pan while zoomed in.
//     A quick middle-click without dragging still picks the element.
//  4. A small zoom slider in the bottom button row. Click the "1.00x"
//     label next to it to reset the view.
//
//  Load it with a jsDelivr URL in Mods > Mod Manager, e.g.
//  https://cdn.jsdelivr.net/gh/YOUR_USER/YOUR_REPO@main/sandboxels-zoom-pan-wider.js
// =====================================================================
(function () {
  "use strict";
  if (window.__swzpLoaded) return;
  window.__swzpLoaded = true;

  /* ------------------------------ config ------------------------------ */
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 32;
  const WHEEL_SENS = 0.0018;   // ln-zoom per wheel pixel (one 100px notch is about x1.2)
  const PINCH_SENS = 0.01;     // trackpad pinch (arrives as ctrl + wheel)
  const SMOOTH_MS = 90;        // zoom smoothing time constant (lower = snappier)
  const PAN_CLICK_PX = 4;      // middle-drag shorter than this counts as a click
  const SLIDER_STEPS = 1000;
  const LN_MIN = Math.log(MIN_ZOOM);
  const LN_MAX = Math.log(MAX_ZOOM);

  /* ===================================================================== */
  /*  Part 1: "Even Wider" canvas size                                      */
  /* ===================================================================== */

  // Saved as "6ww". If this mod is ever removed, the game reads the trailing
  // "w" and simply falls back to the normal Wide mode.
  function isEvenWide() {
    try { return String(settings.pixelsize).slice(-2) === "ww"; }
    catch (_) { return false; }
  }

  function evenWideResize(clear, ratio) {
    pixelSize = parseInt(settings.pixelsize) || 6;
    if (window.innerWidth < 700) pixelSize--;

    const fitWidth = window.innerWidth - 10;     // what "Wide" uses
    let newHeight = window.innerHeight / 1.6;    // same height as "Wide"
    let newWidth = fitWidth * 2;                 // twice as many columns

    if (ratio) {
      if (newHeight < newWidth) newWidth = ratio * newHeight;
      else newHeight = ratio * newWidth;
    }

    const gameDiv = document.getElementById("gameDiv");
    gameDiv.classList.add("gameDiv-wide");
    resizeCanvas(newHeight, newWidth, pixelSize, clear);

    // The canvas holds 2x the columns but is displayed fitted to the screen.
    const shown = Math.min(newWidth, fitWidth);
    gameDiv.style.width = shown + "px";
    document.getElementById("game").style.width = shown + "px";
  }

  let originalAutoResize = null;

  function canvasSignature() {
    const c = document.getElementById("game");
    const g = document.getElementById("gameDiv");
    return c.width + "x" + c.height + "|" + g.style.width;
  }

  function autoResizeWrapper(clear, ratio) {
    const before = canvasSignature();
    if (isEvenWide()) {
      evenWideResize(clear, ratio);
    } else {
      if (originalAutoResize) originalAutoResize.apply(this, arguments);
      document.getElementById("game").style.width = "";   // drop our fitted width
    }
    // New canvas dimensions invalidate the zoom state; a plain scene reset keeps it.
    if (canvasSignature() !== before) resetView();
  }

  // The game assigns `autoResizeCanvas = function...` inside window.onload,
  // which is AFTER mods load. A setter on window lets us wrap it the moment
  // it is defined, so even the very first resize already uses our logic.
  if (typeof window.autoResizeCanvas === "function") {
    originalAutoResize = window.autoResizeCanvas;
    window.autoResizeCanvas = autoResizeWrapper;
  } else {
    Object.defineProperty(window, "autoResizeCanvas", {
      configurable: true,
      enumerable: true,
      get: function () { return autoResizeWrapper; },
      set: function (fn) { originalAutoResize = fn; }
    });
  }

  function addSizeOption() {
    const base = document.getElementById("setting-pixelsize-6w");
    if (!base) return;
    const value = base.value + "w";                      // "6w" -> "6ww"
    const id = "setting-pixelsize-" + value;
    if (document.getElementById(id)) return;
    const opt = document.createElement("option");
    opt.value = value;
    opt.id = id;
    opt.textContent = "Even Wider";
    base.insertAdjacentElement("afterend", opt);
  }

  /* ===================================================================== */
  /*  Part 2: smooth zoom, middle-mouse pan, zoom slider                    */
  /* ===================================================================== */

  // View state. `ln` is the current (animated) log-zoom, `target` where it is
  // heading. (ox, oy) is the canvas offset in px from its natural position.
  // `anchor` is the canvas point (in unscaled canvas px) that must stay under
  // the client position (cx, cy) while zooming.
  const st = { ln: LN_MIN, target: LN_MIN, ox: 0, oy: 0, anchor: null, raf: 0, last: 0 };
  let canvasEl = null, viewEl = null, slider = null, label = null;
  let sliderDragging = false;
  let pan = null;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function menuOpen() {
    try { return !!showingMenu; } catch (_) { return false; }
  }

  // Natural (untransformed) top-left of the canvas in client coordinates.
  // The transform origin is the top-left corner, so scale never moves it.
  function naturalPos() {
    const r = canvasEl.getBoundingClientRect();
    return { nl: r.left - st.ox, nt: r.top - st.oy };
  }

  // Keep the canvas covering the view (or fully inside it when smaller).
  function clampOffsets(ox, oy, s, nl, nt) {
    const v = viewEl.getBoundingClientRect();
    function axis(natural, size, vmin, vmax, val) {
      const a = vmax - size, b = vmin;
      const lo = Math.min(a, b), hi = Math.max(a, b);
      return clamp(natural + val, lo, hi) - natural;
    }
    return [
      axis(nl, canvasEl.offsetWidth * s, v.left, v.right, ox),
      axis(nt, canvasEl.offsetHeight * s, v.top, v.bottom, oy)
    ];
  }

  function updateUi() {
    const s = Math.exp(st.ln);
    if (label) label.textContent = s.toFixed(s < 10 ? 2 : 1) + "x";
    if (slider && !sliderDragging && document.activeElement !== slider) {
      slider.value = String(Math.round((st.ln - LN_MIN) / (LN_MAX - LN_MIN) * SLIDER_STEPS));
    }
  }

  function paint() {
    const s = Math.exp(st.ln);
    if (s <= 1.0005) {
      st.ox = 0; st.oy = 0;
      canvasEl.style.transform = "";            // back to the game's own layout
      canvasEl.style.transformOrigin = "";
    } else {
      canvasEl.style.transformOrigin = "0 0";
      canvasEl.style.transform =
        "translate(calc(-50% + " + st.ox + "px), " + st.oy + "px) scale(" + s + ")";
    }
    updateUi();
  }

  function applyZoom() {
    const s = Math.exp(st.ln);
    const p = naturalPos();
    let ox = st.ox, oy = st.oy;
    if (st.anchor) {
      ox = st.anchor.cx - st.anchor.px * s - p.nl;
      oy = st.anchor.cy - st.anchor.py * s - p.nt;
    }
    const c = clampOffsets(ox, oy, s, p.nl, p.nt);
    st.ox = c[0]; st.oy = c[1];
    paint();
  }

  function step(now) {
    st.raf = 0;
    const dt = Math.min(64, Math.max(0, now - st.last));
    st.last = now;
    st.ln += (st.target - st.ln) * (1 - Math.exp(-dt / SMOOTH_MS));
    if (Math.abs(st.target - st.ln) < 0.0004) st.ln = st.target;
    applyZoom();
    if (st.ln !== st.target) schedule();
  }

  function schedule() {
    if (st.raf) return;
    st.last = performance.now();
    st.raf = requestAnimationFrame(step);
  }

  // Set a new zoom target, keeping the canvas point under (cx, cy) fixed.
  function setZoomTarget(ln, cx, cy) {
    if (!canvasEl) return;
    const s = Math.exp(st.ln);
    const r = canvasEl.getBoundingClientRect();
    st.anchor = { cx: cx, cy: cy, px: (cx - r.left) / s, py: (cy - r.top) / s };
    st.target = clamp(ln, LN_MIN, LN_MAX);
    if (st.target !== st.ln) schedule();
  }

  function zoomBy(dLn, cx, cy) { setZoomTarget(st.target + dLn, cx, cy); }

  function resetView() {
    if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; }
    st.ln = st.target = LN_MIN;
    st.ox = 0; st.oy = 0; st.anchor = null;
    if (canvasEl) paint();
  }

  /* ----------------------------- wheel zoom ----------------------------- */

  let lastBrushScroll = 0;

  function onWheel(e) {
    if (e.target !== canvasEl || menuOpen()) return;
    e.preventDefault();
    e.stopPropagation();                         // keep the game's own wheel handler out

    if (e.shiftKey) {                            // Shift + wheel: brush size, as in vanilla
      const now = Date.now();
      if (now - lastBrushScroll < 25) return;
      lastBrushScroll = now;
      let d = e.deltaY || e.deltaX;
      if (settings.invertscroll) d = d > 0 ? 1 : -1;
      else d = d < 0 ? 1 : -1;
      mouseSize += Math.round(d);
      checkMouseSize(Math.sign(d));
      return;
    }

    if (document.activeElement === slider) slider.blur();
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 33;             // lines -> px
    else if (e.deltaMode === 2) dy *= window.innerHeight;
    const sens = e.ctrlKey ? PINCH_SENS : WHEEL_SENS;
    const dir = settings.invertscroll ? 1 : -1;  // wheel up = zoom in
    zoomBy(dy * sens * dir, e.clientX, e.clientY);
  }

  /* --------------------------- middle-mouse pan -------------------------- */

  function endPan(e) {
    const p = pan;
    pan = null;
    if (canvasEl) canvasEl.classList.remove("swzp-panning");
    if (e && p && !p.moved) {                    // plain middle-click: vanilla "pick element"
      try { mouseMiddleAction(e); } catch (_) { /* ignore */ }
    }
  }

  function onMouseDown(e) {
    if (e.button !== 1 || e.target !== canvasEl || menuOpen()) return;
    e.preventDefault();                          // no browser autoscroll circle
    e.stopPropagation();                         // the game must not start its middle action
    st.target = st.ln;                           // stop any zoom animation in progress
    st.anchor = null;
    pan = { lx: e.clientX, ly: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
    canvasEl.classList.add("swzp-panning");
  }

  function onMouseMove(e) {
    if (!pan) return;
    if (!(e.buttons & 4)) { endPan(null); return; }   // released outside the window
    if (!pan.moved && Math.hypot(e.clientX - pan.sx, e.clientY - pan.sy) >= PAN_CLICK_PX) {
      pan.moved = true;
    }
    const dx = e.clientX - pan.lx, dy = e.clientY - pan.ly;
    pan.lx = e.clientX; pan.ly = e.clientY;
    if (st.ln > LN_MIN + 0.0005) {
      const s = Math.exp(st.ln);
      const p = naturalPos();
      const c = clampOffsets(st.ox + dx, st.oy + dy, s, p.nl, p.nt);
      st.ox = c[0]; st.oy = c[1];
      paint();
    }
  }

  function onMouseUp(e) {
    if (!pan || e.button !== 1) return;
    e.stopPropagation();
    endPan(e);
  }

  /* ----------------------------- UI + wiring ----------------------------- */

  function refocusGame() {
    try { if (typeof focusGame === "function") focusGame(); } catch (_) { /* ignore */ }
  }

  function buildUi() {
    const css = document.createElement("style");
    css.textContent =
      "#canvasDiv{overflow:hidden !important;}" +
      "#game.swzp-panning{cursor:grabbing !important;}" +
      "#swzp-zoom-wrap{display:inline-flex;align-items:center;flex:0 0 auto;gap:4px;padding:0 6px;}" +
      "#swzp-zoom-slider{width:90px;height:14px;margin:0;cursor:pointer;accent-color:#bbb;}" +
      "#swzp-zoom-label{flex-grow:0 !important;min-width:4.2em;}";
    document.head.appendChild(css);

    const bar = document.getElementById("toolControls");
    if (bar) {
      const wrap = document.createElement("span");
      wrap.id = "swzp-zoom-wrap";
      wrap.title = "Zoom: mouse wheel or this slider. Pan: hold the middle mouse button and drag.";

      slider = document.createElement("input");
      slider.type = "range";
      slider.id = "swzp-zoom-slider";
      slider.min = "0";
      slider.max = String(SLIDER_STEPS);
      slider.step = "1";
      slider.value = "0";
      slider.setAttribute("aria-label", "Zoom");

      label = document.createElement("button");
      label.id = "swzp-zoom-label";
      label.className = "controlButton";
      label.title = "Reset zoom and pan";
      label.textContent = "1.00x";

      wrap.appendChild(slider);
      wrap.appendChild(label);
      bar.appendChild(wrap);

      slider.addEventListener("pointerdown", function () { sliderDragging = true; });
      window.addEventListener("pointerup", function () {
        if (!sliderDragging) return;
        sliderDragging = false;
        updateUi();
        slider.blur();
        refocusGame();
      });
      slider.addEventListener("input", function () {
        const v = viewEl.getBoundingClientRect();
        const ln = LN_MIN + (Number(slider.value) / SLIDER_STEPS) * (LN_MAX - LN_MIN);
        setZoomTarget(ln, v.left + v.width / 2, v.top + v.height / 2);
      });
      label.addEventListener("click", function () { resetView(); refocusGame(); });
    }

    viewEl.addEventListener("wheel", onWheel, { capture: true, passive: false });
    viewEl.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("mousemove", onMouseMove, true);
    window.addEventListener("mouseup", onMouseUp, true);
    updateUi();
  }

  // The game's own getMousePos divides by clientWidth, which ignores CSS
  // transforms. Dividing by the on-screen rect makes the brush land under
  // the cursor at any zoom / pan / canvas display size.
  window.getMousePos = function (cv, evt) {
    if (evt.touches) {
      evt.preventDefault();
      evt = evt.touches[0];
      isMobile = true;
    }
    const r = cv.getBoundingClientRect();
    return {
      x: Math.floor(((evt.clientX - r.left) / r.width) * (width + 1)),
      y: Math.floor(((evt.clientY - r.top) / r.height) * (height + 1))
    };
  };

  runAfterLoad(function () {
    // Runs at the start of the game's onload: before the settings are applied
    // to the dropdowns, so a saved "Even Wider" choice is restored correctly.
    addSizeOption();
    canvasEl = document.getElementById("game");
    viewEl = document.getElementById("canvasDiv");
    buildUi();
  });

  window.sandboxelsZoomPan = { reset: resetView };
})();
