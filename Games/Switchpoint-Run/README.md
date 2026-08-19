# 岔道疾走 Switchpoint Run

A railway route-choice runner. Every junction's branches are previewed in full
before you commit to one; a pursuing train closes the gap whenever your
current speed falls behind its own relentless pace. The design spine is
choosing a route with known information, not reacting to what a reflex-dodge
game throws at you at the last second (that's the sibling game in this
category, 霓虹疾馳 / Cyber Neon Rush).

Spec: [`04-sports-arcade/switchpoint-run.md`](../../04-sports-arcade/switchpoint-run.md)

## Running it

```
npm install   # from repo root
npm run dev   # inside Games/Switchpoint-Run
npm run check # self-checks
npm run balance # balance harness (prints numbers, not pass/fail)
```

## Architecture

- `src/game/` — pure simulation, no DOM imports. `rng.ts` (FNV-1a seed hash +
  mulberry32 + labelled streams + Fisher-Yates shuffle), `constants.ts` (every
  tunable number, all commented with why), `branches.ts` (the branch template
  pool — pure data), `engine.ts` (`createRun` + `step`), `types.ts`.
- `src/App.tsx` / `src/components/GameCanvas.tsx` — React shell and a 2D
  Canvas renderer that reads a ref in a `requestAnimationFrame` loop, so React
  itself never re-renders at 60fps.
- `scripts/self-check.ts` — headless assertions, run via `npm run check`.
- `scripts/balance.ts` — the four measurements the spec commits to, run via
  `npm run balance`. Prints numbers; it is not pass/fail.

The whole run is a pure function of `(seed, input sequence)`: `step(state,
input, dt)` returns a new `RunState` and never mutates its input. The only
randomness — which branch templates a junction offers — comes from a stream
labelled by junction id (`streamRng(seed, 'junction:${id}:pick')`), so it is
exactly as replayable as everything else. `Math.random` appears exactly once
in the whole game, in `rng.ts`'s `randomSeedCode()`, which runs before a run
starts and never during one.

## The three axes, and how "no branch dominates" is enforced

A branch template has three independent axes:

| axis | values |
|---|---|
| speed | `decel` (0.84×) / `hold` (1.0×) / `accel` (1.1×) |
| density | the template's own obstacle count |
| reward | `none` / `supply` (+buffer) / `score` (+score multiplier, permanent) |

The rule "speed and reward must be paid for with density" is not a design
aspiration checked by eyeballing the templates — it's a numeric floor,
`densityFloor(speed, reward) = DENSITY_FLOOR[speed] + REWARD_DENSITY_TAX[reward]`,
and `template()` in `branches.ts` **throws at import time** if an authored
template's obstacle count is below its own floor. A self-check additionally
asserts the aggregate claim across the whole pool: whichever template has the
single highest speed multiplier must not also have a reward AND the lowest
density in the pool. Authoring a new template never touches `engine.ts`.

## Self-checks: what I proved can go red

`npm run check` runs 21 assertions. Three of them I deliberately broke and
watched fail, rather than just writing "this should work" and trusting it —
the task's own hard-won-lessons list is explicit that an assertion that has
never been observed to fail proves nothing.

**1. The density-floor rule, on a constructed violator.** Check 3b builds a
`cheat` template (`accel` speed, `score` reward, 1 obstacle) and confirms the
same floor assertion used on the real pool rejects it:
```
assert.ok(cheatTemplate.obstacles.length >= floor, 'density below floor');
```
fails with `AssertionError: density below floor` before the `ok()` call, which
the test catches and turns into a pass — i.e., it proves the *real* check
would have caught this shape of bug had it shipped.

**2. "Every junction offers a survivable branch", on a genuinely unsurvivable
one.** Check 4b constructs a junction where all three lanes are walled at the
same offset, runs the idle pilot through it, and asserts a hit is registered.
Message on success: `a deliberately unsurvivable junction (every lane walled)
is provably NOT clearable`. Without 4b, check 4 (every authored template is
individually clearable by a perfect-foreknowledge pilot) would be unfalsifiable
— nothing would prove the pilot could ever detect a bad template.

**3. The perfect-clearability pilot itself, twice, during development — not
shipped broken, but worth being honest about.** The first version of check 4's
loop broke out on the very first tick, before the branch had even been
entered (`activeBranch` is still `null` for one tick while a lock point is
being crossed), so every template "passed" with zero hits because nothing had
run. Rewriting it to wait for `entered` before checking exposed two real
authoring bugs it was supposed to catch:
- `supply-siding` failed because the pilot's obstacle-reaction trigger was a
  flat "react within 90 units" distance, which at a slow `decel` pace made the
  jump start so early it finished (`JUMP_DURATION`) before the hurdle arrived.
  Fixed by deriving the trigger distance from the action's own duration and
  the player's current speed (`pickUpcoming` in both `self-check.ts` and
  `balance.ts`).
- `floodgate` failed because its wall obstacles didn't share the same period
  as the 3-lane cycle, so dodging one wall by defaulting to "the first lane
  that isn't this one" could walk straight into a second wall in that lane a
  few units later. Fixed at two levels: `chooseSafeLane` now picks whichever
  candidate lane's own nearest obstacle is farthest away, and the template's
  kind-cycle period was aligned to the lane period (3) so its walls land on
  one predictable lane instead of scattering across all three.

Every one of these was a real bug caught by the check doing its job, not a
scripted demonstration — I mention that so the demonstration doesn't read as
staged. The template/engine fixes are shipped; the broken pilot code is not
(it was fixed in place, and the two authoring bugs it exposed were fixed in
`branches.ts`/`scripts/*.ts` too).

**Other checks, briefly:**
- Determinism: same seed + input sequence reproduces byte-identical
  `JSON.stringify` state, over 4000 ticks with jump/slide/lane-change mixed in.
- `step()` never mutates its input, including the nested `pendingJunction`
  object one level deeper than the flat fields (a mutation test that only
  checks the top level would miss exactly this class of bug).
- The train can catch an idle player (13s, 1686 distance) and a flawless
  always-fastest pilot survives a full 1500s measurement window with buffer
  trending up (2079 → 42827) rather than merely "not yet zero" — both
  directions of "the core tension exists" are exercised, not asserted once
  and assumed to generalise.
- Hit stun is reachable through the real engine path (a wall obstacle forced
  in the player's lane), not just checked as a formula in isolation.
- A run terminates with no input (guarded against an infinite loop).
- The player cannot be driven off the 3-lane track by holding a direction.
- RNG hygiene: `hashString` stability, independent labelled streams,
  Fisher-Yates is a real permutation and doesn't mutate its input, and no file
  under `src/game/` (besides `rng.ts` itself) calls `Math.random` or shuffles
  with an inconsistent comparator.

## Balance harness: measured numbers

All four numbers the spec commits to measuring, from `npm run balance`
(8 seeds, one shared execution pilot with a 18%-per-obstacle mistake rate
across every row so policies differ only in which branch they choose, not how
well they execute it — see "what I couldn't fully resolve" below for why that
rate is a floor-on-playability figure, not a claim about real players).

### 1. Does any single choice policy dominate?

Measured over a shared **900-second (15-minute) session cap** — see the note
below on why an unbounded "run until it dies" comparison turned out to be the
wrong question to ask this game.

```
策略       平均距離   平均分數   平均秒數  平均撞擊  清過的岔道  撐滿場次
fastest      184415     271702       790s      86.9       155.3  7/8
safest         2806       2863        20s       1.0         2.0  0/8
reward       124613     183477       583s      35.1       109.8  5/8

最遠/最近策略的距離比：65.72x
```

`safest` (always the lowest-density offered branch, which is almost always a
`decel` template) dies in 20 seconds on every single seed. This is the game
working as designed, not a bug: `decel`'s multiplier (0.84×) times a pace
equal to the train's own means standing pat on safety alone is a losing
proposition — matching the spec's "安全的支線速度會衰減" literally. The 65.7×
spread is dominated by comparing a policy the game is explicitly built to
punish against the two genuinely viable ones. **The more informative
comparison is `fastest` vs `reward` — the two strategies a real player would
actually choose between — which sit at 1.48×.** That is comparable, not one
crushing the other. I'm reporting the full 3-way ratio rather than only the
flattering 2-way one, because picking which comparison to show is itself a
place measurement can quietly mislead.

### 2. Branch template pool reach and run-to-run overlap

```
池子大小        14
一趟被提供到    96% 的池子
一趟實際選過    11.5 種模板
兩趟之間重疊    69%
```

⚠ This one did **not** come back clean, and I'm not going to dress it up. A
900-second `informed` run clears on the order of 100+ branches; against a
14-template pool, seeing 96% of it and repeating 69% of what a previous run
saw is close to inevitable — the pool is too small for a *long* session. It
is much better-shaped for a *short* one: `safest` (20s, 2 branches) and the
early game of any policy only ever draw from the 5 tier-0 templates, which is
a real, if narrow, choice every time. The honest read is that pool depth
scales with session length in a way this repo's Danmaku-Abyss (bounded to 5
stages, ~15 upgrade picks) didn't have to deal with — an endless runner's
"how many junctions will a real run see" isn't a fixed number the way a
5-stage game's is. Authoring more templates (the mechanism, `template()` in
`branches.ts`, already supports it with zero engine changes) would be the
direct fix; I did not do it here given the time budget.

### 3. The buffer curve

```
距離區段     樣本數  平均緩衝  最低緩衝
0-1000           32       241       201
1000-2500        48       301       181
2500-5000        74       395        45
5000-9000       112       732       209
9000-∞         5649      6645       251

400 距離內死亡的種子數：  0/8
400 距離內最低緩衝：      240
4000 距離後最低緩衝：     209
```

No "dead at the start" (0/8 seeds die inside the first 400 distance; the
buffer never drops below 201 in that stretch even under the `informed`
policy's real mistakes). No "unkillable once past the opening" either — the
2500-5000 band shows a real buffer trough of 45 (a near-death recovery, not a
death, which is exactly the "recoverable near-miss" the spec's buffer design
is for), and even past 9000 distance the sampled minimum (251) sits well
below the 6645 average, i.e. the swings stay real rather than the curve
flattening into a monotonic climb.

### 4. Does the preview carry information? Blind vs informed

```
盲選   平均距離    68878   平均分數 94227
讀預覽 平均距離   184702   平均分數 278548

距離差：+115823（168%）　分數差：+184321
```

Reading the preview (buffer-aware: safest branch under 90 buffer, fastest
above 190, a reward branch in between) beats ignoring it entirely by **168%**
on distance and roughly 3× on score, using the identical execution pilot on
both sides. If this gap had been small, the preview would be decoration; it
is not.

## What the measurement contradicted (and how it was fixed, not hidden)

Balance work here happened by measuring and adjusting, same as the spec asks
for, and it caught real design mistakes rather than confirming a design that
was already correct on the first try:

1. **Distance-keyed difficulty was a feedback loop.** The first version made
   both `playerBasePace` and `trainPace` functions of accumulated *distance*.
   Since distance is itself produced by speed, this is positive feedback: more
   speed → more distance → more speed. The `fastest`-policy balance row
   reached 9.6 million distance and a sampled buffer of 9,943 near the tail of
   an otherwise-normal run — numbers with no relationship to a real few-minute
   session. Fixed by ramping off *elapsed seconds* instead (bounded, not
   produced by anything the player controls) and capping the ramp at
   `RAMP_CAP_SEC` (240s) so a flawless pilot's advantage over the train stops
   growing once the run has gone on long enough that "still climbing" stops
   meaning anything.
2. **"Hold" branches carried a free, permanent surplus.** `PLAYER_BASE_SPEED`
   started 22 units/sec above `TRAIN_BASE_SPEED`, so simply never taking a
   risk (an unbroken string of `hold` branches) was, on its own, enough to
   never lose — the opposite of "speed can only be taken from risky branches".
   Fixed by setting them equal: a `hold` branch is now exactly neutral, and
   only `accel` (density-taxed) pays out a real surplus.
3. **A mistake roll that couldn't actually cost anything.** The execution
   pilot originally rolled a fresh "did I fail this obstacle" check on *every
   tick* an obstacle stayed inside its reaction window, rather than once per
   obstacle. A "mistake" tick just deferred to next tick's fresh roll, so the
   real per-obstacle failure probability was `MISTAKE_RATE^(ticks in window)`
   — for any multi-tick window this collapses to nearly zero regardless of
   the configured rate. This is exactly why raising `MISTAKE_RATE` from 0.05
   to 0.35 barely moved the measured hit count in an intermediate run — the
   parameter was real, the wiring consuming it was not. Fixed by rolling once
   per obstacle *instance* (keyed by the branch's own start distance, since
   the same template recurs many times over a long run) and remembering the
   verdict.
4. **Both bugs above compounded into the same wrong-question territory**:
   once genuinely fixed, `fastest` still doesn't die on an *unbounded*
   timeline, for a real, understood reason — a run whose difficulty ramp is
   flat past `RAMP_CAP_SEC` and whose chosen policy has any positive expected
   value per branch is a positive-drift process, and a positive-drift process
   given long enough essentially never returns to zero. That's not a
   balance bug, it's what "a flawless pilot on a good policy should be able
   to survive a long time" has to mean once the ramp is bounded (see item 1).
   The fix wasn't to chase an ever-more-punishing mistake rate until even
   perfect play eventually loses — it was to stop asking "does it eventually
   die" and measure "how far does it get within a realistic session" instead
   (the 900-second cap in measurement 1).

## What browser verification actually confirmed

Chromium (`/opt/pw-browsers/chromium-1194`) driven via Playwright against
`vite preview`:

- The menu screen renders and the start button works.
- The canvas genuinely paints: confirmed **by screenshot**, not just by
  reading pixel data back out of it — an automated "sample the top-left 1000
  pixels of `getImageData` and check for non-zero bytes" check reported the
  canvas as blank, which was the check's own bug (almost certainly a timing
  or region issue, not investigated further), not a real rendering failure. A
  direct screenshot at the same point in the run shows the buffer gauge, the
  three-lane preview strip with correct per-branch speed glyphs / density
  dots / reward labels, the dashed lock line, and the player sprite, all
  rendering correctly. This is exactly the case the task's instructions
  warned about — question the heuristic before concluding the feature is
  broken — and here questioning it was right: the screenshot evidence
  overrides the failed pixel-sample heuristic.
- `←`/`→` genuinely move the player between lanes: screenshotted before and
  after an `ArrowRight` press, showing the player sprite move from the centre
  lane into the right lane, and the right lane correctly rendering as "封閉"
  (closed) — a 2-branch junction with the third lane unavailable, which is
  exactly the mechanic self-check 4b exercises headlessly.
- `↑` (jump) visibly changes the player's rendering (raised position + a
  ground shadow beneath it), confirmed by screenshot.
- The junction preview genuinely appears and updates: every screenshot shows
  the top strip with per-lane speed tier, density-dot count, and reward glyph,
  matching the currently pending junction.
- The game-over overlay appears once the train catches the player, and its
  restart button **wins its own hit-test**: `document.elementFromPoint` at the
  button's centre returns the `<button>` element (or an ancestor via
  `closest('button')`), not the canvas underneath it — the exact failure mode
  Cyber-Neon-Rush shipped, where a shared-component overlay rendered
  unstyled and unclickable because its game's Tailwind config never scanned
  `/shared` (this game's `src/index.css` does include the required `@source
  '../../../shared';`, and `node scripts/check-shared-styles.mjs` confirms it
  from the repo root).
- Clicking restart actually returns to a fresh, playable run (canvas visible
  again, overlay gone).

## What I did not verify

- **Touch/swipe controls** are implemented (`onPointerDown`/`onPointerUp` with
  a 28px directional threshold in `App.tsx`) but were not exercised through
  Playwright's touch emulation — only keyboard input was driven in the
  browser check. The underlying input plumbing (`laneStepRef` /
  `jumpRef` / `slideRef`) is identical to the keyboard path, so it should
  behave the same, but that is inference from shared code, not an observed
  touch-event test.
- **Real human playability** is not established by anything in this repo.
  Every balance number comes from a scripted pilot with a fixed, tuned
  mistake rate; per the task's own instructions, that is a floor on
  playability, not a description of it. I have not played the game myself
  through many runs to sanity-check how it *feels*, only confirmed via
  Playwright that a handful of manual inputs behave correctly and via the
  headless harness that the mechanics are internally consistent.
- **The template pool's shortage under long sessions** (measurement 2 above)
  is documented but not fixed — I did not author additional templates to
  bring the overlap number down.
- I did not attempt to find a policy tuning that makes `fastest` die within
  the unbounded measurement window; I concluded that was the wrong question
  (see "what the measurement contradicted", item 4) rather than continuing to
  chase it, and I want that judgment call visible rather than buried in a
  number that looks resolved.

## Controls

- Keyboard: `←`/`→` switch lanes (and, in the approach to a junction, choose
  which branch you'll take), `↑` jump (clears a low hurdle), `↓` slide (clears
  a high beam), `P` or `Esc` pause.
- Touch: swipe left/right to switch lanes, swipe up to jump, swipe down to
  slide.
- A seed code (menu screen) reproduces the exact same sequence of junctions
  and branch contents — the "seed sharing" variant the spec calls out.


---

## Review 之後的修正（規劃者複查）

實作完成後由規劃者複查，量測工具自己印出的四個 ⚠ 警告全部處理掉了。過程中有三次是**量測或設計前提有問題**，不是實作有問題。

### 1. 追趕列車會被永久甩開

`buffer` 是「玩家速度減列車速度」的**積分**，沒有上限。只要持續比列車快，領先就無限累積：

| 距離區段 | 修正前平均緩衝 |
|---|---|
| 0–1000 | 241 |
| 5000–9000 | 732 |
| 9000+ | **6645** |

而且 `fastest` 策略 **7/8 的跑程不是死掉，是撞到量測的 900 秒上限**——這個遊戲對稱職的玩家沒有失敗狀態。安全支線之所以是死內容，正是因為列車早就不是威脅了。

加上 `MAX_BUFFER` 上限後，撐滿場次從 7/8 降到 **0/8**，後期最低緩衝降到 1。追趕活過來了。

### 2. 一條斷言編碼了要被移除的設計

加上上限後，一項自我測試變紅：

```
buffer went from 430 to 430 over the run —
flawless play should be building buffer, not merely surviving
```

它斷言的是「完美操作應該持續累積領先」——正是剛被判定為缺陷的行為。改成同時鎖住兩半：完美操作**必須頂到上限**（否則完美沒有回報），而且**不能超過上限**（否則追趕會結束）。少任何一半都會讓缺陷回來。

### 3. 固定失誤率預先假設了「速度是免費的」

量測駕駛的失誤率固定在 0.18，跟速度無關。對跑酷遊戲而言這等於宣稱「人類在任何速度下閃避得一樣好」，而它**直接決定了這個工具要回答的問題的答案**：如果速度的唯一代價是密度，而駕駛應付得了密度，那「永遠選最快」必然勝出。

改成依實際速度計算失誤機率（反應窗口隨速度縮短）之後：

| 策略 | 固定失誤率 | 速度感知失誤率 |
|---|---|---|
| fastest | 81,424 | 26,827 |
| bank（緩衝滿時選安全） | 45,439（落後 44%） | 23,209（**落後 13%**） |
| reward | 26,048 | 19,617 |
| 最大差距 | 29.0× | **9.5×** |

固定失誤率掩蓋了速度的大部分代價。**這個結論原本是駕駛模型的性質，不是遊戲的性質。**

### 4. 判準把稻草人算進去了

`safest`（永遠選最慢）速度低於列車，必然被追上——那是設計上正確的，遊戲本來就要求你偶爾得衝。但把它算進「最大/最小距離比」會讓數字永遠難看，而**偷偷排除它去美化數字更糟**。

判準改成兩個數字都報，並在**可行策略**上下判斷，同時明講哪個策略不可行與為什麼：

```
最遠/最近策略的距離比：9.50x
可行策略（平均距離 ≥ 8000）：fastest、reward、bank —— 彼此差距 1.37x
不可行：safest（單調策略，速度低於列車必然被追上）
✓ 可行策略落在可比較區間，沒有一種碾壓其他
```

### 5. 模板池太小

14 個模板對上一趟 20–70 個岔口：一趟看到 95% 的池子、兩趟重疊 62%。這是蛇窟迴廊出貨時那個 98%/72% 的同型問題。

擴到 26 個（新增的只在既有速度／收益層級上變化**形狀**，不發明新層級，所以上面的平衡結論仍然成立）：**一趟看到 87%、兩趟重疊 38%**。

順帶一提，`template()` 的 import-time 密度下限檢查在這次擴充時**抓到了規劃者自己的錯誤**（`short-spur: density 7 is below the floor 9 for accel/none`）——它擋的不只是未來的作者。

### 樣本量加到 24 之後，這一節的排序翻了

上面所有「落後 13%」「差距 1.37x」的比較都是 **8 個種子**跑出來的。姊妹作彈幕深淵在同一個 session 裡證明了八個種子撐不起這種比較——它的每階段存活率從 8 種子的 `63/38/50` 變成 24 種子的 `25/71/54`，把最難的階段標成了最簡單的。

所以這裡也重量了一次：

| 策略 | 8 種子 | **24 種子（±95% 區間）** |
|---|---|---|
| fastest | 26,827 | 24,787 **±4,517** |
| bank（緩衝滿時選安全） | 23,209（落後 13%） | **28,656 ±5,356**（反而領先 16%） |
| reward | 19,617 | 16,124 ±3,153 |
| safest | 2,823 | 4,316 ±1,404 |

**順序反轉了。** 但更重要的是兩者的區間大幅重疊：fastest 是 `[20270, 29304]`、bank 是 `[23300, 34012]`。

所以**正確的說法是「fastest 與 bank 分不出高下」**——不是任何一方領先。我先前在這份 README 裡寫的「永遠選最快就是支配策略，安全支線是死內容」**是錯的**，它建立在一個 8 種子的排序上，而那個排序禁不起樣本量。

判準也跟著改了：現在除了比值，還會計算**可行策略之間有幾對區間真的分得開**（目前 2/3），因為兩個平均值差 1.78 倍在區間重疊時什麼都不代表，而**單看比值永遠看不出這件事**。

需要說明的是，因此而做的那個改動——把駕駛的失誤率從固定值改成隨速度上升——**仍然成立且保留**。它的理由本來就不是「fastest 贏太多」，而是「固定失誤率等於宣稱人類在任何速度下閃避得一樣好，那對跑酷遊戲是錯的」。被推翻的是排序，不是那個模型修正。

---

### 目前狀態

```
策略       平均距離（24 種子，±95%）   撐滿場次
bank          28656 ±5356               0/24
fastest       24787 ±4517               0/24
reward        16124 ±3153               0/24
safest         4316 ±1404               0/24   （單調策略，設計上不可行）

可行策略中區間不重疊的配對：2/3
  —— bank 與 fastest 分不出高下，兩者都與 reward 分得開

池子 26　一趟看到 87%　兩趟重疊 38%
緩衝：開局不必死，4000 距離後最低仍會降到 1
預覽：讀預覽比盲選遠 87%
```
