const { test, expect } = require("@playwright/test");

test("cached scan explains provenance and previews the original saved scan", async ({ page }) => {
  let cacheReason = "rate_limit";
  let previewRequest;
  await page.route("**/api/esports/candidates", (route) => route.fulfill({ json: {
    success: true, scanId: "original-saved-scan",
    sourceStatus: { status: "cached", cacheReason, cachedAt: "2026-08-29T08:00:00.000Z" },
    candidates: [{ seriesId: "bf-bro", league: "LCK", teamA: "BNK FEARX", teamB: "HANJIN BRION", seriesScore: "3-2" }],
  } }));
  await page.route("**/api/esports/player-radar", (route) => {
    previewRequest = route.request().postDataJSON();
    return route.fulfill({ json: { success: true, videos: [], validationReports: [] } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "尋找已完成賽事" }).click();
  const status = page.getByRole("status").filter({ hasText: "使用已保存的賽事資料" });
  await expect(status).toBeVisible();
  await expect(status).toContainText("Leaguepedia 暫時限制請求");
  await expect(status.locator("time")).toHaveAttribute("datetime", "2026-08-29T08:00:00.000Z");
  await expect(status.locator("time")).toContainText("2026");
  await page.getByRole("button", { name: "產生影片預覽" }).click();
  await expect.poll(() => previewRequest?.scanId).toBe("original-saved-scan");
  expect(previewRequest.mode).toBe("preview");
  cacheReason = "fresh";
  await page.getByRole("button", { name: "尋找已完成賽事" }).click();
  await expect(status).not.toContainText("Leaguepedia 暫時限制請求");
  await page.locator("#esports-date").fill("2026-08-27");
  await expect(status).toHaveCount(0);
});

test("esports workflow previews before publishing the same artifact", async ({ page }) => {
  let previewRequest;
  let publishRequest;
  await page.route("**/api/esports/candidates", async (route) => route.fulfill({ json: {
    success: true,
    scanId: "scan-lck",
    candidates: [{
      seriesId: "hle-gen",
      league: "LCK",
      teamA: "HLE",
      teamB: "GEN",
      seriesScore: "0-2",
      recommendedMvp: { name: "Canyon" },
    }],
  } }));
  await page.route("**/api/esports/player-radar", async (route) => {
    previewRequest = route.request().postDataJSON();
    await route.fulfill({ json: {
      success: true,
      videos: [{ locale: "zh", videoUrl: "/renders/hle-gen.mp4" }],
      validationReports: [{ passed: true, reasons: [] }],
      payloads: [{ locale: "zh", dataType: "PLAYER_RADAR", title: "賽後判讀" }],
    } });
  });
  await page.route("**/api/publish", async (route) => {
    if (route.request().method() === "POST") {
      publishRequest = route.request().postDataJSON();
      await route.fulfill({ json: { success: true, jobs: [{ id: "ig", platform: "instagram", locale: "zh", status: "PUBLISHED" }] } });
      return;
    }
    await route.continue();
  });

  await page.goto("/");
  await expect(page.getByRole("button", { name: "確認發布這份成品" })).toHaveCount(0);
  await page.getByRole("button", { name: "尋找已完成賽事" }).click();
  await expect(page.getByRole("combobox")).toContainText("LCK · HLE vs GEN · 0-2");
  await page.getByRole("button", { name: "產生影片預覽" }).click();
  await expect(page.locator("video")).toHaveAttribute("src", "/renders/hle-gen.mp4");
  await page.locator("#esports-date").fill("2026-08-13");
  await expect(page.locator("video")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "確認發布這份成品" })).toHaveCount(0);
  await page.getByRole("button", { name: "尋找已完成賽事" }).click();
  await page.getByRole("button", { name: "產生影片預覽" }).click();
  await page.getByRole("button", { name: "確認發布這份成品" }).click();

  expect(previewRequest).toMatchObject({ scanId: "scan-lck", seriesId: "hle-gen", mode: "preview", languages: ["zh"] });
  expect(publishRequest.videos).toEqual([{ locale: "zh", videoUrl: "/renders/hle-gen.mp4" }]);
});

test("global tier-one scan keeps every league option and clears a stale preview", async ({ page }) => {
  const candidates = [
    { seriesId: "lec", league: "LEC", teamA: "G2", teamB: "KC", seriesScore: "2-1" },
    { seriesId: "lcs", league: "LCS", teamA: "FLY", teamB: "C9", seriesScore: "2-0" },
    { seriesId: "lck", league: "LCK", teamA: "BFX", teamB: "NS", seriesScore: "3-1" },
    { seriesId: "msi", league: "MSI", teamA: "GEN", teamB: "G2", seriesScore: "3-2" },
  ];
  await page.route("**/api/esports/candidates", async (route) => route.fulfill({ json: {
    success: true,
    scanId: "scan-global",
    candidates,
  } }));
  await page.route("**/api/esports/player-radar", async (route) => route.fulfill({ json: {
    success: true,
    videos: [{ locale: "zh", videoUrl: "/renders/global.mp4" }],
    validationReports: [{ passed: true, reasons: [] }],
    payloads: [{ locale: "zh", dataType: "PLAYER_RADAR" }],
  } }));

  await page.goto("/");
  await page.getByRole("button", { name: "尋找已完成賽事" }).click();
  await page.getByRole("combobox").click();
  for (const candidate of candidates) {
    await expect(page.getByRole("option", { name: `${candidate.league} · ${candidate.teamA} vs ${candidate.teamB} · ${candidate.seriesScore}` })).toBeVisible();
  }
  await page.getByRole("option", { name: "LEC · G2 vs KC · 2-1" }).click();
  await page.getByRole("button", { name: "產生影片預覽" }).click();
  await expect(page.locator("video")).toHaveAttribute("src", "/renders/global.mp4");

  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "LCS · FLY vs C9 · 2-0" }).click();
  await expect(page.locator("video")).toHaveCount(0);
});

test("version workflow keeps selection single and reuses its preview", async ({ page }) => {
  let publishRequest;
  await page.route("**/api/content-factory/library?**", async (route) => route.fulfill({ json: {
    success: true,
    items: [
      { id: "patch-a", status: "READY", category: "CHAMPION", patchVersion: "26.16", localizedName: "阿璃", payload: { dataType: "PATCH" } },
      { id: "patch-b", status: "READY", category: "CHAMPION", patchVersion: "26.16", localizedName: "犽凝", payload: { dataType: "PATCH" } },
    ],
  } }));
  await page.route("**/api/content-factory/preview", async (route) => route.fulfill({ json: {
    success: true,
    item: { id: "patch-b", status: "READY" },
    render: { videos: [{ locale: "zh", videoUrl: "/renders/patch-b.mp4" }] },
  } }));
  await page.route("**/api/content-factory/publish", async (route) => {
    publishRequest = route.request().postDataJSON();
    await route.fulfill({ json: {
      success: true,
      results: [{ success: true, item: { id: "patch-b", status: "PUBLISHED" }, publish: { jobs: [{ id: "threads", platform: "threads", status: "PUBLISHED" }] } }],
    } });
  });

  await page.goto("/");
  await page.getByRole("tab", { name: "版本更新" }).click();
  await page.getByRole("button", { name: /犽凝/ }).click();
  await page.getByRole("button", { name: "產生影片預覽" }).click();
  await expect(page.locator("video")).toHaveAttribute("src", "/renders/patch-b.mp4");
  await page.getByRole("button", { name: "確認發布這份成品" }).click();
  await expect(page.getByText("Threads · PUBLISHED")).toBeVisible();
  await expect(page.getByRole("button", { name: "確認發布這份成品" })).toHaveCount(0);

  expect(publishRequest.itemIds).toEqual(["patch-b"]);
});

test("secondary tools stay behind the advanced panel", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "進階工具" }).click();

  await expect(page.getByRole("dialog", { name: "進階工具" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Meta" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "成效" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "佇列" })).toBeVisible();
});
