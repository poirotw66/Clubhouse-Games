# 花花舞獅踩街（Bloom Lion Dance）

QWOP-style 4-leg temple-fair lion dance. Sit 花花 on the lion’s head, walk 50 m of 廟口踩街, and 採青 the hanging red envelope.

## Dev

```bash
npm run setup          # from repo root
npm run build:game Lion-Dance
npm run dev            # then open Games/Lion-Dance/
```

Inside this package: `npm run lint`, `npm run check`, `npm run build`.

## Controls

| Input | Action |
| ----- | ------ |
| `Q` / front-left button | Lift & swing front-left leg |
| `W` / front-right button | Lift & swing front-right leg |
| `O` / back-left button | Lift & swing back-left leg |
| `P` / back-right button | Lift & swing back-right leg |
| `R` / get-up | Restart after a fall |

Release a held key to plant the foot and push. Keep the body balanced or tip over.

## Result titles

| Finish time | Title |
| ----------- | ----- |
| &lt; 25 s | 廟會傳奇 |
| &lt; 40 s | 獅王 |
| &lt; 60 s | 醒獅 |
| ≥ 60 s (finished) | 小獅仔 |
| Timeout / fall | 再試一次 |
