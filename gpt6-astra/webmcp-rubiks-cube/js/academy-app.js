/* Rubik's Cube Academy — host UI (Traditional Chinese). Depends on RubiksCube + curriculum modules. */
(function () {
  "use strict";

  const RC = () => globalThis.RubiksCube;
  const $ = (id) => document.getElementById(id);

  const state = {
    mode: "learn", // learn | sheet | drill | timer | freeplay
    progress: null,
    times: null,
    practice: null,
    lessonId: "basics-pieces",
    quizIndex: 0,
    playback: { tokens: [], index: 0, playing: false, timer: null },
    timer: {
      phase: "idle", // idle | inspect | running | stopped
      inspectLeft: 15,
      startPerf: 0,
      elapsedMs: 0,
      scramble: "",
      raf: 0,
      inspectTimer: null,
      recorded: false,
    },
    drill: {
      stageId: "white-cross",
      case: null,
      timed: false,
      startPerf: 0,
      elapsedMs: 0,
      raf: 0,
      solved: false,
    },
    solvePlan: null,
    solveStep: 0,
    engine: null,
    renderer: null,
    queue: null,
    controller: null,
    adapter: null,
    logger: null,
  };

  function toast(msg) {
    RC().showToast(msg);
  }

  function faces() {
    return state.engine.getFaces();
  }

  function proficiencyBlurb(lesson) {
    const stageId = CubeProgress.LESSON_STAGE[lesson.id];
    if (!stageId || !state.practice) return lesson.blurb;
    const stat = state.practice.byStage[stageId];
    if (!stat || !stat.attempts) return lesson.blurb;
    const avg = CubeProgress.stageAverageMs(stat);
    const avgText = avg != null ? ` · 均 ${CubeProgress.formatMs(avg)}` : "";
    const bestText = stat.bestMs != null ? ` · 最佳 ${CubeProgress.formatMs(stat.bestMs)}` : "";
    return `練 ${stat.solves}/${stat.attempts}${bestText}${avgText}`;
  }

  function refreshProgressChrome() {
    const lessons = CubeCurriculum.LESSONS;
    const done = Object.keys(state.progress.completed).length;
    $("progress-summary").textContent = `進度 ${done}/${lessons.length}`;
    const list = $("lesson-list");
    list.replaceChildren();
    for (const lesson of lessons) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lesson-item";
      const complete = Boolean(state.progress.completed[lesson.id]);
      const current = lesson.id === state.lessonId;
      btn.setAttribute("aria-current", current ? "step" : "false");
      if (complete) btn.classList.add("done");
      if (current) btn.classList.add("current");
      btn.innerHTML = `<span class="li-title">${lesson.title}</span><span class="li-blurb">${proficiencyBlurb(lesson)}</span>`;
      btn.addEventListener("click", () => selectLesson(lesson.id));
      list.append(btn);
    }
  }

  function selectLesson(id) {
    state.lessonId = id;
    state.quizIndex = 0;
    state.progress = CubeProgress.setCurrentLesson(state.progress, id);
    stopPlayback();
    renderLesson();
    refreshProgressChrome();
  }

  function markLessonDone() {
    state.progress = CubeProgress.markComplete(state.progress, state.lessonId);
    toast("已標記完成 ✓");
    refreshProgressChrome();
    const next = CubeCurriculum.nextLessonId(state.lessonId);
    if (next) {
      $("btn-next-lesson").hidden = false;
      $("btn-next-lesson").dataset.next = next;
    }
  }

  async function runMoves(tokens, source = "Academy") {
    if (!tokens.length) return;
    await state.controller.invoke(
      "cube_execute_algorithm",
      { algorithm: tokens.join(" ") },
      source,
    );
  }

  async function setupLessonCube(lesson) {
    await state.controller.invoke("cube_set_size", { size: 3 }, "Academy");
    if (lesson.setup) {
      // Apply setup without animation for speed.
      const tokens = RC().parseAlgorithm(lesson.setup);
      for (const move of tokens) state.engine.applyPermutation(move);
      state.engine.history = [];
      state.engine.scramble = `練習：${lesson.setup}`;
      await state.engine.publish({ type: "scramble" });
    }
    applyHighlights(lesson.goal);
  }

  function applyHighlights(goalId) {
    const scene = $("scene");
    if (!scene) return;
    scene.querySelectorAll(".sticker").forEach((el) => el.classList.remove("goal-hot"));
    if (!goalId) return;
    const mask = CubePatterns.highlightForStage(goalId);
    for (const slot of mask) {
      const el = scene.querySelector(
        `.sticker[data-face="${slot.face}"][data-index="${slot.index}"]`,
      );
      if (el) el.classList.add("goal-hot");
    }
  }

  function renderLesson() {
    const lesson = CubeCurriculum.lessonById(state.lessonId);
    if (!lesson) return;
    $("lesson-title").textContent = lesson.title;
    $("lesson-blurb").textContent = lesson.blurb;
    $("lesson-body").textContent = lesson.body;
    $("lesson-alg").textContent = lesson.algorithm || "—";
    $("goal-status").textContent = "";
    $("hint-line").textContent = "";
    $("btn-next-lesson").hidden = true;

    const practicePanel = $("practice-controls");
    const conceptHint = $("concept-actions");
    practicePanel.hidden = !(lesson.kind === "stage" || lesson.kind === "notation" || lesson.kind === "notation-quiz");
    conceptHint.hidden = !(lesson.kind === "concept" || lesson.kind === "optional");

    $("quiz-progress").textContent = "";
    if (lesson.kind === "notation-quiz") {
      $("quiz-progress").textContent = `下一步：${lesson.tryMoves[state.quizIndex] || "完成！"}`;
    }

    setupLessonCube(lesson).catch((e) => toast(e.message));
  }

  function stopPlayback() {
    state.playback.playing = false;
    if (state.playback.timer) {
      clearTimeout(state.playback.timer);
      state.playback.timer = null;
    }
  }

  async function playbackStep(delta) {
    const lesson = CubeCurriculum.lessonById(state.lessonId);
    const alg = lesson?.algorithm;
    if (!alg) return;
    if (!state.playback.tokens.length) {
      state.playback.tokens = RC().parseAlgorithm(alg);
      state.playback.index = 0;
      await state.controller.invoke("cube_reset", {}, "Academy");
    }
    if (delta < 0) {
      if (state.playback.index <= 0) return;
      await state.controller.invoke("cube_undo", {}, "Academy");
      state.playback.index -= 1;
      return;
    }
    if (state.playback.index >= state.playback.tokens.length) {
      stopPlayback();
      toast("公式播放完畢");
      return;
    }
    const move = state.playback.tokens[state.playback.index];
    await state.controller.invoke("cube_move", { move }, "Academy");
    state.playback.index += 1;
  }

  async function playbackPlay() {
    if (state.playback.playing) {
      stopPlayback();
      $("btn-play").textContent = "播放";
      return;
    }
    state.playback.playing = true;
    $("btn-play").textContent = "暫停";
    const speed = Number($("speed-range").value) || 1;
    RC().setAnimationMs(Math.round(260 / speed));

    const tick = async () => {
      if (!state.playback.playing) return;
      const lesson = CubeCurriculum.lessonById(state.lessonId);
      if (!state.playback.tokens.length && lesson?.algorithm) {
        state.playback.tokens = RC().parseAlgorithm(lesson.algorithm);
        state.playback.index = 0;
        await state.controller.invoke("cube_reset", {}, "Academy");
      }
      if (state.playback.index >= state.playback.tokens.length) {
        stopPlayback();
        $("btn-play").textContent = "播放";
        toast("公式播放完畢");
        return;
      }
      try {
        await playbackStep(1);
      } catch (e) {
        stopPlayback();
        $("btn-play").textContent = "播放";
        toast(e.message);
        return;
      }
      state.playback.timer = setTimeout(tick, Math.max(80, RC().CONFIG.animationMs + 40));
    };
    tick();
  }

  function checkGoal() {
    const lesson = CubeCurriculum.lessonById(state.lessonId);
    if (!lesson) return;
    if (lesson.kind === "concept" || lesson.kind === "optional") {
      markLessonDone();
      return;
    }
    if (lesson.kind === "notation" || lesson.kind === "notation-quiz") {
      if (lesson.kind === "notation-quiz") {
        if (state.quizIndex >= (lesson.tryMoves?.length || 0)) markLessonDone();
        else toast("請依提示繼續轉面");
        return;
      }
      markLessonDone();
      return;
    }
    if (lesson.goal) {
      const result = CubePatterns.checkStage(lesson.goal, faces());
      if (result.complete) {
        $("goal-status").textContent = "目標達成！";
        $("goal-status").className = "goal ok";
        markLessonDone();
      } else {
        $("goal-status").textContent = "尚未達成目標，再試試或看提示。";
        $("goal-status").className = "goal bad";
      }
    }
  }

  function showHint() {
    const lesson = CubeCurriculum.lessonById(state.lessonId);
    if (!lesson) return;
    if (lesson.hintMoves?.length) {
      $("hint-line").textContent = `建議下一步附近：${lesson.hintMoves.slice(0, 4).join(" ")} …（完整：${lesson.algorithm}）`;
      return;
    }
    const suggestion = BeginnerCoach.suggestNext(state.engine);
    $("hint-line").textContent = `${suggestion.label}：${suggestion.explanation} → ${suggestion.algorithm || "—"}`;
  }

  async function onUserMove(move) {
    const lesson = CubeCurriculum.lessonById(state.lessonId);
    try {
      await state.controller.invoke("cube_move", { move }, "UI");
    } catch (e) {
      $("error").textContent = e.message;
      return;
    }
    $("error").textContent = "";

    if (lesson?.kind === "notation-quiz" && lesson.tryMoves) {
      const expected = lesson.tryMoves[state.quizIndex];
      if (move === expected) {
        state.quizIndex += 1;
        $("quiz-progress").textContent =
          state.quizIndex >= lesson.tryMoves.length
            ? "序列完成！"
            : `下一步：${lesson.tryMoves[state.quizIndex]}`;
        if (state.quizIndex >= lesson.tryMoves.length) {
          toast("記號練習完成");
          markLessonDone();
        }
      } else {
        toast(`應為 ${expected}，你按了 ${move}。已復原該步。`);
        await state.controller.invoke("cube_undo", {}, "Academy");
      }
    }

    if (lesson?.goal) {
      const result = CubePatterns.checkStage(lesson.goal, faces());
      $("goal-status").textContent = result.complete ? "目標達成！可標記完成" : "繼續朝目標前進…";
      $("goal-status").className = result.complete ? "goal ok" : "goal";
      applyHighlights(lesson.goal);
      if (result.complete) markLessonDone();
    }
  }

  function bindMoveGrid(containerId, onMove) {
    const grid = $(containerId);
    if (!grid || grid.dataset.ready) return;
    grid.dataset.ready = "1";
    const handler = onMove || onUserMove;
    for (const move of RC().AVAILABLE_MOVES) {
      const button = RC().textElement("button", move);
      button.type = "button";
      button.className = "move-btn";
      button.setAttribute("aria-label", `轉面 ${move}`);
      button.addEventListener("click", () => handler(move));
      grid.append(button);
    }
  }

  function onDrillMove(move) {
    state.controller.invoke("cube_move", { move }, "UI").catch((err) => toast(err.message));
  }

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll("[data-mode]").forEach((el) => {
      el.hidden = el.getAttribute("data-mode") !== mode;
    });
    document.querySelectorAll(".mode-tab").forEach((btn) => {
      const on = btn.dataset.tab === mode;
      btn.setAttribute("aria-pressed", String(on));
      btn.setAttribute("aria-selected", String(on));
    });
    if (mode === "learn") {
      renderLesson();
      refreshProgressChrome();
    }
    if (mode === "sheet") renderSheet();
    if (mode === "drill") {
      renderDrillChrome();
      if (!state.drill.case) loadDrillCase(true);
    }
    if (mode === "timer") renderTimerChrome();
    if (mode === "freeplay") {
      state.progress.freePlayVisits += 1;
      CubeProgress.saveProgress(state.progress);
    }
  }

  function renderSheet() {
    const host = $("sheet-list");
    host.replaceChildren();
    for (const row of CubeCurriculum.CHEAT_SHEET) {
      const card = document.createElement("article");
      card.className = "sheet-card";
      card.innerHTML = `<header><span class="tag">${row.group}</span><strong>${row.name}</strong></header>
        <code class="alg">${row.alg}</code>
        <p>${row.note}</p>
        <button type="button" class="primary sheet-play">在方塊上播放</button>`;
      card.querySelector(".sheet-play").addEventListener("click", async () => {
        setMode("learn");
        await state.controller.invoke("cube_reset", {}, "Academy");
        state.playback.tokens = RC().parseAlgorithm(row.alg);
        state.playback.index = 0;
        state.lessonId = state.progress.currentLessonId;
        toast(`播放：${row.alg}`);
        $("lesson-alg").textContent = row.alg;
        playbackPlay();
      });
      host.append(card);
    }
  }

  function flashPersonalBest() {
    const el = $("timer-display");
    if (!el) return;
    el.classList.remove("pb-flash");
    void el.offsetWidth;
    el.classList.add("pb-flash");
  }

  function renderTimerChrome() {
    $("timer-display").textContent = CubeProgress.formatMs(state.timer.elapsedMs);
    if ($("pb")) $("pb").textContent = CubeProgress.formatMs(state.times.bestMs);
    $("ao5").textContent = CubeProgress.formatMs(CubeProgress.averageOf(state.times.runs, 5));
    $("ao12").textContent = CubeProgress.formatMs(CubeProgress.averageOf(state.times.runs, 12));
    const list = $("time-history");
    list.replaceChildren();
    for (const run of state.times.runs.slice(-12).reverse()) {
      const li = document.createElement("li");
      li.textContent = `${CubeProgress.formatMs(run.ms)} · ${new Date(run.at).toLocaleString("zh-TW")}`;
      list.append(li);
    }
    $("timer-scramble").textContent = state.timer.scramble || "按「新打亂」開始";
  }

  async function newTimerScramble() {
    stopTimer(false);
    await state.controller.invoke("cube_scramble", { moves: 20 }, "Academy");
    state.timer.scramble = state.engine.getState().scramble;
    state.timer.phase = "idle";
    state.timer.elapsedMs = 0;
    state.timer.recorded = false;
    renderTimerChrome();
    $("timer-phase").textContent = "已打亂。按「開始觀察」或空白鍵（15 秒觀察）";
  }

  /**
   * Stop the timer. Recording only happens when the cube is truly solved
   * (WCA-style gate via CubeProgress.canRecordSolve).
   */
  function stopTimer(attemptRecord) {
    cancelAnimationFrame(state.timer.raf);
    clearInterval(state.timer.inspectTimer);
    const wasRunning = state.timer.phase === "running";
    if (wasRunning) {
      state.timer.elapsedMs = Math.max(
        state.timer.elapsedMs,
        performance.now() - state.timer.startPerf,
      );
    }
    state.timer.phase = "stopped";

    if (!attemptRecord || !wasRunning || state.timer.recorded) {
      renderTimerChrome();
      return { recorded: false, solved: state.engine.isSolved() };
    }

    const solved = state.engine.isSolved();
    if (!CubeProgress.canRecordSolve(solved, state.timer.elapsedMs)) {
      renderTimerChrome();
      return { recorded: false, solved };
    }

    const prevBest = state.times.bestMs;
    const isPb = CubeProgress.isPersonalBest(state.times, state.timer.elapsedMs);
    state.times = CubeProgress.recordTime(
      state.times,
      state.timer.elapsedMs,
      state.timer.scramble,
      { solved: true },
    );
    state.timer.recorded = true;
    renderTimerChrome();
    if (isPb && (prevBest == null || state.timer.elapsedMs < prevBest)) {
      flashPersonalBest();
    }
    return { recorded: true, solved: true, isPb };
  }

  function startInspect() {
    if (!state.timer.scramble) {
      toast("請先產生新打亂");
      return;
    }
    clearInterval(state.timer.inspectTimer);
    cancelAnimationFrame(state.timer.raf);
    state.timer.phase = "inspect";
    state.timer.inspectLeft = 15;
    state.timer.elapsedMs = 0;
    state.timer.recorded = false;
    $("timer-display").textContent = "0.00";
    $("timer-phase").textContent = `觀察中 ${state.timer.inspectLeft}s（空白鍵／開表可提早開始）`;
    state.timer.inspectTimer = setInterval(() => {
      state.timer.inspectLeft -= 1;
      if (state.timer.inspectLeft <= 0) {
        clearInterval(state.timer.inspectTimer);
        beginTiming();
        return;
      }
      $("timer-phase").textContent = `觀察中 ${state.timer.inspectLeft}s（空白鍵／開表可提早開始）`;
    }, 1000);
  }

  function beginTiming() {
    if (!state.timer.scramble) {
      toast("請先產生新打亂");
      return;
    }
    clearInterval(state.timer.inspectTimer);
    state.timer.phase = "running";
    state.timer.startPerf = performance.now();
    state.timer.recorded = false;
    $("timer-phase").textContent = "計時中 — 還原後自動停表（或按停表／空白鍵）";
    const tick = () => {
      if (state.timer.phase !== "running") return;
      state.timer.elapsedMs = performance.now() - state.timer.startPerf;
      $("timer-display").textContent = CubeProgress.formatMs(state.timer.elapsedMs);
      state.timer.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  function finishTimerManual() {
    if (state.timer.phase !== "running") return;
    const result = stopTimer(true);
    if (result.recorded) {
      $("timer-phase").textContent = result.isPb
        ? `個人最佳！${CubeProgress.formatMs(state.timer.elapsedMs)}`
        : `還原成功 ${CubeProgress.formatMs(state.timer.elapsedMs)}`;
      toast(result.isPb ? "新個人最佳！" : "還原成功，成績已記錄");
    } else if (!result.solved) {
      $("timer-phase").textContent = "已停表（尚未還原，不計成績）";
      toast("方塊尚未還原，成績未記錄");
    } else {
      $("timer-phase").textContent = "已停表";
    }
  }

  /** Auto-stop + record when the shared cube becomes solved during a timed run. */
  function onCubeMaybeSolved() {
    if (state.mode === "timer" && state.timer.phase === "running" && state.engine.isSolved()) {
      finishTimerManual();
      return;
    }
    if (state.mode === "drill") {
      onDrillCubeUpdate();
    }
  }

  function onSpaceTimer(e) {
    if (state.mode !== "timer") return;
    if (e.code !== "Space") return;
    e.preventDefault();
    if (state.timer.phase === "idle" || state.timer.phase === "stopped") startInspect();
    else if (state.timer.phase === "inspect") beginTiming();
    else if (state.timer.phase === "running") finishTimerManual();
  }

  /* -------- 隨機練習（drill） -------- */
  function renderDrillStageChips() {
    const host = $("drill-stage-chips");
    if (!host || host.dataset.ready === "1") return;
    host.replaceChildren();
    for (const stageId of CubePracticeBank.STAGE_ORDER) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "stage-chip";
      btn.dataset.stage = stageId;
      btn.textContent = CubePracticeBank.STAGE_LABELS[stageId];
      btn.setAttribute("aria-pressed", String(stageId === state.drill.stageId));
      btn.addEventListener("click", () => {
        state.drill.stageId = stageId;
        host.querySelectorAll(".stage-chip").forEach((el) => {
          el.setAttribute("aria-pressed", String(el.dataset.stage === stageId));
        });
        loadDrillCase(true);
      });
      host.append(btn);
    }
    host.dataset.ready = "1";
  }

  function renderDrillStats() {
    const box = $("drill-stats");
    if (!box) return;
    const stat = state.practice.byStage[state.drill.stageId] || CubeProgress.emptyStageStat();
    const avg = CubeProgress.stageAverageMs(stat);
    box.innerHTML =
      `<div>本階段嘗試 <strong>${stat.attempts}</strong> · 完成 <strong>${stat.solves}</strong></div>` +
      `<div>最佳 <strong>${CubeProgress.formatMs(stat.bestMs)}</strong> · 平均 <strong>${CubeProgress.formatMs(avg)}</strong></div>`;
  }

  function renderDrillChrome() {
    renderDrillStageChips();
    const chips = $("drill-stage-chips");
    chips?.querySelectorAll(".stage-chip").forEach((el) => {
      el.setAttribute("aria-pressed", String(el.dataset.stage === state.drill.stageId));
    });
    const c = state.drill.case;
    $("drill-case-label").textContent = c
      ? `${CubePracticeBank.STAGE_LABELS[c.stageId]} · ${c.label}`
      : "按「下一題」開始";
    $("drill-hint").textContent = "";
    $("drill-goal").textContent = "";
    $("drill-goal").className = "goal";
    const timed = Boolean($("drill-timed")?.checked);
    state.drill.timed = timed;
    const line = $("drill-timer-line");
    if (line) line.hidden = !timed;
    $("drill-elapsed").textContent = CubeProgress.formatMs(state.drill.elapsedMs);
    renderDrillStats();
  }

  function stopDrillClock() {
    cancelAnimationFrame(state.drill.raf);
    state.drill.raf = 0;
  }

  function startDrillClock() {
    stopDrillClock();
    if (!state.drill.timed) return;
    state.drill.startPerf = performance.now();
    state.drill.elapsedMs = 0;
    const line = $("drill-timer-line");
    if (line) line.hidden = false;
    const tick = () => {
      if (state.mode !== "drill" || state.drill.solved || !state.drill.timed) return;
      state.drill.elapsedMs = performance.now() - state.drill.startPerf;
      $("drill-elapsed").textContent = CubeProgress.formatMs(state.drill.elapsedMs);
      state.drill.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  async function loadDrillCase(countAttempt) {
    stopDrillClock();
    state.drill.solved = false;
    state.drill.elapsedMs = 0;
    state.drill.timed = Boolean($("drill-timed")?.checked);
    const practiceCase = CubePracticeBank.pickCase(state.drill.stageId);
    state.drill.case = practiceCase;
    await state.controller.invoke("cube_set_size", { size: 3 }, "Academy");
    CubePracticeBank.applySetup(state.engine, practiceCase, RC().parseAlgorithm);
    await state.engine.publish({ type: "scramble" });
    applyHighlights(practiceCase.stageId);
    if (countAttempt) {
      state.practice = CubeProgress.recordPracticeAttempt(state.practice, practiceCase.stageId);
      refreshProgressChrome();
    }
    renderDrillChrome();
    if (state.drill.timed) startDrillClock();
    toast(`練習：${practiceCase.label}`);
  }

  function checkDrillGoal() {
    const c = state.drill.case;
    if (!c) return false;
    const result = CubePatterns.checkStage(c.stageId, faces());
    const el = $("drill-goal");
    if (result.complete) {
      el.textContent = "目標完成！";
      el.className = "goal ok";
      completeDrillIfNeeded();
      return true;
    }
    el.textContent = "尚未達到本階段目標，再試一次。";
    el.className = "goal bad";
    return false;
  }

  function completeDrillIfNeeded() {
    if (state.drill.solved || !state.drill.case) return;
    state.drill.solved = true;
    stopDrillClock();
    if (state.drill.timed && state.drill.startPerf) {
      state.drill.elapsedMs = performance.now() - state.drill.startPerf;
    }
    const ms = state.drill.timed ? state.drill.elapsedMs : 0;
    state.practice = CubeProgress.recordPracticeSolve(
      state.practice,
      state.drill.case.stageId,
      ms,
    );
    renderDrillStats();
    refreshProgressChrome();
    toast(
      state.drill.timed
        ? `完成！${CubeProgress.formatMs(ms)}`
        : "完成本題目標",
    );
  }

  function onDrillCubeUpdate() {
    if (state.mode !== "drill" || !state.drill.case || state.drill.solved) return;
    applyHighlights(state.drill.case.stageId);
    const result = CubePatterns.checkStage(state.drill.case.stageId, faces());
    if (result.complete) {
      $("drill-goal").textContent = "目標完成！";
      $("drill-goal").className = "goal ok";
      completeDrillIfNeeded();
    }
  }

  async function runAutoSolve() {
    const plan = BeginnerCoach.buildSolvePlan(state.engine, 36);
    state.solvePlan = plan;
    state.solveStep = 0;
    const box = $("solve-steps");
    box.replaceChildren();
    plan.steps.forEach((step, i) => {
      const li = document.createElement("li");
      li.textContent = `${i + 1}. [${step.label}] ${step.algorithm} — ${step.explanation}`;
      box.append(li);
    });
    $("solve-summary").textContent = plan.solved
      ? `計畫 ${plan.steps.length} 段，模擬可還原。`
      : `計畫 ${plan.steps.length} 段（啟發式，可能需再微調）。`;
  }

  async function playAutoSolveStep() {
    if (!state.solvePlan?.steps?.length) {
      await runAutoSolve();
    }
    const step = state.solvePlan.steps[state.solveStep];
    if (!step) {
      toast("逐步講解已結束");
      return;
    }
    toast(`${step.label}：${step.algorithm}`);
    await runMoves(RC().parseAlgorithm(step.algorithm), "Academy");
    state.solveStep += 1;
    const items = $("solve-steps").querySelectorAll("li");
    items.forEach((el, i) => el.classList.toggle("active", i === state.solveStep - 1));
  }

  /* -------- WebMCP tutor tools (extend definitions + controller) -------- */
  function installTutorTools() {
    const { objectSchema, TOOL_DEFINITIONS, TOOL_MAP, AVAILABLE_MOVES } = RC();
    const extras = [
      {
        name: "academy_get_progress",
        readOnly: true,
        summary: "Read lesson progress and current lesson id.",
        description:
          "Return Rubik's Cube Academy progress: completed lesson ids, current lesson, counts. Read-only.",
        inputSchema: objectSchema(),
      },
      {
        name: "academy_get_lesson",
        readOnly: true,
        summary: "Get one lesson's Traditional Chinese content and algorithms.",
        description:
          "Return title, body, algorithm, goal id, and kind for lessonId (or current lesson if omitted).",
        inputSchema: objectSchema({
          lessonId: { type: "string", description: "Optional lesson id from the curriculum." },
        }),
      },
      {
        name: "academy_get_hint",
        readOnly: true,
        summary: "Diagnose stage and suggest the next beginner-method algorithm.",
        description:
          "Inspect the shared cube and return current beginner stage, explanation, and suggested algorithm string.",
        inputSchema: objectSchema(),
      },
      {
        name: "academy_explain_next",
        readOnly: true,
        summary: "Explain the next move for the active lesson or beginner stage.",
        description:
          "Return a short Traditional Chinese explanation plus notation for what to do next on the shared cube.",
        inputSchema: objectSchema(),
      },
      {
        name: "academy_setup_practice",
        readOnly: false,
        summary: "Load a lesson practice position (3×3) onto the shared cube.",
        description:
          "Reset to 3×3 and apply the lesson setup scramble/algorithm for guided practice. Mutates cube state.",
        inputSchema: objectSchema({
          lessonId: { type: "string", description: "Lesson id with a practice setup." },
        }, ["lessonId"]),
      },
      {
        name: "academy_set_lesson",
        readOnly: false,
        summary: "Set the learner's current lesson id in local progress.",
        description: "Update academy progress.currentLessonId. Does not move the cube unless setupPractice is true.",
        inputSchema: objectSchema({
          lessonId: { type: "string", description: "Curriculum lesson id." },
          setupPractice: { type: "boolean", description: "If true, also load that lesson's cube setup." },
        }, ["lessonId"]),
      },
    ];

    for (const tool of extras) {
      if (!TOOL_MAP.has(tool.name)) {
        TOOL_DEFINITIONS.push(tool);
        TOOL_MAP.set(tool.name, tool);
      }
    }

    const controller = state.controller;
    const origValidate = controller.validate.bind(controller);
    controller.validate = (name, input) => {
      if (!String(name).startsWith("academy_")) return origValidate(name, input);
      const definition = TOOL_MAP.get(name);
      if (!definition) throw new Error(`Unknown tool: ${name}`);
      const args = input === undefined ? {} : input;
      if (args === null || typeof args !== "object" || Array.isArray(args)) {
        throw new Error("Tool arguments must be a JSON object.");
      }
      const allowed = Object.keys(definition.inputSchema.properties);
      for (const key of Object.keys(args)) {
        if (!allowed.includes(key)) throw new Error(`Unexpected argument: ${key}`);
      }
      for (const key of definition.inputSchema.required) {
        if (!Object.prototype.hasOwnProperty.call(args, key)) {
          throw new Error(`Missing required argument: ${key}`);
        }
      }
      if (name === "academy_setup_practice" || name === "academy_set_lesson" || name === "academy_get_lesson") {
        if (args.lessonId && !CubeCurriculum.lessonById(args.lessonId)) {
          throw new Error(`Unknown lessonId: ${args.lessonId}`);
        }
      }
      return { definition, args: { ...args } };
    };

    const origRead = controller.read.bind(controller);
    controller.read = (name) => {
      if (name === "academy_get_progress") {
        const p = CubeProgress.loadProgress();
        return {
          currentLessonId: p.currentLessonId,
          completedIds: Object.keys(p.completed),
          completedCount: Object.keys(p.completed).length,
          totalLessons: CubeCurriculum.LESSONS.length,
          freePlayVisits: p.freePlayVisits,
        };
      }
      if (name === "academy_get_lesson") {
        const id = controller._academyLessonId || state.lessonId;
        const lesson = CubeCurriculum.lessonById(id);
        if (!lesson) throw new Error(`Unknown lessonId: ${id}`);
        return {
          id: lesson.id,
          title: lesson.title,
          blurb: lesson.blurb,
          kind: lesson.kind,
          body: lesson.body,
          algorithm: lesson.algorithm || null,
          goal: lesson.goal || null,
          setup: lesson.setup || null,
        };
      }
      if (name === "academy_get_hint") {
        const s = BeginnerCoach.suggestNext(state.engine);
        return { ...s, faces: state.engine.getFaces(), solved: state.engine.isSolved() };
      }
      if (name === "academy_explain_next") {
        const lesson = CubeCurriculum.lessonById(state.lessonId);
        if (lesson?.hintMoves?.length) {
          return {
            lessonId: lesson.id,
            explanation: `課程「${lesson.title}」建議關注：${lesson.algorithm || lesson.hintMoves.join(" ")}`,
            algorithm: lesson.algorithm || lesson.hintMoves.join(" "),
          };
        }
        const s = BeginnerCoach.suggestNext(state.engine);
        return {
          lessonId: state.lessonId,
          explanation: s.explanation,
          algorithm: s.algorithm,
          stage: s.stage,
        };
      }
      return origRead(name);
    };

    const origInvoke = controller.invoke.bind(controller);
    controller.invoke = async (name, input = {}, source = "UI") => {
      if (!String(name).startsWith("academy_")) {
        return origInvoke(name, input, source);
      }

      const { definition, args } = controller.validate(name, input);
      state.logger.add(source, `${name}${Object.keys(args).length ? " " + JSON.stringify(args) : ""}`);

      if (name === "academy_get_lesson") {
        controller._academyLessonId = args.lessonId || state.lessonId;
        return controller.read(name);
      }
      if (definition.readOnly) {
        return controller.read(name);
      }

      if (name === "academy_set_lesson") {
        return state.queue.enqueue(async () => {
          selectLesson(args.lessonId);
          if (args.setupPractice) {
            const lesson = CubeCurriculum.lessonById(args.lessonId);
            if (lesson) await setupLessonCube(lesson);
          }
          setMode("learn");
          return { success: true, lessonId: args.lessonId };
        });
      }
      if (name === "academy_setup_practice") {
        return state.queue.enqueue(async () => {
          selectLesson(args.lessonId);
          const lesson = CubeCurriculum.lessonById(args.lessonId);
          await setupLessonCube(lesson);
          setMode("learn");
          if (source === "WebMCP") toast(`AI 導師 → 練習關「${lesson.title}」`);
          return { success: true, lessonId: args.lessonId, scramble: state.engine.scramble };
        });
      }
      throw new Error(`Unknown academy tool: ${name}`);
    };

    void AVAILABLE_MOVES;
  }

  function bindGlobalKeys() {
    const faceKeys = {
      KeyU: "U",
      KeyD: "D",
      KeyL: "L",
      KeyR: "R",
      KeyF: "F",
      KeyB: "B",
    };
    window.addEventListener("keydown", (e) => {
      if (e.target && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      onSpaceTimer(e);
      if (state.mode !== "learn" && state.mode !== "freeplay" && state.mode !== "drill") return;
      const face = faceKeys[e.code];
      if (!face || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      const move = e.shiftKey ? `${face}'` : face;
      if (state.mode === "learn") onUserMove(move);
      else if (state.mode === "drill") {
        state.controller.invoke("cube_move", { move }, "UI").catch((err) => toast(err.message));
      } else {
        state.controller.invoke("cube_move", { move }, "UI").catch((err) => {
          $("error").textContent = err.message;
        });
      }
    });
  }

  async function boot() {
    RC().runSelfTests();
    state.progress = CubeProgress.loadProgress();
    state.times = CubeProgress.loadTimes();
    state.practice = CubeProgress.loadPractice();
    state.lessonId = state.progress.currentLessonId || "basics-pieces";

    const api = RC();
    state.logger = new api.ActivityLogger($("activity-log"));
    state.engine = new api.CubeEngine(3);
    state.renderer = new api.CubeRenderer(state.engine);
    state.queue = new api.MoveQueue((pending) => {
      const el = $("queue-status");
      if (el) el.textContent = pending ? `佇列 ${pending}` : "佇列空閒";
    });
    state.controller = new api.CubeController(state.engine, state.queue, state.logger);
    installTutorTools();
    state.adapter = new api.WebMCPAdapter(state.controller, state.logger);

    state.engine.subscribe(() => {
      onCubeMaybeSolved();
      if (state.mode === "learn") {
        const lesson = CubeCurriculum.lessonById(state.lessonId);
        if (lesson?.goal) applyHighlights(lesson.goal);
      }
    });

    // Free-play controls still use controller.bindUI when those nodes exist.
    if ($("move-grid-free")) {
      // Populate freeplay grid manually (bindUI targets move-grid).
      const grid = $("move-grid-free");
      for (const move of RC().AVAILABLE_MOVES) {
        const button = RC().textElement("button", move);
        button.type = "button";
        button.addEventListener("click", () =>
          state.controller.invoke("cube_move", { move }, "UI").catch((err) => {
            $("error").textContent = err.message;
          }),
        );
        grid.append(button);
      }
      $("scramble")?.addEventListener("click", () => state.controller.invoke("cube_scramble", {}, "UI"));
      $("reset")?.addEventListener("click", () => state.controller.invoke("cube_reset", {}, "UI"));
      $("undo")?.addEventListener("click", () => state.controller.invoke("cube_undo", {}, "UI"));
      $("algorithm-form")?.addEventListener("submit", (event) => {
        event.preventDefault();
        state.controller.invoke("cube_execute_algorithm", { algorithm: $("algorithm").value }, "UI");
      });
      document.querySelectorAll(".size-button").forEach((button) => {
        button.addEventListener("click", () =>
          state.controller.invoke("cube_set_size", { size: Number(button.dataset.size) }, "UI"),
        );
      });
    }

    bindMoveGrid("move-grid-learn");
    bindMoveGrid("move-grid-drill", onDrillMove);
    bindGlobalKeys();

    document.querySelectorAll(".mode-tab").forEach((btn) => {
      btn.addEventListener("click", () => setMode(btn.dataset.tab));
    });

    $("btn-play")?.addEventListener("click", () => playbackPlay());
    $("btn-step-fwd")?.addEventListener("click", () => playbackStep(1));
    $("btn-step-back")?.addEventListener("click", () => playbackStep(-1));
    $("btn-check-goal")?.addEventListener("click", () => checkGoal());
    $("btn-hint")?.addEventListener("click", () => showHint());
    $("btn-mark-done")?.addEventListener("click", () => markLessonDone());
    $("btn-reset-lesson")?.addEventListener("click", () => {
      state.quizIndex = 0;
      state.playback.tokens = [];
      renderLesson();
    });
    $("btn-next-lesson")?.addEventListener("click", () => {
      const next = $("btn-next-lesson").dataset.next;
      if (next) selectLesson(next);
    });

    $("btn-new-scramble")?.addEventListener("click", () => newTimerScramble());
    $("btn-timer-inspect")?.addEventListener("click", () => startInspect());
    $("btn-timer-start")?.addEventListener("click", () => beginTiming());
    $("btn-timer-stop")?.addEventListener("click", () => finishTimerManual());
    $("btn-auto-plan")?.addEventListener("click", () => runAutoSolve());
    $("btn-auto-step")?.addEventListener("click", () => playAutoSolveStep());

    $("btn-drill-next")?.addEventListener("click", () => loadDrillCase(true));
    $("btn-drill-check")?.addEventListener("click", () => checkDrillGoal());
    $("btn-drill-hint")?.addEventListener("click", () => {
      const c = state.drill.case;
      $("drill-hint").textContent = c?.hint || CubePracticeBank.STAGE_HINTS[state.drill.stageId] || "";
    });
    $("btn-drill-reset")?.addEventListener("click", () => {
      if (state.drill.case) {
        CubePracticeBank.applySetup(state.engine, state.drill.case, RC().parseAlgorithm);
        state.engine.publish({ type: "scramble" });
        state.drill.solved = false;
        applyHighlights(state.drill.case.stageId);
        if (state.drill.timed) startDrillClock();
        renderDrillChrome();
      }
    });
    $("drill-timed")?.addEventListener("change", () => {
      state.drill.timed = Boolean($("drill-timed").checked);
      const line = $("drill-timer-line");
      if (line) line.hidden = !state.drill.timed;
      if (state.drill.timed && state.drill.case && !state.drill.solved) startDrillClock();
      else stopDrillClock();
    });

    await state.adapter.register();

    state.logger.add("System", "魔術方塊學院已就緒。學習／隨機練習／計時／自由練習共用 CubeEngine。");
    setMode("learn");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot().catch((e) => console.error(e)), {
      once: true,
    });
  } else {
    boot().catch((e) => console.error(e));
  }
})();
