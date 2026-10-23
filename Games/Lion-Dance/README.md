# 花花舞獅踩街（Bloom Lion Dance）v4

QWOP-style 4-leg temple-fair lion dance. Pulled-back side view, cute procedural 醒獅 with jointed colour-banded legs, bright pastel street, flop falls, large HUD.

## Modes

- **單人**：`Q` `W` `O` `P`
- **雙人**：head `Q`/`W`, tail `O`/`P`
- **新手輔助**：wider fall thresholds (off by default)

## Dev

```bash
npm run setup
npm run build:game Lion-Dance
npm run lint -w lion-dance
npm run check -w lion-dance
```

## Tuning (v4)

| Knobs | Value |
| ----- | ----- |
| Lion screen fill | ~35–40% height |
| Fall pitch / roll | 0.48 / 0.42 (assist ×1.45) |
| Speed cap | 1.65 → 2.15 m/s |
| Perfect impulse | 0.12 |
| Combo speed | +1.2%/stack, max 8% |
| Fall grace | 4.0 s |
| Leg colours | Q橙 W綠 O藍 P粉 |
