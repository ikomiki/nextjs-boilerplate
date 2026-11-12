import { expect, type Page, test } from "@playwright/test";

const apps = [
  { name: "indexed-db", url: "http://localhost:3001", persists: true },
  { name: "memory", url: "http://localhost:3002", persists: false },
  { name: "sqlite", url: "http://localhost:3003", persists: true },
];

const display = (page: Page) =>
  page.getByRole("status", { name: "カウンター" });
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });

for (const app of apps) {
  test.describe(app.name, () => {
    test.describe.configure({ mode: "serial" });

    test.beforeEach(async ({ page }) => {
      await page.goto(app.url);
      await button(page, "リセット").click();
      await expect(display(page)).toHaveAttribute("data-value", "0");
    });

    test("+1 を 3 回で 3、リセットで 0", async ({ page }) => {
      for (let i = 0; i < 3; i++) await button(page, "+1").click();
      await expect(display(page)).toHaveAttribute("data-value", "3");
      await button(page, "リセット").click();
      await expect(display(page)).toHaveAttribute("data-value", "0");
    });

    test("再読込後の値", async ({ page }) => {
      await button(page, "+1").click();
      await button(page, "+1").click();
      await expect(display(page)).toHaveAttribute("data-value", "2");
      await expect(page.getByRole("main")).toHaveAttribute(
        "aria-busy",
        "false",
      );
      await page.reload();
      await expect(button(page, "+1")).toBeEnabled();
      await expect(display(page)).toHaveAttribute(
        "data-value",
        app.persists ? "2" : "0",
      );
    });

    test("素早く 10 回押し、保存の完了を確かめて再読込", async ({ page }) => {
      const plus = button(page, "+1");
      await expect(plus).toBeEnabled();
      await Promise.all(Array.from({ length: 10 }, () => plus.click()));
      await expect(display(page)).toHaveAttribute("data-value", "10");
      await expect(page.getByRole("main")).toHaveAttribute(
        "aria-busy",
        "false",
      );
      await page.reload();
      await expect(button(page, "+1")).toBeEnabled();
      await expect(display(page)).toHaveAttribute(
        "data-value",
        app.persists ? "10" : "0",
      );
    });
  });
}
