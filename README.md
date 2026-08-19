# LEGO Sim — 5986 Amazon Ancient Ruins

A browser-based LEGO-world simulation centered on Adventurers set **5986-1 Amazon Ancient Ruins**.

## What works in V0.2

- data-driven part placement from `data/5986-model.json`
- a canonical regular-part inventory snapshot in `data/5986-inventory.csv`
- validation that modeled part/color counts never exceed the inventory snapshot
- reusable LEGO-scale brick/plate proxies with studs and color/material mapping
- a structural connection graph inferred from vertical stud-overlap contact
- support propagation: knock a connected piece free and unsupported components can fall
- first instruction-tied bridge/gateway placements reconstructed from the original build sequence
- explicit `verification` labels separating instruction-tied transforms from temporary layout proxies
- 3D orbit/touch camera, gravity, reset, time controls and autonomous minifigure stand-ins
- GitHub Pages deployment workflow

## Run it

Because this uses ES modules, serve the folder over HTTP rather than opening `index.html` directly:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

Validate the reconstruction data with:

```bash
npm run check
```

## Architecture

```text
index.html
src/
  main.js             scene, controls, agents, world loading
  brick-engine.js     part proxies, connection graph, break/fall physics
  styles.css          responsive UI
data/
  5986.json           scenario metadata
  5986-model.json     positioned part instances + verification state
  5986-inventory.csv  inventory cross-check snapshot
scripts/
  validate-model.mjs  inventory/model consistency check
```

## Reconstruction status

V0.2 is the **exact-model pipeline**, not a claim that all of set 5986 has already been transcribed. The current model has an instruction-tied bridge/gateway seed plus clearly marked `layout-proxy` temple pieces. Those proxies are replaced as successive instruction pages are encoded.

Published sources disagree on the headline piece count, so the simulator keeps provenance instead of treating one number as unquestioned truth. The regular-part inventory snapshot is used as a part/color upper-bound check, while the build instructions remain the authority for assembly order and transforms.

## Next reconstruction pass

1. Transcribe the remaining instruction pages into positioned part instances.
2. Add precise proxy geometry for slopes, arches, clips, hinges, rope bridge and decorated elements.
3. Replace inferred connections with authored stud/clip/hinge constraints where needed.
4. Add connection strength based on engaged studs and connection type.
5. Add articulated minifigures and inventory-correct accessories.
6. Add buoyancy and hinge/play-feature constraints for the river/bridge mechanisms.
7. Generalize the model loader so additional LEGO sets can use the same engine.

This is a fan-made simulation prototype and is not affiliated with or endorsed by the LEGO Group.
