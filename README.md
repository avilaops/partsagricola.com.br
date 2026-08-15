# Marketplace Agricola

Pipeline de extração, tratamento e publicação de catálogos agrícolas e de
vedação no Medusa, com storefront Next.js em
<https://partsagricola.com.br>.

## Estado atual — 30/07/2026

- **25.239 itens tratados e importados**, sem `import_key` duplicada.
- **25.520 produtos publicados** no Medusa, contando os 281 produtos anteriores.
- **196 registros em quarentena**, preservados para revisão e fora da loja.
- Busca pública por código, nome ou aplicação em `/br/store`.
- Localizador técnico por medidas exatas de O-rings, retentores e gaxetas em
  `/br/medidas`.
- Lista de cotação persistente com ação rápida nos cards, múltiplas peças,
  quantidades e envio consolidado por WhatsApp ou e-mail.
- Histórico persistente de peças vistas recentemente, disponível na home e
  nas páginas de produto para facilitar a retomada da pesquisa.
- Comparação técnica persistente de até quatro peças, com atributos lado a
  lado e inclusão de todos os itens na mesma cotação.
- Peças salvas persistentes com acesso pelo cabeçalho, coração nos cards e
  transferência individual ou em lote para a cotação.
- Busca inteligente com autocomplete por produto, pesquisas recentes,
  navegação por teclado e acesso direto ao catálogo completo.
- Barra fixa de conversão nas páginas de produto em celulares, com acesso
  imediato à cotação e à comparação sem cobrir o conteúdo técnico.
- 26 sitemaps de produtos com **25.520 URLs** e **3.806 referências de imagem**.
- `robots.txt`, sitemap index, canonicals, JSON-LD de produto/breadcrumb e
  `llms.txt` publicados.

## O que tem nesta pasta

```
agricola/
├── README.md                  ← este arquivo
├── review.html                ← GALERIA DE REVISÃO (abra no navegador)
├── docker-compose.yml         ← sobe Postgres 16 + aplica schema/seed
├── data/
│   ├── processed/               ← base canônica, quarentena e auditoria
│   ├── catalog_scope.json       ← snapshot aprovado das fontes
│   ├── geomaq_parts.csv        ← todos os registros (revisão) + flag revisar
│   ├── geomaq_parts.json       ← mesmo conteúdo em JSON
│   └── parts_*.json            ← parciais por catálogo (intermediário)
├── images/<Linha>/             ← 1 recorte (foto+nome+código) por peça
│   └── <linha>_p<pág>_c<col>_<código>.png
├── sql/
│   ├── schema.sql              ← DDL limpo (marca/linha/família/produto/variante/atributo/imagem)
│   └── seed.sql                ← INSERTs data-only (rodar após schema.sql)
└── scripts/
    ├── process_catalogs.py      ← normaliza, deduplica, audita e põe em quarentena
    ├── extract_common.py       ← parser em grade (nome+código por célula)
    ├── extract_all.py          ← pipeline de extração (texto + OCR)
    ├── combine.py              ← consolida parciais → CSV/JSON + flag revisar
    ├── load.py                 ← carrega o CSV no Postgres (recomendado)
    ├── validate_db.py          ← validação end-to-end (Postgres embarcado)
    └── gen_review.py           ← gera review.html
```

## Como a extração funciona

- **Amendoim** é PDF de **texto** → `pdfplumber` lê palavras com coordenadas.
- **Algodão, Construção, Verde** são **páginas-imagem** (1 JPEG por página) →
  OCR com Tesseract (português). O código-fonte da foto polui o texto, então os
  nomes passam por uma limpeza que mantém só rótulos em CAIXA-ALTA e medidas.
- Layout comum: grade de 4 colunas, cada célula = **foto + NOME + CÓDIGO**.
  O parser agrupa por coluna, depois por linha, e associa o nome ao código abaixo.
- Cada peça recebe um **recorte da célula** (`images/...png`) que serve de
  “fonte da verdade” para conferência manual.

Campos capturados: `marca, linha, familia, codigo(SKU), nome, aplicacao, specs,
preco(vazio — catálogos não têm preço), pagina, arquivo, fonte(text|ocr),
ocr_conf, imagem, revisar, revisar_motivo`.

## Modelo de dados (Postgres)

`schema catalogo`:

- **brand** (marca) — Geomaq (segment=`agricola`). *first-class*
- **product_line** (linha) — Algodão/Amendoim/Construção/Verde
- **product_family** (família) — ROLAMENTO, ENGRENAGEM, POLIA… *first-class, transversal*
- **product** — item base (SKU/código) + proveniência e flags de revisão
- **product_variant** — variações por dimensão/material (**usado nos o-rings** da
  fase de vedação; peças agrícolas ficam sem variante)
- **product_attribute** — specs flexíveis chave/valor (liga a product **ou** variante)
- **product_image** — 1..N imagens por produto

View `v_product_full` devolve o produto “achatado” com marca/linha/família/imagem.
Marca e família separam agrícola de vedação — nada se mistura.

## Como subir e carregar

### Opção A — Docker (recomendado)

```bash
cd agricola
docker compose up -d          # sobe Postgres e aplica schema.sql + seed.sql
# conectar:
psql postgresql://catalogo:catalogo@localhost:5432/catalogo_db
```

> `docker-compose.yml` aplica `sql/schema.sql` e depois `sql/seed.sql`
> automaticamente na 1ª inicialização. O `seed.sql` já contém os 281 registros
> (pós-revisão; ver seção "Revisão" abaixo).

### Opção B — carregar via Python (idempotente, recria atributos/imagens)

```bash
pip install psycopg2-binary
# com o banco já no ar e o schema aplicado:
DATABASE_URL=postgresql://catalogo:catalogo@localhost:5432/catalogo_db \
  python3 scripts/load.py data/geomaq_parts.csv
```

`load.py` faz upsert por `(marca, linha, sku)`, então pode rodar de novo após
você corrigir o CSV na revisão.

### Sem Docker

Aplique `sql/schema.sql` no seu Postgres (tem `unaccent` e `pg_trgm` do contrib)
e rode `scripts/load.py`, ou aplique `sql/seed.sql`.

## Revisão (importante)

Uma primeira rodada de revisão manual (conferindo cada recorte de imagem) já
foi feita: de **294** registros extraídos, **12 foram removidos** (números de
telefone da contracapa dos catálogos, capturados por engano como se fossem
peças) e **83 nomes** foram corrigidos/completados a partir da imagem. Vários
**códigos** também tinham erro de OCR (ex.: `NN18289`→`N118289`,
`ID8804`→`JD8804`, `BE1368`→`8E1368`) e foram corrigidos.

Restam **12 registros** (de 281) ainda marcados `revisar: sim` — casos em que
o recorte da imagem cortou o rótulo ou o código antes do texto completo, sem
dado suficiente para confirmar com segurança. Abra **`review.html`** no
navegador (a partir desta pasta, para as imagens carregarem) e use o botão
“Mostrar só p/ revisar” para filtrá-los; cada card mostra a imagem da célula
ao lado do código/nome. Corrija direto no `data/geomaq_parts.csv` e recarregue
com `load.py`.

## Produção (servidor)

Schema + seed já aplicados no Postgres nativo do VPS Hetzner (mesmo servidor
que hospeda pkvedacoes, saudepet, cliente-avila etc., um database por app):

- Database: `agricola` · role: `agricola` (senha gerada, guardada só com o
  Nicolas — não está neste repo). Schema `catalogo` dentro do database.
- DNS: `partsagricola.com.br` (+ `www`) e `api.partsagricola.com.br` →
  `178.105.82.48` (registro A, DNS-only, sem proxy Cloudflare — mesmo padrão do
  `pkvedacoes.avilaops.com`, pra permitir o Caddy emitir certificado TLS
  próprio via Let's Encrypt). Os antigos `agricola.avilaops.com` /
  `api-agricola.avilaops.com` seguem apontando pro mesmo VPS e devem
  redirecionar 301 pro domínio novo (ver "Troca de domínio" abaixo).
- **Marca no banco continua `Geomaq`** (é o fabricante real das peças —
  trocar isso corromperia o dado). "Agricola" é o nome de exibição da loja.

### Marketplace (Medusa + storefront) — no ar

- **Loja**: <https://partsagricola.com.br> (storefront Next.js, `storefront/`
  neste repo — fork do `nextjs-starter-medusa` oficial, rebrandeado, com
  landing page própria).
- **Admin/API**: <https://api.partsagricola.com.br> (backend Medusa v2,
  `medusa/` neste repo). Login: e-mail/senha combinados com o Nicolas — não
  estão neste repo.
- Deploy: build de produção feito localmente (`medusa build` /
  `next build` com `output: standalone`) e transferido pro VPS — evita rodar
  `npm install` pesado no servidor compartilhado. Rodando como serviços
  systemd nativos (`agricola-medusa.service` na porta 9002,
  `agricola-storefront.service` na porta 3006), mesmo padrão do
  `pkvedacoes-medusa`/`pkvedacoes-site`.
- Redis: reaproveita o `redis-server` nativo do VPS, namespaced por
  `TENANT_SLUG=agricola` (mesmo padrão do pkvedacoes, não colide entre
  projetos no mesmo Redis).
- Imagens de produto: bucket Cloudflare R2 (`agricola-catalogo`), file
  provider S3-compatible do Medusa.
- Banco `agricola_medusa` (separado do `agricola` que guarda o catálogo bruto
  extraído): loja "Agricola", região Brasil/BRL, canal de venda e
  publishable key já seedados. O catálogo público tem **25.520 produtos**.
- Importação canônica: `data/processed/catalog_import.csv`, auditada por
  `data/processed/catalog_audit.json` e carregada de forma idempotente por
  `medusa/apps/backend/src/migration-scripts/import-catalogos.ts`.
- **SEO**: metadados canônicos, `robots.txt`, sitemap index segmentado,
  sitemaps de imagem, JSON-LD `Product`/`BreadcrumbList` e `llms.txt`.
- **Busca por medidas**: o endpoint Medusa `/store/technical-search` filtra
  metadados dimensionais exatos e alimenta o localizador público sem depender
  da busca textual por números.
- **Cotação multi-item**: produtos podem ser reunidos em uma lista persistente,
  ajustados por quantidade e enviados juntos para confirmação técnica.

### Troca de domínio (`avilaops.com` → `partsagricola.com.br`)

O repositório já aponta pro domínio novo (JSON-LD, e-mail de contato, CORS do
Medusa, `SITE_URL`). O que **não** dá pra fazer pelo repo e precisa ser feito no
servidor/DNS, nesta ordem:

1. Registrar `partsagricola.com.br` (Registro.br) e apontar os nameservers
   pro Cloudflare da Avila Ops.
2. Criar os registros A `partsagricola.com.br`, `www` e `api` →
   `178.105.82.48`, **DNS-only** (nuvem cinza), senão o Caddy não emite o
   certificado.
3. No `Caddyfile` do VPS: trocar os blocos `agricola.avilaops.com` /
   `api-agricola.avilaops.com` pelos novos hosts (mesmos upstreams `:3006` e
   `:9002`) e deixar os antigos só com `redir https://partsagricola.com.br{uri}
   permanent` — 301 preserva o SEO já indexado. Depois `caddy reload`.
4. Nos serviços systemd (ou no `.env` de produção do storefront):
   `NEXT_PUBLIC_BASE_URL=https://partsagricola.com.br` e
   `MEDUSA_BACKEND_URL=https://api.partsagricola.com.br`. É daí que saem
   `metadataBase`, `robots.txt` e todos os `sitemap.xml` — sem isso o domínio
   novo continua publicando URLs antigas.
5. Subir o `.env` novo do Medusa (CORS) e reiniciar `agricola-medusa.service`
   e `agricola-storefront.service`.
6. Criar a caixa `contato@partsagricola.com.br` (as páginas de cotação já
   apontam pra ela) e configurar MX/SPF/DKIM.
7. Google Search Console: adicionar a nova propriedade, usar a ferramenta de
   **Mudança de endereço** e reenviar o sitemap.

## Próximas fases (fora deste escopo)

1. Revisar os 196 registros em `data/processed/catalog_quarantine.csv`.
2. Gateway de pagamento Efí Pay (PIX/Boleto) — provider custom do Medusa,
   ainda não implementado.
3. Cadastrar preços comerciais, estoque e regras de frete.
4. Enviar o sitemap no Google Search Console e acompanhar cobertura/indexação.
