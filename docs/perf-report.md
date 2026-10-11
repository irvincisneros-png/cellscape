# CellScape performance report (phase 6, `perf`)

## How it was measured
Each level was mounted with `engine.start(id)` (previous level unmounted), device pixel ratio forced to 1, quality locked.
Per tier, `engine.render()` ran 6 times with a GPU sync, best of 3 runs. `renderer.info.render` is per frame.
Frame times were taken in a hidden Browser pane on a Mac, so they are noisy and only show the relative cost; use calls and triangles for comparisons. Re-run on a Chromebook before trusting the milliseconds.
`geo` and `tex` are `renderer.info.memory` after all three tiers (they do not change with tier). The animal-side levels were reached with `?cell=animal`.

Columns: calls / triangles / ms for High, Medium, Low.

| Level | High | Medium | Low | geo | tex | Physical mats (with clearcoat at High) | Instanced meshes / tris |
|---|---|---|---|---|---|---|---|
| cell | 290 / 366k / 6.2 | 154 / 185k / 4.0 | 141 / 187k / 3.0 | 99 | 17 | 153 | 13 / 74k |
| animal | 141 / 1024k / 5.8 | 78 / 513k / 5.3 | 67 / 507k / 4.9 | 162 | 17 | 71 | 28 / 382k |
| membrane | 107 / 2360k / 5.9 | 60 / 1180k / 4.7 | 48 / 1180k / 5.1 | 208 | 21 | 47 | 12 / 1178k |
| chloroplast | 58 / 266k / 3.9 | 42 / 141k / 4.1 | 28 / 142k / 3.0 | 235 | 21 | 24 | 14 / 102k |
| thylakoid | 265 / 1372k / 6.1 | 143 / 689k / 4.3 | 136 / 693k / 4.6 | 358 | 22 | 116 | 12 / 637k |
| mitochondrion | 108 / 336k / 3.8 | 71 / 184k / 4.3 | 58 / 186k / 2.5 | 405 | 22 | 43 | 15 / 115k |
| cristae | 200 / 850k / 6.6 | 108 / 426k / 6.7 | 98 / 428k / 3.9 | 477 | 22 | 92 | 16 / 372k |
| enzymes | 61 / 299k / 3.5 | 36 / 149k / 2.5 | 23 / 149k / 2.1 | 489 | 23 | 35 | 8 / 61k |
| nucleus | 150 / 948k / 4.8 | 87 / 483k / 3.8 | 75 / 483k / 3.4 | 564 | 23 | 64 | 13 / 349k |
| chromatin | 33 / 175k / 4.1 | 23 / 87k / 2.3 | 9 / 87k / 1.7 | 573 | 23 | 18 | 9 / 344k |
| dna | 33 / 32k / 3.7 | 24 / 16k / 3.2 | 10 / 16k / 3.4 | 580 | 23 | 9 | 5 / 50k |
| expression | 55 / 90k / 2.9 | 40 / 46k / 3.9 | 31 / 46k / 2.4 | 597 | 23 | 58 | 12 / 43k |
| folding | 25 / 159k / 5.2 | 19 / 79k / 3.8 | 5 / 79k / 4.2 | 601 | 23 | 37 | 5 / 100k |
| mitosis | 47 / 61k / 3.7 | 30 / 31k / 4.4 | 16 / 31k / 4.2 | 616 | 23 | 31 | 13 / 45k |
| meiosis | 57 / 98k / 12.4 | 35 / 49k / 7.1 | 21 / 49k / 6.1 | 629 | 29 | 45 | 7 / 23k |
| karyotype | 111 / 494k / 3.3 | 62 / 247k / 2.3 | 48 / 247k / 2.1 | 678 | 25 | 48 | 0 |
| inheritance | 83 / 53k / 7.7 | 49 / 27k / 5.1 | 35 / 26k / 2.8 | 696 | 24 | 47 | 9 / 9k |
| specialised | 145 / 987k / 5.3 | 79 / 493k / 7.1 | 65 / 493k / 7.2 | 744 | 23 | 144 | 51 / 463k |
| immunity | 67 / 506k / 5.2 | 40 / 253k / 6.4 | 26 / 253k / 5.0 | 774 | 23 | 77 | 51 / 249k |
| epigenetics | 61 / 349k / 4.9 | 37 / 174k / 5.6 | 23 / 174k / 4.7 | 787 | 23 | 52 | 30 / 1655k |

(`geo` grows because earlier levels' geometry was not disposed during the sweep; it is not a per-level figure.)

## Findings
- **The old Fast setting did not reduce geometry.** Medium and Low draw the same triangles. Their gains were only post-processing and pixel ratio.
- **High costs about double** in calls and triangles: the bokeh pass re-renders the whole scene for its depth pass. Dropping bokeh (Medium) halves both, which is the largest saving available without touching levels.
- Low saves a further 5 to 20 percent of calls (no bloom, no clearcoat, no sheen).
- Total draw calls are modest everywhere (under 300 at High, under 150 at Low). The cost on weak GPUs is fragment work on large translucent glass shells and the instanced triangle load.

## What the tiers do now
| | High | Medium | Low (Fast) |
|---|---|---|---|
| Pixel ratio | up to 2 | up to 1.5 | 1 (0.75 on a device that is still below about 20 fps) |
| Bokeh | on | off | off |
| Bloom | on (real look only) | on | off |
| Clearcoat | as authored | as authored | off |
| Sheen | as authored | off | off |
| Transmission | as authored | alpha fallback | alpha fallback |
| Clay key-light shadow | 2048 map | 1024 map | off |
| `engine.lodScale` | 1 | 0.75 | 0.5 |

Material downgrades live in `materials.js` (`applyTier`). They change the real look's material objects in place, keeping the original values in `material.userData._tier` so High restores them exactly. With the clay style on, the real material sits in `mesh.userData.realMat`; that is the one downgraded, and clay materials are never touched, so there is no fight with `style.js` in either direction. The engine re-applies on mount, on tier change, and once a second on Medium and Low for meshes spawned mid-simulation.

## LOD API for levels
- `engine.tier`: `"high" | "medium" | "low"`. `engine.lodScale`: 1, 0.75 or 0.5.
- Mark an `InstancedMesh` with `mesh.userData.lod = true` and the engine sets `count = ceil(full * lodScale)`. `full` is `userData.lodCount` if set, otherwise the buffer capacity. Do not set `.count` yourself on those meshes.
- No level uses it yet. Levels that should adopt it, heaviest instanced triangle load first: epigenetics (1655k), membrane (1178k), thylakoid (637k), specialised (463k), animal (382k), cristae (372k), nucleus (349k), chromatin (344k), immunity (249k).

## Adaptive quality
`engine.autoQuality` averages about 3 s of real frames (30+ frames, ignoring gaps over 0.25 s, hidden tabs, microscope mode and dives), then steps down one tier if the average is slower than 32 fps (High to Medium) or 24 fps (Medium to Low). In Low, a device slower than 20 fps drops the pixel ratio to 0.75 once. It never steps back up and does nothing when `lockQuality` is set (the Quality control sets it). Checked with simulated frame times: it stepped High to Medium to Low one window at a time, ignored pauses, stayed put on fast frames and on lock.
