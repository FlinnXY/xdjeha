
/* ======================================================================
   HUMANITIZE 2 — UI / UX LAYER  (10_ui.js)
   A self-contained, mobile-friendly interface: an inspector tool & card,
   a HUD bar, a faction dashboard, a chronicle feed, a settings panel and
   a help/overview panel. Everything is namespaced under .h2- and H2.ui.*,
   guarded with try/catch, and degrades gracefully in headless jsdom.
   Original Humanitize by nekonico; this is Humanitize 2.
   ====================================================================== */
(function () {
  "use strict";
  var w = window;
  var H2 = w.H2;
  if (!H2) return;
  if (H2.ui) return;                      // never double-init

  /* ---------------------------------------------------------------- utils */
  var UI_DAY = 2400;                      // ticks per in-game day (mirrors core)
  function tks() { return (typeof w.pixelTicks === "number") ? w.pixelTicks : 0; }
  function dayNum() { return Math.floor(tks() / UI_DAY) + 1; }
  function dayFrac() { return (tks() % UI_DAY) / UI_DAY; }
  function FAC() { return H2.FAC || []; }
  function facOf(i) { var f = FAC(); return f[i] || { name: "?", adj: "?", flag: "#888", dark: "#555" }; }
  function clampN(v, a, b) { v = +v; if (isNaN(v)) v = a; return v < a ? a : v > b ? b : v; }
  function nmOf(p) { try { return H2.nm ? H2.nm(p) : (p && p.name) || "Someone"; } catch (e) { return "Someone"; } }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function titleCase(s) { s = String(s || "").replace(/_/g, " "); return s.replace(/\b\w/g, function (m) { return m.toUpperCase(); }); }
  function has(o) { return o !== undefined && o !== null; }
  function round(n) { return Math.round(+n || 0); }

  /* resolve selected person live from byId, falling back to last object */
  function resolveSel() {
    var id = UI.selId;
    if (id == null) return null;
    var live = (H2.byId && H2.byId[id]) || null;
    if (live && !live.del) return live;
    return (UI.selObj && !UI.selObj.del) ? UI.selObj : null;
  }

  /* ------------------------------------------------------------- namespace */
  var UI = H2.ui = {
    selId: null, selObj: null,
    panels: {},                 // name -> {panel, body, ...}
    hist: [[], []],             // population history per faction (for sparkline)
    _built: false, _style: false,
    _lastChron: 0,
  };

  /* --------------------------------------------------------------- styles */
  var CSS = [
    ".h2-root{position:fixed;inset:0;pointer-events:none;z-index:2147483000;font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;color:#e8edf2;}",
    ".h2-root *{box-sizing:border-box;}",
    ".h2-panel{position:absolute;pointer-events:auto;background:rgba(18,22,30,0.93);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:1px solid rgba(120,140,170,0.28);border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,0.5);max-height:80vh;display:flex;flex-direction:column;overflow:hidden;min-width:220px;}",
    ".h2-head{display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:grab;background:linear-gradient(180deg,rgba(40,48,64,0.8),rgba(26,32,44,0.6));border-bottom:1px solid rgba(120,140,170,0.22);user-select:none;flex:0 0 auto;}",
    ".h2-head:active{cursor:grabbing;}",
    ".h2-title{font-weight:600;font-size:13px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.2px;}",
    ".h2-x,.h2-btn{pointer-events:auto;cursor:pointer;background:rgba(80,92,120,0.35);color:#e8edf2;border:1px solid rgba(140,160,190,0.3);border-radius:7px;padding:5px 9px;font-size:12px;line-height:1;transition:background .12s;}",
    ".h2-x{padding:5px 8px;font-size:13px;}",
    ".h2-btn:hover,.h2-x:hover{background:rgba(110,130,170,0.55);}",
    ".h2-btn.on{background:rgba(70,130,220,0.65);border-color:rgba(120,170,240,.6);}",
    ".h2-body{padding:10px;overflow:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;flex:1 1 auto;}",
    ".h2-sec{margin:0 0 9px;}",
    ".h2-h{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#8ea2bf;margin:0 0 4px;font-weight:600;}",
    ".h2-row{display:flex;flex-wrap:wrap;gap:4px 10px;}",
    ".h2-kv{display:flex;gap:6px;}.h2-kv b{color:#aab8cc;font-weight:500;}",
    ".h2-dot{width:10px;height:10px;border-radius:50%;flex:0 0 auto;box-shadow:0 0 0 1px rgba(0,0,0,.4);}",
    ".h2-chip{display:inline-block;background:rgba(90,105,135,0.4);border:1px solid rgba(140,160,190,0.25);border-radius:20px;padding:2px 9px;font-size:11px;margin:2px 3px 0 0;}",
    ".h2-bar{position:relative;height:13px;background:rgba(70,80,100,0.45);border-radius:7px;overflow:hidden;margin:3px 0;}",
    ".h2-bar>i{position:absolute;inset:0 auto 0 0;border-radius:7px;transition:width .25s;}",
    ".h2-bar>span{position:absolute;inset:0;font-size:10px;line-height:13px;text-align:center;color:#fff;text-shadow:0 1px 1px rgba(0,0,0,.7);}",
    ".h2-barlab{display:flex;justify-content:space-between;font-size:11px;color:#9fb0c7;margin-top:4px;}",
    ".h2-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:4px;}",
    ".h2-gcell{background:rgba(60,70,92,0.4);border-radius:6px;padding:4px 6px;font-size:11px;}",
    ".h2-gcell b{display:block;color:#aab8cc;font-weight:500;font-size:10px;}",
    ".h2-link{color:#79b0ff;cursor:pointer;text-decoration:none;border-bottom:1px dotted rgba(121,176,255,.5);}",
    ".h2-link:hover{color:#a9ccff;}",
    ".h2-life{list-style:none;margin:0;padding:0;max-height:200px;overflow:auto;}",
    ".h2-life li{display:flex;gap:7px;padding:4px 2px;border-bottom:1px solid rgba(120,140,170,0.12);font-size:12px;}",
    ".h2-life .d{color:#7f93b0;flex:0 0 auto;min-width:46px;font-size:11px;}",
    ".h2-life .ic{flex:0 0 auto;}",
    ".h2-life li.big{background:rgba(70,110,200,0.12);border-radius:5px;}",
    ".h2-dead{color:#ff8a8a;font-weight:600;}",
    ".h2-hud{left:50%;transform:translateX(-50%);top:8px;flex-direction:row;align-items:center;gap:6px;padding:6px 8px;min-width:0;max-width:96vw;flex-wrap:wrap;}",
    ".h2-hud .h2-seg{display:flex;align-items:center;gap:5px;padding:2px 8px;border-right:1px solid rgba(120,140,170,0.2);font-size:12px;white-space:nowrap;}",
    ".h2-hud .h2-seg:last-child{border-right:0;}",
    ".h2-spark{display:block;width:100%;height:30px;background:rgba(60,70,92,0.35);border-radius:6px;}",
    ".h2-filter{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;}",
    ".h2-chron{list-style:none;margin:0;padding:0;}",
    ".h2-chron li{padding:5px 4px;border-bottom:1px solid rgba(120,140,170,0.12);font-size:12px;line-height:1.35;}",
    ".h2-chron li.maj{font-weight:600;}",
    ".h2-chron .d{color:#7f93b0;font-size:11px;margin-right:5px;}",
    ".h2-set{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid rgba(120,140,170,0.1);}",
    ".h2-set label{font-size:12px;}",
    ".h2-set input[type=number]{width:72px;}",
    ".h2-set select,.h2-set input{background:rgba(40,48,64,0.9);color:#e8edf2;border:1px solid rgba(140,160,190,0.3);border-radius:6px;padding:4px 6px;font-size:12px;}",
    ".h2-sw{position:relative;width:40px;height:22px;background:rgba(80,92,120,0.5);border-radius:20px;cursor:pointer;flex:0 0 auto;transition:background .15s;}",
    ".h2-sw::after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#dfe6ef;transition:left .15s;}",
    ".h2-sw.on{background:rgba(70,130,220,0.8);}.h2-sw.on::after{left:20px;}",
    ".h2-help p{margin:0 0 8px;line-height:1.45;font-size:12px;}",
    ".h2-help h4{margin:12px 0 4px;color:#9fc0ff;font-size:12px;}",
    ".h2-help code{background:rgba(70,90,130,.4);padding:1px 5px;border-radius:4px;font-size:11px;}",
    ".h2-help ul{margin:0 0 8px;padding-left:18px;}.h2-help li{margin:2px 0;font-size:12px;line-height:1.4;}",
    ".h2-muted{color:#8296ae;font-size:11px;}",
    "@media (max-width:700px){",
    "  .h2-panel:not(.h2-hud){left:0!important;right:0!important;top:auto!important;bottom:0!important;transform:none!important;width:100%!important;max-width:100%!important;border-radius:14px 14px 0 0;max-height:72vh;}",
    "  .h2-hud{top:4px;font-size:11px;padding:5px 6px;}",
    "  .h2-x,.h2-btn{padding:8px 11px;font-size:13px;}",
    "}",
  ].join("\n");

  function injectStyle() {
    if (UI._style) return;
    try {
      var d = w.document; if (!d || !d.head) return;
      var s = d.createElement("style"); s.id = "h2-style"; s.textContent = CSS;
      d.head.appendChild(s); UI._style = true;
    } catch (e) {}
  }

  /* --------------------------------------------------------- dom helpers */
  var root = null;
  function makeRoot() {
    var d = w.document;
    root = d.getElementById("h2-root");
    if (!root) { root = d.createElement("div"); root.id = "h2-root"; root.className = "h2-root"; d.body.appendChild(root); }
    return root;
  }
  function elem(tag, cls, html) {
    var e = w.document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function makeDraggable(panel, handle) {
    try {
      var sx, sy, ox, oy, drag = false;
      function down(e) {
        if (w.innerWidth <= 700) return;           // bottom-sheet on mobile
        if (e.target && e.target.classList && e.target.classList.contains("h2-x")) return;
        drag = true;
        var pt = e.touches ? e.touches[0] : e;
        var r = panel.getBoundingClientRect();
        panel.style.transform = "none"; panel.style.left = r.left + "px"; panel.style.top = r.top + "px";
        panel.style.right = "auto"; panel.style.bottom = "auto";
        sx = pt.clientX; sy = pt.clientY; ox = r.left; oy = r.top;
        e.preventDefault();
      }
      function move(e) {
        if (!drag) return;
        var pt = e.touches ? e.touches[0] : e;
        var nx = clampN(ox + pt.clientX - sx, 0, w.innerWidth - 60);
        var ny = clampN(oy + pt.clientY - sy, 0, w.innerHeight - 30);
        panel.style.left = nx + "px"; panel.style.top = ny + "px";
      }
      function up() { drag = false; }
      handle.addEventListener("mousedown", down); w.addEventListener("mousemove", move); w.addEventListener("mouseup", up);
      handle.addEventListener("touchstart", down, { passive: false }); w.addEventListener("touchmove", move, { passive: false }); w.addEventListener("touchend", up);
    } catch (e) {}
  }
  function makePanel(name, title, pos) {
    var p = elem("div", "h2-panel"); p.id = "h2-" + name; p.style.display = "none";
    if (pos) for (var k in pos) p.style[k] = pos[k];
    var head = elem("div", "h2-head");
    var t = elem("span", "h2-title"); t.textContent = title;
    var x = elem("button", "h2-x"); x.textContent = "✕"; x.title = "Close";
    x.onclick = function () { UI.close(name); };
    head.appendChild(t); head.appendChild(x);
    var body = elem("div", "h2-body");
    p.appendChild(head); p.appendChild(body);
    makeDraggable(p, head);
    root.appendChild(p);
    var rec = { panel: p, body: body, title: t, head: head, name: name };
    UI.panels[name] = rec;
    return rec;
  }

  /* bar widget */
  function bar(label, val, max, color) {
    val = +val || 0; max = max || 100;
    var pct = clampN((val / max) * 100, 0, 100);
    return '<div class="h2-barlab"><span>' + esc(label) + '</span><span>' + round(val) + '</span></div>' +
      '<div class="h2-bar"><i style="width:' + pct + '%;background:' + color + '"></i></div>';
  }

  /* ========================================================= SELECTION */
  function personFromPixel(px) {
    if (!px) return null;
    var el = px.element;
    if (el === "hz_body" || el === "hz_child") return (px.id !== undefined) ? px : null;
    if (el === "hz_head") {
      var col = w.pixelMap && w.pixelMap[px.x]; var b = col && col[px.y + 1];
      return (b && (b.element === "hz_body" || b.element === "hz_child") && b.id !== undefined) ? b : null;
    }
    return null;
  }
  function personNear(x, y, r) {
    r = r || 2;
    var best = null, bd = 1e9;
    if (!w.pixelMap) return null;
    for (var dx = -r; dx <= r; dx++) for (var dy = -r; dy <= r; dy++) {
      var xx = x + dx, yy = y + dy;
      var colm = w.pixelMap[xx]; if (!colm) continue;
      var o = colm[yy]; if (!o) continue;
      var p = personFromPixel(o); if (!p) continue;
      var d = Math.abs(dx) + Math.abs(dy); if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  function buildingAt(x, y, r) {
    r = r || 1;
    if (!w.pixelMap) return null;
    for (var rr = 0; rr <= r; rr++) for (var dx = -rr; dx <= rr; dx++) for (var dy = -rr; dy <= rr; dy++) {
      var colm = w.pixelMap[x + dx]; if (!colm) continue;
      var o = colm[y + dy]; if (!o) continue;
      var info = w.elements && w.elements[o.element];
      if (info && info.st) return o;
    }
    return null;
  }

  UI.select = function (p) {
    try {
      ensureInit();
      if (typeof p === "number") p = (H2.byId && H2.byId[p]) || null;
      if (!p || p.id === undefined) return false;
      UI.selId = p.id; UI.selObj = p;
      UI.open("inspector");
      renderInspector();
      return true;
    } catch (e) { return false; }
  };
  UI.deselect = function () { UI.selId = null; UI.selObj = null; };
  UI.selectAt = function (x, y) {
    var p = personNear(x, y, 2);
    if (p) return UI.select(p);
    var b = buildingAt(x, y, 1);
    if (b) { showBuildingCard(b); return true; }
    return false;
  };
  // called by the inspector tool
  UI.pickAt = function (pixel) {
    try {
      ensureInit();
      if (!pixel) return;
      var p = personFromPixel(pixel) || personNear(pixel.x, pixel.y, 2);
      if (p) { UI.select(p); return; }
      var info = w.elements && w.elements[pixel.element];
      if (info && info.st) { showBuildingCard(pixel); return; }
      var b = buildingAt(pixel.x, pixel.y, 1);
      if (b) showBuildingCard(b);
    } catch (e) {}
  };

  function showBuildingCard(px) {
    try {
      ensureInit();
      var info = w.elements && w.elements[px.element] || {};
      var owner = null;
      if (px.cid !== undefined && H2.colById) owner = H2.colById(px.cid);
      if (!owner && H2.nearestOf && H2.cols) owner = H2.nearestOf(H2.cols, px.x, px.y, 160);
      var name = titleCase(info.name || px.element.replace(/^hz_/, ""));
      var rec = UI.panels.inspector; if (!rec) return;
      UI.selId = null; UI.selObj = null;
      rec.title.textContent = "🏠 " + name;
      var html = '<div class="h2-sec"><div class="h2-row">' +
        '<span class="h2-kv"><b>Type</b> ' + esc(info.st || "structure") + '</span></div></div>';
      if (owner) {
        html += '<div class="h2-sec"><div class="h2-h">Settlement</div>' +
          '<div class="h2-kv"><b>' + esc(owner.name) + '</b> · ' + esc(facOf(owner.fac).name) + '</div>' +
          '<div class="h2-muted">pop ' + (owner.pop || 0) + ' · founded day ' + (Math.floor((owner.founded || 0) / UI_DAY) + 1) + '</div></div>';
      }
      html += '<div class="h2-muted">Tap a villager to inspect them.</div>';
      rec.body.innerHTML = html;
      UI.open("inspector");
    } catch (e) {}
  }

  /* ========================================================= INSPECTOR */
  var LIFE_ICON = { birth: "👶", elected: "👑", hero: "⚔️", death: "🕊️", found: "🏗️", marry: "💍", child: "🍼", war: "🔥", job: "🛠️", heal: "➕", kill: "🗡️", trade: "💰", move: "🧭" };
  var THOUGHT = { widowed: "💔 Grieving a lost spouse", grief: "😢 Mourning", killed: "😟 Took a life", victory: "😤 Tasted victory", protest: "✊ Discontent", hungry: "🍖 Hungry", tired: "😴 Exhausted", cold: "🥶 Freezing", sick: "🤒 Feeling ill", lonely: "🙍 Lonely", happy: "😊 Content" };

  function thoughtText(t) {
    var base = THOUGHT[t.k] || ("💭 " + titleCase(t.k));
    return base;
  }

  function personLink(id) {
    var q = H2.byId && H2.byId[id];
    var label = q ? nmOf(q) : ("#" + id);
    return '<span class="h2-link" data-pid="' + id + '">' + esc(label) + '</span>';
  }

  function renderInspector() {
    var rec = UI.panels.inspector; if (!rec) return;
    var p = resolveSel();
    if (!p) { rec.title.textContent = "Inspector"; rec.body.innerHTML = '<div class="h2-muted">Select the <b>Inspect</b> tool and tap a villager.</div>'; return; }
    var F = facOf(p.fac);
    var stage = (H2.stageOf && H2.stageOf(p)) || "adult";
    var ageDays = Math.floor(((H2.ageOf && H2.ageOf(p)) || 0) / UI_DAY);
    var col = (p.col && H2.colById) ? H2.colById(p.col) : null;

    rec.title.innerHTML = '<span class="h2-dot" style="display:inline-block;background:' + F.flag + '"></span> ' + esc(nmOf(p));

    var h = "";
    // identity
    h += '<div class="h2-sec"><div class="h2-row">';
    h += '<span class="h2-kv"><b>' + esc(F.name) + '</b></span>';
    h += '<span class="h2-kv"><b>Age</b> ' + ageDays + 'd · ' + esc(stage) + '</span>';
    h += '<span class="h2-kv"><b>Job</b> ' + esc(p.dead ? "—" : (p.job || "—")) + '</span>';
    h += '<span class="h2-kv"><b>Sex</b> ' + (p.sex === "f" ? "♀" : "♂") + '</span>';
    h += '</div>';
    if (p.dead) h += '<div class="h2-dead">† Deceased — ' + esc(p.cause || "unknown causes") + '</div>';
    h += '</div>';

    // rank / medals
    if (has(p.rank) || (p.medals && p.medals.length) || p.title) {
      h += '<div class="h2-sec"><div class="h2-h">Honours</div><div class="h2-row">';
      if (p.title) h += '<span class="h2-chip">' + esc(p.title) + '</span>';
      if (has(p.rank)) { var rn = (typeof H2.rankName === "function") ? H2.rankName(p) : null; h += '<span class="h2-chip">⭐ ' + esc(rn || ("Rank " + p.rank)) + '</span>'; }
      if (has(p.xp)) h += '<span class="h2-chip">XP ' + round(p.xp) + '</span>';
      if (p.party) h += '<span class="h2-chip">🏛️ Councillor</span>';
      if (p.ruler) h += '<span class="h2-chip">👑 Ruler</span>';
      if (p.medals) for (var mi = 0; mi < p.medals.length; mi++) h += '<span class="h2-chip">🎖️ ' + esc(p.medals[mi]) + '</span>';
      h += '</div></div>';
    }

    // vitals
    if (!p.dead) {
      h += '<div class="h2-sec"><div class="h2-h">Condition</div>';
      h += bar("Health", p.hp, 100, "linear-gradient(90deg,#e04848,#49d17a)");
      h += bar("Blood", p.bl, 100, "#d6453f");
      h += bar("Hunger", p.hu, 100, "#e0a23c");
      h += bar("Thirst", p.th, 100, "#3cb6e0");
      h += bar("Energy", p.en, 100, "#9b6cf0");
      h += bar("Mood", p.mo, 100, "linear-gradient(90deg,#8a6bd1,#49d17a)");
      var bt = has(p.bt) ? round(p.bt) : 37;
      var btc = (bt > 39 || bt < 35) ? "#ff8a8a" : "#9fb0c7";
      h += '<div class="h2-barlab"><span>Body temp</span><span style="color:' + btc + '">' + bt + '°C</span></div>';
      if (p.sick) h += '<div class="h2-chip" style="background:rgba(180,80,80,.35)">🤒 ' + esc(titleCase(p.sick.k || "ill")) + '</div>';
      if (p.bleed > 0.2) h += '<div class="h2-chip" style="background:rgba(180,60,60,.35)">🩸 Bleeding</div>';
      if (p.sleeping) h += '<div class="h2-chip">😴 Asleep</div>';
      h += '</div>';
    }

    // traits
    if (p.tr && p.tr.length) {
      h += '<div class="h2-sec"><div class="h2-h">Traits</div><div class="h2-row">';
      for (var ti = 0; ti < p.tr.length; ti++) { var tk = p.tr[ti]; var nm2 = (w.TRAITS && w.TRAITS[tk] && w.TRAITS[tk].c) || tk; h += '<span class="h2-chip">' + esc(nm2) + '</span>'; }
      h += '</div></div>';
    }

    // skills
    if (p.sk) {
      var sk = p.sk, skKeys = Object.keys(sk), any = false;
      for (var si = 0; si < skKeys.length; si++) if (sk[skKeys[si]] > 0.05) any = true;
      if (any) {
        h += '<div class="h2-sec"><div class="h2-h">Skills</div><div class="h2-grid">';
        for (var sj = 0; sj < skKeys.length; sj++) { var v = sk[skKeys[sj]]; if (v > 0.05) h += '<div class="h2-gcell"><b>' + esc(titleCase(skKeys[sj])) + '</b>' + v.toFixed(1) + '</div>'; }
        h += '</div></div>';
      }
    }

    // inventory & coin
    var invKeys = p.inv ? Object.keys(p.inv).filter(function (k) { return p.inv[k] > 0; }) : [];
    h += '<div class="h2-sec"><div class="h2-h">Belongings</div><div class="h2-row">';
    h += '<span class="h2-kv"><b>Coin</b> 🪙 ' + round(p.coin || 0) + '</span>';
    if (p.wpn) h += '<span class="h2-chip">🗡️ ' + esc(titleCase(p.wpn)) + '</span>';
    if (p.arm) h += '<span class="h2-chip">🛡️ armor ' + round(p.arm) + '</span>';
    h += '</div>';
    if (invKeys.length) { h += '<div class="h2-row" style="margin-top:4px">'; for (var ii = 0; ii < invKeys.length; ii++) h += '<span class="h2-chip">' + esc(titleCase(invKeys[ii])) + ' ×' + round(p.inv[invKeys[ii]]) + '</span>'; h += '</div>'; }
    h += '</div>';

    // family
    var famParts = [];
    if (p.sp) famParts.push('<span class="h2-kv"><b>Spouse</b> ' + personLink(p.sp) + '</span>');
    var pars = (p.par || []).filter(function (x) { return x; });
    if (pars.length) famParts.push('<span class="h2-kv"><b>Parents</b> ' + pars.map(personLink).join(", ") + '</span>');
    if (p.kids && p.kids.length) famParts.push('<span class="h2-kv"><b>Children</b> ' + p.kids.map(personLink).join(", ") + '</span>');
    if (famParts.length) h += '<div class="h2-sec"><div class="h2-h">Family</div><div class="h2-row">' + famParts.join("") + '</div></div>';

    // friends / rivals
    if (p.fr) {
      var friends = [], rivals = [];
      for (var fid in p.fr) { var val = p.fr[fid]; if (val >= 25) friends.push(fid); else if (val <= -25) rivals.push(fid); }
      if (friends.length || rivals.length) {
        h += '<div class="h2-sec"><div class="h2-h">Relations</div><div class="h2-row">';
        if (friends.length) h += '<span class="h2-kv"><b>Friends</b> ' + friends.slice(0, 5).map(personLink).join(", ") + '</span>';
        if (rivals.length) h += '<span class="h2-kv"><b>Rivals</b> ' + rivals.slice(0, 5).map(personLink).join(", ") + '</span>';
        h += '</div></div>';
      }
    }

    // task + thoughts + kills + settlement
    h += '<div class="h2-sec"><div class="h2-h">Mind</div>';
    if (!p.dead && p.task && p.task.k) h += '<div class="h2-kv"><b>Doing</b> ' + esc(titleCase(p.task.k)) + '</div>';
    var now = tks();
    var liveTh = (p.th2 || []).filter(function (t) { return t.e > now; });
    if (liveTh.length) { h += '<div class="h2-row" style="margin-top:4px">'; for (var thi = liveTh.length - 1; thi >= 0 && thi >= liveTh.length - 6; thi--) h += '<span class="h2-chip">' + esc(thoughtText(liveTh[thi])) + '</span>'; h += '</div>'; }
    h += '<div class="h2-row" style="margin-top:4px">';
    if (p.kills) h += '<span class="h2-kv"><b>Kills</b> ' + p.kills + '</span>';
    if (col) h += '<span class="h2-kv"><b>Home</b> ' + esc(col.name) + '</span>';
    h += '</div></div>';

    // life story timeline
    h += '<div class="h2-sec"><div class="h2-h">Life story</div>';
    if (p.life && p.life.length) {
      h += '<ul class="h2-life">';
      for (var li = p.life.length - 1; li >= 0; li--) {
        var ev = p.life[li];
        var ic = LIFE_ICON[ev.k] || "•";
        h += '<li' + (ev.big ? ' class="big"' : '') + '><span class="d">Day ' + (ev.day || Math.floor((ev.t || 0) / UI_DAY) + 1) + '</span><span class="ic">' + ic + '</span><span>' + esc(ev.text) + '</span></li>';
      }
      h += '</ul>';
    } else {
      h += '<div class="h2-muted">No notable events recorded yet.</div>';
    }
    h += '</div>';

    rec.body.innerHTML = h;
  }

  /* ============================================================== HUD */
  function timeIcon() {
    var f = dayFrac();
    if (f < 0.06 || f > 0.80) return "🌙";
    if (f < 0.14) return "🌅";
    if (f > 0.62) return "🌇";
    return "☀️";
  }
  function renderHud() {
    var rec = UI.panels.hud; if (!rec) return;
    var fp = H2.facPop || {};
    var cols = H2.cols || [];
    var h = '<div class="h2-seg"><b>Day ' + dayNum() + '</b> ' + timeIcon() + '</div>';
    var F = FAC();
    for (var i = 0; i < F.length; i++) {
      var nSet = 0; for (var ci = 0; ci < cols.length; ci++) if (cols[ci].fac === i) nSet++;
      h += '<div class="h2-seg"><span class="h2-dot" style="background:' + F[i].flag + '"></span>' +
        '<span>' + esc(F[i].name) + ' ' + (fp[i] || 0) + '👤 ' + nSet + '🏰</span></div>';
    }
    h += '<div class="h2-seg">' + warSummary() + '</div>';
    h += '<div class="h2-seg" style="border:0;gap:4px">' +
      '<button class="h2-btn" data-open="dashboard" title="Factions">🏰</button>' +
      '<button class="h2-btn" data-open="chronicle" title="Chronicle">📜</button>' +
      '<button class="h2-btn" data-open="settings" title="Settings">⚙️</button>' +
      '<button class="h2-btn" data-open="help" title="Help">❓</button></div>';
    rec.body.innerHTML = h;
  }
  function warSummary() {
    var cols = H2.cols || [], state = "peace";
    var order = { peace: 0, wary: 1, fortify: 2, prepare: 3, war: 4, siege: 5 };
    for (var i = 0; i < cols.length; i++) { var s = cols[i].war && cols[i].war.state; if (s && (order[s] || 0) > (order[state] || 0)) state = s; }
    var icon = state === "peace" ? "🕊️" : (state === "war" || state === "siege") ? "⚔️" : "🛡️";
    var color = state === "peace" ? "#7fd18a" : (state === "war" || state === "siege") ? "#ff8a8a" : "#e0c060";
    return icon + ' <span style="color:' + color + '">' + esc(titleCase(state)) + '</span>';
  }

  /* ========================================================= DASHBOARD */
  function sparkline(arr, color) {
    if (!arr || arr.length < 2) return '<div class="h2-muted">gathering data…</div>';
    var wds = 220, hgt = 30, max = 1;
    for (var i = 0; i < arr.length; i++) if (arr[i] > max) max = arr[i];
    var step = wds / (arr.length - 1), pts = "";
    for (var j = 0; j < arr.length; j++) { var x = (j * step).toFixed(1); var y = (hgt - (arr[j] / max) * (hgt - 3) - 1).toFixed(1); pts += x + "," + y + " "; }
    return '<svg class="h2-spark" viewBox="0 0 ' + wds + ' ' + hgt + '" preserveAspectRatio="none">' +
      '<polyline fill="none" stroke="' + color + '" stroke-width="1.5" points="' + esc(pts) + '"/></svg>';
  }
  function renderDashboard() {
    var rec = UI.panels.dashboard; if (!rec) return;
    var F = FAC(), cols = H2.cols || [], fp = H2.facPop || {};
    var h = "";
    for (var i = 0; i < F.length; i++) {
      var fcols = cols.filter(function (c) { return c.fac === i; });
      h += '<div class="h2-sec"><div class="h2-h"><span class="h2-dot" style="display:inline-block;background:' + F[i].flag + '"></span> ' + esc(F[i].name) + ' — ' + (fp[i] || 0) + ' people, ' + fcols.length + ' settlement' + (fcols.length === 1 ? "" : "s") + '</div>';
      h += sparkline(UI.hist[i], F[i].flag);
      for (var ci = 0; ci < fcols.length; ci++) h += settlementCard(fcols[ci]);
      if (!fcols.length) h += '<div class="h2-muted">No settlements.</div>';
      h += '</div>';
    }
    rec.body.innerHTML = h;
  }
  function settlementCard(c) {
    var h = '<div style="background:rgba(60,70,92,0.3);border-radius:8px;padding:8px;margin:6px 0">';
    h += '<div style="font-weight:600;margin-bottom:3px">' + esc(c.name) + ' <span class="h2-muted">· founded day ' + (Math.floor((c.founded || 0) / UI_DAY) + 1) + '</span></div>';
    h += '<div class="h2-row">';
    h += '<span class="h2-kv"><b>Pop</b> ' + (c.pop || 0) + ' (' + (c.adults || 0) + '🧑 ' + (c.kids || 0) + '🧒)</span>';
    h += '<span class="h2-kv"><b>Beds</b> ' + (c.beds || 0) + '</span>';
    h += '<span class="h2-kv"><b>Soldiers</b> ' + (c.sold || 0) + '</span>';
    if (has(c.tax)) h += '<span class="h2-kv"><b>Tax</b> ' + round((c.tax || 0) * 100) + '%</span>';
    h += '</div>';
    // leader / marshal (guarded — may be added by other devs)
    var lead = c.leader && H2.byId ? H2.byId[c.leader] : null;
    var marsh = c.marshal && H2.byId ? H2.byId[c.marshal] : null;
    if (lead || marsh || c.hero || c.founder) {
      h += '<div class="h2-row" style="margin-top:3px">';
      if (lead) h += '<span class="h2-kv"><b>' + esc(c.leaderTitle || "Leader") + '</b> ' + personLink(c.leader) + '</span>';
      if (marsh) h += '<span class="h2-kv"><b>Marshal</b> ' + personLink(c.marshal) + '</span>';
      if (c.hero) h += '<span class="h2-kv"><b>Hero</b> ' + esc(c.hero) + '</span>';
      else if (c.founder) h += '<span class="h2-kv"><b>Founder</b> ' + esc(c.founder) + '</span>';
      h += '</div>';
    }
    // war
    var wst = c.war && c.war.state || "peace";
    h += '<div class="h2-row" style="margin-top:3px"><span class="h2-kv"><b>War</b> ' + esc(titleCase(wst)) + '</span>';
    if (has(c.tensionPts) || has(c.tension)) h += '<span class="h2-kv"><b>Tension</b> ' + round(c.tensionPts != null ? c.tensionPts : c.tension) + '</span>';
    h += '<span class="h2-kv"><b>Born</b> ' + (c.births || 0) + '</span><span class="h2-kv"><b>Died</b> ' + (c.deaths || 0) + '</span></div>';
    // army (guarded)
    if (c.army) {
      h += '<div class="h2-row" style="margin-top:3px">';
      if (c.army.strategy) h += '<span class="h2-kv"><b>Strategy</b> ' + esc(titleCase(c.army.strategy)) + '</span>';
      if (has(c.army.morale)) h += '<span class="h2-kv"><b>Morale</b> ' + round(c.army.morale) + '</span>';
      if (c.army.squads) h += '<span class="h2-kv"><b>Squads</b> ' + c.army.squads.length + '</span>';
      h += '</div>';
      if (c.army.squads && c.army.squads.length) {
        h += '<div class="h2-row" style="margin-top:2px">';
        for (var sq = 0; sq < c.army.squads.length; sq++) { var s = c.army.squads[sq]; h += '<span class="h2-chip">' + esc(s.name || ("Squad " + (sq + 1))) + (s.members ? " ×" + s.members.length : "") + (s.role ? " · " + esc(s.role) : "") + '</span>'; }
        h += '</div>';
      }
    }
    // jobs
    var jobs = c.jobs || {}, jk = Object.keys(jobs);
    if (jk.length) { h += '<div class="h2-row" style="margin-top:3px">'; for (var ji = 0; ji < jk.length; ji++) h += '<span class="h2-chip">' + esc(titleCase(jk[ji])) + ' ' + jobs[jk[ji]] + '</span>'; h += '</div>'; }
    // stock
    var st = c.stock || {}, stk = Object.keys(st).filter(function (k) { return st[k] > 0; });
    if (stk.length) { h += '<div class="h2-h" style="margin-top:6px">Stores</div><div class="h2-row">'; for (var ki = 0; ki < stk.length; ki++) h += '<span class="h2-chip">' + esc(titleCase(stk[ki])) + ' ' + round(st[stk[ki]]) + '</span>'; h += '</div>'; }
    // buildings
    var built = c.built || {}, bk = Object.keys(built).filter(function (k) { return built[k] > 0; });
    if (bk.length) { h += '<div class="h2-h" style="margin-top:6px">Buildings</div><div class="h2-row">'; for (var bi = 0; bi < bk.length; bi++) h += '<span class="h2-chip">' + esc(titleCase(bk[bi])) + ' ' + built[bk[bi]] + '</span>'; h += '</div>'; }
    if (c.famine) h += '<div class="h2-chip" style="background:rgba(180,120,40,.35)">🌾 Famine</div>';
    if (c.riot) h += '<div class="h2-chip" style="background:rgba(180,60,60,.35)">🔥 Unrest</div>';
    h += '</div>';
    return h;
  }

  /* ========================================================= CHRONICLE */
  UI.chronFilter = -1;   // -1 = all, else faction id
  UI.chronMajor = false;
  function renderChronicle() {
    var rec = UI.panels.chronicle; if (!rec) return;
    var F = FAC();
    var chron = H2.chron || [];
    var head = rec._filter;
    if (!head) {
      head = rec._filter = elem("div", "h2-filter");
      rec.body.appendChild(head);
      rec._list = elem("ul", "h2-chron"); rec.body.appendChild(rec._list);
    }
    // (re)build filter buttons
    var fh = '<button class="h2-btn' + (UI.chronFilter === -1 ? " on" : "") + '" data-cf="-1">All</button>';
    for (var i = 0; i < F.length; i++) fh += '<button class="h2-btn' + (UI.chronFilter === i ? " on" : "") + '" data-cf="' + i + '">' + esc(F[i].name) + '</button>';
    fh += '<button class="h2-btn' + (UI.chronMajor ? " on" : "") + '" data-cmaj="1">Major only</button>';
    head.innerHTML = fh;
    var out = "";
    var shown = 0;
    for (var j = chron.length - 1; j >= 0 && shown < 120; j--) {
      var e = chron[j];
      if (UI.chronMajor && !e.major) continue;
      if (UI.chronFilter !== -1 && e.fac !== UI.chronFilter && e.fac !== -1) continue;
      var dot = e.fac >= 0 ? '<span class="h2-dot" style="display:inline-block;width:7px;height:7px;background:' + facOf(e.fac).flag + '"></span> ' : "";
      out += '<li class="' + (e.major ? "maj" : "") + '"><span class="d">Day ' + e.day + '</span>' + dot + esc(e.text) + '</li>';
      shown++;
    }
    if (!out) out = '<li class="h2-muted">No chronicle entries yet.</li>';
    rec._list.innerHTML = out;
  }
  // throttled refresh hook (core calls H2.refreshChronicle on every new entry)
  H2.refreshChronicle = function () {
    try {
      if (!UI.panels.chronicle || UI.panels.chronicle.panel.style.display === "none") return;
      var now = Date.now();
      if (now - UI._lastChron < 400) return;
      UI._lastChron = now;
      renderChronicle();
    } catch (e) {}
  };

  /* ========================================================== SETTINGS */
  var SKEY = "H2.settings";
  function loadSettings() {
    try {
      var raw = w.localStorage && w.localStorage.getItem(SKEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === "object") for (var k in o) H2.cfg[k] = o[k];
      }
    } catch (e) {}
    if (H2.cfg.names === undefined) H2.cfg.names = "hover";
    if (H2.cfg.outline === undefined) H2.cfg.outline = true;
    syncNameMode();
  }
  function saveSettings() {
    try {
      var keep = ["events", "birth", "war", "expand", "verbose", "maxPerFaction", "townSize", "names", "outline"];
      var o = {}; for (var i = 0; i < keep.length; i++) o[keep[i]] = H2.cfg[keep[i]];
      w.localStorage && w.localStorage.setItem(SKEY, JSON.stringify(o));
    } catch (e) {}
  }
  function syncNameMode() { H2.cfg.nameMode = (H2.cfg.names === "off") ? "off" : H2.cfg.names; }

  function toggleRow(label, key) {
    return '<div class="h2-set"><label>' + esc(label) + '</label><div class="h2-sw' + (H2.cfg[key] ? " on" : "") + '" data-toggle="' + key + '"></div></div>';
  }
  function renderSettings() {
    var rec = UI.panels.settings; if (!rec) return;
    var h = "";
    h += '<div class="h2-set"><label>Villager names</label><select data-names>' +
      ['off', 'hover', 'always'].map(function (o) { return '<option value="' + o + '"' + (H2.cfg.names === o ? " selected" : "") + '>' + titleCase(o) + '</option>'; }).join("") +
      '</select></div>';
    h += toggleRow("Selection outline", "outline");
    h += toggleRow("Random events", "events");
    h += toggleRow("Births", "birth");
    h += toggleRow("War", "war");
    h += toggleRow("Expansion", "expand");
    h += toggleRow("Verbose log", "verbose");
    h += '<div class="h2-set"><label>Max per faction</label><input type="number" min="1" max="500" step="1" value="' + clampN(H2.cfg.maxPerFaction, 1, 500) + '" data-num="maxPerFaction"></div>';
    h += '<div class="h2-set"><label>Town size</label><input type="number" min="4" max="400" step="1" value="' + clampN(H2.cfg.townSize, 4, 400) + '" data-num="townSize"></div>';
    h += '<div class="h2-muted" style="margin-top:8px">Settings are saved to your browser.</div>';
    rec.body.innerHTML = h;
  }

  /* ============================================================== HELP */
  function renderHelp() {
    var rec = UI.panels.help; if (!rec) return;
    rec.body.innerHTML =
      '<div class="h2-help">' +
      '<p><b>Humanitize 2</b> turns the sandbox into a living world of villagers, factions, settlements and war. Place a settler band and watch a civilisation grow.</p>' +
      '<h4>Getting started</h4>' +
      '<ul>' +
      '<li>In the <b>Villagers</b> category, place <code>azure_party</code> or <code>crimson_party</code> — a band of settlers that founds a village.</li>' +
      '<li>Single villager spawners place one <code>azure_villager</code> / <code>crimson_villager</code>.</li>' +
      '<li>Pick the <b>Inspect</b> tool and tap any villager to open their card, or tap a building for info.</li>' +
      '</ul>' +
      '<h4>Villagers</h4>' +
      '<p>Each person has a name, traits, needs (hunger, thirst, energy, mood, warmth), health & blood, a family, friendships and a <b>life story</b> of their notable moments. They age from child to adult to elder, marry, raise children and eventually die — of old age, violence, hunger, cold or plague.</p>' +
      '<h4>Work & buildings</h4>' +
      '<p>Villagers take jobs — farmer, woodcutter, miner, smith, builder, doctor, merchant, soldier — gathering resources and constructing homes, farms, wells, markets, halls and walls in each faction\'s own architectural style.</p>' +
      '<h4>Settlements & expansion</h4>' +
      '<p>Settlements grow up to the town-size cap, then send out settlers to found new colonies — up to <b>500 people per faction</b>. See every settlement in the <b>🏰 Factions</b> dashboard.</p>' +
      '<h4>Trade</h4>' +
      '<p>Markets set prices and merchants carry goods and coin between settlements.</p>' +
      '<h4>Events</h4>' +
      '<p>Random events spice up life: festivals, wandering traders, bandit raids and plagues. Toggle them in <b>⚙️ Settings</b>.</p>' +
      '<h4>War & the military</h4>' +
      '<p>Tension between the Azure and Crimson can escalate from wary to fortify, prepare, war and siege. Scouts gather intelligence (fog of war), soldiers drill at training dummies and earn experience, and armies are organised into <b>squads</b> (archers, infantry, musketeers) with <b>ranks</b> (Azure: Recruit → Huscarl → Veteran → Sergeant → Captain → Marshal; Crimson: Tiro → Legionary → Veteran → Optio → Centurion → Legate).</p>' +
      '<p>A <b>war council</b> picks a strategy — assault, lightning raid, patient siege with guns or archer harassment; defenders hold the walls, sally out, arm a militia or shelter the people in the hall. Weapons and defences: swords, spears, bows, <b>fire arrows</b>, rifles, siege cannons, <b>sapper charges</b>, rocks dropped from towers, walls, palisades, towers and moats. <b>Morale</b> can break and send an army fleeing. Soldiers are paid, decorated with medals, retire as elders and are honoured at funerals; civilians form bucket lines to fight fires.</p>' +
      '<p>Watch the <b>📜 Chronicle</b> for the story of each battle.</p>' +
      '<h4>Leaders & elections</h4>' +
      '<p>Every settlement elects a leader (Azure: Chieftain / High Jarl, Crimson: Consul / Doge) every six days or when the leader dies. Their temperament — hawk, dove or pragmatist — steers the council towards war or peace. The best soldier becomes Marshal / Legate. Heroes earn titles and medals that show up on their inspector card.</p>' +
      ((H2.compat && H2.compat.length) ? '<h4>Detected mods</h4><ul>' + H2.compat.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
      (H2.oldMod ? '<p><b>⚠ The original Humanitize.js is loaded — please disable it.</b></p>' : '') +
      '<h4>Interface</h4>' +
      '<ul>' +
      '<li><b>HUD</b> — day & time, faction populations, settlements and war status.</li>' +
      '<li><b>Inspector</b> — full villager card with a scrollable life-story timeline; tap family names to jump between people.</li>' +
      '<li><b>🏰 Factions</b> — populations, leaders, stores, buildings, armies and a population graph.</li>' +
      '<li><b>📜 Chronicle</b> — the running history, filterable by faction or major events.</li>' +
      '<li><b>⚙️ Settings</b> — names, outline, events and population caps (saved to your browser).</li>' +
      '</ul>' +
      '<p class="h2-muted">Tip: disable the original <code>Humanitize.js</code> mod to avoid conflicts — Humanitize 2 replaces it.</p>' +
      '<p class="h2-muted">Humanitize 2 — a complete rewrite & expansion of the original <b>Humanitize.js</b> by <b>nekonico</b>.</p>' +
      '</div>';
  }

  /* ============================================================ OPEN/CLOSE */
  var RENDERERS = { inspector: renderInspector, hud: renderHud, dashboard: renderDashboard, chronicle: renderChronicle, settings: renderSettings, help: renderHelp };
  UI.open = function (name) {
    try {
      ensureInit();
      var rec = UI.panels[name]; if (!rec) return false;
      rec.panel.style.display = "flex";
      if (RENDERERS[name]) RENDERERS[name]();
      return true;
    } catch (e) { return false; }
  };
  UI.close = function (name) { try { var rec = UI.panels[name]; if (rec) rec.panel.style.display = "none"; } catch (e) {} };
  UI.toggle = function (name) { var rec = UI.panels[name]; if (rec && rec.panel.style.display !== "none") UI.close(name); else UI.open(name); };
  UI.isOpen = function (name) { var rec = UI.panels[name]; return !!(rec && rec.panel.style.display !== "none"); };
  UI.refresh = function () {
    try {
      for (var name in UI.panels) if (UI.isOpen(name) && RENDERERS[name]) RENDERERS[name]();
    } catch (e) {}
  };

  /* ============================================================ CANVAS DRAW */
  function drawOverlay(ctx) {
    try {
      if (!ctx || typeof ctx.save !== "function") return;
      var ps = (typeof w.pixelSize === "number" && w.pixelSize > 0) ? w.pixelSize : 6;
      // selection outline (animated)
      if (H2.cfg.outline !== false) {
        var p = resolveSel();
        if (p && !p.del && has(p.x) && has(p.y)) {
          var t = (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()) / 1000;
          var a = 0.45 + 0.35 * Math.sin(t * 4);
          var F = facOf(p.fac);
          ctx.save();
          ctx.globalAlpha = a;
          ctx.strokeStyle = F.flag || "#fff";
          ctx.lineWidth = Math.max(1, ps * 0.22);
          var tall = (p.element === "hz_child") ? ps : ps * 2;
          var topY = (p.element === "hz_child") ? p.y * ps : (p.y - 1) * ps;
          ctx.strokeRect(p.x * ps - 1.5, topY - 1.5, ps + 3, tall + 3);
          ctx.restore();
        }
      }
      // name labels
      var mode = H2.cfg.names || "hover";
      if ((mode === "always" || mode === "hover") && ps >= 4) {
        ctx.save();
        ctx.font = Math.max(8, Math.round(ps * 1.1)) + "px 'Segoe UI',sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = Math.max(2, ps * 0.3);
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        var drew = 0, CAP = 48;
        if (mode === "always") {
          var ppl = H2.people || [];
          for (var i = 0; i < ppl.length && drew < CAP; i++) { if (labelPerson(ctx, ppl[i], ps)) drew++; }
        }
        // person under the mouse (hover + always)
        if (w.mousePos) {
          var hp = personNear(Math.round(w.mousePos.x), Math.round(w.mousePos.y), 1);
          if (hp) labelPerson(ctx, hp, ps, true);
        }
        ctx.restore();
      }
    } catch (e) {}
  }
  function labelPerson(ctx, p, ps, force) {
    if (!p || p.del || p.dead) return false;
    if (typeof w.width === "number" && (p.x < 0 || p.x > w.width)) return false;
    var label = (p.first || p.name || "").split(" ")[0];
    if (!label) return false;
    var F = facOf(p.fac);
    var cx = (p.x + 0.5) * ps;
    var cy = (p.y - 1) * ps - 2;
    ctx.strokeText(label, cx, cy);
    ctx.fillStyle = force ? "#ffffff" : (F.flag || "#fff");
    ctx.fillText(label, cx, cy);
    return true;
  }

  /* ============================================================ EVENTS */
  function wireGlobalEvents() {
    var d = w.document;
    // delegated clicks inside the UI root
    root.addEventListener("click", function (e) {
      var t = e.target; if (!t) return;
      var pid = t.getAttribute && t.getAttribute("data-pid");
      if (pid) { UI.select(+pid); e.stopPropagation(); return; }
      var op = t.getAttribute && t.getAttribute("data-open");
      if (op) { UI.toggle(op); return; }
      var cf = t.getAttribute && t.getAttribute("data-cf");
      if (cf !== null && cf !== undefined) { UI.chronFilter = +cf; renderChronicle(); return; }
      if (t.getAttribute && t.getAttribute("data-cmaj")) { UI.chronMajor = !UI.chronMajor; renderChronicle(); return; }
      var tog = t.getAttribute && t.getAttribute("data-toggle");
      if (tog) { H2.cfg[tog] = !H2.cfg[tog]; t.classList.toggle("on", !!H2.cfg[tog]); saveSettings(); return; }
    });
    root.addEventListener("change", function (e) {
      var t = e.target; if (!t) return;
      if (t.hasAttribute && t.hasAttribute("data-names")) { H2.cfg.names = t.value; syncNameMode(); saveSettings(); return; }
      var num = t.getAttribute && t.getAttribute("data-num");
      if (num) { var cap = num === "maxPerFaction" ? 500 : 400; H2.cfg[num] = clampN(t.value, 1, cap); t.value = H2.cfg[num]; saveSettings(); return; }
    });
    // Escape closes the top-most non-HUD panel
    d.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" && e.code !== "Escape") return;
      var order = ["help", "settings", "chronicle", "dashboard", "inspector"];
      for (var i = 0; i < order.length; i++) if (UI.isOpen(order[i])) { UI.close(order[i]); e.stopPropagation(); return; }
    }, true);
  }

  /* ============================================================ TOOL ELEM */
  function registerTool() {
    try {
      if (!w.elements || w.elements.hz_inspect) return;
      w.elements.hz_inspect = {
        name: "inspect",
        color: ["#ffd166", "#06d6a0", "#4da3ff"],
        category: "villagers",
        canPlace: false,
        excludeRandom: true,
        state: "solid",
        movable: false,
        desc: "Humanitize inspector — tap a villager for their life story, or a building for info.",
        tool: function (pixel) { UI.pickAt(pixel); },
      };
      // best-effort button registration if the engine already built its lists
      if (typeof w.createElementButton === "function" && w.document && w.document.getElementById("category-villagers") && !w.document.getElementById("elementButton-hz_inspect")) {
        try { w.createElementButton("hz_inspect"); } catch (e) {}
      }
    } catch (e) {}
  }

  /* ============================================================ SAMPLING */
  function sampleHistory() {
    try {
      var fp = H2.facPop || {};
      for (var i = 0; i < UI.hist.length; i++) { UI.hist[i].push(fp[i] || 0); if (UI.hist[i].length > 80) UI.hist[i].shift(); }
    } catch (e) {}
  }

  /* ============================================================ INIT */
  function ensureInit() {
    if (UI._built) return;
    var d = w.document;
    if (!d || !d.body) return;      // DOM not ready yet
    UI._built = true;
    injectStyle();
    makeRoot();
    makePanel("hud", "Humanitize 2", { left: "50%", top: "8px" }).panel.classList.add("h2-hud");
    makePanel("inspector", "Inspector", { right: "10px", top: "54px", width: "320px" });
    makePanel("dashboard", "Factions", { left: "10px", top: "54px", width: "330px" });
    makePanel("chronicle", "Chronicle", { right: "10px", bottom: "10px", width: "320px" });
    makePanel("settings", "Settings", { left: "10px", bottom: "10px", width: "300px" });
    makePanel("help", "Help & Overview", { left: "50%", top: "60px", width: "360px" });
    UI.panels.help.panel.style.transform = "translateX(-50%)";
    wireGlobalEvents();
    renderHud();
    UI.open("hud");
  }

  /* -------- hook into the engine -------- */
  loadSettings();
  registerTool();

  try {
    if (typeof w.runAfterLoad === "function") w.runAfterLoad(function () { try { ensureInit(); registerTool(); } catch (e) {} });
  } catch (e) {}
  // also try once the DOM is ready, in case runAfterLoad already fired
  try {
    if (w.document && w.document.body) ensureInit();
    else if (w.document) w.document.addEventListener("DOMContentLoaded", function () { try { ensureInit(); } catch (e) {} });
  } catch (e) {}

  try {
    if (typeof w.renderPostPixel === "function") w.renderPostPixel(function (ctx) { drawOverlay(ctx || w.ctx); });
  } catch (e) {}

  try {
    if (typeof w.runEveryTick === "function") w.runEveryTick(function () {
      try {
        var t = tks();
        if (t % 300 === 0) sampleHistory();
        // light, throttled live refresh of whatever is open (~ every 15 ticks)
        if (t % 15 === 0) {
          if (UI.isOpen("inspector")) renderInspector();
          if (UI.isOpen("hud")) renderHud();
          if (UI.isOpen("dashboard")) renderDashboard();
          if (UI.isOpen("chronicle")) renderChronicle();
        }
      } catch (e) {}
    });
  } catch (e) {}

  // Also run a wall-clock refresh (~4/s) for the inspector/hud while the sim is paused.
  try {
    if (typeof w.setInterval === "function") w.setInterval(function () {
      try { if (UI.isOpen("inspector")) renderInspector(); if (UI.isOpen("hud")) renderHud(); } catch (e) {}
    }, 250);
  } catch (e) {}

})();
