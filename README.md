# LEGO Sim — 5986 Amazon Ancient Ruins

A browser-based simulation prototype centered on LEGO Adventurers set **5986-1 Amazon Ancient Ruins**.

## What works in V1

- 3D orbit/touch camera
- LEGO-proportioned procedural bricks and studs
- 32×48-stud world footprint with river, ruins, bridge, boat, vegetation, treasure and minifigure stand-ins
- breakable/loose bridge planks and treasure pieces with simple gravity
- autonomous minifigure movement
- flowing/drifting boat behavior
- pause/reset, gravity toggle, AI toggle and 1×/10×/100× time controls
- mobile-responsive HUD

## Run it

Because this uses ES modules, serve the folder over HTTP rather than opening `index.html` directly:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Architecture

```text
index.html
src/
  main.js         rendering, simulation, interactions
  styles.css      responsive UI
data/
  5986.json       scenario metadata and simulation constants
```

The current geometry is a **playable procedural reconstruction**, not yet the exact 458-piece transform-by-transform model.

## Exact-reconstruction path

1. Parse the 5986 inventory into a canonical part list.
2. Reconstruct build-step transforms from instructions or an LDraw/Studio model.
3. Map each part to reusable geometry and connection points.
4. Replace procedural temple/bridge geometry with the exact model.
5. Preserve authored hinges/play features as constraints.
6. Add connection-strength physics so support removal propagates through the assembly graph.
7. Replace minifigure stand-ins with articulated LEGO-scale rigs.

## Simulation layers planned

- **Brick physics:** studs, anti-studs, connections, break strength, mass, collision.
- **World physics:** gravity, buoyancy, river flow, foliage contact.
- **Agents:** perception, goals, pathfinding, object interaction.
- **Time:** normal play speed through accelerated weathering/ecology.
- **Import:** load additional LEGO worlds from structured model files.

This is a fan-made simulation prototype and is not affiliated with or endorsed by the LEGO Group.
