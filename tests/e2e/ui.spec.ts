import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const adminUrl = "http://127.0.0.1:3002/ui";

test.beforeAll(async () =>
  mkdir("docs/evidencias/avl-170", { recursive: true }),
);

test("galeria apresenta todos os componentes e interações", async ({
  page,
}, testInfo) => {
  await page.goto(adminUrl);
  await expect(
    page.getByRole("heading", { name: "Design system Parts Agrícola" }),
  ).toBeVisible();
  await expect(page.getByText("Verde marca · #0B6B3F")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publicar anúncio" }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Marca" }).fill("John");
  await page.getByRole("combobox", { name: "Marca" }).press("Enter");
  await expect(page.getByRole("combobox", { name: "Marca" })).toHaveValue(
    "John Deere",
  );
  await page.getByLabel("Fotos do anúncio").setInputFiles({
    name: "arquivo.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("invalido"),
  });
  await expect(page.getByText("Use apenas JPG, PNG ou WebP.")).toBeVisible();
  await page.getByLabel("Fotos do anúncio").setInputFiles({
    name: "maquina.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(
    page.getByRole("img", { name: "Prévia de maquina.png" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remover maquina.png" }).click();
  await expect(
    page.getByRole("img", { name: "Prévia de maquina.png" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Revisar publicação" }).click();
  await expect(
    page.getByRole("dialog", { name: "Publicar anúncio?" }),
  ).toBeVisible();
  await page.getByRole("dialog", { name: "Publicar anúncio?" }).press("Escape");
  await expect(
    page.getByRole("button", { name: "Revisar publicação" }),
  ).toBeFocused();
  await page.getByRole("tab", { name: "Ativos" }).focus();
  await page.getByRole("tab", { name: "Ativos" }).press("ArrowRight");
  await expect(page.getByRole("tabpanel")).toContainText("2 anúncios pausados");
  await expect(page.getByLabel("Empresa verificada")).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Últimos anúncios" }),
  ).toBeVisible();
  await page.getByRole("heading", { name: "Navegação e dados" }).click();
  const name = testInfo.project.name.includes("mobile")
    ? "ui-mobile.png"
    : "ui-desktop.png";
  const mobile = testInfo.project.name.includes("mobile");
  if (mobile) await page.setViewportSize({ width: 390, height: 2000 });
  await page.screenshot({
    path: `docs/evidencias/avl-170/${name}`,
    fullPage: !mobile,
  });
});

test("galeria não extrapola a viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto(adminUrl);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
