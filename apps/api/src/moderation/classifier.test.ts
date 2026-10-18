import assert from "node:assert/strict";
import test from "node:test";
import { moderateText } from "./classifier.ts";
import { disguisedContactCases, safeTextCases } from "./contact-cases.ts";

test("bloqueia ou mascara ao menos 95% de 50 tentativas disfarçadas", () => {
  assert.ok(disguisedContactCases.length >= 50);
  const detected = disguisedContactCases.filter(
    (value) => moderateText(value).decision !== "ALLOW",
  );
  assert.ok(
    detected.length / disguisedContactCases.length >= 0.95,
    `detectou ${detected.length}/${disguisedContactCases.length}`,
  );
});

test("não mascara códigos técnicos e linguagem interna legítima", () => {
  for (const value of safeTextCases) {
    assert.equal(moderateText(value).decision, "ALLOW", value);
  }
});

test("retorna somente corpo seguro e motivos estáveis", () => {
  const result = moderateText("WhatsApp (11) 99999-8877 ou eu@loja.com");
  assert.equal(result.decision, "BLOCK");
  assert.doesNotMatch(result.safeText, /99999|eu@loja/i);
  assert.deepEqual(result.reasons, ["EMAIL", "PHONE", "MESSENGER"]);
});
