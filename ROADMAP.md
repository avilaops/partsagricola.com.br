# Roadmap — Marketplace Agricola

> Última atualização: 28/07/2026. Este documento acompanha o progresso do
> projeto de ponta a ponta: da extração do catálogo até a loja em produção.
> Mantenha atualizado conforme cada fase avança.

## Visão geral

Marketplace de peças agrícolas e de construção. Nasceu da extração
estruturada de catálogos em PDF (281 peças, com fotos, código, linha e
família) e evoluiu para uma loja completa (Medusa v2 + Next.js) já em
produção em **https://agricola.avilaops.com**.

A empresa vai se chamar **Parts Agricola** (domínio futuro:
`partsagricola.com.br`) — a troca de domínio/marca ainda não foi feita,
fica para uma fase futura por decisão do Nicolas.

## Arquitetura (produção)

```
                         ┌─────────────────────────┐
                         │   Cloudflare DNS (A)     │
                         │  agricola.avilaops.com   │
                         │ api-agricola.avilaops.com│
                         └───────────┬─────────────┘
                                     │ DNS-only (sem proxy laranja)
                                     ▼
                    VPS Hetzner (178.105.82.48, Ubuntu 26.04)
                    ─────────────────────────────────────────
                    Caddy (reverse proxy + TLS automático)
                    ├─ agricola.avilaops.com     → 127.0.0.1:3006
                    └─ api-agricola.avilaops.com → 127.0.0.1:9002

                    systemd services:
                    ├─ agricola-storefront.service (Next.js standalone, :3006)
                    └─ agricola-medusa.service     (Medusa v2, :9002)

                    Postgres 18 nativo (multi-tenant, 1 database por app)
                    ├─ agricola          → schema catalogo (dado bruto extraído)
                    └─ agricola_medusa   → schema do Medusa (produtos, pedidos...)

                    Redis nativo (compartilhado entre projetos,
                    namespaced por TENANT_SLUG=agricola)

                    Cloudflare R2 (bucket agricola-catalogo)
                    → imagens de produto, servidas via pub-*.r2.dev
```

O mesmo VPS hospeda outros projetos da Avila Ops (pkvedacoes, saudepet,
cliente-avila, brilhax, wabusiness) — o padrão de deploy (systemd nativo,
Postgres/Redis compartilhados) espelha o que já existia para `pkvedacoes`.

## Repositório

`github.com/avilaops/agricola` (branch `main`)

```
agricola/
├── data/               ← CSV/JSON do catálogo extraído (fonte da verdade)
├── images/              ← recortes de imagem por peça (usados só na importação)
├── sql/                 ← schema.sql + seed.sql do banco "agricola" (catálogo bruto)
├── scripts/              ← pipeline de extração/revisão do catálogo (Fase 1)
├── medusa/              ← backend Medusa v2 (Turborepo)
│   └── apps/backend/src/migration-scripts/
│       ├── agricola-store-seed.ts   ← loja/região/canal de venda
│       └── import-geomaq.ts          ← importa data/geomaq_parts.csv pro Medusa
├── storefront/           ← Next.js (fork do nextjs-starter-medusa oficial)
├── .env.production        ← credenciais gerais (gitignored)
├── README.md              ← detalhes técnicos de cada fase
└── ROADMAP.md             ← este arquivo
```

## Fases concluídas

### Fase 1 — Extração do catálogo (peças)
- 4 catálogos PDF da linha Algodão/Amendoim/Construção/Verde → OCR/parsing →
  294 peças brutas (`scripts/extract_all.py`, `combine.py`).
- Revisão manual completa: 294 → **281 peças** (12 falsos-positivos removidos
  — números de telefone da contracapa capturados por engano — e 1 duplicata).
  83 nomes corrigidos, ~10 códigos com erro de OCR corrigidos.
  12 registros continuam marcados `revisar: sim` (dado insuficiente na imagem
  pra confirmar com segurança — não foi inventado).
- Schema Postgres modelado (`brand`/`product_line`/`product_family`/
  `product`/`product_variant`/`product_attribute`/`product_image`) pensado
  pra já comportar uma fase futura de "vedação" sem remodelar.

### Fase 2 — Infraestrutura base
- Banco `agricola` criado no Postgres do VPS, schema+seed aplicados.
- DNS `agricola.avilaops.com` → VPS, Caddy com TLS automático.
- `.env`/`.env.production` protegidos no `.gitignore`.
- Repositório sincronizado com GitHub.

### Fase 3 — Marketplace (Medusa + storefront)
- Backend Medusa v2.18 (Turborepo) com:
  - Redis multi-tenant (`TENANT_SLUG=agricola`, mesmo padrão do pkvedacoes,
    não colide com outros projetos no mesmo Redis compartilhado).
  - File provider S3-compatível apontando pro Cloudflare R2 (imagens de
    produto), com acesso público via URL gerenciada `r2.dev`.
  - Loja "Agricola", região Brasil/BRL, canal de venda, publishable key
    (`agricola-store-seed.ts`).
- Storefront Next.js (fork do `nextjs-starter-medusa`), com:
  - Landing page própria (hero com busca por código, 4 linhas do catálogo,
    faixa de confiança, CTA, página de contato).
  - Deploy em modo `standalone` (build enxuto, sem precisar do
    `node_modules` completo no servidor).
- Deploy: build de produção feito **local** e só os artefatos prontos vão
  pro VPS via `scp` — evita rodar `npm install` pesado no servidor
  compartilhado (já causou um susto de memória numa tentativa anterior).

### Fase 4 — Importação dos dados reais
- Script `import-geomaq.ts`: lê `data/geomaq_parts.csv`, cria 1 categoria
  por linha e 1 produto por peça (preço R$ 0,00 — catálogo de papel não tem
  preço —, imagem sobe pro R2, metadata com os campos originais da
  extração). Processamento paralelo (8 workers), idempotente.
- **281/281 peças importadas e publicadas** em produção.

### Fase 5 — Correções críticas pós-deploy
- **Bug de redirecionamento**: o `server.js` standalone do Next, atrás do
  Caddy, montava `request.nextUrl.origin` usando o hostname interno
  (`localhost:3006`) em vez do domínio real — qualquer visitante novo era
  redirecionado pra fora do site. Corrigido lendo
  `X-Forwarded-Host`/`Host` no `middleware.ts`.
- **Canal de venda errado**: um resíduo de seed anterior fez os primeiros
  produtos de teste ficarem ligados ao canal errado (loja aparecia vazia
  na Store API). Corrigido e limpo.
- **Handle inválido**: 1 peça com código terminando em ponto
  (`47864190.`) gerava um handle inválido — corrigido o sanitizador.

### Fase 6 — Marca e idioma (em andamento)
- Confirmado com o Nicolas: **Geomaq não tem relação com a empresa** —
  removidas todas as menções a "Geomaq" do site e do banco (texto/metadata;
  as fotos das peças, recortadas do catálogo impresso, continuam como
  estão por ora — algumas mostram o logo Geomaq® na própria imagem).
- Rodapé trocou "Powered by Medusa & Next.js" por "by Avila Ops"
  (link `avila.inc`).
- Tradução pt-BR: **concluído** — nav, rodapé, home, conta (login,
  cadastro, endereços, perfil, senha, pedidos), carrinho, checkout
  (endereços, entrega, pagamento, revisão, cupom). Falta uma
  passada final de conferência visual.

## Pendências / próximas fases

### Bloqueia vender de verdade
1. **Gateway de pagamento (Efí Pay — PIX/Boleto)** — ainda não
   implementado. Precisa de um *provider* custom do Medusa (Medusa não tem
   integração oficial com Efí). Credenciais em
   `D:/administrativo/financeiro/.env.production.efi` +
   certificados `.p12` (homologação e produção).
2. **Preços reais** — os 281 produtos estão a R$ 0,00 (decisão do Nicolas
   pra fase atual). Alguém precisa definir preço de verdade pelo admin
   antes de vender de fato.

### Qualidade / acabamento
3. **SEO avançado** — título/description/robots/sitemap básico já
   funcionam (via `next-sitemap`, incluso no starter); falta dado
   estruturado (schema.org `Product`) por página de produto.
4. **12 peças ainda marcadas "revisar"** no catálogo — ninguém confirmou
   manualmente ainda (ver `review.html` ou `data/geomaq_parts.csv`,
   coluna `revisar_motivo`).
5. **Rebuild não é automático** — páginas de produto/categoria são
   estáticas (SSG). Mudanças grandes no catálogo pelo admin merecem um
   rebuild+redeploy do storefront pra manter a geração estática correta
   (o site funciona sem isso via renderização sob demanda, mas não é o
   ideal de performance).

### Operacional
6. **Sem backup configurado** pros bancos `agricola`/`agricola_medusa`
   (o `pkvedacoes` tem um serviço de snapshot automático — os nossos
   ainda não têm).
7. **Deploy é manual** — sem CI/CD; toda mudança de código precisa de
   build local + `scp` + restart do systemd, repetindo os passos da
   Fase 3.
8. **Fotos com marca Geomaq visível** — decisão pendente sobre re-fotografar,
   croppar ou substituir as imagens que mostram o logo Geomaq®.

### Fases futuras (fora do escopo atual)
9. **Rebrand pra Parts Agricola** — trocar nome de exibição, domínio
   (`partsagricola.com.br`) e DNS/Caddy quando o Nicolas decidir seguir
   com isso.
10. **Grupo Vedação** (gaxetas, automotivo, o-rings) — o schema já foi
    pensado pra comportar isso via `product_variant` (Ø interno, espessura,
    material) sem precisar remodelar.

## Acessos

| O quê | Onde |
|---|---|
| Loja | https://agricola.avilaops.com |
| Admin Medusa | https://api-agricola.avilaops.com/app |
| Login admin | combinado com o Nicolas (não versionado) |
| Servidor | VPS Hetzner `178.105.82.48`, chave SSH `hetzner_avilaops` |
| Banco `agricola` (catálogo bruto) | Postgres nativo do VPS, schema `catalogo` |
| Banco `agricola_medusa` (loja) | Postgres nativo do VPS, schema padrão Medusa |
| Imagens de produto | Cloudflare R2, bucket `agricola-catalogo` |
| Credenciais gerais | `.env.production` (gitignored, na raiz do repo) |
| Credenciais Efí Pay | `D:/administrativo/financeiro/.env.production.efi` |
