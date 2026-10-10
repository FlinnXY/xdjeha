
/* ======================================================================
   JOBS & WORK TASKS
   ====================================================================== */
const CARRY_MAX = 7;
const GOODS = ["wood", "stone", "iron", "grain", "herbs", "powder"];
function carrying(p) { let n = 0; for (const k of GOODS) n += p.inv[k] || 0; return n; }
function hallSpot(c) { return c.hall ? c.hall : { x: c.x, y: c.y }; }
function isArcher(p) { return p.rng === undefined ? (p.rng = (p.id % 3 === 0)) : p.rng; }
const WEAPON = { spear: { dmg: 6, rng: 1 }, sword: { dmg: 9, rng: 1 }, bow: { dmg: 5, rng: 22 }, rifle: { dmg: 13, rng: 30 }, fist: { dmg: 2, rng: 1 } };
H2.WEAPON = WEAPON;

/* ---- pick work ---------------------------------------------------------- */
function laborerPick(p, c) {
  const s = c.stock;
  const options = [];
  if (c.plans.length && c.plans[0].state !== "stalled") options.push("build", "build");
  if (s.wood < 18 + c.pop * 2) options.push("chop", "chop", "chop");
  if (s.stone < 12 + c.pop) options.push("mine", "mine");
  if (s.bread + s.grain * 0.7 < c.pop * 2.5) options.push("farm", "farm", "farm");
  if (!options.length) options.push("chop", "mine", "farm");
  return pick(options);
}
function jobThink(p, c) {
  if (!c) return false;
  if (p.jail && pixelTicks < p.jail) { setTask(p, "stocks", {}, 90); return true; }
  // deliver full loads, and partial loads when the village is waiting for materials or at the end of the day
  const load = carrying(p);
  if (load >= CARRY_MAX || (load > 0 && (c.plans.some((q) => q.state === "stalled") || isEvening() || pixelTicks - (p.lastDep || 0) > DAY * 0.6))) { setTask(p, "deposit", { work: true }, 22); return true; }
  // someone has to bury the dead
  if (c.corpses.length && p.job !== "soldier" && p.job !== "scout" && !isChildPx(p)) {
    const cur = c.burier ? H2.byId[c.burier] : null;
    if (!cur || cur.dead || !cur.task || cur.task.k !== "bury") { c.burier = p.id; setTask(p, "bury", { cid: c.corpses[0].id, work: true }, 26); return true; }
  }
  if (H2.crimeThink && H2.crimeThink(p, c)) return true;
  let j = p.job;
  if (j === "laborer") j = laborerPick(p, c);
  switch (j) {
    case "farmer": case "farm": return setTask(p, "farm", { work: true }, 10);
    case "woodcutter": case "chop": return setTask(p, "chop", { work: true }, 10);
    case "miner": case "mine": return setTask(p, "mine", { work: true }, 10);
    case "builder": case "build":
      if (c.plans.length && c.plans[0].state !== "stalled") return setTask(p, "build", { work: true }, 12);
      return setTask(p, rnd() < 0.6 ? "chop" : "mine", { work: true }, 10);
    case "baker": return setTask(p, "bake", { work: true }, 10);
    case "smith": return setTask(p, "smith", { work: true }, 10);
    case "doctor": return setTask(p, "doctor", { work: true }, 12);
    case "merchant": return setTask(p, H2.shouldTrade && H2.shouldTrade(p, c) ? "trade" : "stall", { work: true }, 10);
    case "guard": return setTask(p, "patrol", { work: true }, 12);
    case "soldier": case "sentry": case "scout": return H2.soldierThink ? H2.soldierThink(p, c) : setTask(p, "patrol", {}, 10);
  }
  return false;
}
H2.jobThink = jobThink;

/* ---- depositing ----------------------------------------------------------- */
TASKS.deposit = function (p, t) {
  const c = colById(p.col); if (!c) return "done";
  const spot = hallSpot(c);
  const chests = stationsOf("chest", c, 40);
  const tgt = chests.length ? chests[0] : spot; const ty = tgt.ay !== undefined ? tgt.ay : (tgt.y);
  const r = goTo(p, tgt.x, ty, 2, 4);
  if (r === "fail") return "done";
  if (r !== "arrive") return;
  let wage = 0; p.lastDep = pixelTicks;
  for (const k of GOODS) {
    const n = p.inv[k] || 0; if (!n) continue;
    c.stock[k] = (c.stock[k] || 0) + n; p.inv[k] = 0;
    wage += n * (BASE_PRICE[k] || 2) * 0.3;
  }
  const pay = Math.min(Math.floor(wage * (1 - c.tax) * 10) / 10, c.stock.coin);
  c.stock.coin -= pay; p.coin += pay;
  if (wage > 0 && pay < wage * 0.5) addThought(p, "unpaid", -5, DAY);
  return "done";
};

/* ---- woodcutting ---------------------------------------------------------- */
function isTreePart(o) { return o.element === "wood" || o.element === "tree_branch"; }
function treeBase(o) { // walk down to the lowest wood pixel; returns it if the tree stands on ground
  let y = o.y;
  for (let k = 0; k < 40; k++) {
    const b = at(o.x, y + 1);
    if (!b) return null;
    if (b.element === "wood" || b.element === "tree_branch") { y++; continue; }
    const e = b.element;
    if (kindOf(b) === 2 && !elements[e].hzb && (e === "dirt" || e === "grass" || e === "mud" || e === "sand" || e === "snow" || e === "clay_soil" || e === "rock" || e === "gravel" || e === "soil" || elements[e].category === "land")) return pixelMap[o.x][y];
    return null;
  }
  return null;
}
TASKS.chop = function (p, t) {
  if ((p.inv.wood || 0) >= CARRY_MAX) return "done";
  const c = colById(p.col);
  if (!t.base || t.base.del || !isTreePart(t.base)) {
    const tp = (q) => { if (!isTreePart(q)) return false; const b = treeBase(q); return !!b && !isBad(p, b.x, b.y) && !(c && Math.abs(b.x - c.x) < 8 && c.hall); };
    const o = H2.findNear(p.x, p.y, 38, tp) || H2.findNear(p.x, p.y, 90, tp, 2);
    t.base = o ? treeBase(o) : null; t.n = 0;
    if (!t.base) {
      // no trees left nearby: plant a grove instead (woodcutters keep the forest alive)
      if (c && !t.planted) { const pri = t.pri || 10; p.task = null; setTask(p, "plant_trees", { work: true, n: 0 }, pri); return; }
      t.none = (t.none || 0) + 1; if (t.none > 8) { H2.noTrees = pixelTicks; return "fail"; } return TASKS.wander(p, t);
    }
  }
  const r = goTo(p, t.base.x, t.base.y, 1, 3);
  if (r === "fail") { markBad(p, t.base.x, t.base.y, 3000); t.base = null; return; }
  if (r === "arrive") {
    t.n++;
    if (t.n % 4 === 0 && rnd() < 0.5) p.dir = -p.dir;
    if (t.n >= 10 - Math.min(5, Math.floor(p.sk.wood / 6))) { fellTree(p, t.base); t.base = null; }
  }
};
function fellTree(p, base) {
  const seen = {}, q = [base]; let cnt = 0, wood = 0, i = 0;
  seen[base.x + "," + base.y] = true;
  while (i < q.length && cnt < 140) {
    const o = q[i++]; if (!o || o.del) continue;
    cnt++; if (o.element === "wood") wood++;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const n = at(o.x + dx, o.y + dy); if (!n || n.del) continue;
      const key = n.x + "," + n.y; if (seen[key]) continue;
      if (n.element === "wood" || n.element === "tree_branch" || (n.element === "plant" && (o.element !== "plant" || cnt < 100))) { if (n.hzb2 || elements[n.element].hzb) continue; seen[key] = true; q.push(n); }
    }
  }
  const bx = base.x, by = base.y;
  for (const o of q) if (o && !o.del) { if (o.element === "plant" && rnd() < 0.15) { /* leave a few leaves */ continue; } deletePixel(o.x, o.y); }
  const yield_ = clamp(wood + 2, 3, 14);
  p.inv.wood = (p.inv.wood || 0) + yield_;
  p.sk.wood++;
  // replant a managed sapling (never right inside the village)
  const pc = colById(p.col);
  if (H2.cfg.replant !== false && pc && Math.abs(bx - pc.x) > 16 && inb(bx, by) && !pixelMap[bx][by] && rnd() < 0.7) { createPixel("hz_sapling", bx, by); }
}
// grove management: plant saplings on free soil outside the village
function groveSpot(p, c) {
  const side0 = c.groveSide || (c.groveSide = (c.x < width / 2 ? -1 : 1) * (rnd() < 0.7 ? 1 : -1));
  for (let tries = 0; tries < 16; tries++) {
    const side = tries < 10 ? side0 : -side0;
    const e = c.ext ? (side > 0 ? c.ext[1] - c.x : c.x - c.ext[0]) + 12 : 0;      // never inside the town's growing edge
    const x = clamp(Math.round(c.x + side * rint(Math.max(24, e), Math.max(52, e + 28))), 2, width - 3);
    if (isBad(p, x, 0)) continue;
    const gy = groundY(x, clamp(c.y - 14, 0, height - 2), 30);
    if (gy < 8) continue;
    const b = at(x, gy + 1); if (!b || !TREE_SOIL[b.element]) continue;
    let ok = true;
    for (let dx = -3; dx <= 3 && ok; dx++) for (let dy = -8; dy <= 0; dy++) { const o = at(x + dx, gy + dy); if (o && (elements[o.element].hzb || isTreePart(o) || o.element === "hz_sapling" || o.element === "hz_crop")) { ok = false; break; } }
    if (!ok || (H2.reserved && H2.reserved(c, x, gy))) continue;
    if (c.quarry && Math.abs(x - c.quarry.x0) < 18) continue;
    return { x: x, y: gy };
  }
  return null;
}
TASKS.plant_trees = function (p, t) {
  const c = colById(p.col); if (!c) return "done";
  if (!t.spot) { t.spot = groveSpot(p, c); if (!t.spot) { t.none = (t.none || 0) + 1; if (t.none > 5) return "done"; return TASKS.wander(p, t); } }
  const r = goTo(p, t.spot.x, t.spot.y, 1, 3);
  if (r === "fail") { markBad(p, t.spot.x, 0, 4000); t.spot = null; return; }
  if (r === "arrive") {
    if (!pixelMap[t.spot.x][t.spot.y]) createPixel("hz_sapling", t.spot.x, t.spot.y);
    t.spot = null; t.n = (t.n || 0) + 1; p.sk.wood += 0.2;
    if (t.n >= 3) return "done";
  }
};

/* ---- mining -------------------------------------------------------------- */
// stone-like ground that yields stone; everything else dug in a quarry is just spoil
const STONY = { rock: 1, gravel: 1, basalt: 1, granite: 1, limestone: 1, slate: 1, marble: 1, sandstone: 1, tuff: 1, quartz: 1, rock_wall: 1, packed_sand: 0, iron_ore: 1, ore: 1, raw_iron: 1, cobblestone: 1 };
const isStony = (o) => !!o && STONY[o.element] === 1 && !o.hzb2;
const DIGGABLE = (o) => !!o && !isPerson(o) && !elements[o.element].hzb && !elements[o.element].fdn && (groundish(o) || isStony(o) || isSoft(o) || o.element === "plant" || o.element === "hz_crop" || o.element === "hz_sapling");
const BRICKY = { dirt: 1, mud: 1, clay: 1, clay_soil: 1, hz_earth: 1, sand: 1, packed_sand: 1, gravel: 1 };
function mineYield(p, o, c) {
  if (!isStony(o)) { if (BRICKY[o.element]) { p.inv.stone = (p.inv.stone || 0) + 0.5; p.sk.mine += 0.3; } return; }   // earth is fired into bricks
  p.inv.stone = (p.inv.stone || 0) + 1; p.sk.mine++;
  const deep = clamp((o.y - (c ? c.y : o.y)) / 10, 0, 1);
  if (rnd() < 0.08 + deep * 0.12 || o.element === "iron_ore" || o.element === "raw_iron") p.inv.iron = (p.inv.iron || 0) + 1;
  if (rnd() < 0.03 + deep * 0.02) p.inv.powder = (p.inv.powder || 0) + 1;   // saltpetre & sulphur veins
}
function exposedRock(p, c) {
  return H2.findNear(p.x, p.y, 30, (q) => isStony(q) && !isBad(p, q.x, q.y) && (isFree(q.x - 1, q.y) && isFree(q.x - 1, q.y - 1) || isFree(q.x + 1, q.y) && isFree(q.x + 1, q.y - 1)) && !(c && Math.abs(q.x - c.x) < 10 && c.hall) && !builtAbove(q.x, q.y));
}
// a stepped open-cast quarry outside the village: each column is dug one cell deeper than the last, so it is always walkable
function planQuarry(c) {
  const order = [];
  for (const side of (c.groveSide ? [-c.groveSide, c.groveSide] : [1, -1])) {
    const e = c.ext ? (side > 0 ? c.ext[1] - c.x : c.x - c.ext[0]) + 8 : 0;          // just outside the built-up town (short walks for miners)
    for (let d = Math.max(16, e); d <= Math.max(48, e + 26); d += 3) order.push(c.x + side * d);
    for (let d = Math.max(16, e) - 3; d >= 10; d -= 3) order.push(c.x + side * d);    // cramped land: closer is better than nothing
  }
  // prefer a long, deep cut; on cramped land settle for a smaller pit
  for (const L of [20, 13, 8]) for (const x0 of order) {
    const dir = Math.sign(x0 - c.x) || 1;
    if (x0 < 3 || x0 > width - 4 || x0 + dir * (L + 2) < 3 || x0 + dir * (L + 2) > width - 4) continue;
    if (!ownTerritory(c, x0) || !ownTerritory(c, x0 + dir * L)) continue;
    const g0 = columnGround(x0); if (g0 < 4) continue;
    let ok = true;
    for (let j = -1; j <= L + 2 && ok; j++) {
      const x = x0 + dir * j;
      for (let y = 0; y < height; y++) { const o = pixelMap[x][y]; if (!o) continue; if (elements[o.element].hzb || elements[o.element].fdn || isTreePart(o) || elements[o.element].state === "liquid") ok = false; if (!isPerson(o) && !isSoft(o) && kindOf(o) === 2 && o.element !== "hz_crop" && o.element !== "hz_sapling") break; }
      if (ok && H2.reserved(c, x, g0)) ok = false;
    }
    if (!ok) continue;
    const cells = [];
    for (let j = 0; j <= L; j++) {
      const x = x0 + dir * j, bottom = Math.min(height - 3, g0 + 1 + Math.min(j, 12));
      const top = columnGround(x) + 1; if (top < 1) continue;
      for (let y = top; y <= bottom; y++) cells.push([x, y]);
    }
    c.quarry = { x0: x0, dir: dir, cells: cells, i: 0, L: L };
    return c.quarry;
  }
  return null;
}
// a finished (or abandoned) pit gets a ladder against its deep wall so nobody is ever trapped down there
function ladderQuarry(Q) {
  if (!Q || Q.ladder || !Q.L) return;
  Q.ladder = true;
  let xe = -1;
  for (let j = Q.L; j >= 0; j--) { const x = Q.x0 + Q.dir * j; if (Q.cells.some((cc, k) => k < Q.i && cc[0] === x)) { xe = x; break; } }
  if (xe < 0) return;
  const xw = xe + Q.dir, gw = columnGround(xw); if (gw < 1) return;
  let yb = gw; while (yb < height - 1 && !pixelMap[xe][yb + 1]) yb++;
  if (yb - gw < 3) return;
  for (let y = gw; y <= yb; y++) if (!pixelMap[xe][y]) { createPixel("hz_ladder", xe, y); const o = pixelMap[xe][y]; if (o) o.hzb2 = 1; }
  H2.hasLadders = true;
}
H2.ladderQuarry = ladderQuarry;
TASKS.mine = function (p, t) {
  if (carrying(p) >= CARRY_MAX) return "done";
  const c = colById(p.col); if (!c) return "done";
  // 1. loose rock lying open at the surface
  if (!t.q && (!t.rock || t.rock.del || !isStony(t.rock))) {
    t.rock = exposedRock(p, c); t.n = 0;
    if (!t.rock) t.q = true;
  }
  if (!t.q) {
    const side = isFree(t.rock.x - 1, t.rock.y) ? -1 : isFree(t.rock.x + 1, t.rock.y) ? 1 : 0;
    const tx = side ? t.rock.x + side : t.rock.x, ty = t.rock.y;
    const r = goTo(p, tx, ty, 0, 2);
    if (r === "fail") { markBad(p, t.rock.x, t.rock.y, 3000); t.rock = null; return; }
    if (r === "arrive") {
      t.n++;
      if (t.n >= 9 - Math.min(4, Math.floor(p.sk.mine / 8))) { const o = t.rock; deletePixel(o.x, o.y); mineYield(p, o, c); t.rock = null; t.q = false; }
    }
    return;
  }
  // 2. the quarry
  let Q = c.quarry;
  if (!Q || Q.i >= Q.cells.length) { ladderQuarry(Q); Q = planQuarry(c); if (!Q) { t.none = (t.none || 0) + 1; if (t.none > 6) { H2.noRocks = pixelTicks; return "fail"; } return TASKS.wander(p, t); } }
  let cell = Q.cells[Q.i];
  // skip cells that are already empty or must not be dug (water next to it would flood the pit)
  let guard = 0;
  while (cell && guard++ < 40) {
    const o = at(cell[0], cell[1]);
    const wet = [[1, 0], [-1, 0], [0, -1]].some((d) => { const n = at(cell[0] + d[0], cell[1] + d[1]); return n && elements[n.element] && elements[n.element].state === "liquid"; });
    if (wet) { Q.i = Q.cells.length; return "done"; }
    if (o && DIGGABLE(o)) break;
    if (o && !isPerson(o) && !DIGGABLE(o) && !o.del) { Q.i = Q.cells.length; return "done"; }   // something built there meanwhile
    if (o && isPerson(o)) return;                                                                 // wait
    if (o && builtAbove(cell[0], cell[1])) { Q.i++; cell = Q.cells[Q.i]; continue; }             // never undermine a building
    Q.i++; cell = Q.cells[Q.i];
  }
  if (!cell) return "done";
  // stall guard: a cell nobody can reach is skipped; a pit that keeps stalling is abandoned for a fresh one
  if (Q.lastI !== Q.i) { Q.lastI = Q.i; Q.stall = 0; }
  if (++Q.stall > 260) { Q.i++; Q.stall = 0; Q.skips = (Q.skips || 0) + 1; if (Q.skips > 4) { ladderQuarry(Q); c.quarry = null; return "done"; } return; }
  const reach = Math.abs(p.x - cell[0]) <= 2 && Math.abs(p.y - cell[1]) <= 2 && p.y <= cell[1] + 1;
  const r = reach ? "arrive" : goTo(p, cell[0] - Q.dir, cell[1], 1, 3);
  if (r === "fail") { t.qf = (t.qf || 0) + 1; if (t.qf > 2) { Q.i++; t.qf = 0; } return; }
  if (r !== "arrive") return;
  t.n = (t.n || 0) + 1;
  const o = at(cell[0], cell[1]); if (!o) { Q.i++; return; }
  if (t.n >= (isStony(o) ? 7 : 3) - Math.min(3, Math.floor(p.sk.mine / 10))) {
    t.n = 0; deletePixel(o.x, o.y); mineYield(p, o, c); Q.i++; Q.skips = 0;
    // remember the open pit so nobody builds on its edge
    const pits = c.pits || (c.pits = []); const last = Q.pit;
    if (last) { last[0] = Math.min(last[0], o.x); last[1] = Math.max(last[1], o.x); } else { Q.pit = [o.x, o.x]; pits.push(Q.pit); }
  }
};
function builtAbove(x, y) {
  for (let xx = x - 1; xx <= x + 1; xx++) for (let yy = y - 1; yy >= Math.max(0, y - 14); yy--) { const o = at(xx, yy); if (o && !isPerson(o) && (elements[o.element].hzb || elements[o.element].fdn)) return true; }
  return false;
}
function isFree(x, y) { return inb(x, y) && !pixelMap[x][y]; }

/* ---- farming -------------------------------------------------------------- */
const SOIL = { dirt: 1, grass: 1, soil: 1, mud: 1, farmland: 1 };
function farmSpot(p, c) {
  for (let tries = 0; tries < 30; tries++) {
    // fields lie around the town (and in the gardens between its houses): up to ~30 cells beyond the built-up area
    const side = rnd() < 0.5 ? -1 : 1, e = c.ext ? Math.min(26, Math.max(8, side > 0 ? c.ext[1] - c.x : c.x - c.ext[0]) + 3) : 9;
    const x = clamp(c.x + side * (tries % 3 === 2 ? rint(4, e) : rint(e, e + 30)), 2, width - 3);
    if (H2.ownTerritory && !H2.ownTerritory(c, x)) continue;
    if (onPit(x - 1, x + 1)) continue;
    const gy = groundY(x, clamp(c.y - 10, 0, height - 2), 24);
    if (gy < 1) continue;
    const b = at(x, gy + 1); if (!b || !SOIL[b.element]) continue;
    if (at(x - 1, gy) || at(x + 1, gy)) continue;     // keep a gap between plants
    let bad = false;
    for (let dx = -2; dx <= 2 && !bad; dx++) for (let dy = -3; dy <= 0; dy++) { const o = at(x + dx, gy + dy); if (o && elements[o.element].hzb) { bad = true; break; } }
    if (bad || (H2.reserved && H2.reserved(c, x, gy))) continue;
    return { x: x, y: gy };
  }
  return null;
}
TASKS.farm = function (p, t) {
  const c = colById(p.col); if (!c) return "done";
  if ((p.inv.grain || 0) >= CARRY_MAX) return "done";
  // 1. harvest something ripe
  if (!t.crop || t.crop.del || !(t.crop.element === "wheat" || (t.crop.element === "hz_crop" && t.crop.g >= 1))) {
    t.crop = null;
    const list = H2.crops || [];
    let best = null, bd = 60;
    for (const q of list) { if (q.del || q.g < 1 || isBad(p, q.x, q.y)) continue; const d = Math.abs(q.x - p.x) + Math.abs(q.y - p.y) * 0.5; if (d < bd) { bd = d; best = q; } }
    if (!best) best = H2.findNear(p.x, p.y, 15, (q) => q.element === "wheat");
    t.crop = best;
  }
  if (t.crop) {
    const r = goTo(p, t.crop.x, t.crop.y, 1, 3);
    if (r === "fail") { markBad(p, t.crop.x, t.crop.y); t.crop = null; return; }
    if (r === "arrive") {
      const cx = t.crop.x, cy = t.crop.y, wasCrop = t.crop.element === "hz_crop";
      deletePixel(cx, cy); t.crop = null;
      p.inv.grain = (p.inv.grain || 0) + (wasCrop ? 2 : 1); p.sk.farm++;
      if (rnd() < 0.9 && inb(cx, cy + 1) && at(cx, cy + 1) && SOIL[at(cx, cy + 1).element]) createPixel("hz_crop", cx, cy);
    }
    return;
  }
  // 2. plant new ones (until the field is large enough)
  const want = Math.round(c.pop * 0.9 + 4);
  if ((H2.crops || []).filter((q) => !q.del && Math.abs(q.x - c.x) < 60).length < want) {
    if (!t.spot) { t.spot = farmSpot(p, c); if (!t.spot) { t.none = (t.none || 0) + 1; if (t.none > 6) return "fail"; return TASKS.wander(p, t); } }
    const r = goTo(p, t.spot.x, t.spot.y, 1, 3);
    if (r === "fail") { markBad(p, t.spot.x, t.spot.y); t.spot = null; return; }
    if (r === "arrive") { if (!pixelMap[t.spot.x][t.spot.y]) createPixel("hz_crop", t.spot.x, t.spot.y); t.spot = null; p.sk.farm += 0.2; }
    return;
  }
  // 3. nothing to do right now — tend the field
  t.idle = (t.idle || 0) + 1; if (t.idle > 120) return "done";
  return TASKS.wander(p, t);
};

/* ---- baking, smithing --------------------------------------------------- */
TASKS.bake = function (p, t) {
  const c = colById(p.col); if (!c) return "done";
  const oven = H2.nearestOf(stationsOf("oven", c), p.x, p.y, 140);
  if (!oven) return "done";
  const r = goTo(p, oven.x, accY(oven), 2, 4);
  if (r === "fail") return "done";
  if (r !== "arrive") return;
  if (c.stock.grain >= 2) {
    t.n = (t.n || 0) + 1;
    if (t.n >= 30) { c.stock.grain -= 2; const mill = stationsOf("mill", c).length; c.stock.bread += mill ? 4 : 3; t.n = 0; p.sk.smith += 0.1; c.stock.wood -= 0.25; if (c.stock.wood < 0) c.stock.wood = 0; }
  } else { t.idle = (t.idle || 0) + 1; if (t.idle > 60) return "done"; }
};
const CRAFT = { spear: { wood: 2 }, sword: { iron: 2 }, armor: { iron: 3 }, bow: { wood: 3 }, cannon: { iron: 6, powder: 2 } };
function craftWanted(c) {
  const s = c.stock, soldiers = c.sold || 0;
  const archers = H2.people.filter((q) => q.col === c.id && (q.job === "soldier" || q.job === "sentry") && isArcher(q)).length;
  const melee = Math.max(0, soldiers - archers);
  const can = (k) => { const need = CRAFT[k]; for (const g in need) if ((s[g] || 0) < need[g]) return false; return true; };
  if (c.tech >= 2 && c.tension >= 2 && can("cannon") && (s.cannon + (c.built.cannon || 0)) < Math.max(1, Math.floor((c.adults || 0) / 6))) return "cannon";
  if (c.tech >= 1 && s.armor < soldiers && can("armor")) return "armor";
  if (c.tech >= 1 && s.sword < melee && can("sword")) return "sword";
  if (s.bow < archers && can("bow")) return "bow";
  return null;
}
TASKS.smith = function (p, t) {
  const c = colById(p.col); if (!c) return "done";
  const anvil = H2.nearestOf(stationsOf("forge", c), p.x, p.y, 140);
  if (!anvil) return "done";
  const r = goTo(p, anvil.x, accY(anvil), 2, 4);
  if (r === "fail") return "done";
  if (r !== "arrive") return;
  if (!t.item) { t.item = craftWanted(c); t.n = 0; if (!t.item) { t.idle = (t.idle || 0) + 1; if (t.idle > 50) return "done"; return; } }
  t.n++;
  if (t.n % 6 === 0 && isEmpty(anvil.x, anvil.y - 1) && rnd() < 0.5) createPixel("spark" in elements ? "spark" : "fire", anvil.x, anvil.y - 1);
  if (t.n >= 45 - Math.min(15, Math.floor(p.sk.smith))) {
    const need = CRAFT[t.item]; let ok = true;
    for (const g in need) if ((c.stock[g] || 0) < need[g]) ok = false;
    if (ok) {
      for (const g in need) c.stock[g] -= need[g];
      c.stock[t.item] = (c.stock[t.item] || 0) + 1; p.sk.smith++; c.crafts = (c.crafts || 0) + 1;
      checkTech(c);
    }
    t.item = null;
  }
};
function checkTech(c) {
  const n = c.crafts || 0;
  if (c.tech < 1 && n >= 3) { c.tech = 1; chronicle(c.name + "'s smiths master iron-working: swords and armour can now be forged.", true, c.fac); }
  else if (c.tech < 2 && n >= 12 && c.stock.powder >= 1) { c.tech = 2; chronicle(c.name + " discovers gunpowder! Cannons will soon be cast.", true, c.fac); }
  else if (c.tech < 3 && n >= 28 && elements.left_bullet) { c.tech = 3; chronicle(c.name + " has gunsmiths now — riflemen march!", true, c.fac); }
}

/* ---- equipment ------------------------------------------------------------ */
TASKS.equip = function (p, t) {
  const c = colById(p.col); if (!c) return "done";
  const rack = H2.nearestOf(stationsOf("rack", c), p.x, p.y, 140);
  const tgt = rack || (c.hall ? { x: c.hall.x, y: c.hall.y, ay: c.hall.y } : null);
  if (!tgt) return "done";
  const r = goTo(p, tgt.x, accY(tgt), 2, 4);
  if (r === "fail") return "done";
  if (r !== "arrive") return;
  const s = c.stock;
  if (!isArcher(p)) {
    if (c.tech >= 3 && s.rifle > 0) { s.rifle--; p.wpn = "rifle"; }
    else if (s.sword > 0 && p.wpn !== "sword") { s.sword--; p.wpn = "sword"; }
    else if (!p.wpn) p.wpn = "spear";
  } else {
    if (s.bow > 0 && p.wpn !== "bow") { s.bow--; p.wpn = "bow"; } else if (!p.wpn) p.wpn = "spear";
  }
  if ((p.arm || 0) < 1 && s.armor > 0) { s.armor--; p.arm = 1; addThought(p, "armed", 4, DAY); }
  return "done";
};

/* ---- healing -------------------------------------------------------------- */
function patientOf(c, doc) {
  let best = null, bd = 80;
  for (const q of H2.people) {
    if (q.col !== c.id || q === doc || q.dead) continue;
    if (!(q.bleed > 0.1 || q.hp < 60 || (q.sick && !q.treated && q.sick.k !== "cold") || q.leg)) continue;
    if (q.cured && pixelTicks - q.cured < 300) continue;
    const d = Math.abs(q.x - doc.x) + Math.abs(q.y - doc.y); if (d < bd) { bd = d; best = q; }
  }
  return best;
}
TASKS.doctor = function (p, t) {
  const c = colById(p.col); if (!c) return "done";
  if (c.stock.herbs < 3 && !t.pat) {
    // gather herbs from the meadow
    if (!t.herb || t.herb.del) { t.herb = H2.findNear(p.x, p.y, 28, (q) => q.element === "grass" || (q.element === "plant" && !isEl(at(q.x, q.y + 1), "wood"))); }
    if (t.herb) { const r = goTo(p, t.herb.x, t.herb.y, 1, 3); if (r === "arrive") { deletePixel(t.herb.x, t.herb.y); c.stock.herbs += 1; t.herb = null; } else if (r === "fail") t.herb = null; return; }
  }
  if (!t.pat || t.pat.dead || t.pat.del) t.pat = patientOf(c, p);
  if (t.pat) {
    const r = goTo(p, t.pat.x, t.pat.y, 1, 3);
    if (r === "fail") { t.pat = null; return; }
    if (r === "arrive") {
      const q = t.pat;
      if (c.stock.herbs >= 1) {
        c.stock.herbs -= 1; q.bleed = 0; q.hp = Math.min(100, q.hp + 20 + p.sk.heal); q.treated = true; q.cured = pixelTicks; if (q.leg && c.stock.herbs >= 0) { q.leg = 0; }
        p.sk.heal += 0.5; addThought(q, "healed", 6, DAY);
        if (q.sick && rnd() < 0.35 + p.sk.heal * 0.01) { const k = q.sick.k; q.imm.push(k); q.sick = null; q.treated = false; if (k === "plague") chronicle(nm(p) + " cured " + nm(q) + " of the plague!", true, p.fac); }
      }
      t.pat = null;
    }
    return;
  }
  // wait at the hospital or the hall
  const hosp = H2.nearestOf(stationsOf("hospital", c), p.x, p.y, 140);
  const tg = hosp || (c.hall ? { x: c.hall.x, y: c.hall.y } : { x: c.x, y: c.y });
  const r = goTo(p, tg.x, accY(tg), 4, 4);
  t.idle = (t.idle || 0) + 1; if (t.idle > 100) return "done";
};
H2.healSeek = function (p, c) {
  // find any doctor who is alive; wait for them, preferably in the hospital
  const doc = H2.people.find((q) => q.col === c.id && q.job === "doctor" && !q.dead);
  const hosp = H2.nearestOf(stationsOf("hospital", c), p.x, p.y, 140);
  if (hosp && (doc || true)) return setTask(p, "hospital", { sx: hosp.x, sy: accY(hosp), until: pixelTicks + 600 }, 65);
  if (doc) return setTask(p, "rest", { until: pixelTicks + 500 }, 65);
  return false;
};
TASKS.hospital = function (p, t) {
  if (pixelTicks > t.until || (p.hp > 85 && !p.bleed && !p.sick)) return "done";
  const r = goTo(p, t.sx, t.sy, 4, 4);
  if (r === "fail") return "done";
};

/* ---- law & order ----------------------------------------------------------- */
TASKS.patrol = function (p, t) {
  const c = colById(p.col); if (!c) return "done";
  if (!t.tx) { t.tx = clamp(c.x + rint(-22, 22), 2, width - 3); t.ty = c.y; }
  const r = goTo(p, t.tx, t.ty, 1, 8);
  if (r === "fail" || r === "arrive") { t.tx = 0; t.w = (t.w || 0) + 1; if (t.w > 6) return "done"; }
  if (pixelTicks % 12 === 0) {
    for (const q of H2.people) {
      if (q.wanted && q.col === c.id && !q.jail && Math.abs(q.x - p.x) < 18 && Math.abs(q.y - p.y) < 8) { setTask(p, "arrest", { tid: q.id, work: true }, 60); return; }
    }
  }
};
TASKS.arrest = function (p, t) {
  const q = H2.byId[t.tid]; if (!q || q.dead || !q.wanted) return "done";
  const r = goTo(p, q.x, q.y, 1, 3);
  if (r === "fail") return "done";
  if (r === "arrive") {
    q.wanted = 0; q.jail = pixelTicks + 700; q.task = null;
    const c = colById(p.col); if (c) { c.stock.coin += Math.min(q.coin, 4); q.coin = Math.max(0, q.coin - 4); }
    chronicle(nm(p) + " arrested " + nm(q) + " and locked them in the stocks.", false, p.fac);
    addThought(q, "arrested", -12, DAY * 2); p.sk.fight += 0.5;
    return "done";
  }
};
TASKS.stocks = function (p, t) {
  if (!p.jail || pixelTicks > p.jail) { p.jail = 0; return "done"; }
  const c = colById(p.col); if (!c) { p.jail = 0; return "done"; }
  const h = hallSpot(c);
  const r = goTo(p, h.x + 3, h.y, 1, 6);
};

/* ---- burying the dead ------------------------------------------------------ */
TASKS.bury = function (p, t) {
  const c = colById(p.col); if (!c) return "done";
  if (!t.s) {
    const cp = H2.byId[t.cid];
    if (!cp || !cp.dead || cp.del) { return "done"; }
    const r = goTo(p, cp.x, cp.y, 1, 3);
    if (r === "fail") { c.corpses = c.corpses.filter((q) => q.id !== t.cid); return "done"; }
    if (r === "arrive") {
      p.carry = { name: cp.name, age: Math.floor(ageOf(cp) / DAY), cause: cp.cause, born: cp.b };
      cp.quiet = true; const h = isChildPx(cp) ? null : headOf(cp); if (h) { h.quiet = true; deletePixel(h.x, h.y); }
      deletePixel(cp.x, cp.y);
      c.corpses = c.corpses.filter((q) => q.id !== t.cid);
      t.s = 1;
      if (!c.grave) { const side = rnd() < 0.5 ? -1 : 1; c.grave = { x: clamp(c.x + side * rint(26, 34), 3, width - 4), dir: side, n: 0 }; }
    }
    return;
  }
  const g = c.grave; const gx = clamp(g.x + g.dir * 2 * g.n, 2, width - 3);
  const r = goTo(p, gx, p.y, 1, 8);
  if (r === "fail") { p.carry = null; return "done"; }
  if (r === "arrive") {
    const gy = groundY(gx, clamp(p.y - 6, 0, height - 2), 20);
    if (gy > 0 && p.carry) {
      createPixel("hz_gravestone", gx, gy);
      const s = at(gx, gy);
      if (s) { s.epitaph = "Here lies " + p.carry.name + ", aged " + p.carry.age + " days. " + (p.carry.cause ? "Died of " + p.carry.cause + "." : ""); s.fac = p.fac; }
      g.n++;
      if (rnd() < 0.5 && elements.flower_seed === undefined && elements.pink_flower === undefined) { /* nothing */ }
    }
    p.carry = null; p.sk.heal += 0.1;
    return "done";
  }
};

/* ---- buying food ------------------------------------------------------------ */
H2.buyFood = function (p, c, t) {
  const spot = H2.nearestOf(stationsOf("market", c, 100).concat(stationsOf("chest", c, 100)), p.x, p.y, 200) || (c.hall ? { x: c.hall.x, y: c.hall.y, ay: c.hall.y } : null);
  const tx = spot ? spot.x : c.x, ty = spot ? accY(spot) : c.y;
  const r = goTo(p, tx, ty, 3, 5);
  if (r === "fail") return "fail";
  if (r !== "arrive") return null;
  const s = c.stock, child = isChildPx(p);
  const price = Math.max(1, Math.ceil(c.price.bread));
  const hasBread = s.bread >= 1, hasGrain = s.grain >= 1;
  if (!hasBread && !hasGrain) { t.empty = (t.empty || 0) + 1; return t.empty > 3 ? "fail" : null; }
  const takeFood = () => { if (hasBread) { s.bread -= 1; p.hu = Math.min(100, p.hu + 55); } else { s.grain -= 1; p.hu = Math.min(100, p.hu + 20); } };
  if (child || p.coin >= price) {
    if (!child) { p.coin -= price; s.coin += price; }
    takeFood(); return p.hu > 75 ? "done" : null;
  }
  // can't pay
  if (p.hu < 18 && (trait(p, "g") > 0 || trait(p, "k") < 0 || p.mo < 30) && rnd() < 0.5) { // steal!
    takeFood(); p.wanted = pixelTicks; c.crimes++; c.tensionPts += 0;
    const witness = H2.people.find((q) => q !== p && q.col === c.id && Math.abs(q.x - p.x) < 14 && !q.sleeping);
    chronicle(nm(p) + " stole " + (hasBread ? "bread" : "grain") + " from the stores of " + c.name + (witness ? " — and " + nm(witness) + " saw it!" : "."), false, p.fac);
    if (witness) { addThought(witness, "crime", -3, DAY); p.fr[witness.id] = (p.fr[witness.id] || 0) - 20; }
    return "done";
  }
  if (p.hu < 25) { takeFood(); addThought(p, "charity", -3, DAY); return "done"; }       // the hall gives relief to the hungry
  t.empty = (t.empty || 0) + 1; return t.empty > 6 ? "fail" : null;
};
H2.crimeThink = function (p, c) {
  if (p.wanted && pixelTicks - p.wanted > 1500) p.wanted = 0;
  // petty theft of coins by greedy villagers who are poor
  if (p.coin < 2 && trait(p, "g") > 0.3 && trait(p, "k") < 0 && rnd() < 0.003 && c.pop > 5) {
    const v = H2.people.find((q) => q !== p && q.col === c.id && q.coin >= 8 && !q.sleeping && Math.abs(q.x - p.x) < 25);
    if (v) { setTask(p, "pickpocket", { vid: v.id }, 28); return true; }
  }
  return false;
};
TASKS.pickpocket = function (p, t) {
  const v = H2.byId[t.vid]; if (!v || v.dead) return "done";
  const r = goTo(p, v.x, v.y, 1, 3);
  if (r === "fail") return "done";
  if (r === "arrive") {
    const amt = Math.min(v.coin, rint(4, 10)); v.coin -= amt; p.coin += amt;
    const caught = rnd() < 0.5 - trait(p, "b") * 0.1 || v.id % 5 === 0;
    if (caught) { p.wanted = pixelTicks; v.fr[p.id] = -60; p.fr[v.id] = -40; addThought(v, "robbed", -10, DAY * 2); chronicle(nm(p) + " was caught stealing from " + nm(v) + "! The village talks of nothing else.", false, p.fac); const c = colById(p.col); if (c) c.crimes++; }
    return "done";
  }
};

/* ---- beds ------------------------------------------------------------------ */
H2.claimBed = function (p, c) {
  const beds = (H2.st.bed || []).filter((b) => !b.del && b.fac === p.fac && Math.abs(b.x - c.x) < 110 && ownedBy(b, c) && (!b.owner || !H2.byId[b.owner] || H2.byId[b.owner].dead));
  if (!beds.length) return null;
  let anchor = null;
  if (p.sp) { const s = H2.byId[p.sp]; if (s && s.home) anchor = s.home; }
  let best = null, bd = 1e9;
  for (const b of beds) { const d = anchor ? Math.abs(b.x - anchor.x) + Math.abs(b.y - anchor.y) * 2 : Math.abs(b.x - p.x) + Math.abs(b.y - p.y) * 0.5; if (d < bd) { bd = d; best = b; } }
  if (best) { best.owner = p.id; best.ownerName = p.first; p.home = { x: best.x, y: best.y }; if (p.warnedBed) p.warnedBed = false; }
  return best;
};

/* ---- idle soldiers etc. are in the war module ------------------------------ */
TASKS.stall = function (p, t) {
  const c = colById(p.col); if (!c) return "done";
  const s = H2.nearestOf(stationsOf("market", c), p.x, p.y, 140);
  if (!s) return TASKS.wander(p, t);
  const r = goTo(p, s.x, accY(s), 2, 4);
  t.idle = (t.idle || 0) + 1; if (t.idle > 150) return "done";
  if (r === "arrive" && H2.chat && rnd() < 0.1) H2.chat(p);
};

/* ---- chatting, friendships, love --------------------------------------------- */
H2.chat = function (p) {
  if ((p.chatT || 0) > pixelTicks) return;
  let o = null;
  for (const q of H2.people) { if (q === p || q.sleeping || q.dead) continue; if (Math.abs(q.x - p.x) <= 4 && Math.abs(q.y - p.y) <= 4 && (q.chatT || 0) <= pixelTicks) { o = q; break; } }
  if (!o) return;
  p.chatT = pixelTicks + 60; o.chatT = pixelTicks + 60;
  const ch1 = isChildPx(p), ch2 = isChildPx(o);
  if (ch1 !== ch2 && !(p.par.includes(o.id) || o.par.includes(p.id))) return;
  let aff = 3 + trait(p, "k") * 4 + trait(o, "k") * 4 + trait(p, "m") * 4 + trait(o, "m") * 4 - Math.abs(trait(p, "h") - trait(o, "h")) * 2;
  if (p.fac !== o.fac) { if ((colById(p.col) || {}).tension >= 3 || (colById(o.col) || {}).tension >= 3) return; aff -= 1; }
  aff += (rnd() - 0.45) * 4;
  const prev = p.fr[o.id] || 0;
  p.fr[o.id] = clamp(prev + aff, -100, 100); o.fr[p.id] = clamp((o.fr[p.id] || 0) + aff, -100, 100);
  addThought(p, "chat", 3, 400); addThought(o, "chat", 3, 400);
  const af = p.fr[o.id];
  if (prev < 40 && af >= 40 && p.fac === o.fac) chronicle(nm(p) + " and " + nm(o) + " have become close friends.", false, p.fac);
  if (af < -50 && !p.rival && p.fac === o.fac) { p.rival = o.id; o.rival = p.id; chronicle(nm(p) + " and " + nm(o) + " have developed a bitter rivalry.", false, p.fac); }
  // hot-headed rivals brawl
  if (p.rival === o.id && trait(p, "h") > 0.2 && rnd() < 0.15) { hurt(p, 3, "brawl", o); hurt(o, 4, "brawl", p); chronicle(nm(p) + " and " + nm(o) + " got into a fist fight!", false, p.fac); }
  // romance
  if (!ch1 && !ch2 && p.sex !== o.sex && stageOf(p) !== "child" && stageOf(o) !== "child" && af > 55 && rnd() < 0.25) {
    if (p.fac === o.fac && !p.sp && !o.sp && !(p.kids.includes(o.id) || p.par.includes(o.id))) marry(p, o);
    else if (p.fac !== o.fac && !p.lover && !o.lover && !p.sp && !o.sp) {
      p.lover = o.id; o.lover = p.id;
      chronicle("Star-crossed lovers: " + nm(p) + " of the " + FAC[p.fac].name + " and " + nm(o) + " of the " + FAC[o.fac].name + " have fallen for each other...", true, p.fac);
    }
  }
};
function marry(a, b) {
  a.sp = b.id; b.sp = a.id;
  const f = a.sex === "f" ? a : b, m = a.sex === "f" ? b : a;
  f.sn = m.sn; f.name = f.first + " " + f.sn;
  addThought(a, "wedding", 25, DAY * 3); addThought(b, "wedding", 25, DAY * 3);
  const c = colById(a.col); if (c && !c.festival) { c.festival = pixelTicks + 600; }
  chronicle(nm(m) + " and " + nm(f) + " were married!", true, a.fac);
  life(m, "Married " + nm(f) + ".", "marry"); life(f, "Married " + nm(m) + ".", "marry");
}
H2.marry = marry;
