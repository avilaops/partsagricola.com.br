import { resolveLocale, translate } from "./locales.js";

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ]!,
  );

export function loginView(
  input: {
    locale?: string | undefined;
    transaction?: string | undefined;
    connectors?: string[] | undefined;
    error?: string | undefined;
  } = {},
): string {
  const locale = resolveLocale(input.locale);
  const copy = translate(locale);
  const transaction = escapeHtml(input.transaction ?? "");
  const connectors = (input.connectors ?? [])
    .map((provider) => {
      const safe = escapeHtml(provider);
      return `<a class="social" href="/social/${safe.toLowerCase()}?transaction=${transaction}" aria-label="${copy.social} ${safe}">${copy.social} ${safe}</a>`;
    })
    .join("");
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${copy.title} | PARTSAGRICOLA</title><style>
:root{color-scheme:light dark;--brand:#217346;--brand2:#164e33;--paper:#fff;--ink:#15231b;--muted:#66736b;--line:#d8e1dc}*{box-sizing:border-box}body{margin:0;min-height:100dvh;font:16px system-ui;background:linear-gradient(145deg,#e9f4ec,#f8faf8 45%,#dae9df);color:var(--ink);display:grid;place-items:center;padding:24px}.shell{width:min(100%,1040px);min-height:620px;background:var(--paper);border:1px solid var(--line);border-radius:28px;box-shadow:0 24px 70px #173d2926;display:grid;grid-template-columns:1.05fr 1fr;overflow:hidden}.brand{padding:64px;background:linear-gradient(150deg,var(--brand2),var(--brand));color:#fff;display:flex;flex-direction:column;justify-content:space-between}.mark{font-weight:850;letter-spacing:.08em}.brand h2{font-size:clamp(2rem,4vw,3.5rem);line-height:1.04;margin:0}.panel{padding:64px;display:flex;flex-direction:column;justify-content:center}h1{font-size:2rem;margin:0 0 8px}.sub{color:var(--muted);margin:0 0 32px}label{display:block;font-weight:650;margin:16px 0 7px}input{width:100%;min-height:48px;border:1px solid var(--line);border-radius:12px;padding:12px;font:inherit}.primary,.social{min-height:48px;border-radius:12px;display:grid;place-items:center;text-decoration:none;font-weight:700}.primary{width:100%;border:0;margin-top:22px;background:var(--brand);color:#fff;font:inherit}.social{border:1px solid var(--line);color:inherit;margin-top:10px}.links{display:flex;justify-content:space-between;margin-top:18px;font-size:.9rem}.links a{color:var(--brand)}.error{padding:12px;border-radius:10px;background:#fee2e2;color:#991b1b}a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid #e3a008;outline-offset:2px}@media(max-width:720px){body{padding:0;background:var(--paper)}.shell{border:0;border-radius:0;display:block;min-height:100dvh}.brand{padding:24px;min-height:150px}.brand h2{font-size:1.7rem}.panel{padding:28px 24px}.links{gap:16px;flex-wrap:wrap}}@media(prefers-color-scheme:dark){:root{--paper:#101713;--ink:#f1f7f3;--muted:#a9b5ad;--line:#33443a}body{background:#0b110d}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
</style></head><body><main class="shell"><section class="brand" aria-label="PARTSAGRICOLA"><div class="mark">PARTSAGRICOLA</div><h2>O mercado das empresas do agro.</h2><small>Compra e venda entre empresas e produtores.</small></section><section class="panel"><h1>${copy.title}</h1><p class="sub">${copy.subtitle}</p>${input.error ? `<p class="error" role="alert">${escapeHtml(input.error)}</p>` : ""}<form method="post" action="/login"><input type="hidden" name="transaction" value="${transaction}"><label for="identifier">${copy.email}</label><input id="identifier" name="identifier" autocomplete="username" required><label for="password">${copy.password}</label><input id="password" name="password" type="password" autocomplete="current-password" required><label for="totp">Código de segurança (quando solicitado)</label><input id="totp" name="totp" inputmode="numeric" autocomplete="one-time-code"><button class="primary" type="submit">${copy.login}</button></form>${connectors}<nav class="links" aria-label="Conta"><a href="/register">${copy.signup}</a><a href="/forgot-password">${copy.forgot}</a></nav></section></main></body></html>`;
}
