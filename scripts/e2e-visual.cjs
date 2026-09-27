/**
 * E2E visual rehearsal — runs a real full debate in headless Chromium,
 * screenshots every act, and reports runtime JS errors.
 *
 *   node scripts/e2e-visual.cjs [baseUrl]
 *
 * Requires: playwright-core + a downloaded chromium
 *   (npx playwright-core install chromium)
 * Saves shots to docs/*.png
 */
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const B = process.argv[2] || "http://localhost:3000";
const OUT = path.join(__dirname, "..", "docs");
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({
    args: [
      "--no-sandbox",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1152, height: 648 } });

  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("CONSOLE: " + m.text().slice(0, 200));
  });

  /* ── 1. Landing ── */
  await page.goto(B, { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(7000);
  await page.screenshot({ timeout: 120000, path: `${OUT}/01-landing.png` });
  console.log("✓ landing");

  /* ── 2. Enter arena with a real config ── */
  await page.evaluate(() => {
    sessionStorage.setItem(
      "arena-config",
      JSON.stringify({
        topic: "Artificial intelligence will replace human creativity",
        logosStance: "AI amplifies and democratizes human creativity",
        pathosStance: "AI hollows out the human soul of art",
        language: "en",
      }),
    );
  });
  const t0 = Date.now();
  await page.goto(B + "/arena", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(() => { document.documentElement.dataset.e2e = "1"; });
  const at = () => ((Date.now() - t0) / 1000).toFixed(0) + "s";

  await sleep(3000);
  await page.screenshot({ timeout: 120000, path: `${OUT}/02-generating.png` });
  await sleep(6500);
  await page.screenshot({ timeout: 120000, path: `${OUT}/03-intro-wide.png` });
  console.log("✓ intro @", at());

  await sleep(18000);
  await page.screenshot({ timeout: 120000, path: `${OUT}/04-logos-speaking.png` });
  console.log("✓ logos @", at());

  await page
    .waitForFunction(() => window.__arenaPhase === "speaking" && window.__arenaSpeaker === "pathos", null, { timeout: 150000 })
    .catch(() => console.log("  (pathos poll timeout)"));
  await sleep(6000);
  await page.screenshot({ timeout: 120000, path: `${OUT}/05-pathos-speaking.png` });
  console.log("✓ pathos @", at());

  await page.waitForFunction(() => window.__arenaRound >= 3, null, { timeout: 420000 }).catch(() => {});
  await sleep(8000);
  await page.screenshot({ timeout: 120000, path: `${OUT}/06-round3-heat.png` });
  console.log("✓ round3 @", at());

  await page
    .waitForFunction(() => ["referee_enter", "verdict_generating", "verdict"].includes(window.__arenaPhase), null, { timeout: 420000 })
    .catch(() => {});
  await sleep(2500);
  await page.screenshot({ timeout: 120000, path: `${OUT}/07-referee-entrance.png` });
  console.log("✓ referee @", at());

  await page.waitForFunction(() => window.__arenaPhase === "verdict", null, { timeout: 300000 }).catch(() => {});
  await sleep(7000);
  await page.screenshot({ timeout: 120000, path: `${OUT}/08-verdict.png` });
  console.log("✓ verdict @", at());

  await page.waitForFunction(() => window.__arenaPhase === "gavel", null, { timeout: 300000 }).catch(() => {});
  await sleep(700);
  await page.screenshot({ timeout: 120000, path: `${OUT}/09-gavel.png` });
  console.log("✓ gavel @", at());

  await page.waitForFunction(() => window.__arenaPhase === "victory", null, { timeout: 180000 }).catch(() => {});
  await sleep(4500);
  await page.screenshot({ timeout: 120000, path: `${OUT}/10-victory.png` });
  console.log("✓ victory @", at());

  for (const k of ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"]) {
    await page.keyboard.press(k);
    await sleep(60);
  }
  await sleep(3000);
  await page.screenshot({ timeout: 120000, path: `${OUT}/11-dance.png` });
  console.log("✓ dance (Konami)");

  console.log(`\n=== RUNTIME ERRORS (${errors.length}) ===`);
  for (const e of [...new Set(errors)].slice(0, 20)) console.log(" ", e);
  await browser.close();
})().catch((e) => {
  console.error("E2E FAIL:", e.message);
  process.exit(1);
});
