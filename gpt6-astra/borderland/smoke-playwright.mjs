#!/usr/bin/env node
/**
 * Smoke: desktop menu→start, mobile touch chrome enterable,
 * daily mutation + meta unlock surfaces.
 * Requires a running server on PORT (default 3000).
 * Artifact filenames use the bl- prefix.
 */
import { chromium, devices } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const BASE = `http://127.0.0.1:${PORT}/gpt6-astra/borderland/`;
const OUT = process.env.ARTIFACT_DIR || "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });

const LAUNCH = {
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome-stable",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--no-sandbox"],
};

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log("shot", file);
  return file;
}

const browser = await chromium.launch(LAUNCH);

{
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}?test=1`, { waitUntil: "networkidle" });
  await page.waitForSelector("#start");
  await page.waitForSelector('[data-weapon="smg"]');
  await page.waitForSelector('[data-mode="daily"]');
  await page.waitForSelector("#openMeta");
  await shot(page, "bl-menu-desktop.png");

  await page.click('[data-mode="daily"]');
  await page.waitForSelector("#dailyCard");
  await shot(page, "bl-daily-desktop.png");

  await page.click("#openMeta");
  await page.waitForSelector('[data-unlock="startBandage"]');
  await shot(page, "bl-meta-desktop.png");
  await page.click("#metaBack");

  await page.click('[data-mode="easy"]');
  await page.click('[data-weapon="shotgun"]');
  await page.click("#start");
  await page.waitForTimeout(400);

  const state = await page.evaluate(async () => {
    const t = window.__dustRiotTest;
    if (!t) throw new Error("missing __dustRiotTest");
    if (t.getUi() !== "playing") t.beginRun();
    t.enableUnlockPlay();
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", key: "w" }));
    await new Promise((r) => setTimeout(r, 700));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW", key: "w" }));
    return {
      ui: t.getUi(),
      wave: t.getWave(),
      kinds: t.getEnemyKinds(),
      weapon: t.getWeapon(),
    };
  });
  console.log("desktop state", state);
  if (state.ui !== "playing") throw new Error(`desktop expected playing, got ${state.ui}`);
  if (state.weapon !== "shotgun") throw new Error("weapon not shotgun");
  if (!state.kinds.length) throw new Error("no enemies on desktop");

  await shot(page, "bl-ingame-desktop.png");
  await context.close();
  if (errors.length) console.warn("desktop pageerrors", errors.slice(0, 5));
}

{
  const iPhone = devices["iPhone 13"];
  const context = await browser.newContext({
    viewport: iPhone.viewport,
    userAgent: iPhone.userAgent,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: iPhone.deviceScaleFactor,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}?test=1&touch=1`, { waitUntil: "networkidle" });
  await page.waitForSelector("#start");
  await shot(page, "bl-menu-mobile.png");

  await page.click('[data-mode="daily"]');
  await page.waitForSelector("#dailyCard");
  await shot(page, "bl-daily-mobile.png");

  await page.click('[data-mode="easy"]');
  await page.click('[data-weapon="smg"]');
  await page.click("#start");
  await page.waitForTimeout(600);

  const state = await page.evaluate(() => {
    const t = window.__dustRiotTest;
    return {
      ui: t.getUi(),
      touch: t.isTouchMode(),
      wave: t.getWave(),
      kinds: t.getEnemyKinds(),
      touchUI: document.getElementById("touchUI").classList.contains("show"),
      fireBtn: !!document.getElementById("btnFire"),
    };
  });
  console.log("mobile state", state);
  if (state.ui !== "playing") throw new Error(`expected playing, got ${state.ui}`);
  if (!state.touchUI) throw new Error("touch UI not shown");
  if (!state.touch) throw new Error("isTouchMode false with ?touch=1");
  if (state.wave < 1) throw new Error("wave not started");
  if (!state.kinds.length) throw new Error("no enemies spawned");

  const move = await page.$("#moveStick");
  const box = await move.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.locator("#moveStick").dispatchEvent("pointerdown", {
    clientX: cx,
    clientY: cy,
    pointerId: 1,
    bubbles: true,
  });
  await page.locator("#moveStick").dispatchEvent("pointermove", {
    clientX: cx,
    clientY: cy - 50,
    pointerId: 1,
    bubbles: true,
  });
  await page.waitForTimeout(400);
  await page.locator("#moveStick").dispatchEvent("pointerup", {
    pointerId: 1,
    bubbles: true,
  });

  const fire = await page.$("#btnFire");
  const fb = await fire.boundingBox();
  await page.touchscreen.tap(fb.x + fb.width / 2, fb.y + fb.height / 2);
  await page.waitForTimeout(500);

  await shot(page, "bl-ingame-mobile.png");

  await page.evaluate(() => {
    const t = window.__dustRiotTest;
    t.setMode("daily");
    t.beginRun();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    window.__dustRiotTest.finishRun("victory");
  });
  await page.waitForSelector("#again");
  await page.waitForSelector("#shareText");
  await shot(page, "bl-result-mobile.png");

  const storage = await page.evaluate(() => {
    const v3 = localStorage.getItem("dust-riot-v3");
    const foreign = Object.keys(localStorage).filter(
      (k) => !k.startsWith("dust-riot-") && k.includes("riot"),
    );
    return { v3: v3 ? JSON.parse(v3) : null, foreign };
  });
  console.log("storage", {
    hasV3: !!storage.v3,
    lastWeapon: storage.v3?.lastWeapon,
    daily: storage.v3?.bestDaily,
    foreign: storage.foreign,
  });
  if (!storage.v3) throw new Error("dust-riot-v3 not written");
  if (storage.foreign.length) throw new Error("touched foreign keys");
  if (!storage.v3.bestDaily?.date) throw new Error("bestDaily missing");

  await context.close();
  if (errors.length) {
    console.warn("mobile pageerrors", errors.slice(0, 5));
    const real = errors.filter((e) => !/WebGL/i.test(e));
    if (real.length) throw new Error(real[0]);
  }
}

await browser.close();
console.log("smoke-playwright: ok");
