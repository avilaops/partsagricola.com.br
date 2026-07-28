# Banco de Peças — Grupo Geomaq (Fase 1)

Extração estruturada + imagens dos 4 catálogos Geomaq 2025 (Algodão, Amendoim,
Construção, Verde) e modelagem/carga em Postgres. Medusa e o site
(agrícola.avilaops.com) são fases posteriores — **não** incluídos aqui.

## O que tem nesta pasta

```
agricola/
├── README.md                  ← este arquivo
├── review.html                ← GALERIA DE REVISÃO (abra no navegador)
├── docker-compose.yml         ← sobe Postgres 16 + aplica schema/seed
├── data/
│   ├── geomaq_parts.csv        ← todos os registros (revisão) + flag revisar
│   ├── geomaq_parts.json       ← mesmo conteúdo em JSON
│   └── parts_*.json            ← parciais por catálogo (intermediário)
├── images/<Linha>/             ← 1 recorte (foto+nome+código) por peça
│   └── <linha>_p<pág>_c<col>_<código>.png
├── sql/
│   ├── schema.sql              ← DDL limpo (marca/linha/família/produto/variante/atributo/imagem)
│   └── seed.sql                ← INSERTs data-only (rodar após schema.sql)
└── scripts/
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
- DNS: `agricola.avilaops.com` → `178.105.82.48` (registro A, DNS-only, sem
  proxy Cloudflare — mesmo padrão do `pkvedacoes.avilaops.com`, pra permitir
  o Caddy emitir certificado TLS próprio via Let's Encrypt).
- Caddy: bloco placeholder em `/etc/caddy/Caddyfile` respondendo 200 em
  `agricola.avilaops.com` até o site/app real ser deployado (aí é só trocar
  o `respond` por `reverse_proxy 127.0.0.1:<porta>`).
- **Marca no banco continua `Geomaq`** (é o fabricante real das peças —
  trocar isso corromperia o dado). "Agricola" é o nome de exibição do
  site/loja quando ele existir, não do fabricante.
- **SEO**: não há nada para configurar ainda — este repo não tem código de
  site/frontend (ver "Próximas fases" abaixo). Meta tags, sitemap.xml,
  robots.txt, dados estruturados (schema.org Product) etc. entram junto com
  o site/Medusa.

## Próximas fases (fora deste escopo)

1. Grupo **vedação** (gaxetas, automotivo, o-rings) — o-rings entram como
   `product` + `product_variant` (Ø interno, espessura, material) usando as
   tabelas já existentes.
2. Medusa + site agricola.avilaops.com (loja/vitrine) — é aí que entra SEO
   (meta tags, sitemap, robots.txt, dados estruturados).
