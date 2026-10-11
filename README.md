# Sandboxels Humanitize 2

A full rewrite and expansion of the **Humanitize.js** mod by **nekonico** for [Sandboxels](https://sandboxels.r74n.com/).
Drop a settler band onto the sandbox. They found a village, raise families, farm, mine, trade and build towns in their faction's own architecture. Then they expand into new settlements, elect leaders, train armies and go to war.

## Installation

1. Open Sandboxels → **Mods** → *Add mod* and paste this URL:

   ```
   https://cdn.jsdelivr.net/gh/FlinnXY/xdjeha@main/Humanitize2.js
   ```

   To pin a fixed version, use a commit hash instead of `main`, e.g. `https://cdn.jsdelivr.net/gh/FlinnXY/xdjeha@<commit>/Humanitize2.js`.
   jsDelivr caches `@main` for up to 12 h. To get an update right away, purge it at `https://purge.jsdelivr.net/gh/FlinnXY/xdjeha@main/Humanitize2.js`.
2. **Disable the original `Humanitize.js`.** Humanitize 2 replaces it. If both are loaded, a warning appears in the Help panel.
3. Reload the page. Every element is in the **Villagers** category.

## Quick start

| Element | What it does |
|---|---|
| `azure_party` / `crimson_party` | A band of settlers (two founding couples and more) that founds a village where you drop it |
| `azure_villager` / `crimson_villager` | A single villager who joins the nearest settlement of their faction |
| `event_festival`, `event_trader`, `event_bandits`, `event_plague` | God tools: trigger an event at the nearest settlement |

For the best results, give them a wide map with flat ground, some trees, stone underground and water nearby. Put the two factions at opposite ends.

## Features

### Villagers
- Each villager has a name, sex, age (child → adult → elder), traits, skills and experience.
- Needs: hunger, thirst, energy, mood and warmth, plus health and blood.
- Families, friendships, courtship, marriage, pregnancy and births. Grief, funerals and widowhood.
- **Life story.** Every person keeps a timeline of their achievements: birth, first job, marriage, children, buildings helped, battles, kills, medals, promotions, elections, exile and death. Open it in the inspector.
- Villagers slip past each other in crowds but never stand on the same spot. They space out on their own.
- A BFS pathfinder handles ladders, **stairs** (walk up, down, or behind them), doors and building interiors.

### Economy
- Jobs: farmer, woodcutter (fells trees and replants groves), miner (surface rock plus a terraced quarry; earth makes bricks), smith, builder, doctor, merchant and soldier. Jobs are reassigned by need.
- Stores of wood, stone, iron, grain, bread, powder and coin. Wells, farms with crops, and food from aChefsDream when it is installed.

### Architecture & settlements
- **Two faction styles.** Azure builds Nordic timber halls with steep roofs. Crimson builds Mediterranean stone with flat and tiled roofs. Both use their own palettes, trims, banners and decorations.
- Every building comes from a blueprint with **random variation**: width, height, roof shape, windows, chimneys and flower boxes. No two houses look the same.
- Interiors have shaded back walls (they sit in shadow) and furniture drawn slightly brighter so it stands out. Villagers walk through any pixel inside a house.
- Building types: houses, farms, wells, workshops, markets, granaries, halls, training yards with dummies, towers, walls, palisades, gates and moats. Decorations include lamps, banners, fences, benches, gardens and statues.
- **Expansion.** When a town is full, pioneers found new settlements (outposts). Each faction supports up to **500 members** across any number of settlements. A large map is needed to reach that: the default canvas fits two small towns (roughly 15–25 villagers in total). For big civilisations, choose a large canvas size and enable **Settings → Limitless** (Sandboxels caps the pixel count at about 13,800 by default, and houses, fields and people all count).

### Trade & events
- Markets set prices from supply and demand. Merchants carry goods and coin between settlements, and buy food when stores run low.
- Random world events, rare at first and tuned so they never wipe out a young colony:
  - harvest festivals (mood and relationships)
  - wandering traders
  - bandit raids (the town defends itself)
  - plague (contagious, treated by doctors, death toll capped)

### War, the military & government
- Tension between the factions escalates through **peace → wary → fortify → prepare → war → siege**. Scouts gather intelligence, and envoys can negotiate peace.
- **Leaders & elections.** Each settlement elects a leader every six days or when the leader dies. Azure leaders are Chieftain or High Jarl; Crimson leaders are Consul or Doge. The leader's temperament (hawk, dove or pragmatist) drives policy.
- **Hierarchy.**
  - Azure ranks: Recruit → Huscarl → Veteran → Sergeant → Captain → Marshal.
  - Crimson ranks: Tiro → Legionary → Veteran → Optio → Centurion → Legate.
  - Soldiers serve in squads of archers, infantry and musketeers. Officer posts are capped, and the best soldier becomes Marshal or Legate.
- **Soldier life.** Training yards, sparring, daily pay, medals (Campaign Medal, Defender's Cross), promotions, retirement as elders, and military funerals.
- **Strategy.** A war council chooses one of:
  - attackers: assault, lightning raid (loot and run), patient siege, or archer harassment
  - defenders: drill, hold the walls, sally out, arm a militia, or shelter civilians in the hall

  Morale can break and rout an army.
- **Weapons & defences.** Swords, spears, bows, **fire arrows**, rifles, siege cannons, **sapper powder charges** (or thrown bombs from the weapons mod), and rocks dropped from towers. Walls, palisades, towers and moats protect the towns. Civilians form bucket lines to put out fires.

### Interface
- **HUD:** day and time, populations, settlements and war status.
- **Inspector:** tap a villager to see their full card and scrollable life story. Tap family names to jump between people.
- **🏰 Factions dashboard:** leaders, stores, buildings, armies and a population graph.
- **📜 Chronicle:** the running history of the world. Filter it by faction or by major events.
- **⚙️ Settings** (saved in your browser): villager names (off / hover / always), selection outline, random events, births, war, expansion, max people per faction (≤ 500) and town size.
- **❓ Help:** an overview of every feature and a list of detected mods.

## Compatibility

Humanitize 2 detects these mods and integrates with them when they are present. It works without them too.
- **building** — slabs and roofs count as walkable ground.
- **weapons** — sappers throw its bombs.
- **aChefsDream** — villagers pick and eat its apples.
- **chem, nousersthings, glow, zoom, debrisable, death_count, elementsManager, …** — detected and listed in Help. No conflicts.

The mod does not overwrite any vanilla element. Every element it adds starts with `hz_`.

## Development

The mod is built from `handoff/parts/*.js`:

```
cd handoff && bash build.sh                    # → Humanitize2.js (root and handoff/)
cd handoff/harness && npm install
SANDBOXELS_SRC=/path/to/sandboxels/src node t15.js 16000   # two-colony growth run
SANDBOXELS_SRC=... node t_war.js     # war end-to-end
SANDBOXELS_SRC=... node t_ui.js      # UI layer
SANDBOXELS_SRC=... node t_events.js  # trade & events
SANDBOXELS_SRC=... node t_perf.js    # performance
SANDBOXELS_SRC=... node t20.js       # stuck detector
SANDBOXELS_SRC=... node t_ladder.js  # quarry ladders / climbing
SANDBOXELS_SRC=... node t_house.js [up]  # crowded townhouse: thirsty villager gets out
SANDBOXELS_SRC=... node t_big.js 30000 450   # growth & expansion on a large map
```

These harnesses run the real Sandboxels engine headlessly in jsdom.

## Credits

The original **Humanitize.js** is by **nekonico**. Humanitize 2 is a rewrite that builds on its ideas.
