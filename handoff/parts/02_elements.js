
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
