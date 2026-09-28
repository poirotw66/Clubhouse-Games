# Game Quality Bar

Clubhouse Games rejects filler. Every listed game must clear this bar before counting as done.

## Required

1. **Mode or rule variant** — at least one meaningful choice beyond "play again" (difficulty tiers, Draw-1/3, practice vs challenge, H17/S17, staged levels, etc.).
2. **Replay hook** — persist at least one of: high score, win streak, best time, or bankroll via `localStorage`.
3. **Board / card opponents** — keep existing three-tier AI where present; add **Undo** or **Hint** (or both).
4. **Feedback** — use `@clubhouse/shared/synthAudio` where the game already uses React/shared; clear win/lose or score result UI (prefer `ResultOverlay` when it fits). Non-React Vite games may use `@clubhouse/shared/resultOverlayDom` (same chrome contract, self-contained CSS). Mark permanent `～` only when shared chrome truly cannot fit — document the reason in the quality matrix (do not fake a ✓).
5. **Touch** — primary actions work on touch devices.
6. **Check script** — a runnable `check-*.mjs` (or existing `npm run check`) covering the new rules or core scoring.

## Permanent ResultOverlay `～` (honest exceptions)

| Game | Reason |
|------|--------|
| Block-the-smash | Drill end UI lives inside a Three.js iframe (`game.html`) with its own CSS; no Tailwind scan path for React `ResultOverlay`. Parent shell already plays shared `synthAudio` on `DRILL_OVER`. |
| Puyo-Puyo | Dependency-free static page (copy `src/` → `dist/`); no React/Tailwind. Custom `#result-overlay` already mirrors the shared chrome contract (title / stats / restart). Bundling `resultOverlayDom` would be chrome churn without React stack payoff. |
| Baseball-Life | Career summary is a long-form multi-section page, not a short win/lose card. |
| Dynasty | Tenure summary is a long-form page, not a short win/lose card. |

## Language

- Code identifiers and comments in English.
- Player-facing Chinese in Traditional Chinese only.

## Scope discipline

- Change only the assigned `Games/<Folder>/` (and that game's spec under `01–06/` if rules change).
- Do not remove games from `data/games.json`.
- Do not commit or push.
