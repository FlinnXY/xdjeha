/* ============================================================================
   HUMANITIZE 2 — "Villages, Factions & Stories"
   A complete rewrite and expansion of Humanitize.js (original idea & credit: nekonico)
   https://github.com/R74nCom/Sandboxels-Mods/blob/main/mods/Humanitize.js
   ----------------------------------------------------------------------------
   Load via the in-game Mod Manager with a jsDelivr URL, e.g.
   https://cdn.jsdelivr.net/gh/<you>/<repo>@main/Humanitize2.js
   ============================================================================ */
(function () {
"use strict";
if (window.H2 && window.H2.loaded) { console.warn("[Humanitize2] already loaded"); return; }

/* ------------------------------------------------------------------ CONFIG */
const H2 = window.H2 = {
  version: "2.0.0", loaded: true,
  cfg: { events: true, maxPeople: 90, verbose: false, birth: true, war: true, speed: 1 },
  people: [], byId: {}, st: {}, cols: [], colSeq: 1, idSeq: 1, doors: [], chron: [],
  sightings: [], projectiles: 0, stats: { births: 0, deaths: 0, battles: 0 },
};
const DAY = 2400;                 // ticks per in-game day
const CHILD_T = DAY * 1.5;        // child -> adult
const ELDER_T = DAY * 22;         // elder age
const LIFE_T = DAY * 32;          // natural life expectancy centre
const FAC = [
  { id: 0, key: "azure",   name: "Azure",   adj: "Azurian",  cloth: ["#2f6fd6", "#2a63c0", "#3a7be8"], dark: "#1d4a9c", flag: "#3b82f6" },
  { id: 1, key: "crimson", name: "Crimson", adj: "Crimsonite", cloth: ["#c93a3a", "#b53030", "#d84a4a"], dark: "#8f2222", flag: "#ef4444" },
];
H2.FAC = FAC;

/* ------------------------------------------------------------------ UTILS */
const rnd = Math.random;
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (a) => a[Math.floor(rnd() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
const inb = (x, y) => !outOfBounds(x, y) && x >= 0 && y >= 0;   // valid indices are 0..width and 0..height (border aware)
const at = (x, y) => (inb(x, y) ? pixelMap[x][y] : undefined);
const tk = () => pixelTicks;
const isEl = (p, name) => p && p.element === name;
const hasEl = (n) => !!elements[n];
H2.util = { rnd, rint, pick, clamp, dist, inb, at };

function dayFrac() { return (pixelTicks % DAY) / DAY; }           // 0..1
function isNight() { const f = dayFrac(); return f > 0.70 || f < 0.06; }
function isEvening() { const f = dayFrac(); return f > 0.55 && f <= 0.70; }
function dayNumber() { return Math.floor(pixelTicks / DAY) + 1; }
H2.isNight = isNight;

const NAMES_M = ["Aldric","Bram","Cedric","Doran","Edmund","Fenn","Garrick","Hale","Ivor","Jasper","Kell","Leofric","Merrick","Nolan","Osric","Perrin","Quill","Rowan","Silas","Tobias","Ulric","Varn","Wystan","Yorick","Alaric","Baldwin","Corwin","Darian","Emeric","Falk"];
const NAMES_F = ["Adela","Brienne","Cora","Dara","Edda","Freya","Gwen","Hilda","Isolde","Jora","Kira","Lena","Maren","Nessa","Orla","Petra","Quilla","Rhea","Sera","Tilda","Una","Vera","Wren","Ysolde","Alys","Brisa","Clio","Dahlia","Elowen","Fiora"];
const SURN = ["Ashford","Blackwood","Cross","Dunmere","Fairwind","Greywater","Hollis","Ironside","Kestrel","Longbow","Marsh","Northcott","Oakheart","Pike","Redfern","Stonebridge","Thatcher","Underhill","Vale","Whitlock"];
const TRAITS = {
  brave:   { b: +0.35, c: "brave" },      timid:   { b: -0.35, c: "timid" },
  kind:    { k: +0.4, c: "kind" },        cruel:   { k: -0.4, c: "cruel" },
  greedy:  { g: +0.4, c: "greedy" },      generous:{ g: -0.4, c: "generous" },
  lazy:    { d: -0.35, c: "lazy" },       diligent:{ d: +0.35, c: "diligent" },
  curious: { u: +0.4, c: "curious" },     loyal:   { l: +0.4, c: "loyal" },
  hotheaded:{ h: +0.4, c: "hot-headed" }, jolly:   { m: +0.3, c: "jolly" },
  gloomy:  { m: -0.3, c: "gloomy" },
};
const TRAIT_KEYS = Object.keys(TRAITS);
const OPPOSITE = { brave:"timid", timid:"brave", kind:"cruel", cruel:"kind", greedy:"generous", generous:"greedy", lazy:"diligent", diligent:"lazy", jolly:"gloomy", gloomy:"jolly" };
function rollTraits(parents) {
  const t = [];
  if (parents) for (const par of parents) for (const k of (par || [])) if (rnd() < 0.35 && !t.includes(k) && !t.includes(OPPOSITE[k])) t.push(k);
  let guard = 0;
  while (t.length < 2 && guard++ < 30) { const k = pick(TRAIT_KEYS); if (!t.includes(k) && !t.includes(OPPOSITE[k])) t.push(k); }
  return t.slice(0, 3);
}
function trait(p, stat) { let v = 0; if (p.tr) for (const k of p.tr) if (TRAITS[k] && TRAITS[k][stat]) v += TRAITS[k][stat]; return v; }
H2.trait = trait;

/* ------------------------------------------------------------- CHRONICLE */
// Every notable event is written to the chronicle (📜 panel) and the biggest ones go to the in-game log.
function chronicle(text, major, fac) {
  const e = { t: pixelTicks, day: dayNumber(), text, fac: fac === undefined ? -1 : fac, major: !!major };
  H2.chron.push(e);
  if (H2.chron.length > 300) H2.chron.shift();
  if (major) { try { logMessage("Day " + e.day + ": " + text); } catch (err) {} }
  try { H2.refreshChronicle && H2.refreshChronicle(); } catch (err) {}
}
H2.chronicle = chronicle;
const nm = (p) => p ? (p.title ? p.title + " " : "") + (p.name || "Someone") : "Someone";
H2.nm = nm;

/* ------------------------------------------------------------ TERRAIN */
const HAZ_TEMP_HI = 95, HAZ_TEMP_LO = -25;
// 0 = empty, 1 = fluid (can swim / swap), 2 = solid obstacle, 3 = door, 4 = hazard
function kindOf(o) {
  if (!o) return 0;
  const e = elements[o.element];
  if (!e) return 2;
  if (o.element === "hz_door" || o.element === "hz_gate") return 3;
  if (o.burning || o.temp > HAZ_TEMP_HI || o.temp < HAZ_TEMP_LO) return 4;
  if (e.hazard) return 4;
  if (e.state === "liquid" || e.state === "gas") return 1;
  return 2;
}
// soft vegetation (grass blades, flowers, dead plants) is trampled by walkers instead of blocking them
const SOFT = { grass: 1, dead_plant: 1, frozen_plant: 1, grass_seed: 1, flower_seed: 1, petal: 1, pistil: 1, moss: 1, lichen: 1, seeds: 1, straw: 1, hay: 1, dead_grass: 1, wildflower: 1, clover: 1 };
const isSoft = (o) => !!o && SOFT[o.element] === 1 && !o.burning;
H2.SOFT = SOFT;
function isPerson(o) { return !!o && (o.element === "hz_body" || o.element === "hz_child" || o.element === "hz_head"); }
function solidBelow(x, y) { if (!inb(x, y + 1)) return true; const o = pixelMap[x][y + 1]; if (!o) return false; return kindOf(o) >= 2; }
function groundY(x, y0, maxDown) { // first y >= y0 where (x,y) is a free cell with solid beneath
  y0 = y0 === undefined ? 0 : y0; maxDown = maxDown || height;
  for (let y = y0; y < Math.min(height - 1, y0 + maxDown); y++) {
    const o = pixelMap[x] && pixelMap[x][y];
    if (!o) { const b = pixelMap[x][y + 1]; if (b && kindOf(b) === 2 && !isPerson(b) && !b.hzb) return y; }
  }
  return -1;
}
function topSolid(x) { // y of the first solid (non-person, non-fluid) pixel from the top; -1 none
  if (x < 0 || x >= width) return -1;
  for (let y = 0; y < height; y++) { const o = pixelMap[x][y]; if (o && !isPerson(o) && kindOf(o) === 2) return y; }
  return -1;
}
H2.terrain = { kindOf, solidBelow, topSolid, groundY };

function nearestOf(list, x, y, maxD, filter) {
  let best = null, bd = maxD === undefined ? 1e9 : maxD;
  for (let i = 0; i < list.length; i++) {
    const s = list[i]; if (!s || s.del) continue;
    if (filter && !filter(s)) continue;
    const d = Math.abs(s.x - x) + Math.abs(s.y - y) * 0.6;
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
H2.nearestOf = nearestOf;

/* Find the nearest pixel of any of the elements in names within radius r (box scan). */
function findNear(x, y, r, test, step) {
  let best = null, bd = 1e9; step = step || 1;
  for (let dx = -r; dx <= r; dx += step) {
    const xx = x + dx; if (xx < 0 || xx > width) continue;
    for (let dy = -r; dy <= r; dy += step) {
      const yy = y + dy; if (yy < 0 || yy > height) continue;
      const o = pixelMap[xx][yy]; if (!o || o.del) continue;
      if (test(o)) { const d = Math.abs(dx) + Math.abs(dy); if (d < bd) { bd = d; best = o; } }
    }
  }
  return best;
}
H2.findNear = findNear;

/* ======================================================================
   ELEMENTS: building blocks, stations, projectiles, crops
   ====================================================================== */
const ifEl = (n, fb) => (elements[n] ? n : fb);
function def(name, o) {
  o.category = o.category || "village";
  if (o.state === undefined) o.state = "solid";
  if (o.excludeRandom === undefined) o.excludeRandom = true;
  if (o.behavior === undefined && !o.tick) o.behavior = behaviors.WALL;
  elements[name] = o;
  return o;
}
const BLOCK_NAMES = ["hz_plank","hz_stone","hz_roof","hz_door","hz_gate","hz_palisade","hz_cloth"];

def("hz_plank", { color: ["#a67b47","#9c7040","#b08650"], behavior: behaviors.WALL, density: 600, hardness: 0.25,
  burn: 25, burnTime: 250, burnInto: ["ash","ash","fire"], tempHigh: 450, stateHigh: "ash", breakInto: ifEl("sawdust","ash"), bhp: 14, hzb: true,
  desc: "Wooden planks laid by villagers." });
def("hz_stone", { color: ["#8a8d92","#7d8085","#94979c"], behavior: behaviors.WALL, density: 2400, hardness: 0.55,
  tempHigh: 1200, stateHigh: ifEl("magma","molten_slag"), breakInto: ifEl("gravel","rock"), bhp: 45, hzb: true });
def("hz_roof", { color: ["#a8452f","#9a3b28","#b1503a"], behavior: behaviors.WALL, density: 900, hardness: 0.2,
  burn: 12, burnTime: 220, burnInto: "ash", tempHigh: 500, stateHigh: "ash", breakInto: ifEl("brick_rubble", ifEl("clay_soil","dirt")), bhp: 10, hzb: true });
def("hz_cloth", { color: ["#d8cdb0","#cfc3a3","#e0d6bb"], behavior: behaviors.WALL, density: 200, hardness: 0.05,
  burn: 70, burnTime: 80, burnInto: "ash", tempHigh: 300, stateHigh: "ash", bhp: 4, hzb: true, forceSaveColor: true });
def("hz_door", { color: ["#6b4a2b","#5e4025"], behavior: behaviors.WALL, density: 500, hardness: 0.2,
  burn: 20, burnTime: 200, burnInto: "ash", breakInto: ifEl("sawdust","ash"), bhp: 12, hzb: true, door: true, forceSaveColor: true });
def("hz_gate", { color: ["#4a3a2a","#54402d"], behavior: behaviors.WALL, density: 1200, hardness: 0.45,
  burn: 8, burnTime: 300, burnInto: "ash", bhp: 28, hzb: true, door: true, forceSaveColor: true });
// packed earth: building foundations and levelled door approaches (does not crumble like dirt, grass cannot grow on it)
def("hz_earth", { color: ["#7a5a3a","#6f5234","#836141"], behavior: behaviors.WALL, density: 1600, hardness: 0.3, fdn: true, hidden: true,
  breakInto: "dirt", tempHigh: 1200, stateHigh: ifEl("magma","dirt"), desc: "Packed earth laid as a foundation by villagers." });
def("hz_palisade", { color: ["#8a6a3f","#7c5e37","#94744a"], behavior: behaviors.WALL, density: 650, hardness: 0.3,
  burn: 25, burnTime: 250, burnInto: "ash", breakInto: ifEl("sawdust","ash"), bhp: 20, hzb: true });

// ---- stations (function buildings). `st` is the station type used by the AI.
function station(name, stype, o) {
  o.st = stype; o.hzb = true; o.bhp = o.bhp || 20; o.forceSaveColor = true;
  if (!o.behavior && !o.tick) o.behavior = behaviors.WALL;
  return def(name, o);
}
station("hz_bed", "bed", { color: ["#e9dcc0","#d9c7a0"], density: 300, burn: 40, burnTime: 150, burnInto: "ash", hardness: 0.05, bhp: 6,
  hoverStat: (p) => p.owner ? "owner: " + p.owner : "free" });
station("hz_cot", "cot", { color: ["#ffffff","#f0f0f0"], density: 300, burn: 40, burnTime: 150, burnInto: "ash", hardness: 0.05, bhp: 6 });
station("hz_hearth", "hearth", { color: ["#e0661a","#ff9a2e","#c94d0e"], density: 1000, hardness: 0.3, temp: 55, bhp: 20,
  tick: (p) => { if (pixelTicks % 7 === 0) { p.temp = 55; p.color = pick(["#e0661a","#ff9a2e","#c94d0e","#ffb347"]); } doHeat(p); } });
station("hz_campfire", "campfire", { color: ["#ff8c1a","#ffb347","#e0661a"], density: 400, hardness: 0.1, temp: 60, bhp: 6,
  tick: (p) => { p.temp = 60; if (pixelTicks % 5 === 0) p.color = pick(["#ff8c1a","#ffb347","#e0661a","#ffd27a"]); doHeat(p);
    if (isEmpty(p.x, p.y - 1) && rnd() < 0.02) createPixel("smoke", p.x, p.y - 1); } });
station("hz_well", "well", { color: ["#4aa3df","#3b8fc7"], density: 1000, state: "solid", hardness: 0.4, bhp: 30, hazard: false,
  tick: (p) => { /* decorative shimmer */ if (pixelTicks % 11 === 0) p.color = pick(["#4aa3df","#3b8fc7","#5bb4ee"]); } });
station("hz_stall", "market", { color: ["#e8b84a","#d9a73a","#f0c85a"], density: 500, burn: 30, burnTime: 150, burnInto: "ash", hardness: 0.1, bhp: 8,
  hoverStat: (p) => "market" });
station("hz_banner", "hall", { color: "#3b82f6", density: 300, burn: 30, burnTime: 150, burnInto: "ash", hardness: 0.1, bhp: 10,
  hoverStat: (p) => (FAC[p.fac] ? FAC[p.fac].name + " banner" : "banner") });
station("hz_anvil", "forge", { color: ["#3f4247","#34373b"], density: 7800, hardness: 0.8, bhp: 60 });
station("hz_forgefire", "forgefire", { color: ["#ff6a00","#ffa31a","#ff3b00"], density: 800, hardness: 0.4, temp: 130, bhp: 25,
  tick: (p) => { p.temp = 130; if (pixelTicks % 4 === 0) p.color = pick(["#ff6a00","#ffa31a","#ff3b00","#ffd24a"]); doHeat(p);
    if (isEmpty(p.x, p.y - 1) && rnd() < 0.03) createPixel("smoke", p.x, p.y - 1); } });
station("hz_oven", "oven", { color: ["#9b5a3c","#8a4e33"], density: 1500, hardness: 0.4, temp: 80, bhp: 25,
  tick: (p) => { p.temp = 80; doHeat(p); } });
station("hz_rack", "rack", { color: ["#6b6f78","#5a5e66"], density: 1200, hardness: 0.3, bhp: 15 });
station("hz_dummy", "dummy", { color: ["#c9a96b","#b99a5e"], density: 400, burn: 25, burnTime: 150, burnInto: "ash", hardness: 0.1, bhp: 10 });
station("hz_post", "post", { color: ["#7a5a36","#6c4f30"], density: 500, burn: 25, burnTime: 150, burnInto: "ash", hardness: 0.2, bhp: 14 });
station("hz_medcross", "hospital", { color: ["#ffffff","#f4f4f4"], density: 500, hardness: 0.1, bhp: 8 });
station("hz_scarecrow", "scarecrow", { color: ["#d9b44a","#c9a53e"], density: 200, burn: 50, burnTime: 100, burnInto: "ash", hardness: 0.05, bhp: 4 });
station("hz_mill", "mill", { color: ["#d8cfb6","#c8bfa6"], density: 600, burn: 20, burnTime: 200, burnInto: "ash", hardness: 0.2, bhp: 16 });
station("hz_chest", "chest", { color: ["#8a5a2b","#7a4e24"], density: 700, burn: 15, burnTime: 220, burnInto: "ash", hardness: 0.2, bhp: 16 });

def("hz_gravestone", { color: ["#9a9ea5","#8c9097"], behavior: behaviors.WALL, density: 2300, hardness: 0.5, bhp: 40, hzb: true, st: "grave", forceSaveColor: true,
  hoverStat: (p) => p.epitaph || "Here lies someone." });

// ---- cannon: loaded/fired by the war module
def("hz_cannon", { color: ["#2e3135","#25282b"], behavior: behaviors.WALL, density: 7000, hardness: 0.8, bhp: 50, hzb: true, st: "cannon", forceSaveColor: true,
  hoverStat: (p) => (FAC[p.fac] ? FAC[p.fac].name + " cannon " : "cannon ") + (p.ammo > 0 ? "(loaded)" : "(empty)"),
  tick: (p) => { try { cannonTick(p); } catch (e) { if (H2.cfg.verbose) console.error(e); } } });

// ---- crops
def("hz_crop", { color: "#5cae3a", density: 300, hardness: 0.02, burn: 60, burnTime: 80, burnInto: "ash", bhp: 2, forceSaveColor: true,
  behavior: behaviors.WALL, properties: { g: 0 },
  hoverStat: (p) => p.g >= 1 ? "ripe" : Math.floor(p.g * 100) + "%",
  tick: (p) => {
    doBurning(p);
    const b = at(p.x, p.y + 1);
    if (!b || !(b.element === "dirt" || b.element === "soil" || b.element === "mud" || b.element === "farmland" || b.element === "grass")) {
      if (!b) { if (!tryMove(p, p.x, p.y + 1)) {} } else if (kindOf(b) !== 2) { /* floating on water: ruin */ if (rnd() < 0.05) deletePixel(p.x, p.y); }
      else if (rnd() < 0.01) deletePixel(p.x, p.y);
      return;
    }
    if (p.g < 1) {
      let rate = 0.0007;
      if (p.temp < 5) rate *= 0.2; else if (p.temp > 40) rate *= 0.4;
      const w = at(p.x - 1, p.y + 0), w2 = at(p.x + 1, p.y);
      if ((w && w.element === "water") || (w2 && w2.element === "water") || (b.moist > 20)) rate *= 2;
      p.g = Math.min(1, p.g + rate);
      if (pixelTicks % 20 === 0) p.color = p.g < 0.35 ? "#6dbb43" : p.g < 0.7 ? "#9bc13a" : p.g < 1 ? "#d3b83a" : "#e6bf3c";
    }
  } });

// ---- projectiles
def("hz_arrow", { color: "#6b5436", behavior: behaviors.WALL, density: 300, hardness: 0, bhp: 1, hidden: true, forceSaveColor: true,
  tick: (p) => { try { projectileTick(p, "arrow"); } catch (e) { deletePixel(p.x, p.y); } } });
def("hz_ball", { color: "#1f2124", behavior: behaviors.WALL, density: 7000, hardness: 0, bhp: 1, hidden: true, forceSaveColor: true,
  tick: (p) => { try { projectileTick(p, "ball"); } catch (e) { deletePixel(p.x, p.y); } } });

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
function doorOpenable(p, o) {
  if (!p) return false;
  if (o.element === "hz_gate") return o.fac === undefined || o.fac === p.fac;
  return o.fac === undefined || o.fac === p.fac || p.job === "merchant" || p.nomad === "trader" || H2.truce;
}
function put(px, x, y) { let o = pixelMap[x][y]; if (o && isSoft(o)) { deletePixel(x, y); o = null; } if (!o) movePixel(px, x, y); else swapPixels(px, o); }
function openDoor(o) {
  H2.doors.push({ x: o.x, y: o.y, el: o.element, fac: o.fac, color: o.color, hp: o.hp, ay: o.ay, t: pixelTicks + 14 });
  o.quiet = true;
  deletePixel(o.x, o.y);
}
function openDoorsFor(p, tx, ty) {
  const o = inb(tx, ty) ? pixelMap[tx][ty] : null;
  if (o && kindOf(o) === 3 && doorOpenable(p, o)) openDoor(o);
}
function shift(p, dx, dy, soft) {    // move the whole person (body + head) by dx,dy; returns success. soft: trample grass blades
  const ch = isChildPx(p);
  const h = ch ? null : headOf(p);
  if (!ch && !h) return false;
  const bx = p.x + dx, by = p.y + dy;
  const hx = bx, hy = by - 1;
  const ox = p.x, oy = p.y;
  const own = (x, y) => (x === ox && y === oy) || (!ch && x === ox && y === oy - 1);
  // two friendly people meeting in a corridor swap places instead of blocking each other
  if (dy === 0 && !ch) {
    const ob = inb(bx, by) ? pixelMap[bx][by] : null;
    if (ob && ob.element === "hz_body" && !ob.sleeping && (ob.dead || ob.fac === p.fac || ob.fac === undefined) && !(ob.wantDir === dx && pixelTicks - (ob.wantT || -99) < 14)) {
      const oh = at(bx, by - 1);
      if (oh && oh.element === "hz_head") { swapPixels(p, ob); swapPixels(h, oh); return true; }
    }
  }
  // check first, then open doors: never open a door we cannot pass anyway
  const pass = (x, y) => { if (own(x, y)) return true; if (canEnter(x, y, p, soft)) return true; return false; };
  if (!pass(bx, by)) return false;
  if (!ch && !pass(hx, hy)) return false;
  if (!ch) openDoorsFor(p, hx, hy);
  openDoorsFor(p, bx, by);
  if (ch) { put(p, bx, by); return true; }
  if (dy > 0) { put(p, bx, by); put(h, hx, hy); }
  else { put(h, hx, hy); put(p, bx, by); }
  return true;
}
H2.shift = shift;
function dropOk(x, y) { // is there something to stand on within 3 cells below (x,y)?
  for (let k = 1; k <= 4; k++) {
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
function goTo(p, tx, ty, range, vy) {
  range = range === undefined ? 1 : range; vy = vy === undefined ? 3 : vy;
  const dxT = tx - p.x;
  if (Math.abs(dxT) <= range && Math.abs(ty - p.y) <= vy) { p.stk = 0; p.detour = 0; return "arrive"; }
  let dir = Math.sign(dxT);
  if (p.detour > 0) { dir = p.dd; p.detour--; }
  else if (dir === 0) dir = p.dir || 1;
  p.wantDir = dir; p.wantT = pixelTicks;
  if (p.gx === p.x && p.gy === p.y) { p.gs = (p.gs || 0) + 1; if (p.gs > 22) { p.gs = 0; p.dd = rnd() < 0.5 ? -1 : 1; p.detour = rint(6, 14); p.fails = (p.fails || 0) + 1; } } else { p.gs = 0; p.gx = p.x; p.gy = p.y; }
  const moved = tryWalk(p, dir, false);
  if (moved) { p.stk = Math.max(0, (p.stk || 0) - 1); }
  else {
    p.stk = (p.stk || 0) + 1;
    if (p.stk > 1 && clearObstacle(p, dir)) { p.stk = 0; p.fails = 0; }
    else if (p.stk > 4) { p.dd = rnd() < 0.5 ? -dir : dir; if (p.detour > 0 && p.dd === dir) p.dd = -dir; p.detour = rint(5, 14); p.stk = 0; p.fails = (p.fails || 0) + 1; }
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
    killer.kills = (killer.kills || 0) + 1;
    if (killer.kills === 3 && !killer.title) { killer.title = "Sir"; chronicle(nm(killer) + " has slain three foes and is hailed a hero of the " + FAC[killer.fac].name + "!", true, killer.fac); }
    if (killer.kills === 8) { killer.title = "Legendary"; chronicle(nm(killer) + " — eight kills — is now a living legend!", true, killer.fac); }
    msg = who + " was slain by " + nm(killer) + ".";
    H2.stats.battles++;
    addThought(killer, "killed", -4, DAY);
    if (killer.fac !== p.fac) addThought(killer, "victory", 8, DAY);
  } else if (verb) msg = who + " " + verb + ".";
  else msg = who + " met a violent end (" + p.cause + ").";
  chronicle(msg, p.cause !== "old age" && (stageOf(p) !== "elder"), p.fac);
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
  if (p.sp) { const s = H2.byId[p.sp]; if (s && !s.dead) { s.sp = 0; addThought(s, "widowed", -35, DAY * 3); chronicle(nm(s) + " is heartbroken at the loss of " + p.first + ".", false, s.fac); } }
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
  if (kb === 0 || (kb === 1 && pixelTicks % 3 === 0 && !p.swim) || (kb === 3 && false)) {
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
  if (p.burning) { dmg += 3.5; cause = "fire"; p.panic = Math.max(p.panic, 6); }
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
    if (rnd() < 0.45) { p.wt = rint(3, 10); p.wd = 0; return; }
    const hm = homeTarget(p);
    p.wd = (Math.abs(p.x - hm.x) > 45 && rnd() < 0.8) ? Math.sign(hm.x - p.x) : (rnd() < 0.5 ? -1 : 1);
    p.wt = rint(6, 28);
  }
  p.wt--;
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
TASKS.rest = function (p, t) { if (pixelTicks > t.until) return "done"; };
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
  const r = goTo(p, t.src.x, t.src.y, 1, 3);
  if (r === "fail") { markBad(p, t.src.x, t.src.y); t.src = null; return; }
  if (r === "arrive") {
    t.n = (t.n || 0) + 1;
    if (t.n % 3 === 0) { p.th = Math.min(100, p.th + 18); if (!t.src.well && rnd() < 0.15 && t.src.px && !t.src.px.del) deletePixel(t.src.px.x, t.src.px.y); }
    if (p.th >= 95) return "done";
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
  if (r === "arrive" && H2.chat) H2.chat(p);
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
      let made = 0, col = null;
      for (let i = 0; i < 6; i++) {
        const x = clamp(px + (i - 3) * 3 + rint(-1, 1), 1, width - 2);
        const gy = groundY(x, clamp(py - 8, 0, height - 3), 40);
        if (gy < 2) continue;
        const b = spawnPerson(x, gy, fac, { job: jobs[i], age: rint(CHILD_T + DAY * 3, DAY * 12) });
        if (b) { made++; col = colById(b.col); if (b.job === "soldier") b.wpn = "spear"; if (b.job === "soldier") b.color = bodyColor(b); }
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
  for (const c of H2.cols) { c.pop = 0; c.kids = 0; c.adults = 0; c.sold = 0; c.jobs = {}; c.sick = 0; c.hungry = 0; c.moodSum = 0; }
  for (let i = 0; i < ppl.length; i++) {
    let c = colById(ppl[i].col);
    if (!c) { c = colonyFor(ppl[i].fac, ppl[i].x, ppl[i].y); ppl[i].col = c.id; }
    if (c.fac !== ppl[i].fac) { /* defector */ }
    c.pop++;
    if (isChildPx(ppl[i])) c.kids++; else { c.adults++; c.jobs[ppl[i].job] = (c.jobs[ppl[i].job] || 0) + 1; if (ppl[i].job === "soldier" || ppl[i].job === "sentry" || ppl[i].job === "scout") c.sold++; }
    if (ppl[i].sick) c.sick++; if (ppl[i].hu < 25) c.hungry++; c.moodSum += ppl[i].mo;
  }
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
      const halls = (st.hall || []).filter((s) => s.fac === c.fac && Math.abs(s.x - c.x) < 90);
      const hall = H2.nearestOf(halls, c.x, c.y, 200);
      c.hall = hall ? { x: hall.x, y: hall.ay !== undefined ? hall.ay : hall.y } : null;
      if (hall) { c.x = hall.x; c.y = hall.ay !== undefined ? hall.ay : hall.y; }
      else if (c.pop > 0) { let sx = 0, n = 0, sy = 0; for (const p of ppl) if (p.col === c.id) { sx += p.x; sy += p.y; n++; } if (n) { c.x = Math.round(c.x * 0.9 + (sx / n) * 0.1); c.y = Math.round(c.y * 0.9 + (sy / n) * 0.1); } }
      for (const b of (st.bed || [])) if (b.fac === c.fac && Math.abs(b.x - c.x) < 100) c.beds++;
    }
  }
}
H2.census = census;
// access point of a station (the ground cell next to it)
const accY = (s) => (s.ay !== undefined ? s.ay : s.y);
H2.accY = accY;
function stationsOf(type, c, maxD) {
  const l = H2.st[type]; if (!l) return [];
  return l.filter((s) => !s.del && (s.fac === undefined || s.fac === c.fac) && Math.abs(s.x - c.x) < (maxD || 110));
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
  W.builder = Math.max(1, Math.round(a * (c.plans.length ? 0.25 : 0.12)));
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
  if (j === "soldier" || j === "sentry") { if (!p.wpn) p.wpn = "spear"; p.color = bodyColor(p); }
  else if (old === "soldier" || old === "sentry") { p.color = bodyColor(p); }
  else if (j === "doctor" || old === "doctor") p.color = bodyColor(p);
  if (old === "laborer" && j !== "laborer" && H2.cfg.verbose) chronicle(nm(p) + " becomes a " + j + ".", false, p.fac);
}
H2.setJob = setJob;

/* ---- colony think loop ---------------------------------------------------- */
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
  if (H2.warThinkColony && H2.cfg.war) H2.warThinkColony(c);
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
  if (!t.base || t.base.del || !isTreePart(t.base)) {
    const tp = (q) => { if (!isTreePart(q)) return false; const b = treeBase(q); return !!b && !isBad(p, b.x, b.y); };
    const o = H2.findNear(p.x, p.y, 38, tp) || H2.findNear(p.x, p.y, 90, tp, 2);
    t.base = o ? treeBase(o) : null; t.n = 0;
    if (!t.base) { t.none = (t.none || 0) + 1; if (t.none > 8) { H2.noTrees = pixelTicks; return "fail"; } return TASKS.wander(p, t); }
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
      if (n.element === "wood" || n.element === "tree_branch" || (n.element === "plant" && (o.element !== "plant" || cnt < 100))) { seen[key] = true; q.push(n); }
    }
  }
  const bx = base.x, by = base.y;
  for (const o of q) if (o && !o.del) { if (o.element === "plant" && rnd() < 0.15) { /* leave a few leaves */ continue; } deletePixel(o.x, o.y); }
  const yield_ = clamp(Math.ceil(wood / 2) + 1, 2, 9);
  p.inv.wood = (p.inv.wood || 0) + yield_;
  p.sk.wood++;
  // replant only now and then, and never right inside the village (saplings grow into huge trees in Sandboxels)
  const pc = colById(p.col);
  if (inb(bx, by) && !pixelMap[bx][by] && elements.sapling && pc && Math.abs(bx - pc.x) > 28 && rnd() < 0.2 && (H2.cfg.replant !== false)) createPixel("sapling", bx, by);
}

/* ---- mining -------------------------------------------------------------- */
TASKS.mine = function (p, t) {
  if (carrying(p) >= CARRY_MAX) return "done";
  const c = colById(p.col);
  if (!t.rock || t.rock.del || (t.rock.element !== "rock" && t.rock.element !== "gravel")) {
    const o = H2.findNear(p.x, p.y, 30, (q) => (q.element === "rock") && !isBad(p, q.x, q.y) && (!isFree(q.x - 1, q.y) ? !isFree(q.x + 1, q.y) ? !isFree(q.x, q.y - 1) ? false : true : true : true));
    t.rock = o; t.n = 0;
    if (!t.rock) { t.none = (t.none || 0) + 1; if (t.none > 8) { H2.noRocks = pixelTicks; return "fail"; } return TASKS.wander(p, t); }
  }
  // stand beside the rock on its open side
  const side = isFree(t.rock.x - 1, t.rock.y) ? -1 : isFree(t.rock.x + 1, t.rock.y) ? 1 : 0;
  const tx = side ? t.rock.x + side : t.rock.x, ty = t.rock.y;
  const r = goTo(p, tx, ty, 0, 1);
  if (r === "fail") { markBad(p, t.rock.x, t.rock.y, 3000); t.rock = null; return; }
  if (r === "arrive") {
    t.n++;
    if (t.n >= 9 - Math.min(4, Math.floor(p.sk.mine / 8))) {
      const rx = t.rock.x, ry = t.rock.y;
      deletePixel(rx, ry);
      p.inv.stone = (p.inv.stone || 0) + 1; p.sk.mine++;
      const deep = clamp((ry - (c ? c.y : ry)) / 10, 0, 1);
      if (rnd() < 0.07 + deep * 0.1) { p.inv.iron = (p.inv.iron || 0) + 1; }
      if (rnd() < 0.025) { p.inv.powder = (p.inv.powder || 0) + 1; }
      t.rock = null;
    }
  }
};
function isFree(x, y) { return inb(x, y) && !pixelMap[x][y]; }

/* ---- farming -------------------------------------------------------------- */
const SOIL = { dirt: 1, grass: 1, soil: 1, mud: 1, farmland: 1 };
function farmSpot(p, c) {
  for (let tries = 0; tries < 12; tries++) {
    const x = clamp(c.x + rint(-32, 32), 2, width - 3);
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
  const beds = (H2.st.bed || []).filter((b) => !b.del && b.fac === p.fac && Math.abs(b.x - c.x) < 110 && (!b.owner || !H2.byId[b.owner] || H2.byId[b.owner].dead));
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
}
H2.marry = marry;

/* ======================================================================
   CONSTRUCTION: blueprints, site finding, planning, building
   ====================================================================== */
const COST = {
  hz_plank: { wood: 1 }, hz_roof: { wood: 1 }, hz_door: { wood: 1 }, hz_gate: { wood: 2, iron: 1 }, hz_palisade: { wood: 1 }, hz_cloth: { wood: 1 },
  hz_stone: { stone: 1 }, hz_bed: { wood: 2 }, hz_cot: { wood: 2 }, hz_hearth: { stone: 2 }, hz_campfire: { wood: 2 }, hz_stall: { wood: 1 },
  hz_banner: { wood: 1 }, hz_anvil: { iron: 3 }, hz_forgefire: { stone: 2 }, hz_oven: { stone: 3 }, hz_rack: { wood: 2, iron: 1 }, hz_dummy: { wood: 2 },
  hz_post: { wood: 1 }, hz_medcross: { wood: 1 }, hz_scarecrow: { wood: 1 }, hz_mill: { wood: 3 }, hz_chest: { wood: 2 }, hz_cannon: { cannon: 1 }, hz_well: {},
  glass: {}, dirt: {}, water: {}, hz_earth: {},
};
const GROUNDISH = { hz_earth: 1, dirt: 1, grass: 1, soil: 1, mud: 1, sand: 1, rock: 1, gravel: 1, clay: 1, clay_soil: 1, snow: 1, packed_snow: 1, permafrost: 1, sandstone: 1, limestone: 1, basalt: 1, granite: 1, packed_sand: 1, farmland: 1 };
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
  for (let y = 0; y < height - 1; y++) {
    const o = pixelMap[x][y]; if (!o || isPerson(o)) continue;
    if (isSoft(o) && (o.element !== "grass" || o.h > 0 || isSoft(pixelMap[x][y + 1]))) continue;  // grass blades / flowers are not ground
    if (elements[o.element] && elements[o.element].state === "gas") continue;
    return groundish(o) ? y - 1 : -1;
  }
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
    return { x0: x0, y0: mn, gys: gys, ag: [columnGround(x0 - 1), columnGround(x0 + w)] };
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
  // foundation for uneven ground (packed earth, so it neither crumbles nor grows grass inside the house)
  if (site.gys && !bp.dug) {
    const floor = bp.w >= 3;
    for (let i = 0; i < bp.w; i++) for (let y = site.y0 + 1; y <= Math.max(site.gys[i], floor ? site.y0 + 1 : site.y0); y++) cells.push([i, y - site.y0, "hz_earth"]);
    // level the ground right outside both ends so people can walk straight in and out of the doors
    if (floor && site.ag && !opt.nomargin) {
      [[-1, site.ag[0]], [bp.w, site.ag[1]]].forEach(([ax, g]) => {
        if (g < 1 || g - site.y0 > 4 || site.y0 - g > 6) return;
        for (let y = g + 1; y <= site.y0; y++) cells.push([ax, y - site.y0, "__dig"]);
        for (let y = site.y0 + 1; y <= Math.max(site.y0 + 1, g); y++) cells.push([ax, y - site.y0, "hz_earth"]);
      });
      // clear the head room above the approach as well (plants, loose earth)
      for (const ax of [-1, bp.w]) for (let dy = -2; dy <= 0; dy++) cells.push([ax, dy, "__dig"]);
    }
  }
  for (const cell of bp.cells) cells.push(cell.slice());
  if (opt.mirror) for (const cell of cells) { cell[0] = bp.w - 1 - cell[0]; }
  cells.sort((a, b) => (a[3] && a[3].late ? 1 : 0) - (b[3] && b[3].late ? 1 : 0) || (a[2] === "water" ? 1 : 0) - (b[2] === "water" ? 1 : 0) || (b[2] === "__dig" ? 1 : 0) - (a[2] === "__dig" ? 1 : 0) || b[1] - a[1] || a[0] - b[0]);
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
    if (isPerson(o)) {
      // somebody is standing where a block goes: lift them on top of it (foundations) or wait for them to move on
      const b = o.element === "hz_head" ? at(o.x, o.y + 1) : o;
      if (el === "hz_earth" && b && b.id !== undefined && !b.dead) { shift(b, 0, -1) || shift(b, 0, -1, true); if (isPerson(pixelMap[cx][cy])) shift(b, 0, -1); }
      if (isPerson(pixelMap[cx][cy])) { t.wait = (t.wait || 0) + 1; if (t.wait > 60) { pl.i++; t.wait = 0; } return; }
    }
  }
  const o2 = pixelMap[cx][cy];
  if (o2) {
    const oi = elements[o2.element];
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
function launch(kind, x, y, tx, ty, fac, owner, power) {
  if (!inb(x, y) || pixelMap[x][y]) return false;
  const el = kind === "ball" ? "hz_ball" : "hz_arrow";
  const speed = kind === "ball" ? 1.7 : 1.5, g = kind === "ball" ? 0.04 : 0.035;
  const dx = tx - x, dy = ty - y; const t = Math.max(4, Math.abs(dx) / speed);
  createPixel(el, x, y); const pr = pixelMap[x][y]; if (!pr || pr.element !== el) return false;
  pr.fx = x; pr.fy = y; pr.vx = (dx >= 0 ? 1 : -1) * Math.min(speed, Math.abs(dx) / t * 1); pr.vx = dx / t; pr.vy = (dy - 0.5 * g * t * t) / t; pr.g = g;
  pr.fac = fac; pr.owner = owner; pr.dmg = power; pr.life = 160; pr.born = pixelTicks;
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
        if (isPerson(o)) { const tgt = o.element === "hz_head" ? at(o.x, o.y + 1) : o; if (tgt && tgt.fac !== p.fac && tgt.hp !== undefined && !tgt.dead) { hurt(tgt, p.dmg * (1 - 0.22 * (tgt.arm || 0)) * (o.element === "hz_head" ? 1.6 : 1), "arrow", H2.byId[p.owner]); deletePixel(p.x, p.y); return; } else continue; }
        const e = elements[o.element];
        if (e && e.hzb && o.fac !== undefined && o.fac !== p.fac) damageBlock(o, 1);
        if (kindOf(o) === 2) { deletePixel(p.x, p.y); return; }
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
        addThought(p, "diplomat", 15, DAY * 2);
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
          else launch("arrow", p.x, p.y - 2, q.x, q.y - 1, p.fac, p.id, w.dmg * (1 + p.sk.fight * 0.01));
        } else launch("arrow", p.x, p.y - 2, q.x, q.y - 1, p.fac, p.id, w.dmg * (1 + p.sk.fight * 0.01));
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
    if (best) { p.cool = pixelTicks + 34; launch("arrow", po.x, po.y - 1, best.x, best.y - 1, p.fac, p.id, 6 * (1 + p.sk.fight * 0.01)); p.sk.fight += 0.04; }
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

/* ======================================================================
   REGISTRATION & MAIN LOOP
   ====================================================================== */
function doorsTick() {
  const d = H2.doors; if (!d.length) return;
  for (let i = d.length - 1; i >= 0; i--) {
    const r = d[i];
    if (pixelTicks < r.t) continue;
    if (!inb(r.x, r.y)) { d.splice(i, 1); continue; }
    if (!pixelMap[r.x][r.y]) { createPixel(r.el, r.x, r.y); const n = pixelMap[r.x][r.y]; if (n) { n.fac = r.fac; n.hzb2 = 1; if (r.ay !== undefined) n.ay = r.ay; if (r.color) n.color = r.color; if (r.hp !== undefined) n.hp = r.hp; } d.splice(i, 1); }
    else { r.t = pixelTicks + 8; r.w = (r.w || 0) + 1; if (r.w > 60) d.splice(i, 1); }
  }
}
runEveryTick(function () {
  try {
    if (pixelTicks % 5 === 0) census(pixelTicks % 30 === 0);
    doorsTick();
    runColonies();
    if (pixelTicks % 90 === 45) worldWarCheck();
    if (H2.everyTick) H2.everyTick();
  } catch (e) { if (H2.cfg.verbose) console.error("[Humanitize2]", e); H2.lastError = e; }
});
runAfterReset(function () {
  H2.cols = []; H2.people = []; H2.byId = {}; H2.st = {}; H2.doors = []; H2.corpses = []; H2.crops = []; H2.idSeq = 1; H2.colSeq = 1; H2.chron = [];
  H2.stats = { births: 0, deaths: 0, battles: 0 };
  try { H2.refreshChronicle && H2.refreshChronicle(); } catch (e) {}
});
runAfterLoad(function () { buildFoodTable(); });
console.log("[Humanitize2] v" + H2.version + " loaded");
})();
