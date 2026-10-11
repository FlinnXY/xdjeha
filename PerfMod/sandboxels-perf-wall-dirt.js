// Sandboxels performance mod: Rock Wall + Dirt
// ------------------------------------------------------------------
// What it does (behaviour and looks stay the same):
//  1. DRAWING: Rock Wall and Dirt pixels are written into one small off-screen
//     image (1 texel per cell) and stamped onto the canvas with a single
//     drawImage per frame, instead of one fillRect + colour-string parse per
//     pixel. Hot Rock Wall (glowing), charged / glowing pixels, other views and
//     fractional pixel sizes automatically use the game's own renderer.
//  2. ROCK WALL TICK: the wall's "behaviour" is nine "XX" (do nothing) cells that
//     the game still parses every tick. It is replaced by a tick that runs only
//     what the wall really does: air density, burning, heat, electricity, staining.
//  3. DIRT TICK: a dirt pixel that is fully supported (all three cells below are
//     Dirt, Rock Wall or the world edge) cannot move or react, so the move
//     attempts are skipped. Heat/burn/electricity still run for it every tick.
// Nothing here removes, hides or freezes anything. Toggle: sandboxelsPerf.enable(false).
(function () {
  "use strict";
  var NAMES = ["rock_wall", "dirt"];
  var on = true;
  var origRenderer = {};   // element -> original renderer (or undefined)
  var fast = {};           // element -> true when the fast path is installed
  var colorCache = new Map();
  var hexOf = new Map();
  var groups = new Map(), used = [];
  var drawMode = "batch"; // "batch" (one path per colour), "image" (one off-screen image) or "off" (game's own drawing)

  // --- framebuffer -------------------------------------------------
  var off = null, offCtx = null, img = null, buf32 = null, dirty = [], cw = 0, ch = 0;
  var le = (new Uint8Array(new Uint32Array([1]).buffer))[0] === 1;
  function ensure() {
    var w = width + 1, h = height + 1;
    if (off && cw === w && ch === h) return;
    cw = w; ch = h;
    off = document.createElement("canvas"); off.width = w; off.height = h;
    offCtx = off.getContext("2d");
    img = offCtx.createImageData(w, h);
    buf32 = new Uint32Array(img.data.buffer);
    dirty.length = 0;
  }
  function parse(c) {
    var v = colorCache.get(c);
    if (v !== undefined) return v;
    var r, g, b;
    if (c.charCodeAt(0) === 35 && c.length === 7) { // #rrggbb
      r = parseInt(c.substr(1, 2), 16); g = parseInt(c.substr(3, 2), 16); b = parseInt(c.substr(5, 2), 16);
    } else {
      var m = c.match(/[\d\.]+/g);
      if (c.charCodeAt(0) !== 114 || m === null || m.length < 3) { colorCache.set(c, 0); return 0; } // not plain rgb(): fall back
      r = parseInt(m[0]); g = parseInt(m[1]); b = parseInt(m[2]);   // same as the game's RGBToHex
      r &= 255; g &= 255; b &= 255;
    }
    v = le ? ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0 : (((r << 24) | (g << 16) | (b << 8) | 255) >>> 0);
    colorCache.set(c, v);
    hexOf.set(v, "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1));
    if (colorCache.size > 50000) colorCache.clear();
    return v;
  }
  function flushBatch(ctx) {
    var ps = pixelSize, ga = ctx.globalAlpha;
    if (ga !== 1) ctx.globalAlpha = 1;
    for (var g = 0; g < used.length; g++) {
      var grp = used[g], idxs = grp.idx;
      ctx.fillStyle = grp.hex;
      ctx.beginPath();
      for (var i = 0; i < idxs.length; i++) {
        var k = idxs[i], y = (k / cw) | 0;
        ctx.rect((k - y * cw) * ps, y * ps, ps, ps);
      }
      ctx.fill();
      idxs.length = 0;
    }
    used.length = 0;
    if (ga !== 1) ctx.globalAlpha = ga;
  }
  function flush(ctx) {
    if (used.length) flushBatch(ctx);
    if (!dirty.length) return;
    offCtx.putImageData(img, 0, 0);
    for (var i = 0; i < dirty.length; i++) buf32[dirty[i]] = 0;
    dirty.length = 0;
    var ga = ctx.globalAlpha, sm = ctx.imageSmoothingEnabled;
    ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, cw * pixelSize, ch * pixelSize);
    ctx.imageSmoothingEnabled = sm; ctx.globalAlpha = ga;
  }
  function discard() { // forget anything left from an aborted frame
    for (var g = 0; g < used.length; g++) used[g].idx.length = 0;
    used.length = 0;
    for (var i = 0; i < dirty.length; i++) buf32[dirty[i]] = 0;
    dirty.length = 0;
  }

  var hits = 0, misses = 0, errors = 0;
  function guard(e, where) {
    errors++;
    if (errors === 1) console.warn("[sandboxelsPerf] error in " + where + ", mod switched off:", e);
    on = false;
  }
  function makeRenderer(name) {
    return function (pixel, ctx) {
      try { return render(name, pixel, ctx); } catch (e) { guard(e, "renderer"); discard(); }
      var o = origRenderer[name]; if (o) o(pixel, ctx); else viewInfo[view].pixel(pixel, ctx);
    };
  }
  function render(name, pixel, ctx) {
    {
      var info = elements[name];
      if (on && drawMode !== "off" && view === 1 && pixelSize === (pixelSize | 0) && !pixel.charge && !pixel.glow && info.glow !== true &&
          (pixel.alpha === undefined || pixel.alpha === 1)) {
        var ok = true;
        if (name === "rock_wall") { // same test the game's HEATGLOW uses: only draw the plain colour when no glow overlay would show
          var ratio = ((pixel.temp / info.tempHigh * 100) | 0) / 100;
          if (ratio >= 0.2) ok = false;
        }
        if (ok && typeof pixel.color === "string") {
          var c = parse(pixel.color);
          ensure();
          if (c !== 0 && pixel.x >= 0 && pixel.y >= 0 && pixel.x < cw && pixel.y < ch) {
            var idx = pixel.y * cw + pixel.x;
            if (drawMode === "image") { buf32[idx] = c; dirty.push(idx); }
            else {
              var grp = groups.get(c);
              if (grp === undefined) { grp = { hex: hexOf.get(c), idx: [] }; groups.set(c, grp); }
              if (grp.idx.length === 0) used.push(grp);
              grp.idx.push(idx);
            }
            hits++;
            return;
          }
        }
      }
      misses++;
      var o = origRenderer[name];
      if (o) o(pixel, ctx); else viewInfo[view].pixel(pixel, ctx);
    }
  }

  // --- install -----------------------------------------------------
  var wrapped = false;
  function wrapDraw() {
    if (wrapped) return; wrapped = true;
    var ds = window.drawSquare, dp = window.drawPlus;
    window.drawSquare = function (ctx) { if (dirty.length || used.length) flush(ctx); return ds.apply(this, arguments); };
    window.drawPlus = function (ctx) { if (dirty.length || used.length) flush(ctx); return dp.apply(this, arguments); };
  }
  function install() {
    NAMES.forEach(function (n) {
      var e = elements[n]; if (!e || fast[n]) return;
      origRenderer[n] = e.renderer;
      e.renderer = makeRenderer(n);
      fast[n] = true;
    });
    wrapDraw();
  }

  function installTicks() {
    var w = elements.rock_wall;
    if (w && !w.__perfTick) {
      var plainWall = Array.isArray(w.behavior) && w.behavior.every(function (row) {
        var cells = typeof row === "string" ? row.split("|") : row;
        return cells.every(function (c) { return c === "XX"; });
      }) && w.behaviorOn === undefined && w.tick === undefined;
      if (plainWall) {
        w.__perfTick = true;
        w.__origBehavior = w.behavior;
        w.behavior = undefined;
        w.tick = function (pixel) {
          if (pixel.start === pixelTicks) return;
          if (!on) { pixelTick(pixel, w.__origBehavior); return; }
          doAirDensity(pixel);
          doBurning(pixel);
          if (w.insulate !== true) doHeat(pixel);
          doElectricity(pixel);
          if (w.stain) doStaining(pixel);
        };
      }
    }
    var d = elements.dirt;
    if (d && !d.__perfTick && typeof d.behavior === "function" && d.tick === undefined && d.behavior === behaviors.POWDER) {
      // The game turns a function-behaviour into the element's tick a little later, so we swap the function here.
      d.__perfTick = true;
      var orig = d.behavior;
      var calm = function (e) { // element can neither react with nor be blocked by dirt/wall
        return e && e.onMoveInto === undefined && e.onCollide === undefined;
      };
      var support = function (x, y) { // true if tryMove into (x,y) is guaranteed to do nothing
        if (x < 0 || y < 0 || x > width || y > height) return true; // out of bounds -> returns false
        var p = pixelMap[x][y];
        if (p === undefined || p.del === true) return false;
        var el = p.element;
        if (el !== "dirt" && el !== "rock_wall") return false;
        return true;
      };
      d.behavior = function (pixel) {
        if (on && pixel.start !== pixelTicks && pixel.charge === undefined && pixel.drag !== true && pixel._r === undefined &&
            validateMovesList.length === 0 && d.reactions && d.reactions.dirt === undefined && d.reactions.rock_wall === undefined &&
            (elements.rock_wall.reactions === undefined || (elements.rock_wall.reactions.dirt === undefined)) &&
            calm(d) && calm(elements.rock_wall)) {
          var x = pixel.x, y = pixel.y;
          if (support(x, y + 1) && support(x + 1, y + 1) && support(x - 1, y + 1)) {
            doDefaults(pixel);
            return;
          }
        }
        return orig(pixel);
      };
    }
  }

  runAfterAutogen(function () { install(); installTicks(); });
  runAfterLoad(function () { install(); installTicks(); });
  runAfterReset(function () { discard(); });
  renderPrePixel(function () { discard(); });
  renderPostPixel(function (ctx) { flush(ctx); });

  // --- self tuning ---------------------------------------------------
  // Different browsers/GPUs draw differently fast, so the mod times its own drawing
  // methods once on your machine and keeps the fastest one (it never keeps a slower one
  // than the game's own drawing).
  function syncTime(f, n) {
    var cx = canvasLayers.pixels.getContext("2d");
    f(); cx.getImageData(0, 0, 1, 1);                  // warm up + wait for the GPU
    var s = performance.now();
    for (var i = 0; i < n; i++) { f(); cx.getImageData(0, 0, 1, 1); }
    return (performance.now() - s) / n;
  }
  var tuned = false, tuneResult = null;
  function tune() {
    var was = drawMode, res = {};
    ["batch", "image", "off"].forEach(function (m) {
      drawMode = m; res[m] = +Math.min(syncTime(function () { drawPixels(); }, 4), syncTime(function () { drawPixels(); }, 4)).toFixed(1);
    });
    var best = "off";
    ["batch", "image", "off"].forEach(function (m) { if (res[m] < res[best]) best = m; });
    drawMode = best; tuneResult = { draw_ms: res, chosen: best };
    console.log("[sandboxelsPerf] drawing methods (ms/frame): ", res, "-> using", best);
    return tuneResult;
  }
  var frameHits = 0;
  renderPrePixel(function () { frameHits = hits; });
  renderPostPixel(function () {
    if (!tuned && hits - frameHits > 2000) { tuned = true; setTimeout(function () { try { tune(); } catch (e) { guard(e, "tune"); } }, 400); }
  });

  window.sandboxelsPerf = {
    enable: function (v) { on = v !== false; return on; },
    isOn: function () { return on; },
    stats: function () { return { on: on, drawMode: drawMode, tuning: tuneResult, fastPixels: hits, fallbackPixels: misses, errors: errors, pixelSize: pixelSize, view: view }; },
    tune: tune,
    setDrawMode: function (m) { drawMode = m; return drawMode; },
    // Times the game with the mod on and off in YOUR browser (advances the simulation a few ticks).
    benchmark: function () {
      var was = on, out = {};
      function t(f, n) { return +syncTime(f, n).toFixed(1); }
      for (var round = 0; round < 2; round++) [true, false].forEach(function (m) {
        on = m;
        var key = m ? "mod_on" : "mod_off", d = t(function () { drawPixels(); }, 5), k = t(function () { tickPixels(); }, 3);
        if (!out[key] || d + k < out[key].draw_ms + out[key].tick_ms) out[key] = { draw_ms: d, tick_ms: k };
      });
      on = was; console.table(out); return out;
    },
  };
})();
