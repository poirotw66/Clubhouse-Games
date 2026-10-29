# Hub menu local fonts

Self-hosted subsets for offline Clubhouse Games hub first paint.
Source: Fontsource packages `@5.3.0` (OFL — see `LICENSE`).

| CSS | Families | Used by |
| --- | --- | --- |
| `hub.css` | Chakra Petch 300–700 (latin), Russo One 400 (latin), Noto Sans TC 400/500/600 (latin + generated CJK subsets) | root `index.html` |

No Google Fonts CDN refs remain on the hub entry. Per-game Google Fonts under `Games/*` are out of scope.

`files/` retains the licensed Fontsource originals. `npm run generate` runs
`npm run build:fonts` after updating the menu, using the locked build-only
[`subset-font`](https://github.com/papandreou/subset-font) dependency. It reads
`index.html`, `data/games.json`, and `assets/menu.js` so catalogue additions and
dynamic search/recent-game copy are included automatically. All three original
CJK weights are retained; unknown characters (such as arbitrary search input)
use the browser's system fallback.

The generated WOFF2 files live in ignored `optimized/` and are served locally
after `npm run setup` or `npm run generate`. Each subset has a 128 KiB build
budget. Pages copies these subsets and excludes the three full CJK originals.
The original OFL license remains in `LICENSE`, and generated fonts retain their
copyright/license metadata. Python and external font services are not required.
