/**
 * Browser UI, ActionQueue, WebMCP adapter, and self-tests for Mini Tactical Dungeon.
 */
import {
  playDescend,
  playHurt,
  playLose,
  playMove,
  playReward,
  playSelect,
  playWin,
} from "../shared/sfx.mjs";
import {
  FLOOR_COUNT,
  GameEngine,
  ITEM_DATA,
  MapEngine,
  MODE_ORDER,
  MODES,
  SKILL_DATA,
  TOOLS,
  TOOL_BY_NAME,
  copy,
  distance,
  key,
  same,
  validateArgs,
} from "./game.mjs";

const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
  );
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const $ = (id) => document.getElementById(id);
const sprite = (name, cls = "") =>
  `<svg class="sprite ${cls}" viewBox="0 0 32 32" aria-hidden="true"><use href="#sprite-${name}"></use></svg>`;
const error = (message, extra = {}) => ({ success: false, error: message, ...extra });

class ActionQueue {
  constructor(engine) {
    this.engine = engine;
    this.tail = Promise.resolve();
    this.pending = 0;
    this.onRender = () => {};
  }
  call(name, args = {}, source = "UI") {
    let snapshot;
    try {
      snapshot = copy(args);
    } catch {
      return Promise.resolve(error("Arguments must be serializable JSON."));
    }
    const task = async () => {
      this.pending++;
      const e = this.engine;
      const tool = TOOL_BY_NAME.get(name);
      const oldTurn = e.s.turn;
      const oldFloor = e.s.floorIndex;
      const wasReward = e.s.awaitingReward;
      let result;
      try {
        const validation = tool
          ? validateArgs(tool, snapshot)
          : error("Unknown capability.", { validTools: TOOLS.map((t) => t.name) });
        if (validation) {
          result = validation;
        } else {
          e.effects = [];
          if (name === "game_reset" || name === "dungeon_start_run") {
            UI.mode = "move";
            UI.overlayDismissed = false;
          }
          e.event(source, name, formatArgs(snapshot) || "Observe / execute shared capability");
          result = e.invoke(name, snapshot, source);
          if (result.success === false) e.event(source, "action_rejected", result.error);
          if (source === "WebMCP" && result.success !== false) {
            UI.trail.push(toolSummary(name, snapshot));
            UI.trail = UI.trail.slice(-5);
            if (name === "game_reset" || name === "dungeon_start_run") UI.trail = ["Started run"];
            UI.agentSkill = snapshot.skill || null;
            if (!e.effects.length) e.effect(snapshot.x !== undefined ? snapshot : e.s.player, "", "agent");
          }
          playForAction(name, result, e);
          this.onRender();
          if (e.effects.length) await wait(animationDelay(source));
          if (result.success !== false && e.s.phase === "enemy") {
            e.effects = [];
            this.onRender();
            for (const enemy of e.s.enemies) {
              if (e.s.defeated) break;
              const hpBefore = e.s.player.hp;
              e.effects = [];
              e.enemyStep(enemy.id);
              if (e.s.player.hp < hpBefore) playHurt();
              this.onRender();
              if (e.effects.length) await wait(animationDelay(source));
            }
            e.finishEnemyPhase();
          }
          if (result.success !== false && !tool.annotations.readOnlyHint) {
            result = {
              ...result,
              remainingAP: e.s.actionPoints,
              turn: e.s.turn,
              phase: e.s.phase,
              victory: e.s.victory || e.s.runVictory,
              defeated: e.s.defeated,
              enemyPhaseResolved: e.s.turn > oldTurn || e.s.defeated,
              events: copy(
                e.s.activityLog
                  .filter((v) => v.turn >= oldTurn && ["Enemy", "System"].includes(v.source))
                  .slice(-12),
              ),
            };
          }
          if (name === "game_reset" || name === "dungeon_start_run") result.state = e.state();
          if (!wasReward && e.s.awaitingReward) playReward();
          if (e.s.floorIndex > oldFloor) playDescend();
        }
        if (result.success === false && source === "UI") toast(result.error);
        return copy(result);
      } catch (err) {
        console.error("Capability execution failed", err);
        e.event("System", "execution_error", "An unexpected execution error occurred.");
        return error("Unexpected execution error. Inspect current state before retrying.");
      } finally {
        e.effects = [];
        UI.agentSkill = null;
        this.pending--;
        this.onRender();
      }
    };
    const promise = this.tail.then(task, task);
    this.tail = promise.catch(() => {});
    return promise;
  }
}

function playForAction(name, result, e) {
  if (result?.success === false) return;
  if (name === "player_move" || (name === "player_use_skill" && result?.skill === "dash")) playMove();
  if (name === "player_attack" || name === "player_use_skill") playSelect();
  if (e.s.defeated) playLose();
  else if (e.s.runVictory || e.s.victory) playWin();
  else if (name === "dungeon_choose_reward") playReward();
}

function animationDelay(source) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
  return source === "WebMCP" ? 650 : 220;
}
function formatArgs(a) {
  return Object.keys(a).length ? JSON.stringify(a) : "";
}
function toolSummary(name, a) {
  const labels = {
    game_get_state: "Observed shared state",
    map_inspect: "Observed battlefield",
    enemy_inspect: `Inspected ${a.enemyId}`,
    player_get_available_actions: "Observed legal actions",
    player_move: `Moved to (${a.x},${a.y})`,
    player_attack: `Attacked ${a.enemyId}`,
    player_use_skill: `Used ${SKILL_DATA[a.skill]?.name || "skill"}`,
    player_pickup: `Collected ${a.itemId}`,
    game_end_turn: "Resolved enemy turn",
    exit_try_leave: "Attempted escape",
    player_use_item: `Used ${a.itemId}`,
    mission_get_progress: "Checked mission progress",
    dungeon_start_run: `Started ${a.mode}`,
    dungeon_choose_reward: `Chose ${a.rewardId}`,
    dungeon_get_run: "Checked run status",
  };
  return labels[name] || name.replaceAll("_", " ");
}

const UI = {
  mode: "move",
  trail: [],
  agentSkill: null,
  overlayDismissed: false,
  showingResult: false,
  previousFocus: null,
};
const engine = new GameEngine({ mode: "tutorial", seed: "tutorial" });
const queue = new ActionQueue(engine);
let toastTimer;
function toast(message) {
  $("toast").textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").textContent = ""), 4200);
}
function actionButton(label, name, args = {}, cls = "") {
  return `<button class="${cls}" data-tool="${name}" data-args="${escapeHTML(JSON.stringify(args))}">${label}</button>`;
}

class GameRenderer {
  static initBoard() {
    $("board").innerHTML = Array.from(
      { length: 64 },
      (_, n) => `<button class="tile" data-x="${n % 8}" data-y="${Math.floor(n / 8)}"></button>`,
    ).join("");
  }
  static render() {
    const s = engine.s;
    const p = s.player;
    const a = engine.available();
    const busy = queue.pending > 0;
    const floorLabel = `${s.floorIndex + 1}/${s.floorCount}`;
    $("statusbar").innerHTML = `
      <div><span class="muted small">TURN</span> <b>${s.turn.toString().padStart(2, "0")}</b></div>
      <div style="color:${s.phase === "player" ? "var(--cyan)" : "var(--gold)"}"><b class="small">${s.phase.toUpperCase()}${["player", "enemy"].includes(s.phase) ? " TURN" : ""}</b></div>
      <div><span class="muted small">HP</span> <b>${p.hp}<span class="muted small">/${p.maxHp}</span></b></div>
      <div><span class="muted small">MANA</span> <b>${p.mana}<span class="muted small">/${p.maxMana}</span></b></div>
      <div><span class="muted small">AP</span> <b class="ap" aria-label="${s.actionPoints} of 2 action points">${"●".repeat(s.actionPoints)}${"○".repeat(2 - s.actionPoints)}</b></div>
      <div class="objective-top">◇ Floor ${floorLabel}${s.isBossFloor ? " · BOSS" : ""} · ${
        s.runVictory
          ? "Expedition complete"
          : s.awaitingReward
            ? "Floor cleared · choose a reward"
            : s.inventory.ancient_crystal
              ? `Crystal secured → portal (${s.exit.x},${s.exit.y})`
              : s.objective
      }</div>`;

    $("floor-title").textContent = s.floorName;
    $("floor-sub").textContent = `${MODES[s.mode]?.label || s.mode} · seed ${s.seed}`;
    $("floor-badge").textContent = `8 × 8 · FLOOR ${floorLabel}`;
    $("mission-copy").textContent =
      s.floorCount === 1
        ? "Collect the Ancient Crystal and reach the exit without dying."
        : `Clear floors 1–${s.floorCount}. Each floor needs the crystal + portal. Final floor has a Boss.`;

    document.querySelectorAll("[data-start-mode]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.startMode === s.mode);
    });
    const meta = engine.publicMeta();
    $("records").textContent =
      s.mode === "daily"
        ? `今日最佳：${meta.dailyBestTurns ?? "—"} 回合 · 最高樓層 ${meta.bestFloorDaily}`
        : s.mode === "campaign"
          ? `遠征最佳：${meta.bestTurnsCampaign ?? "—"} 回合 · 最高樓層 ${meta.bestFloorCampaign}`
          : `教學通關 ${meta.clearsTutorial} 次`;

    const range = UI.mode === "dash" ? 4 : p.moveRange;
    const skill = engine.skills().find((sk) => sk.skill === UI.mode);
    const movementOK = UI.mode === "move" || (UI.mode === "dash" && skill?.available);
    const reachable = new Set(movementOK ? engine.reachable(range).map(key) : []);
    const attackRange = UI.mode === "arcane_shot" ? 4 : p.attackRange;
    const targetable = new Set(engine.active() ? engine.targets(attackRange) : []);
    for (const tile of $("board").children) {
      const x = +tile.dataset.x;
      const y = +tile.dataset.y;
      const t = engine.tile(x, y);
      const at = { x, y };
      const enemy = s.enemies.find((e) => e.hp > 0 && same(e, at));
      const hero = same(p, at);
      const item = s.items.find((i) => same(i, at));
      const hazard = s.hazards.find((h) => same(h, at));
      const effect = engine.effects.findLast
        ? engine.effects.findLast((f) => same(f, at))
        : [...engine.effects].reverse().find((f) => same(f, at));
      tile.className = `tile ${t.terrain} ${reachable.has(key(at)) ? "reachable" : ""} ${
        enemy && targetable.has(enemy.id) ? "targetable" : ""
      } ${same(s.selectedTile, at) ? "selected" : ""} ${effect ? "flash" : ""}`;
      let html = "";
      if (t.exit) html += sprite("portal", "portal item-sprite");
      if (t.terrain === "pillar" || t.terrain === "rubble") html += sprite(t.terrain);
      if (t.terrain === "cover" && !hazard) html += `<span class="tile-name" style="opacity:.7">Cover</span>`;
      if (hazard) html += sprite("trap", "item-sprite");
      if (item) html += sprite(ITEM_DATA[item.type].sprite, hero || enemy ? "under-item" : "item-sprite");
      if (enemy) {
        html += sprite(enemy.sprite || enemy.kind || "goblin");
        if (enemy.inspected)
          html += `<span class="enemy-hp" aria-hidden="true"><i style="width:${(100 * enemy.hp) / enemy.maxHp}%"></i></span>`;
      }
      if (hero) html += sprite("hero", "hero");
      const label = hero
        ? "Aria"
        : enemy
          ? enemy.name.split(" ")[0]
          : item
            ? item.type === "ancient_crystal"
              ? "Crystal"
              : ITEM_DATA[item.type].name.split(" ")[0]
            : t.exit
              ? "Exit"
              : hazard
                ? "Spikes"
                : t.terrain === "pillar"
                  ? "Pillar"
                  : t.terrain === "rubble"
                    ? "Rubble"
                    : t.terrain === "cover"
                      ? "Cover"
                      : "";
      if (label && t.terrain !== "cover") html += `<span class="tile-name">${label}</span>`;
      else if (label && t.terrain === "cover" && (hero || enemy || item || hazard || t.exit))
        html += `<span class="tile-name">${label}</span>`;
      if (effect?.text) html += `<span class="float-text">${escapeHTML(effect.text)}</span>`;
      if (tile.innerHTML !== html) tile.innerHTML = html;
      const description = `Tile ${x}, ${y}: ${t.terrain}${label ? ", " + label : ""}${
        hazard ? ", spike trap" : ""
      }${enemy && enemy.inspected ? `, HP ${enemy.hp}/${enemy.maxHp}` : ""}${
        reachable.has(key(at)) ? ", reachable" : ""
      }`;
      tile.setAttribute("aria-label", description);
      tile.title = description;
    }
    $("instruction").textContent = busy
      ? "Resolving shared capability…"
      : s.runVictory
        ? "Expedition cleared. Review the event log or start a new run."
        : s.awaitingReward
          ? "Floor cleared. Choose one reward to descend."
          : s.defeated
            ? "Aria is defeated. Restart or start a new run."
            : (
                {
                  move: "Select Aria, then click a cyan tile to move. Click enemies or objects to inspect.",
                  attack: `Basic Attack selected · Click an enemy within ${p.attackRange} tiles. ${p.attack} damage · 1 AP.`,
                  arcane_shot:
                    "Arcane Shot selected · Click an enemy within 4 tiles. 30 damage · 15 mana · 1 AP.",
                  dash: "Dash selected · Click a cyan destination within 4 walkable steps. 10 mana · 1 AP.",
                }[UI.mode] || "Choose an action."
              );

    $("character").innerHTML = `
      <div class="hero-title"><div class="portrait">${sprite("hero")}</div><div><h2>ARIA</h2><p>Arcane Ranger</p><span class="small muted mono">Position (${p.x}, ${p.y})</span></div></div>
      <div class="bar-label"><span>Health</span><b>${p.hp} / ${p.maxHp}</b></div><div class="bar" role="meter" aria-label="Health" aria-valuemin="0" aria-valuemax="${p.maxHp}" aria-valuenow="${p.hp}"><i style="width:${(100 * p.hp) / p.maxHp}%"></i></div>
      <div class="bar-label"><span>Mana</span><b>${p.mana} / ${p.maxMana}</b></div><div class="bar mana" role="meter" aria-label="Mana" aria-valuemin="0" aria-valuemax="${p.maxMana}" aria-valuenow="${p.mana}"><i style="width:${(100 * p.mana) / p.maxMana}%"></i></div>
      <div class="stats"><div class="stat">Attack <b>${p.attack}</b></div><div class="stat">Defense <b>${p.defense}</b></div><div class="stat">Move <b>${p.moveRange}</b></div><div class="stat">Range <b>${p.attackRange}</b></div></div>
      <div class="status-pill">${p.barrier ? "⬡ Barrier active · next hit −50%" : s.defeated ? "× Defeated" : "● Normal"} <span class="muted">· ${busy ? "Resolving" : s.phase === "player" ? "Ready" : s.phase === "reward" ? "Reward" : "Stand by"}</span></div>
      ${p.gear?.length ? `<p class="small muted" style="margin-top:10px">Gear: ${p.gear.map(escapeHTML).join(", ")}</p>` : ""}`;

    const progress = engine.progress();
    $("checklist").innerHTML =
      [
        [progress.foundAncientCrystal, "Find Ancient Crystal"],
        [progress.hasAncientCrystal, "Collect Ancient Crystal"],
        [progress.alive, s.runVictory ? "Survived" : "Survive · stay alive"],
        [progress.exitReached, "Reach Exit"],
        [s.floorsCleared >= s.floorCount || s.runVictory, `Clear floors (${s.floorsCleared}/${s.floorCount})`],
      ]
        .map(
          ([done, label]) =>
            `<div class="${done ? "done" : ""}"><span>${done ? "✓" : "□"}</span>${label}</div>`,
        )
        .join("") +
      (s.runVictory
        ? '<b style="color:var(--gold);margin-top:8px">EXPEDITION COMPLETE</b>'
        : s.awaitingReward
          ? '<b style="color:var(--gold);margin-top:8px">CHOOSE A REWARD</b>'
          : "");

    const rewardPanel = $("reward-panel");
    if (s.awaitingReward && s.rewardOptions.length) {
      rewardPanel.hidden = false;
      rewardPanel.innerHTML = s.rewardOptions
        .map(
          (r) =>
            `<button data-tool="dungeon_choose_reward" data-args='${escapeHTML(JSON.stringify({ rewardId: r.id }))}' ${busy ? "disabled" : ""}><b>${escapeHTML(r.name)}</b><span>${escapeHTML(r.description)}</span></button>`,
        )
        .join("");
    } else {
      rewardPanel.hidden = true;
      rewardPanel.innerHTML = "";
    }

    const buttons = [
      {
        id: "attack",
        name: "Basic Attack",
        icon: "⌁",
        detail: `${p.attack} dmg · 0 mana`,
        available: a.attackableEnemies.length > 0,
      },
      ...engine.skills().map((sk) => ({
        id: sk.skill,
        name: sk.name,
        icon: sk.icon,
        detail: sk.remainingCooldown
          ? `${sk.remainingCooldown} turn cooldown`
          : `${sk.manaCost} mana · ${sk.range ? sk.range + " range" : "self"}`,
        available: sk.available,
      })),
    ];
    $("abilities").innerHTML = buttons
      .map(
        (b, i) =>
          `<button class="ability ${UI.mode === b.id ? "active" : ""} ${UI.agentSkill === b.id ? "flash" : ""}" data-ability="${b.id}" ${busy || !b.available ? "disabled" : ""} title="${escapeHTML(b.id === "attack" ? `${p.attack} damage, range ${p.attackRange}, 1 AP` : SKILL_DATA[b.id].effect)}"><span class="key">${i + 1}</span><span class="ability-icon" aria-hidden="true">${b.icon}</span><b>${b.name}</b><small>${b.detail}</small></button>`,
      )
      .join("");

    $("inventory").innerHTML = Object.values(ITEM_DATA)
      .map(
        (d) => `
      <div class="inventory-item">${sprite(d.sprite)}
      <div class="item-copy"><b>${d.name} <span style="color:var(--gold)">×${s.inventory[d.id]}</span></b><br>
      <span class="small muted">${d.consumable ? `+${d.restore} ${d.resource === "hp" ? "HP" : "mana"}` : "Mission objective"}</span><br>
      ${actionButton("Inspect", "item_inspect", { itemId: d.id })}</div>
      ${d.consumable ? `<button data-tool="player_use_item" data-args='{"itemId":"${d.id}"}' ${busy || !a.usableItems.includes(d.id) ? "disabled" : ""}>Use</button>` : ""}</div>`,
      )
      .join("");

    this.renderTarget(a, busy);
    this.renderSignals();
    $("activity").innerHTML = [...s.activityLog]
      .reverse()
      .map(
        (e) =>
          `<div class="event"><time>${escapeHTML(e.timestamp)}</time><span class="source ${e.source}">${e.source}</span><div class="event-detail"><strong class="mono">${escapeHTML(e.action)}</strong><br>${escapeHTML(e.summary)}</div></div>`,
      )
      .join("");
    $("trail").innerHTML = UI.trail.length
      ? UI.trail.map((t) => `<span>${escapeHTML(t)}</span>`).join('<span style="border:0;padding:4px 0">→</span>')
      : '<span style="color:var(--muted);border:0;padding:0">Waiting for a native WebMCP tool call. Human actions remain labeled UI.</span>';
    document.querySelectorAll('[data-tool="game_end_turn"]').forEach((b) => (b.disabled = busy || !a.canEndTurn));
    document
      .querySelectorAll('[data-tool="exit_try_leave"]')
      .forEach((b) => (b.disabled = busy || !engine.active()));
    document.querySelectorAll('[data-tool="game_reset"]').forEach((b) => (b.disabled = busy));
    $("console-run").disabled = busy;
    $("start-run").disabled = busy;
    this.renderResult();
  }
  static renderTarget(a, busy) {
    const s = engine.s;
    const t = engine.tile(s.selectedTile.x, s.selectedTile.y);
    $("selected-coords").textContent = `(${t.x}, ${t.y})`;
    let html = "";
    if (t.occupant?.enemyId) {
      const e = engine.enemy(t.occupant.enemyId);
      html = `<div class="target-title"><b>${e.name}</b><span class="small" style="color:var(--red)">Enemy</span></div>
        <p class="small muted mono">${e.id}</p>
        <p class="small" style="margin-top:8px">HP ${e.inspected ? `${e.hp} / ${e.maxHp}` : "??"} · Range ${e.inspected ? e.attackRange : "??"}</p>`;
      if (e.inspected)
        html += `<p class="small muted" style="margin-top:7px">Attack ${e.attack} · Move ${e.moveRange}<br>${e.behavior}<br><span style="color:var(--gold)">Weakness: ${e.weakness}</span></p>`;
      else
        html +=
          '<p class="small muted" style="margin-top:7px">Inspect to reveal combat stats, behavior, and weakness. Free · no AP.</p>';
      html += `<div class="target-actions">${actionButton("◎ Inspect", "enemy_inspect", { enemyId: e.id })}
      <button data-tool="player_attack" data-args='{"enemyId":"${e.id}"}' ${busy || !a.attackableEnemies.includes(e.id) ? "disabled" : ""}>Attack</button>
      <button data-tool="player_use_skill" data-args='{"skill":"arcane_shot","enemyId":"${e.id}"}' ${busy || !a.availableSkills.some((sk) => sk.skill === "arcane_shot" && sk.validEnemyIds.includes(e.id)) ? "disabled" : ""}>Arcane Shot</button></div>`;
    } else if (t.occupant?.id === "aria") {
      html =
        '<b>Aria · your hero</b><p class="small muted" style="margin-top:7px">Cyan tiles show legal movement. Cover tiles are walkable and reduce ranged hits against Aria.</p>';
      html += `<div class="target-actions"><button data-mode="move">Show movement</button>${actionButton("Inspect map", "map_inspect")}</div>`;
    } else {
      html = `<b>${t.exit ? "Exit Portal" : t.hazard ? "Spike Trap" : t.item ? t.item.name : t.terrain[0].toUpperCase() + t.terrain.slice(1)}</b>
        <p class="small muted" style="margin-top:7px">${
          t.exit
            ? "Stand here with the Ancient Crystal, then attempt to leave."
            : t.hazard
              ? `Crossing this tile deals ${t.hazard.damage} damage, even during Dash.`
              : t.terrain === "cover"
                ? "Walkable cover. Halves ranged damage against a unit standing here."
                : t.walkability
                  ? "Walkable floor. Movement must follow a valid path."
                  : "Blocks movement."
        }</p>`;
    }
    if (t.item) {
      const near = engine.active() && distance(engine.s.player, t) <= 1;
      html += `<div style="margin-top:12px"><span class="small" style="color:var(--gold)">${t.item.name} · on ground</span><div class="target-actions">${actionButton("Inspect item", "item_inspect", { itemId: t.item.itemId })}<button data-tool="player_pickup" data-args='{"itemId":"${t.item.itemId}"}' ${busy || !near ? "disabled" : ""}>Pick up · 1 AP</button></div>${!near ? '<p class="small muted" style="margin-top:7px">Move on or adjacent to this tile first.</p>' : ""}</div>`;
    }
    const nearby = a.pickupItems.filter((i) => i.itemId !== t.item?.itemId);
    if (nearby.length)
      html += `<div style="margin-top:12px"><h3>Within reach</h3><div class="target-actions">${nearby.map((i) => actionButton(`Pick up ${i.name}`, "player_pickup", { itemId: i.itemId })).join("")}</div></div>`;
    if (t.exit) html += `<div class="target-actions">${actionButton("Try to leave", "exit_try_leave", {}, "gold")}</div>`;
    $("target").innerHTML = html;
    if (busy) $("target").querySelectorAll("button").forEach((b) => (b.disabled = true));
  }
  static renderSignals() {
    const s = engine.s;
    const p = s.player;
    const signals = [];
    signals.push(`Floor ${s.floorIndex + 1}/${s.floorCount} · ${s.floorName}${s.isBossFloor ? " (Boss)" : ""}.`);
    const guardian = s.enemies.find((e) => e.hp > 0 && (e.kind === "orc" || e.kind === "boss" || e.id === "orc-1"));
    if (guardian) signals.push(`${guardian.name} protects the crystal.`);
    const ranged = s.enemies.find((e) => e.hp > 0 && e.attackRange > 1);
    if (ranged && distance(ranged, p) <= ranged.attackRange)
      signals.push(
        ranged.inspected
          ? `${ranged.name} is within attack range.`
          : "Ranged enemy nearby: inspect its attack range.",
      );
    if (MapEngine.terrain(engine, p.x, p.y) === "cover")
      signals.push("Aria stands in cover: ranged hits are halved.");
    const potion = s.items.find((i) => i.type === "health_potion");
    if (potion) {
      const path = MapEngine.paths(engine, p, 64).get(key(potion));
      signals.push(`Health Potion: ${path ? path.length + " walkable steps away" : "approach currently blocked"}.`);
    }
    if (p.hp < p.maxHp * 0.4) signals.push("Warning: hero HP below 40%. Heal or use a potion.");
    if (s.awaitingReward) signals.push("Choose a reward to descend to the next floor.");
    else if (!s.inventory.ancient_crystal) signals.push("Exit unavailable: crystal missing.");
    else if (same(p, s.exit)) signals.push("Portal reached: attempt to leave.");
    else signals.push(`Crystal secured: reach exit at (${s.exit.x},${s.exit.y}).`);
    $("signals").innerHTML = signals.map((text) => `<div class="signal">${escapeHTML(text)}</div>`).join("");
  }
  static renderResult() {
    const s = engine.s;
    const show = (s.runVictory || s.defeated) && !UI.overlayDismissed && queue.pending === 0;
    $("result-overlay").hidden = !show;
    if (!show) {
      UI.showingResult = false;
      return;
    }
    $("result-title").textContent = s.runVictory ? "DUNGEON CLEARED" : "DEFEATED";
    $("result-icon").textContent = s.runVictory ? "◇" : "⟐";
    $("result-subtitle").textContent = s.runVictory
      ? s.floorCount > 1
        ? `${s.floorsCleared} floors cleared · Ancient Crystal recovered`
        : "Ancient Crystal Recovered"
      : "The dungeon claimed another adventurer.";
    $("result-stats").innerHTML = `<div><b>${s.turn}</b><span>TURNS</span></div><div><b>${s.floorsCleared}</b><span>FLOORS</span></div><div><b>${s.enemiesDefeatedTotal}</b><span>FOES</span></div><div><b>${s.player.hp}</b><span>HP LEFT</span></div>`;
    $("result-source").textContent =
      s.runVictory && s.victorySource === "WebMCP"
        ? "Final escape performed through WebMCP"
        : "A shared battlefield. Your tactics, your outcome.";
    if (!UI.showingResult) {
      UI.previousFocus = document.activeElement;
      UI.showingResult = true;
      $("result-overlay").querySelector(".result").focus();
      if (s.runVictory) playWin();
      else playLose();
    }
  }
}
queue.onRender = () => GameRenderer.render();

$("board").addEventListener("click", async (event) => {
  const tile = event.target.closest(".tile");
  if (!tile || queue.pending) return;
  const x = +tile.dataset.x;
  const y = +tile.dataset.y;
  const enemy = engine.s.enemies.find((e) => e.hp > 0 && e.x === x && e.y === y);
  if (enemy) {
    if (UI.mode === "attack") {
      await queue.call("player_attack", { enemyId: enemy.id });
      return;
    }
    if (UI.mode === "arcane_shot") {
      await queue.call("player_use_skill", { skill: "arcane_shot", enemyId: enemy.id });
      return;
    }
    await queue.call("tile_inspect", { x, y });
    return;
  }
  if (same(engine.s.player, { x, y })) {
    UI.mode = "move";
    await queue.call("tile_inspect", { x, y });
    return;
  }
  if (UI.mode === "dash") {
    await queue.call("player_use_skill", { skill: "dash", x, y });
    return;
  }
  if (UI.mode === "move" && tile.classList.contains("reachable")) {
    await queue.call("player_move", { x, y });
    return;
  }
  await queue.call("tile_inspect", { x, y });
});

// Touch-friendly: prevent double-tap zoom delaying clicks on the board.
$("board").addEventListener(
  "touchend",
  (event) => {
    const tile = event.target.closest(".tile");
    if (!tile) return;
    event.preventDefault();
    tile.click();
  },
  { passive: false },
);

document.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  if (button.dataset.startMode) {
    document.querySelectorAll("[data-start-mode]").forEach((b) => b.classList.remove("active"));
    button.classList.add("active");
    return;
  }
  if (button.id === "start-run") {
    const mode =
      document.querySelector("[data-start-mode].active")?.dataset.startMode || "tutorial";
    const seed = $("seed-input").value.trim();
    const args = { mode };
    if (mode === "campaign" && seed) args.seed = seed;
    await queue.call("dungeon_start_run", args, "UI");
    return;
  }
  if (button.dataset.tool) {
    await queue.call(button.dataset.tool, JSON.parse(button.dataset.args || "{}"), "UI");
  } else if (button.dataset.ability) {
    useAbility(button.dataset.ability);
  } else if (button.dataset.mode) {
    UI.mode = button.dataset.mode;
    GameRenderer.render();
  }
});

function useAbility(id) {
  if (queue.pending) return;
  if (id === "heal" || id === "barrier") queue.call("player_use_skill", { skill: id });
  else {
    UI.mode = id;
    GameRenderer.render();
  }
}

document.addEventListener("keydown", (event) => {
  const modal = $("result-overlay");
  if (!modal.hidden) {
    if (event.key === "Tab") {
      const focusables = [...modal.querySelectorAll("button:not(:disabled)")];
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement.classList.contains("result"))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement.classList.contains("result"))
      ) {
        event.preventDefault();
        first.focus();
      }
    }
    return;
  }
  if (
    event.target.closest("input,textarea,select") ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    queue.pending
  )
    return;
  const abilities = { 1: "attack", 2: "arcane_shot", 3: "dash", 4: "heal", 5: "barrier" };
  if (abilities[event.key]) {
    event.preventDefault();
    useAbility(abilities[event.key]);
    return;
  }
  const moves = {
    ArrowUp: [0, -1],
    w: [0, -1],
    ArrowDown: [0, 1],
    s: [0, 1],
    ArrowLeft: [-1, 0],
    a: [-1, 0],
    ArrowRight: [1, 0],
    d: [1, 0],
  };
  if (moves[event.key]) {
    event.preventDefault();
    const [dx, dy] = moves[event.key];
    UI.mode = "move";
    queue.call("player_move", { x: engine.s.player.x + dx, y: engine.s.player.y + dy });
  }
  if (event.key === "Escape") {
    UI.mode = "move";
    GameRenderer.render();
  }
});

$("review-result").addEventListener("click", () => {
  UI.overlayDismissed = true;
  GameRenderer.render();
  (UI.previousFocus?.isConnected ? UI.previousFocus : $("board").firstElementChild).focus();
});

const prompts = [
  "Collect the Ancient Crystal and escape without dying.",
  "Start a campaign run and clear all six floors.",
  "Inspect the battlefield and tell me what the biggest threat is.",
  "Find the safest route to the crystal.",
  "Defeat the floor guardian, then leave through the portal.",
  "I'm low on health. Keep me alive.",
  "After clearing a floor, choose the best reward.",
  "What is today's daily dungeon seed and my best record?",
  "Use my turn efficiently.",
  "Finish the dungeon.",
];
$("prompts").innerHTML = prompts.map((p) => `<button class="prompt">${escapeHTML(p)}</button>`).join("");
$("prompts").addEventListener("click", async (event) => {
  const button = event.target.closest(".prompt");
  if (!button) return;
  try {
    await navigator.clipboard.writeText(button.textContent);
    toast("Prompt copied. Paste it into your WebMCP-capable AI agent.");
  } catch {
    toast("Clipboard unavailable. Select and copy the prompt text manually.");
  }
});

$("console-tool").innerHTML = TOOLS.map((t) => `<option value="${t.name}">${t.name}</option>`).join("");
$("console-tool").addEventListener("change", () => {
  $("console-input").value = JSON.stringify(TOOL_BY_NAME.get($("console-tool").value).example, null, 2);
});
$("console-run").addEventListener("click", async () => {
  let args;
  try {
    args = JSON.parse($("console-input").value);
  } catch {
    $("console-output").textContent = JSON.stringify(error("Invalid JSON arguments."), null, 2);
    return;
  }
  const result = await queue.call($("console-tool").value, args, "UI");
  $("console-output").textContent = JSON.stringify(result, null, 2);
});

class WebMCPAdapter {
  constructor(queue) {
    this.queue = queue;
    this.registered = new Set();
    this.connected = false;
    this.initializing = false;
  }
  async initialize() {
    if (this.initializing) return;
    this.initializing = true;
    try {
      if (
        !("modelContext" in document) ||
        !document.modelContext ||
        typeof document.modelContext.registerTool !== "function"
      ) {
        this.setStatus("Unsupported", false);
        engine.event(
          "System",
          "webmcp_status",
          "Native document.modelContext is unavailable. Human play and the UI capability console remain fully functional.",
        );
        return;
      }
      const context = document.modelContext;
      let discovered = [];
      if (typeof context.getTools === "function") {
        try {
          const result = await context.getTools();
          discovered = Array.isArray(result) ? result : result?.tools || [];
        } catch {
          /* optional */
        }
      }
      const existing = new Set(discovered.map((t) => t.name));
      for (const tool of TOOLS) {
        if (this.registered.has(tool.name)) continue;
        if (existing.has(tool.name)) throw new Error(`Tool name already registered: ${tool.name}`);
        await context.registerTool({
          name: tool.name,
          description: tool.description,
          inputSchema: copy(tool.inputSchema),
          annotations: copy(tool.annotations),
          execute: async (args) => {
            const output = await this.queue.call(tool.name, args ?? {}, "WebMCP");
            return {
              content: [{ type: "text", text: JSON.stringify(output) }],
              structuredContent: output,
              isError: output.success === false,
            };
          },
        });
        this.registered.add(tool.name);
      }
      this.connected = true;
      this.setStatus("Connected", true);
      engine.event(
        "System",
        "webmcp_connected",
        `${this.registered.size} native structured tactical tools registered.`,
      );
    } catch (err) {
      this.connected = false;
      this.setStatus("Registration error", false);
      engine.event(
        "System",
        "webmcp_error",
        `Native tool registration failed: ${err.message}. Human play is unaffected.`,
      );
      console.error("WebMCP registration:", err);
    } finally {
      this.initializing = false;
      this.renderTools();
      GameRenderer.render();
    }
  }
  setStatus(label, connected) {
    $("connection").classList.toggle("connected", connected);
    $("connection").innerHTML = `<span class="dot"></span> WebMCP · ${escapeHTML(label)}`;
    $("connection").title = connected
      ? "Native document.modelContext tools registered."
      : "No native connection is simulated. All human gameplay remains available.";
  }
  renderTools(discovered = null) {
    $("tools").innerHTML = TOOLS.map(
      (t) => `
      <details class="tool-row">
        <summary><span>${t.name}</span><span class="tag ${t.annotations.readOnlyHint ? "" : "write"}">${t.annotations.readOnlyHint ? "READ" : "WRITE"}</span></summary>
        <p>${escapeHTML(t.description)}</p>
        <pre>${escapeHTML(JSON.stringify({ inputSchema: t.inputSchema, annotations: t.annotations }, null, 2))}</pre>
      </details>`,
    ).join("");
    $("tool-status").textContent =
      discovered !== null
        ? `${TOOLS.length} app capabilities · ${discovered} discovered natively`
        : `${TOOLS.length} app capabilities · ${this.connected ? this.registered.size + " registered natively" : "local definitions; native connection not confirmed"}`;
  }
  async refresh() {
    if ("modelContext" in document && typeof document.modelContext?.getTools === "function") {
      try {
        const result = await document.modelContext.getTools();
        const tools = Array.isArray(result) ? result : result?.tools || [];
        this.renderTools(tools.length);
        toast(`Native discovery returned ${tools.length} tools. Inspector shows this dungeon's definitions.`);
        return;
      } catch (err) {
        console.warn("Optional getTools discovery failed", err);
      }
    }
    this.renderTools();
    toast("Showing the local capability definitions. Native discovery is unavailable.");
  }
}
const adapter = new WebMCPAdapter(queue);
$("refresh-tools").addEventListener("click", () => adapter.refresh());
window.dungeon = Object.freeze({
  call: (name, args = {}) => queue.call(name, args, "UI"),
  getTools: () =>
    TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: copy(t.inputSchema),
      annotations: copy(t.annotations),
    })),
});

function runSelfTests() {
  let passed = 0;
  let failed = 0;
  const assert = (condition, message) => {
    if (!condition) throw new Error(message || "Assertion failed");
  };
  const test = (name, fn) => {
    try {
      fn();
      passed++;
    } catch (err) {
      failed++;
      console.error(`[Dungeon self-test] ${name}`, err);
    }
  };
  const fresh = () => new GameEngine({ mode: "tutorial", seed: "tutorial" });
  test("Map bounds", () => {
    const e = fresh();
    assert(!e.tile(-1, 0).success);
    assert(e.tile(7, 7).terrain === "wall");
    assert(!e.move(8, 2).success);
    assert(!e.move(1.5, 2).success);
  });
  test("Blocked tile rejection is atomic", () => {
    const e = fresh();
    const before = JSON.stringify(e.s);
    assert(!e.move(0, 1).success);
    assert(JSON.stringify(e.s) === before);
    assert(!e.move(2, 2).success);
  });
  test("Valid movement and AP consumption", () => {
    const e = fresh();
    const r = e.move(3, 1);
    assert(r.success && same(e.s.player, { x: 3, y: 1 }) && e.s.actionPoints === 1);
  });
  test("Path cannot cross walls or enemies", () => {
    const e = fresh();
    assert(!e.move(3, 3).success);
    assert(!e.move(4, 1).success);
    for (const t of e.reachable(3)) assert(t.path.every((p) => MapEngine.walkable(e, p.x, p.y)));
  });
  test("Attack range rejection", () => {
    const e = fresh();
    const before = JSON.stringify(e.s);
    assert(!e.attack("orc-1").success);
    assert(JSON.stringify(e.s) === before);
  });
  test("Basic attack damage", () => {
    const e = fresh();
    const r = e.attack("goblin-1");
    assert(r.success && r.damage === 18 && e.enemy("goblin-1").hp === 17 && e.s.actionPoints === 1);
  });
  test("Enemy defeat", () => {
    const e = fresh();
    e.attack("goblin-1");
    e.attack("goblin-1");
    assert(e.enemy("goblin-1").hp === 0 && !e.visibleEnemies().some((v) => v.enemyId === "goblin-1"));
  });
  test("Information fog", () => {
    const e = fresh();
    assert(!("hp" in e.visibleEnemies()[0]));
    const r = e.invoke("enemy_inspect", { enemyId: "orc-1" });
    assert(r.hp === 60 && r.attack === 18 && r.weakness.includes("Arcane"));
    assert(e.state().enemies.find((v) => v.enemyId === "orc-1").hp === 60);
  });
  test("Skill mana consumption", () => {
    const e = fresh();
    const r = e.useSkill({ skill: "arcane_shot", enemyId: "goblin-1" });
    assert(r.success && e.s.player.mana === 45 && e.enemy("goblin-1").hp === 5);
  });
  test("Cooldown blocks atomically and expires", () => {
    const e = fresh();
    e.useSkill({ skill: "arcane_shot", enemyId: "goblin-1" });
    const before = JSON.stringify(e.s);
    const r = e.useSkill({ skill: "arcane_shot", enemyId: "goblin-1" });
    assert(!r.success && r.remainingTurns === 2 && JSON.stringify(e.s) === before);
    e.endTurn();
    e.resolveEnemies();
    assert(e.cooldown("arcane_shot") === 1);
    e.endTurn();
    e.resolveEnemies();
    assert(e.cooldown("arcane_shot") === 0);
  });
  test("Invalid skill target consumes nothing", () => {
    const e = fresh();
    const before = JSON.stringify(e.s);
    assert(!e.useSkill({ skill: "arcane_shot", enemyId: "orc-1" }).success);
    assert(JSON.stringify(e.s) === before);
  });
  test("Healing and cap", () => {
    const e = fresh();
    e.s.player.hp = 85;
    const r = e.useSkill({ skill: "heal" });
    assert(r.success && r.restored === 15 && e.s.player.hp === 100 && e.s.player.mana === 40);
  });
  test("Dash obeys obstacles", () => {
    const e = fresh();
    const before = JSON.stringify(e.s);
    assert(!e.useSkill({ skill: "dash", x: 2, y: 2 }).success);
    assert(JSON.stringify(e.s) === before);
    assert(e.useSkill({ skill: "dash", x: 1, y: 5 }).success && e.s.player.mana === 50);
  });
  test("Inventory pickup", () => {
    const e = fresh();
    e.s.player.x = 1;
    e.s.player.y = 4;
    assert(e.pickup("health-potion-1").success && e.s.inventory.health_potion === 1);
    assert(!e.s.items.some((i) => i.id === "health-potion-1"));
  });
  test("Item use", () => {
    const e = fresh();
    e.s.inventory.health_potion = 1;
    e.s.player.hp = 50;
    const r = e.useItem("health_potion");
    assert(r.success && r.before === 50 && r.after === 85 && e.s.inventory.health_potion === 0);
  });
  test("Enemy AI and turn transition", () => {
    const e = fresh();
    e.endTurn();
    assert(e.s.phase === "enemy");
    const before = { x: e.enemy("goblin-1").x, y: e.enemy("goblin-1").y };
    e.resolveEnemies();
    assert(!same(e.enemy("goblin-1"), before));
    assert(e.s.turn === 2 && e.s.phase === "player" && e.s.actionPoints === 2);
  });
  test("Enemy phase validation", () => {
    const e = fresh();
    e.endTurn();
    const before = JSON.stringify(e.s);
    assert(!e.move(2, 1).success && JSON.stringify(e.s) === before);
  });
  test("Barrier halves next hit", () => {
    const e = fresh();
    e.useSkill({ skill: "barrier" });
    const d = e.hurtPlayer(18, "Test Orc");
    assert(d === 7 && e.s.player.hp === 93 && !e.s.player.barrier);
  });
  test("Barrier expiry", () => {
    const e = fresh();
    e.s.enemies.forEach((v) => (v.hp = 0));
    e.useSkill({ skill: "barrier" });
    e.endTurn();
    e.resolveEnemies();
    assert(!!e.s.player.barrier);
    e.endTurn();
    e.resolveEnemies();
    assert(!e.s.player.barrier);
  });
  test("Trap traversal", () => {
    const e = fresh();
    e.s.player.x = 6;
    e.s.player.y = 1;
    const r = e.move(6, 3);
    assert(r.success && r.trapDamage === 20 && e.s.player.hp === 80);
  });
  test("Objective collection", () => {
    const e = fresh();
    e.s.player.x = 6;
    e.s.player.y = 4;
    assert(e.pickup("ancient-crystal").success && e.s.exitUnlocked && e.progress().hasCrystal && !e.s.victory);
  });
  test("Exit blocked without crystal", () => {
    const e = fresh();
    e.s.player.x = 6;
    e.s.player.y = 6;
    assert(!e.leave("UI").success && !e.s.victory);
  });
  test("Victory requires exact portal position", () => {
    const e = fresh();
    e.s.inventory.ancient_crystal = 1;
    assert(!e.leave("UI").success);
    e.s.player.x = 6;
    e.s.player.y = 6;
    assert(
      e.leave("WebMCP").success &&
        e.s.runVictory &&
        e.s.objectiveCompleted &&
        e.s.victorySource === "WebMCP",
    );
  });
  test("Game over", () => {
    const e = fresh();
    e.s.player.hp = 1;
    e.hurtPlayer(18, "Test Orc");
    assert(e.s.defeated && e.s.player.hp === 0 && e.s.phase === "defeated" && !e.move(2, 1).success);
  });
  test("Reset", () => {
    const e = fresh();
    e.s.player.hp = 0;
    e.s.defeated = true;
    e.s.inventory.ancient_crystal = 1;
    e.enemy("orc-1").hp = 0;
    e.s.player.cooldowns.heal = 99;
    e.reset({ mode: "tutorial", seed: "tutorial" });
    assert(e.s.player.hp === 100 && e.s.player.mana === 60 && e.s.turn === 1 && e.s.actionPoints === 2);
    assert(!e.s.defeated && !e.s.victory && e.s.inventory.ancient_crystal === 0 && e.s.items.length === 3);
    assert(e.enemy("orc-1").hp === 60 && e.cooldown("heal") === 0 && !e.enemy("orc-1").inspected);
  });
  test("Schema validation", () => {
    assert(validateArgs(TOOL_BY_NAME.get("player_move"), { x: 8, y: 1 }).success === false);
    assert(validateArgs(TOOL_BY_NAME.get("player_use_skill"), { skill: "dash" }).success === false);
    assert(validateArgs(TOOL_BY_NAME.get("game_get_state"), { extra: 1 }).success === false);
    assert(validateArgs(TOOL_BY_NAME.get("game_get_state"), {}) === null);
  });
  test("Available actions are actually legal", () => {
    const original = fresh();
    for (const tile of original.available().reachableTiles) {
      const e = fresh();
      assert(e.move(tile.x, tile.y).success);
    }
    for (const skill of original.available().availableSkills) {
      const e = fresh();
      const a = { skill: skill.skill };
      if (skill.targetType === "enemy") a.enemyId = skill.validEnemyIds[0];
      if (skill.targetType === "tile") Object.assign(a, { x: skill.reachableTiles[0].x, y: skill.reachableTiles[0].y });
      assert(e.useSkill(a).success, skill.skill);
    }
  });
  test("Campaign multi-floor reward flow", () => {
    const e = new GameEngine({ mode: "campaign", seed: "self-test-seed" });
    assert(e.s.floorCount === FLOOR_COUNT);
    e.s.inventory.ancient_crystal = 1;
    e.s.player.x = e.s.exit.x;
    e.s.player.y = e.s.exit.y;
    const left = e.leave("UI");
    assert(left.success && left.awaitingReward && left.rewardOptions.length === 3);
    const rewardId = left.rewardOptions[0].id;
    const next = e.chooseReward(rewardId);
    assert(next.success && e.s.floorIndex === 1 && e.s.phase === "player");
    assert(e.s.player.gear.includes(rewardId));
  });
  test("WebMCP tool count includes dungeon tools", () => {
    assert(TOOLS.length >= 28);
    assert(TOOL_BY_NAME.has("dungeon_start_run"));
    assert(TOOL_BY_NAME.has("dungeon_choose_reward"));
    assert(MODE_ORDER.includes("daily"));
  });
  $("test-status").textContent = failed
    ? `${failed} self-test(s) failed · see console`
    : `✓ ${passed} isolated engine checks passed · ${TOOLS.length} tools`;
  console.info(`[Dungeon self-tests] ${passed} passed, ${failed} failed. Live state was not modified.`);
}

GameRenderer.initBoard();
GameRenderer.render();
adapter.renderTools();
runSelfTests();
adapter.initialize();

// Soft unlock audio on first pointer.
document.addEventListener(
  "pointerdown",
  () => {
    playSelect();
  },
  { once: true },
);
