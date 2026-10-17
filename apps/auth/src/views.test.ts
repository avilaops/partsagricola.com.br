import assert from "node:assert/strict";
import test from "node:test";
import { resolveLocale } from "./locales.ts";
import { loginView } from "./views.ts";

test("login é semântico, responsivo, multilíngue e escapa dados dinâmicos", () => {
  const html = loginView({
    locale: "es-MX",
    transaction: `"><script>alert(1)</script>`,
    connectors: ["GOOGLE"],
    error: "Inválido <x>",
  });
  assert.match(html, /<main/);
  assert.match(html, /<label for="identifier">Correo o CPF<\/label>/);
  assert.match(html, /@media\(max-width:720px\)/);
  assert.match(html, /prefers-reduced-motion/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /role="alert"/);
  assert.match(html, /Continuar con GOOGLE/);
  assert.equal(resolveLocale("fr"), "pt-BR");
});
