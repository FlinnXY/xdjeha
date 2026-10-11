
/* ======================================================================
   WAR: fog-of-war intel, scouts, projectiles, cannons
   ====================================================================== */
H2.war = { on: false, since: 0, aggressor: -1, last: 0, quiet: 0 };
const WARSTATES = ["peace", "wary", "fortify", "prepare", "attack", "siege", "retreat"];
const tensionLevel = (pts) => (pts < 8 ? 0 : pts < 30 ? 1 : pts < 60 ? 2 : pts < 95 ? 3 : 4);
const TLABEL = ["calm", "uneasy", "tense", "hostile", "on the brink of war"];
H2.TLABEL = TLABEL;
function hostile(p, q) { return H2.war.on && p.fac !== q.fac && !q.dead && !p.dead; }
H2.hostile = hostile;

/* ---- line of sight ------------------------------------------------------ */
function rayClear(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1), sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
  let err = dx - dy, x = x1, y = y1, n = 0;
  while (n++ < 90) {
    if ((x !== x1 || y !== y1) && (x !== x2 || y !== y2)) { const o = at(x, y); if (o && !isPerson(o) && kindOf(o) === 2) return false; }
    if (x === x2 && y === y2) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
  return true;
}
H2.rayClear = rayClear;

/* ---- intel -------------------------------------------------------------- */
function newEnemyRecord(c, q) { return { x: q.x, y: q.y, t: pixelTicks, firstT: pixelTicks, fac: q.fac, known: false, sold: 0, cannons: 0, walls: 0, towers: 0, beds: 0, hall: false, hx: 0, hy: 0, forge: false, people: 0, rep: 0 }; }
function visionOf(p) {
  let R = p.job === "scout" ? 24 : 15;
  if (isNight()) R = Math.round(R * 0.6);
  if (p.task && p.task.k === "post") R += 16;
  if (isChildPx(p)) R = 8;
  return R;
}
function sense(p) {
  const c = colById(p.col); if (!c) return;
  const R = visionOf(p);
  const I = c.intel; let seenNow = 0, soldNow = 0, ox = p.x, oy = p.y;
  if (p.task && p.task.k === "post" && p.task.px && !p.task.px.del) { ox = p.task.px.x; oy = p.task.px.y; }
  for (let i = 0; i < H2.people.length; i++) {
    const q = H2.people[i];
    if (q.fac === p.fac || q.dead) continue;
    const dx = Math.abs(q.x - ox); if (dx > R) continue;
    const dy = Math.abs(q.y - oy); if (dy > R * 0.8) continue;
    if (!rayClear(ox, oy - 1, q.x, q.y - 1)) continue;
    seenNow++; if (q.wpn && (q.job === "soldier" || q.job === "sentry")) soldNow++;
    if (!I.enemy) {
      I.enemy = newEnemyRecord(c, q); c.tensionPts += 12;
      chronicle(nm(p) + " of " + c.name + " has spotted strangers in " + FAC[q.fac].name + " colours near x=" + q.x + "!", true, c.fac);
      addThought(p, "strangers", -3, DAY);
    }
    const E = I.enemy; E.t = pixelTicks; E.fac = q.fac;
    if (!E.known) { E.x = Math.round(E.x * 0.7 + q.x * 0.3); E.y = q.y; }
    if (!I.win || pixelTicks - I.win.t > 500) I.win = { t: pixelTicks, soldiers: {}, people: {} };
    I.win.people[q.id] = 1; if (q.wpn && (q.job === "soldier" || q.job === "sentry")) I.win.soldiers[q.id] = 1;
    E.people = Math.max(E.people * 0.98, Object.keys(I.win.people).length);
    const ns = Object.keys(I.win.soldiers).length; if (ns > E.sold) { E.sold = ns; E.tSold = pixelTicks; }
    c.tensionPts += (q.wpn ? 0.06 : 0.02);
  }
  p.seenEnemy = seenNow ? pixelTicks : p.seenEnemy;
  if (seenNow && !H2.war.on && c.war.state === "peace" && c.tensionPts >= 8) {/* escalation handled in colony think */}
  return seenNow;
}
H2.sense = sense;
function structClass(o) {
  switch (o.element) {
    case "hz_stone": return "wall"; case "hz_palisade": return "wall"; case "hz_gate": return "wall";
    case "hz_post": return "tower"; case "hz_cannon": return "cannon"; case "hz_bed": return "bed"; case "hz_banner": return "hall";
    case "hz_forgefire": return "forge"; case "hz_rack": return "rack"; case "hz_plank": return "house";
  }
  return null;
}
function scanStructures(p, c) {
  const I = c.intel; const E = I.enemy; if (!E) return 0;
  const R = 24; let n = 0; const tl = { wall: 0, tower: 0, cannon: 0, bed: 0, hall: 0, forge: 0, rack: 0, house: 0 }; let sx = 0, hx = 0, hy = 0;
  for (let dx = -R; dx <= R; dx += 2) {
    const x = p.x + dx; if (x < 0 || x > width) continue;
    for (let dy = -14; dy <= 6; dy++) {
      const y = p.y + dy; if (y < 0 || y > height) continue;
      const o = pixelMap[x][y]; if (!o || o.fac === undefined || o.fac === p.fac) continue;
      const k = structClass(o); if (!k) continue;
      if (!rayClear(p.x, p.y - 1, x, y)) continue;
      tl[k]++; n++; sx += x; if (k === "hall") { hx = x; hy = o.ay !== undefined ? o.ay : y; }
    }
  }
  if (n === 0) return 0;
  E.known = true; E.t = pixelTicks; E.sx = sx / n;
  E.walls = Math.max(E.walls * 0.9, tl.wall * 2); E.towers = Math.max(E.towers * 0.9, tl.tower); E.cannons = Math.max(E.cannons * 0.9, tl.cannon); E.beds = Math.max(E.beds * 0.9, tl.bed * 2);
  if (tl.hall) { E.hall = true; E.hx = hx; E.hy = hy; E.x = hx; } else if (!E.hall) E.x = Math.round(E.x * 0.5 + (sx / n) * 0.5);
  if (tl.forge) E.forge = true; if (tl.rack) E.rack = true;
  return n;
}
function estimateEnemy(c) {
  const E = c.intel.enemy; if (!E) return null;
  const age = (pixelTicks - E.t) / DAY;
  const growth = 1 + Math.min(1.2, age * 0.35);          // unknown for how long: assume they have grown
  const sold = Math.max(E.sold, E.known ? E.beds * 0.35 : 1) * growth;
  const power = sold + E.cannons * 3 * growth + E.towers * 1.2 + (E.walls > 4 ? 2 + E.walls * 0.05 : 0);
  return { sold: sold, power: power, age: age };
}
function ownPower(c) {
  let sold = 0, armed = 0;
  for (const q of H2.people) if (q.col === c.id && !q.dead && (q.job === "soldier" || q.job === "sentry")) { sold++; armed += q.wpn && q.wpn !== "spear" ? 0.4 : 0.15; armed += (q.arm || 0) * 0.25; }
  const cannons = (H2.st.cannon || []).filter((s) => s.fac === c.fac && Math.abs(s.x - c.x) < 90).length;
  return { sold: sold, power: sold + armed + cannons * 3 + c.stock.cannon * 3 + (c.wallL !== undefined || c.wallR !== undefined ? 1.5 : 0) + haveCount(c, "post") * 1.2 };
}
H2.ownPower = ownPower; H2.estimateEnemy = estimateEnemy;

/* ---- structure damage ------------------------------------------------------- */
function damageBlock(o, dmg) {
  const e = elements[o.element]; if (!e || !e.bhp) return false;
  if (o.hp === undefined) o.hp = e.bhp;
  o.hp -= dmg;
  if (o.hp <= 0) { if (e.breakInto && rnd() < 0.3) { try { breakPixel(o); return true; } catch (er) {} } deletePixel(o.x, o.y); return true; }
  return false;
}
H2.damageBlock = damageBlock;

/* ---- projectiles --------------------------------------------------------------- */
function launch(kind, x, y, tx, ty, fac, owner, power, fire) {
  if (!inb(x, y) || pixelMap[x][y]) return false;
  const el = kind === "ball" ? "hz_ball" : "hz_arrow";
  const speed = kind === "ball" ? 1.7 : 1.5, g = kind === "ball" ? 0.04 : 0.035;
  const dx = tx - x, dy = ty - y; const t = Math.max(4, Math.abs(dx) / speed);
  createPixel(el, x, y); const pr = pixelMap[x][y]; if (!pr || pr.element !== el) return false;
  pr.fx = x; pr.fy = y; pr.vx = (dx >= 0 ? 1 : -1) * Math.min(speed, Math.abs(dx) / t * 1); pr.vx = dx / t; pr.vy = (dy - 0.5 * g * t * t) / t; pr.g = g;
  pr.fac = fac; pr.owner = owner; pr.dmg = power; pr.life = 160; pr.born = pixelTicks; if (fire) { pr.fire = 1; pr.color = "#ff8a2a"; }
  return true;
}
H2.launch = launch;
function projectileTick(p, kind) {
  if (p.fx === undefined || --p.life <= 0) { deletePixel(p.x, p.y); return; }
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(p.vx), Math.abs(p.vy))));
  for (let s = 0; s < steps; s++) {
    p.fx += p.vx / steps; p.fy += p.vy / steps;
    const nx = Math.round(p.fx), ny = Math.round(p.fy);
    if (nx === p.x && ny === p.y) continue;
    if (!inb(nx, ny)) { deletePixel(p.x, p.y); return; }
    const o = pixelMap[nx][ny];
    if (o && !o.del) {
      if (kind === "arrow") {
        if (isPerson(o)) { const tgt = o.element === "hz_head" ? at(o.x, o.y + 1) : o; if (tgt && tgt.fac !== p.fac && tgt.hp !== undefined && !tgt.dead) { hurt(tgt, p.dmg * (1 - 0.22 * (tgt.arm || 0)) * (o.element === "hz_head" ? 1.6 : 1), "arrow", H2.byId[p.owner]); if (p.fire && rnd() < 0.3 && !tgt.dead) tgt.burning = true; deletePixel(p.x, p.y); return; } else continue; }
        const e = elements[o.element];
        if (e && e.hzb && o.fac !== undefined && o.fac !== p.fac) damageBlock(o, 1);
        if (kindOf(o) === 2) { const ax = p.x, ay = p.y, fire = p.fire && o.fac !== undefined && o.fac !== p.fac; deletePixel(p.x, p.y); if (fire && rnd() < 0.5 && elements.fire && isEmpty(ax, ay)) createPixel("fire", ax, ay); return; }
      } else {
        if (isPerson(o) && (o.fac === p.fac || o.dead)) continue;
        if (kindOf(o) !== 1) { ballImpact(p, nx, ny); return; }
      }
    }
    if (!o) movePixel(p, nx, ny); else if (kindOf(o) === 1) { swapPixels(p, o); }
  }
  p.vy += p.g;
}
function ballImpact(p, x, y) {
  const owner = H2.byId[p.owner]; const R = 5;
  const fx = p.x, fy = p.y; deletePixel(p.x, p.y);
  for (const q of H2.people) {
    const d = dist(q.x, q.y, x, y); if (d > R + 2) continue;
    if (q.fac === p.fac && d > 2) continue;
    q.lastHit = { c: "cannonball", t: pixelTicks, by: p.owner || 0 };
    hurt(q, Math.max(0, 70 * (1 - d / (R + 2))), "cannonball", owner);
  }
  H2.stats.shots = (H2.stats.shots || 0) + 1;
  explodeAt(x, y, R, "smoke,smoke,smoke,fire");
}
// sets the cannon hunting
function cannonTick(p) {
  if (pixelTicks % 10 !== (p.x % 10)) return;
  if (!H2.war.on || !(p.ammo > 0)) return;
  if (pixelTicks < (p.next || 0)) return;
  const dir = p.dir || 1; let best = null, bd = 1e9, isBlock = false;
  for (const q of H2.people) {
    if (q.fac === p.fac || q.dead) continue;
    const dx = (q.x - p.x) * dir; if (dx < 4 || dx > 48) continue; if (Math.abs(q.y - p.y) > 26) continue;
    if (dx < bd) { bd = dx; best = q; }
  }
  if (!best) {
    for (let dx = 8; dx <= 44; dx += 2) {
      const x = p.x + dir * dx; if (x < 0 || x > width) break;
      for (let y = p.y - 4; y <= p.y + 14; y++) { if (y < 0 || y > height) continue; const o = pixelMap[x][y]; if (o && o.fac !== undefined && o.fac !== p.fac && elements[o.element].hzb && o.element !== "hz_bed") { best = o; bd = dx; isBlock = true; break; } }
      if (best) break;
    }
  }
  if (!best) return;
  const ok = launch("ball", p.x + dir, p.y - 1, best.x, best.y, p.fac, p.lastOwner || 0, 40);
  if (ok) { p.ammo--; p.next = pixelTicks + 130; if (isEmpty(p.x + dir * 2, p.y - 1)) createPixel("smoke", p.x + dir * 2, p.y - 1); }
}

/* ======================================================================
   WAR: colony-level planning (what each colony *believes* and decides)
   ====================================================================== */
function setWarState(c, st, why) {
  if (c.war.state === st) return;
  const old = c.war.state; c.war.state = st; c.war.since = pixelTicks;
  const F = FAC[c.fac].name;
  const T = {
    wary: c.name + " grows wary: lookouts are posted and scouts will be sent out.",
    fortify: c.name + " begins to fortify — walls, towers and drills.",
    prepare: "The council of " + c.name + " is preparing for war. The forges run day and night.",
    attack: null, siege: c.name + " is under attack!",
    retreat: "The " + F + " army sounds the retreat!",
  };
  if (st === "peace" && old !== "peace") chronicle("The alarm in " + c.name + " subsides. Life returns to normal.", true, c.fac);
  else if (T[st]) chronicle(T[st], true, c.fac);
}
function declareWar(c) {
  const E = c.intel.enemy; if (!E) return;
  c.war.target = { x: E.hall ? E.hx : E.x, y: E.hall ? E.hy : E.y };
  c.war.dir = Math.sign(c.war.target.x - c.x) || 1;
  c.war.rally = { x: clamp(c.x + c.war.dir * 16, 2, width - 3), y: c.y };
  c.war.launch = pixelTicks + 420; c.war.start0 = ownPower(c).sold; c.war.fought = 0;
  setWarState(c, "attack");
  if (!H2.war.on) { H2.war.on = true; H2.war.since = pixelTicks; H2.war.aggressor = c.fac; H2.war.quiet = 0; }
  chronicle("WAR! " + c.name + " (" + FAC[c.fac].name + ") marches against the " + FAC[E.fac].name + "s with " + ownPower(c).sold + " soldiers!", true, c.fac);
  for (const q of H2.people) if (q.lover && H2.byId[q.lover] && H2.byId[q.lover].fac !== q.fac) { /* lovers torn apart: handled below */ lovePangs(q); }
}
function lovePangs(q) {
  const l = H2.byId[q.lover]; if (!l || l.dead || l.fac === q.fac || q.defected) return;
  if (rnd() < 0.5 && q.id < l.id) { // defect for love
    const nc = colById(l.col); if (!nc) return;
    chronicle(nm(q) + " abandons the " + FAC[q.fac].name + " cause to be with " + nm(l) + "! A traitor — or a lover?", true, q.fac);
    life(q, "Defected to the " + FAC[l.fac].name + "s for love of " + nm(l) + ".", "defect");
    q.fac = l.fac; q.col = nc.id; q.defected = true; q.job = "laborer"; q.color = bodyColor(q); q.task = null; q.sp = l.id; l.sp = q.id; q.lover = 0; l.lover = 0;
    const h = headOf(q); if (h) h.fac = q.fac;
    marry(q, l);
  } else addThought(q, "torn", -20, DAY * 3);
}

function warThinkColony(c) {
  const I = c.intel, E = I.enemy, W = c.war;
  c.tension = tensionLevel(c.tensionPts);
  // ---- tension decays when nothing has been seen for a while
  if (!E || pixelTicks - E.t > 1500) c.tensionPts = Math.max(0, c.tensionPts - 0.6);
  if (c.tensionPts > 140) c.tensionPts = 140;
  c.aggr = c.aggr === undefined ? rnd() : c.aggr;
  const own = ownPower(c), est = E ? estimateEnemy(c) : null;
  c.ownPow = own.power; c.estPow = est ? est.power : 0;
  const since = pixelTicks - W.since;
  const st = W.state;
  // threat on our doorstep => siege (defensive war)
  if (H2.war.on && st !== "attack" && st !== "siege") {
    const near = H2.people.some((q) => q.fac !== c.fac && q.wpn && Math.abs(q.x - c.x) < 45 && !q.dead);
    if (near) { setWarState(c, "siege"); }
  }
  if (st === "siege") {
    const near = H2.people.some((q) => q.fac !== c.fac && Math.abs(q.x - c.x) < 60 && !q.dead && (q.wpn || q.job === "soldier"));
    if (near) W.lastThreat = pixelTicks;
    if (pixelTicks - (W.lastThreat || W.since) > 900) { setWarState(c, c.tension >= 2 ? "fortify" : "wary"); }
    return;
  }
  if (st === "peace") { if (c.tension >= 1) setWarState(c, "wary"); return; }
  if (st === "wary") {
    if (c.tension >= 2) setWarState(c, "fortify");
    else if (c.tension === 0 && since > 2500) setWarState(c, "peace");
    maybeEnvoy(c);
    return;
  }
  if (st === "fortify") {
    if (c.tension <= 1 && since > DAY) setWarState(c, "wary");
    maybeEnvoy(c);
    // the aggressive council weighs an attack once scouts have reported
    if (c.tension >= 3 && E && E.known && c.aggr > 0.45 && since > DAY * 0.7 && est && own.power > est.power * 1.15) setWarState(c, "prepare");
    else if (c.tension >= 4 && E && E.known && c.aggr > 0.8 && since > DAY * 1.2) setWarState(c, "prepare");
    return;
  }
  if (st === "prepare") {
    if (c.tension <= 2 && since > DAY * 0.5) { setWarState(c, "fortify"); return; }
    const need = Math.max(5, Math.ceil((est ? est.sold : 4) * 1.2));
    const armed = H2.people.filter((q) => q.col === c.id && (q.job === "soldier") && q.wpn && q.wpn !== "spear").length;
    const ready = own.sold >= need && armed >= own.sold * 0.5 || since > DAY * 3.2;
    if (since > DAY * 0.9 && ready && est && own.power > est.power * 1.05) declareWar(c);
    else if (since > DAY * 4) setWarState(c, "fortify");
    return;
  }
  if (st === "attack") {
    const alive = own.sold;
    if (alive < Math.max(2, (W.start0 || 6) * 0.28) && pixelTicks - W.since > 600) { setWarState(c, "retreat"); return; }
    if (W.victory) { c.tensionPts = 50; setWarState(c, "wary"); return; }
    if (pixelTicks - W.since > DAY * 4) { setWarState(c, "retreat"); }
    return;
  }
  if (st === "retreat") {
    if (since > 700) { c.tensionPts = Math.max(c.tensionPts, 45); setWarState(c, "fortify"); }
  }
  // end of global war
}
H2.warThinkColony = warThinkColony;

// the world-level war flag: the war ends once no colony is attacking or being besieged
function worldWarCheck() {
  const w = H2.war; if (!w.on) return;
  const active = H2.cols.some((c) => c.war.state === "attack" || c.war.state === "siege");
  if (active) { w.quiet = 0; return; }
  w.quiet = (w.quiet || 0) + 1;
  if (w.quiet > 2) {
    w.on = false; chronicle("The fighting has stopped. An uneasy peace settles over the land (" + H2.stats.battles + " dead in battle so far).", true);
  }
}

/* ---- diplomacy ------------------------------------------------------------- */
function maybeEnvoy(c) {
  const E = c.intel.enemy; if (!E || !E.known || H2.war.on) return;
  if (c.envoyBusy && pixelTicks < c.envoyBusy) return;
  if (c.aggr > 0.6 || c.tension >= 4) return;
  if (rnd() > 0.12) return;
  const cand = H2.people.filter((q) => q.col === c.id && !isChildPx(q) && !q.dead && stageOf(q) !== "child" && q.job !== "soldier" && q.hp > 60 && !q.envoy).sort((a, b) => (trait(b, "k") + trait(b, "l")) - (trait(a, "k") + trait(a, "l")));
  const p = cand[0]; if (!p) return;
  p.envoy = true; p.job = "laborer"; p.color = "#f2f2ee"; p.task = null;
  c.envoyBusy = pixelTicks + DAY * 1.2;
  setTask(p, "envoy", { tx: E.hall ? E.hx : E.x, phase: 0, timeout: 4000 }, 88);
  chronicle(nm(p) + " sets out from " + c.name + " carrying a white cloth and gifts, hoping to calm tempers.", true, c.fac);
}
TASKS.envoy = function (p, t) {
  const c = colById(p.col); if (!c) return "done";
  if (H2.war.on) { p.envoy = false; p.color = bodyColor(p); return "done"; }
  if (t.phase === 0) {
    const r = goTo(p, t.tx, p.y, 5, 30);
    // arrives when an enemy is within 7 px
    const meet = H2.people.find((q) => q.fac !== p.fac && !q.dead && Math.abs(q.x - p.x) < 7 && Math.abs(q.y - p.y) < 6);
    if (meet || r === "arrive") {
      const rc = colById(meet ? meet.col : 0) || H2.cols.find((x) => x.fac !== c.fac);
      if (rc && rc.aggr > 0.78 && rc.tension >= 3) {
        chronicle("The envoy " + nm(p) + " was turned away at the gates of " + rc.name + " — an insult not forgotten.", true, c.fac); c.tensionPts += 6;
      } else if (rc) {
        c.tensionPts = Math.max(0, c.tensionPts - 28); rc.tensionPts = Math.max(0, rc.tensionPts - 28);
        c.stock.coin = Math.max(0, c.stock.coin - 10); rc.stock.coin += 10;
        chronicle("PEACE ENVOY: " + nm(p) + " of " + c.name + " is received by " + rc.name + ". Tensions ease between the " + FAC[c.fac].name + "s and the " + FAC[rc.fac].name + "s.", true, c.fac);
        addThought(p, "diplomat", 15, DAY * 2); life(p, "Brokered peace with " + rc.name + " as an envoy.", "envoy");
      }
      t.phase = 1;
    }
    if (r === "fail") t.phase = 1;
    return;
  }
  const r = goTo(p, c.x, c.y, 4, 30);
  if (r === "arrive" || r === "fail") { p.envoy = false; p.color = bodyColor(p); return "done"; }
};

/* ---- reflexes: how every person reacts to danger ------------------------------ */
function nearestHostile(p, R) {
  let best = null, bd = 1e9;
  for (const q of H2.people) {
    if (q.fac === p.fac || q.dead || q.envoy) continue;
    const dx = Math.abs(q.x - p.x), dy = Math.abs(q.y - p.y); if (dx > R || dy > R * 0.8) continue;
    const d = dx + dy * 0.5; if (d < bd) { bd = d; best = q; }
  }
  return best;
}
H2.warThink = function (p, col) {
  if (!H2.war.on) {
    // before war: only a brawl-prone hothead might start something
    return false;
  }
  const isSoldier = p.job === "soldier" || p.job === "sentry" || p.job === "guard" || (p.job === "scout");
  if (p.envoy) return false;
  // wounded soldiers pull back to be treated
  const enemy = nearestHostile(p, isSoldier ? 22 : 10);
  if (!enemy) return false;
  if (isSoldier) {
    if (p.hp < 28 && trait(p, "b") < 0.3 && !isChildPx(p)) { return setTask(p, "flee", { until: pixelTicks + 120 }, 100); }
    if (p.job === "scout") return setTask(p, "flee", { until: pixelTicks + 80 }, 99);
    return setTask(p, "fight", { tid: enemy.id }, 92);
  }
  // civilians: brave ones defend their home, everyone else runs
  if (trait(p, "b") > 0.3 && !isChildPx(p) && Math.abs(enemy.x - p.x) < 4 && p.hp > 50) return setTask(p, "fight", { tid: enemy.id }, 90);
  if (enemy.wpn || enemy.job === "soldier") { p.panic = Math.max(p.panic, 5); const c = col; return setTask(p, "flee", { until: pixelTicks + 100, from: enemy.x }, 100); }
  return false;
};

/* ---- combat tasks --------------------------------------------------------------- */
function wpnOf(p) { return WEAPON[p.wpn || "fist"] || WEAPON.fist; }
TASKS.fight = function (p, t) {
  let q = H2.byId[t.tid];
  if (!q || q.dead || q.del || !hostile(p, q)) { q = nearestHostile(p, 20); if (!q) return "done"; t.tid = q.id; }
  if (p.hp < 22 && trait(p, "b") < 0.4 && p.job !== "soldier") return "done";
  const w = wpnOf(p), dx = q.x - p.x, dy = q.y - p.y, d = Math.abs(dx) + Math.abs(dy) * 0.5;
  p.dir = Math.sign(dx) || p.dir;
  if (w.rng > 1) {                        // ranged
    const cd = p.wpn === "rifle" ? 55 : 38;
    if (d <= w.rng && rayClear(p.x, p.y - 1, q.x, q.y - 1)) {
      if (pixelTicks >= (p.cool || 0)) {
        p.cool = pixelTicks + cd;
        if (p.wpn === "rifle" && elements.left_bullet && rnd() < 0.5) {
          const bx = p.x + Math.sign(dx), by = p.y - 1; if (isEmpty(bx, by)) createPixel(dx > 0 ? "right_bullet" : "left_bullet", bx, by);
          else launch("arrow", p.x, p.y - 2, q.x, q.y - 1, p.fac, p.id, w.dmg * (1 + p.sk.fight * 0.01), H2.fireArrow && H2.fireArrow(p));
        } else launch("arrow", p.x, p.y - 2, q.x, q.y - 1, p.fac, p.id, w.dmg * (1 + p.sk.fight * 0.01), H2.fireArrow && H2.fireArrow(p));
        p.sk.fight += 0.03;
      }
      if (d < 6) tryWalk(p, -Math.sign(dx), true);       // kite
      return;
    }
    const r = goTo(p, q.x, q.y, Math.max(2, w.rng - 6), 8);
    if (r === "fail") return "done";
    return;
  }
  // melee
  if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
    if (pixelTicks >= (p.cool || 0)) {
      p.cool = pixelTicks + 14; const dmg = w.dmg * (0.75 + rnd() * 0.5) * (1 + p.sk.fight * 0.012) * (1 - 0.25 * (q.arm || 0));
      q.lastHit = { c: "battle", t: pixelTicks, by: p.id };
      hurt(q, dmg, "battle", p); p.sk.fight += 0.06;
      if (q.hp > 0 && !isChildPx(q)) { q.panic = Math.max(q.panic || 0, 2); }
      if (isEmpty(q.x + p.dir, q.y) && rnd() < 0.1) createPixel("blood", q.x + p.dir, q.y);
    }
    return;
  }
  const r = goTo(p, q.x, q.y, 1, 3);
  if (r === "fail") return "done";
};
// breaking enemy structures
TASKS.breach = function (p, t) {
  if (!t.o || t.o.del) { t.o = findBreachTarget(p); if (!t.o) return "done"; }
  const o = t.o, w = wpnOf(p);
  const r = goTo(p, o.x, o.y, 1, 6);
  if (r === "fail") { t.o = null; return; }
  if (Math.abs(o.x - p.x) <= 1 && Math.abs(o.y - p.y) <= 6) {
    p.dir = Math.sign(o.x - p.x) || p.dir;
    if (pixelTicks >= (p.cool || 0)) { p.cool = pixelTicks + 16; damageBlock(o, Math.max(2, w.dmg * 0.8)); if (o.del) t.o = null; }
  }
};
function findBreachTarget(p) {
  const dir = p.dir || 1;
  for (let dx = 1; dx <= 3; dx++) for (let dy = 0; dy >= -2; dy--) {
    const o = at(p.x + dir * dx, p.y + dy);
    if (o && o.fac !== undefined && o.fac !== p.fac && elements[o.element].hzb && o.element !== "hz_bed") return o;
  }
  return null;
}

/* ---- scouts ---------------------------------------------------------------------- */
TASKS.scout = function (p, t) {
  const c = colById(p.col); if (!c) return "done";
  const I = c.intel, E = I.enemy;
  if (!E) return "done";
  if (!t.phase) { t.phase = 1; t.t1 = pixelTicks; t.obs = 0; }
  if (t.phase === 1) {                           // approach the estimated enemy position, stay at a distance
    const side = Math.sign(c.x - E.x) || 1;
    const tx = clamp(E.x + side * 18, 2, width - 3);
    const r = goTo(p, tx, p.y, 2, 40);
    if (r === "arrive" || r === "fail" || pixelTicks - t.t1 > 1100) { t.phase = 2; t.t2 = pixelTicks; }
    return;
  }
  if (t.phase === 2) {                           // observe from a distance
    if (pixelTicks % 15 === 0) { scanStructures(p, c); sense(p); t.obs++; }
    if (pixelTicks - t.t2 > 160) t.phase = 3;
    return;
  }
  const r = goTo(p, c.x, c.y, 5, 40);            // report back
  if (r === "arrive" || r === "fail" || pixelTicks - t.t1 > 3500) {
    I.reports = (I.reports || 0) + 1; I.last = pixelTicks;
    const e = estimateEnemy(c);
    life(p, "Scouted the enemy and reported back to " + c.name + ".", "scout"); p.xp = (p.xp || 0) + 3;
    if (E.known) chronicle(nm(p) + " returns to " + c.name + " and reports: ~" + Math.round(e.sold) + " soldiers" + (E.cannons ? ", " + Math.round(E.cannons) + " cannons" : "") + (E.walls > 4 ? ", walls" : "") + (E.towers ? ", towers" : "") + ".", true, c.fac);
    else chronicle(nm(p) + " returns with little news; the strangers' home remains unknown.", false, c.fac);
    c.tensionPts += 3; return "done";
  }
};

/* ---- soldiers ------------------------------------------------------------------- */
function needsGear(p, c) {
  const s = c.stock;
  if (!p.wpn) return true;
  if (!isArcher(p) && s.sword > 0 && p.wpn !== "sword" && p.wpn !== "rifle") return true;
  if (!isArcher(p) && c.tech >= 3 && s.rifle > 0 && p.wpn !== "rifle") return true;
  if (isArcher(p) && s.bow > 0 && p.wpn !== "bow") return true;
  if (!(p.arm >= 1) && s.armor > 0) return true;
  return false;
}
H2.soldierThink = function (p, c) {
  const W = c.war, st = W.state;
  if (p.job === "scout") {
    if (c.intel.enemy && st !== "peace" && !H2.war.on) return setTask(p, "scout", { work: true, timeout: 4200 }, 20);
    return setTask(p, "train", { work: true }, 15);
  }
  if (needsGear(p, c) && pixelTicks > (p.gearT || 0)) { p.gearT = pixelTicks + 900; return setTask(p, "equip", {}, 30); }
  if (st === "attack") return setTask(p, "march", { work: true, timeout: 9000 }, 40);
  if (st === "retreat") { return setTask(p, "retreat", { work: true }, 40); }
  if (st === "siege") return setTask(p, "defend", { work: true, timeout: 600 }, 38);
  // load empty cannons / man towers when the colony is on alert
  if (st !== "peace") {
    const cn = (H2.st.cannon || []).find((q) => q.fac === c.fac && !(q.ammo > 0) && Math.abs(q.x - p.x) < 50 && c.stock.powder >= 1);
    if (cn && (p.id % 2 === 0)) return setTask(p, "load", { cid: cn }, 36);
    const posts = (H2.st.post || []).filter((q) => q.fac === c.fac && (!q.manned || !H2.byId[q.manned] || H2.byId[q.manned].dead || H2.byId[q.manned].task === null));
    if (posts.length && (isArcher(p) || p.id % 2 === 1)) { const po = H2.nearestOf(posts, p.x, p.y, 120); if (po) { po.manned = p.id; return setTask(p, "post", { px: po, until: pixelTicks + 1800, work: true }, 33); } }
  }
  if (st === "prepare") return setTask(p, rnd() < 0.55 ? "train" : "rally", { work: true, until: pixelTicks + 500 }, 18);
  const r = rnd();
  if (r < 0.45) return setTask(p, "train", { work: true }, 15);
  return setTask(p, "patrol", { work: true }, 15);
};
TASKS.train = function (p, t) {
  const c = colById(p.col); if (!c) return "done";
  const d = H2.nearestOf(stationsOf("dummy", c), p.x, p.y, 120);
  if (!d) { t.n = (t.n || 0) + 1; if (t.n > 20) return "done"; return TASKS.wander(p, t); }
  const r = goTo(p, d.x, accY(d), 1, 4);
  if (r === "fail") return "done";
  if (r === "arrive") { p.dir = Math.sign(d.x - p.x) || p.dir; t.n = (t.n || 0) + 1; if (t.n % 5 === 0) { p.sk.fight += 0.25; if (isEmpty(d.x, d.y - 1) && rnd() < 0.2) createPixel("spark" in elements ? "spark" : "smoke", d.x, d.y - 1); } if (t.n > 45) return "done"; }
};
TASKS.rally = function (p, t) {
  const c = colById(p.col); if (!c) return "done";
  const R = c.war.rally || { x: c.x, y: c.y };
  const r = goTo(p, R.x + (p.id % 7) - 3, R.y, 2, 40);
  if (pixelTicks > (t.until || 0)) return "done";
};
TASKS.retreat = function (p, t) {
  const c = colById(p.col); if (!c) return "done";
  const r = goTo(p, c.x, c.y, 6, 40);
  if (r === "arrive" || r === "fail" || c.war.state !== "retreat") return "done";
};
TASKS.defend = function (p, t) {
  const c = colById(p.col); if (!c) return "done";
  if (c.war.state !== "siege") return "done";
  // stand between the hall and the nearest threat
  const th = nearestHostile(p, 70);
  const tx = th ? clamp(th.x - Math.sign(th.x - c.x) * 7, 1, width - 2) : c.x + (c.war.lastThreatX ? Math.sign(c.war.lastThreatX - c.x) * 6 : 0);
  if (th) c.war.lastThreatX = th.x;
  goTo(p, tx, p.y, 2, 40);
};
TASKS.post = function (p, t) {
  const po = t.px; if (!po || po.del) return "done";
  const r = goTo(p, po.x, accY(po), 1, 12);
  if (r === "fail") { po.manned = 0; return "done"; }
  po.manned = p.id;
  if (r !== "arrive") return;
  if (pixelTicks > t.until) { po.manned = 0; return "done"; }
  if (H2.war.on && pixelTicks >= (p.cool || 0)) {
    let best = null, bd = 1e9;
    for (const q of H2.people) { if (q.fac === p.fac || q.dead) continue; const dx = Math.abs(q.x - po.x); if (dx > 40 || Math.abs(q.y - po.y) > 34) continue; if (dx < bd) { bd = dx; best = q; } }
    if (best) { p.cool = pixelTicks + 34; launch("arrow", po.x, po.y - 1, best.x, best.y - 1, p.fac, p.id, 6 * (1 + p.sk.fight * 0.01), H2.fireArrow && H2.fireArrow(p)); p.sk.fight += 0.04; p.xp = (p.xp || 0) + 0.2;
      if (H2.dropRock) H2.dropRock(p, po, best); }
  }
};
TASKS.load = function (p, t) {
  const c = colById(p.col); const cn = t.cid; if (!c || !cn || cn.del) return "done";
  const r = goTo(p, cn.x, accY(cn), 2, 16);
  if (r === "fail") return "done";
  if (r === "arrive") { if (c.stock.powder >= 1) { c.stock.powder -= 1; cn.ammo = (cn.ammo || 0) + 3; cn.lastOwner = p.id; } return "done"; }
};
TASKS.deploy = function (p, t) {
  const c = colById(p.col); if (!c) return "done"; const W = c.war; if (!W.target) return "done";
  const dir = W.dir || 1;
  if (!t.x) t.x = clamp(W.target.x - dir * (26 + rint(0, 6)), 2, width - 3);
  const r = goTo(p, t.x, p.y, 1, 20);
  if (r === "fail") return "done";
  if (r === "arrive") {
    const gy = groundY(t.x, clamp(p.y - 6, 0, height - 2), 20);
    if (gy > 0 && c.stock.cannon > 0 && !pixelMap[t.x][gy]) {
      createPixel("hz_cannon", t.x, gy); const n = pixelMap[t.x][gy];
      if (n) { n.fac = c.fac; n.dir = dir; n.ammo = 0; n.ay = gy; n.cid = c.id; c.stock.cannon--; W.siegeGuns = (W.siegeGuns || 0) + 1; chronicle("The " + FAC[c.fac].name + " army deploys a siege cannon before the enemy lines.", true, c.fac); }
    }
    return "done";
  }
};
TASKS.march = function (p, t) {
  const c = colById(p.col); if (!c) return "done"; const W = c.war;
  if (W.state !== "attack" || !W.target) return "done";
  const E = c.intel.enemy; if (E && E.hall) W.target = { x: E.hx, y: E.hy };
  const T = W.target, dir = Math.sign(T.x - p.x) || W.dir || 1;
  if (pixelTicks < W.launch) { goTo(p, W.rally.x + (p.id % 7) - 3, p.y, 2, 40); return; }
  // siege guns first
  if (c.stock.cannon > 0 && Math.abs(p.x - T.x) < 46 && !(t.deployed) && (p.id % 3 === 0)) { t.deployed = true; return setTask(p, "deploy", {}, 60) && undefined; }
  const cn = (H2.st.cannon || []).find((q) => q.fac === p.fac && !(q.ammo > 0) && Math.abs(q.x - p.x) < 40 && c.stock.powder >= 1 && p.id % 3 === 1);
  if (cn && !t.loaded) { t.loaded = pixelTicks + 300; return setTask(p, "load", { cid: cn }, 60) && undefined; }
  if (t.loaded && pixelTicks > t.loaded) t.loaded = 0;
  // keep the army together: do not run ahead
  let n = 0, sum = 0; for (const q of H2.people) if (q.col === c.id && q.job === "soldier" && !q.dead) { n++; sum += q.x; }
  const med = n ? sum / n : p.x;
  if ((p.x - med) * dir > 9 && Math.abs(p.x - T.x) > 14) return;
  // arrived?
  if (Math.abs(p.x - T.x) <= 8) {
    const banner = H2.findNear(p.x, p.y, 20, (o) => o.element === "hz_banner" && o.fac !== undefined && o.fac !== p.fac);
    const foe = nearestHostile(p, 20);
    if (banner && !foe) { setTask(p, "breach", { o: banner }, 62); return; }
    if (!banner && !foe && H2.people.filter((q) => q.fac !== p.fac && Math.abs(q.x - T.x) < 22 && !q.dead).length === 0) { claimVictory(c, p); return "done"; }
    if (!banner && !foe) { const o = findBreachTarget(p); if (o) setTask(p, "breach", {}, 62); else tryWalk(p, p.dir, true); return; }
  }
  const blocker = findBreachTarget(p);
  if (blocker) { setTask(p, "breach", {}, 62); return; }
  const r = goTo(p, T.x, p.y, 6, 60);
};
function claimVictory(c, p) {
  const W = c.war; if (W.victory) return;
  W.victory = true;
  const ec = H2.cols.find((x) => x.fac !== c.fac && Math.abs(x.x - W.target.x) < 70);
  let loot = "";
  if (ec) { const take = {}; for (const g of ["wood", "stone", "iron", "bread", "grain", "coin"]) { const n = Math.floor(ec.stock[g] * 0.45); ec.stock[g] -= n; c.stock[g] += n; take[g] = n; } loot = " They carry off " + take.coin + " coins and " + (take.bread + take.grain) + " food."; ec.unrest = 100; ec.hall = null; ec.tensionPts = Math.max(ec.tensionPts, 70); }
  chronicle("VICTORY! " + nm(p) + " plants the " + FAC[c.fac].name + " banner on the ruins of " + (ec ? ec.name : "the enemy village") + "." + loot, true, c.fac);
  for (const q of H2.people) if (q.col === c.id && q.job === "soldier") addThought(q, "victory", 15, DAY * 2);
}

/* ---- defensive building (called while the colony plans) ------------------------------ */
function colonyExtent(c) {
  let mn = c.x, mx = c.x;
  for (const k in H2.st) for (const s of H2.st[k]) { if (s.del || s.fac !== c.fac || Math.abs(s.x - c.x) > 80) continue; if (k === "cannon" || k === "post") continue; if (s.x < mn) mn = s.x; if (s.x > mx) mx = s.x; }
  return { min: mn, max: mx };
}
function wallExists(c, x) { if (x === undefined) return false; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx > width) continue; for (let y = 0; y <= height; y++) { const o = pixelMap[xx][y]; if (o && o.fac === c.fac && (o.element === "hz_stone" || o.element === "hz_palisade") && o.hzb2) return true; } } return false; }
H2.warPlan = function (c, can) {
  const st = c.war.state, t = c.tension, s = c.stock, E = c.intel.enemy;
  if (st === "peace" && t === 0) return false;
  if (c.plans.length >= 2) return false;
  const has = (type) => c.plans.some((p) => p.type === type);
  const ext = colonyExtent(c);
  const side = E ? (Math.sign(E.x - c.x) || 1) : (c.x < width / 2 ? 1 : -1);
  const wallX = (sd) => (sd > 0 ? ext.max + 7 : ext.min - 8);
  const walls = c.walls || (c.walls = []);
  const sideWall = walls.find((w) => w.side === side && wallExists(c, w.x0));
  const otherWall = walls.find((w) => w.side === -side && wallExists(c, w.x0));
  const towersN = haveCount(c, "post");
  // 1. a lookout tower on the exposed side
  if (t >= 1 && towersN < 1 && !has("tower") && can("tower", 0.7)) { if (queuePlan(c, "tower", { cx: side > 0 ? ext.max + 3 : ext.min - 3, range: 12, outside: true, side: side })) return true; }
  if (t >= 2) {
    if (!sideWall && !has("wall") && !has("palisade")) {
      if (can("wall", 0.8)) { const pl = queuePlan(c, "wall", { cx: wallX(side) + 1, range: 8, outside: true, side: side }); if (pl) { pl.wallSide = side; return true; } }
      else if (can("palisade", 0.8)) { const pl = queuePlan(c, "palisade", { cx: wallX(side), range: 8, outside: true, side: side, nomargin: true }); if (pl) { pl.wallSide = side; return true; } }
    }
    if (sideWall && !has("moat") && !c.moats) c.moats = {};
    if (sideWall && !has("moat") && !(c.moats && c.moats[side]) && t >= 2 && s.wood >= 0) {
      const pl = queuePlan(c, "moat", { cx: sideWall.x0 + side * 4, range: 5, outside: true, nomargin: true, slope: 1, side: side });
      if (pl) { c.moats[side] = 1; return true; }
    }
    if (sideWall && towersN < 2 && !has("tower") && can("tower", 0.7)) { if (queuePlan(c, "tower", { cx: sideWall.x0 - side * 6, range: 8, side: -side, outside: true })) return true; }
    // cannons on top of the walls
    if (sideWall && c.tech >= 2 && s.cannon > 0 && !has("cannon") && haveCount(c, "cannon") < 3) {
      const gx = sideWall.x0 + (side > 0 ? 1 : 0), gy = sideWall.y0 - 6;
      if (inb(gx, gy) && !pixelMap[gx][gy] && pixelMap[gx][gy + 1]) { queuePlan(c, "cannon", { site: { x0: gx, y0: gy }, dir: side }); return true; }
    }
  }
  if (t >= 3) {
    if (!otherWall && !has("wall") && !has("palisade") && can("wall", 0.8)) { const pl = queuePlan(c, "wall", { cx: wallX(-side) + 1, range: 8, outside: true, side: -side }); if (pl) { pl.wallSide = -side; return true; } }
    if (otherWall && towersN < 3 && !has("tower") && can("tower", 0.7)) { if (queuePlan(c, "tower", { cx: otherWall.x0 + side * 6, range: 8, side: side, outside: true })) return true; }
  }
  return false;
};
