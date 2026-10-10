
/* ======================================================================
   WORLD EVENTS: festivals, wandering traders, bandit raids, plague
   ----------------------------------------------------------------------
   A rate-limited scheduler (chained onto H2.everyTick) occasionally fires
   world events, and god-event spawner elements let the player trigger them
   by hand. Nomads (wandering traders, bandits) live in a hidden "nomad"
   colony that is flagged so the colony AI leaves it alone; they are detected
   as friends/foes by the p.nomad field rather than by faction, so they never
   pollute the two real factions' war or diplomacy.

   p.nomad values: "trader" (neutral pedlar) · "bandit" (hostile raider)
   nomad colony flags: c.nomad=true, c.nomadTrader / c.nomadBandit, c.famine=true
   ====================================================================== */

const BANDIT_COLOR = "#5a3a2a";

H2.events = {
  last: [], timers: {},
  trigger: function (name, x) {
    try {
      let ok = false;
      if (name === "festival") ok = startFestival(x);
      else if (name === "trader") ok = spawnTrader(x);
      else if (name === "bandits" || name === "raid") ok = startRaid(x);
      else if (name === "plague") ok = startPlague(x);
      if (ok) H2.events.timers[name === "raid" ? "bandits" : name] = pixelTicks;
      return ok;
    } catch (e) { H2.lastError = e; return false; }
  },
};
function logEvent(name, x) { H2.events.last.push({ name: name, t: pixelTicks, day: dayNumber(), x: x }); if (H2.events.last.length > 24) H2.events.last.shift(); }

/* ---- helpers ------------------------------------------------------------- */
function liveTowns() { return H2.cols.filter((c) => !c.nomad && (c.pop || 0) > 0); }
function eventsAllowed() { return H2.cfg.events !== false && liveTowns().length > 0 && H2.people.length < H2.cfg.maxPeople; }
function pickTown(x, list) {
  list = list || liveTowns(); if (!list.length) return null;
  if (x === undefined || x === null) return pick(list);
  let best = null, bd = 1e9;
  for (const c of list) { const d = Math.abs(c.x - x); if (d < bd) { bd = d; best = c; } }
  return best;
}
function removeCol(nc) { const i = H2.cols.indexOf(nc); if (i >= 0) H2.cols.splice(i, 1); }
function findEdgeGround(preferSide) {
  const sides = preferSide < 0 ? [-1, 1] : [1, -1];
  for (const side of sides) {
    const x0 = side < 0 ? 2 : width - 3;
    for (let dx = 0; dx < 20; dx++) {
      const x = clamp(x0 - side * dx, 2, width - 3);
      const gy = groundY(x, 2, height - 3);
      if (gy > 2 && isEmpty(x, gy) && isEmpty(x, gy - 1)) return { x: x, y: gy };
    }
  }
  return null;
}
function makeNomadColony(fac, x, y, flags) {
  const c = {
    id: H2.colSeq++, fac: fac, x: x, y: y, name: "Nomads", founded: pixelTicks, pop: 0,
    stock: { wood: 0, stone: 0, iron: 0, grain: 0, bread: 0, herbs: 0, powder: 0, coin: 0, sword: 0, armor: 0, cannon: 0, bow: 0 },
    price: { bread: 4, wood: 2, stone: 3, iron: 6, grain: 2 }, tax: 0.1,
    plans: [], corpses: [], deaths: 0, births: 0, tension: 0, tensionPts: 0, unrest: 0, hall: null, beds: 0, jobs: {},
    intel: { enemy: null, seen: {}, last: 0, estimate: null }, war: { state: "peace", since: pixelTicks, target: null, order: null },
    log: [], crimes: 0, built: {}, tech: 0, festival: 0, lastThink: 0,
    nomad: true, famine: true, empty: 0,
  };
  if (flags) Object.assign(c, flags);
  H2.cols.push(c);
  return c;
}
function despawnPerson(p) {
  if (!p || p.id === undefined || p.del) return;
  const c = colById(p.col);
  const h = isChildPx(p) ? null : headOf(p);
  p.quiet = true; if (h) h.quiet = true;
  try { if (h && !h.del) deletePixel(h.x, h.y); } catch (e) {}
  try { if (!p.del) deletePixel(p.x, p.y); } catch (e) {}
  p.del = true; p.dead = p.dead || pixelTicks;
  if (c) c.pop = Math.max(0, (c.pop || 1) - 1);
}

/* ---- 1. HARVEST FESTIVAL -------------------------------------------------- */
function festivalSquare(c) {
  const f = H2.nearestOf((H2.st.campfire || []).concat(H2.st.hall || []), c.x, c.y, 120);
  if (f) return { x: f.x, y: accY(f) };
  return { x: c.x, y: c.y };
}
function maybeFestivalWeddings(c) {
  const singles = H2.people.filter((p) => p.col === c.id && !p.dead && !p.nomad && !isChildPx(p) && !p.sp && stageOf(p) === "adult");
  let weddings = 0;
  for (const a of singles) {
    if (weddings >= 2) break;
    if (a.sp) continue;
    const b = singles.find((q) => q !== a && !q.sp && q.sex !== a.sex && q.fac === a.fac && !(a.kids.includes(q.id) || a.par.includes(q.id)));
    if (b && rnd() < 0.5) { try { marry(a, b); weddings++; } catch (e) {} }
  }
}
function startFestival(x) {
  const towns = liveTowns(); if (!towns.length) return false;
  const c = pickTown(x, towns); if (!c) return false;
  const dur = rint(700, 1100);
  c.festival = pixelTicks + dur;
  chronicle("A harvest festival begins in " + c.name + "! Villagers gather to feast and dance.", true, c.fac);
  const square = festivalSquare(c);
  const mine = H2.people.filter((p) => p.col === c.id && !p.dead && !p.nomad);
  let attend = 0;
  for (const p of mine) {
    if (attend >= 20) break;
    if (p.task && (p.task.pri || 0) > 60) continue;
    if (setTask(p, "festival", { until: c.festival, sx: square.x, sy: square.y }, 44)) { addThought(p, "festival", 10, dur); attend++; }
  }
  const sample = mine.slice().sort(() => rnd() - 0.5).slice(0, 4);
  for (const p of sample) life(p, "Danced at the harvest festival", "");
  maybeFestivalWeddings(c);
  logEvent("festival", c.x);
  return true;
}
TASKS.festival = function (p, t) {
  const c = colById(p.col); if (!c) return "done";
  if (!c.festival || pixelTicks > c.festival || pixelTicks > t.until) return "done";
  const r = goTo(p, t.sx + ((p.id % 7) - 3), t.sy, 2, 4);
  if (r === "fail") return "done";
  if (rnd() < 0.1 && !isNight()) shift(p, 0, -1);                 // a little dance hop
  if (r === "arrive") { addThought(p, "festival", 4, 300); if (H2.chat && rnd() < 0.12) H2.chat(p); }
};

/* ---- 2. WANDERING TRADER -------------------------------------------------- */
function spawnTrader(x) {
  if (!eventsAllowed()) return false;
  const towns = liveTowns(); if (!towns.length) return false;
  const tgt = pickTown(x, towns); if (!tgt) return false;
  const es = findEdgeGround(tgt.x > width / 2 ? 1 : -1); if (!es) return false;
  if (H2.people.length >= H2.cfg.maxPeople - 2) return false;
  const nc = makeNomadColony(tgt.fac, es.x, es.y, { name: "Wandering Traders", nomadTrader: true });
  const b = spawnPerson(es.x, es.y, tgt.fac, { col: nc.id, job: "merchant" });
  if (!b) { removeCol(nc); return false; }
  b.nomad = "trader"; b.title = ""; b.coin = rint(20, 40); b.color = "#caa23a";
  b.exotic = { iron: rint(2, 6), herbs: rint(2, 6), powder: rint(0, 4), bow: rint(0, 2) };
  b.trader = { to: tgt.id, phase: 0, t0: pixelTicks };
  setTask(b, "hz_trader", {}, 80);
  chronicle("A wandering trader approaches " + tgt.name + " with exotic wares.", true, tgt.fac);
  logEvent("trader", es.x);
  return true;
}
function traderSell(p, o) {
  let sold = 0;
  for (const g in (p.exotic || {})) {
    const q = p.exotic[g] || 0; if (!q) continue;
    const price = g === "bow" ? 10 : g === "iron" ? 6 : g === "powder" ? 5 : g === "herbs" ? 4 : 3;
    const pay = Math.min(q * price, Math.floor(o.stock.coin || 0));
    const qSold = Math.min(q, Math.floor(pay / price));
    if (qSold > 0) { o.stock[g] = (o.stock[g] || 0) + qSold; o.stock.coin -= qSold * price; p.coin += qSold * price; p.exotic[g] -= qSold; sold += qSold; }
  }
  if (sold > 0) {
    try { updateEconomy(o); } catch (e) {}
    chronicle("The wandering trader sells " + sold + " exotic wares in " + o.name + ".", false, o.fac);
    const v = H2.people.find((q) => q.col === o.id && !q.nomad && !isChildPx(q) && !q.dead);
    if (v) life(v, "Bought a trinket from a wandering trader", "");
  }
}
TASKS.hz_trader = function (p, t) {
  const tr = p.trader; if (!tr) return "done";
  const o = colById(tr.to);
  if (tr.phase === 0) {
    if (!o || (o.pop || 0) <= 0) { tr.phase = 2; return; }
    const spot = tradeSpot(o);
    const r = goTo(p, spot.x, spot.y, 3, 6);
    if (r === "arrive") { traderSell(p, o); tr.phase = 2; tr.leftT = pixelTicks; }
    else if (r === "fail") { tr.fail = (tr.fail || 0) + 1; if (tr.fail > 12) tr.phase = 2; }
    else if (pixelTicks - tr.t0 > DAY) tr.phase = 2;
    return;
  }
  // leave the map and vanish
  const side = p.x > width / 2 ? 1 : -1, ex = side > 0 ? width - 2 : 2;
  const r = goTo(p, ex, p.y, 1, 24);
  if (r === "arrive" || p.x <= 2 || p.x >= width - 2 || pixelTicks - (tr.leftT || tr.t0) > DAY) { despawnPerson(p); return "done"; }
  if (r === "fail") { tr.lf = (tr.lf || 0) + 1; if (tr.lf > 16) { despawnPerson(p); return "done"; } }
};

/* ---- 3. BANDIT RAID ------------------------------------------------------- */
function nearestVictim(p, R) {
  let best = null, bd = 1e9; const ppl = H2.people;
  for (let i = 0; i < ppl.length; i++) { const q = ppl[i]; if (q === p || q.nomad || q.dead) continue; const dx = Math.abs(q.x - p.x), dy = Math.abs(q.y - p.y); if (dx > R || dy > R) continue; const d = dx + dy; if (d < bd) { bd = d; best = q; } }
  return best;
}
function nearestBandit(p, R) {
  const list = H2._bandits; if (!list || !list.length) return null;
  let best = null, bd = 1e9;
  for (const b of list) { if (!b || b.dead || b.del || b.nomad !== "bandit") continue; const dx = Math.abs(b.x - p.x), dy = Math.abs(b.y - p.y); if (dx > R || dy > R) continue; const d = dx + dy; if (d < bd) { bd = d; best = b; } }
  return best;
}
function startRaid(x) {
  if (!eventsAllowed()) return false;
  const towns = liveTowns().filter((c) => (c.pop || 0) >= 3); if (!towns.length) return false;
  const tgt = pickTown(x, towns); if (!tgt) return false;
  const n = rint(3, 6);
  if (H2.people.length >= H2.cfg.maxPeople - n - 1) return false;
  const es = findEdgeGround(tgt.x > width / 2 ? 1 : -1); if (!es) return false;
  const nc = makeNomadColony(tgt.fac, es.x, es.y, { name: "Bandits", nomadBandit: true });
  const raid = { id: nc.id, col: nc.id, target: tgt.id, total: 0, members: [], retreat: false, t0: pixelTicks, loot: 0 };
  const sdir = es.x < width / 2 ? 1 : -1;
  let made = 0;
  for (let i = 0; i < n; i++) {
    const sx = clamp(es.x + i * sdir * 2, 2, width - 3);
    const gy = groundY(sx, 2, height - 3); if (gy < 2 || !isEmpty(sx, gy) || !isEmpty(sx, gy - 1)) continue;
    const b = spawnPerson(sx, gy, tgt.fac, { col: nc.id, job: "laborer" });
    if (!b) continue;
    b.nomad = "bandit"; b.title = "Bandit"; b.wpn = pick(["sword", "spear", "sword"]); b.arm = 0; b.color = BANDIT_COLOR; b.hp = 100;
    b.band = nc.id; b.raidCol = tgt.id;
    setTask(b, "hz_raid", {}, 80);
    raid.members.push(b.id); made++;
  }
  if (!made) { removeCol(nc); return false; }
  raid.total = made;
  if (!H2._raids) H2._raids = {};
  H2._raids[nc.id] = raid;
  chronicle("Bandits descend upon " + tgt.name + "!", true, tgt.fac);
  logEvent("bandits", es.x);
  return true;
}
TASKS.hz_raid = function (p, t) {
  const raid = H2._raids && H2._raids[p.band];
  if (!raid) return "done";
  const tgt = colById(p.raidCol);
  if (raid.retreat || !tgt || (tgt.pop || 0) <= 0) {
    const side = p.x > width / 2 ? 1 : -1, ex = side > 0 ? width - 2 : 2;
    const r = goTo(p, ex, p.y, 1, 24);
    if (r === "arrive" || p.x <= 2 || p.x >= width - 2) { despawnPerson(p); return "done"; }
    if (r === "fail") { p.rf = (p.rf || 0) + 1; if (p.rf > 18) { despawnPerson(p); return "done"; } }
    return;
  }
  // 1. attack a nearby villager
  const v = nearestVictim(p, 7);
  if (v) {
    const dx = v.x - p.x, dy = v.y - p.y; p.dir = Math.sign(dx) || p.dir;
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
      if (pixelTicks >= (p.cool || 0)) { const w = WEAPON[p.wpn || "sword"] || WEAPON.fist; p.cool = pixelTicks + 16; const dmg = w.dmg * (0.7 + rnd() * 0.5); v.lastHit = { c: "battle", t: pixelTicks, by: p.id }; hurt(v, dmg, "battle", p); p.sk.fight += 0.03; }
      return;
    }
    const r = goTo(p, v.x, v.y, 1, 3); if (r !== "fail") return;
  }
  // 2. plunder the stores
  const spot = tradeSpot(tgt);
  const r = goTo(p, spot.x, spot.y, 2, 6);
  if (r === "arrive") {
    if (pixelTicks >= (p.cool || 0)) {
      p.cool = pixelTicks + 30; let took = 0;
      for (const g of ["bread", "grain", "wood", "iron", "coin"]) { const take = Math.min(tgt.stock[g] || 0, rint(1, 3)); if (take > 0) { tgt.stock[g] -= take; raid.loot += take; took += take; } }
      if (took && rnd() < 0.12) chronicle("Bandits plunder the stores of " + tgt.name + ".", false, tgt.fac);
    }
  } else if (r === "fail") { p.sf = (p.sf || 0) + 1; if (p.sf > 10) { p.sf = 0; tryWalk(p, p.x < tgt.x ? 1 : -1, true); } }
};
// a hero's response to bandits: close in and strike (independent of the faction war system)
TASKS.hz_combat = function (p, t) {
  let q = H2.byId[t.tid];
  if (!q || q.dead || q.del || q.nomad !== "bandit") { q = nearestBandit(p, 20); if (!q) return "done"; t.tid = q.id; }
  const w = WEAPON[p.wpn || "fist"] || WEAPON.fist;
  const dx = q.x - p.x, dy = q.y - p.y; p.dir = Math.sign(dx) || p.dir;
  if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
    if (pixelTicks >= (p.cool || 0)) {
      p.cool = pixelTicks + 14; const dmg = w.dmg * (0.75 + rnd() * 0.5) * (1 + p.sk.fight * 0.012);
      q.lastHit = { c: "battle", t: pixelTicks, by: p.id }; hurt(q, dmg, "battle", p); p.sk.fight += 0.06;
      if (q.dead && q.nomad === "bandit" && !q._slain) { q._slain = 1; life(p, "Fought off bandits", "hero"); }
    }
    return;
  }
  const r = goTo(p, q.x, q.y, 1, 3); if (r === "fail") return "done";
};

/* ---- 4. PLAGUE ------------------------------------------------------------ */
function startPlague(x) {
  const towns = liveTowns().filter((c) => (c.pop || 0) >= 4); if (!towns.length) return false;
  const c = pickTown(x, towns); if (!c) return false;
  const cands = H2.people.filter((p) => p.col === c.id && !p.dead && !p.sick && !isChildPx(p) && !p.nomad);
  if (!cands.length) return false;
  c.plagueDead = 0;                                              // a fresh outbreak: the death toll is capped per outbreak
  infect(pick(cands), "plague");                                 // infect() writes its own (major) chronicle
  logEvent("plague", c.x);
  return true;
}

/* ---- nomad upkeep: keep raiders/traders out of the colony AI's hands ------ */
function nomadMaintain() {
  const cols = H2.cols; let anyNomad = false;
  for (const c of cols) if (c.nomad) { anyNomad = true; break; }
  if (!anyNomad) { if (H2._bandits && H2._bandits.length) H2._bandits.length = 0; return; }

  const bandits = [];
  for (let i = 0; i < H2.people.length; i++) {
    const p = H2.people[i]; if (!p.nomad || p.dead || p.del) continue;
    // a nomad must always live in its own hidden colony; if it leaked into a real
    // colony (e.g. its band colony was cleaned up while it was mid-stride), remove it
    const pc = colById(p.col);
    if (!pc || !pc.nomad) { despawnPerson(p); continue; }
    // re-assert identity after the colony job system may have meddled
    if (p.nomad === "bandit") { p.title = "Bandit"; p.color = BANDIT_COLOR; if (!p.wpn) p.wpn = "sword"; bandits.push(p); if (p.job !== "laborer") p.job = "laborer"; }
    else if (p.nomad === "trader") { p.color = "#caa23a"; if (p.job !== "merchant") p.job = "merchant"; }
    // keep the persistent nomad task alive (assignJobs clears tasks periodically)
    if (!p.task || (p.task.pri || 0) < 80) {
      if (p.panic > 0 || p.burning) { /* let the panic reflex run */ }
      else if (p.nomad === "bandit") setTask(p, "hz_raid", {}, 80);
      else if (p.nomad === "trader") setTask(p, "hz_trader", {}, 80);
    }
  }
  H2._bandits = bandits;

  // raids: retreat when half are down, clean up when the band is gone
  if (H2._raids) {
    for (const id in H2._raids) {
      const raid = H2._raids[id];
      let alive = 0;
      for (const mid of raid.members) { const b = H2.byId[mid]; if (b && !b.dead && !b.del) alive++; }
      raid.alive = alive;
      if (!raid.retreat && alive <= Math.floor(raid.total / 2)) {
        raid.retreat = true;
        const tgt = colById(raid.target);
        chronicle("The surviving bandits break and flee" + (tgt ? " " + tgt.name : "") + ".", true, tgt ? tgt.fac : -1);
      }
      if (alive === 0) delete H2._raids[id];
    }
  }

  // remove spent nomad colonies before the colony loop can grumble about them
  for (let i = cols.length - 1; i >= 0; i--) {
    const c = cols[i]; if (!c.nomad) continue;
    let live = 0;
    for (let j = 0; j < H2.people.length; j++) { const p = H2.people[j]; if (p.col === c.id && !p.dead && !p.del) { live++; break; } }
    if (!live) { c.pop = 0; cols.splice(i, 1); }
    else c.empty = 0;
  }
}

/* ---- scheduler ------------------------------------------------------------ */
function eventsSchedule() {
  const towns = liveTowns(); if (!towns.length) return;
  const T = H2.events.timers;
  const due = (k, cd) => pixelTicks - (T[k] === undefined ? -cd : T[k]) >= cd;
  if (due("festival", DAY * 2.5) && rnd() < 0.25) {
    const good = towns.filter((c) => (c.pop || 0) >= 4 && (c.stock.bread + c.stock.grain * 0.5) > c.pop * 2.2 && (!c.festival || pixelTicks > c.festival));
    if (good.length) H2.events.trigger("festival", pick(good).x);
  }
  if (due("trader", DAY * 2) && rnd() < 0.2) H2.events.trigger("trader");
  // hardships only strike settled, grown towns (a young colony gets a few days of grace)
  const settled = (c, pop, days) => (c.pop || 0) >= pop && pixelTicks - (c.founded || 0) > DAY * days;
  if (due("bandits", DAY * 4) && rnd() < 0.14) { const rich = towns.filter((c) => settled(c, 10, 3)); if (rich.length) H2.events.trigger("bandits", pick(rich).x); }
  if (due("plague", DAY * 8) && rnd() < 0.08) { const crowd = towns.filter((c) => settled(c, 14, 6)); if (crowd.length) H2.events.trigger("plague", pick(crowd).x); }
}
function eventsTick() {
  if (H2.cfg.events === false) { if (H2._bandits && H2._bandits.length) H2._bandits.length = 0; return; }
  try { nomadMaintain(); } catch (e) { H2.lastError = e; }
  if (pixelTicks % 90 === 30) { try { eventsSchedule(); } catch (e) { H2.lastError = e; } }
}

/* ---- bandit reflex: wrap the war-reflex so everyone reacts to raiders ----- */
const _h2_warThink_prevEV = H2.warThink;
H2.warThink = function (p, col) {
  if (p.nomad) return false;                                     // nomads run their own tasks
  if (H2._bandits && H2._bandits.length && !p.burning && !(p.panic > 2)) {
    const b = nearestBandit(p, 15);
    if (b) {
      const def = p.job === "soldier" || p.job === "sentry" || p.job === "guard" || p.job === "scout";
      if (def || (trait(p, "b") > 0.25 && !isChildPx(p) && p.hp > 45 && Math.abs(b.x - p.x) <= 4)) {
        return setTask(p, "hz_combat", { tid: b.id }, 92);
      }
      p.panic = Math.max(p.panic || 0, 3);
      return setTask(p, "flee", { until: pixelTicks + 90, from: b.x }, 96);
    }
  }
  return _h2_warThink_prevEV ? _h2_warThink_prevEV(p, col) : false;
};

/* ---- shield the hidden nomad colonies from the colony AI ------------------ */
const _h2_planBuild_prevEV = H2.planBuild;
H2.planBuild = function (c) { if (c && c.nomad) return; return _h2_planBuild_prevEV ? _h2_planBuild_prevEV(c) : undefined; };
const _h2_warThinkColony_prevEV = H2.warThinkColony;
H2.warThinkColony = function (c) { if (c && c.nomad) return; return _h2_warThinkColony_prevEV ? _h2_warThinkColony_prevEV(c) : undefined; };

/* ---- scheduler hook (chain, never overwrite) ------------------------------ */
const _h2_everyTick_prevEV = H2.everyTick;
H2.everyTick = function () {
  if (_h2_everyTick_prevEV) { try { _h2_everyTick_prevEV(); } catch (e) { H2.lastError = e; } }
  try { eventsTick(); } catch (e) { H2.lastError = e; }
};

/* ---- god-event spawner elements ------------------------------------------- */
function eventSpawner(name, evt, colors, desc) {
  elements[name] = {
    category: "villagers", color: colors, state: "solid", behavior: behaviors.WALL, excludeRandom: true,
    maxSize: 1, cooldown: defaultCooldown, desc: desc, forceSaveColor: true,
    onPlace: function (pixel) {
      const x = pixel.x, y = pixel.y;
      try { deletePixel(x, y); } catch (e) {}
      try { H2.events.trigger(evt, x); } catch (e) { H2.lastError = e; }
    },
  };
}
eventSpawner("hz_event_festival", "festival", ["#ffd27a", "#ff9a2e"], "God-event: starts a harvest festival in the nearest settlement.");
eventSpawner("hz_event_trader", "trader", ["#caa23a", "#e0c25a"], "God-event: sends a wandering trader to the nearest settlement.");
eventSpawner("hz_event_bandits", "bandits", ["#5a3a2a", "#7a2222"], "God-event: a band of bandits raids the nearest settlement.");
eventSpawner("hz_event_plague", "plague", ["#6b8f3a", "#3a5a2a"], "God-event: the plague strikes the nearest settlement.");
