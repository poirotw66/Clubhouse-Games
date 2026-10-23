# 花花舞獅踩街（Bloom Lion Dance）v2

QWOP-style 4-leg temple-fair lion dance. Sit 花花 on the lion’s head, walk 50 m, plant on the drum beat, and 採青 the hanging red envelope.

## Modes

- **單人**：one player, four legs (`Q` `W` `O` `P`)
- **雙人**：same keyboard — head `Q`/`W`, tail `O`/`P`; mobile splits 獅頭 / 獅尾

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
| `Q` / `W` | Front-left / front-right |
| `O` / `P` | Back-left / back-right |
| Release | Plant & push (Perfect within ±100 ms of drum) |
| `R` | Get up / restart after a fall |

## Tuning (v2)

| Knobs | Value |
| ----- | ----- |
| Drum BPM | 108 |
| Perfect window | ±100 ms |
| Perfect impulse | 0.28 |
| Combo speed | +2.2%/stack, max +16% (8) |
| Speed cap | 3.15 → 3.75 m/s with combo |
| Fall thresholds | pitch 0.78 / roll 0.68 rad |

## Result titles

| Finish time | Title |
| ----------- | ----- |
| &lt; 25 s | 廟會傳奇 |
| &lt; 40 s | 獅王 |
| &lt; 60 s | 醒獅 |
| ≥ 60 s | 小獅仔 |
| Fail | 再試一次 |
