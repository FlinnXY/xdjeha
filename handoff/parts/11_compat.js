
/* ======================================================================
   COMPATIBILITY with other mods — every integration is guarded, so the
   mod works the same with or without them.
   ====================================================================== */
H2.compat = [];
function detectMods() {
  const C = [];
  const has = (k) => !!(elements && elements[k]);
  if (has("cultured_human") || has("c_body")) {
    H2.oldMod = true;
    console.warn("[Humanitize2] The original Humanitize.js is also loaded. Please disable it: Humanitize 2 replaces it and the two will fight over the same ideas.");
    chronicle("⚠ The original Humanitize.js is also loaded — please disable it in the Mod Manager, Humanitize 2 replaces it.", true);
  }
  if (has("left_bullet") && has("right_bullet")) C.push("weapons: riflemen fire real bullets" + (has("bombs_for_throwing_at_you_left") ? ", sappers throw bombs" : ""));
  if (has("advanced_dough") || has("apple") || has("apple_jam")) C.push("aChefsDream: villagers eat its foods and gather apples");
  if (typeof window.announceDeath === "function") C.push("death_count: villager deaths are counted");
  if (has("slab") || has("wood_roof")) C.push("building: its blocks count as solid ground for houses");
  if (has("acid_ice") || has("base_gas")) C.push("chem: chemical hazards hurt villagers");
  if (has("aerogel")) C.push("nousersthings: compatible");
  H2.compat = C;
  if (C.length && H2.cfg.verbose) console.log("[Humanitize2] integrations: " + C.join("; "));
}
runAfterLoad(function () { try { detectMods(); } catch (e) { H2.lastError = e; } });

// building mod: its slabs and roofs are walkable ground for site finding
if (typeof GROUNDISH === "object") runAfterLoad(function () { for (const k of ["slab", "wood_roof"]) if (elements[k]) GROUNDISH[k] = 1; });

// weapons mod: sappers throw its bombs instead of planting a powder keg when available
const _breach2 = TASKS.breach;
TASKS.breach = function (p, t) {
  if (t.o && !t.o.del && p.id % 5 === 0 && elements.bombs_for_throwing_at_you_left && elements.bombs_for_throwing_at_you_right) {
    const c = colById(p.col);
    if (c && c.stock.powder >= 2 && Math.abs(t.o.x - p.x) <= 4 && Math.abs(t.o.x - p.x) >= 2 && pixelTicks > (p.charged || 0)) {
      const d = Math.sign(t.o.x - p.x) || 1, bx = p.x + d, by = p.y - 2;
      if (isEmpty(bx, by)) {
        c.stock.powder -= 2; p.charged = pixelTicks + 600;
        createPixel(d > 0 ? "bombs_for_throwing_at_you_right" : "bombs_for_throwing_at_you_left", bx, by);
        life(p, "Hurled a bomb at the enemy defences.", "war"); p.xp = (p.xp || 0) + 4;
        return;
      }
    }
  }
  return _breach2(p, t);
};

// aChefsDream: hungry villagers pick ripe apples from its fruit trees
const _eat = TASKS.eat;
if (_eat) TASKS.eat = function (p, t) {
  if (elements.apple && !t.apple && !t.triedApple) {
    t.triedApple = true;
    const a = H2.findNear(p.x, p.y, 18, (o) => o.element === "apple");
    if (a) t.apple = { x: a.x, y: a.y };
  }
  if (t.apple) {
    const o = at(t.apple.x, t.apple.y);
    if (!o || o.element !== "apple") { t.apple = null; return _eat(p, t); }
    const r = goTo(p, o.x, o.y, 1, 4);
    if (r === "fail") { t.apple = null; return; }
    if (r === "arrive") { deletePixel(o.x, o.y); p.hu = Math.min(100, p.hu + 22); t.apple = null; if (!p.ateApple) { p.ateApple = true; life(p, "Picked a fresh apple from a tree.", "food"); } if (p.hu >= 85) return "done"; }
    return;
  }
  return _eat(p, t);
};
