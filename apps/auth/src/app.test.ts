import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "./app.ts";
test("Auth responde health", async () => {
  const app = createApp();
  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true, service: "auth" });
  await app.close();
});
