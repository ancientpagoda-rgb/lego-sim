# LEGO Sim — 5986 Amazon Ancient Ruins

Browser-based LEGO-world simulation centered on **5986-1 Amazon Ancient Ruins** (1999 Adventurers / Jungle).

## V0.4 — 420-transform digital twin phase

The complete V0.3 scene remains playable, but V0.4 changes the definition of completion: the target is now a **420/420 regular-part digital twin**.

Every regular inventory occurrence receives a deterministic ledger slot. A placement only counts as **instruction-exact** when its part/color, position (or local subassembly transform), orientation, attachment reference and instruction-page provenance are resolved. Photo-aligned reconstruction does not count toward the exact total.

Current ledger state:

- **420** regular-part inventory slots
- **184** individually positioned regular parts
- **32** instruction-exact transforms
- **152** positioned reconstruction transforms waiting to be replaced
- **236** inventory slots not yet positioned
- **388** exact transforms remaining

### Latest exact batch — expedition car, pages 7–8

The first post-gateway transcription batch locks the car's black 2×10 chassis plate, the two tan pinned axle plates, all four light-gray wheel hubs, two smaller front tires and two larger rear tires. These parts now carry instruction-page provenance plus local transforms relative to the car subassembly.

This pass also corrected an inventory conflict: the single black 2×10 plate had previously been used as a photo-aligned boat proxy. It is now assigned to the car where the instruction sequence actually uses it.

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
