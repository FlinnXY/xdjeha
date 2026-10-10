# Sandboxels Humanitize 2 Mod

A rewrite of nekonico's *Humanitize.js* for [Sandboxels](https://sandboxels.r74n.com): two factions (Azure and Crimson) found villages, farm, chop, quarry stone, build faction-styled houses with furnished interiors, raise families and go to war.

> **Status: work in progress.** Survival, building and war are in place, but long-run colony growth is still being tuned (see *Known issues*).

## Installation
1. In Sandboxels open **Mods** and add:
   `https://cdn.jsdelivr.net/gh/FlinnXY/xdjeha@main/Humanitize2.js`
2. **Disable the old `Humanitize.js`** first – both mods define the same villager elements.
3. Reload, then place an `azure_party` and a `crimson_party` (category *villagers*) on solid ground, far apart.

## Development
- Source lives in `handoff/parts/*.js`; build with `cd handoff && bash build.sh` (copies the result to `Humanitize2.js`).
- Headless test: `cd handoff/harness && SANDBOXELS_SRC=<sandboxels>/src node t15.js 16000`.

## Known issues
- On small maps, building sites can be blocked by the quarry pit and trees, so settlements may stall at around 6 villagers.
- Crimson settlements can run short of stone, and some villagers still die of thirst on long walks to water.
- Not yet implemented: military ranks and elections, life histories, trade and events, and the full inspector UI.
