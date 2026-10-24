# 達達馬蹄 Clip-Clop

A QWOP-style horse race homage to tsuyatt's [Clip-Clop (おうまパカパカ)](https://tsuyatt.com/games/clip-clop/):
control each of the four legs with `Q`/`W`/`O`/`P` and gallop 50 m within 90 seconds.

The simulation is a faithful port of the original's physics engine (parameters extracted from its
JavaScript module): 240 Hz fixed step, hoof spring struts, velocity-chasing leg swing with
traction kicks, contact-count balance springs, tip torques, tumble-and-flail falls,
aspect-fitting chase camera, and the original 22/32/50 s rank table.

Extras: ghost replay of your best run, local leaderboard, 7 achievements, practice mode,
tilt warning, true hoof IK with hoofprints, finish-line crowd and confetti, PWA offline support.

- `Q` left hind · `W` right hind · `O` left front · `P` right front (colored bands match)
- Hold to swing a leg forward, release to kick the ground
- `R` get up after a tumble, `Space` start/retry, `Esc` back to this game's title, `M` mute
- Fast technique: short taps with near-immediate diagonal pair swaps
