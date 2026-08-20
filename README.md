# LEGO Sim — 5986 Amazon Ancient Ruins

Browser-based digital-twin / play simulation of **LEGO 5986-1 Amazon Ancient Ruins** (Adventurers / Jungle, 1999).

## V0.6.1 — geometry rebaseline

The project now treats two questions independently:

1. **Is this inventory occurrence instruction-exact?**
2. **Is the surrounding presentation geometry actually shaped and scaled like the physical set?**

Earlier versions answered the first question increasingly well while still inheriting some rough V0.3 scene geometry. V0.6.1 stops using that old scene as a geometric premise.

Current feature-branch ledger:

- **420** regular inventory slots
- **61** instruction-exact transforms
- **144** positioned reconstruction transforms
- **215** inventory slots not yet positioned
- **359** exact transforms remaining
- **9 / 44** manual pages indexed
- **7** manual pages currently contributing exact transforms
- **350 / 420** inventory units represented by the secondary LDD geometry cross-check
- **24** render-only / disproven visual helpers excluded from the inventory ledger

### Large-geometry audit

`data/5986-geometry-audit.json` is now the presentation-geometry authority for large assemblies.

#### Raised baseplate

The real `30271px1` is a **32 × 48 × 6** raised molded baseplate with four corner pits and the river pattern. The old almost-flat slab plus a few shallow rectangular banks has been retired.

The current scene uses:

- one real inventory `30271px1` shell at the channel floor;
- 22 `terrain-mold` visual helpers to form side plateaus and four corner pits;
- explicit ledger exclusions for every helper, so they consume **zero** of the 420 inventory slots;
- the water surface lowered into the molded channel by `src/geometry-rebaseline.js`.

The mold is still intentionally simplified into boxes. Sloped cliff faces, pit contours, and print detail are the next baseplate-fidelity step.

#### Rope bridge

`2549` is **16 × 4 × 3**. The previous `[4,16] + rotation` presentation hit a legacy renderer branch that used the 16-stud dimension as plank width, making the bridge visibly far too wide.

The model now presents it as a 16-stud span × 4-stud width, and the geometry normalization layer canonicalizes any future long-axis bridge input before rendering.

#### Boat

`33129` is **18 × 8 × 3 1/3**. The old 6 × 12 × 1.5 proxy was much too small. It is now represented with an 8 × 18 × 4 world-unit envelope and placed down in the rebaselined river channel.

The procedural box/cone hull is still only an envelope proxy; the real bow, gunwales, and oarlocks remain a geometry-rebuild task.

#### Car

The car is explicitly marked **rebuild required** rather than being silently treated as trustworthy reconstruction.

Hard exact anchors remain:

- 3832 Black 2×10 chassis
- 2× Tan 30157 axle plates
- 4× Light Gray 30155 wheel hubs
- 2× Black 3483 front tires
- 2× Black 2346 rear tires

The questionable body pieces are tagged `presentation-proxy-pending-car-rebuild`. The four Light Gray `32000` pieces have at least been corrected from the old fake 1×6 plate shape to their real **1×2×1 Technic-brick** envelope.

The normalization layer also knows the catalog envelopes for the missing/underrepresented `30149` vehicle base and `30147` grille, and the two tire designs are now rendered as rings instead of solid cylinders.

### Geometry normalization layer

`src/bootstrap.js` loads `src/geometry-rebaseline.js` before `src/main.js`.

The rebaseline layer:

- applies catalog envelopes before `BrickStructure.load()`;
- canonicalizes bridge span/cross-axis data before the legacy bridge renderer sees it;
- anchors all `terrain-mold` helpers;
- rebuilds 3483/2346 tire presentation meshes as toruses;
- lowers the decorative river and ripple meshes into the molded channel;
- catches Reset rebuilds without continuously polling the scene.

This leaves authoritative `instructionTransform` data untouched.

## Full-set exactification solver

The separate exactification pipeline remains active, but further bulk promotion is intentionally gated behind the geometry rebaseline.

`scripts/full-set-solver.mjs` expands the strict inventory into 420 deterministic slots and classifies unresolved occurrences as:

- `geometry-ready-page-blocked`
- `variant-ambiguous-page-blocked`
- `cad-overflow-page-blocked`
- `cad-shortfall`
- `no-cad-match`

CAD alone never increases instruction-exact coverage.

`scripts/ldd-anchor-neighborhoods.mjs` uses already-exact CAD-backed parts as local anchors so one captured instruction step can resolve a mechanism cluster without relying on the old playable scene.

### Recent exact clusters

Page 22 now includes the chain/crank tower cluster around the exact 30104 chain: Yellow 4032 pulley, Blue 3700 connector, unique Dark Gray 30156pb01 printed facade, unique Blue 3009, White/Yellow 3937/3938 hinge pair, and Black 3176 plate-with-hole.

Page 4 contributes the complete three-piece crocodile: Green 6026 body, 6027 upper jaw, and 6028 tail.

The 3937/3938 pair illustrates the correction rule: those inventory occurrences were **relocated** from an old trapdoor proxy when manual + CAD evidence showed where they actually belong; they were not duplicated.

## Evidence hierarchy

```text
LEGO instruction pages ───────────────► exact provenance
BrickLink 420-part inventory ─────────► occurrence boundary
catalog part dimensions ──────────────► presentation envelopes
community LDD ────────────────────────► secondary geometry candidates
old playable scene ───────────────────► presentation hint only
```

A CAD ref already claimed by an instruction-exact occurrence cannot be recycled elsewhere. A visually convenient proxy can be retained only as an explicitly excluded render helper.

## Run

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

Validation:

```bash
npm run check
npm run ledger
npm run page-ledger
```

With the transient full LDD candidate artifact available:

```bash
npm run solver
npm run anchors
```

## Key files

```text
index.html
src/
  bootstrap.js
  main.js
  brick-engine.js
  geometry-rebaseline.js
  twin-status.js
data/
  5986.json
  5986-model.json
  5986-inventory.csv
  5986-instruction-sources.json
  5986-geometry-audit.json
  5986-terrain-geometry.json
  5986-ledger-exclusions.json
  5986-parts-*.json
  5986-ldd-summary.json
  5986-ldd-unique-candidates.json
  5986-ldd-model-matches.json
scripts/
  validate-model.mjs
  transform-ledger.mjs
  page-ledger.mjs
  source-integrity.mjs
  full-set-solver.mjs
  ldd-anchor-neighborhoods.mjs
```

The LEGO instruction sequence is the transform source of truth. Catalog geometry controls large-part dimensions. The community LDD is an acceleration/cross-check source, not a substitute for instructions.

This is a fan-made simulation prototype and is not affiliated with or endorsed by the LEGO Group.
