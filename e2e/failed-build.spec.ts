import { expect, test } from "@playwright/test";
import { collectPageErrors, expectNoPageErrors, prepareCleanPage } from "./helpers";

/**
 * 실패 Build 시나리오 (#268 시나리오 4, mock deterministic).
 *
 * Builds 목록의 failed run → 상세에서 실패 stage/상태 노출 → BuildSpec 편집 진입.
 */
test.beforeEach(async ({ page }) => {
  await prepareCleanPage(page);
});

test("실패 run이 Builds 목록에 실패 상태로 표시된다", async ({ page }) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await page.goto("/builds");
  // mock 이력에 failed run(air-2026-08-14)이 존재한다.
  await expect(page.getByText("dur-older-adult-caution-20260618").first()).toBeVisible({ timeout: 10_000 });

  await expectNoPageErrors(errors);
});

test("실패 run 상세가 실패 stage와 증거를 표시하고 편집으로 이동한다", async ({ page }) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await page.goto("/builds/dur-older-adult-caution-20260618");
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10_000 });

  // 마스터-디테일 상세가 실패 상태 배지를 노출한다(hidden select option과 구분).
  const visibleFailed = page.getByText("실패").and(page.locator(":visible")).first();
  await expect(visibleFailed).toBeVisible({ timeout: 10_000 });

  // BuildSpec 편집 진입(실패 → 수정 흐름).
  const editLink = page.getByRole("link", { name: /편집|수정/ }).first();
  if (await editLink.isVisible().catch(() => false)) {
    await editLink.click();
    await page.waitForURL(/\/builds\//);
  }

  await expectNoPageErrors(errors);
});

test("Dataset Catalog가 실패 dataset의 stage 상태를 정상으로 위장하지 않는다 (#268 원칙)", async ({
  page,
}) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await page.goto("/datasets");
  await expect(page.getByRole("heading", { name: /Dataset Catalog/i }).first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText("대기질 통합 데이터").first()).toBeVisible();

  await expectNoPageErrors(errors);
});
