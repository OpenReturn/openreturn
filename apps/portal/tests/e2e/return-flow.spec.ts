import { expect, test } from "@playwright/test";

test("consumer can complete a refund return and open its status page", async ({ page }) => {
  await page.goto("/returns/new");
  await expect(page.getByRole("heading", { name: "Return flow" })).toBeVisible();

  await page.getByLabel("Order number").fill("ORDER-E2E-REFUND");
  await page.getByLabel("Email").fill("e2e-refund@example.com");
  await page.getByRole("button", { name: /find order/i }).click();

  await expect(page.getByRole("group", { name: "Items" })).toBeVisible();
  await page.getByLabel("Reason").selectOption("size");
  await page.getByLabel("Details").fill("The selected size does not fit.");
  await page.getByRole("radio", { name: "Refund" }).check();
  await page.getByRole("button", { name: /continue/i }).click();

  await page.getByLabel("Carrier").selectOption("postnl");
  await page.getByLabel("Service").selectOption("standard");
  await page.getByLabel("Drop-off point").fill("AMS-E2E-01");
  await page.getByRole("button", { name: /generate label/i }).click();

  await expect(page.getByRole("heading", { name: "Label ready" })).toBeVisible();
  await expect(page.getByText(/POSTNL-/)).toBeVisible();

  await page.getByRole("link", { name: /track return/i }).click();
  await expect(page.getByRole("heading", { name: "Return status" })).toBeVisible();
  await expect(page.getByText("label generated").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Event history" })).toBeVisible();
});

test("consumer can reserve an exchange before carrier selection", async ({ page }) => {
  await page.goto("/returns/new");

  await page.getByLabel("Order number").fill("ORDER-E2E-EXCHANGE");
  await page.getByLabel("Email").fill("e2e-exchange@example.com");
  await page.getByRole("button", { name: /find order/i }).click();

  await page.getByRole("radio", { name: "Exchange" }).check();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByLabel("Replacement SKU").fill("TSHIRT-BLACK-L-E2E");
  await page.getByRole("button", { name: /reserve exchange/i }).click();

  await page.getByLabel("Carrier").selectOption("dhl");
  await page.getByLabel("Service").selectOption("parcelshop");
  await page.getByRole("button", { name: /generate label/i }).click();

  await expect(page.getByRole("heading", { name: "Label ready" })).toBeVisible();
  await expect(page.getByText(/DHL-/)).toBeVisible();
});
