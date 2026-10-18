import assert from "node:assert/strict";
import test from "node:test";

import { formatPrice, normalizeRating } from "./format.ts";

test("formata centavos na moeda e locale informados", () => {
  assert.equal(
    formatPrice({ amountMinor: 123_450, currency: "BRL", locale: "pt-BR" }),
    "R$ 1.234,50",
  );
});

test("apresenta valor indisponível sem inventar preço", () => {
  assert.equal(
    formatPrice({ amountMinor: null, currency: "BRL", locale: "pt-BR" }),
    "Sob consulta",
  );
  assert.equal(
    formatPrice({ amountMinor: Number.NaN, currency: "BRL", locale: "pt-BR" }),
    "Sob consulta",
  );
});

test("limita rating entre zero e cinco e arredonda para meio ponto", () => {
  assert.equal(normalizeRating(-2), 0);
  assert.equal(normalizeRating(4.26), 4.5);
  assert.equal(normalizeRating(8), 5);
  assert.equal(normalizeRating(Number.NaN), 0);
});
