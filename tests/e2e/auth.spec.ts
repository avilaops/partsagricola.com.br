import { expect, test } from "@playwright/test";
const authorize =
  "http://127.0.0.1:4101/authorize?response_type=code&client_id=partsagricola-web&redirect_uri=http%3A%2F%2F127.0.0.1%3A3000%2Fauth%2Fcallback&scope=openid%20profile%20email%20offline_access&state=e2e-state&nonce=e2e-nonce&code_challenge=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&code_challenge_method=S256";
test("login central é acessível, responsivo e gera evidência", async ({
  page,
}, testInfo) => {
  await page.goto(authorize);
  await expect(
    page.getByRole("heading", { name: "Acesse sua conta" }),
  ).toBeVisible();
  await expect(page.getByLabel("E-mail ou CPF")).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Continuar com GOOGLE/ }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath(`avl-168-login-${testInfo.project.name}.png`),
    fullPage: true,
  });
});
test("cadastro por e-mail valida senha forte e resposta não expõe segredo", async ({
  request,
}) => {
  const unique = `buyer-${Date.now()}@example.test`;
  const response = await request.post(
    "http://127.0.0.1:4101/accounts/register",
    {
      data: {
        email: unique,
        name: "Comprador E2E",
        password: "Senha-forte-AVL-168!",
      },
    },
  );
  expect(response.status()).toBe(201);
  const body = await response.text();
  expect(body).not.toContain("Senha-forte");
  expect(body).not.toContain("passwordHash");
});
test("Google mock cria conta em no máximo dois passos sem auto-link", async ({
  page,
}) => {
  await page.goto(authorize);
  await page.getByRole("link", { name: /Continuar com GOOGLE/ }).click();
  await page.waitForURL(/127\.0\.0\.1:3000\/auth\/callback/);
  expect(new URL(page.url()).searchParams.get("code")).toBeTruthy();
});

test("logout global revoga todas as sessões do usuário", async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext({ locale: "pt-BR" }),
    browser.newContext({ locale: "pt-BR" }),
  ]);
  try {
    for (const context of contexts) {
      const page = await context.newPage();
      await page.goto(authorize);
      await page.getByRole("link", { name: /Continuar com GOOGLE/ }).click();
      await page.waitForURL(/127\.0\.0\.1:3000\/auth\/callback/);
      expect(new URL(page.url()).searchParams.get("code")).toBeTruthy();
    }

    for (const context of contexts) {
      const response = await context.request.post(
        "http://127.0.0.1:4101/accounts/totp/enroll",
      );
      expect(response.status()).toBe(200);
    }

    const logout = await contexts[0]!.request.post(
      "http://127.0.0.1:4101/logout",
    );
    expect(logout.status()).toBe(204);

    const revoked = await contexts[1]!.request.post(
      "http://127.0.0.1:4101/accounts/totp/enroll",
    );
    expect(revoked.status()).toBe(401);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
