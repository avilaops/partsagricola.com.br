export type PriceValue = {
  amountMinor: number | null;
  currency?: string;
  locale?: string;
};

export function formatPrice({
  amountMinor,
  currency = "BRL",
  locale = "pt-BR",
}: PriceValue): string {
  if (amountMinor === null || !Number.isFinite(amountMinor)) {
    return "Sob consulta";
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

export function normalizeRating(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(5, Math.max(0, Math.round(value * 2) / 2));
}
