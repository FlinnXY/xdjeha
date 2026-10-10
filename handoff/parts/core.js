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
