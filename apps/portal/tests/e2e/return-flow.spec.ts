import { expect, test } from "@playwright/test";

test("consumer can navigate the return flow shell", async ({ page }) => {
  await page.goto("/returns/new");
  await expect(page.getByRole("heading", { name: "Return flow" })).toBeVisible();
  await expect(page.getByLabel("Order number")).toBeVisible();
  await expect(page.getByRole("button", { name: /find order/i })).toBeVisible();
});
