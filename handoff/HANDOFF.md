# Humanitize2.js — handoff to Claude Opus

## Goal (from the user)
Sandboxels (neal.fun/sandboxels, mod loader) player wants nekonico's `Humanitize.js`
(https://github.com/R74nCom/Sandboxels-Mods/blob/main/mods/Humanitize.js) massively improved as a NEW mod
`Humanitize2.js` (credit nekonico), delivered via jsDelivr from the user's own public GitHub repo
(`https://cdn.jsdelivr.net/gh/USER/REPO@main/Humanitize2.js`). Old Humanitize.js must be disabled when using v2.
All integrations with the user's mods must be guarded (`if (elements.x)`).
User's modlist: aChefsDream, chem, weapons, nousersthings, delete_all_of_element, glow, elementsManager,
liquid_mixing, zoom, debrisable, building, death_count, devtests, rich_grain, bettersmoothliquids, spring,
velocity, human_friendly_design, Humanitize. Source: https://github.com/R74nCom/Sandboxels-Mods/tree/main/mods
(also local: /home/claude/engine/src/mods/ if the sandbox still exists).

### Required features
- Realism: health/blood/bleeding, fall damage/broken legs, hunger/thirst, body temperature, sleep/beds/day-night,
  life cycle (child/adult/elder, reproduction w/ inherited traits, natural death, gravestones), professions
  (farmer, woodcutter, miner, baker, merchant, doctor, smith, soldier, guard, scout, builder), farming chain,
  village hub (well, market w/ supply/demand prices, town hall w/ taxes), crime (thieves, guards, stocks),
  mood/friends/rivals/romance, multi-room houses, clothes, disease/immunity, doctor+hospital, inspector tool,
  god events (harvest festival, wandering trader, bandit raid, plague), drama systems (chronicle, heroes,
  star-crossed cross-faction lovers who may defect, envoys, feuds, riots, famine).
- New buildings: smithy, bakery, hospital, barracks, towers, walls, moat, cannons...
- Two spawnable factions (Azure, Crimson), hostile on meeting; first contact -> spotters/scouts, slow realistic
  escalation, defenses (walls, moats, towers, cannons, soldiers), attackers strengthen forces, fog of war.
- Full production-grade UI/UX: toggleable names (off / hover / always), subtle outline on the selected human,
  inspector card per human, per-faction statistics dashboard (population, resources, military, tension...),
  chronicle panel, settings panel. User said: finish simulation first, then UI.

## Current state (files in this folder)
- `parts/*.js` — source, concatenated in filename order by `build.sh` into `Humanitize2.js` (2549 lines, builds OK, no JS errors in sim).
  - 01_core (H2 namespace, cfg, factions, utils, chronicle), 02_elements (blocks, stations, crops, projectiles),
  - 03_person (person physics, vitals, think/utility-AI, basic tasks, hz_body/head/child elements, spawners),
  - 04_colony (census, economy, job assignment, colonyThink), 05_jobs (all job tasks, crime, social, marriage),
  - 06_build (blueprints, site finder, build task, births), 07_war (fog of war, war state machine, projectiles, soldier tasks),
  - 99_end (doors queue, runEveryTick, reset/load hooks).
- `Humanitize2.js` — the built single-file mod.
- `harness/` — jsdom headless test rig (`boot.js`, `sim.js` with `setup()`/`terrain()`, test scripts t1..t24;
  `t15.js` = two-colony long sim, `t20.js` = stuck-person detector, `t23.js` = finds a drinker with repeated path failures).
  Needs `npm i jsdom` and the Sandboxels engine source at /home/claude/engine/src (not included; get from neal.fun
  or the R74nCom repo). Note: sim RNG is not seeded, so runs differ.
- Design: person = body pixel (brain, all state on its properties) + head pixel above (or one `hz_child` pixel).
  Utility-AI `think()` every 10 ticks sets tasks with priorities (`setTask`), `actTick()` runs `TASKS[k]` every 3 ticks.
  DAY = 2400 ticks. Buildings are blueprints (DSL) built cell by cell by builders from colony stock; all buildings
  must be walk-through (doors on both sides) because the world is 2D side-view.

## Known problems (what I was debugging)
1. **Early colony collapse**: in `t15.js` (two colonies, terrain from `sim.terrain`) settlers die of thirst around
   tick 4000–6000 and wood stock stays ~0 (only hall + campfire + well + 1 hut built). Fixes tried: sleep priority
   now yields to thirst (th<12) and drink starts at th<35 (done in 03_person.js think()).
2. **Found root cause candidate (not yet fixed)**: a person inside a hut can't exit through its door when the door's
   base is 1 higher than the interior floor (terrain bump at the door column; e.g. floor y=63, dirt at (34,62), door cells
   at y=60,61). `shift()`/`tryWalk()` step-up (dx,-1) fails there, `goTo` fails repeatedly, so they can't reach the well
   and die of thirst (stuck-person repro: `node t23.js`). Fix ideas: make blueprint placement level doors with the
   floor/flatten the terrain footprint (and door-column ground) in `findSite`/`queuePlan`; allow step-up through doors in
   `shift` (check canEnter for head cell at dy-1); let `clearObstacle` dig the dirt below a door.
3. Wood economy stalls (woodcutters walk far / fail; prioritise chopping when plans are stalled; denser test trees).
4. The war flow has only been verified up to "wary → fortify" (first contact works, fog of war works). Never executed:
   prepare → attack → siege → victory/retreat, cannons/projectiles, plunder, envoys, defecting lovers.

## Not yet written
- Merchant trade: `H2.shouldTrade`, `TASKS.trade` (referenced in 05_jobs but undefined).
- Events part: harvest festival, wandering trader, bandit raid, plague, god-event spawner elements, events toggle.
- Inspector tool (`hz_inspect`), the entire UI layer (name labels via `renderPostPixel`, selection outline, inspector card,
  stats dashboard, chronicle panel, settings, `H2.hoverText` default nameMode 'hover'), integrations with the user's mods
  (weapons.js bullets, aChefsDream foods, chem.js, death_count `announceDeath`, etc.), README with jsDelivr instructions,
  compatibility tests with the user's whole mod stack.

## Prompt to give Claude Opus
> You are taking over a partly finished Sandboxels mod, `Humanitize2.js` (an improved, heavily extended rewrite of
> nekonico's Humanitize.js; keep credit to nekonico). Read `HANDOFF.md` fully, then the files in `parts/`, and build with
> `bash build.sh`. Use the jsdom harness in `harness/` to test headlessly (install jsdom, point it at the Sandboxels engine
> source).
> Order of work: (1) fix the early-colony survival bugs listed under "Known problems" (start with the door/floor-level
> exit bug and the wood/well economy) until `t15.js` shows two colonies growing (houses, beds, births, jobs) for 16000
> ticks with no JS errors; (2) test and fix the full war flow end to end; (3) write merchant trade and the events
> system; (4) write the complete UI/UX layer (names off/hover/always, subtle selection outline, inspector card, per-faction
> stats dashboard, chronicle panel, settings, mobile-friendly); (5) add guarded integrations with the user's mods
> (list in HANDOFF.md) and test the combined stack; (6) deliver the final single-file `Humanitize2.js` plus a README with
> jsDelivr loading instructions (user pushes to own public GitHub repo; URL
> `https://cdn.jsdelivr.net/gh/USER/REPO@main/Humanitize2.js`) and a note to disable the old Humanitize.js.
> Rules: no new bugs, guard every cross-mod reference with `if (elements.x)`, never use globals that may not exist,
> wrap risky hooks in try/catch, keep all code inside one IIFE with the `window.H2` namespace, and verify every claim by
> running the simulation rather than assuming.
