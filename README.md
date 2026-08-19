# LEGO Sim — 5986 Amazon Ancient Ruins

Browser-based LEGO-world simulation centered on **5986-1 Amazon Ancient Ruins** (1999 Adventurers / Jungle).

## V0.3 — full-set scene

The scene now includes the whole playset rather than only the first ruin prototype:

- 32×48 raised-baseplate world and full river corridor
- tall multilevel main temple with the characteristic red/blue/gray banding
- bridge gateway reconstructed from instruction pages 28–30
- collapsing brown suspension bridge and spider web
- opposite-bank statue / ruby / trapdoor area
- brown expedition boat with fittings and gentle river drift
- four-wheel off-road expedition car
- all **8 included minifigures**: Johnny Thunder, Miss Gail Storm, Dr. Charles Lightning, Achu, Gabarro, Señor Palomar, and two skeletons
- crocodile, two snakes, spider, scorpion, bat and parrot stand-ins
- palms, jungle foliage, torches, Sun Disc, ruby and loose expedition tools
- `Run traps` control that drops the bridge and opens the trapdoor
- orbit, ground and overhead camera modes
- structural connection graph: tapping structural parts can break their support path and release unsupported pieces

## Reconstruction status

V0.3 deliberately separates **scene completeness** from **transform certainty**.

- `data/5986-inventory.csv` stores the 172-lot / 420-regular-part BrickLink inventory snapshot used by the validator.
- The six `data/5986-parts-*.json` chunks currently contain **179 individually positioned regular part instances**.
- **21 placements** are explicitly tied to visible instruction pages 28–30.
- The main temple, trap platform, boat and car use the real inventory and published set photographs for an inventory-bounded reconstruction while the remaining manual pages are transcribed.
- No placement is labeled as an exact instruction transform unless it has an instruction-page provenance tag.

This means the current page looks and behaves like the complete set, while the longer-term goal remains a full 420-part transform-by-transform digital twin.

## Run locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Validation

```bash
npm run check
```

The check validates JavaScript syntax, loads all model chunks, verifies that modeled part/color counts do not exceed the set inventory, requires all major assemblies, and rejects the old `layout-proxy` tags.

## Architecture

```text
index.html
src/
  main.js             scene, minifigs, animals, controls, trap simulation
  brick-engine.js     reusable part proxies, connections, break physics
data/
  5986.json           scenario metadata / coverage
  5986-model.json     model manifest and provenance
  5986-parts-*.json   positioned regular-part chunks
  5986-inventory.csv  inventory cross-check
scripts/
  validate-model.mjs  inventory + coverage validation
```

## Sources

The reconstruction cross-checks the official LEGO building instructions, the BrickLink inventory, Brickset set metadata, and photographs of complete physical copies. Published headline piece totals are inconsistent across databases, so source provenance is preserved in the model instead of hiding the discrepancy.

This is a fan-made simulation prototype and is not affiliated with or endorsed by the LEGO Group.
