# LEGO Sim — 5986 Amazon Ancient Ruins

Browser-based LEGO-world simulation centered on **5986-1 Amazon Ancient Ruins** (1999 Adventurers / Jungle).

## V0.5.1 — bulk 420-transform solver

The complete scene remains playable, but reconstruction now uses a bulk solver around the **420 regular-part inventory ledger**.

A placement only counts as **instruction-exact** when its part/color, position (or local subassembly transform), orientation, attachment reference and captured instruction-page provenance are resolved. Photo-aligned or CAD-only geometry never increases the exact count.

Current exact ledger:

- **420** regular-part inventory slots
- **184** individually positioned regular parts
- **32** instruction-exact transforms
- **152** positioned reconstruction transforms waiting to be replaced
- **236** inventory slots not yet positioned
- **388** exact transforms remaining
- **9 / 44** manual pages inspected/indexed
- **4** manual pages currently contributing exact transforms

### Working LDD geometry cross-check

The repository records the community **LEGO Digital Designer 4.3.8** reconstruction by `penguinz` as a secondary geometry source. Its documented raised-baseplate and Sun-Disc substitutions plus missing/incorrect decorations mean it is deliberately non-authoritative.

The GitHub cross-check job now fetches the LXF temporarily and parses it without committing the third-party model. The fixed importer extracts **969 / 969 transformation matrices**. A small persisted summary currently reconciles **241 / 420 inventory units** across **102 part/color keys**. Those 241 are geometry candidates, not instruction-exact parts.

Only `data/5986-ldd-summary.json` is retained by the automated job; it contains aggregate reconciliation counts rather than the LXF or its full transform list.

```bash
npm run ldd:import -- /path/to/secret_jungle_temple.lxf
```

Use `--write` only for a local candidate dump. Use `--summary-out <path>` to write counts-only reconciliation data.

### Source-integrity guardrails

V0.5.1 uses three independent checks:

1. `transform-ledger.mjs` — deterministic 420-slot inventory/transform ledger.
2. `page-ledger.mjs` — 44-page manual provenance ledger; exact tags cannot reference uninspected pages.
3. `source-integrity.mjs` — CAD/digital-model provenance cannot masquerade as exact, every instruction-exact part must carry an explicit local `instructionTransform`, and the persisted LDD file must remain non-authoritative summary data.

The earlier gateway/bridge batch has explicit local transforms, so it satisfies the same rule as the expedition-car batch.

### Captured instruction batches

Indexed pages currently include the set overview, character/animal assembly reference, expedition car pages 7–8, raised-temple stages around pages 20 and 22, temple completion page 24, and bridge/gateway pages 28 and 30. Capturing a page does **not** automatically promote its parts; unresolved pages remain pending until each transform is solved.

The Exact Twin dashboard links all 44 manual pages, while its colors distinguish uninspected pages from indexed pages and pages already supplying exact transforms.

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
Official instruction pages ─────────────┐
                                        │ provenance gate
Community LDD ── 969 matrices ─ candidate ┤
                                        ▼
BrickLink inventory ─────────────► 420 deterministic slots
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
  live exact / positioned / CAD-cross-check coverage dashboard
src/
  main.js             scene, minifigs, animals, controls, trap simulation
  brick-engine.js     reusable part proxies, connections, break physics
  twin-status.js      browser-side ledger/coverage calculation
data/
  5986.json                       scenario metadata / coverage
  5986-model.json                 model manifest and exact-completion policy
  5986-instruction-sources.json   manual + LDD provenance index
  5986-ldd-summary.json           counts-only CAD reconciliation summary
  5986-parts-*.json               positioned regular-part chunks
  5986-inventory.csv              420-part inventory boundary
scripts/
  validate-model.mjs              inventory + assembly validation
  transform-ledger.mjs            deterministic 420-slot transform ledger
  page-ledger.mjs                 44-page provenance ledger
  source-integrity.mjs            prevents CAD-only exact promotion
  ldd-import.mjs                  LXF/LXFML candidate importer
```

## Sources and provenance

The transform source of truth is the LEGO building-instruction sequence. The inventory defines the 420 regular-part ledger and prevents part/color overuse. The community LDD model is only a geometric cross-check. Published headline piece totals differ across databases, so those totals are not used to infer transforms.

This is a fan-made simulation prototype and is not affiliated with or endorsed by the LEGO Group.
