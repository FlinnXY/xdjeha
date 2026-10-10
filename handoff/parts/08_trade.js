
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

// the spot where outsiders do business: a market stall, else the hall, else the centre
function tradeSpot(o) {
  const m = H2.nearestOf(stationsOf("market", o, 180), o.x, o.y, 400);
  if (m) return { x: m.x, y: accY(m) };
  if (o.hall) return { x: o.hall.x, y: o.hall.y };
  return { x: o.x, y: o.y };
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
  if (pixelTicks - cv.t0 > DAY && cv.phase < 3) cv.phase = 3;     // overall timeout: head home
  let o = colById(cv.to);
  if ((!o || (o.pop || 0) <= 0) && cv.phase < 3) { cv.phase = 3; o = null; }

  if (cv.phase === 0) {                                           // load at home
    const spot = tradeSpot(c);
    const r = goTo(p, spot.x, spot.y, 3, 5);
    if (r === "fail") { loadCaravan(p, c, o); cv.phase = 1; return; }
    if (r !== "arrive") return;
    loadCaravan(p, c, o); cv.phase = 1; return;
  }
  if (cv.phase === 1) {                                           // travel to the partner
    if (!o) { cv.phase = 3; return; }
    const spot = tradeSpot(o);
    const r = goTo(p, spot.x, spot.y, 3, 6);
    if (r === "fail") { cv.f = (cv.f || 0) + 1; if (cv.f > 12) cv.phase = 3; return; }
    if (r === "arrive") cv.phase = 2;
    return;
  }
  if (cv.phase === 2) { doTrade(p, c, o, cv); cv.phase = 3; return; }

  // phase 3: return home and deposit
  const hx = c.hall ? c.hall.x : c.x, hy = c.hall ? c.hall.y : c.y;
  const r = goTo(p, hx, hy, 3, 6);
  if (r === "arrive" || r === "fail" || pixelTicks - cv.t0 > DAY * 1.6) {
    depositCaravan(p, c, cv);
    finishCaravan(p);
    return "done";
  }
};
