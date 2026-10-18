import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const catalogUrl = "http://127.0.0.1:3002/administracao/catalogo?evidence=1";

test.beforeAll(async () =>
  mkdir("docs/evidencias/avl-171", { recursive: true }),
);

test("administra referências, busca e importa CSV com feedback", async ({
  page,
}, testInfo) => {
  await page.goto(catalogUrl);
  await expect(
    page.getByRole("heading", { name: "Catálogo de referências" }),
  ).toBeVisible();
  await expect(page.getByText("Bomba hidráulica MF 290")).toBeVisible();

  await page
    .getByRole("searchbox", { name: "Buscar no catálogo" })
    .fill("filtro");
  await expect(page.getByText("Filtro de combustível 26560143")).toBeVisible();
  await expect(page.getByText("Bomba hidráulica MF 290")).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Buscar no catálogo" }).fill("");

  await page.getByRole("button", { name: "Nova peça" }).click();
  const dialog = page.getByRole("dialog", { name: "Cadastrar peça" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Nome da peça").fill("Retentor do eixo");
  await dialog.getByLabel("Identificador amigável").fill("retentor-do-eixo");
  await dialog.getByRole("button", { name: "Salvar peça" }).click();
  await expect(page.getByText("Retentor do eixo")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Peça cadastrada");

  const row = page.getByRole("row", { name: /Retentor do eixo/ });
  await row.getByRole("button", { name: "Editar Retentor do eixo" }).click();
  await page
    .getByRole("dialog", { name: "Editar peça" })
    .getByLabel("Nome da peça")
    .fill("Retentor do eixo traseiro");
  await page
    .getByRole("dialog", { name: "Editar peça" })
    .getByRole("button", { name: "Salvar alterações" })
    .click();
  await expect(page.getByText("Retentor do eixo traseiro")).toBeVisible();
  await page
    .getByRole("button", { name: "Desativar Retentor do eixo traseiro" })
    .click();
  await expect(
    page
      .getByRole("row", { name: /Retentor do eixo traseiro/ })
      .getByText("Inativa", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Importar CSV" }).click();
  const importDialog = page.getByRole("dialog", {
    name: "Importar catálogo por CSV",
  });
  await importDialog.getByLabel("Arquivo CSV").setInputFiles({
    name: "invalido.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("coluna\nvalor"),
  });
  await importDialog
    .getByRole("button", { name: "Validar e importar" })
    .click();
  await expect(importDialog.getByRole("alert")).toContainText(
    "Cabeçalho inválido",
  );
  await importDialog.getByLabel("Arquivo CSV").setInputFiles({
    name: "catalogo.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "schema_version,source,external_id,part_name,part_code,code_type,brand,category,description,machine_type,machine_brand,machine_model,year_start,year_end\n1,e2e,PA-1,Peça,PA-1,ORIGINAL,,,,,,,,",
    ),
  });
  await importDialog
    .getByRole("button", { name: "Validar e importar" })
    .click();
  await expect(page.getByRole("status")).toContainText("1 linha importada");

  await page.screenshot({
    path: `docs/evidencias/avl-171/catalog-admin-${testInfo.project.name.includes("mobile") ? "mobile" : "desktop"}.png`,
    fullPage: true,
  });
});

test("navega por teclado e não extrapola 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(catalogUrl);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Ir para o conteúdo" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});
