
/* ======================================================================
   CONSTRUCTION: blueprints, site finding, planning, building
   ====================================================================== */
const COST = {
  hz_plank: { wood: 1 }, hz_roof: { wood: 1 }, hz_door: { wood: 1 }, hz_gate: { wood: 2, iron: 1 }, hz_palisade: { wood: 1 }, hz_cloth: { wood: 1 },
  hz_stone: { stone: 1 }, hz_bed: { wood: 2 }, hz_cot: { wood: 2 }, hz_hearth: { stone: 2 }, hz_campfire: { wood: 2 }, hz_stall: { wood: 1 },
  hz_banner: { wood: 1 }, hz_anvil: { iron: 3 }, hz_forgefire: { stone: 2 }, hz_oven: { stone: 3 }, hz_rack: { wood: 2, iron: 1 }, hz_dummy: { wood: 2 },
  hz_post: { wood: 1 }, hz_medcross: { wood: 1 }, hz_scarecrow: { wood: 1 }, hz_mill: { wood: 3 }, hz_chest: { wood: 2 }, hz_cannon: { cannon: 1 }, hz_well: {},
  glass: {}, dirt: {}, water: {},
};
const GROUNDISH = { dirt: 1, grass: 1, soil: 1, mud: 1, sand: 1, rock: 1, gravel: 1, clay: 1, clay_soil: 1, snow: 1, packed_snow: 1, permafrost: 1, sandstone: 1, limestone: 1, basalt: 1, granite: 1, packed_sand: 1, farmland: 1 };
function groundish(o) { if (!o || isPerson(o)) return false; const e = elements[o.element]; return !!(GROUNDISH[o.element] || (e && e.category === "land" && !e.hzb && e.state !== "liquid" && o.element !== "wood" && o.element !== "plant")); }

/* tiny blueprint DSL ------------------------------------------------------- */
function BP(w) { const b = { w: w, cells: [] }; b.set = (dx, dy, el, o) => { b.cells.push([dx, dy, el, o]); return b; };
  b.row = (x0, x1, dy, el, o) => { for (let x = x0; x <= x1; x++) b.set(x, dy, el, o); return b; };
  b.col = (dx, y0, y1, el, o) => { for (let y = y0; y >= y1; y--) b.set(dx, y, el, o); return b; };   // y0 >= y1 (up = more negative)
  return b; }
const BLUEPRINTS = {
  hut: () => { const b = BP(5); b.set(4, 0, "hz_door").set(4, -1, "hz_door").set(4, -2, "hz_plank").set(0, -2, "hz_plank").row(0, 4, -3, "hz_plank").set(3, 0, "hz_bed"); b.h = 3; return b; },
  house: () => { const b = BP(7); b.set(0, 0, "hz_door").set(0, -1, "hz_door").set(0, -2, "hz_plank").set(0, -3, "hz_plank");
    b.set(6, 0, "hz_door").set(6, -1, "hz_door").set(6, -2, "glass").set(6, -3, "hz_plank").set(4, 0, "hz_bed").set(5, 0, "hz_bed").set(2, 0, "hz_hearth");
    b.row(-1, 7, -4, "hz_roof").row(0, 6, -5, "hz_roof").row(2, 4, -6, "hz_roof"); b.set(2, -4, "hz_stone").set(2, -5, "hz_stone").set(2, -6, "hz_stone"); b.h = 6; return b; },
  hall: () => { const b = BP(9); b.set(0, 0, "hz_door").set(0, -1, "hz_door").set(0, -2, "hz_plank").set(0, -3, "hz_plank");
    b.set(8, 0, "hz_door").set(8, -1, "hz_door").set(8, -2, "hz_plank").set(8, -3, "hz_plank");
    b.row(-1, 9, -4, "hz_roof").row(1, 7, -5, "hz_roof"); b.set(2, 0, "hz_hearth").set(6, 0, "hz_chest");
    b.set(4, -5, "hz_plank").set(4, -6, "hz_plank").set(4, -7, "hz_plank"); b.set(5, -7, "hz_banner", { flag: 1 }).set(5, -6, "hz_cloth", { flag: 1 }); b.h = 7; return b; },
  well: () => { const b = BP(4); b.set(0, 0, "hz_stone").set(1, 0, "hz_well").set(2, 0, "hz_well").set(3, 0, "hz_stone"); b.h = 1; return b; },
  market: () => { const b = BP(5); b.col(0, -2, -3, "hz_plank").col(4, -2, -3, "hz_plank").set(1, 0, "hz_chest").row(-1, 5, -4, "hz_roof").set(2, -3, "hz_stall", { flag: 1 }); b.h = 3; return b; },
  forge: () => { const b = BP(7); b.set(6, 0, "hz_door").set(6, -1, "hz_door").set(6, -2, "hz_stone").set(6, -3, "hz_stone").row(-1, 7, -4, "hz_stone").set(0, -3, "hz_stone").set(2, 0, "hz_anvil").set(4, 0, "hz_forgefire").set(4, -5, "hz_stone").set(4, -6, "hz_stone"); b.h = 6; return b; },
  bakery: () => { const b = BP(6); b.set(5, 0, "hz_door").set(5, -1, "hz_door").set(5, -2, "hz_stone").row(-1, 6, -3, "hz_roof").set(4, 0, "hz_oven").set(2, 0, "hz_mill"); b.h = 3; return b; },
  hospital: () => { const b = BP(9); b.set(0, 0, "hz_door").set(0, -1, "hz_door").set(0, -2, "hz_plank").set(0, -3, "hz_plank"); b.set(8, 0, "hz_door").set(8, -1, "hz_door").set(8, -2, "hz_plank").set(8, -3, "hz_plank");
    b.row(-1, 9, -4, "hz_roof").row(1, 7, -5, "hz_roof").set(3, 0, "hz_cot").set(5, 0, "hz_cot").set(7, 0, "hz_cot"); b.set(4, -6, "hz_medcross"); b.h = 6; return b; },
  barracks: () => { const b = BP(11); b.set(0, 0, "hz_door").set(0, -1, "hz_door").set(0, -2, "hz_stone").set(0, -3, "hz_stone"); b.set(10, 0, "hz_door").set(10, -1, "hz_door").set(10, -2, "hz_stone").set(10, -3, "hz_stone");
    b.row(-1, 11, -4, "hz_roof").row(1, 9, -5, "hz_roof").set(2, 0, "hz_rack").set(4, 0, "hz_dummy").set(6, 0, "hz_dummy").set(8, 0, "hz_bed").set(9, 0, "hz_bed"); b.set(5, -5, "hz_banner", { flag: 1 }); b.h = 5; return b; },
  tower: () => { const b = BP(3); b.set(0, 0, "hz_gate").set(0, -1, "hz_gate").set(2, 0, "hz_gate").set(2, -1, "hz_gate"); for (let y = -2; y >= -7; y--) { b.set(0, y, "hz_stone").set(1, y, y === -4 ? "glass" : "hz_stone").set(2, y, "hz_stone"); } b.row(-1, 3, -8, "hz_stone").set(1, -9, "hz_post"); b.h = 9; return b; },
  wall: () => { const b = BP(2); for (let x = 0; x < 2; x++) { b.set(x, 0, "hz_gate").set(x, -1, "hz_gate"); for (let y = -2; y >= -5; y--) b.set(x, y, "hz_stone"); } b.set(0, -6, "hz_stone"); b.h = 6; return b; },
  palisade: () => { const b = BP(1); b.set(0, 0, "hz_gate").set(0, -1, "hz_gate"); for (let y = -2; y >= -4; y--) b.set(0, y, "hz_palisade"); b.h = 4; return b; },
  moat: () => { const b = BP(3); for (let x = 0; x < 3; x++) for (let y = 1; y <= 3; y++) b.set(x, y, "__dig"); for (let x = 0; x < 3; x++) for (let y = 1; y <= 3; y++) b.set(x, y, "water"); b.h = 0; b.dug = true; return b; },
  cannon: () => { const b = BP(1); b.set(0, 0, "hz_cannon", { cannon: 1 }); b.h = 1; return b; },
  campfire: () => { const b = BP(1); b.set(0, 0, "hz_campfire"); b.h = 1; return b; },
  scarecrow: () => { const b = BP(1); b.set(0, 0, "hz_scarecrow"); b.h = 2; return b; },
};
H2.BLUEPRINTS = BLUEPRINTS;
// cannons have 3 columns: the barrel cell is always in the middle; keep walls on both sides, which is enough protection
const BUILD_NAMES = { hut: "a hut", house: "a house", hall: "the town hall", well: "a well", market: "a market", forge: "a smithy", bakery: "a bakery", hospital: "a hospital", barracks: "barracks",
  tower: "a watchtower", wall: "a stone wall", palisade: "a palisade", moat: "a moat", cannon: "a cannon emplacement", campfire: "a campfire", scarecrow: "a scarecrow" };
const MAJOR_BUILD = { hall: 1, well: 1, market: 1, forge: 1, bakery: 1, hospital: 1, barracks: 1, tower: 1, wall: 1, moat: 1, palisade: 1, cannon: 1 };

function costOfPlan(bp) { const c = {}; for (const cell of bp.cells) { const k = COST[cell[2]]; if (!k) continue; for (const g in k) c[g] = (c[g] || 0) + k[g]; } return c; }
function affordable(c, cost, frac) { for (const g in cost) if ((c.stock[g] || 0) < cost[g] * frac) return false; return true; }

/* ---- site finding ---------------------------------------------------------- */
function columnGround(x) { // y of free cell above the topmost solid thing, only if that is real ground
  if (x < 1 || x >= width - 1) return -1;
  for (let y = 0; y < height - 1; y++) { const o = pixelMap[x][y]; if (o) return groundish(o) ? y - 1 : -1; }
  return -1;
}
function overlaps(c, x0, x1, margin) { for (const pl of c.plans) if (x1 + margin >= pl.x0 && x0 - margin <= pl.x1) return true; return false; }
H2.reserved = function (c, x, y) { for (const pl of c.plans) if (x >= pl.x0 - 2 && x <= pl.x1 + 2) return true; return false; };
function findSite(c, w, opt) {
  opt = opt || {};
  const cx = opt.cx !== undefined ? opt.cx : (c.hall ? c.hall.x : c.x);
  const range = opt.range || 55;
  const lo = c.wallL !== undefined && !opt.outside ? c.wallL + 3 : 2, hi = c.wallR !== undefined && !opt.outside ? c.wallR - 3 : width - 3;
  const order = [0];
  for (let o = 2; o <= range; o += 2) { if (opt.side === 1) order.push(o, -o); else if (opt.side === -1) order.push(-o, o); else order.push(o, -o); }
  for (const off of order) {
    const x0 = Math.round(cx + off - w / 2);
    if (x0 < lo || x0 + w - 1 > hi) continue;
    if (overlaps(c, x0, x0 + w - 1, 1)) continue;
    let ok = true, mn = 1e9, mx = -1e9; const gys = [];
    for (let i = 0; i < w; i++) { const g = columnGround(x0 + i); if (g < 2) { ok = false; break; } gys.push(g); if (g < mn) mn = g; if (g > mx) mx = g; }
    if (!ok || mx - mn > (opt.slope || 3)) continue;
    if (!opt.nomargin) { // keep a gap to neighbouring buildings
      let bad = false;
      for (const mxx of [x0 - 1, x0 - 2, x0 + w, x0 + w + 1]) { if (mxx < 1 || mxx >= width - 1) continue; for (let y = 0; y < height; y++) { const o = pixelMap[mxx][y]; if (o) { if (elements[o.element].hzb) bad = true; break; } } if (bad) break; }
      if (bad) continue;
    }
    return { x0: x0, y0: mn, gys: gys };
  }
  return null;
}
H2.findSite = findSite;

/* ---- plans ----------------------------------------------------------------- */
function queuePlan(c, type, opt) {
  opt = opt || {};
  const bp = BLUEPRINTS[type](); const cost = costOfPlan(bp);
  const site = opt.site || findSite(c, bp.w, opt);
  if (!site) return null;
  const cells = [];
  // foundation for uneven ground
  if (site.gys && !bp.dug) for (let i = 0; i < bp.w; i++) for (let y = site.y0 + 1; y <= site.gys[i]; y++) cells.push([i, y - site.y0, "dirt"]);
  for (const cell of bp.cells) cells.push(cell.slice());
  if (opt.mirror) for (const cell of cells) { cell[0] = bp.w - 1 - cell[0]; }
  cells.sort((a, b) => (a[3] && a[3].late ? 1 : 0) - (b[3] && b[3].late ? 1 : 0) || (a[2] === "water" ? 1 : 0) - (b[2] === "water" ? 1 : 0) || b[1] - a[1] || a[0] - b[0]);
  const plan = { id: c.plans.length + 1000 + Math.floor(rnd() * 1e6), type: type, x0: site.x0, y0: site.y0, x1: site.x0 + bp.w - 1, w: bp.w, cells: cells, i: 0, state: "ready", t0: pixelTicks, opt: opt, cost: cost, dir: opt.dir };
  c.plans.push(plan);
  return plan;
}
H2.queuePlan = queuePlan;
function haveCount(c, type) { return stationsOf(type, c, 130).length; }
function planBuild(c) {
  // update plan states
  for (let i = c.plans.length - 1; i >= 0; i--) {
    const pl = c.plans[i];
    if (pl.i >= pl.cells.length) { completePlan(c, pl); c.plans.splice(i, 1); continue; }
    if (pixelTicks - pl.t0 > 9000 + pl.cells.length * 90) { c.plans.splice(i, 1); continue; }  // gave up
    if (pl.li !== pl.i) { pl.li = pl.i; pl.lt = pixelTicks; }
    else if (pl.state === "ready" && pixelTicks - (pl.lt || pl.t0) > 1500) { pl.i++; pl.lt = pixelTicks; }   // watchdog: skip a cell nobody can reach
    if (pl.i >= pl.cells.length) continue;
    const next = pl.cells[pl.i]; const need = COST[next[2]];
    let ok = true; if (need) for (const g in need) if ((c.stock[g] || 0) < need[g]) ok = false;
    pl.state = ok ? "ready" : "stalled";
  }
  if (c.plans.length >= 2) return;
  const s = c.stock, pop = c.pop, adults = c.adults || 0;
  const can = (type, frac) => affordable(c, costOfPlan(BLUEPRINTS[type]()), frac || 0.6);
  const hasHall = !!c.hall;
  // housing first
  const housing = c.beds + c.plans.filter((p) => p.type === "house" || p.type === "hut").reduce((n, p) => n + (p.type === "house" ? 2 : 1), 0);
  if (!hasHall && pop >= 3 && can("hall", 0.55) && !c.plans.some((p) => p.type === "hall")) { if (queuePlan(c, "hall", { cx: c.x })) return; }
  if (haveCount(c, "campfire") === 0 && pop >= 2 && !c.plans.some((p) => p.type === "campfire") && s.wood >= 2) { if (queuePlan(c, "campfire", { cx: hasHall ? c.hall.x : c.x, range: 14 })) return; }
  if (housing < pop + 1 && !c.plans.some((p) => p.type === "house" || p.type === "hut")) {
    const t = (pop >= 4 && can("house", 0.6)) ? "house" : "hut";
    if (can(t, 0.6)) { if (queuePlan(c, t)) return; }
  }
  if (haveCount(c, "well") === 0 && pop >= 3 && can("well", 0.8) && !c.plans.some((p) => p.type === "well")) { if (queuePlan(c, "well", { range: 30 })) return; }
  if (pop >= 5 && haveCount(c, "oven") === 0 && can("bakery", 0.7) && !c.plans.some((p) => p.type === "bakery")) { if (queuePlan(c, "bakery")) return; }
  if (pop >= 6 && haveCount(c, "market") === 0 && can("market", 0.7) && !c.plans.some((p) => p.type === "market")) { if (queuePlan(c, "market")) return; }
  if (pop >= 8 && haveCount(c, "forge") === 0 && can("forge", 0.7) && !c.plans.some((p) => p.type === "forge")) { if (queuePlan(c, "forge", { side: c.fac === 0 ? -1 : 1 })) return; }
  if (pop >= 11 && haveCount(c, "hospital") === 0 && can("hospital", 0.7) && !c.plans.some((p) => p.type === "hospital")) { if (queuePlan(c, "hospital")) return; }
  if ((pop >= 14 || c.tension >= 1) && pop >= 8 && haveCount(c, "rack") === 0 && can("barracks", 0.7) && !c.plans.some((p) => p.type === "barracks")) { if (queuePlan(c, "barracks", { side: c.fac === 0 ? 1 : -1 })) return; }
  if (pop >= 9 && haveCount(c, "scarecrow") === 0 && s.wood >= 5 && (H2.crops || []).length > 6 && !c.plans.some((p) => p.type === "scarecrow")) { const sp = farmSpot({}, c); if (sp) { if (queuePlan(c, "scarecrow", { site: { x0: sp.x, y0: sp.y, gys: [sp.y] } })) return; } }
  if (H2.warPlan && H2.cfg.war) { if (H2.warPlan(c, can)) return; }
  // keep growing: one more house when everyone has a bed already and there are spare resources
  if (pop >= 6 && housing < pop + 3 && s.wood > 80 && !c.plans.some((p) => p.type === "house") && can("house", 1)) { queuePlan(c, "house"); }
}
H2.planBuild = planBuild;
function completePlan(c, pl) {
  c.built[pl.type] = (c.built[pl.type] || 0) + 1;
  if (MAJOR_BUILD[pl.type]) {
    let msg = c.name + " completes " + BUILD_NAMES[pl.type] + ".";
    if (pl.type === "wall") msg = "The great wall of " + c.name + " stands complete.";
    chronicle(msg, true, c.fac);
  } else if (H2.cfg.verbose) chronicle(c.name + " built " + BUILD_NAMES[pl.type] + ".", false, c.fac);
  if (pl.type === "wall" || pl.type === "palisade") {
    if (pl.x0 < c.x) c.wallL = Math.max(c.wallL === undefined ? -1 : c.wallL, pl.x1); else c.wallR = Math.min(c.wallR === undefined ? 1e9 : c.wallR, pl.x0);
    (c.walls = c.walls || []).push({ x0: pl.x0, y0: pl.y0, side: pl.wallSide || (pl.x0 < c.x ? -1 : 1), type: pl.type });
  }
  census(true);
}

/* ---- the build task ----------------------------------------------------------- */
function cellOpenFor(p, x, y) { return true; }
TASKS.build = function (p, t) {
  const c = colById(p.col); if (!c) return "done";
  const pl = c.plans[0] && c.plans[0].state !== "stalled" ? c.plans[0] : c.plans.find((q) => q.state !== "stalled");
  if (!pl) return "done";
  if (pl.i >= pl.cells.length) return "done";
  const cell = pl.cells[pl.i];
  const el = cell[2], cx = pl.x0 + cell[0], cy = pl.y0 + cell[1];
  if (!inb(cx, cy)) { pl.i++; return; }
  const r = goTo(p, clamp(cx + (p.id % 2 ? -2 : 2), 1, width - 2), pl.y0, 3, 9);
  if (r === "fail") { t.fail = (t.fail || 0) + 1; if (t.fail > 3) { pl.i++; t.fail = 0; } return "done"; }
  if (r !== "arrive" && Math.abs(p.x - cx) > 5) return;
  if (pixelTicks < (p.buildCool || 0)) return;
  p.buildCool = pixelTicks + 9;
  // is the cell already done?
  const o = pixelMap[cx][cy];
  if (el === "__dig") { if (o && !isPerson(o) && !elements[o.element].hzb && elements[o.element].state !== "liquid") deletePixel(cx, cy); pl.i++; return; }
  if (o && o.element === el) { pl.i++; return; }
  if (o) {
    if (isPerson(o)) { t.wait = (t.wait || 0) + 1; if (t.wait > 25) { pl.i++; t.wait = 0; } return; }
    const oi = elements[o.element];
    if (oi.hzb && !(el === "water")) { pl.i++; return; }                                   // someone else's wall
    if (el === "water" && oi.state === "liquid") { pl.i++; return; }
    deletePixel(cx, cy);                                                                      // clear brush, leaves, loose stuff
  }
  const need = COST[el] || {};
  for (const g in need) if ((c.stock[g] || 0) < need[g]) { pl.state = "stalled"; return "done"; }
  for (const g in need) c.stock[g] -= need[g];
  createPixel(el, cx, cy);
  const n = pixelMap[cx][cy];
  if (n) {
    const info = elements[el];
    if (info && (info.st || info.door || el === "hz_cloth" || el === "hz_cannon")) { n.fac = c.fac; n.ay = pl.y0; }
    if (info && info.hzb) n.hzb2 = 1;
    if (cell[3] && cell[3].flag) { n.color = FAC[c.fac].flag; }
    if (el === "hz_cannon") { n.dir = pl.dir || (c.fac === 0 ? 1 : -1); n.ammo = 0; n.cd = 0; n.cid = c.id; }
    if (el === "hz_stone" || el === "hz_plank" || el === "hz_roof" || el === "hz_palisade") n.fac = c.fac;
  }
  pl.i++; p.sk.build += 0.05;
};

/* ---- children --------------------------------------------------------------- */
function pregnancyAndBirths(c) {
  if (!H2.cfg.birth) return;
  const ppl = H2.people.filter((q) => q.col === c.id);
  const food = c.stock.bread + c.stock.grain * 0.5;
  for (const w of ppl) {
    if (w.sex !== "f" || isChildPx(w) || w.dead) continue;
    if (w.preg) {
      if (pixelTicks >= w.preg && !w.sleeping) {
        const sp = H2.byId[w.sp];
        const x = w.x + (rnd() < 0.5 ? -1 : 1), y = w.y;
        if (isEmpty(x, y)) {
          w.preg = 0; w.lastBirth = pixelTicks;
          const tr = rollTraits([w.tr, sp && sp.tr]);
          const kid = spawnChild(x, y, w.fac, { col: c.id, born: pixelTicks, sn: (sp || w).sn, par: [w.id, sp ? sp.id : 0], tr: tr, skin: pick([w.skin, sp ? sp.skin : w.skin]), age: 0 });
          if (kid) {
            w.kids.push(kid.id); if (sp) sp.kids.push(kid.id);
            c.births++; H2.stats.births++;
            addThought(w, "newborn", 20, DAY * 2); if (sp) addThought(sp, "newborn", 20, DAY * 2);
            chronicle("A child, " + kid.first + " " + kid.sn + ", was born to " + nm(w) + (sp ? " and " + nm(sp) : "") + ".", true, w.fac);
          }
        }
      }
      continue;
    }
    if (!w.sp) continue;
    const sp = H2.byId[w.sp]; if (!sp || sp.dead) continue;
    const a = ageOf(w); if (a < CHILD_T * 1.4 || a > LIFE_T * 0.55) continue;
    if (pixelTicks - (w.lastBirth || -1e9) < DAY * 2.5) continue;
    if (H2.people.length >= H2.cfg.maxPeople) continue;
    if (c.beds < c.pop + 0 || food < c.pop * 1.5 || c.tension >= 4 || w.hu < 40 || w.sick) continue;
    if (rnd() < 0.05) w.preg = pixelTicks + Math.floor(DAY * 0.5);
  }
}
