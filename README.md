# BY LAYER

Beginner 3×3 solver for the full cube — the 7 steps from white cross to yellow corners.

## Run

```bash
python3 -m http.server 5173
```

Open `http://127.0.0.1:5173/`.

## Your method (in the app)

1. White cross (matched to centres)
2. White corners (righty / lefty)
3. Middle edges (U → righty → y′ → lefty)
4. Yellow cross (F righty F′)
5. Yellow edges (your U-perm; opposite → same alg → adjacent)
6. Yellow corner seats (Niklas: `R U' L' U R' U' L`)
7. Orient corners (your white-up + righty + D; app uses the yellow-up equivalent)

## F2L trainer

Open the **F2L** tab → **New F2L case**. White cross stays solved; practice pairing and inserting.

1. Bring an unsolved pair to **front-right** with `y` / `y'`
2. Pair on top, insert with righty (`R U R' U'`)
3. Repeat until **4/4** slots are done
