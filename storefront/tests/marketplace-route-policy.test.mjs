import assert from "node:assert/strict"
import test from "node:test"

import { resolveMarketplacePath } from "../src/lib/marketplace-route-policy.ts"

test("mantém somente as páginas institucionais do marketplace", () => {
  assert.deepEqual(resolveMarketplacePath("/br"), { action: "allow" })
  assert.deepEqual(resolveMarketplacePath("/br/contato"), { action: "allow" })
})

test("desliga rotas do catálogo legado e preserva o país", () => {
  for (const path of [
    "/br/store",
    "/br/products/skf-ge-50",
    "/br/categories/rolamentos",
    "/br/aplicacoes/john-deere",
    "/br/medidas",
    "/br/confirmacao-tecnica",
  ]) {
    assert.deepEqual(resolveMarketplacePath(path), {
      action: "redirect",
      destination: "/br",
    })
  }
})

test("desliga APIs públicas ligadas ao catálogo e à cotação de peças", () => {
  for (const path of ["/api/search/suggestions", "/api/cotacao"]) {
    assert.deepEqual(resolveMarketplacePath(path), { action: "gone" })
  }
})

test("não captura assets nem rotas técnicas do Next", () => {
  for (const path of [
    "/_next/static/app.js",
    "/images/marca/logo-partsagricola.png",
    "/robots.txt",
    "/sitemap.xml",
  ]) {
    assert.deepEqual(resolveMarketplacePath(path), { action: "allow" })
  }
})
