
/* ======================================================================
   PEOPLE: spawn, physics, vitals, health, death
   ====================================================================== */
const SKIN = ["#f3e7db","#f7ead0","#eadaba","#d7bd96","#a07e56","#825c43","#604134","#3a312a"];
const FALL_SAFE = 5;
const ACT = 3;                 // a person acts every ACT ticks (walking speed)
const HARM = { acid:5, acid_gas:3, hydrochloric_acid:5, sulfuric_acid:5, nitric_acid:5, radiation:3, fallout:2, neutron:4, poison:4, poison_gas:3,
  chlorine:4, cyanide:6, cyanide_gas:5, lye:4, bleach:3, mustard_gas:4, sarin:7, dioxin:3, plague_gas:2, uranium:1, plutonium:2, antimatter:9, magma:9, lava:9,
  molten_iron:9, molten_gold:9, plasma:9, laser:6, lightning:8 };

function headOf(b) { const h = at(b.x, b.y - 1); return (h && h.element === "hz_head" && !h.del) ? h : null; }
function isChildPx(p) { return p.element === "hz_child"; }
function ageOf(p) { return pixelTicks - (p.b || 0); }
function stageOf(p) { const a = ageOf(p); return a < CHILD_T ? "child" : a > ELDER_T ? "elder" : "adult"; }
H2.ageOf = ageOf; H2.stageOf = stageOf;

/* ---- mutating helpers ------------------------------------------------ */
function bodyColor(p) {
  const F = FAC[p.fac] || FAC[0];
  if (p.job === "soldier" || p.job === "sentry") return F.dark;
  if (p.job === "doctor") return "#e8eef0";
  return pick(F.cloth);
}
function initPerson(b, fac, o) {
  o = o || {};
  b.id = H2.idSeq++;
  b.fac = fac === undefined ? 0 : fac;
  b.sex = o.sex || (rnd() < 0.5 ? "m" : "f");
  b.first = o.first || pick(b.sex === "m" ? NAMES_M : NAMES_F);
  b.sn = o.sn || pick(SURN);
  b.name = b.first + " " + b.sn;
  b.b = o.born !== undefined ? o.born : pixelTicks - (o.age !== undefined ? o.age : rint(CHILD_T + DAY * 2, DAY * 14));
  b.tr = o.tr || rollTraits();
  b.hp = 100; b.bl = 100; b.hu = rint(70, 100); b.th = rint(70, 100); b.en = rint(60, 100); b.mo = 60; b.air = 100;
  b.bt = 37; b.bleed = 0; b.panic = 0; b.dead = false; b.sleeping = false;
  b.job = o.job || "laborer"; b.inv = {}; b.coin = rint(4, 14);
  b.fr = {}; b.sp = 0; b.par = o.par || [0, 0]; b.kids = [];
  b.col = o.col || 0;
  b.dir = rnd() < 0.5 ? -1 : 1; b.task = null;
  b.kills = 0; b.sk = { farm: 0, wood: 0, mine: 0, smith: 0, fight: 0, heal: 0, build: 0 };
  b.wpn = null; b.arm = 0; b.cl = 0; b.imm = []; b.sick = null; b.th2 = [];
  b.skin = o.skin || pick(SKIN);
  b.hzp = true;
  b.color = bodyColor(b);
  return b;
}
function spawnPerson(x, y, fac, o) {  // x,y = body cell; head at y-1
  o = o || {};
  if (!inb(x, y) || !inb(x, y - 1)) return null;
  if (pixelMap[x][y] || pixelMap[x][y - 1]) return null;
  createPixel("hz_body", x, y);
  const b = pixelMap[x][y]; if (!b || b.element !== "hz_body") return null;
  createPixel("hz_head", x, y - 1);
  const h = pixelMap[x][y - 1];
  initPerson(b, fac, o);
  if (h) { h.color = b.skin; h.fac = fac; }
  b.col = o.col || colonyFor(fac, x, y).id;
  const c = colById(b.col); if (c) c.pop = (c.pop || 0) + 1;
  if (!o.born) life(b, "Arrived " + (c ? "at " + c.name : "in the land") + " as a " + (o.job || "settler") + ".", "found");
  return b;
}
function spawnChild(x, y, fac, o) {
  if (!inb(x, y) || pixelMap[x][y]) return null;
  createPixel("hz_child", x, y);
  const b = pixelMap[x][y]; if (!b || b.element !== "hz_child") return null;
  initPerson(b, fac, o);
  b.color = pick(FAC[fac].cloth);
  b.col = o.col || colonyFor(fac, x, y).id;
  const c = colById(b.col); if (c) c.pop = (c.pop || 0) + 1;
  return b;
}
function legacyInit(p) { // a person pixel that did not come through spawnPerson (save from another version, other mods...)
  const fac = p.fac !== undefined ? p.fac : 0;
  initPerson(p, fac, { age: p.element === "hz_child" ? rint(0, CHILD_T - 100) : undefined });
  const c = colonyFor(p.fac, p.x, p.y); p.col = c.id; c.pop = (c.pop || 0) + 1;
}
function growUp(p) {
  if (!isEmpty(p.x, p.y - 1)) return false;
  const color = p.skin || pick(SKIN);
  createPixel("hz_head", p.x, p.y - 1);
  const h = at(p.x, p.y - 1); if (!h) return false;
  h.color = color; h.fac = p.fac;
  changePixel(p, "hz_body", false);
  life(p, "Came of age and joined the adults of " + ((colById(p.col) || {}).name || "the village") + ".", "age");
  p.color = bodyColor(p);
  chronicle(p.first + " " + p.sn + " came of age.", false, p.fac);
  return true;
}

/* ---- movement ---------------------------------------------------------- */
function canEnter(x, y, p, soft) {
  if (!inb(x, y)) return false;
  const o = pixelMap[x][y];
  if (!o) return true;
  if (soft && isSoft(o)) return true;
  const k = kindOf(o);
  if (k === 1) return true;
  if (k === 3) return doorOpenable(p, o);
  return false;
}
let SHIFT_DY = 0;
// is the person heading for somewhere above them (e.g. a bed upstairs)? then stairs are steps, not an archway
function goingUp(p) { return p.tgy !== undefined && pixelTicks - (p.tgT || 0) < 30 && p.tgy < p.y - 1; }
function doorOpenable(p, o) {
  if (!p) return false;
  const e = elements[o.element];
  if (e && e.stair) return SHIFT_DY === 0 && !goingUp(p);
  if (e && e.pass) return true;
  if (o.element === "hz_gate") return o.fac === undefined || o.fac === p.fac;
  return o.fac === undefined || o.fac === p.fac || p.job === "merchant" || p.nomad === "trader" || H2.truce;
}
function put(px, x, y) { let o = pixelMap[x][y]; if (o && isSoft(o)) { deletePixel(x, y); o = null; } if (!o) movePixel(px, x, y); else swapPixels(px, o); }
const DOOR_KEEP = ["fac", "color", "hp", "ay", "sx", "uf", "cid", "nm", "dc", "dec"];
function openDoor(o) {
  const r = { x: o.x, y: o.y, el: o.element, t: pixelTicks + 14, keep: {} };
  for (const k of DOOR_KEEP) if (o[k] !== undefined) r.keep[k] = o[k];
  H2.doors.push(r);
  o.quiet = true;
  deletePixel(o.x, o.y);
}
function openDoorsFor(p, tx, ty) {
  const o = inb(tx, ty) ? pixelMap[tx][ty] : null;
  if (o && kindOf(o) === 3 && doorOpenable(p, o)) openDoor(o);
}
function canSlipPast(p, ob) {
  if (ob.sleeping || ob.id === undefined) return ob.dead && !ob.sleeping;
  if (!(ob.dead || ob.fac === p.fac || ob.fac === undefined || (ob.nomad && !hostileFac(p, ob)))) return false;
  if (ob.wantDir === Math.sign(ob.x - p.x) && pixelTicks - (ob.wantT || -99) < 14) return false;   // they walk the same way: just follow
  const busy = pixelTicks - (ob.wantT || -99) > 6 && ob.task && ob.task.k !== "wander";
  if (busy && p.tgx !== undefined && Math.abs(p.tgx - ob.x) <= 1 && Math.abs((p.tgyy === undefined ? ob.y : p.tgyy) - ob.y) <= 2) return false;   // that's their spot
  return true;
}
function hostileFac(p, q) { return H2.war && H2.war.on && p.fac !== q.fac; }
// idle people keep a little personal space: step away from a neighbour when there is room
function spaceOut(p) {
  if ((pixelTicks + p.id) % 25 !== 0 || p.sleeping) return false;
  const L = at(p.x - 1, p.y), R = at(p.x + 1, p.y);
  const pl = L && isPerson(L) && !L.dead, pr = R && isPerson(R) && !R.dead;
  if (pl === pr) return false;
  const d = pl ? 1 : -1;
  return dropOk(p.x + d, p.y) && shift(p, d, 0);
}
H2.spaceOut = spaceOut;
function shift(p, dx, dy, soft) {    // move the whole person (body + head) by dx,dy; returns success. soft: trample grass blades
  const ch = isChildPx(p);
  const h = ch ? null : headOf(p);
  if (!ch && !h) return false;
  const bx = p.x + dx, by = p.y + dy;
  const hx = bx, hy = by - 1;
  const ox = p.x, oy = p.y;
  const own = (x, y) => (x === ox && y === oy) || (!ch && x === ox && y === oy - 1);
  // people never block friends: they slip past each other (swap places), but never take the exact spot
  // somebody is standing at to work - and nobody is ever pushed out of bed
  if (dx !== 0 && Math.abs(dy) <= 1 && !ch) {
    const ob = inb(bx, by) ? pixelMap[bx][by] : null;
    if (ob && (ob.element === "hz_body" || ob.element === "hz_child") && canSlipPast(p, ob)) {
      if (ob.element === "hz_body") {
        const oh = at(bx, by - 1);
        if (oh && oh.element === "hz_head") { swapPixels(p, ob); swapPixels(h, oh); return true; }
      } else {
        // a child: step over them and let them take our place
        SHIFT_DY = dy; const okH = own(hx, hy) || canEnter(hx, hy, p, soft); SHIFT_DY = 0;
        if (okH) { SHIFT_DY = dy; openDoorsFor(p, hx, hy); SHIFT_DY = 0; if (!pixelMap[hx][hy] || own(hx, hy)) { swapPixels(p, ob); put(h, hx, hy); return true; } }
      }
    }
  }
  // check first, then open doors: never open a door we cannot pass anyway
  const pass = (x, y) => { if (own(x, y)) return true; if (canEnter(x, y, p, soft)) return true; return false; };
  SHIFT_DY = dy;
  const okB = pass(bx, by), okH = okB && (ch || pass(hx, hy));
  SHIFT_DY = 0;
  if (!okB || !okH) return false;
  SHIFT_DY = dy;
  if (!ch) openDoorsFor(p, hx, hy);
  openDoorsFor(p, bx, by);
  SHIFT_DY = 0;
  if (ch) { put(p, bx, by); return true; }
  if (dy > 0) { put(p, bx, by); put(h, hx, hy); }
  else { put(h, hx, hy); put(p, bx, by); }
  return true;
}
H2.shift = shift;
function dropOk(x, y) { // is there something to stand on within 3 cells below (x,y)?
  for (let k = 1; k <= 6; k++) {
    if (!inb(x, y + k)) return true;
    const o = pixelMap[x][y + k];
    if (o) { const kd = kindOf(o); return kd !== 4; }
  }
  return false;
}
function tryWalk(p, dx, reckless) {
  if (!dx) return false;
  if (!reckless && !(p.panic > 0) && !dropOk(p.x + dx, p.y) && !(p.fall)) {
    // could also be a one-step up; check that first
    if (!shift(p, dx, -1) && !shift(p, dx, -1, true)) return false;
    p.dir = dx; return true;
  }
  if (shift(p, dx, 0) || shift(p, dx, -1) || shift(p, dx, 0, true) || shift(p, dx, -1, true)) { p.dir = dx; return true; }
  if (climb(p, dx)) { p.dir = dx; return true; }
  if (shift(p, dx, 1)) { p.dir = dx; return true; }          // step down diagonally (off furniture, through a low door)
  return false;
}
// scramble up a ledge two cells high (slowly). Needs head room above the person and free space on the ledge.
function climb(p, dx) {
  if (isChildPx(p) || p.leg || (p.climbT && pixelTicks < p.climbT)) return false;
  const x = p.x, y = p.y;
  if (!inb(x, y - 3) || !canEnter(x, y - 2, p, true)) return false;
  const front = at(x + dx, y), front2 = at(x + dx, y - 1);
  if (!front || !front2 || kindOf(front) < 2 || kindOf(front2) < 2) return false;          // only a real ledge
  if (!canEnter(x + dx, y - 2, p, true) || !canEnter(x + dx, y - 3, p, true)) return false;
  if (!shift(p, 0, -1, true)) return false;
  if (!shift(p, dx, -1, true)) { shift(p, 0, 1); return false; }
  p.climbT = pixelTicks + 9; p.fl = 0;
  return true;
}
// short memory of unreachable targets so the AI picks a different well / tree / bed next time
function markBad(p, x, y, dur) { if (!p.bad) p.bad = {}; p.bad[x + "," + y] = pixelTicks + (dur || 1500); }
function isBad(p, x, y) { if (!p.bad) return false; const k = x + "," + y, e = p.bad[k]; if (!e) return false; if (e < pixelTicks) { delete p.bad[k]; return false; } return true; }
H2.markBad = markBad; H2.isBad = isBad;
H2.tryWalk = tryWalk;
// villagers clear natural obstacles (trees, rock ledges, earth walls) that stand in their way — never player or village structures
function clearObstacle(p, dir) {
  let did = false;
  for (const dy of [0, -1]) {
    const o = at(p.x + dir, p.y + dy); if (!o || isPerson(o)) continue;
    const e = elements[o.element]; if (!e || e.hzb || e.fdn || e.hazard || kindOf(o) !== 2) continue;
    if (isTreePart(o) || o.element === "plant") { fellTree(p, isTreePart(o) ? (treeBase(o) || o) : o); return true; }
    if (p.task && p.task.pri >= 85 && p.task.k !== "flee") return false;
    deletePixel(o.x, o.y); did = true;
  }
  return did;
}
// two-storey houses: walk to the foot of the stairs first when the target is upstairs, and back to the stairs to come down.
// Stair blocks and upper-floor planks carry sx (x of the stair foot) and uf (body y on the upper floor).
function stairRoute(p, tx, ty) {
  const below = at(p.x, p.y + 1);
  const tb = at(tx, ty + 1);
  const tUp = tb && tb.sx !== undefined && tb.uf !== undefined && Math.abs(ty - tb.uf) <= 1 ? tb : null;
  if (below && below.sx !== undefined && below.uf !== undefined && !isPerson(below)) {
    if (tUp && tUp.sx === below.sx) return null;                       // the target is on this floor
    return { x: below.sx, down: true };                                // head back down the stairs first
  }
  if (tUp && p.y > ty + 1 && p.x !== tUp.sx) return { x: tUp.sx };      // go to the foot of the stairs
  return null;
}
H2.stairRoute = stairRoute;

/* ---- path finding -------------------------------------------------------------
   A breadth-first search over the cells a person can stand in (body + head free, something to stand on).
   Moves: walk, step up one cell (with head room), climb a two-cell ledge, drop down up to four cells.
   People are treated as passable (friends slip past each other). The result is only used to pick the
   walking direction; the actual steps are still taken by tryWalk/shift. Paths are cached per target and
   a small per-tick budget keeps hundreds of villagers cheap. */
const PF = { budget: 0, tick: -1, MAXN: 9000 };
function pfPass(x, y, p) {
  if (x < 0 || x > width || y < 0 || y > height) return false;
  const o = pixelMap[x][y];
  if (!o || isPerson(o) || isSoft(o)) return true;
  const k = kindOf(o);
  if (k === 1) return true;
  if (k === 3) { const e = elements[o.element]; if (e && (e.pass || e.stair)) return true; return o.element === "hz_gate" ? (o.fac === undefined || o.fac === p.fac) : (o.fac === undefined || o.fac === p.fac || p.job === "merchant" || p.nomad === "trader" || !!H2.truce); }
  return false;
}
// a ladder cell (also while it is swung aside for a climber passing through)
function isLadder(x, y) {
  if (!inb(x, y)) return false;
  const o = pixelMap[x][y]; if (o) { const e = elements[o.element]; if (e && e.ladder) { H2.hasLadders = true; return true; } if (!isPerson(o)) return false; }
  if (!H2.hasLadders) return false;
  const d = H2.doors; for (let i = 0; i < d.length; i++) if (d[i].x === x && d[i].y === y && d[i].el === "hz_ladder") return true;
  return false;
}
H2.isLadder = isLadder;
function pfSupport(x, y) {
  if (y + 1 > height) return true;
  if (isLadder(x, y + 1)) return true;
  const o = pixelMap[x][y + 1];
  if (!o || isPerson(o)) return false;
  const e = elements[o.element];
  if (e && e.stair) return true;
  const k = kindOf(o); return k === 2 || (k === 1 && e && e.state === "liquid");
}
function findPath(p, tx, ty, range, vy) {
  const ch = isChildPx(p);
  const x0 = Math.max(1, Math.min(p.x, tx) - 30), x1 = Math.min(width - 1, Math.max(p.x, tx) + 30);
  const W = x1 - x0 + 1, Hh = height + 1;
  const stand = (x, y) => x >= x0 && x <= x1 && y >= 1 && y < height && pfPass(x, y, p) && (ch || pfPass(x, y - 1, p)) && pfSupport(x, y);
  const prev = new Int32Array(W * Hh).fill(-2);
  const idx = (x, y) => (x - x0) * Hh + y;
  const q = new Int32Array(Math.min(W * Hh, PF.MAXN + 64));
  let qh = 0, qt = 0;
  const s = idx(p.x, p.y); prev[s] = -1; q[qt++] = s;
  let goal = -1, n = 0;
  while (qh < qt && n++ < PF.MAXN) {
    const cur = q[qh++]; const cx = Math.floor(cur / Hh) + x0, cy = cur % Hh;
    if (Math.abs(cx - tx) <= range && Math.abs(cy - ty) <= vy) { goal = cur; break; }
    for (const dx of (tx >= cx ? [1, -1] : [-1, 1])) {
      const nx = cx + dx; if (nx < x0 || nx > x1) continue;
      const tryN = (ny) => { if (qt >= q.length) return; const k = idx(nx, ny); if (prev[k] !== -2) return; prev[k] = cur; q[qt++] = k; };
      if (stand(nx, cy)) { tryN(cy); continue; }
      // step up (needs head room above our own head)
      if (stand(nx, cy - 1) && (ch ? pfPass(cx, cy - 1, p) : pfPass(cx, cy - 2, p))) { tryN(cy - 1); continue; }
      // climb a two-cell ledge
      if (!ch && stand(nx, cy - 2) && pfPass(cx, cy - 2, p) && pfPass(cx, cy - 3, p)) { tryN(cy - 2); continue; }
      // step down diagonally (head passes where the body was level)
      if (pfPass(nx, cy, p) && stand(nx, cy + 1) && !(stand(nx, cy))) tryN(cy + 1);
      // drop down
      if (pfPass(nx, cy, p) && (ch || pfPass(nx, cy - 1, p))) for (let k = 1; k <= 6; k++) { if (!pfPass(nx, cy + k, p)) break; if (stand(nx, cy + k)) { tryN(cy + k); break; } }
    }
    // ladders: climb straight up or down
    for (const dy of [-1, 1]) {
      const ny = cy + dy; if (ny < 1 || ny >= height || !isLadder(cx, ny)) continue;
      if (dy < 0 && !(ch ? pfPass(cx, ny, p) : pfPass(cx, ny - 1, p))) continue;
      const k = idx(cx, ny); if (prev[k] !== -2 || qt >= q.length) continue; prev[k] = cur; q[qt++] = k;
    }
  }
  if (goal < 0) return null;
  const pts = []; let c = goal;
  while (c >= 0) { pts.push({ x: Math.floor(c / Hh) + x0, y: c % Hh }); c = prev[c]; }
  pts.reverse();
  return pts;
}
H2.findPath = findPath;
// direction to walk according to the cached path (null when there is no usable path)
function pathDir(p, tx, ty, range, vy) {
  let P = p.path;
  if (P && (Math.abs(P.tx - tx) > 2 || Math.abs(P.ty - ty) > 2 || pixelTicks - P.t > 400)) P = p.path = null;
  if (P && P.pts) {
    // where are we on the path? (look a few nodes ahead, people get swapped around a bit)
    let i = -1;
    for (let k = P.i; k < Math.min(P.pts.length, P.i + 6); k++) { const n = P.pts[k]; if (n.x === p.x && n.y === p.y) { i = k; break; } }
    if (i < 0) for (let k = P.i; k < Math.min(P.pts.length, P.i + 6); k++) { const n = P.pts[k]; if (n.x === p.x && Math.abs(n.y - p.y) <= 1) { i = k; break; } }
    if (i >= 0) { P.i = i; const nx = P.pts[i + 1]; return nx ? (Math.sign(nx.x - p.x) || p.dir || 1) : 0; }
    P = p.path = null;     // knocked off the path: plan again
  }
  if (P && !P.pts && pixelTicks - P.t < 60) return null;          // recently found no path: keep the old behaviour for a while
  if (pixelTicks - (p.pathT || -99) < 8) return null;
  if (PF.tick !== pixelTicks) { PF.tick = pixelTicks; PF.budget = 10; }
  if (PF.budget <= 0) return null;
  PF.budget--; p.pathT = pixelTicks;
  const pts = findPath(p, tx, ty, range, vy);
  p.path = { tx: tx, ty: ty, t: pixelTicks, pts: pts, i: 0 };
  if (!pts || pts.length < 2) return pts ? 0 : null;
  return Math.sign(pts[1].x - p.x) || p.dir || 1;
}
function goTo(p, tx, ty, range, vy) {
  range = range === undefined ? 1 : range; vy = vy === undefined ? 3 : vy;
  if (Math.abs(tx - p.x) <= range && Math.abs(ty - p.y) <= vy) { p.stk = 0; p.detour = 0; return "arrive"; }
  if ((p.stk || 0) >= 2 && Math.abs(tx - p.x) <= range + 2 && Math.abs(ty - p.y) <= vy) { p.stk = 0; p.detour = 0; return "arrive"; }   // crowded spot: close enough
  p.tgx = tx; p.tgyy = ty;
  const pd = pathDir(p, tx, ty, range, vy);
  const via = pd === null ? stairRoute(p, tx, ty) : null;
  p.tgy = via ? p.y : ty; p.tgT = pixelTicks;
  if (pd !== null && p.path && p.path.pts) { const nx = p.path.pts[p.path.i + 1]; if (nx && nx.y < p.y) p.tgy = nx.y - 2; else if (nx) p.tgy = p.y; }   // stairs are steps only when the path climbs
  if (pd !== null && p.path && p.path.pts) {
    const nx = p.path.pts[p.path.i + 1];
    if (nx && nx.x === p.x && nx.y !== p.y && isLadder(p.x, nx.y)) {     // on a ladder: climb
      if (shift(p, 0, Math.sign(nx.y - p.y))) { p.stk = 0; p.fl = 0; p.path.i++; return "moving"; }
      p.stk = (p.stk || 0) + 1; return "blocked";
    }
  }
  if (via) { tx = via.x; ty = p.y; }
  const dxT = tx - p.x;
  let dir = pd ? pd : Math.sign(dxT);
  if (p.detour > 0) { dir = p.dd; p.detour--; }
  else if (dir === 0) dir = p.dir || 1;
  p.wantDir = dir; p.wantT = pixelTicks;
  if (p.gx === p.x && p.gy === p.y) { p.gs = (p.gs || 0) + 1; if (p.gs > 22) { p.gs = 0; p.dd = rnd() < 0.5 ? -1 : 1; p.detour = rint(6, 14); p.fails = (p.fails || 0) + 1; } } else { p.gs = 0; p.gx = p.x; p.gy = p.y; }
  const moved = tryWalk(p, dir, pd === null && (p.fails || 0) > 6);      // long stuck with no path: risk a deeper drop
  if (moved) { p.stk = Math.max(0, (p.stk || 0) - 1); }
  else {
    p.stk = (p.stk || 0) + 1;
    if (p.stk > 1 && clearObstacle(p, dir)) { p.stk = 0; p.fails = 0; }
    else if (p.stk > 4) { p.dd = rnd() < 0.5 ? -dir : dir; if (p.detour > 0 && p.dd === dir) p.dd = -dir; p.detour = pd ? rint(1, 4) : rint(5, 14); p.stk = 0; p.fails = (p.fails || 0) + 1; p.path = null; }
    if ((p.fails || 0) > 10) { p.fails = 0; return "fail"; }
  }
  return moved ? "moving" : "blocked";
}
H2.goTo = goTo;

/* ---- health ------------------------------------------------------------ */
function addThought(p, key, v, dur) {
  if (!p.th2) p.th2 = [];
  for (const t of p.th2) if (t.k === key) { t.e = pixelTicks + dur; t.v = v; return; }
  p.th2.push({ k: key, v: v, e: pixelTicks + dur });
  if (p.th2.length > 12) p.th2.shift();
}
H2.addThought = addThought;
function hurt(p, amt, cause, src) {
  if (!p || p.dead || p.del || amt <= 0) return;
  p.hp -= amt;
  p.lastHit = { c: cause, t: pixelTicks, by: src ? src.id : 0, byName: src ? nm(src) : "" };
  if (amt >= 3) p.panic = Math.max(p.panic || 0, 3);
  if (amt >= 6 && cause !== "starvation" && cause !== "thirst" && cause !== "cold" && cause !== "heat" && cause !== "disease") p.bleed = Math.min(3, (p.bleed || 0) + amt * 0.03);
  if (p.hp <= 0) die(p, cause, src);
}
H2.hurt = hurt;
function infect(p, kind) {
  if (!p || p.dead || p.sick) return false;
  if (p.imm && p.imm.includes(kind)) return false;
  p.sick = { k: kind, s: pixelTicks };
  if (kind === "plague") chronicle(nm(p) + " fell ill with the plague!", true, p.fac);
  else if (H2.cfg.verbose) chronicle(nm(p) + " caught " + kind + ".", false, p.fac);
  return true;
}
H2.infect = infect;
const DISEASE = { cold: { dur: 5000, dmg: 0.02, spread: 0.05 }, flu: { dur: 8000, dmg: 0.12, spread: 0.06 }, plague: { dur: 14000, dmg: 0.32, spread: 0.1 } };

function die(p, cause, killer, gone) {
  if (!p || p.dead === undefined) return;
  if (p.dead) return;
  const ch = isChildPx(p);
  p.dead = pixelTicks; p.cause = cause || "unknown causes"; p.task = null; p.sleeping = false;
  H2.stats.deaths++;
  const age = Math.floor(ageOf(p) / DAY);
  const verb = {
    starvation: "starved to death", thirst: "died of thirst", cold: "froze to death", heat: "died of heatstroke", "blood loss": "bled out",
    "old age": "passed away peacefully of old age", fall: "died from a fall", drowning: "drowned", fire: "burned to death", disease: "succumbed to illness",
    plague: "died of the plague", beheaded: "lost their head", poison: "died of poison", radiation: "died of radiation sickness",
  }[p.cause];
  let who = nm(p) + " (" + age + "d)";
  let msg;
  if (killer && killer.id) {
    killer.kills = (killer.kills || 0) + 1; killer.xp = (killer.xp || 0) + 12;
    if (killer.fac !== p.fac) life(killer, "Slew " + nm(p) + " of the " + FAC[p.fac].name + "s in battle (kill #" + killer.kills + ").", "kill");
    if (killer.kills === 3 && !killer.title) { killer.title = "Sir"; life(killer, "Hailed a hero after three victories.", "hero"); const kc = colById(killer.col); if (kc) kc.hero = nm(killer); chronicle(nm(killer) + " has slain three foes and is hailed a hero of the " + FAC[killer.fac].name + "!", true, killer.fac); }
    if (killer.kills === 8) { killer.title = "Legendary"; life(killer, "Became a living legend (eight kills).", "hero"); chronicle(nm(killer) + " — eight kills — is now a living legend!", true, killer.fac); }
    msg = who + " was slain by " + nm(killer) + ".";
    H2.stats.battles++;
    addThought(killer, "killed", -4, DAY);
    if (killer.fac !== p.fac) addThought(killer, "victory", 8, DAY);
  } else if (verb) msg = who + " " + verb + ".";
  else msg = who + " met a violent end (" + p.cause + ").";
  chronicle(msg, p.cause !== "old age" && (stageOf(p) !== "elder"), p.fac);
  life(p, "Died aged " + age + " days — " + (msg.indexOf(who) === 0 ? msg.slice(who.length + 1) : msg), "death");
  if (typeof window.announceDeath === "function" && !gone) { try { window.announceDeath(); } catch (e) {} } // death_count.js compatibility
  // loot
  if (p.coin > 0 && elements.gold_coin && !gone) { for (const d of [[0, 0], [1, 0], [-1, 0], [0, -1]]) { const x = p.x + d[0], y = p.y + d[1]; if (inb(x, y) && !pixelMap[x][y]) { createPixel("gold_coin", x, y); break; } } }
  // grief
  grieve(p);
  const c = colById(p.col);
  if (c) { c.pop = Math.max(0, (c.pop || 1) - 1); c.deaths = (c.deaths || 0) + 1; if (!gone) c.corpses.push({ id: p.id, x: p.x, y: p.y }); noteDeathForColony(c, p, killer); }
  if (!gone) { const h = ch ? null : headOf(p); if (h) { h.dead = pixelTicks; } p.color = "#8a8f8a"; }
}
function grieve(p) {
  if (p.sp) { const s = H2.byId[p.sp]; if (s && !s.dead) { s.sp = 0; addThought(s, "widowed", -35, DAY * 3); life(s, "Lost their spouse " + nm(p) + ".", "grief"); chronicle(nm(s) + " is heartbroken at the loss of " + p.first + ".", false, s.fac); } }
  for (const kid of (p.kids || [])) { const k = H2.byId[kid]; if (k && !k.dead) addThought(k, "grief", -20, DAY * 2); }
  for (const pa of (p.par || [])) { if (!pa) continue; const k = H2.byId[pa]; if (k && !k.dead) addThought(k, "grief", -22, DAY * 2); }
  for (const fid in (p.fr || {})) { const k = H2.byId[fid]; if (k && !k.dead && p.fr[fid] > 30) addThought(k, "grief", -12, DAY); }
}
function onPersonDelete(p) {
  if (!p || p.dead || p.quiet || p.id === undefined) return;
  if (p.element === "hz_head") { return; } // body will notice
  die(p, (p.lastHit && pixelTicks - p.lastHit.t < 60) ? p.lastHit.c : "destruction", p.lastHit && p.lastHit.by && pixelTicks - p.lastHit.t < 60 ? H2.byId[p.lastHit.by] : null, true);
  const h = isChildPx(p) ? null : headOf(p);
  if (h) h.dead = pixelTicks;
}

/* ---- foods ------------------------------------------------------------- */
const FOODVAL = { bread: 55, cooked_meat: 60, meat: 22, egg: 14, fried_egg: 30, baked_potato: 40, potato: 14, apple: 18, cherry: 10, banana: 18, orange: 18, corn: 22, cheese: 35,
  pie: 60, cake: 45, cookie: 25, sandwich: 55, soup: 40, wheat: 10, pizza: 55, burger: 60, hamburger: 60, carrot: 15, jelly: 15, honey: 25, nut: 12, nut_meat: 25, fish: 30, cooked_fish: 50 };
const BADFOOD = { rotten_meat: 1, dead_plant: 1, poison: 1, cyanide: 1, spoiled_milk: 1 };
let FOODS = null;
function buildFoodTable() {
  FOODS = {};
  for (const k in FOODVAL) if (elements[k]) FOODS[k] = FOODVAL[k];
  for (const k in elements) { const e = elements[k]; if (!FOODS[k] && e && (e.isFood === true || e.category === "food") && (e.state === "solid" || e.state === "powder") && !BADFOOD[k] && !e.hidden) FOODS[k] = 24; }
}
H2.foodVal = (el) => { if (!FOODS) buildFoodTable(); return FOODS[el]; };

/* ---- brain scaffolding -------------------------------------------------- */
const TASKS = H2.TASKS = {};
function setTask(p, k, a, pri) {
  if (p.task && (p.task.pri || 0) >= pri) return false;
  p.task = Object.assign({ k: k, t0: pixelTicks, pri: pri }, a || {});
  p.fails = 0; p.detour = 0; p.stk = 0; p.sleeping = p.sleeping && k === "sleep";
  return true;
}
H2.setTask = setTask;
function ownHome(p) { const b = p.home ? at(p.home.x, p.home.y) : null; return (b && b.element === "hz_bed" && b.owner === p.id) ? b : null; }

function physics(p) {
  const ch = isChildPx(p);
  const x = p.x, y = p.y;
  if (!inb(x, y + 1)) { p.fl = 0; return; }
  const below = pixelMap[x][y + 1];
  const kb = below ? kindOf(below) : 0;
  const onL = isLadder(x, y + 1) || isLadder(x, y);
  if (onL) { p.fl = 0; }
  else if (kb === 0 || (kb === 1 && pixelTicks % 3 === 0 && !p.swim) || (kb === 3 && elements[below.element].pass && !elements[below.element].stair)) {
    if (shift(p, 0, 1)) { if (kb === 0) p.fl = (p.fl || 0) + 1; return; }
  }
  if (kb >= 2) {
    if (p.fl > FALL_SAFE) {
      const dmg = (p.fl - FALL_SAFE) * 7;
      hurt(p, dmg, "fall");
      if (p.fl >= 12 && !p.dead && rnd() < 0.7) { p.leg = pixelTicks; chronicle(nm(p) + " broke a leg in a bad fall.", false, p.fac); }
    }
    p.fl = 0;
  } else if (kb === 1) p.fl = 0;
  // swimming / drowning
  if (ch) return;
  const above = at(x, y - 2);
  const submerged = above && kindOf(above) === 1 && above.element !== "smoke" && elements[above.element].state === "liquid";
  p.swim = false;
  if (submerged) {
    p.swim = true;
    if (p.en > 5 && rnd() < 0.7) shift(p, 0, -1);
  }
  p.sub = !!submerged;
}

function roofed(p) { for (let k = 2; k <= 6; k++) { if (!inb(p.x, p.y - k)) return false; const o = pixelMap[p.x][p.y - k]; if (o && !isPerson(o) && elements[o.element].hzb) return true; } return false; }
function vitals(p) {
  const ch = isChildPx(p);
  const sleeping = p.sleeping;
  // --- ageing
  const age = ageOf(p);
  if (ch && age >= CHILD_T) growUp(p);
  if (!ch) {
    const h = headOf(p);
    if (age > ELDER_T && h && !p.grey) { p.grey = true; h.color = "#cfcfcf"; }
    if (age > LIFE_T * 0.8) { const hz = clamp((age - LIFE_T * 0.8) / (LIFE_T * 0.4), 0, 3) * 0.002; if (rnd() < hz) { die(p, "old age"); return; } }
  }
  // --- needs
  p.hu = clamp(p.hu - (sleeping ? 0.07 : 0.14) * (p.task && p.task.work ? 1.2 : 1), 0, 100);
  p.th = clamp(p.th - (sleeping ? 0.1 : 0.26) * (p.bt > 38 ? 1.5 : 1), 0, 100);
  if (sleeping) p.en = clamp(p.en + (ownHome(p) ? 1.1 : 0.7), 0, 100); else p.en = clamp(p.en - 0.3 * (p.panic > 0 ? 2 : 1), 0, 100);
  // --- body temperature (metabolic regulation vs. environment handled by doHeat)
  // core body temperature `bt` follows the ambient (contact) temperature `temp` — the engine equalises pixel temps instantly,
  // so `temp` is only used as the environment reading. Coats and roofs insulate.
  if (p.bt === undefined) p.bt = 37;
  let insul = 1 + (p.cl ? 1.5 : 0) + (roofed(p) ? 1 : 0) + (sleeping ? 0.3 : 0);
  const amb = p.temp;
  let bTgt = 37;
  if (amb < 5) bTgt = 37 - (5 - amb) * 0.2 / insul; else if (amb > 45) bTgt = 37 + (amb - 45) * 0.1;
  if (p.hu <= 0) bTgt -= 1.5;
  p.bt += (bTgt - p.bt) * 0.06;
  let dmg = 0, cause = "";
  if (p.hu <= 0) { dmg += 0.55; cause = "starvation"; }
  if (p.th <= 0) { dmg += 0.9; cause = "thirst"; }
  if (p.bt < 34) { dmg += (34 - p.bt) * 0.35; cause = "cold"; } else if (p.bt > 39.5) { dmg += (p.bt - 39.5) * 0.5; cause = "heat"; }
  if (p.sub) { p.air -= 4; if (p.air <= 0) { dmg += 6; cause = "drowning"; } } else p.air = clamp(p.air + 10, 0, 100);
  if (p.burning) { dmg += 3.5; cause = "fire"; p.panic = Math.max(p.panic, 6); if (!p.burnStart) p.burnStart = pixelTicks; else if (pixelTicks - p.burnStart > 240 && rnd() < 0.25) { p.burning = false; delete p.burnStart; } }   // stop, drop and roll
  // neighbours: hazards / diseases
  for (let i = 0; i < 4; i++) {
    const nx = p.x + (i === 0 ? -1 : i === 1 ? 1 : 0), ny = p.y + (i === 2 ? 1 : i === 3 ? -1 : 0);
    const o = inb(nx, ny) ? pixelMap[nx][ny] : null; if (!o) continue;
    const hv = HARM[o.element]; if (hv) { dmg += hv; cause = o.element === "radiation" || o.element === "fallout" || o.element === "neutron" ? "radiation" : "poison"; p.panic = Math.max(p.panic, 4); }
    if (o.element === "plague" || o.element === "infection") infect(p, o.element === "plague" ? "plague" : "flu");
    else if (o.element === "rotten_meat" && rnd() < 0.01) infect(p, "flu");
  }
  if (p.sick) {
    const D = DISEASE[p.sick.k] || DISEASE.cold;
    dmg += D.dmg * (p.treated ? 0.2 : 1); if (D.dmg > 0.1) cause = cause || "disease";
    if (pixelTicks - p.sick.s > D.dur * (p.treated ? 0.5 : 1)) { const k = p.sick.k; (p.imm = p.imm || []).push(k); p.sick = null; p.treated = false; if (k === "plague") chronicle(nm(p) + " survived the plague and is now immune!", true, p.fac); }
    else if (rnd() < D.spread) { // contagion
      const near = H2.people; for (let i = 0; i < near.length; i++) { const o = near[i]; if (o === p || o.dead || o.sick) continue; if (Math.abs(o.x - p.x) < 4 && Math.abs(o.y - p.y) < 3) infect(o, p.sick.k); }
    }
  } else if (p.bt < 35.5 && rnd() < 0.002) infect(p, "cold");
  if (dmg > 0) hurt(p, dmg, cause);
  if (p.dead) return;
  // --- blood
  if (p.bleed > 0) {
    p.bl -= p.bleed * 1.2;
    if (rnd() < 0.15) { const bx = p.x + (rnd() < 0.5 ? -1 : 1), by = p.y; if (inb(bx, by) && !pixelMap[bx][by] && H2.bloodCount < 400) { createPixel("blood", bx, by); H2.bloodCount++; } }
    p.bleed -= 0.02; if (p.bleed < 0.05) p.bleed = 0;
    if (p.bl <= 0) { die(p, "blood loss"); return; }
  } else p.bl = clamp(p.bl + (p.hu > 30 ? 0.3 : 0), 0, 100);
  if (p.bl < 30 && !p.sleeping && rnd() < 0.2) { p.sleeping = true; p.faint = pixelTicks; p.task = null; }   // faint
  if (p.faint && pixelTicks - p.faint > 160 && p.sleeping && p.en > 20) { p.sleeping = false; p.faint = 0; }
  // --- regeneration
  if (p.bleed === 0 && p.hu > 35 && p.th > 30 && !p.sick && p.hp < 100) p.hp = Math.min(100, p.hp + 0.25 * (sleeping ? 2.2 : 1) * (p.treated ? 1.6 : 1));
  if (p.leg && pixelTicks - p.leg > DAY * 1.2) p.leg = 0;
  if (p.panic > 0) p.panic--;
  // --- clothes: villagers get a coat when it is cold and they can afford one
  if (!p.cl && p.temp < 8 && p.coin >= 6 && rnd() < 0.05) { p.cl = 1; p.coin -= 6; }
  // --- thoughts / mood
  let tm = 0;
  if (p.th2) { for (let i = p.th2.length - 1; i >= 0; i--) { const t = p.th2[i]; if (pixelTicks > t.e) p.th2.splice(i, 1); else tm += t.v; } }
  let tgt = 55 + tm + trait(p, "m") * 25;
  if (p.hu < 25) tgt -= 15; if (p.hu < 8) tgt -= 15; if (p.th < 25) tgt -= 15; if (p.en < 20) tgt -= 12; if (p.bt < 35.5) tgt -= 10; if (p.hp < 50) tgt -= 10;
  if (p.hu > 70 && p.th > 60) tgt += 5;
  if (ownHome(p)) tgt += 5;
  if (p.sp) tgt += 6;
  let nf = 0; for (const k in p.fr) if (p.fr[k] > 25) nf++;
  if (nf >= 2) tgt += 6; else if (nf === 0 && !ch && age > CHILD_T * 2) tgt -= 6;
  const col = colById(p.col);
  if (col) { if (col.unrest > 50) tgt -= (col.unrest - 50) * 0.2; if (col.tension >= 3) tgt -= 4; if (col.festival && pixelTicks < col.festival) tgt += 12; }
  p.mo = clamp(p.mo + (clamp(tgt, 0, 100) - p.mo) * 0.12, 0, 100);
}

function deadTick(p) {
  const ch = isChildPx(p);
  const below = at(p.x, p.y + 1);
  if (!below && inb(p.x, p.y + 1)) { if (shift(p, 0, 1)) return; }
  const t = pixelTicks - p.dead;
  if (t > 900 && !p.rotted) { p.rotted = true; p.color = "#6e7a5a"; }
  if (t > 1800 && rnd() < 0.02) {
    const h = ch ? null : headOf(p); p.quiet = true;
    if (h) { h.quiet = true; changePixel(h, "rotten_meat", false); h.dead = false; }
    changePixel(p, rnd() < 0.5 ? "bone" : "rotten_meat", false);
  }
}

function bodyTick(p) {
  if (p.id === undefined) legacyInit(p);
  doHeat(p); doBurning(p); doElectricity(p);
  if (p.del) return;
  H2.byId[p.id] = p;
  if (p.dead) { deadTick(p); return; }
  const ch = isChildPx(p);
  if (!ch) { const h = headOf(p); if (!h) { p.nh = (p.nh || 0) + 1; if (p.nh > 8) { die(p, "beheaded"); return; } } else { p.nh = 0; if (h.dead) h.dead = false; } }
  physics(p);
  if (p.del || p.dead) return;
  if ((pixelTicks + p.id) % 20 === 5 && !ch && H2.sense) { try { H2.sense(p); } catch (e) { if (H2.cfg.verbose) console.error(e); } }
  if ((pixelTicks + p.id) % 10 === 0) { vitals(p); if (p.dead) return; try { think(p); } catch (e) { if (H2.cfg.verbose) console.error(e); p.task = null; } }
  if (p.sleeping) { if ((pixelTicks + p.id) % 10 === 0) sleepCheck(p); return; }
  if ((pixelTicks + p.id) % (ACT + (p.leg ? 4 : 0) - (p.panic > 2 ? 1 : 0) + (ch ? -1 : 0)) === 0) {
    try { actTick(p); } catch (e) { if (H2.cfg.verbose) console.error(e); p.task = null; }
  }
}
function sleepCheck(p) {
  if (p.faint) return;
  const night = isNight();
  if (p.en >= 98 || (!night && p.en > 60 && rnd() < 0.3) || p.hu <= 0 || p.th <= 0 || p.panic > 0 || p.burning || (p.lastHit && pixelTicks - p.lastHit.t < 30)) { p.sleeping = false; p.task = null; }
}

function headTick(h) {
  doHeat(h); doBurning(h); doElectricity(h);
  if (h.del) return;
  const b = at(h.x, h.y + 1);
  if (b && b.element === "hz_body" && !b.del && !h.orph) { h.orph = 0; if (b.dead) h.dead = b.dead; h.fac = b.fac; return; }
  if (b && b.element === "hz_body" && !b.del) { h.orph = 0; return; }
  h.orph = (h.orph || 0) + 1;
  // free-falling / lying head
  if (inb(h.x, h.y + 1) && (!b || kindOf(b) === 1)) { if (!b) movePixel(h, h.x, h.y + 1); else if (pixelTicks % 3 === 0) swapPixels(h, b); }
  if (h.orph > 10 && !h.dead) h.dead = pixelTicks;
  if (h.dead && pixelTicks - h.dead > 1500 && rnd() < 0.02) { h.quiet = true; changePixel(h, rnd() < 0.4 ? "bone" : "rotten_meat", false); }
}

/* ---- the "think" step: pick what to do next --------------------------- */
function think(p) {
  if (p.sleeping) return;
  const ch = isChildPx(p);
  const t = p.task;
  const col = colById(p.col);
  // 1. panic / burning
  if (p.burning) { const w = H2.findNear(p.x, p.y, 8, (o) => o.element === "water" || o.element === "salt_water" || o.element === "pool_water"); if (w) setTask(p, "goto_drink", { tx: w.x, ty: w.y, drink: false }, 95); else setTask(p, "flee", { until: pixelTicks + 80 }, 95); }
  if (p.panic > 2) { setTask(p, "flee", { until: pixelTicks + 60 }, 100); return; }
  // 2. war / defence reflex (soldiers, and anyone attacked)
  if (H2.warThink && H2.warThink(p, col)) return;
  // 3. wounds
  if (p.bleed > 0.2 || p.hp < 40 || p.leg) { if (col && H2.healSeek && H2.healSeek(p, col)) return; }
  // 4. cold / hot
  if (p.bt < 35.6) { if (setTask(p, "warm", { until: pixelTicks + 400 }, 60)) return; }
  if (p.bt > 38.6) { if (setTask(p, "cool", { until: pixelTicks + 300 }, 60)) return; }
  // 5. thirst, hunger
  if (p.th < 35 && p.flask > 0) { p.flask--; p.th = Math.min(100, p.th + 45); }      // a sip from the waterskin saves a trip
  if (p.th < 35) { if (setTask(p, "drink", { work: false }, p.th < 15 ? 72 : 55)) return; }
  if (p.hu < 32) { if (setTask(p, "eat", {}, p.hu < 10 ? 70 : 50)) return; }
  // 6. sleep
  if ((isNight() && p.en < 70) || p.en < 18) { if (p.th >= 12 && p.hu >= 6 && setTask(p, "sleep", {}, p.en < 6 ? 65 : 45)) return; }
  if (ch) { if (!t) setTask(p, "play", {}, 5); return; }
  // 7. sick: rest
  if (p.sick && p.sick.k !== "cold" && p.hp < 70) { if (col && H2.healSeek && H2.healSeek(p, col)) return; if (setTask(p, "rest", { until: pixelTicks + 300 }, 40)) return; }
  // 8. social evenings
  if (isEvening() && p.en > 30 && (!t || t.pri < 30)) { if (setTask(p, "socialize", { until: pixelTicks + 500 }, 30)) return; }
  // 9. work
  if (!t || t.pri <= 10) { if (H2.jobThink && H2.jobThink(p, col)) return; }
  if (!p.task) setTask(p, "wander", {}, 1);
}

function actTick(p) {
  const t = p.task;
  if (!t) { TASKS.wander(p, { k: "wander" }); return; }
  const f = TASKS[t.k];
  if (!f) { p.task = null; return; }
  const r = f(p, t);
  if (r === "done" || r === "fail") { if (p.task === t) p.task = null; }
  else if (pixelTicks - t.t0 > (t.timeout || 1800)) { if (p.task === t) p.task = null; }
}

/* ---- the fundamental tasks -------------------------------------------- */
function homeTarget(p) { const c = colById(p.col); return c ? { x: c.x, y: c.y } : { x: p.x, y: p.y }; }
TASKS.wander = function (p, t) {
  if (!p.wt || p.wt <= 0) {
    if (rnd() < 0.45) { p.wt = rint(3, 10); p.wd = 0; spaceOut(p); return; }
    const hm = homeTarget(p);
    p.wd = (Math.abs(p.x - hm.x) > 45 && rnd() < 0.8) ? Math.sign(hm.x - p.x) : (rnd() < 0.5 ? -1 : 1);
    p.wt = rint(6, 28);
  }
  p.wt--;
  if (!p.wd) spaceOut(p);
  if (p.wd && !tryWalk(p, p.wd, false)) { p.wd = -p.wd; if (rnd() < 0.3) p.wt = 0; }
  if (p.wt <= 0 && p.task && p.task.k === "wander") p.task = null;
};
TASKS.play = function (p, t) { // children run around near an adult/home
  if (!p.wt || p.wt <= 0) { p.wt = rint(4, 18); p.wd = rnd() < 0.5 ? -1 : 1; const hm = homeTarget(p); if (Math.abs(p.x - hm.x) > 30) p.wd = Math.sign(hm.x - p.x); }
  p.wt--; if (!tryWalk(p, p.wd, false)) p.wd = -p.wd;
  if (rnd() < 0.02 && !isNight()) shift(p, 0, -1);  // hop
  if (p.wt <= 0) return "done";
};
TASKS.flee = function (p, t) {
  if (pixelTicks > t.until && !(p.panic > 0)) return "done";
  if (p.panic <= 0 && !p.burning) return "done";
  if (t.from === undefined) t.from = p.x + (rnd() < 0.5 ? -4 : 4);
  const d = p.x >= t.from ? 1 : -1;
  if (!tryWalk(p, d, true)) { if (!tryWalk(p, -d, true)) shift(p, 0, -1); }
  if (rnd() < 0.15) t.from = p.x + (rnd() < 0.5 ? -6 : 6);
};
TASKS.rest = function (p, t) { if (pixelTicks > t.until) return "done"; spaceOut(p); };
TASKS.warm = function (p, t) {
  if (pixelTicks > t.until || p.bt > 36.8) return "done";
  const s = H2.nearestOf((H2.st.campfire || []).concat(H2.st.hearth || [], H2.st.forgefire || []), p.x, p.y, 70);
  if (!s) { if (!p.cl && p.coin >= 6) { p.cl = 1; p.coin -= 6; } return TASKS.wander(p, t); }
  const r = goTo(p, s.x, accY(s), 2, 3);
  if (r === "fail") return "fail";
  if (r === "arrive") { p.bt += 0.25; }
};
TASKS.cool = function (p, t) {
  if (pixelTicks > t.until || p.bt < 37.6) return "done";
  const w = H2.findNear(p.x, p.y, 20, (o) => o.element === "water" || o.element === "pool_water");
  if (!w) return TASKS.wander(p, t);
  const r = goTo(p, w.x, w.y, 1, 4); if (r === "arrive") { p.bt -= 0.4; p.th = Math.min(100, p.th + 3); }
};
function drinkSource(p) {
  const wells = H2.st.well || [];
  const w = H2.nearestOf(wells, p.x, p.y, 120, (s) => !isBad(p, s.x, s.y) && (s.fac === undefined || s.fac === p.fac || !H2.war.on));
  if (w) return { x: w.x, y: w.y, well: true, px: w };
  const o = H2.findNear(p.x, p.y, 80, (q) => (q.element === "water" || q.element === "pool_water") && !isBad(p, q.x, q.y) && !isPerson(at(q.x, q.y - 1)));
  if (o) return { x: o.x, y: o.y, well: false, px: o };
  return null;
}
TASKS.drink = function (p, t) {
  if (!t.src || (t.src.px && t.src.px.del)) { t.src = drinkSource(p); if (!t.src) { t.nofind = (t.nofind || 0) + 1; if (t.nofind > 15) return "fail"; return TASKS.wander(p, t); } }
  t.tk = (t.tk || 0) + 1;
  if (t.tk % 350 === 0) { if (!t.src.well) markBad(p, t.src.x, t.src.y); t.src = null; if (t.tk > 1400) return "fail"; return; }   // never trudge forever
  const r = goTo(p, t.src.x, t.src.y, t.src.well ? 2 : 1, 3);
  if (r === "fail") { t.fl = (t.fl || 0) + 1; if (!t.src.well || t.fl > 2) markBad(p, t.src.x, t.src.y); t.src = null; return; }
  if (r === "arrive") {
    t.n = (t.n || 0) + 1;
    if (t.n % 3 === 0) { p.th = Math.min(100, p.th + 18); if (!t.src.well && rnd() < 0.15 && t.src.px && !t.src.px.del) deletePixel(t.src.px.x, t.src.px.y); }
    if (p.th >= 95) { p.flask = isChildPx(p) ? 1 : 2; return "done"; }   // refill the waterskin
  }
};
TASKS.goto_drink = function (p, t) { // run to water (e.g. when on fire)
  const r = goTo(p, t.tx, t.ty, 1, 4); if (r === "arrive") { if (p.burning) { p.burning = false; delete p.burnStart; } return "done"; } if (r === "fail" || !p.burning) return "done";
};
TASKS.eat = function (p, t) {
  if (!FOODS) buildFoodTable();
  if (p.hu > 90) return "done";
  // 1. carried food
  if (p.inv.food > 0) { p.inv.food--; p.hu = Math.min(100, p.hu + 40); return "done"; }
  // 2. food lying around
  if (!t.px || t.px.del) {
    t.px = H2.findNear(p.x, p.y, 7, (o) => FOODS[o.element] && !o.dead);
    if (t.px) { t.tx = t.px.x; t.ty = t.px.y; }
  }
  if (t.px && !t.px.del) {
    const r = goTo(p, t.px.x, t.px.y, 1, 3);
    if (r === "arrive") { p.hu = Math.min(100, p.hu + FOODS[t.px.element]); if (t.px.element === "meat" && rnd() < 0.3) infect(p, "flu"); deletePixel(t.px.x, t.px.y); t.px = null; if (p.hu > 70) return "done"; }
    if (r === "fail") t.px = null;
    return;
  }
  // 3. colony stores / market
  const c = colById(p.col);
  if (c && H2.buyFood) { const r = H2.buyFood(p, c, t); if (r) return r; }
  // 4. forage berries from plants? wander and look
  t.look = (t.look || 0) + 1; if (t.look > 400) return "fail";
  return TASKS.wander(p, t);
};
TASKS.sleep = function (p, t) {
  let bed = ownHome(p);
  if (!bed && !t.nobed) { const c = colById(p.col); if (c && H2.claimBed) bed = H2.claimBed(p, c); if (!bed) t.nobed = true; }
  if (bed) {
    const r = goTo(p, bed.x, bed.y - 1, 0, 2);
    if (r === "fail") { t.nobed = true; return; }
    if (r !== "arrive") return;
    // standing on the bed
    if (p.y !== bed.y - 1) return;
  } else {
    // no bed: sleep near the campfire if there is one, else right here
    const s = H2.nearestOf(H2.st.campfire || [], p.x, p.y, 40);
    if (s && !t.slept) { const r = goTo(p, s.x, accY(s), 3, 4); if (r !== "arrive" && r !== "fail") return; }
  }
  p.sleeping = true; p.task = null;
  if (!bed && !p.warnedBed) { p.warnedBed = true; addThought(p, "nobed", -8, DAY); }
};
TASKS.socialize = function (p, t) {
  if (pixelTicks > t.until || !isEvening() && !isNight()) return "done";
  const s = H2.nearestOf((H2.st.campfire || []).concat(H2.st.market || [], H2.st.hall || []), p.x, p.y, 80);
  if (!s) return TASKS.wander(p, t);
  const r = goTo(p, s.x, accY(s), 3, 4);
  if (r === "arrive") { if (!spaceOut(p) && H2.chat) H2.chat(p); }
};

/* ======================================================================
   PERSON ELEMENTS
   ====================================================================== */
const PANIC_FROM = ["fire","plasma","cold_fire","electric","tnt","dynamite","c4","grenade","gunpowder","acid","acid_gas","stench","blood","cancer","radiation","magma","lava","explosion","napalm"];
// reactions may be triggered on the head pixel: always act on the body (the "brain" that owns all state)
function brainOf(a) {
  if (!a || a.del) return null;
  if (a.element === "hz_head") { const b = at(a.x, a.y + 1); return b && b.element === "hz_body" && b.id !== undefined ? b : null; }
  return (a.element === "hz_body" || a.element === "hz_child") && a.id !== undefined ? a : null;
}
H2.brainOf = brainOf;
function personReactions() {
  const r = {};
  for (const k of PANIC_FROM) { const v = k === "blood" ? 1 : 5; r[k] = { func: function (a) { const b = brainOf(a); if (b && !b.dead) b.panic = Math.max(b.panic || 0, v); } }; }
  r.plague = { func: function (a) { const b = brainOf(a); if (b) infect(b, "plague"); }, chance: 0.2 };
  r.infection = { func: function (a) { const b = brainOf(a); if (b) infect(b, "flu"); }, chance: 0.1 };
  const calm = { func: function (a) { const b = brainOf(a); if (b) b.panic = 0; } };
  r.alcohol = Object.assign({ chance: 0.2 }, calm); r.anesthesia = calm; r.alcohol_gas = Object.assign({ chance: 0.2 }, calm);
  return r;
}
function personChange(p, newEl) {
  if (p.dead || p.quiet || p.id === undefined) return;
  if (newEl === "hz_body" || newEl === "hz_child" || newEl === "hz_head") return;
  const recent = p.lastHit && pixelTicks - p.lastHit.t < 60;
  die(p, recent ? p.lastHit.c : ((newEl === "cooked_meat" || newEl === "ash") ? "fire" : "destruction"), recent && p.lastHit.by ? H2.byId[p.lastHit.by] : null, true);
}
function hoverText(p) {
  if (p.id === undefined) return "";
  let s = "";
  if (H2.cfg.nameMode !== "off") s += nm(p) + " · ";
  if (p.dead) return s + "dead (" + (p.cause || "?") + ")";
  s += (isChildPx(p) ? "child" : p.job) + " · " + (FAC[p.fac] ? FAC[p.fac].name : "?");
  if (p.sleeping) s += " · asleep"; else if (p.task) s += " · " + p.task.k;
  return s;
}
H2.hoverText = hoverText;
const personBase = {
  category: "villagers", hidden: true, density: 1500, state: "solid", movable: true, conduct: 0.05, temp: 37,
  tempHigh: 150, stateHigh: "cooked_meat", tempLow: -30, stateLow: "frozen_meat", burn: 10, burnTime: 250, burnInto: "cooked_meat",
  breakInto: ["blood", "meat", "bone"], forceSaveColor: true, excludeRandom: true, pickElement: "hz_azure",
};
elements.hz_body = Object.assign({}, personBase, { color: FAC[0].cloth, reactions: personReactions(), tick: bodyTick, onDelete: onPersonDelete, onChange: personChange, hoverStat: hoverText });
elements.hz_child = Object.assign({}, personBase, { color: ["#6aa5f0", "#f08a8a"], density: 1200, reactions: personReactions(), tick: bodyTick, onDelete: onPersonDelete, onChange: personChange, hoverStat: hoverText });
elements.hz_head = Object.assign({}, personBase, { color: SKIN, density: 1080, tick: headTick, hoverStat: function (h) { const b = at(h.x, h.y + 1); return b && b.element === "hz_body" ? hoverText(b) : "head"; },
  reactions: Object.assign(personReactions(), { oxygen: { elem2: "carbon_dioxide", chance: 0.5 }, water: { elem2: "bubble", attr2: { clone: "water" }, chance: 0.001 } }) });

/* ---- spawners ------------------------------------------------------------ */
function placePersonHere(pixel, fac, job) {
  const x = pixel.x, y = pixel.y;
  const col = colonyFor(fac, x, y);
  if (inb(x, y - 1) && !pixelMap[x][y - 1]) {
    createPixel("hz_head", x, y - 1);
    const h = pixelMap[x][y - 1];
    changePixel(pixel, "hz_body", true);
    initPerson(pixel, fac, { col: col.id, job: job });
    if (h) { h.color = pixel.skin; h.fac = fac; }
    return pixel;
  }
  if (inb(x, y + 1) && !pixelMap[x][y + 1]) {
    createPixel("hz_body", x, y + 1);
    const b = pixelMap[x][y + 1];
    changePixel(pixel, "hz_head", true);
    if (b) { initPerson(b, fac, { col: col.id, job: job }); pixel.color = b.skin; pixel.fac = fac; }
    return b;
  }
  deletePixel(x, y);
  return null;
}
function spawnerFor(fac) {
  return {
    category: "villagers", color: FAC[fac].flag, excludeRandom: true, cooldown: defaultCooldown, desc: "Spawns a " + FAC[fac].name + " villager.",
    onPlace: function (pixel) { placePersonHere(pixel, fac, "laborer"); },
    behavior: behaviors.WALL, state: "solid", related: ["hz_body", "hz_head"], maxSize: 1,
  };
}
function partyFor(fac) {
  return {
    category: "villagers", color: [FAC[fac].flag, FAC[fac].dark], excludeRandom: true, cooldown: defaultCooldown, maxSize: 1, behavior: behaviors.WALL, state: "solid",
    desc: "A small band of " + FAC[fac].name + " settlers with starting supplies. They found a village.",
    onPlace: function (pixel) {
      const px = pixel.x, py = pixel.y; deletePixel(px, py);
      const jobs = ["builder", "woodcutter", "farmer", "miner", "soldier", "laborer"];
      let made = 0, col = null; const band = [];
      for (let i = 0; i < 6; i++) {
        const x = clamp(px + (i - 3) * 3 + rint(-1, 1), 1, width - 2);
        const gy = groundY(x, clamp(py - 8, 0, height - 3), 40);
        if (gy < 2) continue;
        const b = spawnPerson(x, gy, fac, { job: jobs[i], age: rint(CHILD_T + DAY * 3, DAY * 12), sex: i < 4 ? (i % 2 ? "f" : "m") : undefined });
        if (b) { made++; band.push(b); col = colById(b.col); if (b.job === "soldier") b.wpn = "spear"; if (b.job === "soldier") b.color = bodyColor(b); }
      }
      // two founding couples travel with the band
      for (let i = 0; i + 1 < band.length && i < 4; i += 2) {
        const m = band[i], w = band[i + 1]; if (m.sex === w.sex || m.sp || w.sp) continue;
        m.sp = w.id; w.sp = m.id; w.sn = m.sn; w.name = w.first + " " + w.sn; m.fr[w.id] = 70; w.fr[m.id] = 70;
        life(m, "Set out with their spouse " + w.first + ".", "marry"); life(w, "Set out with their spouse " + m.first + ".", "marry");
      }
      if (made && col) { chronicle(made + " " + FAC[fac].name + " settlers arrive and look for a place to build a home.", true, fac); col.stock.wood += 15; }
    },
  };
}
for (const F of FAC) {
  elements["hz_" + F.key] = spawnerFor(F.id);
  elements["hz_" + F.key + "_party"] = partyFor(F.id);
}
elements.hz_azure.name = "azure_villager"; elements.hz_crimson.name = "crimson_villager";
