# Shared game fonts (local)

Self-hosted Latin subsets for mainline `Games/*` so selected titles no longer
load Google Fonts at runtime. Source: Fontsource packages `@5.3.0` (OFL — see
`LICENSE`). Same approach as `gpt6-astra/vendor/fonts/`.

| CSS | Families / weights | Used by |
| --- | --- | --- |
| `freecell.css` | Inter 400/500/600, Playfair Display 600/700 + 600 italic | FreeCell |
| `dialed-color.css` | Fraunces 400/600, Manrope 500/600/700, IBM Plex Mono 400/500 | Dialed-Color |
| `cyber-neon-rush.css` | Orbitron 500/700/800 | Cyber-Neon-Rush |
| `instant-flash.css` | Orbitron 400/700/900, Zen Kaku Gothic New 400/700 | Instant-Flash |
| `koi-koi.css` | Noto Serif TC 400/600/700, Zen Maru Gothic 400/500/700 (latin) | Koi-Koi |

CJK glyphs are **not** vendored (full TC subsets are tens of MB). Stacks keep
system fallbacks (`PingFang TC`, `Microsoft JhengHei`, `Hiragino Mincho ProN`,
etc.) so Traditional Chinese UI still renders offline.

Import from each game’s entry CSS (Vite bundles the woff2 into `dist/`). Do not
add Google Fonts `<link>` / `@import` for these titles.

## Remainders (still CDN)

As of this batch, other `Games/*` that still reference Google Fonts include:

- Mystery-Liquid-Sort (Fredoka)
- Switchpoint-Run, Danmaku-Abyss, Coin-Cascade (Orbitron + Noto Sans TC)
- Toy-Baseball (Inter + JetBrains Mono)
- Sailing (Noto Sans TC + Outfit)
- Block-the-smash (Teko)

Hub menu fonts (`index.html`) are owned separately.
