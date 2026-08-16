// Anuncia URLs ao IndexNow (Bing, Yandex, Seznam, Naver, Yep).
//
//   node scripts/submit-indexnow.mjs                      # sitemap inteiro
//   node scripts/submit-indexnow.mjs --so-estaticas       # so as 54 paginas fixas
//   node scripts/submit-indexnow.mjs https://partsagricola.com.br/br/medidas
//
// Passe a URL inteira, nao so o caminho: o Git Bash no Windows reescreve
// argumento que comeca com "/" pra um caminho do sistema, e "/br/medidas"
// chega aqui como "C:/Program Files/Git/br/medidas".
//
// Um POST so resolve todos os buscadores — api.indexnow.org repassa aos
// participantes. Postar em cada endpoint entregaria a mesma coisa duplicada.
//
// Le o sitemap PUBLICADO, nao o build local: o que importa e o que o buscador
// consegue rastrear agora. Se o deploy ainda nao subiu, o script anuncia URLs
// que respondem 404 e queima cota atoa.
//
// Reenviar as 25 mil URLs a cada ajuste faz o site parecer que muda inteiro o
// tempo todo, e o sinal de "isto mudou agora" vira ruido. Lote completo e pra
// mudanca estrutural (troca de dominio, reimportacao do catalogo); pagina nova
// quer notificacao especifica.

const CHAVE = "partsagricola-indexnow-20260815";
const SITE_URL = (process.env.SITE_URL || "https://partsagricola.com.br").replace(/\/$/, "");
const ENDPOINT = "https://api.indexnow.org/indexnow";

// Limite do protocolo. Acima disso o IndexNow recusa o lote inteiro.
const MAX_POR_LOTE = 10_000;
const PAUSA_ENTRE_LOTES_MS = 2_000;
const TIMEOUT_MS = 30_000;

const args = process.argv.slice(2);
const soEstaticas = args.includes("--so-estaticas");
const urlsPedidas = args.filter((a) => !a.startsWith("--"));

async function buscarTexto(url) {
  const resposta = await fetch(url, {
    headers: { "User-Agent": `PartsAgricolaIndexNow/1.0 (+${SITE_URL})` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!resposta.ok) throw new Error(`${url} respondeu HTTP ${resposta.status}`);
  return resposta.text();
}

function extrairLocs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) => m[1].trim());
}

/** O sitemap raiz e um index: cada <loc> aponta pra outro sitemap. */
async function coletarUrlsDoSitemap() {
  const raiz = await buscarTexto(`${SITE_URL}/sitemap.xml`);
  const filhos = extrairLocs(raiz);

  if (!/<sitemapindex[\s>]/i.test(raiz)) return [...new Set(filhos)];

  const alvos = soEstaticas ? filhos.filter((f) => f.includes("/static.xml")) : filhos;
  const urls = [];

  for (const filho of alvos) {
    // Sitemap de outro host nao e nosso pra anunciar.
    if (new URL(filho).host !== new URL(SITE_URL).host) continue;
    try {
      urls.push(...extrairLocs(await buscarTexto(filho)));
    } catch (erro) {
      // Um filho fora do ar nao pode derrubar o lote inteiro — o resto ainda vale.
      console.warn(`  aviso: ${erro.message}`);
    }
  }

  return [...new Set(urls)];
}

/**
 * O IndexNow so aceita quem prova posse do dominio servindo a chave em
 * /{chave}.txt. Conferir antes evita descobrir que o deploy nao subiu o
 * arquivo depois de mandar 25 mil URLs pro vazio.
 */
async function conferirChave() {
  const local = `${SITE_URL}/${CHAVE}.txt`;
  const conteudo = (await buscarTexto(local)).trim();
  if (conteudo !== CHAVE) {
    throw new Error(`${local} devolveu ${JSON.stringify(conteudo.slice(0, 60))}, esperado ${CHAVE}`);
  }
  return local;
}

async function enviarLote(urlList, keyLocation) {
  const resposta = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: new URL(SITE_URL).host,
      key: CHAVE,
      keyLocation,
      urlList,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  // 200 = aceito, 202 = aceito e a chave ainda esta sendo validada.
  if ([200, 202].includes(resposta.status)) return resposta.status;

  const corpo = (await resposta.text()).slice(0, 500);

  // Chave recem-publicada: o Bing ainda nao buscou o /{chave}.txt. Nao e erro
  // de configuracao, e so cedo demais — some sozinho em minutos ou horas.
  if (resposta.status === 403 && corpo.includes("SiteVerificationNotCompleted")) {
    throw new Error(
      `A chave ainda esta em validacao no Bing (403 SiteVerificationNotCompleted).\n` +
        `Nao ha nada a corrigir: ${keyLocation} responde 200 com o conteudo certo.\n` +
        `Rode "npm run submit:indexnow" de novo daqui a algumas horas.`
    );
  }

  throw new Error(`IndexNow respondeu ${resposta.status}: ${corpo}`);
}

const keyLocation = await conferirChave();
console.log(`chave OK em ${keyLocation}`);

const doSitemap = await coletarUrlsDoSitemap();
if (!doSitemap.length) throw new Error("Nenhuma URL encontrada no sitemap publicado.");

let lista = doSitemap;
if (urlsPedidas.length) {
  const conhecidas = new Set(doSitemap);
  lista = urlsPedidas.map((entrada) => new URL(entrada, `${SITE_URL}/`).href);

  // URL fora do sitemap e quase sempre erro de digitacao. Enviar assim mesmo
  // gastaria cota com uma URL que responde 404.
  const desconhecidas = lista.filter((u) => !conhecidas.has(u));
  if (desconhecidas.length) {
    throw new Error(
      `URL fora do sitemap publicado: ${desconhecidas.join(", ")}. Confira o caminho ou rode o deploy antes.`
    );
  }
}

const escopo = urlsPedidas.length
  ? "URLs selecionadas"
  : soEstaticas
    ? "paginas estaticas"
    : "sitemap completo";

console.log(`${lista.length} URLs a anunciar (${escopo})`);

for (let i = 0; i < lista.length; i += MAX_POR_LOTE) {
  const lote = lista.slice(i, i + MAX_POR_LOTE);
  const n = Math.floor(i / MAX_POR_LOTE) + 1;
  const total = Math.ceil(lista.length / MAX_POR_LOTE);
  const status = await enviarLote(lote, keyLocation);
  console.log(`  lote ${n}/${total}: ${lote.length} URLs, HTTP ${status}`);
  if (i + MAX_POR_LOTE < lista.length) {
    await new Promise((r) => setTimeout(r, PAUSA_ENTRE_LOTES_MS));
  }
}

console.log(`✔ IndexNow aceitou ${lista.length} URLs (${escopo}).`);
