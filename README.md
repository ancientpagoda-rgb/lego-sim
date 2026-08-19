# LEGO Sim — 5986 Amazon Ancient Ruins

Browser-based LEGO-world simulation centered on **5986-1 Amazon Ancient Ruins** (1999 Adventurers / Jungle).

## V0.5.2 — temple exactification

The playable full-set scene now sits on top of a strict **420 regular-part transform ledger**. A part only counts as **instruction-exact** when manual provenance and an explicit `instructionTransform` are both present. Photo-aligned or CAD-only geometry does not count.

Current ledger:

- **420** regular-part inventory slots
- **185** individually positioned regular parts
- **33** instruction-exact transforms
- **152** positioned reconstruction transforms waiting to be replaced
- **235** inventory slots not yet positioned
- **387** exact transforms remaining
- **9 / 44** manual pages indexed
- **5** pages currently contributing exact transforms

### Latest exact promotion — page 22

Page 22's hanging chain is now resolved as the set's single **30104 Light Gray** chain. The community LDD model uses later design ID `60169`; the importer normalizes that alternate ID to the 1999 inventory part. LDD material `2` is the legacy Grey used as BrickLink Light Gray, producing one unique candidate matrix. Because page 22 visibly supplies the chain step, this occurrence now satisfies both the manual-provenance and exact-transform requirements.

The ledger also now stores exact `instructionTransform` data separately from the playable scene's `presentationTransform`, preventing a visually convenient world position from being mistaken for the authoritative transform.

### CAD geometry cross-check

The community **LEGO Digital Designer 4.3.8** reconstruction by `penguinz` remains secondary evidence only. The automated cross-check parses **969 / 969 transformation matrices** without committing the original LXF.

After normalizing the later chain ID and the 1999 legacy gray material IDs (`2 → Light Gray`, `27 → Dark Gray`), the CAD model overlaps **350 / 420 inventory units across 144 part/color keys**. It also exposes **57 one-to-one inventory anchors**. None of these numbers automatically increase exact coverage.

Persisted cross-check files are derived reconciliation data:

- `data/5986-ldd-summary.json` — aggregate coverage counts
- `data/5986-ldd-model-matches.json` — non-authoritative matches against current presentation instances
- `data/5986-ldd-unique-candidates.json` — one-to-one inventory anchors and diagnostics

The original third-party LXF is fetched temporarily in GitHub Actions and discarded.

### Source-integrity guardrails

Validation runs through:

1. `validate-model.mjs` — inventory limits and required assemblies.
2. `transform-ledger.mjs` — deterministic 420-slot ledger; exact slots store explicit instruction transforms and presentation transforms separately.
3. `page-ledger.mjs` — exact tags cannot cite an unindexed manual page.
4. `source-integrity.mjs` — CAD-only provenance cannot masquerade as instruction-exact.

### Captured instruction batches

Indexed pages include the set overview, character/animal reference, expedition car pages 7–8, temple pages 20, 22 and 24, and bridge/gateway pages 28 and 30. Page 24 remains captured-pending while its upper-temple transforms are reconciled.

Open `twin-status.html` (or **Exact twin** in the simulation HUD) for the live 420-part coverage dashboard and 44-page transcription map.

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

```bash
npm run ledger
npm run page-ledger
```

## Architecture

```text
index.html
  simulation HUD + Exact twin link
twin-status.html
  exact / positioned / CAD-cross-check coverage dashboard
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
  5986-ldd-summary.json
  5986-ldd-model-matches.json
  5986-ldd-unique-candidates.json
scripts/
  validate-model.mjs
  transform-ledger.mjs
  page-ledger.mjs
  source-integrity.mjs
  ldd-import.mjs
  ldd-reconcile.mjs
  ldd-unique-inventory.mjs
```

## Sources and provenance

The LEGO building-instruction sequence is the transform source of truth. The inventory defines the 420-part boundary. The community LDD model is only a geometric cross-check and includes known substitutions, so CAD data cannot become exact without matching manual-page evidence.

This is a fan-made simulation prototype and is not affiliated with or endorsed by the LEGO Group.
