
/* ======================================================================
   ARMY & GOVERNMENT: leaders and elections, ranks and squads, morale,
   strategy and tactics, soldier life (pay, medals, retirement, funerals),
   extra weapons (fire arrows, sapper charges, dropped rocks), militia,
   shelter and fire-fighting.
   ====================================================================== */
const RANKS = {
  0: ["Recruit", "Huscarl", "Veteran", "Sergeant", "Captain", "Marshal"],
  1: ["Tiro", "Legionary", "Veteran", "Optio", "Centurion", "Legate"],
};
const RANK_XP = [0, 12, 40, 80, 140];                  // the top rank is only given by appointment
const LEADER_TITLE = { 0: ["Chieftain", "High Jarl"], 1: ["Consul", "Doge"] };
const SQUAD_NAMES = {
  0: ["Wolves", "Ravens", "Bears", "Stags", "Hawks", "Boars", "Elks", "Lynxes", "Otters", "Falcons"],
  1: ["I Cohort", "II Cohort", "III Cohort", "IV Cohort", "V Cohort", "VI Cohort", "VII Cohort", "VIII Cohort", "IX Cohort", "X Cohort"],
};
const STRATEGY_TEXT = {
  drill: "drilling in peacetime", hold: "holding the walls", assault: "a full assault", raid: "a lightning raid for plunder",
  siege: "a patient siege with guns", harass: "harassing with archers", sally: "a sally against the attackers",
  militia: "arming the townsfolk", shelter: "sheltering the people in the hall",
};
function rankName(p) { if (!p || p.rank === undefined) return ""; return (RANKS[p.fac] || RANKS[0])[p.rank] || ""; }
H2.rankName = rankName;
function isMil(p) { return p.job === "soldier" || p.job === "sentry" || p.job === "scout"; }
function armyOf(c) { return c.army || (c.army = { strategy: "drill", morale: 60, squads: [], medals: 0, paid: 0, lastState: c.war ? c.war.state : "peace" }); }
H2.armyOf = armyOf;

/* ---- leaders & elections ------------------------------------------------------ */
function leaderScore(p) {
  const days = ageOf(p) / DAY;
  return Math.min(12, days * 0.6) + (p.kills || 0) * 1.5 + (p.builtN || 0) * 0.4 + (p.rank || 0) * 2 + (p.medals || 0) * 2
    + trait(p, "l") * 6 + trait(p, "k") * 4 + trait(p, "b") * 3 + trait(p, "d") * 3 - trait(p, "g") * 3 + (p.title ? 4 : 0) + (p.sp ? 1 : 0);
}
function holdElection(c, why) {
  const voters = H2.people.filter((q) => q.col === c.id && !q.dead && !isChildPx(q) && stageOf(q) !== "child");
  if (voters.length < 2) { if (voters[0] && c.leader !== voters[0].id) appoint(c, voters[0], 1, 1, why); return; }
  const cands = voters.slice().sort((a, b) => leaderScore(b) - leaderScore(a)).slice(0, 3);
  const votes = new Map(cands.map((q) => [q.id, 0]));
  for (const v of voters) {
    let best = null, bs = -1e9;
    for (const k of cands) {
      let s = leaderScore(k) + rnd() * 8;
      if (k.id === v.id) s += 6;                                         // everyone likes themselves a little
      if (v.sp === k.id) s += 8;
      if ((v.par || []).includes(k.id) || (k.par || []).includes(v.id) || k.sn === v.sn) s += 4;
      if (s > bs) { bs = s; best = k; }
    }
    votes.set(best.id, votes.get(best.id) + 1);
  }
  let win = cands[0], wv = -1; for (const k of cands) if (votes.get(k.id) > wv) { wv = votes.get(k.id); win = k; }
  appoint(c, win, wv, voters.length, why);
}
function appoint(c, p, nv, nt, why) {
  const prev = H2.byId[c.leader];
  const title = LEADER_TITLE[c.fac][c.pop >= 40 || H2.cols.filter((x) => x.fac === c.fac).length >= 3 ? 1 : 0];
  c.leader = p.id; c.leaderTitle = title; c.lastElection = pixelTicks;
  // the leader's temperament steers the council (aggression towards rivals)
  c.aggr = clamp(0.3 + trait(p, "h") * 0.35 + trait(p, "b") * 0.15 - trait(p, "k") * 0.25 + rnd() * 0.25, 0.05, 0.95);
  const stance = c.aggr > 0.6 ? "a hawk who speaks of war" : c.aggr < 0.35 ? "a dove who seeks peace" : "a cautious pragmatist";
  const again = prev && prev.id === p.id;
  life(p, (again ? "Re-elected " : "Elected ") + title + " of " + c.name + " (" + nv + " of " + nt + " votes).", "elected");
  addThought(p, "elected", 20, DAY * 2);
  chronicle((why === "death" ? "After the death of their leader, " : "") + c.name + (again ? " re-elects " : " elects ") + nm(p) + " as " + title + " — " + stance + " (" + nv + "/" + nt + " votes).", true, c.fac);
}
H2.holdElection = holdElection;

/* ---- ranks, squads & the marshal ------------------------------------------------ */
function organise(c, mil) {
  const A = armyOf(c);
  const sold = mil.filter((q) => q.job === "soldier" || q.job === "sentry").sort((a, b) => (b.xp || 0) - (a.xp || 0));
  // ranks: experience earns a rank, but officers are limited by the size of the army
  const maxCapt = Math.max(1, Math.floor(sold.length / 10)), maxSgt = Math.max(1, Math.ceil(sold.length / 6));
  let nCapt = 0, nSgt = 0;
  for (const q of sold) {
    let r = 0; for (let i = RANK_XP.length - 1; i >= 0; i--) if ((q.xp || 0) >= RANK_XP[i]) { r = i; break; }
    if (r >= 4) { if (nCapt < maxCapt) nCapt++; else r = 3; }
    if (r === 3) { if (nSgt < maxSgt) nSgt++; else r = 2; }
    if (q.rank === 5 && c.marshal === q.id) r = 5;
    if (q.rank === undefined) q.rank = 0;
    if (r > q.rank) { q.rank = r; life(q, "Promoted to " + rankName(q) + ".", "rank"); if (r >= 3) chronicle(nm(q) + " is promoted to " + rankName(q) + ".", false, c.fac); }
    else if (r < q.rank && q.rank !== 5) q.rank = r;   // officer posts are limited; no life entry for reshuffles
  }
  // the marshal / legate: the most experienced officer commands the army
  const M = H2.byId[c.marshal];
  if (!M || M.dead || M.col !== c.id || !(M.job === "soldier" || M.job === "sentry")) {
    if (M && M.rank === 5) M.rank = 4;
    c.marshal = 0;
    const best = sold[0];
    if (best && sold.length >= 3 && (best.xp || 0) >= RANK_XP[2]) {
      c.marshal = best.id; best.rank = 5;
      life(best, "Appointed " + rankName(best) + " of the " + FAC[c.fac].name + " army of " + c.name + ".", "rank");
      chronicle(nm(best) + " is appointed " + rankName(best) + " and takes command of " + c.name + "'s army.", true, c.fac);
    }
  }
  // squads of up to six, grouped by weapon role
  const names = SQUAD_NAMES[c.fac] || SQUAD_NAMES[0];
  const groups = { archers: [], musketeers: [], infantry: [] };
  for (const q of sold) groups[q.wpn === "bow" || (isArcher(q) && q.wpn !== "rifle") ? "archers" : q.wpn === "rifle" ? "musketeers" : "infantry"].push(q);
  const squads = []; let ni = 0;
  for (const role in groups) {
    const g = groups[role];
    for (let i = 0; i < g.length; i += 6) {
      const mem = g.slice(i, i + 6); const lead = mem.slice().sort((a, b) => (b.rank || 0) - (a.rank || 0) || (b.xp || 0) - (a.xp || 0))[0];
      const name = names[ni % names.length] + (ni >= names.length ? " " + (Math.floor(ni / names.length) + 1) : ""); ni++;
      squads.push({ name: name, role: role, lead: lead.id, members: mem.map((q) => q.id) });
      for (const q of mem) { if (q.squad !== name) { if (q.squad === undefined) life(q, "Joined the " + name + " (" + role + ").", "squad"); q.squad = name; } }
    }
  }
  A.squads = squads;
}

/* ---- morale -------------------------------------------------------------------- */
function updateMorale(c, mil) {
  const A = armyOf(c);
  let m = 55;
  if (H2.byId[c.marshal] && !H2.byId[c.marshal].dead) m += 8;
  if (H2.byId[c.leader] && !H2.byId[c.leader].dead) m += 4;
  const ratio = c.estPow > 0 ? (c.ownPow || 0) / c.estPow : 1.5;
  m += clamp((ratio - 1) * 25, -25, 20);
  let mood = 0, n = 0; for (const q of mil) { mood += (q.mood || 50); n++; }
  if (n) m += (mood / n - 50) * 0.3;
  m += Math.min(10, (A.medals || 0) * 1.5);
  if (c.stock.coin <= 0 && n) m -= 10;                                   // unpaid soldiers grumble
  const lost = (A.lost || 0); m -= Math.min(30, lost * 4);
  A.lost = Math.max(0, lost - 0.15);
  A.morale = Math.round(clamp(A.morale + (clamp(m, 0, 100) - A.morale) * 0.35, 0, 100));
  // a beaten army routs
  if (c.war.state === "attack" && A.morale < 18 && pixelTicks - c.war.since > 500 && !c.war.victory) {
    chronicle("The morale of the " + FAC[c.fac].name + " army breaks — the soldiers of " + c.name + " flee the field!", true, c.fac);
    setWarState(c, "retreat");
  }
}

/* ---- strategy: the war council ----------------------------------------------------- */
function chooseStrategy(c) {
  const A = armyOf(c), st = c.war.state, E = c.intel && c.intel.enemy;
  const own = c.ownPow || 0, est = c.estPow || 0;
  let s = A.strategy;
  if (st === "peace" || st === "wary") s = "drill";
  else if (st === "fortify") s = "hold";
  else if (st === "prepare" || (st === "attack" && A.lastState !== "attack" && A.lastState !== "prepare")) {
    if (E && E.walls > 4 && (c.stock.cannon > 0 || haveCount(c, "cannon") > 0)) s = "siege";
    else if (own > est * 1.6) s = "assault";
    else if (c.aggr < 0.5) s = "harass";
    else s = "raid";
  } else if (st === "siege") {
    if (own >= est * 0.9 && est > 0) s = "sally";
    else if (own < est * 0.6) s = "militia";
    else if (c.wallL !== undefined || c.wallR !== undefined || haveCount(c, "post") > 0) s = "hold";
    else s = "shelter";
  }
  if (s !== A.strategy) {
    A.strategy = s;
    if (st !== "peace" && st !== "wary") chronicle("War council of " + c.name + ": the plan is " + STRATEGY_TEXT[s] + ".", false, c.fac);
  }
  // raids and harassment are short: grab what can be grabbed and go home
  if (st === "attack" && (s === "raid" || s === "harass") && !c.war.victory && pixelTicks - c.war.since > DAY * (s === "raid" ? 1.6 : 1.1)) {
    const ec = H2.cols.find((x) => x.fac !== c.fac && c.war.target && Math.abs(x.x - c.war.target.x) < 70);
    if (ec && s === "raid") { const n = Math.min(40, Math.floor(ec.stock.coin * 0.3)); ec.stock.coin -= n; c.stock.coin += n; chronicle("The raiders of " + c.name + " return home with " + n + " plundered coins.", true, c.fac); }
    else chronicle("Having bloodied the enemy, " + c.name + "'s skirmishers withdraw.", true, c.fac);
    setWarState(c, "retreat");
  }
}

/* ---- soldier life: pay, medals, retirement, funerals -------------------------------- */
function soldierLife(c, mil) {
  const A = armyOf(c);
  const day = dayNumber();
  if (A.paid !== day) {
    A.paid = day;
    for (const q of mil) { if (c.stock.coin >= 1) { c.stock.coin -= 1; q.coin = (q.coin || 0) + 1; } else addThought(q, "unpaid", -8, DAY); }
  }
  for (const q of mil) {
    if (stageOf(q) === "elder" && !q.retired) {
      q.retired = true; setJob(q, "laborer");
      life(q, "Retired from the army as " + (rankName(q) || "a soldier") + " with " + (q.medals || 0) + " medal(s) and " + (q.kills || 0) + " kill(s).", "retire");
      chronicle(nm(q) + " hangs up their weapon and retires from the army with honours.", false, c.fac);
    }
  }
  // funerals for fallen soldiers: their squad mourns
  for (const r of c.corpses) {
    const d = H2.byId[r.id]; if (!d || d.mourned || !d.squad) continue;
    d.mourned = true; A.lost = (A.lost || 0) + 1;
    for (const q of H2.people) if (!q.dead && q.col === c.id && q.squad === d.squad) { life(q, "Mourned fallen comrade " + nm(d) + ".", "grief"); addThought(q, "comrade", -10, DAY); }
    if ((d.rank || 0) >= 3 || d.kills >= 3) chronicle(c.name + " holds a funeral with honours for " + (rankName(d) ? rankName(d) + " " : "") + nm(d) + ".", true, c.fac);
  }
}
function awardMedals(c, kind, who) {
  const A = armyOf(c); let n = 0;
  for (const q of who) {
    if (q.dead) continue;
    q.medals = (q.medals || 0) + 1; q.xp = (q.xp || 0) + 15; n++;
    life(q, "Awarded the " + kind + ".", "medal");
  }
  A.medals = (A.medals || 0) + (n ? 1 : 0);
  if (n) chronicle(n + " soldier" + (n > 1 ? "s" : "") + " of " + c.name + " receive the " + kind + ".", false, c.fac);
}
function stateChanges(c, mil) {
  const A = armyOf(c), st = c.war.state, old = A.lastState;
  if (st === old) return;
  const fighters = mil.filter((q) => q.job === "soldier" || q.job === "sentry");
  if (old === "attack" && c.war.victory) awardMedals(c, FAC[c.fac].name + " Campaign Medal", fighters);
  if (old === "siege" && st !== "siege") { awardMedals(c, "Defender's Cross of " + c.name, fighters); chronicle(c.name + " has withstood the attack!", true, c.fac); }
  if (st === "attack") for (const q of fighters) life(q, "Marched to war against the " + FAC[1 - c.fac].name + "s.", "war");
  if (st === "siege") for (const q of fighters) life(q, "Defended " + c.name + " against attack.", "war");
  // militia stands down after the siege
  if (old === "siege") for (const q of H2.people) if (q.col === c.id && q.militia) { q.militia = false; if (q.wpn === "spear" && q.job !== "soldier") q.wpn = null; }
  A.lastState = st;
}

/* ---- the per-colony hook ------------------------------------------------------------ */
function armyThink(c) {
  const A = armyOf(c);
  const L = H2.byId[c.leader];
  if (!L || L.dead || L.col !== c.id) { if (c.pop >= 1 && (!c.lastElection || pixelTicks - c.lastElection > 200)) holdElection(c, c.leader ? "death" : "first"); }
  else if (pixelTicks - (c.lastElection || 0) > DAY * 6) holdElection(c, "term");
  if (!H2.cfg.war) return;
  const mil = H2.people.filter((q) => q.col === c.id && !q.dead && isMil(q));
  stateChanges(c, mil);
  organise(c, mil);
  chooseStrategy(c);
  updateMorale(c, mil);
  soldierLife(c, mil);
  fireWatch(c);
}
H2.colonyHooks.push(armyThink);
H2.armyThink = armyThink;

/* ---- training earns experience ---------------------------------------------------------- */
const _train = TASKS.train;
TASKS.train = function (p, t) {
  const n0 = t.n || 0; const r = _train(p, t);
  if ((t.n || 0) > n0 && t.n % 5 === 0) {
    p.xp = (p.xp || 0) + 0.8;
    // sparring partners: two soldiers at the same dummy cross blades
    if (!t.spar && rnd() < 0.05) { const o = H2.people.find((q) => q !== p && q.col === p.col && q.task && q.task.k === "train" && Math.abs(q.x - p.x) <= 3 && Math.abs(q.y - p.y) <= 2); if (o) { t.spar = 1; p.xp += 1.5; o.xp = (o.xp || 0) + 1.5; } }
    if (!p.trainedOnce) { p.trainedOnce = true; life(p, "Began training at the drill ground.", "train"); }
  }
  return r;
};

/* ---- tactics: siege armies wait for their guns, sallies strike out --------------------- */
const _march = TASKS.march;
TASKS.march = function (p, t) {
  const c = colById(p.col);
  if (c && c.war.state === "attack" && c.war.target && armyOf(c).strategy === "siege" && pixelTicks - c.war.since < 1100 && pixelTicks >= c.war.launch) {
    const T = c.war.target, dir = Math.sign(T.x - p.x) || c.war.dir || 1;
    if (Math.abs(p.x - T.x) < 26 && !(p.id % 3 === 0 && !t.deployed && c.stock.cannon > 0)) { p.dir = dir; return; }   // hold the line while the guns work
  }
  return _march(p, t);
};
const _defend = TASKS.defend;
TASKS.defend = function (p, t) {
  const c = colById(p.col);
  if (c && armyOf(c).strategy === "sally") { const q = nearestHostile(p, 34); if (q) return setTask(p, "fight", { tid: q.id }, 92) ? "done" : undefined; }
  return _defend(p, t);
};
// sappers: one in five soldiers carries a powder charge to blow a hole in enemy walls
const _breach = TASKS.breach;
TASKS.breach = function (p, t) {
  const c = colById(p.col);
  if (c && p.id % 5 === 0 && c.stock.powder >= 2 && t.o && !t.o.del && Math.abs(t.o.x - p.x) <= 2 && Math.abs(t.o.y - p.y) <= 6 && pixelTicks > (p.charged || 0)) {
    c.stock.powder -= 2; p.charged = pixelTicks + 600;
    const x = t.o.x, y = t.o.y;
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) { const o = at(x + dx, y + dy); if (o && !isPerson(o) && o.fac !== undefined && o.fac !== p.fac) damageBlock(o, 60); }
    if (typeof explodeAt === "function") { try { explodeAt(x, y, 2, "smoke,smoke,fire"); } catch (e) {} }
    hurt(p, 6, "explosion");
    life(p, "Blew a breach in the enemy defences with a powder charge.", "war"); p.xp = (p.xp || 0) + 6;
    chronicle("A " + FAC[p.fac].name + " sapper blows a breach in the enemy wall!", false, p.fac);
    t.o = null; return;
  }
  return _breach(p, t);
};
// defenders on towers drop rocks onto attackers right below
H2.dropRock = function (p, po, q) {
  if (!q || Math.abs(q.x - po.x) > 2 || q.y - po.y < 3 || rnd() > 0.35) return;
  const x = q.x, y = po.y + 1;
  if (elements.rock && isEmpty(x, y)) createPixel("rock", x, y);
  hurt(q, 14, "falling rock", p);
};
// archers light their arrows in war when the colony has fuel to spare
H2.fireArrow = function (p) {
  if (!H2.war.on || !isArcher(p)) return false;
  const c = colById(p.col); if (!c) return false;
  const s = armyOf(c).strategy;
  if (s !== "siege" && s !== "assault" && s !== "hold" && s !== "sally" && s !== "harass") return false;
  if ((c.stock.wood || 0) < 15) return false;
  if (rnd() < 0.25) { c.stock.wood -= 0.2; return true; }
  return false;
};

/* ---- civilians: militia, shelter, fire-fighting ------------------------------------------- */
const _warThink = H2.warThink;
H2.warThink = function (p, col) {
  const c = col || colById(p.col);
  if (H2.war.on && c && c.war.state === "siege" && !isMil(p) && !p.envoy && !isChildPx(p)) {
    const s = armyOf(c).strategy;
    if (s === "militia" && trait(p, "b") >= 0 && p.hp > 45 && stageOf(p) === "adult") {
      const e = nearestHostile(p, 14);
      if (e) { if (!p.militia) { p.militia = true; if (!p.wpn) p.wpn = "spear"; life(p, "Took up a spear to defend " + c.name + " as militia.", "war"); } return setTask(p, "fight", { tid: e.id }, 90); }
    }
    if ((s === "shelter" || s === "hold" || s === "militia") && c.hall && !nearestHostile(p, 6) && p.th > 25 && p.hu > 20 && (!p.task || p.task.k !== "shelter")) {
      return setTask(p, "shelter", { until: pixelTicks + 500 }, 60);
    }
  }
  return _warThink(p, col);
};
TASKS.shelter = function (p, t) {
  const c = colById(p.col); if (!c || !c.hall || c.war.state !== "siege" || pixelTicks > t.until) return "done";
  const r = goTo(p, c.hall.x + (p.id % 7) - 3, c.hall.y, 3, 6);
  if (r === "fail") return "done";
};
// fires near the village: the nearest able civilians form a bucket line
function fireWatch(c) {
  if ((pixelTicks + c.id * 7) % 270 > 90) return;
  if (!elements.fire) return;
  const ext = c.ext || [c.x - 12, c.x + 12];
  const f = H2.findNear(c.x, c.y - 4, Math.round(Math.min(40, Math.max(14, (ext[1] - ext[0]) / 2 + 6))), (o) => o.element === "fire" && inb(o.x, o.y + 1) && !!pixelMap[o.x][o.y + 1] && pixelMap[o.x][o.y + 1].fac === c.fac);
  if (!f) return;
  const cand = H2.people.filter((q) => q.col === c.id && !q.dead && !isChildPx(q) && !isMil(q) && !q.sleeping && q.hp > 40 && (!q.task || q.task.k !== "douse")).sort((a, b) => Math.abs(a.x - f.x) - Math.abs(b.x - f.x)).slice(0, 3);
  for (const q of cand) setTask(q, "douse", { x: f.x, y: f.y, t0: pixelTicks }, 80);
}
TASKS.douse = function (p, t) {
  if (pixelTicks - t.t0 > 700) return "done";
  const r = goTo(p, t.x, t.y, 2, 4);
  if (r === "fail") return "done";
  if (r === "arrive") {
    let n = 0;
    for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) { const o = at(t.x + dx, t.y + dy); if (o && (o.element === "fire" || o.element === "embers")) { deletePixel(o.x, o.y); if (elements.steam && rnd() < 0.3) createPixel("steam", o.x, o.y); n++; } }
    if (n) { if (!t.credited) { t.credited = 1; life(p, "Helped put out a fire in " + ((colById(p.col) || {}).name || "the village") + ".", "fire"); } }
    const more = H2.findNear(p.x, p.y, 8, (o) => o.element === "fire");
    if (more) { t.x = more.x; t.y = more.y; return; }
    return "done";
  }
};
// handles for tools, events and tests
H2.spawnPerson = spawnPerson; H2.setWarState = setWarState; H2.declareWar = declareWar; H2.groundY = groundY;
