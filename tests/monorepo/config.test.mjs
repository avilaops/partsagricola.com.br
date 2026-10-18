import assert from "node:assert/strict";
import test from "node:test";

import { BRAND, parseServiceEnv } from "../../packages/config/src/index.ts";

test("expõe a marca oficial pela configuração compartilhada", () => {
  assert.equal(BRAND.name, "PARTSAGRICOLA");
});

test("falha rápido quando uma porta obrigatória não existe", () => {
  assert.throws(() => parseServiceEnv({ NODE_ENV: "test" }), /PORT/);
});

test("aceita uma porta válida", () => {
  assert.equal(parseServiceEnv({ NODE_ENV: "test", PORT: "4100" }).PORT, 4100);
});
