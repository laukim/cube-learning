# 3×3 Coach

CFOP practice for 3×3 — scramble a timed solve, or drill Cross, F2L, 2-look OLL, and 2-look PLL with live hints.

## Run

```bash
python3 -m http.server 5173
```

Open `http://127.0.0.1:5173/`.

## Method (in the app)

White on bottom, yellow on top:

1. **Cross** — white + matching side centres
2. **F2L** — four corner+edge pairs (41 standard cases; CubeHead order)
3. **2-look OLL** — yellow cross (`F R U R' U' F'`), then Sune for corners
4. **2-look PLL** — T-perm (corners / headlights), then U-perm (edges)

## Tabs

- **Guide** — full timed solve with step hints
- **Cross / F2L / OLL / PLL** — stage drills
- **Match** — paint a net to match a real scramble
- **Algs** — the short alg library used by the coach

**Guide** opens the side panel. **Next hint** (or Cross / F2L / OLL / PLL hint) advances coaching for the current stage.
