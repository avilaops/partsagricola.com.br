import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const conversationUrl =
  "http://127.0.0.1:3000/conversas/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?evidence=1";
const moderationUrl =
  "http://127.0.0.1:3002/administracao/moderacao?evidence=1";

test.beforeAll(async () =>
  mkdir("docs/evidencias/avl-175", { recursive: true }),
);

test("conversa mascara contato e mantém fluxo responsivo", async ({
  page,
}, testInfo) => {
  await page.goto(conversationUrl);
  await expect(page.getByText("Agro Forte Peças").first()).toBeVisible();
  await expect(page.getByText("Tempo real")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Mensagem" })
    .fill("me chama no WhatsApp 11 99999-8877");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("[conteúdo externo removido]")).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Contato externo removido",
  );
  await page.screenshot({
    path: `docs/evidencias/avl-175/chat-${testInfo.project.name.includes("mobile") ? "mobile" : "desktop"}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

test("admin revisa fila sem visualizar contato original", async ({
  page,
}, testInfo) => {
  await page.goto(moderationUrl);
  await expect(
    page.getByRole("heading", { name: "Central de moderação" }),
  ).toBeVisible();
  await expect(page.getByText("Agro Forte Peças")).toBeVisible();
  await expect(page.getByText(/99999|8877/)).toHaveCount(0);
  await page
    .getByRole("button", { name: "Confirmar ocorrência" })
    .first()
    .click();
  await expect(page.getByRole("status")).toContainText("Evidência local");
  await page.screenshot({
    path: `docs/evidencias/avl-175/moderation-admin-${testInfo.project.name.includes("mobile") ? "mobile" : "desktop"}.png`,
    fullPage: true,
  });
  if (testInfo.project.name.includes("mobile")) {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.reload();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      ),
    ).toBe(false);
  }
});
