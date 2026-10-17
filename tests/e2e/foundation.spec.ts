import { expect, test } from "@playwright/test";

const surfaces = [
  {
    url: "http://127.0.0.1:3000",
    title: /Marketplace/,
    heading: "Marketplace",
  },
  {
    url: "http://127.0.0.1:3001",
    title: /Fornecedor/,
    heading: "Área do fornecedor",
  },
  {
    url: "http://127.0.0.1:3002",
    title: /Administração/,
    heading: "Administração",
  },
] as const;

for (const surface of surfaces) {
  test(`${surface.heading} renderiza sem regressões básicas`, async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto(surface.url);

    await expect(page).toHaveTitle(surface.title);
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      surface.heading,
    );
    await expect(
      page.getByText("PARTSAGRICOLA", { exact: true }),
    ).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
    expect(consoleErrors).toEqual([]);
  });
}

test("skip link leva o teclado ao conteúdo principal", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");

  const skipLink = page.getByRole("link", { name: "Ir para o conteúdo" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
});
