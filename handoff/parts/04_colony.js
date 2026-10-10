
/* ======================================================================
   COLONIES: census, economy, job allocation
   ====================================================================== */
const PLACE_A = ["Oak","Stone","Raven","Elder","Willow","Iron","Silver","Thorn","Misty","Amber","Frost","Gold","Ash","Brook","Wolf","Hollow"];
const PLACE_B = ["haven","brook","moor","mere","hold","ford","stead","vale","wick","gate","fell","ton","reach","watch"];
function colById(id) { for (let i = 0; i < H2.cols.length; i++) if (H2.cols[i].id === id) return H2.cols[i]; return null; }
function newColony(fac, x, y) {
  const c = {
    id: H2.colSeq++, fac: fac, x: x, y: y, name: pick(PLACE_A) + pick(PLACE_B), founded: pixelTicks, pop: 0,
    stock: { wood: 30, stone: 10, iron: 4, grain: 6, bread: 10, herbs: 2, powder: 0, coin: 40, sword: 0, armor: 0, cannon: 0, bow: 0 },
    price: { bread: 4, wood: 2, stone: 3, iron: 6, grain: 2 }, tax: 0.1,
    plans: [], corpses: [], deaths: 0, births: 0, tension: 0, tensionPts: 0, unrest: 0, hall: null, beds: 0, jobs: {},
    intel: { enemy: null, seen: {}, last: 0, estimate: null }, war: { state: "peace", since: pixelTicks, target: null, order: null },
    log: [], crimes: 0, built: {}, tech: 0, festival: 0, lastThink: 0,
  };
  H2.cols.push(c);
  chronicle("A new " + FAC[fac].name + " settlement, " + c.name + ", is founded.", true, fac);
  return c;
}
function colonyFor(fac, x, y) {
  let best = null, bd = 1e9;
  for (const c of H2.cols) if (c.fac === fac) { const d = Math.abs(c.x - x); if (d < bd) { bd = d; best = c; } }
  if (best && bd < 70) return best;
  return newColony(fac, x, y);
}
function noteDeathForColony(c, p, killer) {
  c.log.push({ t: pixelTicks, k: "death", n: p.name });
  if (killer && killer.fac !== p.fac) { c.tensionPts += 6; const ec = colById(killer.col); if (ec) ec.tensionPts += 1; }
}
H2.colById = colById; H2.colonyFor = colonyFor;

/* ---- census: rebuild lists from the pixel set -------------------------- */
H2.bloodCount = 0;
function census(full) {
  const ppl = [], byId = {}, corpses = [];
  let maxId = 0, maxCol = 0;
  const cp = currentPixels;
  let blood = 0; const crops = [];
  for (let i = 0; i < cp.length; i++) {
    const p = cp[i]; if (p.del) continue;
    const e = p.element;
    if (full && e === "blood") blood++;
    if (full && e === "hz_crop") crops.push(p);
    if (e === "hz_body" || e === "hz_child") {
      if (p.id === undefined) continue;
      if (p.id > maxId) maxId = p.id; if (p.col > maxCol) maxCol = p.col;
      byId[p.id] = p;
      if (!p.dead) ppl.push(p); else corpses.push(p);
    }
  }
  H2.people = ppl; H2.byId = byId; H2.corpses = corpses;
  if (full) { H2.bloodCount = blood; H2.crops = crops; }
  if (maxId >= H2.idSeq) H2.idSeq = maxId + 1;
  if (maxCol >= H2.colSeq) H2.colSeq = maxCol + 1;
  // colonies: recompute headcounts
  const fp = [];
  for (const c of H2.cols) { c.pop = 0; c.kids = 0; c.adults = 0; c.sold = 0; c.jobs = {}; c.sick = 0; c.hungry = 0; c.moodSum = 0; }
  for (let i = 0; i < ppl.length; i++) {
    let c = colById(ppl[i].col);
    if (!c) { c = colonyFor(ppl[i].fac, ppl[i].x, ppl[i].y); ppl[i].col = c.id; }
    if (c.fac !== ppl[i].fac) { /* defector */ }
    c.pop++; fp[c.fac] = (fp[c.fac] || 0) + 1;
    if (!c.founder) c.founder = ppl[i].first + " " + ppl[i].sn;
    if (isChildPx(ppl[i])) c.kids++; else { c.adults++; c.jobs[ppl[i].job] = (c.jobs[ppl[i].job] || 0) + 1; if (ppl[i].job === "soldier" || ppl[i].job === "sentry" || ppl[i].job === "scout") c.sold++; }
    if (ppl[i].sick) c.sick++; if (ppl[i].hu < 25) c.hungry++; c.moodSum += ppl[i].mo;
  }
  H2.facPop = fp;
  if (full) {
    const st = {};
    for (let i = 0; i < cp.length; i++) {
      const p = cp[i]; if (p.del) continue;
      const info = elements[p.element]; if (!info || !info.st) continue;
      (st[info.st] = st[info.st] || []).push(p);
    }
    H2.st = st;
    for (const c of H2.cols) {
      c.beds = 0;
      const halls = (st.hall || []).filter((s) => s.fac === c.fac && Math.abs(s.x - c.x) < 90 && ownedBy(s, c));
      const hall = H2.nearestOf(halls, c.x, c.y, 200);
      c.hall = hall ? { x: hall.x, y: hall.ay !== undefined ? hall.ay : hall.y } : null;
      if (hall) { c.x = hall.x; c.y = hall.ay !== undefined ? hall.ay : hall.y; }
      else if (c.pop > 0 && !c.site) { let sx = 0, n = 0, sy = 0; for (const p of ppl) if (p.col === c.id) { sx += p.x; sy += p.y; n++; } if (n) { c.x = Math.round(c.x * 0.9 + (sx / n) * 0.1); c.y = Math.round(c.y * 0.9 + (sy / n) * 0.1); } }
      for (const b of (st.bed || [])) if (b.fac === c.fac && Math.abs(b.x - c.x) < 100 && ownedBy(b, c)) c.beds++;
    }
  }
}
H2.census = census;
// buildings belong to the settlement that built them (cid); orphaned ones are claimed by whoever is nearest
function ownedBy(s, c) { if (s.cid === undefined || s.cid === c.id) return true; const o = colById(s.cid); return !o || (o.pop <= 0 && o.fac === c.fac); }
H2.ownedBy = ownedBy;
// access point of a station (the ground cell next to it)
const accY = (s) => (s.ay !== undefined ? s.ay : s.y);
H2.accY = accY;
function stationsOf(type, c, maxD) {
  const l = H2.st[type]; if (!l) return [];
  return l.filter((s) => !s.del && (s.fac === undefined || s.fac === c.fac) && Math.abs(s.x - c.x) < (maxD || 110) && ownedBy(s, c));
}
H2.stationsOf = stationsOf;

/* ---- economy ------------------------------------------------------------ */
const BASE_PRICE = { bread: 4, wood: 2, stone: 3, iron: 6, grain: 2 };
function updateEconomy(c) {
  const s = c.stock, pop = Math.max(2, c.pop);
  const food = s.bread + s.grain * 0.5;
  const sc = (stock, target) => clamp(2.2 - stock / Math.max(1, target), 0.5, 3);
  c.price.bread = Math.round(BASE_PRICE.bread * sc(food, pop * 3) * 10) / 10;
  c.price.wood = Math.round(BASE_PRICE.wood * sc(s.wood, 30 + pop * 3) * 10) / 10;
  c.price.stone = Math.round(BASE_PRICE.stone * sc(s.stone, 20 + pop * 2) * 10) / 10;
  c.price.iron = Math.round(BASE_PRICE.iron * sc(s.iron, 8 + pop) * 10) / 10;
  c.price.grain = Math.round(BASE_PRICE.grain * sc(s.grain, pop * 2) * 10) / 10;
  // tax rate follows the treasury: empty coffers => higher taxes => unrest
  c.tax = clamp(s.coin < 20 ? 0.25 : s.coin < 60 ? 0.15 : s.coin > 400 ? 0.03 : 0.1, 0.03, 0.3);
  // unrest: grows with hunger, taxes and sadness; shrinks when happy and fed
  const avgMood = c.pop ? c.moodSum / c.pop : 60;
  c.avgMood = avgMood;
  let u = c.unrest;
  u += (50 - avgMood) * 0.01 + (c.tax - 0.1) * 6 + (c.hungry / pop) * 3 - 0.15;
  if (food <= 0 && c.pop > 3) u += 1.2;
  c.unrest = clamp(u, 0, 100);
  if (c.unrest > 82 && !c.riot && c.pop >= 6) startRiot(c);
  if (c.riot && c.unrest < 40) { c.riot = false; chronicle("Calm returns to " + c.name + ".", true, c.fac); }
  if (food <= 0 && c.pop > 3 && !c.famine) { c.famine = true; chronicle("Famine strikes " + c.name + " — the granaries are empty!", true, c.fac); }
  if (food > pop * 2 && c.famine) { c.famine = false; chronicle("The famine in " + c.name + " is over.", true, c.fac); }
}
function startRiot(c) {
  c.riot = true; c.unrest = 70;
  chronicle("Riot in " + c.name + "! Angry villagers demand bread and lower taxes!", true, c.fac);
  c.tax = 0.03; c.stock.coin += 0; // the council gives in a little
  for (const p of H2.people) if (p.col === c.id && !isChildPx(p) && p.mo < 40 && rnd() < 0.4) { p.job = "laborer"; addThought(p, "protest", -6, DAY); }
}

/* ---- job allocation ------------------------------------------------------ */
function wantedJobs(c) {
  const a = c.adults, W = {};
  const war = c.war.state;
  W.farmer = Math.max(1, Math.round(a * 0.3));
  W.woodcutter = Math.max(1, Math.round(a * 0.17));
  W.miner = Math.max(1, Math.round(a * 0.12));
  W.builder = Math.max(c.plans.length && a >= 4 ? 2 : 1, Math.round(a * (c.plans.length ? (c.beds < c.pop || !c.hall ? 0.32 : 0.25) : 0.12)));
  const hasOven = stationsOf("oven", c).length > 0, hasForge = stationsOf("forge", c).length > 0, hasHosp = stationsOf("hospital", c).length > 0 || a >= 8;
  W.baker = hasOven ? 1 : 0; W.smith = hasForge ? (a >= 14 ? 2 : 1) : 0; W.doctor = hasHosp && a >= 6 ? 1 : 0;
  W.merchant = stationsOf("market", c).length && a >= 9 ? 1 : 0;
  W.guard = c.hall && a >= 7 ? 1 + Math.floor(a / 18) : 0;
  const mil = war === "peace" ? 0.1 : war === "wary" ? 0.16 : war === "fortify" ? 0.22 : war === "prepare" ? 0.38 : 0.45;
  W.soldier = a >= 4 ? Math.max(c.tension >= 1 ? 1 : 0, Math.round(a * (c.tension >= 1 ? mil : 0.06))) : 0;
  W.scout = (war === "wary" || war === "fortify" || war === "prepare") && a >= 6 ? 1 + (a >= 16 ? 1 : 0) : 0;
  if (c.famine) { W.farmer = Math.round(a * 0.45); W.soldier = Math.min(W.soldier, Math.round(a * 0.1)); }
  return W;
}
const SKILL_OF = { farmer: "farm", woodcutter: "wood", miner: "mine", builder: "build", smith: "smith", soldier: "fight", sentry: "fight", doctor: "heal", scout: "fight" };
function assignJobs(c) {
  const W = wantedJobs(c);
  const mine = H2.people.filter((p) => p.col === c.id && !isChildPx(p) && !p.dead);
  const adults = mine.filter((p) => stageOf(p) !== "elder" || p.job !== "soldier");
  const have = {}; for (const p of adults) have[p.job] = (have[p.job] || 0) + 1;
  // order of priority
  const order = ["farmer", "woodcutter", "builder", "miner", "baker", "smith", "doctor", "soldier", "scout", "guard", "merchant"];
  // release surplus
  for (const j in have) { const w = W[j] || 0; if (j !== "laborer" && have[j] > w + (j === "soldier" ? 0 : 0)) { let extra = have[j] - w; for (const p of adults) { if (extra <= 0) break; if (p.job === j && !(p.task && p.task.work && p.task.pri > 40)) { setJob(p, "laborer"); extra--; have[j]--; have.laborer = (have.laborer || 0) + 1; } } } }
  for (const j of order) {
    let need = (W[j] || 0) - (have[j] || 0);
    if (need <= 0) continue;
    const pool = adults.filter((p) => p.job === "laborer" && !p.sick && stageOf(p) === "adult");
    // choose best candidate by skill / traits
    pool.sort((a, b) => score(b, j) - score(a, j));
    for (let i = 0; i < need && i < pool.length; i++) { setJob(pool[i], j); have[j] = (have[j] || 0) + 1; }
  }
}
function score(p, j) {
  const sk = SKILL_OF[j]; let s = sk ? (p.sk[sk] || 0) : 0;
  if (j === "soldier" || j === "scout") s += trait(p, "b") * 10 + trait(p, "h") * 4 - (p.sex === "f" ? 0 : 0);
  if (j === "merchant") s += trait(p, "g") * 6 + trait(p, "u") * 4;
  if (j === "doctor") s += trait(p, "k") * 8;
  if (j === "guard") s += trait(p, "l") * 6 + trait(p, "b") * 4 - trait(p, "g") * 4;
  s += trait(p, "d") * 3 + rnd();
  return s;
}
function setJob(p, j) {
  if (p.job === j) return;
  const old = p.job; p.job = j; p.task = null;
  if (j !== "laborer" && !(p.jobsHad || (p.jobsHad = [])).includes(j)) { p.jobsHad.push(j); life(p, "Took up work as a " + j + ".", "job"); }
  if (j === "soldier" || j === "sentry") { if (!p.wpn) p.wpn = "spear"; p.color = bodyColor(p); }
  else if (old === "soldier" || old === "sentry") { p.color = bodyColor(p); }
  else if (j === "doctor" || old === "doctor") p.color = bodyColor(p);
  if (old === "laborer" && j !== "laborer" && H2.cfg.verbose) chronicle(nm(p) + " becomes a " + j + ".", false, p.fac);
}
H2.setJob = setJob;

/* ---- colony think loop ---------------------------------------------------- */
H2.colonyHooks = H2.colonyHooks || [];   // extra per-colony systems (army, trade, events) register here
function colonyThink(c) {
  if (c.pop <= 0) {
    c.empty = (c.empty || 0) + 1;
    if (c.empty > 4) { const i = H2.cols.indexOf(c); if (i >= 0 && !(c.hall)) { chronicle(c.name + " lies abandoned.", true, c.fac); H2.cols.splice(i, 1); } else if (c.empty === 5) chronicle("The last inhabitant of " + c.name + " is gone. Only ruins remain.", true, c.fac); }
    return;
  }
  c.empty = 0;
  updateEconomy(c);
  if (H2.cfg.birth) pregnancyAndBirths(c);
  assignJobs(c);
  if (H2.planBuild) H2.planBuild(c);
  if (H2.cfg.expand) tryExpand(c);
  if (H2.warThinkColony && H2.cfg.war) H2.warThinkColony(c);
  for (const hk of H2.colonyHooks) { try { hk(c); } catch (e) { H2.lastError = e; if (H2.cfg.verbose) console.error("[Humanitize2]", e); } }
  burials(c);
}
function runColonies() {
  for (const c of H2.cols.slice()) {
    if ((pixelTicks + c.id * 17) % 90 === 0) colonyThink(c);
  }
}
H2.colonyThink = colonyThink;

/* ---- burials: someone carries the dead to the graveyard ------------------- */
function burials(c) {
  c.corpses = c.corpses.filter((r) => { const b = H2.byId[r.id]; return b && b.dead && !b.del; });
  for (const r of c.corpses) { const b = H2.byId[r.id]; r.x = b.x; r.y = b.y; }
}
H2.pendingBurial = function (c) { return c.corpses.length ? c.corpses[0] : null; };

/* ---- expansion: crowded towns send settlers to found new villages ------------ */
function facPopOf(f) { return (H2.facPop && H2.facPop[f]) || 0; }
function frontierSite(c) {
  let best = null, bs = 1e9;
  const W = 13;
  for (let x = W + 2; x < width - W - 2; x += 3) {
    let near = false;
    for (const o of H2.cols) { const d = Math.abs(x - o.x); if (d < (o.fac === c.fac ? 64 : 95)) { near = true; break; } }
    if (near) continue;
    let ok = true, mn = 1e9, mx = -1e9;
    for (let i = -W; i <= W; i += 2) {
      const g = columnGround(x + i); if (g < 6) { ok = false; break; }
      const t = at(x + i, g + 1); if (!t || elements[t.element].state === "liquid") { ok = false; break; }
      mn = Math.min(mn, g); mx = Math.max(mx, g);
    }
    if (!ok || mx - mn > 8) continue;
    let sc = Math.abs(x - c.x) + (mx - mn) * 4;
    for (const o of H2.cols) if (o.fac !== c.fac) sc -= Math.min(60, Math.abs(x - o.x)) * 0.5;   // prefer away from rivals
    if (sc < bs) { bs = sc; best = { x: x, y: Math.round((mn + mx) / 2) }; }
  }
  return best;
}
function tryExpand(c) {
  if (c.site && !c.hall) return;                                   // still being founded itself
  if (facPopOf(c.fac) >= H2.cfg.maxPerFaction - 6 || H2.people.length >= H2.cfg.maxPeople - 6) return;
  if (c.war.state !== "peace" && c.war.state !== "wary") return;
  if (c.adults < 10 || c.famine || c.riot) return;
  const cap = H2.cfg.townSize || 60;
  if (!((c.crowded || 0) >= 3 || c.pop >= cap)) return;
  if (pixelTicks - (c.lastExp || c.founded || 0) < DAY * 3) return;
  const s = c.stock; if (s.wood < 45 || s.bread + s.grain * 0.5 < 25) return;
  const site = frontierSite(c);
  c.lastExp = pixelTicks;
  if (!site) { if (!c.noRoom) { c.noRoom = true; chronicle(c.name + " is crowded, but there is no free land left to settle.", false, c.fac); } return; }
  // pick settlers: whole families of ordinary workers
  const mine = H2.people.filter((p) => p.col === c.id && !p.dead && !p.nomad);
  const pool = mine.filter((p) => !isChildPx(p) && stageOf(p) === "adult" && !["soldier", "scout", "sentry", "guard", "doctor", "merchant", "smith"].includes(p.job));
  const want = clamp(Math.round(c.adults * 0.25), 4, 9);
  const chosen = new Set();
  pool.sort(() => rnd() - 0.5);
  for (const p of pool) {
    if (chosen.size >= want) break;
    chosen.add(p);
    if (p.sp) { const sp = H2.byId[p.sp]; if (sp && !sp.dead && sp.col === c.id && !isChildPx(sp)) chosen.add(sp); }
  }
  if (chosen.size < 4) return;
  for (const p of Array.from(chosen)) for (const kid of (p.kids || [])) { const k = H2.byId[kid]; if (k && !k.dead && isChildPx(k) && k.col === c.id) chosen.add(k); }
  const nc = newColony(c.fac, site.x, site.y);
  nc.site = { x: site.x, y: site.y }; nc.parent = c.id; nc.mat = null;
  const give = { wood: 35, stone: 12, iron: 2, grain: 8, bread: 18, coin: 30 };
  for (const g in give) { const n = Math.min(give[g], Math.floor((s[g] || 0) * 0.4)); s[g] -= n; nc.stock[g] = n; }
  for (const p of chosen) {
    p.col = nc.id; p.task = null; p.home = null;
    for (const b of (H2.st.bed || [])) if (b.owner === p.id) { b.owner = 0; b.ownerName = ""; }
    if (!isChildPx(p) && p.job !== "laborer") setJob(p, "laborer");
    setTask(p, "migrate", { x: site.x, y: site.y }, 70);
    addThought(p, "pioneer", 10, DAY); life(p, "Left " + c.name + " as a pioneer to found " + nc.name + ".", "found");
  }
  chronicle(chosen.size + " settlers leave " + c.name + " to found " + nc.name + ".", true, c.fac);
  census(true);
}
TASKS.migrate = function (p, t) {
  const r = goTo(p, t.x, t.y, 4, 12);
  if (r === "arrive") return "done";
  if (r === "fail") { t.f = (t.f || 0) + 1; if (t.f > 6) return "done"; }
  if (pixelTicks - t.t0 > DAY * 1.5) return "done";
};
H2.tryExpand = tryExpand; H2.frontierSite = frontierSite;
