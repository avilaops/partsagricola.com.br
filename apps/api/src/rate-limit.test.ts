import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "./errors.ts";
import { createPrincipalRateLimiter } from "./rate-limit.ts";

test("limita cada principal separadamente e reinicia após a janela", () => {
  const limiter = createPrincipalRateLimiter({ max: 1, windowMs: 1_000 });
  limiter.consume("user-a", 1_000);
  limiter.consume("user-b", 1_000);
  assert.throws(
    () => limiter.consume("user-a", 1_500),
    (error: unknown) =>
      error instanceof ApiError &&
      error.statusCode === 429 &&
      error.code === "RATE_LIMITED",
  );
  assert.doesNotThrow(() => limiter.consume("user-a", 2_000));
});
