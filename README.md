# 3×3 Coach

Smart-cube timer for 3×3. Open the site and you are on the timer: GAN connect, Cross · F2L · Final splits, a live 3D cube, and coaching stats.

`/` is home. `/timer` and `/timer.html` are the same page. `/pll` is the PLL algorithm reference (2-look and Cases I know) — diagrams and algs, not another timer mode.

## Run

```bash
python3 -m http.server 5173
```

Open `http://127.0.0.1:5173/`.

## Smart cube

Pair a GAN smart cube from **Chrome on a Mac** (Web Bluetooth, HTTPS). GAN i4 Maglev and GAN12 ui Maglev use the Gen4 protocol; the picker looks for names starting with `GAN`, `MG`, or `AiCube`. No CubeStation app.

Apply the scramble with white on the bottom and blue in front, and the clock arms when the cube matches. The first turn starts it (after inspection, if inspection is on). Solved stops it and saves a timestamped move list. In Cross · F2L · Final, the cube marks Cross when the white cross is done, each F2L pair, and F2L when the first two layers are done. PLL cases arm when the cube matches that case's setup and stop when the cube is solved. Cross drill arms on the cross scramble and stops when the white cross is done. Space or tap still times a solve when no cube is connected.

## Cloudflare

Deploy uses Wrangler static assets (`npx wrangler deploy`); `.assetsignore` excludes `node_modules` (and `.git` / `.wrangler`) so they are not uploaded.

The footer version is a short `v1.02` label on the timer and the PLL page. Each deploy rewrites it from the commit count, so a merge to main shows the next number. `python3 -m http.server` and `npm start` leave the placeholder `v0.0.0-dev`. Open `/pll.html` on that static server; a deploy serves the same page at `/pll`.
