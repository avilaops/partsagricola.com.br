import { expect, test } from "@playwright/test"

test("apresenta a Parts Agrícola como marketplace de empresas", async ({
  page,
}, testInfo) => {
  await page.goto("/br")

  await expect(
    page.getByRole("heading", { name: "O mercado das empresas do agro." })
  ).toBeVisible()
  await expect(page.getByText("Sem estoque próprio.")).toBeVisible()
  await expect(
    page
      .locator("section")
      .first()
      .getByRole("link", { name: "Anunciar como empresa", exact: true })
  ).toBeVisible()

  await expect(page.getByText("Ver catálogo completo")).toHaveCount(0)
  await expect(page.getByRole("button", { name: /buscar/i })).toHaveCount(0)
  await expect(page.getByText("Cotar peça")).toHaveCount(0)

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth
  )
  expect(hasHorizontalOverflow).toBe(false)

  await page.screenshot({
    path: testInfo.outputPath(
      `partsagricola-marketplace-${testInfo.project.name}.png`
    ),
    fullPage: true,
  })
})

test("retira as rotas e APIs do catálogo próprio", async ({ request }) => {
  for (const path of [
    "/br/store",
    "/br/products/peca-antiga",
    "/br/categories/rolamentos",
  ]) {
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status(), path).toBe(308)
    expect(response.headers().location, path).toBe("/br")
  }

  const search = await request.get("/api/search/suggestions?q=rolamento")
  expect(search.status()).toBe(410)
})
