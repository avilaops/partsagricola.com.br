import assert from "node:assert/strict";
import test from "node:test";

import { createHealthPayload } from "../../packages/shared/src/index.ts";

test("health payload identifica serviço e estado", () => {
  assert.deepEqual(createHealthPayload("api"), { ok: true, service: "api" });
});

test("rejeita nome de serviço vazio", () => {
  assert.throws(() => createHealthPayload(""), /service/);
});
