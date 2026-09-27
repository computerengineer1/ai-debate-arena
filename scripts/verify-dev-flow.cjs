/**
 * Verifies the two lifecycle bugs are dead:
 *  1. dev-mode (StrictMode) SPA entry must actually run the show
 *     (previously the teardown killed the director at birth)
 *  2. a page RELOAD must show the RESUME card instead of auto-starting
 * Usage: node scripts/verify-dev-flow.cjs [baseUrl]
 */
const { chromium } = require("playwright-core");
const B = process.argv[2] || "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({
    args: [
      "--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
      "--autoplay-policy=no-user-gesture-required",
      ...(process.env.E2E_LOW_MEM ? ["--single-process", "--disable-gpu", "--disable-software-rasterizer", "--js-flags=--max-old-space-size=160", "--renderer-process-limit=1", "--no-zygote"] : []),
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1152, height: 648 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

  /* — real user flow: landing → type topic → ENTER — */
  await page.goto(B, { waitUntil: "domcontentloaded", timeout: 90000 });
  await sleep(4000);
  await page.fill("textarea", "Esports are real sports");
  await page.click("text=ENTER THE ARENA", { force: true, timeout: 60000 });
  console.log("→ clicked ENTER (SPA navigation)");

  // The show must be alive: phase should leave 'idle' and reach speaking
  const alive = await page
    .waitForFunction(() => ["intro", "speaking", "generating"].includes(window.__arenaPhase), null, { timeout: 60000 })
    .then(() => true)
    .catch(() => false);
  console.log(alive ? "✓ show booting after SPA entry" : "✗ SHOW DEAD after SPA entry");

  const speaking = await page
    .waitForFunction(() => window.__arenaPhase === "speaking" && window.__arenaTurn === 0, null, { timeout: 120000 })
    .then(() => true)
    .catch(() => false);
  console.log(speaking ? "✓ turn 0 speaking (audio pipeline live)" : "✗ never reached speaking");

  /* — reload mid-show: must NOT auto-restart — */
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await sleep(5000);
  const phaseAfterReload = await page.evaluate(() => window.__arenaPhase);
  const resumeVisible = await page.locator("button", { hasText: /resume|استئناف|Reprendre|Weiter/i }).first().isVisible().catch(() => false);
  console.log("phase after reload:", phaseAfterReload, "| resume card:", resumeVisible ? "✓ shown" : "✗ missing");
  const notAuto = phaseAfterReload !== "speaking";
  console.log(notAuto ? "✓ no auto-start on reload" : "✗ auto-started on reload");

  /* — clicking RESUME must start the show (gesture-safe) — */
  if (resumeVisible) {
    await page.locator("button", { hasText: /resume|استئناف|Reprendre|Weiter/i }).first().click({ force: true });
    const resumed = await page
      .waitForFunction(() => ["generating", "intro", "speaking"].includes(window.__arenaPhase), null, { timeout: 60000 })
      .then(() => true)
      .catch(() => false);
    console.log(resumed ? "✓ resume click starts the show" : "✗ resume click did nothing");
  }

  console.log("runtime errors:", errors.length ? errors.slice(0, 5) : "none");
  await browser.close();
  process.exit(alive && speaking && notAuto ? 0 : 1);
})().catch((e) => {
  console.error("VERIFY FAIL:", e.message);
  process.exit(1);
});
