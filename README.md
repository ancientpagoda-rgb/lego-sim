# LEGO Sim — 5986 Amazon Ancient Ruins

Browser-based LEGO-world simulation centered on **5986-1 Amazon Ancient Ruins** (1999 Adventurers / Jungle).

## V0.4 — 420-transform digital twin phase

The complete V0.3 scene remains playable, but V0.4 changes the definition of completion: the target is now a **420/420 regular-part digital twin**.

Every regular inventory occurrence receives a deterministic ledger slot. A placement only counts as **instruction-exact** when its part/color, position (or local subassembly transform), orientation, attachment reference and instruction-page provenance are resolved. Photo-aligned reconstruction does not count toward the exact total.

Current ledger state:

- **420** regular-part inventory slots
- **179** individually positioned regular parts
- **21** instruction-exact transforms
- **158** positioned reconstruction transforms waiting to be replaced
- **241** inventory slots not yet positioned
- **399** exact transforms remaining

Open `twin-status.html` (or use the **Exact twin** button in the simulation HUD) for a live coverage dashboard generated from the current inventory and model chunks.

## Full-set scene already present

- 32×48 raised-baseplate world and river corridor
- multilevel main temple
- bridge gateway
- collapsing brown suspension bridge and spider web
- opposite-bank statue / ruby / trapdoor area
- expedition boat and four-wheel car
- all 8 included minifigures
- crocodile, snakes, spiders, scorpion, bat and parrot stand-ins
- palms, jungle foliage, torches, Sun Disc, ruby and tools
- `Run traps` control
- orbit, ground and overhead cameras
- breakable structural connection graph

## Transform pipeline

```text
data/5986-inventory.csv
        │
        ▼
420 deterministic inventory slots
        │
        ├── instruction-exact
        ├── positioned-reconstruction
        └── unpositioned
        │
        ▼
scripts/transform-ledger.mjs
        │
        ▼
CI validation + twin-status.html
```

The source index in `data/5986-instruction-sources.json` records the official LEGO manual/PDF, the 44-page image mirror, captured pages and the provenance rules used during transcription.

## Run locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Validation

```bash
npm run check
```

The check now validates JavaScript syntax, inventory limits, assembly coverage, unique part ids, transform shape, the 420-slot ledger and the exact-transform count.

To generate a full JSON ledger locally:

```bash
npm run ledger
```

## Architecture

```text
index.html
  simulation HUD + Exact twin link
twin-status.html
  live 420-part transform coverage dashboard
src/
  main.js             scene, minifigs, animals, controls, trap simulation
  brick-engine.js     reusable part proxies, connections, break physics
  twin-status.js      browser-side ledger/coverage calculation
data/
  5986.json                       scenario metadata / coverage
  5986-model.json                 model manifest and exact-completion policy
  5986-instruction-sources.json   manual provenance index
  5986-parts-*.json               positioned regular-part chunks
  5986-inventory.csv              420-part inventory boundary
scripts/
  validate-model.mjs              inventory + assembly validation
  transform-ledger.mjs            deterministic 420-slot exact-transform ledger
```

## Sources and provenance

The transform source of truth is the LEGO building instruction sequence. BrickLink's inventory is used to define the 420 regular-part ledger and to prevent part/color overuse. Published headline piece totals differ across databases, so those totals are not used to infer transforms.

This is a fan-made simulation prototype and is not affiliated with or endorsed by the LEGO Group.
