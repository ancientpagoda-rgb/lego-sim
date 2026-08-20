# LEGO Sim — 5986 Amazon Ancient Ruins

Browser-based LEGO-world simulation centered on **5986-1 Amazon Ancient Ruins** (1999 Adventurers / Jungle).

## V0.6.0 — full-set exactification solver

V0.6 changes the project from page-by-page promotion into one **420-slot full-set solve**. The target is the entire remaining inventory in a single phase, while preserving the same evidence rule: CAD can solve geometry, but only instruction-corroborated occurrences count as exact.

Current branch ledger:

- **420** regular-part inventory slots
- **200** rendered regular-part shapes
- **198** ledger-positioned regular parts
- **2** disproven visual placeholders excluded from inventory coverage
- **52** instruction-exact transforms
- **146** positioned reconstruction transforms waiting to be replaced
- **222** inventory slots not yet positioned
- **368** exact transforms remaining
- **9 / 44** manual pages indexed
- **6** pages currently contributing exact transforms

### One solver for all 420 inventory occurrences

`scripts/full-set-solver.mjs` expands the inventory into 420 deterministic slots and classifies every occurrence in one pass. Non-exact slots fall into explicit buckets rather than an undifferentiated “remaining” number:

- `geometry-ready-page-blocked` — the CAD part/color group is complete but manual provenance still gates promotion;
- `variant-ambiguous-page-blocked` — multiple inventory variants share a base design and cannot be collapsed safely;
- `cad-overflow-page-blocked` — the community model contains more compatible CAD records than the strict regular-part inventory group;
- `cad-shortfall` — fewer compatible CAD records exist than inventory occurrences;
- `no-cad-match` — no compatible CAD geometry is available.

For interchangeable repeated pieces, the solver only assigns an occurrence-level LDD ref when the whole part/color group is reconciled and any already-exact peers have known claimed refs. Otherwise it records the group as geometry-ready while deliberately withholding individual occurrence identity.

The generated audit is intended to live at `data/5986-full-set-solver.json`. The branch workflow is wired to produce it from the transient full LDD candidate artifact, but until that generated file lands the dashboard explicitly reports **solver audit pending** and counts zero unverified bulk promotions.

### LXF structure inspection

`scripts/ldd-structure-inspect.mjs` inspects `IMAGE100.LXFML` for optional building-instruction and grouping metadata. If the community LDD happens to contain step/group structure, that can accelerate assignment of many CAD records to manual stages. It is still secondary evidence: a discovered LDD step/group is not instruction provenance until reconciled to the 44-page manual.

Only tag counts, relevant attribute names, and group-like tag attributes are retained. The LXF body and unresolved third-party transform matrix list remain transient.

### Exact transform #52 — page 22 pulley

The first promotion produced inside the full-set phase is the **Yellow 4032 pulley** in the page-22 chain/crank mechanism.

- manual page 22 step 12 visibly places the yellow pulley beside the hanging chain;
- the already-exact Light Gray 30104 chain is LDD ref `847`;
- the Yellow 4032 candidate is ref `845`, at the same x/y mechanism anchor immediately beside that chain;
- the set inventory contains available Yellow 4032 occurrences and the current model previously used none of them.

That moves the feature branch from **51 → 52 exact transforms** without consuming or reassigning an existing proxy.

### Existing exact anchors remain hard constraints

The prior exact batches are not loosened by the bulk solver. They become hard anchors:

- car pages 7–8;
- temple page 22 chain/crank anchor;
- page-24 upper crown/completion cluster;
- gateway/bridge pages 28 and 30.

The page-30 gateway arch remains a useful conflict example: LDD ref `446` previously appeared inside a raw page-24 coordinate scan, but reconciliation ties it to the instruction-exact `gate-web-arch`. The page-24 extractor therefore rejects it. Raw CAD location can never override established instruction provenance.

### CAD geometry cross-check

The community **LEGO Digital Designer 4.3.8** reconstruction by `penguinz` remains secondary evidence only. The automated cross-check parses **969 / 969 transformation matrices** without committing the original LXF.

After normalizing the later chain ID and legacy gray material IDs (`2 → Light Gray`, `27 → Dark Gray`), the CAD model overlaps **350 / 420 inventory units across 144 part/color keys** and exposes **57 one-to-one inventory anchors**. Those counts describe available candidate geometry; they do not automatically increase exact coverage.

### Reconstruction errors stay quarantined

The two old **6081 Light Gray** roof shapes are disproven part assignments. They remain rendered temporarily for visual continuity but are listed in `data/5986-ledger-exclusions.json` and consume **zero** inventory slots.

This preserves a hard distinction between **rendered visual parts** and **ledger-positioned inventory parts**. A visually convenient proxy cannot silently become part of the digital twin.

### Source-integrity guardrails

Validation now checks:

1. `validate-model.mjs` — inventory limits and required assemblies after ledger exclusions.
2. `transform-ledger.mjs` — deterministic 420-slot ledger with exact/presentation transform separation.
3. `page-ledger.mjs` — exact tags cannot cite an unindexed manual page.
4. `source-integrity.mjs` — CAD-only provenance cannot masquerade as exact; exact LDD refs must be unique; page candidates cannot conflict with exact refs from another page; and any generated full-set solver report must contain exactly 420 unique slots whose exact/remaining totals agree with the live model.

### Exact Twin dashboard

`twin-status.html` now has a **V0.6 full-set solver** panel. When `data/5986-full-set-solver.json` exists it shows:

- geometry-ready but manual-blocked slots;
- slots with occurrence-level CAD refs;
- variant/CAD-overflow ambiguity;
- CAD shortfall or missing geometry.

When the audit is absent it says so explicitly and continues calculating authoritative exact coverage directly from the model files.

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
                     ┌─ official instruction pages ─ provenance ─┐
                     │                                           │
BrickLink inventory ─┼──────────────► 420 deterministic slots    │
       420 parts      │                         │                 │
                     │                         ▼                 │
Community LDD ────────┴─ 969 matrices ─► full-set solver ◄───────┘
                                                │
                       ┌────────────────────────┼──────────────────────┐
                       ▼                        ▼                      ▼
              instruction-exact         geometry/page blocked   CAD ambiguous/missing
                       │
                       ▼
                 Exact Twin dashboard

Existing exact LDD ref ─► hard conflict constraint
Disproven visual proxy ─► render only / ledger exclusion
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

With a transient full LDD candidate file available:

```bash
npm run solver
```

## Architecture

```text
index.html
  simulation HUD + Exact twin link
twin-status.html
  exact / positioned / CAD / full-set-solver / visual-placeholder dashboard
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
  5986-page24-structural-candidates.json
  5986-upper-temple-candidates.json
  5986-full-set-solver.json              # generated when bulk audit succeeds
  5986-ldd-structure-summary.json        # generated metadata-only inspection
scripts/
  validate-model.mjs
  transform-ledger.mjs
  page-ledger.mjs
  source-integrity.mjs
  ldd-import.mjs
  ldd-reconcile.mjs
  ldd-unique-inventory.mjs
  ldd-page24-extract.mjs
  ldd-page24-structural-extract.mjs
  ldd-upper-temple-extract.mjs
  ldd-structure-inspect.mjs
  full-set-solver.mjs
```

## Sources and provenance

The LEGO building-instruction sequence is the transform source of truth. The inventory defines the 420-part boundary. The community LDD model is a geometric cross-check and acceleration source, not a substitute for manual provenance.

This is a fan-made simulation prototype and is not affiliated with or endorsed by the LEGO Group.
