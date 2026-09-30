const { test, expect } = require("@playwright/test");

test("inclusive date range sends both dates, displays future schedule and only previews completed data", async ({ page }) => {
  let request;
  await page.route("**/api/esports/candidates", (route) => {
    request = route.request().postDataJSON();
    const completed = { seriesId: "complete", date: "2026-09-01", league: "LCK", teamA: "T1", teamB: "GEN", seriesScore: "3-2", status: "completed", canPreview: true };
    return route.fulfill({ json: { success: true, scanId: "range", candidates: [completed], entries: [completed,
      { seriesId: "future", date: "2026-09-03", league: "LPL", teamA: "JDG", teamB: "BLG", status: "scheduled", canPreview: false }],
      range: { startDate: "2026-09-01", endDate: "2026-09-03" } } });
  });
  await page.goto("/");
  await page.getByLabel("開始日期").fill("2026-09-01");
  await page.getByLabel("結束日期").fill("2026-09-03");
  await page.getByRole("button", { name: "尋找區間賽事" }).click();
  await expect.poll(() => request?.startDate).toBe("2026-09-01");
  expect(request.endDate).toBe("2026-09-03");
  await page.getByRole("combobox").click();
  await expect(page.getByRole("option", { name: /2026-09-03.*LPL.*未開打/ })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("option", { name: /2026-09-01.*LCK.*已完成/ })).toBeVisible();
});

test("invalid range makes no request, and changing the end date clears old results", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/esports/candidates", (route) => {
    requests++;
    return route.fulfill({ json: { success: true, scanId: "empty", candidates: [], entries: [] } });
  });
  await page.goto("/");
  await page.getByLabel("開始日期").fill("2026-09-01");
  await page.getByLabel("結束日期").fill("2026-10-02");
  await expect(page.getByRole("button", { name: "尋找區間賽事" })).toBeDisabled();
  await expect(page.getByTestId("esports-workflow").getByRole("alert")).toContainText("31");
  expect(requests).toBe(0);
  await page.getByLabel("結束日期").fill("2026-09-30");
  await page.getByRole("button", { name: "尋找區間賽事" }).click();
  await expect(page.getByText("這個區間的資料來源尚未登錄一級賽事。", { exact: false })).toBeVisible();
  await page.getByLabel("結束日期").fill("2026-09-29");
  await expect(page.getByText("這個區間的資料來源尚未登錄一級賽事。", { exact: false })).toHaveCount(0);
});
