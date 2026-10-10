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
  cfg: { events: true, maxPeople: 1000, maxPerFaction: 500, townSize: 60, expand: true, verbose: false, birth: true, war: true, speed: 1 },
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
// life history: every person keeps a short list of the notable moments of their life (shown in the inspector card)
const LIFE_MAX = 40;
function life(p, text, k) {
  if (!p || p.id === undefined) return;
  const l = p.life || (p.life = []);
  const e = { t: pixelTicks, day: dayNumber(), text: text, k: k || "" };
  if (l.length >= LIFE_MAX) { const i = l.findIndex((q, j) => j > 0 && !q.big); l.splice(i > 0 ? i : 1, 1); }
  if (k === "birth" || k === "elected" || k === "hero" || k === "death" || k === "found") e.big = 1;
  l.push(e);
}
H2.life = life;
const nm = (p) => p ? (p.title ? p.title + " " : "") + (p.name || "Someone") : "Someone";
H2.nm = nm;

/* ------------------------------------------------------------ TERRAIN */
const HAZ_TEMP_HI = 95, HAZ_TEMP_LO = -25;
// 0 = empty, 1 = fluid (can swim / swap), 2 = solid obstacle, 3 = door, 4 = hazard
function kindOf(o) {
  if (!o) return 0;
  const e = elements[o.element];
  if (!e) return 2;
  if (e.door || e.pass) return 3;
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
    const xx = x + dx; if (xx < 0 || xx >= width) continue;
    for (let dy = -r; dy <= r; dy += step) {
      const yy = y + dy; if (yy < 0 || yy >= height) continue;
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
station("hz_forgefire", "forgefire", { color: ["#ff6a00","#ffa31a","#ff3b00"], density: 800, hardness: 0.4, temp: 90, bhp: 25,
  tick: (p) => { p.temp = 90; if (pixelTicks % 4 === 0) p.color = pick(["#ff6a00","#ffa31a","#ff3b00","#ffd24a"]); doHeat(p);
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

// ---- architecture & decoration (colours are set per pixel from the faction's building style)
def("hz_plaster", { color: ["#efe8d6","#e9e1cc"], behavior: behaviors.WALL, density: 1800, hardness: 0.35, bhp: 22, hzb: true, forceSaveColor: true,
  breakInto: ifEl("dust", "dirt"), tempHigh: 1300, stateHigh: ifEl("magma", "ash"), desc: "Plastered wall of a village building." });
def("hz_beam", { color: ["#4a3122","#553826"], behavior: behaviors.WALL, density: 700, hardness: 0.3, bhp: 16, hzb: true, forceSaveColor: true,
  burn: 18, burnTime: 260, burnInto: ["ash","ash","fire"], tempHigh: 450, stateHigh: "ash", breakInto: ifEl("sawdust","ash"), desc: "Timber framing." });
def("hz_window", { color: ["#cfe8f7","#bcdcf0"], behavior: behaviors.WALL, density: 2500, hardness: 0.1, bhp: 3, hzb: true, forceSaveColor: true,
  breakInto: ifEl("glass_shard", "glass"), tempHigh: 1500, stateHigh: ifEl("molten_glass", "glass"), desc: "A window. Lights up warmly at night.",
  tick: (p) => windowTick(p) });
def("hz_shutter", { color: ["#2f5fa8","#2e6b52"], behavior: behaviors.WALL, density: 600, hardness: 0.2, bhp: 8, hzb: true, forceSaveColor: true,
  burn: 25, burnTime: 150, burnInto: "ash", tempHigh: 400, stateHigh: "ash" });
def("hz_flowerbox", { color: ["#e0457b","#f4d03f","#3f8f2a"], behavior: behaviors.WALL, density: 500, hardness: 0.1, bhp: 4, hzb: true, forceSaveColor: true,
  burn: 40, burnTime: 80, burnInto: "ash", tempHigh: 300, stateHigh: "ash", desc: "Window box full of flowers." });
def("hz_chimney", { color: ["#7d6a5c","#8a7566"], behavior: behaviors.WALL, density: 2200, hardness: 0.5, bhp: 30, hzb: true, forceSaveColor: true,
  breakInto: ifEl("brick_rubble", "gravel"), tempHigh: 1400, stateHigh: ifEl("magma", "ash"),
  tick: (p) => { if ((pixelTicks + p.x) % 13 !== 0 || !elements.smoke) return; const cold = p.temp < 15 || isNight(); if (rnd() < (cold ? 0.22 : 0.06) && isEmpty(p.x, p.y - 1)) createPixel("smoke", p.x, p.y - 1); } });
def("hz_lantern", { color: ["#ffd36b","#ffb84a"], behavior: behaviors.WALL, density: 1500, hardness: 0.2, bhp: 4, hzb: true, forceSaveColor: true,
  breakInto: ifEl("glass_shard", "glass"), desc: "A lantern that is lit at dusk.", tick: (p) => lanternTick(p) });
def("hz_gold", { color: ["#e2b33c","#d4a12a","#f0c75a"], behavior: behaviors.WALL, density: 3000, hardness: 0.4, bhp: 20, hzb: true, forceSaveColor: true, desc: "Gilded ornament." });
def("hz_statue", { color: ["#d9d6cf","#cfcbc2"], behavior: behaviors.WALL, density: 2600, hardness: 0.6, bhp: 40, hzb: true, forceSaveColor: true,
  breakInto: ifEl("gravel", "rock"), hoverStat: (p) => p.nm ? "statue of " + p.nm : "statue" });
def("hz_spray", { color: ["#a8dcff","#d6f0ff","#7cc4f5"], behavior: behaviors.WALL, density: 1000, hardness: 0, bhp: 2, hzb: true, pass: true, forceSaveColor: true,
  desc: "Fountain spray.", tick: (p) => { if ((pixelTicks + p.y) % 6 === 0) p.color = pick(["rgb(168,220,255)","rgb(214,240,255)","rgb(124,196,245)","rgb(240,250,255)"]); } });
// walk-through pieces: people pass through them like an open archway (they swing aside for a moment, like doors)
def("hz_stair", { color: ["#8a6440","#7e5a38"], behavior: behaviors.WALL, density: 600, hardness: 0.25, bhp: 14, hzb: true, pass: true, stair: true, forceSaveColor: true,
  burn: 20, burnTime: 220, burnInto: "ash", tempHigh: 450, stateHigh: "ash", desc: "Staircase to an upper floor." });
def("hz_ladder", { color: ["#8b6a3e","#7a5c34","#9a7848"], behavior: behaviors.WALL, density: 600, hardness: 0.2, bhp: 10, hzb: true, pass: true, ladder: true, forceSaveColor: true,
  burn: 25, burnTime: 200, burnInto: "ash", tempHigh: 450, stateHigh: "ash", desc: "Ladder: villagers climb up and down it (miners put them in quarries)." });
def("hz_lamppost", { color: ["#2b2b30","#33333a"], behavior: behaviors.WALL, density: 3000, hardness: 0.5, bhp: 16, hzb: true, pass: true, forceSaveColor: true, desc: "Street lamp post." });
def("hz_flower", { color: ["#e0457b","#f4d03f","#ffffff","#b05cc8"], behavior: behaviors.WALL, density: 200, hardness: 0.01, bhp: 1, hzb: true, pass: true, forceSaveColor: true,
  burn: 60, burnTime: 40, burnInto: "ash", tempHigh: 200, stateHigh: "ash", desc: "Garden flowers planted by villagers." });
// the back wall of a room seen in cut-away: people walk in front of it (it makes way for them like a curtain)
def("hz_interior", { color: ["#cfc6b2","#c6bca6"], behavior: behaviors.WALL, density: 1500, hardness: 0.3, bhp: 14, hzb: true, pass: true, forceSaveColor: true,
  breakInto: ifEl("dust", "dirt"), tempHigh: 1300, stateHigh: ifEl("magma", "ash"), desc: "Back wall of a room (people walk in front of it)." });
def("hz_backwin", { color: ["#bcd6e6","#aecbdc"], behavior: behaviors.WALL, density: 2500, hardness: 0.1, bhp: 3, hzb: true, pass: true, forceSaveColor: true,
  breakInto: ifEl("glass_shard", "glass"), tempHigh: 1500, stateHigh: ifEl("molten_glass", "glass"), desc: "A window in the back wall. Lights up at night.",
  tick: (p) => windowTick(p) });
def("hz_plinth", { color: ["#bdb7aa","#b0aa9d"], behavior: behaviors.WALL, density: 2400, hardness: 0.55, bhp: 30, hzb: true, pass: true, forceSaveColor: true,
  breakInto: ifEl("gravel", "rock"), desc: "Archway / plinth that people can walk under." });
const WARM_IN = ["rgb(224,160,74)","rgb(210,146,66)","rgb(236,176,92)"];
const WARM = ["rgb(255,214,120)","rgb(255,200,96)","rgb(255,226,150)"];
function nightId() { const f = dayFrac(); return Math.floor(pixelTicks / DAY) + (f < 0.06 ? 0 : 1); }
function windowTick(p) {
  if ((pixelTicks + p.x * 7 + p.y * 3) % 24 !== 0) return;
  if (p.dc === undefined) p.dc = p.color;
  if (isNight() || isEvening() && dayFrac() > 0.66) {
    const n = nightId();
    if (p.ln !== n) { p.ln = n; p.on = rnd() < 0.7; }
    if (p.on && dayFrac() > 0.92 && rnd() < 0.08) p.on = false;          // late night: lights go out one by one
    p.color = p.on ? (p.element === "hz_backwin" ? pick(WARM_IN) : pick(WARM)) : "rgb(42,53,80)";
  } else if (p.color !== p.dc) p.color = p.dc;
}
function lanternTick(p) {
  if ((pixelTicks + p.x) % 8 !== 0) return;
  if (p.dc === undefined) p.dc = "rgb(110,96,70)";
  const lit = isNight() || isEvening() || p.temp > 400;
  p.color = lit ? pick(["rgb(255,211,107)","rgb(255,184,74)","rgb(255,226,140)"]) : p.dc;
  if (lit) p.glow = true; else delete p.glow;
}

// ---- forestry: villagers plant saplings that grow into modest trees made of ordinary wood + leaves
const TREE_SOIL = { dirt: 1, grass: 1, soil: 1, mud: 1, clay_soil: 1, mycelium: 1 };
def("hz_sapling", { color: ["#3f8f2a","#4a9e33"], behavior: behaviors.WALL, density: 300, hardness: 0.02, burn: 60, burnTime: 60, burnInto: "ash", bhp: 2,
  forceSaveColor: true, properties: { g: 0 }, desc: "A young tree planted by a woodcutter. Grows into a small tree.",
  hoverStat: (p) => "growing " + Math.floor((p.g || 0) * 100) + "%",
  tick: (p) => {
    doBurning(p); if (p.del) return;
    const b = at(p.x, p.y + 1);
    if (!b) { tryMove(p, p.x, p.y + 1); return; }
    if (!TREE_SOIL[b.element]) { if (rnd() < 0.002) deletePixel(p.x, p.y); return; }
    if (pixelTicks % 10 !== 0) return;
    p.g = (p.g || 0) + (p.temp < 3 || p.temp > 45 ? 0.001 : 0.006);
    if (p.g < 1) return;
    growTree(p);
  } });
function growTree(p) {
  const x = p.x, y = p.y, H = 4 + (x * 7 + y) % 3;
  for (let k = 0; k <= H + 2; k++) if (!inb(x, y - k) || (k > 0 && pixelMap[x][y - k])) { p.g = 0.9; return false; }   // no room yet
  changePixel(p, "wood", false);
  for (let k = 1; k <= H; k++) createPixel("wood", x, y - k);
  const top = y - H;
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 0; dy++) {
    if (Math.abs(dx) + Math.abs(dy) > 2 || (!dx && !dy)) continue;
    const xx = x + dx, yy = top + dy; if (inb(xx, yy) && !pixelMap[xx][yy]) createPixel("plant", xx, yy);
  }
  if (inb(x, top - 1) && !pixelMap[x][top - 1]) createPixel("plant", x, top - 1);
  return true;
}

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
// safety net: somebody sealed into a pocket (a collapsed tunnel, a cavity under a foundation) climbs out to the
// nearest open ground instead of starving there. Only used when the reachable area has no way to the open sky.
function trapped(p) {
  const ch = isChildPx(p);
  const x0 = Math.max(1, p.x - 24), x1 = Math.min(width - 1, p.x + 24), Hh = height + 1;
  const stand = (x, y) => x >= x0 && x <= x1 && y >= 1 && y < height && pfPass(x, y, p) && (ch || pfPass(x, y - 1, p)) && pfSupport(x, y);
  const seen = new Uint8Array((x1 - x0 + 1) * Hh), q = [[p.x, p.y]]; seen[(p.x - x0) * Hh + p.y] = 1;
  let n = 0;
  const sky = (x, y) => { for (let yy = y - (ch ? 1 : 2); yy >= 0; yy--) if (!pfPass(x, yy, p)) return false; return true; };
  while (q.length && n++ < 1500) {
    const [cx, cy] = q.shift();
    if (sky(cx, cy) || isLadder(cx, cy) || isLadder(cx, cy + 1)) return false;
    for (const dx of [-1, 1]) for (const dy of [0, -1, -2, 1, 2, 3, 4]) {
      const nx = cx + dx, ny = cy + dy; if (nx < x0 || nx > x1 || ny < 1 || ny >= height) continue;
      if (dy < 0 && !pfPass(cx, cy - (ch ? 1 : 2) + dy + 1, p)) continue;
      if (dy > 0 && !pfPass(nx, cy, p)) continue;
      const k = (nx - x0) * Hh + ny; if (seen[k] || !stand(nx, ny)) continue; seen[k] = 1; q.push([nx, ny]);
    }
  }
  return n < 1500;
}
function rescue(p) {
  const ch = isChildPx(p), h = ch ? null : headOf(p);
  for (let d = 1; d <= 30; d++) for (const sg of [1, -1]) {
    const x = p.x + sg * d; if (x < 2 || x > width - 3) continue;
    const g = columnGround(x); if (g < 2 || g < p.y - 40) continue;
    if (!isEmpty(x, g) || (!ch && !isEmpty(x, g - 1))) continue;
    movePixel(p, x, g); if (h) movePixel(h, x, g - 1);
    p.path = null; p.stk = 0; p.fails = 0; p.task = null;
    return true;
  }
  return false;
}
H2.trapped = trapped; H2.rescue = rescue;
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
const DISEASE = { cold: { dur: 5000, dmg: 0.02, spread: 0.05 }, flu: { dur: 8000, dmg: 0.12, spread: 0.06 }, plague: { dur: 9000, dmg: 0.1, spread: 0.05 } };

function die(p, cause, killer, gone) {
  if (!p || p.dead === undefined) return;
  if (p.dead) return;
  const ch = isChildPx(p);
  if (p.sick && p.sick.k === "plague") { const pc = colById(p.col); if (pc) pc.plagueDead = (pc.plagueDead || 0) + 1; }
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
  // --- trapped? (checked only when somebody has not moved for a long while)
  if (Math.abs(p.x - (p.anX || 0)) > 3 || Math.abs(p.y - (p.anY || 0)) > 3) { p.anX = p.x; p.anY = p.y; p.anT = pixelTicks; }
  else if (!sleeping && pixelTicks - p.anT > 900 && !p.jail) { p.anT = pixelTicks; if (trapped(p)) rescue(p); }
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
    let sev = p.treated ? 0.2 : 1;
    if (p.sick.k === "plague") { const pc = colById(p.col); if (pc && (pc.plagueDead || 0) >= Math.max(1, Math.floor((pc.pop || 0) * 0.2))) sev *= 0.15; }   // the worst is over: survivors pull through
    dmg += D.dmg * sev; if (D.dmg >= 0.1) cause = cause || "disease";
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
  if (p.th < 35) { if (setTask(p, "drink", { work: false }, p.th < 15 ? 72 : p.th < 25 ? 66 : 55)) return; }
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
  // a lake or stream nearby beats a long walk to a well (a well only wins when it is not much further away)
  const wd = w ? Math.abs(w.x - p.x) + Math.abs(w.y - p.y) : 1e9;
  const o = wd > 20 ? H2.findNear(p.x, p.y, Math.min(80, wd - 15), (q) => (q.element === "water" || q.element === "pool_water") && !isBad(p, q.x, q.y) && !isPerson(at(q.x, q.y - 1))) : null;
  if (o) return { x: o.x, y: o.y, well: false, px: o };
  if (w) return { x: w.x, y: w.y, well: true, px: w };
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
  W.woodcutter = Math.max(1, Math.round(a * (c.stock.wood < 25 ? 0.26 : 0.17)));
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
  const order = [], near = [];
  for (const side of (c.groveSide ? [-c.groveSide, c.groveSide] : [1, -1])) {
    const e = c.ext ? (side > 0 ? c.ext[1] - c.x : c.x - c.ext[0]) + 8 : 0;          // just outside the built-up town (short walks for miners)
    // leave room for the town to grow first: the cut starts well beyond the houses
    for (let d = Math.max(30, e); d <= Math.max(66, e + 30); d += 3) order.push(c.x + side * d);
    for (let d = Math.max(30, e) - 3; d >= 10; d -= 3) near.push(c.x + side * d);     // cramped land: closer is better than nothing
  }
  order.push(...near);
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
    // reserve the whole planned cut at once, so no house is ever sited over a pit that is still to be dug
    const a = Math.min(x0, x0 + dir * L), b = Math.max(x0, x0 + dir * L);
    c.quarry.pit = [a, b]; (c.pits || (c.pits = [])).push(c.quarry.pit);
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
      p.inv.grain = (p.inv.grain || 0) + (wasCrop ? 3 : 1); p.sk.farm++;
      if (rnd() < 0.9 && inb(cx, cy + 1) && at(cx, cy + 1) && SOIL[at(cx, cy + 1).element]) createPixel("hz_crop", cx, cy);
    }
    return;
  }
  // 2. plant new ones (until the field is large enough)
  const want = Math.round(c.pop * 1.4 + 6);
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

/* ======================================================================
   CONSTRUCTION: blueprints, site finding, planning, building
   ====================================================================== */
const COST = {
  hz_plank: { wood: 1 }, hz_roof: { wood: 1 }, hz_door: { wood: 1 }, hz_gate: { wood: 2, iron: 1 }, hz_palisade: { wood: 1 }, hz_cloth: { wood: 1 },
  hz_stone: { stone: 1 }, hz_bed: { wood: 2 }, hz_cot: { wood: 2 }, hz_hearth: { stone: 2 }, hz_campfire: { wood: 2 }, hz_stall: { wood: 1 },
  hz_banner: { wood: 1 }, hz_anvil: { iron: 3 }, hz_forgefire: { stone: 2 }, hz_oven: { stone: 3 }, hz_rack: { wood: 2, iron: 1 }, hz_dummy: { wood: 2 },
  hz_post: { wood: 1 }, hz_medcross: { wood: 1 }, hz_scarecrow: { wood: 1 }, hz_mill: { wood: 3 }, hz_chest: { wood: 2 }, hz_cannon: { cannon: 1 }, hz_well: {},
  glass: {}, dirt: {}, water: {}, hz_earth: {},
  hz_plaster: { stone: 0.25 }, hz_beam: { wood: 0.5 }, hz_window: {}, hz_shutter: { wood: 0.25 }, hz_flowerbox: { wood: 0.25 }, hz_chimney: { stone: 1 },
  hz_lantern: { wood: 0.25 }, hz_gold: { iron: 0.25 }, hz_statue: { stone: 1 }, hz_spray: {}, hz_stair: { wood: 1 }, hz_lamppost: { wood: 0.5 },
  hz_flower: {}, hz_plinth: { stone: 0.5 }, hz_interior: {}, hz_backwin: {},
};
const QUICK = { hz_interior: 1, hz_backwin: 1, hz_flower: 1, hz_spray: 1 };   // cheap finishing touches go up fast
COST.hz_roof = { wood: 0.2 }; COST.hz_beam = { wood: 0.25 }; COST.hz_plank = { wood: 0.5 }; COST.hz_door = { wood: 0.5 }; COST.hz_stair = { wood: 0.5 }; COST.hz_plaster = { stone: 0.15 };
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
H2.costOfPlan = costOfPlan;
function affordable(c, cost, frac) { for (const g in cost) if ((c.stock[g] || 0) < cost[g] * frac) return false; return true; }

/* ---- site finding ---------------------------------------------------------- */
const CLEARABLE = { wood: 1, tree_branch: 1, plant: 1, hz_sapling: 1, sapling: 1, dead_plant: 1, vine: 1 };
function columnGround(x) { // y of free cell above the topmost solid thing, only if that is real ground
  if (x < 1 || x >= width - 1) return -1;
  for (let y = 0; y < height - 1; y++) {
    const o = pixelMap[x][y]; if (!o || isPerson(o) || o.dec || o.element === "hz_crop" || CLEARABLE[o.element]) continue;   // decor, crops and trees make way for buildings
    if (isSoft(o) && (o.element !== "grass" || o.h > 0 || isSoft(pixelMap[x][y + 1]))) continue;  // grass blades / flowers are not ground
    if (elements[o.element] && elements[o.element].state === "gas") continue;
    if (elements[o.element] && elements[o.element].state === "liquid") {          // blood and shallow puddles are mopped up; lakes are not ground
      let d = 1; while (d <= 2 && pixelMap[x][y + d] && elements[pixelMap[x][y + d].element].state === "liquid") d++;
      if (d <= 2 && groundish(pixelMap[x][y + d])) continue;
      return -1;
    }
    return groundish(o) ? y - 1 : -1;
  }
  return -1;
}
function overlaps(c, x0, x1, margin) { for (const pl of c.plans) if (x1 + margin >= pl.x0 && x0 - margin <= pl.x1) return true; return false; }
// a settlement only builds on ground that is closer to it than to any other settlement
function ownTerritory(c, x) { const d = Math.abs(x - c.x); for (const o of H2.cols) if (o !== c && o.pop > 0 && Math.abs(x - o.x) < d) return false; return true; }
H2.ownTerritory = ownTerritory;
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
    const why = H2.dbgSite;
    if (x0 < lo || x0 + w - 1 > hi) { if (why) why.push(off + ":range"); continue; }
    if (overlaps(c, x0, x0 + w - 1, 1)) { if (why) why.push(off + ":plan"); continue; }
    if (onPit(x0 - 3, x0 + w + 2)) { if (why) why.push(off + ":pit"); continue; }
    if (!opt.anywhere && !ownTerritory(c, x0 + w / 2)) { if (why) why.push(off + ":terr"); continue; }
    let ok = true, mn = 1e9, mx = -1e9; const gys = [];
    for (let i = 0; i < w; i++) { const g = columnGround(x0 + i); if (g < 2) { ok = false; break; } gys.push(g); if (g < mn) mn = g; if (g > mx) mx = g; }
    if (!ok || mx - mn > (opt.slope || 3)) { if (why) why.push(off + (ok ? ":slope" + (mx - mn) : ":ground")); continue; }
    if (!opt.nomargin) { // keep a gap to neighbouring buildings
      let bad = false;
      for (const mxx of [x0 - 1, x0 - 2, x0 + w, x0 + w + 1]) { if (mxx < 1 || mxx >= width - 1) continue; for (let y = 0; y < height; y++) { const o = pixelMap[mxx][y]; if (o && !o.dec) { if (elements[o.element].hzb) bad = true; break; } } if (bad) break; }
      if (bad) { if (why) why.push(off + ":margin"); continue; }
    }
    return { x0: x0, y0: mn, gys: gys, ag: [columnGround(x0 - 1), columnGround(x0 + w)] };
  }
  return null;
}
H2.findSite = findSite;
function onPit(a, b) { for (const k of H2.cols) for (const q of (k.pits || [])) if (b >= q[0] && a <= q[1]) return true; return false; }

/* ---- plans ----------------------------------------------------------------- */
function queuePlan(c, type, opt) {
  opt = opt || {};
  const bp = BLUEPRINTS[type](c, opt); const cost = costOfPlan(bp);
  const site = opt.site || findSite(c, bp.w, opt);
  if (!site) return null;
  const cells = [];
  // foundation for uneven ground (packed earth, so it neither crumbles nor grows grass inside the house)
  if (site.gys && !bp.dug) {
    const floor = bp.w >= 3;
    for (let i = 0; i < bp.w; i++) for (let y = site.y0 + 1; y <= Math.max(site.gys[i], floor ? site.y0 + 1 : site.y0); y++) {
      const dy = y - site.y0, col = dy === 1 ? (bp.floorC || bp.pathC) : bp.baseC;
      cells.push([i, dy, "hz_earth", col ? { c: shade(col, dy === 1 ? 1 : (dy % 2 ? 0.96 : 1.04)) } : undefined]);
    }
    // level the ground right outside both ends so people can walk straight in and out of the doors
    if (floor && site.ag && !opt.nomargin) {
      [[-1, site.ag[0]], [bp.w, site.ag[1]]].forEach(([ax, g]) => {
        if (g < 1 || g - site.y0 > 4 || site.y0 - g > 6) return;
        for (let y = g + 1; y <= site.y0; y++) cells.push([ax, y - site.y0, "__dig"]);
        for (let y = site.y0 + 1; y <= Math.max(site.y0 + 1, g); y++) cells.push([ax, y - site.y0, "hz_earth", bp.pathC ? { c: shade(bp.pathC) } : undefined]);
      });
      // clear the head room above the approach as well (plants, loose earth)
      for (const ax of [-1, bp.w]) for (let dy = -2; dy <= 0; dy++) cells.push([ax, dy, "__dig"]);
    }
  }
  for (const cell of bp.cells) cells.push(cell.slice());
  if (opt.mirror) for (const cell of cells) { cell[0] = bp.w - 1 - cell[0]; if (cell[3] && cell[3].sx !== undefined) cell[3] = Object.assign({}, cell[3], { sx: bp.w - 1 - cell[3].sx }); }
  cells.sort((a, b) => (a[3] && a[3].late ? 1 : 0) - (b[3] && b[3].late ? 1 : 0) || (a[2] === "water" ? 1 : 0) - (b[2] === "water" ? 1 : 0) || (b[2] === "__dig" ? 1 : 0) - (a[2] === "__dig" ? 1 : 0) || b[1] - a[1] || a[0] - b[0]);
  const plan = { id: c.plans.length + 1000 + Math.floor(rnd() * 1e6), type: type, x0: site.x0, y0: site.y0, x1: site.x0 + bp.w - 1, w: bp.w, cells: cells, i: 0, state: "ready", t0: pixelTicks, opt: opt, cost: cost, dir: opt.dir, beds: bp.beds || 0, style: bp.style };
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
  const can = (type, frac) => affordable(c, costOfPlan(BLUEPRINTS[type](c)), frac || 0.6);
  const hasHall = !!c.hall;
  // housing first
  const housing = c.beds + c.plans.reduce((n, p) => n + (p.beds || 0), 0);
  const housePlanned = c.plans.some((p) => HOUSING[p.type]);
  if (!hasHall && pop >= 3 && can("hall", 0.55) && !c.plans.some((p) => p.type === "hall")) { if (queuePlan(c, "hall", { cx: c.x })) return; }
  if (haveCount(c, "campfire") === 0 && pop >= 2 && !c.plans.some((p) => p.type === "campfire") && s.wood >= 2) { if (queuePlan(c, "campfire", { cx: hasHall ? c.hall.x : c.x, range: 14 })) return; }
  if (haveCount(c, "well") === 0 && pop >= 3 && can("well", 0.8) && !c.plans.some((p) => p.type === "well")) { if (queuePlan(c, "well", { range: 30 }) || queuePlan(c, "well", { range: 60, slope: 5 })) return; }
  if (housing < pop + 1 && !housePlanned) { if (planHouse(c, can)) return; }
  if (pop >= 5 && haveCount(c, "oven") === 0 && can("bakery", 0.7) && !c.plans.some((p) => p.type === "bakery")) { if (queuePlan(c, "bakery")) return; }
  if (pop >= 6 && haveCount(c, "market") === 0 && can("market", 0.7) && !c.plans.some((p) => p.type === "market")) { if (queuePlan(c, "market")) return; }
  if (pop >= 8 && haveCount(c, "forge") === 0 && can("forge", 0.7) && !c.plans.some((p) => p.type === "forge")) { if (queuePlan(c, "forge", { side: c.fac === 0 ? -1 : 1 })) return; }
  if (pop >= 11 && haveCount(c, "hospital") === 0 && can("hospital", 0.7) && !c.plans.some((p) => p.type === "hospital")) { if (queuePlan(c, "hospital")) return; }
  if ((pop >= 14 || c.tension >= 1) && pop >= 8 && haveCount(c, "rack") === 0 && can("barracks", 0.7) && !c.plans.some((p) => p.type === "barracks")) { if (queuePlan(c, "barracks", { side: c.fac === 0 ? 1 : -1 })) return; }
  if (pop >= 9 && haveCount(c, "scarecrow") === 0 && s.wood >= 5 && (H2.crops || []).length > 6 && !c.plans.some((p) => p.type === "scarecrow")) { const sp = farmSpot({}, c); if (sp) { if (queuePlan(c, "scarecrow", { site: { x0: sp.x, y0: sp.y, gys: [sp.y] } })) return; } }
  if (H2.warPlan && H2.cfg.war) { if (H2.warPlan(c, can)) return; }
  // keep growing: one more house when everyone has a bed already and there are spare resources
  if (pop >= 6 && housing < pop + 3 && s.wood > 80 && !housePlanned && can("house", 1)) { if (planHouse(c, can)) return; }
  // beautify the town once the basics are there
  if (hasHall && housing >= pop && planDecor(c, can)) return;
}
const HOUSING = { hut: 1, house: 1, townhouse: 1 };
// pick a dwelling for the town's size and wealth; dense townhouses once the town is crowded
function planHouse(c, can) {
  const pop = c.pop;
  const order = [];
  if (pop >= 8 && (c.crowded >= 1 || rnd() < 0.45)) order.push("townhouse");
  if (pop >= 3) order.push("house");
  if (pop >= 8 && !order.includes("townhouse")) order.push("townhouse");
  order.push("hut");
  for (const t of order) {
    if (!can(t, t === "hut" ? 0.8 : 0.6)) continue;
    if (queuePlan(c, t, { mirror: rnd() < 0.5 })) { c.crowded = 0; return true; }
    if (t !== "hut") c.crowded = (c.crowded || 0) + 0.5;
  }
  return false;
}
// street lamps, flower gardens, a fountain and a statue between the houses
function decorSite(c, w) {
  const e = c.ext; if (!e) return null;
  const cx = c.x, span = Math.max(cx - e[0], e[1] - cx) + 3;
  for (let off = 0; off <= span; off++) for (const sg of [1, -1]) {
    const x0 = Math.round(cx + sg * off - w / 2); if (x0 < 2 || x0 + w > width - 2 || x0 < e[0] - 3 || x0 + w - 1 > e[1] + 3) continue;
    if (overlaps(c, x0, x0 + w - 1, 0) || !ownTerritory(c, x0)) continue;
    let ok = true, mn = 1e9, mx = -1e9; const gys = [];
    for (let i = 0; i < w; i++) {
      const g = columnGround(x0 + i); if (g < 8) { ok = false; break; }
      const t = at(x0 + i, g + 1); if (!t || t.element === "farmland" || t.element === "hz_crop") { ok = false; break; }
      gys.push(g); mn = Math.min(mn, g); mx = Math.max(mx, g);
    }
    if (!ok || mx - mn > 0) continue;
    for (let i = -1; i <= w && ok; i++) for (let y = mn - 9; y <= mn; y++) { const o = at(x0 + i, y); if (o && (isPerson(o) ? false : (i >= 0 && i < w) || elements[o.element].pass)) { ok = false; break; } }
    if (!ok) continue;
    return { x0: x0, y0: mn, gys: gys };
  }
  return null;
}
function planDecor(c, can) {
  if (c.plans.length || c.famine || c.war.state === "war" || c.war.state === "siege" || pixelTicks - (c.lastDecor || 0) < 900) return false;
  const pop = c.pop, b = c.built, s = c.stock;
  const opts = [];
  if (pop >= 12 && !b.fountain && s.stone >= 16) opts.push("fountain");
  if (pop >= 18 && !b.statue && s.stone >= 24) opts.push("statue");
  if ((b.lamp || 0) < Math.min(14, Math.floor(pop / 3)) && s.wood >= 25) opts.push("lamp");
  if ((b.garden || 0) < Math.min(10, Math.floor(pop / 4))) opts.push("garden");
  if (!opts.length) return false;
  c.lastDecor = pixelTicks;
  const t = opts[0] === "fountain" || opts[0] === "statue" ? opts[0] : pick(opts);
  if (!can(t, 1)) return false;
  const bp = BLUEPRINTS[t](c);
  const site = decorSite(c, bp.w); if (!site) return false;
  return !!queuePlan(c, t, { site: site, nomargin: true });
}
H2.planHouse = planHouse;
H2.planBuild = planBuild;
function completePlan(c, pl) {
  c.built[pl.type] = (c.built[pl.type] || 0) + 1;
  if (pl.helpers && !DECOR[pl.type]) for (const id in pl.helpers) { const q = H2.byId[id]; if (q && !q.dead) { q.builtN = (q.builtN || 0) + 1; life(q, "Helped build " + (BUILD_NAMES[pl.type] || "a " + pl.type) + " in " + c.name + ".", "build"); } }
  if (!DECOR[pl.type] && pl.type !== "moat" && pl.type !== "cannon") c.ext = c.ext ? [Math.min(c.ext[0], pl.x0), Math.max(c.ext[1], pl.x1)] : [pl.x0, pl.x1];
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

// create one blueprint cell in the world, with its colour and settlement metadata
function placeCell(c, pl, cell) {
  const el = cell[2], cx = pl.x0 + cell[0], cy = pl.y0 + cell[1];
  if (!inb(cx, cy) || !elements[el]) return null;
  createPixel(el, cx, cy);
  const n = pixelMap[cx][cy];
  if (n) {
    const info = elements[el];
    if (info && (info.st || info.door || el === "hz_cloth" || el === "hz_cannon")) { n.fac = c.fac; n.ay = pl.y0; }
    if (info && info.hzb) { n.hzb2 = 1; n.fac = c.fac; n.cid = c.id; if (DECOR[pl.type]) n.dec = 1; }
    const o3 = cell[3];
    if (o3) {
      if (o3.c) n.color = o3.c;
      if (o3.sx !== undefined) { n.sx = pl.x0 + o3.sx; n.uf = pl.y0 + o3.uf; }
      if (o3.ay !== undefined) n.ay = pl.y0 + o3.ay;
      if (o3.nm) n.nm = o3.nm;
      if (o3.flag) n.color = FAC[c.fac].flag;
    }
    if (el === "hz_cannon") { n.dir = pl.dir || (c.fac === 0 ? 1 : -1); n.ammo = 0; n.cd = 0; n.cid = c.id; }
    if (el === "hz_stone" || el === "hz_plank" || el === "hz_roof" || el === "hz_palisade") n.fac = c.fac;
  }
  return n;
}
H2.placeCell = placeCell;
// instantly raise a whole building (used by the "blueprint" tools and tests); ignores cost
function instantBuild(c, pl) {
  for (const cell of pl.cells) {
    const x = pl.x0 + cell[0], y = pl.y0 + cell[1]; if (!inb(x, y)) continue;
    const o = pixelMap[x][y];
    if (cell[2] === "__dig") { if (o && !isPerson(o) && !elements[o.element].hzb) deletePixel(x, y); continue; }
    if (o) { if (isPerson(o) || (elements[o.element].hzb && o.element !== "hz_earth" && !o.dec)) continue; deletePixel(x, y); }
    placeCell(c, pl, cell);
  }
  const i = c.plans.indexOf(pl); if (i >= 0) c.plans.splice(i, 1);
  completePlan(c, pl);
}
H2.instantBuild = instantBuild;

/* ---- the build task ----------------------------------------------------------- */
function cellOpenFor(p, x, y) { return true; }
TASKS.build = function (p, t) {
  const c = colById(p.col); if (!c) return "done";
  const pl = c.plans[0] && c.plans[0].state !== "stalled" ? c.plans[0] : c.plans.find((q) => q.state !== "stalled");
  if (!pl) return "done";
  // skip cells that need no work (already placed, nothing to dig) without spending the builder's time
  for (let n = 0; n < 12 && pl.i < pl.cells.length; n++) {
    const k = pl.cells[pl.i], kx = pl.x0 + k[0], ky = pl.y0 + k[1];
    if (!inb(kx, ky)) { pl.i++; continue; }
    const ko = pixelMap[kx][ky];
    if (k[2] === "__dig" ? !ko || (!isPerson(ko) && (elements[ko.element].hzb || elements[ko.element].state === "liquid")) : ko && ko.element === k[2] && !isPerson(ko)) { pl.i++; continue; }
    break;
  }
  if (pl.i >= pl.cells.length) return "done";
  const cell = pl.cells[pl.i];
  const el = cell[2], cx = pl.x0 + cell[0], cy = pl.y0 + cell[1];
  if (!inb(cx, cy)) { pl.i++; return; }
  const r = goTo(p, clamp(cx + (p.id % 2 ? -2 : 2), 1, width - 2), pl.y0, 3, 9);
  if (r === "fail") { t.fail = (t.fail || 0) + 1; if (t.fail > 3) { pl.i++; t.fail = 0; } return "done"; }
  if (r !== "arrive" && Math.abs(p.x - cx) > 5) return;
  if (pixelTicks < (p.buildCool || 0)) return;
  p.buildCool = pixelTicks + (QUICK[el] ? 2 : Math.max(3, Math.round(6 - (p.sk.build || 0) * 0.6)));
  // is the cell already done?
  const o = pixelMap[cx][cy];
  if (o && isTreePart(o) && !o.hzb2) {                                                         // a tree on the site: fell it whole, the wood goes to the store
    const w0 = p.inv.wood || 0; fellTree(p, treeBase(o) || o); c.stock.wood += (p.inv.wood || 0) - w0; p.inv.wood = w0;
    if (pixelMap[cx][cy] && isTreePart(pixelMap[cx][cy])) deletePixel(cx, cy);
    return;
  }
  if (el === "__dig") { if (o && !isPerson(o) && !elements[o.element].hzb && elements[o.element].state !== "liquid") deletePixel(cx, cy); pl.i++; return; }
  if (o && o.element === el) { pl.i++; return; }
  if (o) {
    if (isPerson(o)) {
      // somebody is standing where a block goes: lift them on top of it (foundations) or wait for them to move on
      const b = o.element === "hz_head" ? at(o.x, o.y + 1) : o;
      if (el === "hz_earth" && b && b.id !== undefined && !b.dead) { shift(b, 0, -1) || shift(b, 0, -1, true); if (isPerson(pixelMap[cx][cy])) shift(b, 0, -1); }
      else if (b && b.id !== undefined && !b.dead && !b.sleeping && b !== p) { const d = b.x >= p.x ? 1 : -1; shift(b, d, 0) || shift(b, -d, 0) || shift(b, d, -1) || shift(b, -d, -1); }   // "excuse me": the worker steps aside
      else if (b === p) { const d = cx >= pl.x0 + pl.w / 2 ? -1 : 1; tryWalk(p, d, false) || tryWalk(p, -d, false); }   // the builder is in their own way
      if (isPerson(pixelMap[cx][cy])) { t.wait = (t.wait || 0) + 1; if (t.wait > 60) { pl.i++; t.wait = 0; } return; }
    }
  }
  const o2 = pixelMap[cx][cy];
  if (o2) {
    const oi = elements[o2.element];
    if (oi.hzb && !o2.dec && !(el === "water")) { pl.i++; return; }                                   // someone else's wall
    if (el === "water" && oi.state === "liquid") { pl.i++; return; }
    deletePixel(cx, cy);                                                                      // clear brush, leaves, loose stuff
  }
  const need = COST[el] || {};
  for (const g in need) if ((c.stock[g] || 0) < need[g]) { pl.state = "stalled"; return "done"; }
  for (const g in need) c.stock[g] -= need[g];
  placeCell(c, pl, cell);
  pl.i++; p.sk.build += 0.05; (pl.helpers || (pl.helpers = {}))[p.id] = 1;
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
        const bw = inb(x, y) && pixelMap[x][y];
        if (bw && !isPerson(bw) && elements[bw.element].pass && !elements[bw.element].stair) openDoor(bw);   // indoors: step in front of the back wall
        if (isEmpty(x, y)) {
          w.preg = 0; w.lastBirth = pixelTicks;
          const tr = rollTraits([w.tr, sp && sp.tr]);
          const kid = spawnChild(x, y, w.fac, { col: c.id, born: pixelTicks, sn: (sp || w).sn, par: [w.id, sp ? sp.id : 0], tr: tr, skin: pick([w.skin, sp ? sp.skin : w.skin]), age: 0 });
          if (kid) {
            w.kids.push(kid.id); if (sp) sp.kids.push(kid.id);
            c.births++; H2.stats.births++;
            addThought(w, "newborn", 20, DAY * 2); if (sp) addThought(sp, "newborn", 20, DAY * 2);
            life(kid, "Born in " + c.name + " to " + nm(w) + (sp ? " and " + nm(sp) : "") + ".", "birth");
            life(w, "Gave birth to " + kid.first + ".", "child"); if (sp) life(sp, "Became a parent of " + kid.first + ".", "child");
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
    if (H2.people.length >= H2.cfg.maxPeople || (H2.facPop && H2.facPop[c.fac] >= H2.cfg.maxPerFaction)) continue;
    if (c.beds * 2 < c.pop || food < c.pop * 1.1 || c.tension >= 4 || w.hu < 40 || w.sick) continue;
    if (rnd() < 0.05) w.preg = pixelTicks + Math.floor(DAY * 0.5);
  }
}

/* ======================================================================
   ARCHITECTURE: faction building styles & procedural blueprints
   Every building is generated fresh from its faction's style with random
   proportions, roof shapes, materials, windows, chimneys and ornaments,
   so no two houses look alike — but a town still looks like one town.
   Blueprint coordinates: dx 0..w-1 from the left, dy 0 = the floor row
   people stand in, negative = up. Interior rows 0..-2 are always kept free
   (except furniture on row 0) so 2-pixel villagers can walk through.
   ====================================================================== */
function hexRgb(h) { h = String(h).replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function shade(hex, f, j) {   // colour with brightness factor f and random jitter j -> "rgb(r,g,b)"
  const c = hexRgb(hex); const k = (f || 1) * (1 + (rnd() * 2 - 1) * (j === undefined ? 0.045 : j));
  return "rgb(" + c.map((v) => clamp(Math.round(v * k), 0, 255)).join(",") + ")";
}
H2.shade = shade;
const STYLES = [
  { key: "northern", name: "Northern timber-frame",
    wall: ["#efe8d6", "#e9e1cc", "#f3eee2", "#e4dccb", "#dfe6ea", "#ece4cf"], frame: ["#4a3122", "#553826", "#3f2a1d"],
    roof: ["#3b4656", "#45536a", "#34404f", "#4a5a6e", "#3d5a66", "#5a4636"], trim: ["#2f5fa8", "#2b4c7e", "#3a6fb8"],
    shutter: ["#2f5fa8", "#2e6b52", "#7a2d2d", "#2b4c7e"], door: ["#5b3b22", "#4f331e", "#2f4f7a", "#3b2a1c"],
    base: ["#8d8f93", "#7f8287", "#999ba0"], floor: ["#7a5434", "#6e4b2e"], path: ["#8f8a80", "#9a948a"], glass: ["#cfe8f7", "#bcdcf0", "#d9eef8"],
    flowers: ["#e0457b", "#f4d03f", "#ffffff", "#b05cc8", "#ff7f50", "#5aa9e6"], chim: ["#8a5a48", "#7d6a5c", "#6f5f55"], thatch: ["#b8954a", "#a8853e", "#c4a159"],
    stone: ["#8a8d92", "#7d8085", "#94979c"], statue: "#7f9c8a", dome: "#3d5a66",
    houseRoofs: ["gable", "steep", "gable", "steep", "gambrel"], hallRoof: "gable", chimney: 0.8 },
  { key: "southern", name: "Southern terracotta",
    wall: ["#f0d9b5", "#e8c99a", "#f2e3c9", "#e7b98f", "#f4cfb4", "#ead6b8", "#f5e6d0"], frame: ["#fbf6ec", "#f3ecdc"],
    roof: ["#c25a2c", "#b34d26", "#cf6a38", "#a8452a", "#d4743f"], trim: ["#fbf6ec", "#f3ecdc", "#e9dfc9"],
    shutter: ["#2e7d6b", "#2f6f8f", "#8b3a2e", "#3d8a5a", "#3a5f9f"], door: ["#6b3a1e", "#7a4524", "#3f5f4a", "#5a2f1a"],
    base: ["#c9b28c", "#bfa47c", "#d2bc96"], floor: ["#b5653e", "#a9592f"], path: ["#cbb48e", "#c2a984"], glass: ["#d8eef5", "#c8e6f0"],
    flowers: ["#d62828", "#f77f00", "#fcbf49", "#e85d75", "#ffffff", "#c13584"], chim: ["#e6d2b2", "#d9c3a0"], thatch: ["#c9a35a", "#b8924c"],
    stone: ["#d2bc96", "#c9b28c", "#dcc8a4"], statue: "#ece8df", dome: "#d9a441",
    houseRoofs: ["low", "low", "flat", "low", "flat"], hallRoof: "dome", chimney: 0.35 },
];
H2.STYLES = STYLES;
function subset(a, n) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = b[i]; b[i] = b[j]; b[j] = t; } return b.slice(0, Math.min(n, b.length)); }
function styleOf(c) { return STYLES[(c ? c.fac : 0) % STYLES.length] || STYLES[0]; }
// each town picks a local palette (its "quarry and dyes"), so it looks harmonious while every house still differs
function matsOf(c) {
  const S = styleOf(c);
  if (c && c.mat && c.mat.k === S.key) return c.mat;
  const m = { k: S.key, wall: subset(S.wall, 3), roof: subset(S.roof, 2), shutter: subset(S.shutter, 2), door: subset(S.door, 2), roofs: S.houseRoofs };
  if (c) c.mat = m;
  return m;
}
function palette(c) {
  const S = styleOf(c), M = matsOf(c);
  return { S: S, wall: rnd() < 0.85 ? pick(M.wall) : pick(S.wall), roof: rnd() < 0.85 ? pick(M.roof) : pick(S.roof), frame: pick(S.frame), trim: pick(S.trim),
    shutter: pick(M.shutter), door: pick(M.door), base: pick(S.base), floor: pick(S.floor), path: pick(S.path), glass: pick(S.glass), chim: pick(S.chim),
    thatch: pick(S.thatch), stone: pick(S.stone), flowers: S.flowers, north: S.key === "northern" };
}
H2.palette = palette;

/* ---- plot: a sparse grid that later cells may overwrite ---- */
function Plot(w) {
  const m = new Map();
  const P = { w: w, beds: 0, floor: null,
    set(x, y, el, col, o) { const op = Object.assign({}, o || {}); if (col) op.c = col; m.set(x + "," + y, [x, y, el, op]); return P; },
    get(x, y) { return m.get(x + "," + y); }, has(x, y) { return m.has(x + "," + y); }, del(x, y) { m.delete(x + "," + y); return P; },
    top(x) { let t = 1e9; for (const v of m.values()) if (v[0] === x && v[1] < t) t = v[1]; return t; },
    done() {
      const b = BP(w); let h = 0, beds = 0;
      for (const v of m.values()) { b.cells.push(v); if (-v[1] > h) h = -v[1]; if (v[2] === "hz_bed") beds++; }
      b.h = h; b.floorC = P.floor; b.beds = beds; b.style = P.style; b.pathC = P.path; b.baseC = P.base;
      return b;
    } };
  return P;
}
const C = (hex, f) => shade(hex, f || 1);

/* ---- roofs ------------------------------------------------------------------
   E = eave row (also the ceiling), L..R = span incl. overhang. fillEl/fillC = gable infill. */
function roof(P, pal, shape, E, L, R, o) {
  o = o || {};
  const rc = o.roofC || pal.roof, fillEl = o.fillEl || "hz_plaster", fillC = o.fillC || pal.wall;
  const mid = (L + R) / 2;
  const tile = (x, y, k) => P.set(x, y, "hz_roof", C(rc, k % 2 ? 0.9 : 1.02));
  if (shape === "flat") {
    for (let x = L; x <= R; x++) P.set(x, E, "hz_plaster", C(pal.trim, x === L || x === R ? 0.92 : 1));            // cornice
    for (let x = L + 1; x <= R - 1; x++) {
      const rel = x - (L + 1);
      if (rel % 2 === 0 || x === L + 1 || x === R - 1) P.set(x, E - 1, "hz_plaster", C(pal.wall, 0.97));                 // parapet merlons
      else if (rnd() < 0.45) P.set(x, E - 1, "hz_flowerbox", C(pick(pal.flowers)), { late: 1 });                    // roof-terrace planters
    }
    return E - 1;
  }
  if (shape === "dome") {
    const r = Math.max(2, Math.floor((R - L) / 2) - 1);
    for (let x = L; x <= R; x++) P.set(x, E, "hz_plaster", C(pal.trim));
    let top = E;
    for (let k = 1; k <= r + 1; k++) {
      for (let x = L + 1; x <= R - 1; x++) {
        const dx = x - mid, dy = k - 0.5;
        if (dx * dx + dy * dy * 1.15 <= r * r + r * 0.6) { P.set(x, E - k, o.domeEl || "hz_roof", C(o.domeC || pal.S.dome, k % 2 ? 0.94 : 1.04)); top = Math.min(top, E - k); }
      }
    }
    const cx = Math.round(mid);
    P.set(cx, top - 1, "hz_gold", C("#e2b33c")).set(cx, top - 2, "hz_gold", C("#f0c75a"));
    return top - 2;
  }
  // pitched roofs: gable (45°), steep (2 rows per step), low (2 cols per row), gambrel (steep then shallow)
  let top = E;
  for (let k = 0; ; k++) {
    let inset;
    if (shape === "steep") inset = Math.floor((k + 1) / 2);
    else if (shape === "low") inset = 2 * k;
    else if (shape === "gambrel") { const kk = Math.ceil((R - L) / 6); inset = k <= kk ? Math.floor(k / 2) : Math.floor(kk / 2) + (k - kk) * 2; }
    else inset = k;
    const xl = L + inset, xr = R - inset;
    if (xl > xr) break;
    const y = E - k; top = y;
    const thick = shape === "low" ? 2 : shape === "steep" ? 1 : 2;
    for (let x = xl; x <= xr; x++) {
      const edge = k === 0 || x - xl < thick || xr - x < thick || xr - xl <= 2 * thick;
      if (edge) tile(x, y, k);
      else if (o.fillEl) P.set(x, y, fillEl, C(fillC, 0.97));
      else P.set(x, y, "hz_roof", C(rc, (k % 2 ? 0.74 : 0.8) + ((x + k) % 4 === 0 ? 0.06 : 0)));       // tiled courses, shaded under the ridge
    }
  }
  // a little attic window in tall gables
  if (o.attic && E - top >= 4) {                                                       // a dormer / attic window with a little frame
    const cx = Math.round(mid), y = E - 2;
    if (P.has(cx, y - 1) && P.has(cx - 1, y) && P.has(cx + 1, y)) { P.set(cx, y, "hz_window", C(pal.glass)); P.set(cx, y - 1, pal.north ? "hz_beam" : "hz_plaster", C(pal.north ? pal.frame : pal.trim)); }
  }
  return top;
}
function chimney(P, pal, x, E) {
  const t = P.top(x); if (t >= E) return;
  // a brick stack rising out of the roof slope (2 courses) with a smoking cap
  P.set(x, t, "hz_stone", C(pal.chim, 0.9)).set(x, t - 1, "hz_stone", C(pal.chim, 1.05)).set(x, t - 2, "hz_stone", C(pal.chim, 0.95));
  P.set(x, t - 3, "hz_chimney", C(pal.chim, 0.8));
}
// window positions inside a wall band (every third column, never at the end posts)
function windowCols(w) { const a = []; for (let x = 2; x <= w - 3; x += 3) a.push(x); if (!a.length && w >= 3) a.push(Math.floor(w / 2)); return a; }
function band(P, pal, y0, rows, w, o) {
  o = o || {};
  const wins = o.noWin ? [] : windowCols(w);
  for (let k = 0; k < rows; k++) {
    const y = y0 - k, rail = pal.north && rows >= 2 && k === rows - 1;
    for (let x = 0; x < w; x++) {
      const post = x === 0 || x === w - 1;
      if (pal.north && !o.stoneWall && (post || rail || (o.frame && x % 3 === 0 && !wins.includes(x)))) { P.set(x, y, "hz_beam", C(pal.frame)); continue; }
      if (wins.includes(x) && !rail) { P.set(x, y, "hz_window", C(pal.glass)); continue; }
      P.set(x, y, o.stoneWall ? "hz_stone" : "hz_plaster", C(o.stoneWall ? pal.stone : pal.wall, post ? 0.94 : 1));
    }
  }
}
// the two end walls (doors on rows 0,-1 or an open archway; lintel on row -2; more wall above for tall rooms)
function ends(P, pal, w, ih, o) {
  o = o || {};
  for (const ex of [0, w - 1]) {
    const open = o.open === "both" || (o.open === "left" && ex === 0) || (o.open === "right" && ex === w - 1);
    if (!open) P.set(ex, 0, o.gate ? "hz_gate" : "hz_door", C(pal.door)).set(ex, -1, o.gate ? "hz_gate" : "hz_door", C(pal.door, 0.92));
    for (let y = -2; y >= -(ih - 1); y--) {
      if (y === -2) P.set(ex, y, pal.north ? "hz_beam" : "hz_plaster", C(pal.north ? pal.frame : pal.trim));
      else if (y === -3 && ih >= 5) P.set(ex, y, "hz_window", C(pal.glass));
      else P.set(ex, y, o.stoneWall ? "hz_stone" : (pal.north ? "hz_beam" : "hz_plaster"), C(o.stoneWall ? pal.stone : pal.north ? pal.frame : pal.wall));
    }
  }
  if (o.lantern !== false && rnd() < 0.7) { const ex = rnd() < 0.5 ? 0 : w - 1; P.set(ex, -2, "hz_lantern", null, { late: 1 }); }
}
function pickRoof(c, pal, w) { const M = matsOf(c); let r = pick(M.roofs); if (r === "gambrel" && w < 9) r = "gable"; if (r === "steep" && w > 10) r = rnd() < 0.5 ? "gambrel" : "gable"; return r; }
/* the cut-away back wall of every room: darker (in shadow), with windows that glow at night.
   Villagers walk in front of it, so a house looks solid but stays fully walkable. */
function interior(P, pal, x0, x1, y0, y1, o) {
  o = o || {};
  const base = o.wallC || pal.wall, dk = o.dark || 0.62;
  const wins = o.noWin ? [] : windowCols(x1 - x0 + 3).map((x) => x + x0 - 1);
  const winRows = y0 - y1 >= 2 ? [y0 - 1, y0 - 2] : [];
  for (let y = y0; y >= y1; y--) for (let x = x0; x <= x1; x++) {
    if (P.has(x, y)) continue;
    let el = "hz_interior", col;
    if (wins.includes(x) && winRows.includes(y)) { el = "hz_backwin"; col = C(pal.glass, 0.8); }
    else if (pal.north && (x - x0) % 3 === 2 && !wins.includes(x)) col = C(pal.frame, 0.8);          // timber studs
    else if (y === y0) col = C(o.dadoC || base, dk * 0.86);                                           // skirting / dado
    else if (y === y1) col = C(base, dk * 0.9);                                                       // shadow under the ceiling
    else col = C(base, dk + (x % 2 ? 0.02 : 0));
    P.set(x, y, el, col);
  }
}

/* ---- dwellings -------------------------------------------------------------- */
function genHut(c) {
  const pal = palette(c), w = rint(4, 6), P = Plot(w); P.style = pal.S.key; P.floor = pal.floor; P.path = pal.path; P.base = pal.base;
  // one door, the other end an open porch; plank walls and a thatched roof
  P.set(w - 1, 0, "hz_door", C(pal.door)).set(w - 1, -1, "hz_door", C(pal.door, 0.92)).set(w - 1, -2, "hz_plank", C("#9c7040"));
  P.set(0, -2, "hz_plank", C("#9c7040"));
  P.set(w - 2, 0, "hz_bed");
  interior(P, pal, 1, w - 2, 0, -2, { wallC: "#a67b47", noWin: w < 6 });
  roof(P, pal, pal.north ? "steep" : "low", -3, -1, w, { roofC: pal.thatch });
  return P.done();
}
function genCottage(c) {
  const pal = palette(c), w = rint(6, 11), P = Plot(w); P.style = pal.S.key; P.floor = pal.floor; P.path = pal.path; P.base = pal.base;
  ends(P, pal, w, 3);
  band(P, pal, -3, 1, w);
  // furniture: hearth under the chimney, beds, a chest
  const slots = []; for (let x = 2; x <= w - 3; x++) slots.push(x);
  const hasChim = rnd() < pal.S.chimney;
  const hx = hasChim ? (rnd() < 0.5 ? slots[0] : slots[slots.length - 1]) : -1;
  if (hasChim) P.set(hx, 0, "hz_hearth");
  let beds = 0; const want = w >= 10 ? 4 : w >= 8 ? 3 : 2;
  for (const x of (hx === slots[0] ? slots.slice().reverse() : slots)) { if (x === hx) continue; if (beds < want) { P.set(x, 0, "hz_bed"); beds++; } else if (rnd() < 0.5) { P.set(x, 0, "hz_chest"); break; } }
  interior(P, pal, 1, w - 2, 0, -2);
  const shape = pickRoof(c, pal, w);
  roof(P, pal, shape, -4, -1, w, { attic: true });
  if (hasChim) chimney(P, pal, hx, -4);
  // window boxes under the band windows on the outside of the end walls
  if (rnd() < 0.6) { P.set(-1, -3, "hz_flowerbox", C(pick(pal.flowers)), { late: 1 }); }
  if (rnd() < 0.6) { P.set(w, -3, "hz_flowerbox", C(pick(pal.flowers)), { late: 1 }); }
  return P.done();
}
// two storeys: ground floor (rows 0..-2), plank floor on row -3 with a staircase, upper floor rows -4..-6
function genTownhouse(c) {
  const pal = palette(c), w = rint(10, 15), P = Plot(w); P.style = pal.S.key; P.floor = pal.floor; P.path = pal.path; P.base = pal.base;
  const a = 2, foot = a - 1, uf = -4;
  ends(P, pal, w, 3);
  // staircase rising to the right: (a,0) / (a+1,0..-1) / (a+2,0..-2)
  for (let i = 0; i < 3; i++) for (let k = 0; k <= i; k++) P.set(a + i, -k, "hz_stair", C(pal.north ? "#8a6440" : "#b08650", k % 2 ? 0.94 : 1.04), { sx: foot, uf: uf });
  // upper floor planks (with stairwell opening above the stairs)
  for (let x = 0; x < w; x++) { if (x === a + 1 || x === a + 2) continue; P.set(x, -3, "hz_plank", C(pal.floor, 1.05), { sx: foot, uf: uf }); }
  // ground floor furniture
  const hasChim = rnd() < pal.S.chimney + 0.1;
  const gx0 = a + 3;
  if (hasChim) P.set(gx0, 0, "hz_hearth");
  for (let x = gx0 + 1; x <= w - 3; x++) P.set(x, 0, "hz_bed");
  // upper floor: beds beyond the landing; outer walls with windows at both ends
  for (let x = a + 4; x <= w - 2; x++) P.set(x, uf, "hz_bed", null, { sx: foot, uf: uf, ay: uf });
  for (const ex of [0, w - 1]) {
    P.set(ex, -4, pal.north ? "hz_beam" : "hz_plaster", C(pal.north ? pal.frame : pal.wall));
    P.set(ex, -5, "hz_window", C(pal.glass)).set(ex, -6, "hz_window", C(pal.glass));
    P.set(ex + (ex === 0 ? -1 : 1), -4, "hz_flowerbox", C(pick(pal.flowers)), { late: 1 });
  }
  // north: jettied upper storey with timber braces; south: a balcony rail on one end
  if (pal.north) { P.set(-1, -3, "hz_beam", C(pal.frame)).set(w, -3, "hz_beam", C(pal.frame)); }
  interior(P, pal, 1, w - 2, 0, -2);
  interior(P, pal, 1, w - 2, -4, -6, { dadoC: pal.floor });
  interior(P, pal, a + 1, a + 2, -3, -3, { noWin: true });
  band(P, pal, -7, 1, w, { frame: pal.north });
  const shape = pickRoof(c, pal, w);
  roof(P, pal, shape, -8, -1, w, { attic: true });
  if (hasChim) chimney(P, pal, gx0, -8);
  return P.done();
}

/* ---- public buildings ------------------------------------------------------- */
function genHall(c) {
  const pal = palette(c), w = c && c.pop < 12 ? 13 : 13 + 2 * rint(0, c && c.pop < 30 ? 1 : 3), P = Plot(w), ih = 4; P.style = pal.S.key; P.floor = pal.floor; P.path = pal.path; P.base = pal.base;
  ends(P, pal, w, ih, { lantern: false });
  P.set(0, -2, "hz_lantern", null, { late: 1 }).set(w - 1, -2, "hz_lantern", null, { late: 1 });
  band(P, pal, -ih, 2, w, { frame: pal.north });
  const mid = Math.floor(w / 2);
  P.set(3, 0, "hz_hearth").set(w - 4, 0, "hz_chest");
  // tapestries (faction colour) hang on the back wall between the windows
  for (let x = 5; x <= w - 6; x += 4) P.set(x, -2, "hz_interior", null, { flag: 1 }).set(x, -3, "hz_interior", null, { flag: 1 });
  interior(P, pal, 1, w - 2, 0, -(ih - 1), { dark: 0.58 });
  let top;
  if (pal.north) {
    top = roof(P, pal, w >= 15 ? "gambrel" : "gable", -ih - 2, -1, w, { attic: true });
    // carved crossed beams ("dragon heads") at the ridge, banner pole on top
    P.set(mid - 1, top - 1, "hz_beam", C(pal.frame)).set(mid + 1, top - 1, "hz_beam", C(pal.frame)).set(mid - 2, top - 2, "hz_beam", C(pal.frame)).set(mid + 2, top - 2, "hz_beam", C(pal.frame));
    P.set(mid, top - 1, "hz_beam", C(pal.frame)).set(mid, top - 2, "hz_beam", C(pal.frame)).set(mid, top - 3, "hz_beam", C(pal.frame));
    P.set(mid + 1, top - 3, "hz_banner", null, { flag: 1 }).set(mid + 1, top - 4, "hz_cloth", null, { flag: 1 }).set(mid + 2, top - 4, "hz_cloth", null, { flag: 1 }).set(mid, top - 4, "hz_gold", C("#e2b33c"));
    chimney(P, pal, 3, -ih - 2);
  } else {
    // flat cornice wings and a gilded dome on a drum in the middle
    for (let x = -1; x <= w; x++) P.set(x, -ih - 2, "hz_plaster", C(pal.trim));
    for (let x = 0; x < w; x += 2) P.set(x, -ih - 3, "hz_plaster", C(pal.wall, 0.96));
    const dr = 3, dl = mid - dr, drr = mid + dr;
    for (let x = dl; x <= drr; x++) { P.set(x, -ih - 3, x === dl || x === drr ? "hz_plaster" : (x - dl) % 2 ? "hz_window" : "hz_plaster", C((x - dl) % 2 && x !== dl && x !== drr ? pal.glass : pal.wall)); P.set(x, -ih - 4, "hz_plaster", C(pal.trim)); }
    top = roof(P, pal, "dome", -ih - 4, dl - 1, drr + 1, {});
    for (let y = -ih - 3; y >= -ih - 5; y--) P.set(1, y, "hz_beam", C("#6c4f30"));
    P.set(1, -ih - 6, "hz_banner", null, { flag: 1 }).set(2, -ih - 6, "hz_cloth", null, { flag: 1 }).set(2, -ih - 5, "hz_cloth", null, { flag: 1 }).set(1, -ih - 7, "hz_gold", C("#e2b33c"));
  }
  return P.done();
}
function genWorkshop(c, kind) {
  const pal = palette(c);
  const spec = {
    forge: { w: rint(7, 10), stoneWall: true, furn: [[2, "hz_anvil"], [4, "hz_forgefire"]], chim: 4, roof: pal.north ? "gable" : "flat", open: "left" },
    bakery: { w: rint(6, 9), furn: [[2, "hz_mill"], [4, "hz_oven"]], chim: 4, roof: pal.north ? "steep" : "low", open: "left" },
    hospital: { w: rint(9, 11), furn: [[2, "hz_cot"], [4, "hz_cot"], [6, "hz_cot"]], roof: pal.north ? "gable" : "flat", white: true },
    barracks: { w: 11, stoneWall: true, gate: true, furn: [[2, "hz_rack"], [3, "hz_dummy"], [5, "hz_dummy"], [7, "hz_bed"], [8, "hz_bed"]], roof: pal.north ? "gable" : "flat", banner: true },
  }[kind];
  const w = spec.w, P = Plot(w); P.style = pal.S.key; P.floor = pal.floor; P.path = pal.path; P.base = pal.base;
  if (spec.white) pal.wall = pal.north ? "#f4f4f0" : "#fbf8f2";
  ends(P, pal, w, 3, { stoneWall: spec.stoneWall, gate: spec.gate, open: spec.open });
  band(P, pal, -3, 1, w, { stoneWall: spec.stoneWall, frame: pal.north && !spec.stoneWall });
  for (const f of spec.furn) if (f[0] < w - 1) P.set(f[0], 0, f[1]);
  if (kind === "hospital") for (let x = 8; x < w - 1; x += 2) P.set(x, 0, "hz_cot");
  interior(P, pal, 1, w - 2, 0, -2, { wallC: spec.stoneWall ? pal.stone : pal.wall, dark: spec.stoneWall ? 0.7 : 0.62 });
  const top = roof(P, pal, spec.roof, -4, -1, w, {});
  if (spec.chim) chimney(P, pal, spec.chim, -4);
  if (kind === "hospital") { const cx = Math.floor(w / 2), t = P.top(cx); P.set(cx, t - 1, "hz_medcross").set(cx, t - 2, "hz_medcross").set(cx - 1, t - 2, "hz_medcross").set(cx + 1, t - 2, "hz_medcross").set(cx, t - 3, "hz_medcross"); }
  if (spec.banner) { const t = P.top(5); P.set(5, t - 1, "hz_banner", null, { flag: 1 }).set(6, t - 1, "hz_cloth", null, { flag: 1 }); }
  return P.done();
}
function genMarket(c) {
  const pal = palette(c), w = 7, P = Plot(w); P.style = pal.S.key; P.path = pal.path; P.base = pal.base;
  const wood = pal.north ? "#6c4f30" : "#8a6440";
  for (const x of [0, w - 1]) for (let y = 0; y >= -3; y--) P.set(x, y, "hz_plinth", C(wood, 0.95));       // walk-through posts
  const stripe = [FAC[c ? c.fac : 0].flag, pal.north ? "#f3eee2" : "#fbf6ec"];
  for (let x = -1; x <= w; x++) P.set(x, -4, "hz_cloth", C(stripe[(x + 2) % 2]), { late: 0 });              // striped awning
  for (let x = 0; x < w; x += 2) P.set(x, -5, "hz_cloth", C(stripe[0], 0.9));
  P.set(-1, -3, "hz_cloth", C(stripe[1])).set(w, -3, "hz_cloth", C(stripe[1]));
  P.set(1, 0, "hz_chest").set(3, -3, "hz_stall", null, { flag: 1 }).set(w - 2, 0, "hz_beam", C("#7a4e24"));   // crates & barrel
  return P.done();
}
function genWell(c) {
  const pal = palette(c), P = Plot(4); P.style = pal.S.key; P.base = pal.base; P.path = pal.path;
  P.set(0, 0, "hz_stone", C(pal.stone)).set(1, 0, "hz_well").set(2, 0, "hz_well").set(3, 0, "hz_stone", C(pal.stone));
  const wood = pal.north ? "#5a3d28" : "#8a6440";
  for (const x of [0, 3]) for (let y = -1; y >= -3; y--) P.set(x, y, "hz_plinth", C(wood));
  P.set(1, -2, "hz_plinth", C("#6b6f78")).set(2, -2, "hz_plinth", C("#3a3a3a"));                               // winch & bucket rope
  for (let x = -1; x <= 4; x++) P.set(x, -4, "hz_roof", C(pal.north ? pal.roof : pick(pal.S.roof)));
  P.set(1, -5, "hz_roof", C(pal.roof, 0.92)).set(2, -5, "hz_roof", C(pal.roof, 0.92));
  return P.done();
}
function genTower(c) {
  const pal = palette(c), P = Plot(3); P.style = pal.S.key; P.base = pal.base; P.path = pal.path;
  P.set(0, 0, "hz_gate", C(pal.door)).set(0, -1, "hz_gate", C(pal.door)).set(2, 0, "hz_gate", C(pal.door)).set(2, -1, "hz_gate", C(pal.door));
  for (let y = -2; y >= -7; y--) { P.set(0, y, "hz_stone", C(pal.stone, y % 2 ? 0.95 : 1.04)).set(1, y, y === -4 ? "hz_window" : "hz_stone", C(y === -4 ? pal.glass : pal.stone)).set(2, y, "hz_stone", C(pal.stone, y % 2 ? 1.04 : 0.95)); }
  for (let x = -1; x <= 3; x++) P.set(x, -8, "hz_stone", C(pal.stone, 0.9));
  P.set(1, -9, "hz_post");
  P.set(-1, -9, "hz_stone", C(pal.stone)).set(3, -9, "hz_stone", C(pal.stone));                               // merlons
  P.set(3, -10, "hz_cloth", null, { flag: 1, late: 1 });
  return P.done();
}
function genWall(c) {
  const pal = palette(c), P = Plot(2); P.style = pal.S.key; P.base = pal.base; P.path = pal.path;
  for (let x = 0; x < 2; x++) { P.set(x, 0, "hz_gate", C(pal.door)).set(x, -1, "hz_gate", C(pal.door)); for (let y = -2; y >= -5; y--) P.set(x, y, "hz_stone", C(pal.stone, (x + y) % 2 ? 0.94 : 1.04)); }
  P.set(0, -6, "hz_stone", C(pal.stone));
  return P.done();
}

/* ---- town decoration -------------------------------------------------------- */
function genLamp(c) {
  const pal = palette(c), P = Plot(1); P.style = pal.S.key;
  const metal = pal.north ? "#2b2b30" : "#3a2f28";
  P.set(0, 0, "hz_lamppost", C(metal)).set(0, -1, "hz_lamppost", C(metal)).set(0, -2, "hz_lamppost", C(metal)).set(0, -3, "hz_lantern");
  return P.done();
}
function genGarden(c) {
  const pal = palette(c), w = rint(2, 4), P = Plot(w); P.style = pal.S.key;
  const fl = subset(pal.flowers, 2);
  for (let x = 0; x < w; x++) {
    P.set(x, 0, "hz_flower", C(rnd() < 0.3 ? "#3f8f2a" : pick(fl)));
    if (rnd() < 0.35) P.set(x, -1, "hz_flower", C(pick(fl), 1.05));                                             // taller blooms
  }
  if (w >= 3 && rnd() < 0.5) { const x = rint(0, w - 1); P.set(x, -1, "hz_flower", C("#3f8f2a")).set(x, -2, "hz_flower", C("#f4c430")); }   // a sunflower
  return P.done();
}
function genFountain(c) {
  const pal = palette(c), w = 5, P = Plot(w); P.style = pal.S.key; P.floor = pal.path; P.path = pal.path; P.base = pal.base;
  for (let x = 0; x < w; x++) P.set(x, 0, x === 0 || x === w - 1 ? "hz_plinth" : "hz_spray", x === 0 || x === w - 1 ? C(pal.stone) : null);
  P.set(2, -1, "hz_plinth", C(pal.stone)).set(1, -2, "hz_plinth", C(pal.stone)).set(2, -2, "hz_plinth", C(pal.stone)).set(3, -2, "hz_plinth", C(pal.stone));
  P.set(2, -3, "hz_spray").set(2, -4, "hz_spray").set(1, -3, "hz_spray").set(3, -3, "hz_spray").set(0, -2, "hz_spray").set(4, -2, "hz_spray");
  return P.done();
}
function genStatue(c) {
  const pal = palette(c), w = 3, P = Plot(w); P.style = pal.S.key; P.path = pal.path; P.base = pal.base;
  const hero = c && (c.hero || c.founder) || "the Founder";
  for (let x = 0; x < w; x++) { P.set(x, 0, "hz_plinth", C(pal.stone)); P.set(x, -1, "hz_plinth", C(pal.stone, 0.95)); P.set(x, -2, "hz_plinth", C(pal.trim === "#2f5fa8" ? pal.stone : pal.trim)); }
  const m = pal.S.statue, o = { nm: hero };
  P.set(1, -3, "hz_statue", C(m), o).set(1, -4, "hz_statue", C(m, 1.05), o).set(1, -5, "hz_statue", C(m, 1.08), o).set(1, -6, "hz_statue", C(m, 1.12), o);
  P.set(0, -5, "hz_statue", C(m), o).set(2, -5, "hz_statue", C(m), o).set(2, -6, "hz_statue", C(m), o).set(2, -7, "hz_gold", C("#f0c75a"));  // raised torch
  return P.done();
}
Object.assign(BLUEPRINTS, {
  hut: genHut, house: genCottage, townhouse: genTownhouse, hall: genHall, market: genMarket, well: genWell,
  forge: (c) => genWorkshop(c, "forge"), bakery: (c) => genWorkshop(c, "bakery"), hospital: (c) => genWorkshop(c, "hospital"), barracks: (c) => genWorkshop(c, "barracks"),
  tower: genTower, wall: genWall, lamp: genLamp, garden: genGarden, fountain: genFountain, statue: genStatue,
});
Object.assign(BUILD_NAMES, { townhouse: "a townhouse", lamp: "a street lamp", garden: "a flower garden", fountain: "a fountain", statue: "a statue" });
Object.assign(MAJOR_BUILD, { fountain: 1, statue: 1 });
const DECOR = { lamp: 1, garden: 1, fountain: 1, statue: 1 };
H2.DECOR = DECOR;

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

/* ======================================================================
   TRADE: merchant caravans between settlements
   ----------------------------------------------------------------------
   Merchants (job "merchant") run caravans: they load surplus goods from
   their colony, walk to a partner settlement's market/hall, sell at the
   partner's prices and buy what their home town lacks, then return and
   deposit the goods and profits. Frequent trade quietly eases tension
   between the two factions (trade agreements).
   Shares the single mod scope with the other parts, so internal helpers
   (colById, updateEconomy, stationsOf, setTask, goTo, chronicle, life...)
   are called directly.
   ====================================================================== */

// goods a caravan can move (bread is tradable here even though it is not a
// "carry" good counted by the jobs module)
const TRADE_GOODS = ["wood", "stone", "iron", "grain", "bread", "herbs"];
const TRADE_CARRY = 10;            // a caravan's load limit
const TRADE_CD = DAY;              // minimum ticks between a merchant's caravans

H2.trade = { routes: [], pairs: {}, stats: { caravans: 0, sold: 0, bought: 0, coin: 0 } };

// how low a stock can get before the town is "short" of that good (wants to buy)
function lowT(c, g) {
  const pop = Math.max(2, c.pop || 2);
  if (g === "bread") return Math.ceil(pop * 1.5);
  if (g === "grain") return Math.ceil(pop * 1.2);
  if (g === "wood") return 16;
  if (g === "stone") return 10;
  if (g === "iron") return 3;
  if (g === "herbs") return 1;
  return 4;
}
// how much a town keeps back (never sells below this)
function keepT(c, g) {
  const pop = Math.max(2, c.pop || 2);
  if (g === "bread") return Math.ceil(pop * 1.4);
  if (g === "grain") return Math.ceil(pop * 1.1);
  if (g === "wood") return 18;
  if (g === "stone") return 10;
  if (g === "iron") return 3;
  if (g === "herbs") return 1;
  return 3;
}
function priceOf(c, g) { const p = c.price && c.price[g]; return p !== undefined ? p : (BASE_PRICE[g] || 2); }
function partnerNeed(o, g) { return o ? Math.max(0, lowT(o, g) - (o.stock[g] || 0)) : 0; }

// the spot where outsiders do business: a market stall, else the hall, else the centre.
// snap to a standable ground cell so goTo can actually arrive.
function tradeSpot(o) {
  const m = H2.nearestOf(stationsOf("market", o, 180), o.x, o.y, 400);
  if (m) { const gy = groundY(m.x, 2, height - 3); return { x: m.x, y: gy > 2 ? gy : accY(m) }; }
  if (o.hall) return { x: o.hall.x, y: o.hall.y };
  const gy = groundY(o.x, 2, height - 3);
  return { x: o.x, y: gy > 2 ? gy : o.y };
}

// choose the best settlement to trade with (same faction always; a rival only
// in peacetime and while relations are not openly hostile)
function pickPartner(c) {
  let best = null, bs = 0;
  for (const o of H2.cols) {
    if (o === c || o.nomad || (o.pop || 0) <= 0) continue;
    if (o.fac !== c.fac) {
      if (H2.war && H2.war.on) continue;
      if ((c.tension || 0) >= 3 && !H2.truce) continue;
    }
    const d = Math.abs(o.x - c.x);
    if (d < 22) continue;                         // that's basically the same town
    let sc = 0;
    for (const g of TRADE_GOODS) {
      const theirShort = Math.max(0, lowT(o, g) - (o.stock[g] || 0));
      const ourSurplus = Math.max(0, (c.stock[g] || 0) - keepT(c, g));
      sc += Math.min(theirShort, ourSurplus) * (BASE_PRICE[g] || 2);           // we can sell
      const ourShort = Math.max(0, lowT(c, g) - (c.stock[g] || 0));
      const theirSurplus = Math.max(0, (o.stock[g] || 0) - keepT(o, g));
      sc += Math.min(ourShort, theirSurplus) * (BASE_PRICE[g] || 2) * 0.8;      // we can buy
    }
    sc -= d * 0.05;
    if (o.fac !== c.fac) sc *= 0.7;               // trading with a rival is riskier / less certain
    if (sc > bs) { bs = sc; best = o; }
  }
  return bs > 6 ? best : null;
}

/* ---- the merchant's decision -------------------------------------------- */
H2.shouldTrade = function (p, c) {
  if (!c || c.nomad) return false;
  if (p.caravan && p.caravan.active) return true;                 // resume an interrupted caravan
  if (isNight()) return false;
  if (c.war && (c.war.state === "siege" || c.war.state === "attack")) return false;
  if (pixelTicks - (p.lastTrade === undefined ? -TRADE_CD * 2 : p.lastTrade) < TRADE_CD) return false;
  const tp = pickPartner(c);
  if (!tp) return false;
  p._tpid = tp.id;
  return true;
};

/* ---- caravan mechanics --------------------------------------------------- */
function loadCaravan(p, c, o) {
  let cap = TRADE_CARRY;
  const order = TRADE_GOODS.slice().sort((a, b) => partnerNeed(o, b) - partnerNeed(o, a));
  for (const g of order) {
    if (cap <= 0) break;
    const surplus = Math.floor(Math.max(0, (c.stock[g] || 0) - keepT(c, g)));
    if (surplus <= 0) continue;
    const want = Math.min(surplus, cap, (o ? Math.ceil(partnerNeed(o, g)) : 0) + 3);
    if (want > 0) { c.stock[g] -= want; p.inv[g] = (p.inv[g] || 0) + want; p.caravan.carried[g] = (p.caravan.carried[g] || 0) + want; cap -= want; }
  }
}
function doTrade(p, c, o, cv) {
  // sell what we carried
  for (const g of TRADE_GOODS) {
    const q = p.inv[g] || 0; if (!q) continue;
    const price = Math.max(1, priceOf(o, g));
    const pay = Math.min(q * price, Math.floor(o.stock.coin || 0));
    const qSold = Math.min(q, Math.floor(pay / price));
    if (qSold > 0) {
      o.stock[g] = (o.stock[g] || 0) + qSold; o.stock.coin -= qSold * price;
      p.inv[g] -= qSold; p.coin += qSold * price; cv.coin += qSold * price; cv.sold += qSold;
    }
  }
  // buy what our home is short of
  for (const g of TRADE_GOODS) {
    const ourShort = Math.max(0, Math.ceil(lowT(c, g) - (c.stock[g] || 0)));
    if (ourShort <= 0) continue;
    const theirSurplus = Math.floor(Math.max(0, (o.stock[g] || 0) - keepT(o, g)));
    if (theirSurplus <= 0) continue;
    const price = Math.max(1, priceOf(o, g));
    const qty = Math.min(ourShort, theirSurplus, Math.floor(p.coin / price), TRADE_CARRY);
    if (qty > 0) {
      o.stock[g] -= qty; o.stock.coin += qty * price;
      p.coin -= qty * price; p.inv[g] = (p.inv[g] || 0) + qty; cv.bought += qty;
    }
  }
  try { updateEconomy(o); updateEconomy(c); } catch (e) {}
  // trade eases tension on both sides
  o.tensionPts = Math.max(0, (o.tensionPts || 0) - 2);
  c.tensionPts = Math.max(0, (c.tensionPts || 0) - 2);
  recordAgreement(c, o);
  if (cv.sold + cv.bought > 0) life(p, "Sold goods in " + o.name, "");
  H2.trade.stats.caravans++; H2.trade.stats.sold += cv.sold; H2.trade.stats.bought += cv.bought; H2.trade.stats.coin += Math.round(cv.coin);
  if (cv.sold + cv.bought > 0) {
    chronicle(nm(p) + " of " + c.name + " traded with " + o.name + " (" + cv.sold + " sold, " + cv.bought + " bought).", false, c.fac);
    H2.trade.routes.push({ from: c.name, to: o.name, day: dayNumber(), t: pixelTicks, sold: cv.sold, bought: cv.bought, coin: Math.round(cv.coin), fac: c.fac });
    if (H2.trade.routes.length > 24) H2.trade.routes.shift();
  }
}
function recordAgreement(c, o) {
  const key = Math.min(c.id, o.id) + "-" + Math.max(c.id, o.id);
  const n = H2.trade.pairs[key] = (H2.trade.pairs[key] || 0) + 1;
  if (c.fac !== o.fac) {
    c.tensionPts = Math.max(0, (c.tensionPts || 0) - 3);
    o.tensionPts = Math.max(0, (o.tensionPts || 0) - 3);
    if (n === 4) chronicle("Growing trade binds " + c.name + " and " + o.name + " — tensions ease between the " + FAC[c.fac].name + " and " + FAC[o.fac].name + ".", true, c.fac);
  }
}
function depositCaravan(p, c, cv) {
  for (const g of TRADE_GOODS) { const q = p.inv[g] || 0; if (q) { c.stock[g] = (c.stock[g] || 0) + q; p.inv[g] = 0; } }
  const net = p.coin - (cv.startCoin === undefined ? p.coin : cv.startCoin);
  if (net > 0) { const toTown = Math.floor(net * 0.8); c.stock.coin = (c.stock.coin || 0) + toTown; p.coin -= toTown; if (p.coin < 0) p.coin = 0; }
  p.lastDep = pixelTicks;
}
function finishCaravan(p) { p.lastTrade = pixelTicks; p.caravan = null; }

TASKS.trade = function (p, t) {
  const c = colById(p.col); if (!c || c.nomad) return "done";
  let cv = p.caravan;
  if (!cv || !cv.active) {
    const o = colById(p._tpid) || pickPartner(c);
    if (!o) return "done";
    cv = p.caravan = { active: true, to: o.id, from: c.id, t0: pixelTicks, phase: 0, sold: 0, bought: 0, coin: 0, carried: {}, startCoin: p.coin };
  }
  if (pixelTicks - cv.t0 > DAY * 3 && cv.phase < 3) cv.phase = 3;     // overall timeout: head home
  let o = colById(cv.to);
  if ((!o || (o.pop || 0) <= 0) && cv.phase < 3) { cv.phase = 3; o = null; }

  if (cv.phase === 0) {                                           // gather goods at home
    const spot = tradeSpot(c);
    const r = goTo(p, spot.x, spot.y, 4, 8);
    if (r === "arrive" || r === "fail" || pixelTicks - cv.t0 > 150) { loadCaravan(p, c, o); cv.phase = 1; cv.t1 = pixelTicks; }
    return;
  }
  if (cv.phase === 1) {                                           // travel to the partner
    if (!o) { cv.phase = 3; return; }
    const spot = tradeSpot(o);
    const r = goTo(p, spot.x, spot.y, 4, 8);
    if (r === "arrive") cv.phase = 2;
    else if (r === "fail") { cv.f = (cv.f || 0) + 1; if (cv.f > 30) cv.phase = 3; }
    else if (pixelTicks - cv.t1 > DAY * 2) cv.phase = 3;        // could not get there in time
    return;
  }
  if (cv.phase === 2) { doTrade(p, c, o, cv); cv.phase = 3; cv.t3 = pixelTicks; return; }

  // phase 3: return home and deposit
  const hx = c.hall ? c.hall.x : c.x, hy = c.hall ? c.hall.y : c.y;
  const r = goTo(p, hx, hy, 4, 8);
  if (r === "arrive" || r === "fail" || pixelTicks - (cv.t3 || cv.t0) > DAY * 2) {
    depositCaravan(p, c, cv);
    finishCaravan(p);
    return "done";
  }
};

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

/* ======================================================================
   REGISTRATION & MAIN LOOP
   ====================================================================== */
function doorsTick() {
  const d = H2.doors; if (!d.length) return;
  for (let i = d.length - 1; i >= 0; i--) {
    const r = d[i];
    if (pixelTicks < r.t) continue;
    if (!inb(r.x, r.y)) { d.splice(i, 1); continue; }
    if (!elements[r.el]) { d.splice(i, 1); continue; }
    const o = pixelMap[r.x][r.y];
    if (!o) { createPixel(r.el, r.x, r.y); const n = pixelMap[r.x][r.y]; if (n) { n.hzb2 = 1; const k = r.keep || r; for (const key in k) if (key !== "x" && key !== "y" && key !== "el" && key !== "t" && key !== "w" && key !== "keep") n[key] = k[key]; } d.splice(i, 1); }
    else if (!isPerson(o) && kindOf(o) !== 1 && !(o.element === r.el)) { d.splice(i, 1); }       // something else was built/fell here
    else if (o.element === r.el) { d.splice(i, 1); }
    else { r.t = pixelTicks + 8; r.w = (r.w || 0) + 1; if (r.w > 900) d.splice(i, 1); }
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
