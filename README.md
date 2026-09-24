# Wildkeep

A 2D pixel-art fantasy RPG / incremental adventure that runs in the browser.
Chop and forage in the woods, mine stone, coal and iron, smelt and craft, sell
your haul in the village, upgrade your house, dive into procedurally generated
dungeons, and occasionally lose it all at the tavern's Blackjack table — all
under a day/night cycle that ends with you asleep in your own bed.

## Running it

```bash
npm install
npm run dev       # dev server (http://localhost:5173)
npm run build     # typecheck + production build
npm run preview   # serve the production build
npm run lint      # oxlint
```

Default controls (all remappable in **Settings → Controls**, see
`game/input/bindings.ts`): **WASD / arrows** move · **Shift** run (costs
stamina) · **Space / J / click** attack (tap for a combo; **hold** for a
charged heavy blow; with a bow equipped it shoots) · **F / right-click** dodge
· **V** parry · **R** Whirlwind (talent) · **X** Spark (once you've learned
magic) · **E** interact (Shift+E on a garden plot picks the seed; E strikes
while fishing) · **G** gift · **Q** potion · **I / Tab** bag · **C** character
sheet · **K** skills & talents · **L** journal · **M** world map · **H** help ·
**Esc** menu. English / Español from Settings.

## The loop

Title screen → New Game (3 save slots) → a short intro and a guided first day,
with contextual help cards the first time you meet each system (all rereadable
under **H**). Then the loop:

wake up → gather in the **Whisperwood** / **Deepwood** / **Ancient Grove**
(procedural, regrow every day) → dig down the **Old Mine** (a new cave every
trip, better ore every few floors, lift stops every 5) → smelt and craft →
forge better tools and gear → push deeper into **the Depths** (endless floors,
guardians, a boss + checkpoint every 5) → sell, upgrade the house → Blackjack or
the Wheel of Fates at the tavern → sleep → new day. **L** opens the journal with
short/medium/long goals, records and the collection.

Systems at a glance (v0.0.6, "RPG depth" pass):

- **Combat** (`data/combat.ts`, `engine/entities/Enemy.ts`): stamina (attacks
  and dodges spend it — spamming leaves you winded and unable to dodge),
  hold-to-charge heavy attacks that break guards, perfect dodges → ripostes,
  weapon families (sword / dagger / maul / spear / bow) with their own reach,
  arc, speed, combo and damage type. Enemies telegraph every attack on the
  ground (lunge wedge, slam circle, charge lane, aim line), have patterns
  (combo, slam, charge — stuns itself on walls —, volley, summon, heal,
  explode), weaknesses/resistances (blunt/slash/pierce, silver vs undead),
  shields (hit them from behind), cowards that flee, attack tokens (only a
  couple wind up at once; the rest circle), elite affixes (swift, armored,
  vampiric, frenzied, explosive, shielded) and boss phase two.
- **Depth**: gentler HP curve; difficulty comes from new specialists
  (shieldbearers, berserkers, powder goblins), encounter mixes, affixed
  elites, trap plates and per-floor twists (`floorMutator`: gloom, horde,
  champions' hall, trapped halls, hoard).
- **Progression**: slower XP curve fed by kills, quests, discoveries, depth
  records, crafting, gathering, hunting and skill level-ups (`grantXp`); a
  30-node talent tree in five branches (`data/talents.ts`), a bonus point every
  fifth level, quest talent points, respec for gold.
- **Loot & economy** (`game/systems/lootSystem.ts`): gear drops are a rarity
  roll first (depth, luck and Golden Touch tilt it), chests hold materials
  not swords, bosses have their own uniques (`ItemDef.uniqueFrom`), epic and
  legendary drops get a light pillar. Second-hand gear sells for 35%, goods
  60%; less gold from monsters and chests; dearer shop and forge.
- **Quests** (`data/quests.ts`, `game/quests.ts`): data-driven stages (kill,
  boss, gather, find — placed in the world with guards —, reach, talk with
  choices, hunt, steal, gamble, craft, harvest, drink), offered in NPC
  dialogue (! / ? markers), journal tab, HUD tracker, guide arrow, and a daily
  notice board of contracts.
- **Farming** (`game/farming.ts`, `data/crops.ts`): the garden across from
  your cottage (unlocked by Hob; more plots per house level): plant, water
  (3×3), grow on watered days, harvest; seeds at Bella's stall; crop dishes.
- **Hunting**: herds bolt together; rare quarry (golden stag, white hare, old
  tusker) with trophies that craft into gear.
- **Relationships** (`data/relationships.ts`, `game/relationships.ts`): gifts
  (loves / likes / hates, learned by trying), friendship tiers, rewards and
  lasting perks at 40 / 80.
- **Reputation** (`game/social/reputation.ts`): Honor plus Village / Watch /
  Underworld standing; bounties Guard Bryn collects; returning stolen goods;
  Finn fences.
- **Tavern** (`game/tavern/drink.ts`): tipsiness with real effects (luck,
  liquid courage, swaying, blur) and a morning-after story if you pass out.
- **Town happenings** (`engine/world/happenings.ts`): arguments, a shell-game
  hustler, a pickpocket chase, arm-wrestling; market day every 7th day.
- **Introduction** (`data/tutorial.ts`): your first days told by the
  villagers — Bram's lost shipment teaches the whole loop.

- **Camera** (`engine/Camera.ts`): real world camera — smooth follow with a
  small look-ahead, clamped to `Area.viewBounds`. Outdoor maps are wrapped in
  a decorative surround (`Outdoor.finish`) so the player stays centred right
  up to the playable edge without the camera ever showing the void; interiors
  and caves clamp at their walls.
- **Player** (`engine/entities/Player.ts`): one state machine (free / attack /
  shoot / gather / hurt / dodge / dead) that alone picks the animation, with
  hard time limits so nothing gets stuck. Sword combo on the `pierce` sheet
  (sword in hand), slash arcs, hit-stop, poise-aware knockback; dodge with
  i-frames. Worn gear shows on the character: tinted mask layers generated by
  `tools/build_player.py` (armour, boots, helmet, blade / tool head).
- **Social** (`game/social/`, `store/socialStore.ts`): Honor (−100 menace …
  +100 hero) changes prices and dialogue; petty theft (`crime.ts`) with
  witnesses and stolen-flagged items honest shops won't buy; friendship per
  NPC (journal → People); one random **world event** a day (`data/worldEvents.ts`:
  travelling merchant, festival, orc strike, tavern brawl, storm, golden
  glow, escaped pig, mystery boxes).
- **NPCs** (`data/npcs.ts`, `game/npcs.ts`): personality, rotating lines,
  night lines, reactions to Honor and today's event, gossip about your
  deaths / losses / thefts, mysterious absences, feuds, and ambient barks
  (speech bubbles, `engine/BarkDirector.ts`). Some dungeon monsters are
  tavern regulars off duty.
- **Animals & hunting** (`data/animals.ts`, `engine/entities/Animal.ts`):
  rabbits, deer, foxes, boars (and Duchess the pig). They flee (sooner if
  you run), charge, or get curious. Bow → aim → arrow (`Projectile.ts`) →
  meat / hide / feathers / antlers.
- **Localization** (`src/i18n/`): `t("inventory.title")` for UI text (keys
  type-checked; `es.ts` must match `en.ts`), content helpers
  (`itemName(id)`, `npcTalk(def)`…) for game text whose English source stays
  in the data files. Spanish is written, not transliterated. The language is
  a device setting (localStorage), switchable live.

- **Depth** (`data/dungeonFloors.ts`, `data/mineFloors.ts`): difficulty,
  loot and ore tiers come from formulas + depth bands, not hand-made floors.
  Gear (not just level) decides how deep you can comfortably go; the gate
  shows how dangerous a floor is for you.
- **Procedural generation** (`game/procgen/`, `game/dungeon/`): pure
  functions from (seed, depth, rules) to data — `generateDungeon`,
  `generateCave`, `generateForest` — rendered by the engine. Same seed, same
  world; dungeon runs show their seed in the HUD. Permanent progress (levels,
  skills, house, checkpoints, discoveries) never resets.
- **Resources & crafting** (`data/items.ts`, `data/resourceNodes.ts`,
  `data/recipes.ts`): wood → hardwood → ancient wood; stone, coal, iron,
  copper, silver, gold, mithril; herbs → healroot → moonpetal (night only).
  Recipes are categorised per station (bench, smelter, forge, kitchen).
- **Skills** (`data/skills.ts`): Strength, Defense, Mining, Woodcutting,
  Gathering, Luck, Gambling — each levels from use.
- **Casino** (`game/casino/`): Blackjack and the Wheel of Fates are state
  machines independent of React (stakes taken once, payouts once, no stale
  clicks); both keep a house edge. Gambling level raises table limits and
  unlocks the wheel (Lv 3) and the back room (Lv 5, double limits). New games
  plug in through `game/casino/registry.ts`.
- **Shop** (`engine/world/areas/interiors.ts` `buildShop`): Mira's store is a
  real room — walk in, talk to her at the counter, buy / sell. Worn gear,
  key items, stolen goods and your best tool of each kind are never sold by
  accident; rare gear asks twice.
- **NPCs** (`data/npcs.ts`): data-driven dialogue that rotates between visits,
  night lines, opening hours (shops close at night, the tavern fills up).
- **Time** (`game/time/clock.ts`): one clock, 20 real minutes per day.
- **Tutorial** (`data/tutorial.ts`, `game/tutorial.ts`): `showTutorial(topic)`
  for contextual cards + a guided first-day objective chain.
- **Music** (`game/audio/musicDirector.ts`): unchanged — area themes override
  day/night, with resuming crossfades.
- **Debug** (`npm run dev` only): press **`** (backquote) for gold/XP/skills,
  material kits, teleports, floor jumps, seed regeneration and time controls.

## v0.0.7 — "RPG depth, world expansion, UX polish"

- **Input** (`game/input/bindings.ts`, `engine/Input.ts`): gameplay reads
  *actions* (`input.held("sprint")`, `input.pressed("parry")`), never keys.
  Bindings live in settings (only overrides are stored); rebinding swaps a
  taken key; mouse buttons are codes (`mouse0`); a gamepad can add `pad:*`
  codes later. Text can say `{k:map}` and shows the player's current key
  (`i18n/index.ts interpolate`, also item and quest text).
- **World map** (M, `ui/panels/MapPanel.tsx`): a procedurally painted
  pixel-art map (`ui/map/drawWorldMap.ts`, 256×160 scaled up) with fog over
  the unknown, roads, and regions from `data/world.ts` (visited / open /
  rumoured / hidden, activity tags). A second sheet plans Wildkeep itself
  (`data/townMap.ts` — keep in step with `areas/town.ts`). New regions = one
  entry in `REGIONS`.
- **HUD**: big HP bar with icon, stamina, mana (after magic), level/XP,
  status chips (rested, tipsy, exhausted, bounty), energy under the clock,
  honor badge → character sheet; hotbar keys follow the bindings. The
  always-on control list is gone.
- **Combat**: parry (V) — only red-telegraphed attacks (lunges, combos,
  arrows) can be parried; amber ones (slams, charges, blasts) must be dodged
  (`PARRYABLE` in `data/enemies.ts`, `PARRY` in `data/combat.ts`). A parry
  staggers, opens a riposte and deflects arrows back; a whiff leaves you
  exposed. Running costs stamina; stamina starts at 75 and grows with level,
  Endurance and gear (`ItemDef.stamina`).
- **Durability** (`game/systems/durability.ts`): gear wears with use (weapon
  per landed swing, armour per hit, tools per work swing), degrades stats in
  steps, never breaks away. Repairs at Bram's (talk, or the mending bench;
  `ui/panels/RepairPanel.tsx`), whetstones and repair kits in the field.
- **Energy** (`game/systems/vitals.ts`): the day's budget for hard work
  (chop, mine, dig, water, fish, delve). Sleep refills it; meals
  (`ItemDef.energy`) give some back; at zero work is slow, not blocked.
- **Talent tree** redesigned as a node graph (`ui/panels/SkillsPanel.tsx`,
  `TalentDef.col`), six branches incl. **Magic** (sealed until learned), with
  new nodes for parry, sprinting, fishing, durability and energy.
- **Farming tools**: hoe tills (sometimes a worm), watering can holds 20
  (refill at water barrels, `engine/world/waterSpots.ts`); watering and
  fishing use the Pixel Crawler watering / fishing animations
  (`tools/build_player.py`).
- **Fishing** (`game/fishing.ts`, Player `fish` state, `engine/entities/Lake.ts`):
  cast at any open water, wait for the bite, strike in time; rod tier, bait,
  night and the Angler talent change the catch.
- **New places**: Mirror Lake (south; Marit and her quests), the Crooked
  Tower (west; clues, the star-lock quest, Ysolde → magic + Spark), and Lower
  Wildkeep (`areas/townSouth.ts`: Chapel Lane, the shrine and alms box, the
  Hunter's Lodge with Garrick, a training yard whose dummies swing back for
  parry practice, the pig pen) with six new villagers and quests.
- **Character sheet** (C, `ui/panels/CharacterPanel.tsx`): stats, gear
  condition, and Honor / reputation explained (what it changes, what moves it).
- **Quests**: the journal lists quests on offer from people you've met — a
  "not now" is never lost.
- **Spanish**: full pass — one glossary (trasgo, EXP, aguante, misión vs
  encargo, fragua, Rueda del Destino), no gendered address to the player,
  live key names instead of hardcoded ones.

Save format v6 (energy, wear, stack durability, watering can, fish caught);
v5 saves that already had the garden get a hoe and a can.

## Architecture

```text
tools/            Python asset pipeline (reads the raw packs in Assets/)
public/           curated game assets produced by the pipeline
src/
  data/           content as data: items, enemies, resource nodes, recipes,
                  skills, house levels, tutorial steps, shops, areas, music
                  mapping, generated/assets.json (sprite metadata)
  game/           rules with no rendering: rng, save/load + migration,
                  dungeon generator, combat/loot/stat/skill/economy/blackjack
                  math, time of day, event bus, tutorial driver, cross-store
                  actions, audio manager + music director (+ synthesized SFX)
  store/          Zustand: player, inventory, world (+ permanent progress),
                  dungeon run, mine expedition, town, time, tutorial, ui,
                  settings
  engine/         PixiJS runtime (no React)
    Game.ts       app, loop, area switching, interaction, death/respawn
    Camera.ts     integer-zoom follow camera (crisp pixels on any screen)
    Collision.ts  cell grid + rects, axis-separated movement with corner nudge
    Schedules.ts  NPC daily routines (town spots / tavern / home)
    fx/           particles + floating text, darkness/light overlay
                  (world-pixel light buffer, flares, window glow),
                  fireflies
    entities/     Player, Enemy (AI state machine), ResourceNode, Chest,
                  Pickup, Npc, Prop, InteractSpot, villager (paper-doll
                  looks + archetypes)
    world/        Area, autotiled Terrain, and one builder per area
                  (+ encounters.ts: forest life, merchants, wild enemies;
                  dungeonRooms.ts: trap/rest/merchant/secret/camp rooms)
  ui/             React overlay: HUD, minimap, toasts, loot reveals, panels
```

Key ideas:

- **One pixel grid.** World units are source pixels (16px tiles). The camera
  picks the largest integer zoom that shows ~480×280 world pixels, so every
  asset pack shares the same crisp grid at any resolution.
- **Collision is data, not pixels.** Buildings, trees and props register
  explicit feet-boxes; interiors use an authored 8px collision grid; dungeons
  use their generated tile grid.
- **Draw order by feet.** Entities are y-sorted by the point they stand on;
  tall things turn see-through when the player walks behind them.
- **The engine doesn't know React exists.** UI and gameplay talk through
  Zustand stores (e.g. `worldStore.requestTravel()`).
- **Rendering is static by default.** Scenery is built once per area and
  never rebuilt; flat decals are baked into the ground texture; off-screen
  entities are culled with half a screen of margin so nothing pops in.
  Always size screen-space things from `app.screen` (CSS pixels): HiDPI
  screens once got a quarter-sized camera from dividing by the resolution.
- **Lighting.** A multiply buffer at one texel per world pixel, aligned to
  the world grid. Outdoors it follows the clock; underground it's properly
  dark and your lantern is your vision. Lit windows and lamp flares are
  drawn *over* the darkness (`Area.glow`, `Lighting.flares`).
- **Content is data.** A new enemy = sprite strips in `tools/build_assets.py`
  + an entry in `src/data/enemies.ts`. A new area = a builder in
  `src/engine/world/areas/` + one line in `areas.ts`.

## Assets

Raw packs live in `Assets/` (gitignored): Pixel Crawler (Anokolisa), Raven
Fantasy Icons (Clockwork Raven), and the UI packs. `python3 tools/build_assets.py`
(Pillow required) regenerates everything in `public/` plus
`src/data/generated/assets.json`:

- composes building exteriors from the modular wall/roof/door/window kit
- flattens the tavern mockup `.aseprite` without its NPC layers into the tavern
  and cottage interiors, and derives their collision grids
- paints clothing onto the bare `Body_A` character and writes tintable
  equipment masks (`tools/build_player.py`)
- draws the woodland animals from shapes, since no pack has any
  (`tools/build_animals.py`)
- exports mob/NPC strips with per-animation foot anchors
- splits the villager body into tintable layers + procedural accessories
  (hats, hoods, beards, aprons, capes, helmets) for varied townsfolk
  (`tools/build_villagers.py`)
- turns the AI concept sheets in `Assets/*Assets/` into real pixel sprites:
  each object is isolated from the packed sheet, shrunk onto its true pixel
  grid with a majority filter, palette-cleaned and outlined
  (`tools/ai/sheet.py`). Enemies (`tools/build_ai_enemies.py`, 22 creatures
  and bosses as idle/run/death strips) and decoration props
  (`tools/build_ai_props.py`, `d_*` props). The NPC and "various" sheets
  have no animation frames, so NPC variety comes from the villager system
  instead (the NPC sheet served as the archetype reference).
- writes night window glows from each building's glass pixels
- crops props, icons (32px for UI, 16px for world drops) and UI frames

## Audio

Music lives in the `MUSIC/` folder at the project root and is bundled by Vite.
Tracks are matched to themes by a keyword in the filename (case-insensitive):
`main`, `tavern`, `dungeon`, `night` — so `MAIN THEME.mp3` or
`night-theme.ogg` both work (`src/data/audio.ts`). `AudioManager` plays them on
master/music/sfx buses; `musicDirector` decides which one. Sound effects are
synthesized until files are listed in `SFX_FILES`.

Saves are in `localStorage`, three slots (`wildkeep-save-1..3`, format v5 —
older saves migrate field by field): player, skills, inventory (with stolen
flags), equipment (incl. head + boots), gold, house level, trunk, world
position, regrow timers, day + time, depth records and checkpoints, bosses,
discoveries and collection, tutorial progress, Honor, friendships, deeds and
today's event, talents (optional field; older saves start with none), bonus
talent points, quests, garden plots, reputation / bounty / tipsiness.
Settings (volume, language, tutorial tips) live separately in
`wildkeep-settings`.

Fonts are self-hosted in `public/fonts` (SIL OFL): Pixelify Sans for text,
with Jersey 10 supplying digits and spaces ("WK Digits" in `index.css`) so
3/6/8/9 are always distinguishable — in the UI and in world text alike.

## Roadmap hooks

Not built yet, but the seams are there:

- **Character creation / appearance**: the player sprite is body + tinted
  mask layers; hair/clothes colours and a second body are pipeline changes in
  `tools/build_player.py` plus a look record in the save.
- **Classes, magic, weapon upgrades**: combat goes through `COMBO`,
  `CombatSystem.playerStrike` and `Projectile`; `ItemDef.ammo` already marks
  ranged weapons.
- **Quests, romance, rivalries**: `NpcDef.lines` (situational dialogue),
  `NpcDef.romanceable` / `feud`, `socialStore.relationships[id].status`, and
  the `gameEvents` bus for objectives.
- **Farming & seasons**: `RelicEffects.cropGrowthBonus`, day rollover in
  `App.tsx` (where world events roll), and per-biome rules in `data/biomes.ts`.
- **Crime & consequences**: `crime.ts` (witness checks, stolen flags) is the
  place for fences, guards and bounties.
- **More casino games**: see `game/casino/registry.ts`.
