const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "docs/screenshots/workbench.png");

async function capturePortfolioEvidence() {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });

    await page.goto("http://127.0.0.1:3000/?portfolio=1", { waitUntil: "networkidle" });
    await page.getByText("Synthetic Pick A", { exact: false }).waitFor({ state: "visible" });

    const video = page.locator("video").first();
    await video.waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const preview = document.querySelector("video");
      return preview && preview.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
    });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({
      content: `
        html { zoom: 0.75; }
        nextjs-portal { display: none !important; }
      `,
    });

    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    await page.screenshot({ path: OUTPUT });
  } finally {
    await browser.close();
  }
}

capturePortfolioEvidence().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
