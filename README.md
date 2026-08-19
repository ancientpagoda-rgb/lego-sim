# LEGO Sim — 5986 Amazon Ancient Ruins

Browser-based LEGO-world simulation centered on **5986-1 Amazon Ancient Ruins** (1999 Adventurers / Jungle).

## V0.5 — bulk 420-transform solver

The complete scene remains playable, but the reconstruction pipeline has moved from hand-entered batches to a bulk solver designed around the **420 regular-part inventory ledger**.

A placement only counts as **instruction-exact** when its part/color, position (or local subassembly transform), orientation, attachment reference and captured instruction-page provenance are resolved. Photo-aligned or CAD-only geometry never increases the exact count.

Current ledger state:

- **420** regular-part inventory slots
- **184** individually positioned regular parts
- **32** instruction-exact transforms
- **152** positioned reconstruction transforms waiting to be replaced
- **236** inventory slots not yet positioned
- **388** exact transforms remaining
- **9 / 44** manual pages captured
- **4** manual pages currently contributing exact transforms

### Bulk geometry cross-check

The repository records the community **LEGO Digital Designer 4.3.8** reconstruction by `penguinz` as a secondary geometry source. It is useful for solving candidate transforms quickly, but it is deliberately non-authoritative because its author documented substitutions for the raised baseplate and Sun Disc plus missing/incorrect decorations.

`scripts/ldd-import.mjs` parses an `.lxf` or raw `IMAGE100.LXFML`, extracts LDD design IDs, material IDs and transform matrices, and normalizes translations into LEGO-stud units. Imported data is candidate geometry only.

```bash
npm run ldd:import -- /path/to/secret_jungle_temple.lxf --write
```

### Source-integrity guardrails

V0.5 uses three independent checks:

1. `transform-ledger.mjs` — deterministic 420-slot inventory/transform ledger.
2. `page-ledger.mjs` — 44-page manual provenance ledger; exact tags cannot reference uncaptured pages.
3. `source-integrity.mjs` — CAD/digital-model provenance cannot masquerade as exact, and every instruction-exact part must carry an explicit local `instructionTransform`.

The earlier gateway/bridge batch has now been backfilled with explicit local transforms, so it satisfies the same rule as the newer expedition-car batch.

### Captured instruction batches

Current captured pages include the set overview, character/animal assembly reference, expedition car pages 7–8, raised-temple stages around pages 20 and 22, temple completion page 24, and bridge/gateway pages 28 and 30. Capturing a page does **not** automatically promote its parts; unresolved pages remain `captured-pending` until each transform is solved.

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
Official instruction pages ───────┐
                                  │ provenance gate
Community LDD model ── candidate ─┤
                                  ▼
BrickLink inventory ───────► 420 deterministic slots
                                  │
                         ┌────────┼────────┐
                         ▼        ▼        ▼
                  instruction  positioned  unpositioned
                     exact     reconstruction
                         │
                         ▼
                  CI + Exact Twin dashboard
```

## Run locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Validation

```bash
npm run check
```

Generate the full transform ledger:

```bash
npm run ledger
```

Generate the 44-page provenance ledger:

```bash
npm run page-ledger
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
  5986-instruction-sources.json   manual + LDD provenance index
  5986-parts-*.json               positioned regular-part chunks
  5986-inventory.csv              420-part inventory boundary
scripts/
  validate-model.mjs              inventory + assembly validation
  transform-ledger.mjs            deterministic 420-slot transform ledger
  page-ledger.mjs                 44-page provenance ledger
  source-integrity.mjs            prevents CAD-only exact promotion
  ldd-import.mjs                  optional LXF/LXFML candidate importer
```

## Sources and provenance

The transform source of truth is the LEGO building-instruction sequence. The inventory is used to define the 420 regular-part ledger and prevent part/color overuse. The community LDD model is only a geometric cross-check. Published headline piece totals differ across databases, so those totals are not used to infer transforms.

This is a fan-made simulation prototype and is not affiliated with or endorsed by the LEGO Group.
