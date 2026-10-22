#!/usr/bin/env node
/**
 * Record a short mobile + desktop playthrough covering daily + combat.
 * Output: /opt/cursor/artifacts/bl-demo-*.webm|mp4 and refreshed PNGs.
 */
import { chromium, devices } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const PORT = Number(process.env.PORT) || 3000;
const BASE = `http://127.0.0.1:${PORT}/gpt6-astra/borderland/`;
const OUT = process.env.ARTIFACT_DIR || "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });

const LAUNCH = {
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome-stable",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--no-sandbox"],
};

function webmToMp4(webmPath, mp4Path) {
  const r = spawnSync(
    "ffmpeg",
    ["-y", "-i", webmPath, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", mp4Path],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    console.warn("ffmpeg convert failed", r.stderr?.slice(0, 200));
    return false;
  }
  console.log("mp4", mp4Path);
  return true;
}

async function playCombat(page, seconds = 8) {
  await page.evaluate(async (sec) => {
    const t = window.__dustRiotTest;
    t.enableUnlockPlay();
    t.jumpToWave(4);
    await new Promise((r) => setTimeout(r, 200));
    const end = performance.now() + sec * 1000;
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", key: "w" }));
    window.dispatchEvent(new MouseEvent("mousedown", { button: 0, buttons: 1 }));
    while (performance.now() < end) {
      window.dispatchEvent(
        new MouseEvent("mousemove", {
          movementX: (Math.random() - 0.5) * 50,
          movementY: (Math.random() - 0.5) * 24,
          buttons: 1,
        }),
      );
      await new Promise((r) => setTimeout(r, 50));
    }
    window.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW", key: "w" }));
  }, seconds);
}

const browser = await chromium.launch(LAUNCH);

// ---- Desktop demo video ----
{
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  await page.goto(`${BASE}?test=1`, { waitUntil: "networkidle" });
  await page.click('[data-mode="daily"]');
  await page.waitForSelector("#dailyCard");
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, "bl-daily-desktop.png") });
  await page.click("#openMeta");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "bl-meta-desktop.png") });
  await page.click("#metaBack");
  await page.click('[data-weapon="rifle"]');
  // Prefer a non-banned weapon if daily still selected — switch to easy for combat clarity
  await page.click('[data-mode="easy"]');
  await page.click("#start");
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__dustRiotTest.enableUnlockPlay());
  await playCombat(page, 6);
  const kinds = await page.evaluate(() => window.__dustRiotTest.getEnemyKinds());
  console.log("desktop kinds after combat", kinds);
  await page.screenshot({ path: path.join(OUT, "bl-combat-desktop.png") });
  const video = await page.video();
  await context.close();
  const vpath = await video.path();
  const dest = path.join(OUT, "bl-demo-desktop.webm");
  fs.renameSync(vpath, dest);
  console.log("video", dest);
  webmToMp4(dest, path.join(OUT, "bl-demo-desktop.mp4"));
}

// ---- Mobile demo ----
{
  const iPhone = devices["iPhone 13"];
  const context = await browser.newContext({
    viewport: iPhone.viewport,
    userAgent: iPhone.userAgent,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: iPhone.deviceScaleFactor,
    recordVideo: { dir: OUT, size: iPhone.viewport },
  });
  const page = await context.newPage();
  await page.goto(`${BASE}?test=1&touch=1`, { waitUntil: "networkidle" });
  await page.click('[data-mode="daily"]');
  await page.waitForSelector("#dailyCard");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "bl-daily-mobile.png") });
  await page.click('[data-mode="easy"]');
  await page.click('[data-weapon="smg"]');
  await page.click("#start");
  await page.waitForTimeout(400);

  async function dragStick(sel, dx, dy, holdMs) {
    const el = await page.$(sel);
    const box = await el.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.locator(sel).dispatchEvent("pointerdown", {
      clientX: cx, clientY: cy, pointerId: 1, bubbles: true,
    });
    await page.locator(sel).dispatchEvent("pointermove", {
      clientX: cx + dx, clientY: cy + dy, pointerId: 1, bubbles: true,
    });
    await page.waitForTimeout(holdMs);
    await page.locator(sel).dispatchEvent("pointerup", {
      pointerId: 1, bubbles: true,
    });
  }

  for (let i = 0; i < 5; i++) {
    await dragStick("#lookStick", 30 - i * 4, -10, 200);
    await dragStick("#moveStick", 0, -40, 300);
    const fire = await page.$("#btnFire");
    const fb = await fire.boundingBox();
    await page.locator("#btnFire").dispatchEvent("pointerdown", {
      clientX: fb.x + fb.width / 2,
      clientY: fb.y + fb.height / 2,
      pointerId: 2,
      bubbles: true,
    });
    await page.waitForTimeout(350);
    await page.locator("#btnFire").dispatchEvent("pointerup", {
      pointerId: 2, bubbles: true,
    });
  }

  const waveInfo = await page.evaluate(() => ({
    ui: window.__dustRiotTest.getUi(),
    wave: window.__dustRiotTest.getWave(),
    kinds: window.__dustRiotTest.getEnemyKinds(),
    ammo: window.__dustRiotTest.getAmmo(),
    hp: window.__dustRiotTest.getPlayerHp(),
  }));
  console.log("mobile mid", waveInfo);
  await page.screenshot({ path: path.join(OUT, "bl-combat-mobile.png") });

  await page.click("#pauseBtn");
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "bl-pause-mobile.png") });
  await page.click("#resume");
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    window.__dustRiotTest.setMode("daily");
    window.__dustRiotTest.beginRun();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__dustRiotTest.finishRun("victory"));
  await page.waitForSelector("#shareText");
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, "bl-result-mobile.png") });

  const video = await page.video();
  await context.close();
  const vpath = await video.path();
  const dest = path.join(OUT, "bl-demo-mobile.webm");
  fs.renameSync(vpath, dest);
  console.log("video", dest);
  webmToMp4(dest, path.join(OUT, "bl-demo.mp4"));
}

await browser.close();
console.log("demo-playthrough: ok");
