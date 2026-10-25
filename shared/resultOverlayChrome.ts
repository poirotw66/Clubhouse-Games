/**
 * Shared cinematic chrome CSS for ResultOverlay (React + DOM twins).
 * Pass the BEM root prefix: `result-overlay` or `clubhouse-result-overlay`.
 */

export function resultOverlayChromeCss(p: string): string {
  return `
.${p} {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow: hidden;
  background:
    radial-gradient(130% 90% at 50% 0%, rgba(45, 212, 191, 0.38), transparent 52%),
    radial-gradient(90% 70% at 100% 100%, rgba(244, 114, 182, 0.28), transparent 48%),
    radial-gradient(70% 50% at 0% 80%, rgba(103, 232, 249, 0.16), transparent 50%),
    rgba(1, 2, 8, 0.88);
  backdrop-filter: blur(18px) saturate(1.35);
  -webkit-backdrop-filter: blur(18px) saturate(1.35);
}
.${p}--lose {
  background:
    radial-gradient(130% 90% at 50% 0%, rgba(244, 63, 94, 0.42), transparent 52%),
    radial-gradient(90% 70% at 0% 100%, rgba(127, 29, 29, 0.45), transparent 48%),
    radial-gradient(60% 40% at 100% 70%, rgba(251, 113, 133, 0.18), transparent 50%),
    rgba(8, 1, 6, 0.9);
}
.${p}--record {
  background:
    radial-gradient(130% 90% at 50% 0%, rgba(251, 191, 36, 0.48), transparent 52%),
    radial-gradient(90% 70% at 100% 100%, rgba(244, 114, 182, 0.28), transparent 48%),
    radial-gradient(70% 50% at 0% 80%, rgba(253, 224, 71, 0.2), transparent 50%),
    rgba(10, 6, 0, 0.88);
}
.${p}__sparks {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(1.5px 1.5px at 12% 18%, rgba(165, 243, 252, 0.95), transparent),
    radial-gradient(1.5px 1.5px at 28% 72%, rgba(244, 114, 182, 0.9), transparent),
    radial-gradient(2px 2px at 48% 22%, rgba(255, 255, 255, 0.85), transparent),
    radial-gradient(1.5px 1.5px at 68% 64%, rgba(45, 212, 191, 0.9), transparent),
    radial-gradient(2px 2px at 82% 28%, rgba(251, 191, 36, 0.95), transparent),
    radial-gradient(1.5px 1.5px at 90% 78%, rgba(103, 232, 249, 0.85), transparent),
    radial-gradient(1.5px 1.5px at 8% 88%, rgba(244, 114, 182, 0.75), transparent),
    radial-gradient(2px 2px at 55% 88%, rgba(165, 243, 252, 0.8), transparent);
  animation: ${p}-sparkle 3.2s ease-in-out infinite;
  opacity: 0.85;
}
.${p}--lose .${p}__sparks {
  background-image:
    radial-gradient(1.5px 1.5px at 14% 20%, rgba(251, 113, 133, 0.9), transparent),
    radial-gradient(1.5px 1.5px at 36% 70%, rgba(248, 113, 113, 0.75), transparent),
    radial-gradient(2px 2px at 62% 24%, rgba(255, 228, 230, 0.7), transparent),
    radial-gradient(1.5px 1.5px at 84% 66%, rgba(148, 163, 184, 0.7), transparent),
    radial-gradient(2px 2px at 78% 40%, rgba(244, 63, 94, 0.85), transparent);
}
.${p}--record .${p}__sparks {
  background-image:
    radial-gradient(2px 2px at 18% 16%, rgba(253, 224, 71, 1), transparent),
    radial-gradient(1.5px 1.5px at 40% 68%, rgba(251, 191, 36, 0.95), transparent),
    radial-gradient(2px 2px at 58% 22%, rgba(255, 255, 255, 0.95), transparent),
    radial-gradient(1.5px 1.5px at 76% 74%, rgba(244, 114, 182, 0.9), transparent),
    radial-gradient(2px 2px at 88% 36%, rgba(253, 230, 138, 1), transparent);
}
.${p}__aurora {
  position: absolute;
  inset: -10% -20%;
  pointer-events: none;
  background:
    radial-gradient(40% 30% at 30% 40%, rgba(45, 212, 191, 0.35), transparent 70%),
    radial-gradient(35% 28% at 70% 55%, rgba(244, 114, 182, 0.32), transparent 70%),
    radial-gradient(30% 24% at 50% 20%, rgba(103, 232, 249, 0.22), transparent 70%);
  filter: blur(28px);
  animation: ${p}-aurora 7s ease-in-out infinite alternate;
  mix-blend-mode: screen;
  opacity: 0.9;
}
.${p}--lose .${p}__aurora {
  background:
    radial-gradient(40% 30% at 35% 40%, rgba(244, 63, 94, 0.4), transparent 70%),
    radial-gradient(35% 28% at 70% 55%, rgba(127, 29, 29, 0.35), transparent 70%);
}
.${p}--record .${p}__aurora {
  background:
    radial-gradient(40% 30% at 30% 40%, rgba(251, 191, 36, 0.42), transparent 70%),
    radial-gradient(35% 28% at 70% 55%, rgba(244, 114, 182, 0.3), transparent 70%),
    radial-gradient(30% 24% at 50% 18%, rgba(253, 224, 71, 0.28), transparent 70%);
}
.${p}__rays {
  position: absolute;
  inset: -30%;
  background: repeating-conic-gradient(
    from 0deg at 50% 48%,
    rgba(165, 243, 252, 0) 0deg 8deg,
    rgba(45, 212, 191, 0.28) 8deg 10deg,
    rgba(244, 114, 182, 0.12) 10deg 11deg
  );
  opacity: 0.72;
  animation: ${p}-rays 14s linear infinite;
  mix-blend-mode: screen;
  pointer-events: none;
}
.${p}--lose .${p}__rays {
  background: repeating-conic-gradient(
    from 0deg at 50% 48%,
    rgba(251, 113, 133, 0) 0deg 10deg,
    rgba(244, 63, 94, 0.3) 10deg 12deg
  );
  opacity: 0.65;
}
.${p}--record .${p}__rays {
  background: repeating-conic-gradient(
    from 0deg at 50% 48%,
    rgba(251, 191, 36, 0) 0deg 7deg,
    rgba(251, 191, 36, 0.36) 7deg 9deg,
    rgba(255, 255, 255, 0.12) 9deg 10deg
  );
  opacity: 0.8;
  animation-duration: 10s;
}
.${p}__shockwave,
.${p}__shockwave-2 {
  position: absolute;
  left: 50%;
  top: 40%;
  width: 48px;
  height: 48px;
  margin: -24px 0 0 -24px;
  border-radius: 50%;
  border: 2px solid rgba(165, 243, 252, 0.7);
  box-shadow: 0 0 40px rgba(45, 212, 191, 0.55), inset 0 0 20px rgba(165, 243, 252, 0.25);
  animation: ${p}-shock 1100ms cubic-bezier(0.12, 0.85, 0.25, 1) 120ms both;
  pointer-events: none;
}
.${p}__shockwave-2 {
  border-color: rgba(244, 114, 182, 0.55);
  box-shadow: 0 0 36px rgba(244, 114, 182, 0.45);
  animation-delay: 380ms;
  animation-duration: 1300ms;
}
.${p}--lose .${p}__shockwave,
.${p}--lose .${p}__shockwave-2 {
  border-color: rgba(251, 113, 133, 0.7);
  box-shadow: 0 0 40px rgba(244, 63, 94, 0.5);
}
.${p}--record .${p}__shockwave {
  border-color: rgba(251, 191, 36, 0.85);
  box-shadow: 0 0 48px rgba(251, 191, 36, 0.6);
}
.${p}__scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent 0 2px,
    rgba(0, 0, 0, 0.12) 2px 3px
  );
  mix-blend-mode: multiply;
}
.${p}--lose .${p}__scanlines {
  opacity: 0.45;
  animation: ${p}-glitch 2.8s steps(2, end) infinite;
}
.${p}__vignette {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at center, transparent 28%, rgba(0, 0, 0, 0.55) 72%, rgba(0, 0, 0, 0.82) 100%);
  pointer-events: none;
}
.${p}__stage {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 30rem;
  text-align: center;
}
.${p}__bloom {
  position: absolute;
  left: 50%;
  top: 8%;
  width: min(90vw, 28rem);
  height: 10rem;
  margin-left: calc(min(90vw, 28rem) / -2);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(45, 212, 191, 0.55), transparent 68%);
  filter: blur(22px);
  pointer-events: none;
  animation: ${p}-bloom 2.4s ease-in-out infinite alternate;
  z-index: 0;
}
.${p}--lose .${p}__bloom {
  background: radial-gradient(circle, rgba(244, 63, 94, 0.5), transparent 68%);
}
.${p}--record .${p}__bloom {
  background: radial-gradient(circle, rgba(251, 191, 36, 0.62), transparent 68%);
  height: 12rem;
}
.${p}__kicker {
  position: relative;
  z-index: 1;
  margin: 0 0 0.65rem;
  font-size: clamp(1rem, 2.8vw, 1.2rem);
  font-weight: 800;
  font-family: 'Chakra Petch', 'Noto Sans TC', system-ui, sans-serif;
  letter-spacing: 0.04em;
  color: #fde68a;
  text-shadow: 0 0 22px rgba(251, 191, 36, 0.95), 0 0 48px rgba(251, 191, 36, 0.5);
  animation: ${p}-fade-up 480ms ease both;
}
.${p}--record .${p}__kicker {
  font-size: clamp(1.05rem, 3vw, 1.3rem);
  animation: ${p}-kicker-flash 1.1s ease-in-out infinite alternate;
}
.${p}__billboard {
  position: relative;
  z-index: 1;
  margin: 0 0 0.85rem;
  font-family: 'Russo One', 'Noto Sans TC', system-ui, sans-serif;
  font-size: clamp(2.7rem, 11vw, 4.4rem);
  font-weight: 400;
  line-height: 0.95;
  letter-spacing: -0.02em;
  color: #ecfeff;
  filter: drop-shadow(0 0 26px rgba(45, 212, 191, 0.9));
}
.${p}--lose .${p}__billboard {
  color: #ffe4e6;
  filter: drop-shadow(0 0 26px rgba(244, 63, 94, 0.9));
}
.${p}--record .${p}__billboard {
  color: #fffbeb;
  filter: drop-shadow(0 0 34px rgba(251, 191, 36, 1));
  font-size: clamp(2.9rem, 12vw, 4.7rem);
}
.${p}__char {
  display: inline-block;
  opacity: 0;
  transform: translate3d(0, 28px, 0) scale(0.86) rotateX(35deg);
  animation: ${p}-char-in 620ms cubic-bezier(0.12, 0.9, 0.2, 1) forwards;
  text-shadow:
    0 0 10px rgba(165, 243, 252, 1),
    0 0 28px rgba(45, 212, 191, 0.85),
    -2px 0 rgba(103, 232, 249, 0.95),
    2px 0 rgba(244, 114, 182, 0.95);
}
.${p}--lose .${p}__char {
  text-shadow:
    0 0 10px rgba(251, 113, 133, 1),
    0 0 26px rgba(244, 63, 94, 0.85),
    -2px 0 rgba(248, 113, 113, 0.9),
    2px 0 rgba(15, 23, 42, 0.95);
  animation-name: ${p}-char-glitch;
}
.${p}--record .${p}__char {
  text-shadow:
    0 0 12px rgba(253, 224, 71, 1),
    0 0 32px rgba(251, 191, 36, 0.95),
    -2px 0 rgba(255, 255, 255, 0.85),
    2px 0 rgba(244, 114, 182, 0.9);
}
.${p}__subtitle {
  position: relative;
  z-index: 1;
  margin: 0 0 1.1rem;
  font-size: 1rem;
  color: #cbd5e1;
  text-shadow: 0 0 16px rgba(148, 163, 184, 0.35);
  animation: ${p}-fade-up 560ms ease 120ms both;
}
.${p}__card {
  position: relative;
  z-index: 1;
  overflow: hidden;
  margin: 0 auto;
  padding: 1.6rem 1.5rem 1.4rem;
  border-radius: 1.75rem;
  border: 1px solid transparent;
  background:
    linear-gradient(155deg, rgba(10, 18, 34, 0.96), rgba(3, 6, 14, 0.98)) padding-box,
    linear-gradient(120deg, rgba(45, 212, 191, 0.9), rgba(165, 243, 252, 0.35), rgba(244, 114, 182, 0.8)) border-box;
  box-shadow:
    0 32px 70px -16px rgba(0, 0, 0, 0.85),
    0 0 0 1px rgba(45, 212, 191, 0.28),
    0 0 72px rgba(45, 212, 191, 0.38),
    0 0 110px rgba(244, 114, 182, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.14);
  animation: ${p}-card-in 640ms cubic-bezier(0.12, 0.9, 0.2, 1) 60ms both;
  isolation: isolate;
}
.${p}__card::before {
  content: '';
  position: absolute;
  inset: -40%;
  background: conic-gradient(
    from 0deg,
    transparent 0deg 60deg,
    rgba(45, 212, 191, 0.55) 90deg,
    transparent 120deg 220deg,
    rgba(244, 114, 182, 0.5) 260deg,
    transparent 300deg 360deg
  );
  animation: ${p}-border-spin 4.5s linear infinite;
  z-index: -2;
  opacity: 0.55;
}
.${p}__card::after {
  content: '';
  position: absolute;
  inset: 2px;
  border-radius: calc(1.75rem - 2px);
  background: linear-gradient(155deg, rgba(10, 18, 34, 0.97), rgba(3, 6, 14, 0.99));
  z-index: -1;
}
.${p}__card--win {
  box-shadow:
    0 32px 70px -16px rgba(0, 0, 0, 0.82),
    0 0 0 1px rgba(45, 212, 191, 0.35),
    0 0 72px rgba(45, 212, 191, 0.45),
    0 0 110px rgba(244, 114, 182, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.14);
}
.${p}__card--lose {
  background:
    linear-gradient(155deg, rgba(40, 16, 24, 0.94), rgba(10, 4, 8, 0.97)) padding-box,
    linear-gradient(120deg, rgba(251, 113, 133, 0.8), rgba(244, 63, 94, 0.3), rgba(127, 29, 29, 0.7)) border-box;
  box-shadow:
    0 32px 70px -16px rgba(0, 0, 0, 0.82),
    0 0 64px rgba(244, 63, 94, 0.38),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
.${p}__card--lose::before {
  background: conic-gradient(
    from 0deg,
    transparent 0deg 70deg,
    rgba(251, 113, 133, 0.55) 100deg,
    transparent 130deg 360deg
  );
}
.${p}__card--lose::after {
  background: linear-gradient(155deg, rgba(36, 12, 20, 0.97), rgba(8, 2, 6, 0.98));
}
.${p}__card--record {
  background:
    linear-gradient(155deg, rgba(48, 36, 12, 0.94), rgba(12, 8, 2, 0.97)) padding-box,
    linear-gradient(120deg, rgba(251, 191, 36, 0.95), rgba(255, 255, 255, 0.45), rgba(244, 114, 182, 0.7)) border-box;
  box-shadow:
    0 32px 70px -16px rgba(0, 0, 0, 0.82),
    0 0 0 1px rgba(251, 191, 36, 0.45),
    0 0 80px rgba(251, 191, 36, 0.55),
    0 0 120px rgba(244, 114, 182, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}
.${p}__card--record::before {
  background: conic-gradient(
    from 0deg,
    transparent 0deg 40deg,
    rgba(251, 191, 36, 0.75) 80deg,
    transparent 110deg 200deg,
    rgba(255, 255, 255, 0.45) 240deg,
    transparent 280deg 360deg
  );
  opacity: 0.75;
  animation-duration: 3.2s;
}
.${p}__card--record::after {
  background: linear-gradient(155deg, rgba(42, 32, 10, 0.97), rgba(10, 6, 0, 0.98));
}
.${p}__metal {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  background: linear-gradient(
    125deg,
    rgba(255, 255, 255, 0.22) 0%,
    transparent 24%,
    transparent 52%,
    rgba(165, 243, 252, 0.12) 78%,
    rgba(255, 255, 255, 0.08) 100%
  );
  opacity: 0.85;
  z-index: 0;
}
.${p}__sheen {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  background: linear-gradient(
    115deg,
    transparent 22%,
    rgba(255, 255, 255, 0.32) 46%,
    rgba(103, 232, 249, 0.22) 52%,
    transparent 70%
  );
  transform: translate3d(-80%, 0, 0);
  animation: ${p}-sheen 1.25s ease-out 0.15s both;
}
.${p}__stars {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  gap: 0.45rem;
  margin-bottom: 1rem;
  font-size: 1.55rem;
  line-height: 1;
}
.${p}__star {
  color: rgba(148, 163, 184, 0.32);
  transform: scale(0.45);
  opacity: 0;
  animation: ${p}-star-in 480ms cubic-bezier(0.12, 0.9, 0.2, 1) forwards;
  filter: drop-shadow(0 0 0 transparent);
}
.${p}__star.is-lit {
  color: #fbbf24;
  filter: drop-shadow(0 0 12px rgba(251, 191, 36, 0.95));
}
.${p}--lose .${p}__star.is-lit {
  color: #fb7185;
  filter: drop-shadow(0 0 12px rgba(251, 113, 133, 0.9));
}
.${p}--record .${p}__star.is-lit {
  color: #fde68a;
  filter: drop-shadow(0 0 16px rgba(251, 191, 36, 1));
  animation-name: ${p}-star-record;
}
.${p}__stats {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 0.6rem;
  margin: 0 0 1.25rem;
  font-size: 0.92rem;
}
.${p}__stat {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  padding: 0.65rem 0.9rem;
  border-radius: 0.75rem;
  background: rgba(4, 8, 18, 0.78);
  border: 1px solid rgba(165, 243, 252, 0.16);
  box-shadow: inset 0 0 20px rgba(45, 212, 191, 0.06);
}
.${p}__stat-label,
.${p}__stat dt {
  color: #94a3b8;
}
.${p}__stat-value {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #fff;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 16px rgba(165, 243, 252, 0.55);
}
.${p}__stat-value.is-punch {
  animation: ${p}-score-punch 420ms cubic-bezier(0.12, 0.9, 0.2, 1);
}
.${p}__actions {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.${p}__actions.is-tight,
.${p}__actions--tight {
  margin-top: 0.35rem;
}
.${p}__btn {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  min-height: 52px;
  padding: 0.8rem 1.5rem;
  border: none;
  border-radius: 0.85rem;
  font-size: 1.05rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  touch-action: manipulation;
  transition: transform 140ms ease, filter 140ms ease, box-shadow 140ms ease;
}
.${p}__btn:active {
  transform: scale(0.97);
}
.${p}__primary {
  color: #042f2e;
  border-radius: 0.55rem;
  background: #2dd4bf;
  box-shadow:
    0 0 0 1px rgba(165, 243, 252, 0.45),
    0 0 34px rgba(45, 212, 191, 0.7),
    0 0 64px rgba(244, 114, 182, 0.25),
    0 8px 24px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
}
.${p}--lose .${p}__primary {
  color: #fff;
  background: #e11d48;
  box-shadow:
    0 0 0 1px rgba(251, 113, 133, 0.55),
    0 0 34px rgba(244, 63, 94, 0.7),
    0 8px 24px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
}
.${p}--record .${p}__primary {
  color: #422006;
  background: #fbbf24;
  box-shadow:
    0 0 0 1px rgba(253, 224, 71, 0.65),
    0 0 38px rgba(251, 191, 36, 0.8),
    0 0 70px rgba(244, 114, 182, 0.22),
    0 8px 24px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
}
.${p}__btn-shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 35%, rgba(255, 255, 255, 0.55) 50%, transparent 65%);
  transform: translate3d(-120%, 0, 0);
  animation: ${p}-btn-shine 2.1s ease-in-out 0.5s infinite;
  pointer-events: none;
}
.${p}__secondary {
  color: #e2e8f0;
  background: rgba(30, 41, 59, 0.78);
  border: 1px solid rgba(165, 243, 252, 0.28) !important;
  box-shadow: inset 0 0 20px rgba(45, 212, 191, 0.06);
}
.${p}__secondary:hover,
.${p}__secondary:focus-visible {
  border-color: rgba(165, 243, 252, 0.55) !important;
  background: rgba(51, 65, 85, 0.9);
}

@keyframes ${p}-rays { to { transform: rotate(360deg); } }
@keyframes ${p}-shock {
  from { transform: scale(0.15); opacity: 0.95; }
  to { transform: scale(22); opacity: 0; }
}
@keyframes ${p}-char-in {
  to { opacity: 1; transform: none; }
}
@keyframes ${p}-char-glitch {
  0% { opacity: 0; transform: translate3d(-4px, 24px, 0) skewX(-6deg); }
  40% { opacity: 1; transform: translate3d(2px, 0, 0) skewX(2deg); }
  70% { transform: translate3d(-1px, 0, 0); }
  100% { opacity: 1; transform: none; }
}
@keyframes ${p}-fade-up {
  from { opacity: 0; transform: translate3d(0, 12px, 0); }
  to { opacity: 1; transform: none; }
}
@keyframes ${p}-card-in {
  from { opacity: 0; transform: translate3d(0, 28px, 0) scale(0.9); }
  to { opacity: 1; transform: none; }
}
@keyframes ${p}-sheen {
  from { transform: translate3d(-80%, 0, 0); opacity: 0; }
  30% { opacity: 1; }
  to { transform: translate3d(80%, 0, 0); opacity: 0; }
}
@keyframes ${p}-star-in {
  to { opacity: 1; transform: scale(1); }
}
@keyframes ${p}-star-record {
  0% { opacity: 0; transform: scale(0.3) rotate(-20deg); }
  70% { opacity: 1; transform: scale(1.25) rotate(8deg); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes ${p}-cta-flow {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
@keyframes ${p}-btn-shine {
  0%, 50% { transform: translate3d(-120%, 0, 0); }
  78%, 100% { transform: translate3d(120%, 0, 0); }
}
@keyframes ${p}-aurora {
  from { transform: translate3d(-4%, -2%, 0) scale(1); }
  to { transform: translate3d(4%, 3%, 0) scale(1.08); }
}
@keyframes ${p}-sparkle {
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.03); }
}
@keyframes ${p}-bloom {
  from { opacity: 0.55; transform: scale(0.92); }
  to { opacity: 1; transform: scale(1.08); }
}
@keyframes ${p}-border-spin { to { transform: rotate(360deg); } }
@keyframes ${p}-score-punch {
  0% { transform: scale(1); }
  40% { transform: scale(1.28); text-shadow: 0 0 28px rgba(165, 243, 252, 0.95); }
  100% { transform: scale(1); }
}
@keyframes ${p}-kicker-flash {
  from { opacity: 0.8; filter: brightness(0.95); }
  to { opacity: 1; filter: brightness(1.15); text-shadow: 0 0 32px rgba(251, 191, 36, 1); }
}
@keyframes ${p}-glitch {
  0%, 90%, 100% { transform: none; opacity: 0.4; }
  92% { transform: translate3d(-2px, 0, 0); opacity: 0.7; }
  94% { transform: translate3d(2px, 0, 0); opacity: 0.55; }
  96% { transform: translate3d(-1px, 1px, 0); }
}

@media (prefers-reduced-motion: reduce) {
  .${p}__rays,
  .${p}__shockwave,
  .${p}__shockwave-2,
  .${p}__sheen,
  .${p}__char,
  .${p}__star,
  .${p}__card,
  .${p}__kicker,
  .${p}__subtitle,
  .${p}__btn-shine,
  .${p}__aurora,
  .${p}__sparks,
  .${p}__bloom,
  .${p}__scanlines,
  .${p}__card::before {
    animation: none !important;
  }
  .${p}__char,
  .${p}__star,
  .${p}__card {
    opacity: 1;
    transform: none;
  }
  .${p}__rays { opacity: 0.28; }
  .${p}__shockwave,
  .${p}__shockwave-2 { display: none; }
  .${p}__aurora { opacity: 0.45; }
  .${p}__sparks { opacity: 0.5; }
}
html[data-juice-fx="off"] .${p}__rays,
html[data-juice-fx="off"] .${p}__shockwave,
html[data-juice-fx="off"] .${p}__shockwave-2,
html[data-juice-fx="off"] .${p}__sheen,
html[data-juice-fx="off"] .${p}__btn-shine,
html[data-juice-fx="off"] .${p}__aurora,
html[data-juice-fx="off"] .${p}__sparks,
html[data-juice-fx="off"] .${p}__bloom,
html[data-juice-fx="off"] .${p}__card::before {
  animation: none !important;
}
html[data-juice-fx="off"] .${p}__shockwave,
html[data-juice-fx="off"] .${p}__shockwave-2 { display: none; }
html[data-juice-fx="off"] .${p}__rays { opacity: 0.22; }
html[data-juice-fx="off"] .${p}__aurora { opacity: 0.35; }
`;
}
