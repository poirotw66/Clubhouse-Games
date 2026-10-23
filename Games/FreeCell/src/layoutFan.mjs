/**
 * Tableau fan contract for FreeCell.
 *
 * Covered cards use aspect-ratio 2/3 (height = 150% of column width). The CSS
 * rule `margin-top: calc(-150% + var(--fc-fan-peek))` therefore exposes exactly
 * `--fc-fan-peek` of each card. Peek is `2 * cornerFont + pad` so rank and suit
 * stay fully visible at every viewport — never return to a fixed `-mt-[115%]`
 * (that only left ~0.35×width, shorter than two corner lines).
 */
export const FC_FAN = {
  aspectHeightPercent: 150,
  cornerSizeCss: 'clamp(0.625rem, 22cqi, 0.9375rem)',
  fanPeekCss: 'calc(var(--fc-corner-size) * 2.35 + 0.55rem)',
  stackedMarginCss: 'calc(-150% + var(--fc-fan-peek))',
};
