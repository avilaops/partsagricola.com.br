# Roadmap — Marketplace Agricola

> Última atualização: 19/08/2026. Este documento acompanha o progresso do
> projeto de ponta a ponta: da extração do catálogo até a loja em produção.
> Mantenha atualizado conforme cada fase avança.

## Visão geral

Marketplace de peças agrícolas, construção e vedação. Nasceu da extração
estruturada de catálogos e evoluiu para uma loja Medusa v2 + Next.js com
**25.520 produtos publicados** em
**https://partsagricola.com.br**.

A empresa se chama **Parts Agricola** e o domínio oficial é
`partsagricola.com.br`. Migração concluída em 15/08/2026 — DNS, Caddy,
build e CORS já estão no domínio novo, e o `agricola.avilaops.com` saiu do
DNS. Detalhes e pendências em `README.md` → "Troca de domínio".
O nome de exibição da loja no Medusa ainda é "Agricola".

## Arquitetura (produção)

```
                         ┌─────────────────────────┐
                         │   Cloudflare DNS (A)     │
                         │   partsagricola.com.br   │
                         │ api.partsagricola.com.br │
                         └───────────┬─────────────┘
                                     │ DNS-only (sem proxy laranja)
                                     ▼
                    VPS Hetzner (178.105.82.48, Ubuntu 26.04)
                    ─────────────────────────────────────────
                    Caddy (reverse proxy + TLS automático)
                    ├─ partsagricola.com.br      → 127.0.0.1:3006
                    ├─ www.partsagricola.com.br  → 301 pro apex
                    └─ api.partsagricola.com.br  → 127.0.0.1:9002

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
│       └── import-catalogos.ts       ← importa a base tratada e auditada
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
- DNS `agricola.avilaops.com` → VPS, Caddy com TLS automático (domínio
  provisório; substituído por `partsagricola.com.br`).
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
- `scripts/process_catalogs.py` consolida as fontes em uma base canônica,
  preserva proveniência, valida contagens e separa registros inseguros.
- Auditoria aprovada: **25.239 itens importáveis**, **196 em quarentena** e
  nenhum registro sem classificação.
- Importador idempotente por `import_key`, com paginação, concorrência
  controlada e tratamento determinístico de colisões globais de SKU.
- Produção validada com **25.520 produtos**: 25.239 do lote tratado mais 281
  produtos anteriores, sem `import_key` duplicada.

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

### Fase 6 — Marca, idioma e descoberta
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
- Busca pública por código e nome integrada à Store API, com paginação real
  sobre todo o catálogo.
- SEO técnico publicado: canonicals, JSON-LD `Product` e `BreadcrumbList`,
  `robots.txt`, sitemap index, 26 sitemaps de produtos, imagens e `llms.txt`.
- Sitemaps validados com **25.520 URLs de produto** e **3.806 imagens**.
- Cotação técnica multi-item persistente, com inclusão direta nos cards do
  catálogo, ajuste de quantidades e envio consolidado por WhatsApp ou e-mail.
- Faixa de produtos vistos recentemente, persistente entre páginas e integrada
  à cotação rápida para recuperar pesquisas anteriores.
- Comparador técnico de até quatro peças, com códigos, aplicações, categorias,
  medidas disponíveis e envio conjunto para a lista de cotação.
- Lista persistente de peças salvas, integrada ao catálogo, páginas de produto,
  histórico recente e cotação em lote.
- Autocomplete de busca com histórico local, limpeza, seleção por teclado e
  navegação consistente por botão ou Enter.
- Barra de conversão mobile fixa nas páginas de produto, integrada à cotação e
  ao comparador, com transição automática para evitar sobreposição de ações.

### Fase 7 — Odoo como fonte da verdade (em andamento)

Decidido em 16/08/2026; detalhes operacionais em
`odoo.avilaops.com/integracao-partsagricola/README.md`. O Medusa sai; o site e
o Postgres ficam. Estado em 19/08/2026:

- **Feito:** 28.424 produtos importados no Odoo (idempotente por SKU);
  camada de leitura `catalogo_odoo` populada e sincronizada; rota
  `POST /api/revalidar` no ar (token, falha fechado); orquestrador
  `vitrine/atualizar.py` instalado no VPS com cron horário; fotos
  importadas para o Odoo **com recorte de fundo** (serviço `recorte`
  no ar, modelo u2netp).
- **Bloqueado:** precificação (`precificar.py`) espera as chaves
  `ANTHROPIC_API_KEY` e `BRAVE_API_KEY` no `.env` do script no VPS —
  não estão lá, e o script recusa rodar sem elas.
- **Próximo:** conferir o catálogo no Odoo, trocar as páginas de
  vitrine/produto/busca para `catalogo_odoo`, pedido do site → Odoo e,
  por fim, desligar o Medusa.

### Identidade visual v2 — aplicada e no ar (19/08/2026)

Tipografia oficial (Manrope/Inter via `next/font`), banners editoriais
`*-v2.webp` sem texto embutido, seção Novidades na home, página
`/br/confirmacao-tecnica`, metadados sociais/PWA completos e correção do
ciclo 307 do middleware para visitantes sem cookie. Deploy feito no VPS
no mesmo dia (backup em `/opt/backups/agricola-storefront-pre-*`).

## Pendências / próximas fases

### Bloqueia vender de verdade
1. **Gateway de pagamento (Efí Pay — PIX/Boleto)** — ainda não
   implementado. Precisa de um *provider* custom do Medusa (Medusa não tem
   integração oficial com Efí). Credenciais em
   `D:/administrativo/financeiro/.env.production.efi` +
   certificados `.p12` (homologação e produção).
2. **Preços reais** — os produtos estão a R$ 0,00 (catálogo para consulta
   pra fase atual). Alguém precisa definir preço de verdade pelo admin
   antes de vender de fato.

### Qualidade / acabamento
3. **Indexação externa** — enviar o sitemap no Google Search Console e
   acompanhar cobertura; a preparação técnica não garante rastreamento
   imediato pelo Google.
4. **196 registros em quarentena** — revisar
   `data/processed/catalog_quarantine.csv` antes de qualquer nova carga.
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
10. **Ampliação do catálogo** — novas fontes devem passar pelo mesmo snapshot,
    auditoria, quarentena e validação antes/depois da importação.

## Acessos

| O quê | Onde |
|---|---|
| Loja | https://partsagricola.com.br |
| Admin Medusa | https://api.partsagricola.com.br/app |
| Login admin | combinado com o Nicolas (não versionado) |
| Servidor | VPS Hetzner `178.105.82.48`, chave SSH `hetzner_avilaops` |
| Banco `agricola` (catálogo bruto) | Postgres nativo do VPS, schema `catalogo` |
| Banco `agricola_medusa` (loja) | Postgres nativo do VPS, schema padrão Medusa |
| Imagens de produto | Cloudflare R2, bucket `agricola-catalogo` |
| Credenciais gerais | `.env.production` (gitignored, na raiz do repo) |
| Credenciais Efí Pay | `D:/administrativo/financeiro/.env.production.efi` |
