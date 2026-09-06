# 3×3 Coach

Practice for 3×3 — **CFOP** or **Roux**. Scramble a timed solve, or drill one stage with live hints.

## Run

```bash
python3 -m http.server 5173
```

Open `http://127.0.0.1:5173/`.

## Methods

Same colour orientation for both: white on bottom, yellow on top, blue = F.

### CFOP

1. **Cross** — white + matching side centres
2. **F2L** — four corner+edge pairs (41 standard cases; CubeHead order)
3. **2-look OLL** — yellow cross (`F R U R' U' F'`), then Sune for corners
4. **2-look PLL** — T-perm (corners / headlights), then U-perm (edges)

### Roux

1. **First block (FB)** — left 1×2×3 on orange
2. **Second block (SB)** — right 1×2×3 on red
3. **2-look CMLL** — orient with Sune, permute with Niklas or diagonal
4. **LSE** — EO → UL/UR → M-slice. The guide gives **one exact M/U alg** for whatever case you’re in; the LSE tab drills the full beginner case list.

Switch CFOP / Roux in the header. Tabs and the alg library follow the active method.

## Tabs

- **Guide** — full timed solve with step hints
- **Stage drills** — Cross / F2L / OLL / PLL (CFOP) or FB / SB / CMLL / LSE (Roux)
- **Match** — paint a net to match a real scramble
- **Algs** — the short alg library for the active method

**Guide** opens the side panel. **Next hint** advances coaching for the current stage.
