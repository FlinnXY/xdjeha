
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
