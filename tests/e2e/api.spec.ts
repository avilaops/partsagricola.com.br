import { expect, test } from "@playwright/test";

const apiOrigin = process.env.API_ORIGIN ?? "http://127.0.0.1:4100";

test("AVL-169: documentação OpenAPI e contrato de autorização", async ({
  page,
}, testInfo) => {
  const forbidden = await page.request.get(`${apiOrigin}/v1/admin`);
  expect(forbidden.status()).toBe(401);
  await expect
    .poll(async () => (await forbidden.json()).error.code)
    .toBe("AUTH_REQUIRED");

  await page.goto(`${apiOrigin}/v1/docs/`);
  await expect(page).toHaveTitle(/Parts Agrícola API|Swagger UI/i);
  await expect(
    page.getByRole("heading", { name: /Parts Agrícola API/ }),
  ).toBeVisible();
  await expect(page.getByText("GET", { exact: true }).first()).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath(`avl-169-api-docs-${testInfo.project.name}.png`),
    fullPage: true,
  });
});
