# 花花舞獅踩街（Bloom Lion Dance）v3

QWOP-style 4-leg temple-fair lion dance. Side-view 醒獅 with colour-coded legs, bright street, hard balance, flop falls, and 採青 at 50 m.

## Modes

- **單人**：one player, four legs (`Q` `W` `O` `P`)
- **雙人**：same keyboard — head `Q`/`W`, tail `O`/`P`
- **新手輔助**：wider fall thresholds (off by default)

## Dev

```bash
npm run setup          # from repo root
npm run build:game Lion-Dance
npm run lint -w lion-dance
npm run check -w lion-dance
```

## Controls

| Input | Action |
| ----- | ------ |
| `Q` / `W` | Front-left (orange) / front-right (green) |
| `O` / `P` | Back-left (blue) / back-right (pink) |
| Release | Plant & push (Perfect within ±100 ms of drum) |
| `R` | Get up after a fall |
| Space | Start from title |

## Tuning (v3)

| Knobs | Value |
| ----- | ----- |
| Drum BPM | 108 |
| Perfect window | ±100 ms |
| Perfect impulse | 0.12 |
| Combo speed | +1.2%/stack, max +8% (8) |
| Speed cap | 1.65 → 2.15 m/s with combo |
| Fall thresholds | pitch 0.48 / roll 0.42 rad |
| Assist scale | ×1.45 on fall thresholds |
| Fall grace | 2.4 s before result |

## Result titles

| Finish time | Title |
| ----------- | ----- |
| &lt; 25 s | 廟會傳奇 |
| &lt; 40 s | 獅王 |
| &lt; 60 s | 醒獅 |
| ≥ 60 s | 小獅仔 |
| Fail | 再試一次 |
