export type ModerationReason =
  | "EMAIL"
  | "PHONE"
  | "MESSENGER"
  | "SOCIAL"
  | "LINK"
  | "OFF_PLATFORM";

export type ModerationDecision = {
  decision: "ALLOW" | "MASK" | "BLOCK";
  safeText: string;
  reasons: ModerationReason[];
};

const wordDigits: Record<string, string> = {
  zero: "0",
  um: "1",
  uma: "1",
  dois: "2",
  duas: "2",
  tres: "3",
  quatro: "4",
  cinco: "5",
  seis: "6",
  sete: "7",
  oito: "8",
  nove: "9",
  dez: "10",
  onze: "11",
  doze: "12",
  treze: "13",
  quatorze: "14",
  quinze: "15",
  dezesseis: "16",
  dezassete: "17",
  dezessete: "17",
};

const emailPattern =
  /(?:[\p{L}\d._%+-]+\s*(?:@|\(?\s*arroba\s*\)?|\[\s*arroba\s*\]|\(at\))\s*[\p{L}\d.-]+(?:\s*(?:\.|\[\s*ponto\s*\]|\(dot\)|ponto)\s*[\p{L}]{2,})+)/giu;
const urlPattern =
  /(?:https?:\/\/|www\.|bit\.ly\/|tinyurl\.com\/|linktr\.ee\/|wa\.me\/|t\.me\/|goo\.gl\/|encurtador\.com\.br\/|facebook\.com\/|linkedin\.com\/)[^\s]+/giu;
const messengerPattern = /\b(?:whats(?:app)?|wpp|zap|telegram|signal)\b/giu;
const socialPattern =
  /(?:\b(?:insta(?:gram)?|facebook|face|linkedin|direct|dm)\b(?:\s*[:@]?\s*[\w.]+)?|@[\p{L}\d._]{3,})/giu;
const offPlatformPattern =
  /\b(?:chama\s+fora|conversar\s+por\s+fora|fora\s+da\s+plataforma|contato\s+na\s+embalagem|me\s+liga|meu\s+arroba)\b/giu;
const phoneContextPattern =
  /\b(?:telefone|fone|numero|contato|liga|whats(?:app)?|wpp|zap)\b/iu;

export function moderateText(text: string): ModerationDecision {
  const normalized = normalizeForDetection(text);
  const reasons = new Set<ModerationReason>();
  if (emailPattern.test(normalized)) reasons.add("EMAIL");
  emailPattern.lastIndex = 0;
  if (hasPhone(normalized)) reasons.add("PHONE");
  if (messengerPattern.test(normalized)) reasons.add("MESSENGER");
  messengerPattern.lastIndex = 0;
  const withoutEmails = normalized.replace(emailPattern, " ");
  emailPattern.lastIndex = 0;
  if (socialPattern.test(withoutEmails)) reasons.add("SOCIAL");
  socialPattern.lastIndex = 0;
  if (urlPattern.test(normalized) || hasSpelledDomain(normalized))
    reasons.add("LINK");
  urlPattern.lastIndex = 0;
  if (offPlatformPattern.test(normalized)) reasons.add("OFF_PLATFORM");
  offPlatformPattern.lastIndex = 0;

  const ordered = (
    ["EMAIL", "PHONE", "MESSENGER", "SOCIAL", "LINK", "OFF_PLATFORM"] as const
  ).filter((reason) => reasons.has(reason));
  if (!ordered.length)
    return { decision: "ALLOW", safeText: text, reasons: [] };

  const hardBlock = ordered.some((reason) =>
    ["EMAIL", "PHONE", "LINK", "OFF_PLATFORM"].includes(reason),
  );
  return {
    decision: hardBlock ? "BLOCK" : "MASK",
    safeText: redact(text, normalized, ordered),
    reasons: ordered,
  };
}

function normalizeForDetection(value: string): string {
  const emojiDigits: Record<string, string> = {
    "0️⃣": "0",
    "1️⃣": "1",
    "2️⃣": "2",
    "3️⃣": "3",
    "4️⃣": "4",
    "5️⃣": "5",
    "6️⃣": "6",
    "7️⃣": "7",
    "8️⃣": "8",
    "9️⃣": "9",
  };
  let normalized = value.toLowerCase();
  for (const [emoji, digit] of Object.entries(emojiDigits))
    normalized = normalized.replaceAll(emoji, digit);
  return normalized
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasPhone(value: string): boolean {
  const runs = value.match(/(?:\d[\s().-]*){8,13}/g) ?? [];
  if (
    runs.some((run) => {
      const count = run.replace(/\D/g, "").length;
      return count >= 10 || (count >= 8 && phoneContextPattern.test(value));
    })
  )
    return true;
  const tokens = value.split(/[^\p{L}\d]+/u).filter(Boolean);
  let consecutive = 0;
  let totalDigits = 0;
  for (const token of tokens) {
    const digit = wordDigits[token];
    if (digit) {
      consecutive += 1;
      totalDigits += digit.length;
      if (consecutive >= 5 && totalDigits >= 8) return true;
    } else if (/^\d{1,4}$/.test(token)) {
      consecutive += 1;
      totalDigits += token.length;
      if (
        consecutive >= 3 &&
        totalDigits >= 8 &&
        phoneContextPattern.test(value)
      )
        return true;
    } else {
      consecutive = 0;
      totalDigits = 0;
    }
  }
  return false;
}

function hasSpelledDomain(value: string): boolean {
  return /\b[\p{L}\d-]+\s+ponto\s+(?:com|net|org)(?:\s+ponto\s+br)?\b/iu.test(
    value,
  );
}

function redact(
  original: string,
  normalized: string,
  reasons: readonly ModerationReason[],
): string {
  let safe = original;
  safe = safe.replace(emailPattern, "[e-mail removido]");
  safe = safe.replace(urlPattern, "[link removido]");
  safe = safe.replace(/(?:\d[\s().-]*){8,13}/g, "[telefone removido]");
  safe = safe.replace(messengerPattern, "[canal externo removido]");
  safe = safe.replace(socialPattern, "[rede social removida]");
  if (reasons.includes("PHONE") && safe === original && normalized !== original)
    return "[telefone removido]";
  if (reasons.includes("OFF_PLATFORM") || hasSpelledDomain(normalized))
    return "[conteúdo externo removido]";
  return safe === original ? "[conteúdo moderado]" : safe;
}
