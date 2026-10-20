# 花牌（Koi-Koi）

Clubhouse Vite + React port of hanafuda Koi-Koi.

## Scripts

- `npm run dev` — local Vite
- `npm run check` / `npm run test` — Vitest (`gameLogic`, `botAi`, `yakuCodex`)
- `npm run lint` — `tsc --noEmit`
- `npm run build` — production bundle

## Features

- Three AI difficulties × win-score targets (7 / 12 / 20)
- Player + opponent character select; opponent personalities layered on difficulty
- Yaku codex (`clubhouse-koi-koi-yaku-codex`) with validated localStorage merge
- Hint / Undo, BGM, win streak, ResultOverlay, first-run guide
- Yaku completion juice (motion + SFX; respects `prefers-reduced-motion`)

Spec: [`01-cards/koi-koi.md`](../../01-cards/koi-koi.md)
