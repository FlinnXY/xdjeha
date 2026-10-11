// =====================================================================
//  Sandboxels mod: Even Wider canvas + smooth zoom + middle-mouse pan
//
//  1. Settings > Canvas Size gets a new option, "Even Wider": the scene
//     is twice as wide as "Wide" and exactly as tall as "Wide". It is NOT
//     squeezed onto the screen - pan across it with the middle mouse button.
//  2. Mouse wheel = SMOOTH zoom (0.5x - 32x), centred on the cursor.
//     Ctrl + wheel changes the brush size.
//  3. Hold the MIDDLE mouse button and drag to pan. You can pan the scene
//     out past the edges of the view. A middle-click without dragging still
//     picks the element, like in vanilla.
//  4. A small zoom slider in the bottom button row. Click the "1.00x" label
//     next to it to reset zoom and pan.
//
//  How zoom works: the canvas is really resized and repositioned (not
//  CSS-scaled), so the game's own mouse-to-pixel mapping stays exact at
//  every zoom level and pan position.
//
//  Load it with a jsDelivr URL in Mods > Mod Manager.
// =====================================================================
(function () {
  "use strict";
  if (window.__swzpLoaded) return;
  window.__swzpLoaded = true;

  /* ------------------------------ config ------------------------------ */
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 32;
  const WHEEL_SENS = 0.0018;   // ln-zoom per wheel pixel (one 100px notch is about x1.2)
  const PINCH_SENS = 0.01;     // trackpad pinch (ctrl + small fractional wheel deltas)
  const SMOOTH_MS = 90;        // zoom smoothing time constant (lower = snappier)
  const PAN_CLICK_PX = 4;      // middle-drag shorter than this counts as a click
  const EDGE_MARGIN = 120;     // px of the scene that always stay inside the view when panning
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

    const viewWidth = window.innerWidth - 10;    // what "Wide" uses
    let newHeight = window.innerHeight / 1.6;    // exactly the height of "Wide"
    let newWidth = viewWidth * 2;                // twice as many columns

    if (ratio) {
      if (newHeight < newWidth) newWidth = ratio * newHeight;
      else newHeight = ratio * newWidth;
    }

    const gameDiv = document.getElementById("gameDiv");
    gameDiv.classList.add("gameDiv-wide");
    resizeCanvas(newHeight, newWidth, pixelSize, clear);
    // The visible window stays screen-wide; the scene is panned inside it.
    gameDiv.style.width = Math.min(newWidth, viewWidth) + "px";
  }

  let originalAutoResize = null;

  function canvasSignature() {
    const c = document.getElementById("game");
    const g = document.getElementById("gameDiv");
    return c.width + "x" + c.height + "|" + g.style.width + "|" + isEvenWide();
  }

  function autoResizeWrapper(clear, ratio) {
    const before = canvasSignature();
    const even = isEvenWide();
    document.getElementById("game").classList.toggle("swzp-even", even);
    if (even) {
      evenWideResize(clear, ratio);
    } else if (originalAutoResize) {
      originalAutoResize.apply(this, arguments);
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

  // View state. `ln` is the current (animated) log-zoom and `target` where it
  // is heading. (ox, oy) is the canvas offset in whole px from its default,
  // centred position. `anchor` is the point of the scene (as fractions of its
  // size) that must stay under the client position (cx, cy) while zooming.
  const st = { ln: 0, target: 0, ox: 0, oy: 0, anchor: null, raf: 0, last: 0, active: false };
  let canvasEl = null, viewEl = null, slider = null, label = null;
  let sliderDragging = false;
  let pan = null;
  let lastClient = null;

  // Natural (zoom 1.0) size of the canvas and of the view, measured while the
  // canvas has none of our inline styles. `free` = our inline styles are on.
  let W0 = 0, H0 = 0, VIEW_H = 0, free = false;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function menuOpen() {
    try { return !!showingMenu; } catch (_) { return false; }
  }

  function clearInline() {
    canvasEl.classList.remove("swzp-free");
    const s = canvasEl.style;
    s.width = ""; s.height = ""; s.left = ""; s.top = "";
    viewEl.style.height = "";
    free = false;
  }

  function measureBase() {
    clearInline();
    const r = canvasEl.getBoundingClientRect();
    W0 = r.width; H0 = r.height;
    VIEW_H = viewEl.getBoundingClientRect().height;
  }

  function ensureBase() { if (!free) measureBase(); }

  // Where the canvas' top-left sits (client coords) at offset (0, 0).
  function naturalPos() {
    const v = viewEl.getBoundingClientRect();
    const natX = Math.round((viewEl.clientWidth - W0) / 2);
    return { nl: v.left + viewEl.clientLeft + natX, nt: v.top + viewEl.clientTop, natX: natX };
  }

  // The scene may be panned out past the view, but a strip of it stays reachable.
  function clampOffsets(ox, oy, Wpx, Hpx, p) {
    const v = viewEl.getBoundingClientRect();
    const mx = Math.min(EDGE_MARGIN, Wpx, v.width);
    const my = Math.min(EDGE_MARGIN, Hpx, v.height);
    const L = clamp(p.nl + ox, v.left + mx - Wpx, v.right - mx);
    const T = clamp(p.nt + oy, v.top + my - Hpx, v.bottom - my);
    return [Math.round(L - p.nl), Math.round(T - p.nt)];
  }

  function updateUi() {
    const s = Math.exp(st.ln);
    if (label) label.textContent = s.toFixed(s < 10 ? 2 : 1) + "x";
    if (slider && !sliderDragging && document.activeElement !== slider) {
      slider.value = String(Math.round((st.ln - LN_MIN) / (LN_MAX - LN_MIN) * SLIDER_STEPS));
    }
  }

  // Cell of the scene under a client position, from the real on-screen rect.
  function cellAt(cv, clientX, clientY) {
    const r = cv.getBoundingClientRect();
    return {
      x: Math.floor(((clientX - r.left) / r.width) * (width + 1)),
      y: Math.floor(((clientY - r.top) / r.height) * (height + 1))
    };
  }

  // Keeps the brush preview glued to the cursor while the view moves under it.
  function syncMousePos() {
    if (!lastClient || !canvasEl) return;
    try { mousePos = cellAt(canvasEl, lastClient.x, lastClient.y); } catch (_) { /* ignore */ }
  }

  function paint() {
    if (st.ln === 0 && st.ox === 0 && st.oy === 0) {      // untouched: the game's own layout
      if (free) clearInline();
      updateUi();
      return;
    }
    const s = Math.exp(st.ln);
    const wasFree = free;
    if (!wasFree) {
      free = true;
      canvasEl.classList.add("swzp-free");
      viewEl.style.height = VIEW_H + "px";                // the page must not jump when zoomed
    }
    const natX = Math.round((viewEl.clientWidth - W0) / 2);
    const cs = canvasEl.style;
    cs.width = Math.round(W0 * s) + "px";
    cs.height = Math.round(H0 * s) + "px";
    cs.left = (natX + st.ox) + "px";
    cs.top = st.oy + "px";
    syncMousePos();
    updateUi();
  }

  function applyZoom() {
    ensureBase();
    const s = Math.exp(st.ln);
    const Wpx = Math.round(W0 * s), Hpx = Math.round(H0 * s);
    const p = naturalPos();
    let ox = st.ox, oy = st.oy;
    if (st.anchor) {
      ox = Math.round(st.anchor.cx - st.anchor.fx * Wpx - p.nl);
      oy = Math.round(st.anchor.cy - st.anchor.fy * Hpx - p.nt);
    }
    const c = clampOffsets(ox, oy, Wpx, Hpx, p);
    st.ox = c[0]; st.oy = c[1];
    paint();
  }

  // IMPORTANT: time is measured with performance.now(), NOT the timestamp that
  // requestAnimationFrame hands over. On a heavy scene the game's own draw callback
  // runs first in every frame and takes 50ms+, which makes that timestamp stale
  // and turned the old delta-time into ~0 (so the zoom barely moved).
  function step() {
    st.raf = 0;
    const t = performance.now();
    const dt = Math.min(500, Math.max(0, t - st.last));   // the smoothing is exact for any dt
    st.last = t;
    st.ln += (st.target - st.ln) * (1 - Math.exp(-dt / SMOOTH_MS));
    if (Math.abs(st.target - st.ln) < 0.0004) st.ln = st.target;
    applyZoom();
    if (st.ln !== st.target) schedule();
    else st.active = false;
  }

  function schedule() {
    if (st.raf) return;
    if (!st.active) { st.active = true; st.last = performance.now(); }
    st.raf = requestAnimationFrame(step);
  }

  // Set a new zoom target, keeping the scene point under (cx, cy) fixed.
  function setZoomTarget(ln, cx, cy) {
    if (!canvasEl) return;
    let t = clamp(ln, LN_MIN, LN_MAX);
    if (Math.abs(t) < 0.03) t = 0;                         // snap to exactly 1.00x
    const r = canvasEl.getBoundingClientRect();
    // While the cursor has not moved, keep the same anchor so rounding never accumulates.
    const keep = st.anchor && st.ln !== st.target && st.anchor.cx === cx && st.anchor.cy === cy;
    if (!keep && r.width > 0 && r.height > 0) {
      st.anchor = { cx: cx, cy: cy, fx: (cx - r.left) / r.width, fy: (cy - r.top) / r.height };
    }
    st.target = t;
    if (st.target !== st.ln) schedule();
  }

  function zoomBy(dLn, cx, cy) { setZoomTarget(st.target + dLn, cx, cy); }

  function resetView() {
    if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; }
    st.active = false;
    st.ln = 0; st.target = 0; st.ox = 0; st.oy = 0; st.anchor = null;
    if (canvasEl) { clearInline(); paint(); }
  }

  /* ----------------------------- wheel zoom ----------------------------- */

  function inView(e) {
    const t = e.target;
    return t === canvasEl || t === viewEl || (t && (t.id === "logDiv" || t.id === "logText"));
  }

  let lastBrushScroll = 0;

  function onWheel(e) {
    if (!inView(e) || menuOpen()) return;
    e.preventDefault();                          // also stops the browser's own page zoom
    e.stopPropagation();                         // keep the game's own wheel handler out

    let dy = e.deltaY || e.deltaX;
    if (e.deltaMode === 1) dy *= 33;             // lines -> px
    else if (e.deltaMode === 2) dy *= window.innerHeight;
    // Trackpad pinch arrives as ctrl + small fractional deltas: that stays a zoom.
    const pinch = e.ctrlKey && Math.abs(dy) < 40 && dy !== Math.round(dy);

    if (e.ctrlKey && !pinch) {                   // Ctrl + wheel: brush size, same rules as vanilla
      const now = Date.now();
      if (now - lastBrushScroll < 25) return;
      lastBrushScroll = now;
      let d = dy;
      if (settings.invertscroll) d = d > 0 ? 1 : -1;
      else d = d < 0 ? 1 : -1;
      mouseSize += Math.round(d);
      checkMouseSize(Math.sign(d));
      return;
    }

    // Plain wheel: smooth zoom around the cursor.
    if (document.activeElement === slider) slider.blur();
    const dir = settings.invertscroll ? 1 : -1;  // wheel up = zoom in
    zoomBy(dy * (pinch ? PINCH_SENS : WHEEL_SENS) * dir, e.clientX, e.clientY);
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

  // On Linux a middle-click also fires a "paste" event (primary selection), which
  // the game cannot handle when the clipboard is empty. Swallow those.
  let lastMiddle = 0;
  window.addEventListener("paste", function (e) {
    if (Date.now() - lastMiddle < 600) { e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
  window.addEventListener("auxclick", function (e) {
    if (e.button === 1 && inView(e)) e.preventDefault();
  }, true);

  function onMouseDown(e) {
    if (e.button !== 1 || !inView(e) || menuOpen()) return;
    lastMiddle = Date.now();
    e.preventDefault();                          // no browser autoscroll circle
    e.stopPropagation();                         // the game must not start its middle action
    st.target = st.ln;                           // stop any zoom animation in progress
    st.active = false;
    st.anchor = null;
    pan = { lx: e.clientX, ly: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
    canvasEl.classList.add("swzp-panning");
  }

  function onMouseMove(e) {
    lastClient = { x: e.clientX, y: e.clientY };
    if (!pan) return;
    if (!(e.buttons & 4)) { endPan(null); return; }   // released outside the window
    if (!pan.moved && Math.hypot(e.clientX - pan.sx, e.clientY - pan.sy) >= PAN_CLICK_PX) {
      pan.moved = true;
    }
    const dx = e.clientX - pan.lx, dy = e.clientY - pan.ly;
    pan.lx = e.clientX; pan.ly = e.clientY;
    if (dx === 0 && dy === 0) return;
    ensureBase();
    const s = Math.exp(st.ln);
    const p = naturalPos();
    const c = clampOffsets(st.ox + dx, st.oy + dy, Math.round(W0 * s), Math.round(H0 * s), p);
    st.ox = c[0]; st.oy = c[1];
    paint();
  }

  function onMouseUp(e) {
    if (e.button === 1) lastMiddle = Date.now();
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
      "#game.swzp-even{max-width:none !important;max-height:none !important;}" +
      "#game.swzp-free{max-width:none !important;max-height:none !important;transform:none !important;}" +
      "#game.swzp-panning{cursor:grabbing !important;}" +
      "#swzp-zoom-wrap{display:inline-flex;align-items:center;flex:0 0 auto;gap:4px;padding:0 6px;}" +
      "#swzp-zoom-slider{width:90px;height:14px;margin:0;cursor:pointer;accent-color:#bbb;}" +
      "#swzp-zoom-label{flex-grow:0 !important;min-width:4.2em;}";
    document.head.appendChild(css);

    const bar = document.getElementById("toolControls");
    if (bar) {
      const wrap = document.createElement("span");
      wrap.id = "swzp-zoom-wrap";
      wrap.title = "Zoom: mouse wheel or this slider. Brush size: Ctrl + wheel. Pan: hold the middle mouse button and drag.";

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
    window.addEventListener("resize", function () { resetView(); });
    updateUi();
  }

  // Cursor -> grid cell, from the canvas' real on-screen rect. Because zoom
  // resizes the canvas for real (no CSS transform), this and the game's own
  // mapping always agree.
  window.getMousePos = function (cv, evt) {
    if (evt.touches) {
      evt.preventDefault();
      evt = evt.touches[0];
      isMobile = true;
    }
    return cellAt(cv, evt.clientX, evt.clientY);
  };

  // Console helper:  sandboxelsZoomPan.test()
  // Asks the game's getMousePos about a grid of cursor positions and compares
  // the answer with the cell that is really drawn under the cursor.
  function selfTest() {
    if (!canvasEl) return "not ready";
    const r = canvasEl.getBoundingClientRect();
    const v = viewEl.getBoundingClientRect();
    const x0 = Math.max(r.left, v.left), x1 = Math.min(r.right, v.right);
    const y0 = Math.max(r.top, v.top), y1 = Math.min(r.bottom, v.bottom);
    let bad = 0, n = 0;
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) {
      const cx = Math.round(x0 + (x1 - x0 - 1) * i / 8), cy = Math.round(y0 + (y1 - y0 - 1) * j / 8);
      const want = cellAt(canvasEl, cx, cy);
      const got = getMousePos(canvasEl, { clientX: cx, clientY: cy });
      n++;
      if (got.x !== want.x || got.y !== want.y) { bad++; console.warn("mismatch at", cx, cy, "want", want, "got", got); }
    }
    const msg = bad ? bad + " of " + n + " cursor positions map to the wrong cell" : "OK: all " + n + " cursor positions map to the right cell";
    console.log("[zoom mod] " + msg);
    return msg;
  }

  /* ===================================================================== */
  /*  Part 3: no pixel limit                                                */
  /* ===================================================================== */

  // The game stops placing at maxPixelCount (13,861 by default) unless its
  // "Limitless" setting is on. Pin the cap to "practically infinite" so it
  // can never come back, whatever the setting says. The only remaining limit
  // is physical: one pixel per grid cell.
  const UNLIMITED = 999999999999;
  try {
    Object.defineProperty(window, "maxPixelCount", {
      configurable: true,
      enumerable: true,
      get: function () { return UNLIMITED; },
      set: function () { /* ignore the game's attempts to re-apply the cap */ }
    });
  } catch (_) {
    runEveryTick(function () { maxPixelCount = UNLIMITED; });   // fallback if the property is locked
  }

  runAfterLoad(function () {
    // Runs at the start of the game's onload: before the settings are applied
    // to the dropdowns, so a saved "Even Wider" choice is restored correctly.
    try { settings.limitless = 1; if (typeof refreshMaxPixels === "function") refreshMaxPixels(); }
    catch (_) { /* ignore */ }
    addSizeOption();
    canvasEl = document.getElementById("game");
    viewEl = document.getElementById("canvasDiv");
    buildUi();
  });

  window.sandboxelsZoomPan = { reset: resetView, test: selfTest };
})();
