import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, "thumbs");
const BASE = process.env.GPT6_GALLERY_BASE || "http://127.0.0.1:8765";

const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"),
);
const items = Array.isArray(manifest.items) ? manifest.items : [];

if (!items.length) {
  console.error("manifest.json has no items");
  process.exit(1);
}

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
  const href = item.href || `${item.id}/index.html`;
  const url = `${BASE}/${href}`;
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
