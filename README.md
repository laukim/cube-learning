# 3×3 Coach

Practice for 3×3 — **CFOP** or **Roux**. Scramble a timed solve, or drill one stage with live hints.

## Run

```bash
python3 -m http.server 5173
```

Open `http://127.0.0.1:5173/`.

## Smart cube

The timer can pair a GAN smart cube from **Chrome on a Mac** (Web Bluetooth, HTTPS). GAN i4 Maglev and GAN12 ui Maglev use the Gen4 protocol; the picker looks for names starting with `GAN`, `MG`, or `AiCube`. No CubeStation app.

Connect on the timer page, apply the scramble with white on the bottom and blue in front, and the clock arms when the cube matches. The first turn starts it (after inspection, if inspection is on). Solved stops it and saves a timestamped move list. Space or tap still times a solve when no cube is connected.

## Cloudflare

Deploy uses Wrangler static assets (`npx wrangler deploy`); `.assetsignore` excludes `node_modules` (and `.git` / `.wrangler`) so they are not uploaded.

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
4. **LSE** — EO → UL/UR → M-slice (M moves on the pad)

Switch CFOP / Roux in the header. Tabs and the alg library follow the active method.

## Tabs

- **Guide** — full timed solve with step hints
- **Stage drills** — Cross / F2L / OLL / PLL (CFOP) or FB / SB / CMLL / LSE (Roux)
- **Match** — paint a net to match a real scramble
- **Algs** — the short alg library for the active method

**Guide** opens the side panel. **Next hint** advances coaching for the current stage.
