import assert from "node:assert/strict";
import test from "node:test";
import { createHealthServer } from "./health.ts";
test("Worker cria health server", () => {
  const server = createHealthServer();
  assert.equal(server.listening, false);
  server.close();
});
