import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, "thumbs");
const BASE = "http://127.0.0.1:8765";

const items = [
  { id: "webmcp-ai-smart-home", href: "webmcp-ai-smart-home/ai-smart-home.html" },
  { id: "webmcp-mini-amazon", href: "webmcp-Mini Amazon/webmcp-Mini Amazon.html" },
  { id: "webmcp-mini-tactical-dungeon", href: "webmcp-Mini Tactical Dungeon/Mini Tactical Dungeon.html" },
  { id: "webmcp-mini-factory", href: "webmcp-mini-factory/mini-factory.html" },
  { id: "webmcp-escape-room", href: "webmcp-Escape Room/escape-room.html" },
  { id: "webmcp-agent-trello", href: "webmcp-Agent Trello/Agent Trello.html" },
  { id: "webmcp-pizza", href: "webmcp-pizza/webmcp-pizza.html" },
  { id: "webmcp-rubiks-cube", href: "webmcp-Rubik's Cube/Rubik's Cube.html" },
  { id: "loop-hero", href: "loop-hero/loop-hero.html" },
  { id: "archer", href: "archer/archer.html" },
  { id: "exhibition-web", href: "Exhibition Web/Exhibition.html" },
  { id: "3d-sailing", href: "3d-sailing/3d-sailing.html" },
  { id: "train", href: "train/train.html" },
  { id: "3d-fill-the-void", href: "3D Fill the Void/3D-fill-the-Void.html" },
  { id: "borderland", href: "borderland/borderland.html" },
];

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
page.setDefaultTimeout(45000);

const results = [];

for (const item of items) {
  const url = `${BASE}/${item.href.split("/").map(encodeURIComponent).join("/")}`;
  const outPath = path.join(OUT, `${item.id}.webp`);
  process.stdout.write(`SHOT ${item.id} ... `);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2500);
    for (const sel of [
      'button:has-text("Start")',
      'button:has-text("Play")',
      'button:has-text("Begin")',
      'button:has-text("Enter")',
      'button:has-text("開始")',
      "[data-start]",
      ".start-btn",
      "#start",
    ]) {
      const btn = page.locator(sel).first();
      if ((await btn.count()) && (await btn.isVisible().catch(() => false))) {
        await btn.click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(1200);
        break;
      }
    }
    await page.screenshot({ path: outPath, type: "png" });
    // Playwright writes PNG bytes even when path ends in .webp on some versions;
    // re-encode to real WebP via sharp when available.
    try {
      const sharp = (await import("sharp")).default;
      const buf = fs.readFileSync(outPath);
      await sharp(buf).webp({ quality: 82 }).toFile(outPath);
    } catch {
      // keep raw screenshot if sharp is unavailable
    }
    const size = fs.statSync(outPath).size;
    console.log(`ok (${Math.round(size / 1024)}KB)`);
    results.push({ id: item.id, ok: true, size });
  } catch (err) {
    console.log(`FAIL ${err.message}`);
    results.push({ id: item.id, ok: false, error: err.message });
  }
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`done: ${results.length - failed.length}/${results.length} ok`);
if (failed.length) process.exitCode = 1;
