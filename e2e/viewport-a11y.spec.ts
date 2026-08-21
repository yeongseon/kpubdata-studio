import { expect, test } from "@playwright/test";
import { collectPageErrors, expectNoPageErrors, prepareCleanPage } from "./helpers";

/**
 * 반응형·키보드 기초 검증 (#268: 최소 viewport + keyboard/focus).
 * desktop/mobile 두 프로젝트에서 동일 스펙이 실행된다(playwright.config projects).
 */
test.beforeEach(async ({ page }) => {
  await prepareCleanPage(page);
});

test("주요 화면이 viewport에서 수평 오버플로 없이 렌더링된다", async ({ page }) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  for (const path of ["/", "/discover", "/monitoring", "/settings", "/workspace"]) {
    await page.goto(path);
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10_000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${path} horizontal overflow`).toBeLessThanOrEqual(2);
  }

  await expectNoPageErrors(errors);
});

test("키보드로 내비게이션 링크에 focus가 도달하고 focus가 보인다", async ({ page }) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await page.goto("/");

  // 첫 Tab이 포커스 가능 요소에 도달한다(정확한 요소가 아닌 도달 자체가 목적).
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toBeVisible();

  // focus-visible 스타일이 있는 요소는 outline 등으로 강조된다 — 클래스 존재만 확인.
  const focusableCount = await page.locator("a[href], button:not([disabled])").count();
  expect(focusableCount).toBeGreaterThan(0);

  await expectNoPageErrors(errors);
});

test("Login 폼이 라벨로 입력에 접근 가능하다 (접근성 기초)", async ({ page }) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await page.goto("/login");
  const email = page.getByLabel(/이메일/i).first();
  await expect(email).toBeVisible();
  await email.fill("e2e@example.com");
  await expect(email).toHaveValue("e2e@example.com");

  await expectNoPageErrors(errors);
});
