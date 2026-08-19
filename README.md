# LEGO Sim — 5986 Amazon Ancient Ruins

Browser-based LEGO-world simulation centered on **5986-1 Amazon Ancient Ruins** (1999 Adventurers / Jungle).

## V0.5.4 — upper-temple exactification

The playable full-set scene sits on a strict **420 regular-part transform ledger**. A part counts as **instruction-exact** only when manual provenance and an explicit `instructionTransform` are both present. CAD-only and photo-aligned geometry never counts as exact.

Current ledger:

- **420** regular-part inventory slots
- **191** rendered regular-part shapes
- **189** ledger-positioned regular parts
- **2** disproven visual placeholders excluded from inventory coverage
- **43** instruction-exact transforms
- **146** positioned reconstruction transforms waiting to be replaced
- **231** inventory slots not yet positioned
- **377** exact transforms remaining
- **9 / 44** manual pages indexed
- **6** pages currently contributing exact transforms

### Latest exact promotion — page 24 upper temple

The page-24 spatial reconciliation promotes an eight-transform batch:

- **2× 6126 Trans-Neon Orange flames** — the two occurrences isolated in the high-elevation upper-temple cluster.
- **2× 6091 Light Gray curved slopes** — the curved bodies of the paired gray top fixtures.
- **2× 4081b Light Gray light-attachment plates** — directly above those 6091 records at matching x/z coordinates.
- **2× 3039 Blue slopes** — the crown pair immediately below the final bat placement.

Together with the already locked page-24 bat and palm leaf, these parts give the upper temple a much stronger occurrence-level reconstruction instead of relying on the older presentation layout.

Page 22's **30104 Light Gray chain** remains exact via its instruction step, single inventory occurrence, normalized LDD alias `60169`, and unique matrix.

### A reconstruction error caught and quarantined

The two old **6081 Light Gray** roof shapes turned out to be incorrect part assignments. The real two 6081 CAD records sit at low elevation outside the upper-temple region. Their old roof shapes are therefore still rendered temporarily for visual continuity but are listed in `data/5986-ledger-exclusions.json` and consume **zero** inventory slots.

This gives the project a useful distinction:

- **rendered visual parts** — everything currently drawn in the playable scene;
- **ledger-positioned parts** — only part assignments still considered valid against the 420-part inventory.

A disproven visual proxy can no longer silently occupy a real inventory occurrence.

### CAD geometry cross-check

The community **LEGO Digital Designer 4.3.8** reconstruction by `penguinz` remains secondary evidence only. The automated cross-check parses **969 / 969 transformation matrices** without committing the original LXF.

After normalizing the later chain ID and legacy gray material IDs (`2 → Light Gray`, `27 → Dark Gray`), the CAD model overlaps **350 / 420 inventory units across 144 part/color keys** and exposes **57 one-to-one inventory anchors**. These counts never increase exact coverage by themselves.

Additional filtered reconciliation files now include:

- `data/5986-page24-candidates.json` — the small page-24 roof/decor candidate set;
- `data/5986-upper-temple-candidates.json` — inventory-compatible records from the upper-temple CAD region;
- `data/5986-ledger-exclusions.json` — disproven presentation-only assignments excluded from the inventory ledger.

The full third-party LXF and full 969-record candidate dump remain transient GitHub Actions data.

### Source-integrity guardrails

Validation now checks:

1. `validate-model.mjs` — inventory limits and required assemblies, after ledger exclusions.
2. `transform-ledger.mjs` — deterministic 420-slot ledger with explicit exact/presentation transform separation and visual-placeholder exclusions.
3. `page-ledger.mjs` — exact tags cannot cite an unindexed manual page.
4. `source-integrity.mjs` — CAD-only provenance cannot masquerade as exact; LDD-backed exact records need finite positions, 3×3 orientation matrices, LDD record/design IDs, and may not be excluded from the ledger.

### Captured instruction batches

Indexed pages include the set overview, character/animal reference, expedition car pages 7–8, temple pages 20, 22 and 24, and bridge/gateway pages 28 and 30.

Open `twin-status.html` (or **Exact twin** in the simulation HUD) for the live 420-part coverage dashboard and 44-page transcription map. The dashboard now reports visual-only placeholders separately from real inventory coverage.

## Full-set scene already present

- 32×48 raised-baseplate world and river corridor
- multilevel main temple
- bridge gateway
- collapsing suspension bridge and spider web
- trap platform / ruby / trapdoor area
- expedition boat and four-wheel car
- all 8 included minifigures
- animals, foliage, torches, Sun Disc, ruby and tools
- `Run traps` control
- orbit, ground and overhead cameras
- breakable structural connection graph

## Transform pipeline

```text
Official instruction pages ─────────────┐
                                        │ provenance gate
Community LDD ── 969 matrices ──────────┤ candidate geometry
                                        ▼
BrickLink inventory ─────────────► 420 deterministic slots
                                        │
                      ┌─────────────────┼──────────────────┐
                      ▼                 ▼                  ▼
              instruction exact   reconstruction     unpositioned
                      │
                      └────► exact twin dashboard

Disproven visual proxy ──► render only ──► ledger exclusion
```

## Run locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Validation

```bash
npm run check
npm run ledger
npm run page-ledger
```

## Architecture

```text
index.html
  simulation HUD + Exact twin link
twin-status.html
  exact / positioned / CAD-cross-check / visual-placeholder dashboard
src/
  main.js
  brick-engine.js
  twin-status.js
data/
  5986.json
  5986-model.json
  5986-instruction-sources.json
  5986-inventory.csv
  5986-parts-*.json
  5986-ledger-exclusions.json
  5986-ldd-summary.json
  5986-ldd-model-matches.json
  5986-ldd-unique-candidates.json
  5986-page24-candidates.json
  5986-upper-temple-candidates.json
scripts/
  validate-model.mjs
  transform-ledger.mjs
  page-ledger.mjs
  source-integrity.mjs
  ldd-import.mjs
  ldd-reconcile.mjs
  ldd-unique-inventory.mjs
  ldd-page24-extract.mjs
  ldd-upper-temple-extract.mjs
```

## Sources and provenance

The LEGO building-instruction sequence is the transform source of truth. The inventory defines the 420-part boundary. The community LDD model is only a geometric cross-check and includes known substitutions, so CAD data cannot become exact without matching manual-page evidence.

This is a fan-made simulation prototype and is not affiliated with or endorsed by the LEGO Group.
