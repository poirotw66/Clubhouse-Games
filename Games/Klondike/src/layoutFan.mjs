/**
 * Tableau / waste fan contract for Klondike.
 *
 * Face-up peek must cover two corner lines (rank + suit). A fixed 20px step with
 * text-xl (~40px tall) clipped stacked face-up indices; waste translateX(12px)
 * likewise hid the left-edge rank. Both now track `--kl-corner-size` via cqi.
 */
export const KL_FAN = {
  cornerSizeCss: 'clamp(0.7rem, 20cqi, 1.05rem)',
  faceUpPeekCss: 'calc(var(--kl-corner-size) * 2.35 + 0.5rem)',
  faceDownPeekCss: 'max(0.55rem, calc(var(--kl-corner-size) * 0.75))',
  wasteFanXCss: 'calc(var(--kl-corner-size) * 1.15 + 0.45rem)',
};
