# Roadmap — Marketplace Agricola

> Última atualização: 20/08/2026. Este documento acompanha o progresso do
> projeto de ponta a ponta: da extração do catálogo até a loja em produção.
> Mantenha atualizado conforme cada fase avança.

## Visão geral

Marketplace de peças agrícolas, construção e vedação. Nasceu da extração
estruturada de catálogos, virou loja Medusa v2 + Next.js e, em 20/08/2026,
trocou o Medusa pelo **Odoo como fonte da verdade**: hoje são
**28.564 produtos publicados** em <https://partsagricola.com.br>, servidos
pelo Next.js a partir de uma camada de leitura no Postgres que o Odoo
alimenta. A conversão é a **cotação** (lista no site → orçamento
`sale.order` no Odoo), não carrinho.

A empresa se chama **Parts Agrícola** e o domínio oficial é
`partsagricola.com.br` (troca concluída em 15/08/2026; `agricola.avilaops.com`
saiu do DNS).

## Arquitetura (produção)

```
                         ┌─────────────────────────┐
                         │   Cloudflare DNS          │
                         │   partsagricola.com.br    │ (proxy laranja)
                         └───────────┬─────────────┘
                                     ▼
                    VPS Hetzner (178.105.82.48, Ubuntu 26.04)
                    ─────────────────────────────────────────
                    Caddy (reverse proxy + TLS automático)
                    ├─ partsagricola.com.br      → 127.0.0.1:3006
                    ├─ www.partsagricola.com.br  → 301 pro apex
                    └─ api.partsagricola.com.br  → 502 (bloco inerte; Medusa desligado)

                    systemd:
                    ├─ agricola-storefront.service  (Next.js standalone, :3006)
                    ├─ partsagricola-db-snapshot.timer (backup diário 00:30)
                    └─ [agricola-medusa.service — parado e desabilitado em 20/08/2026]

                    Docker (stack odoo-avilaops, multi-tenant):
                    ├─ odoo-avilaops-partsagricola-1  (Odoo 19, :8071, workers=0, 1 GB)
                    └─ odoo-avilaops-recorte-1        (removedor de fundo, u2netp)

                    Postgres 18 nativo
                    ├─ partsagricola     → Odoo: FONTE DA VERDADE (catálogo, fotos,
                    │                      preços, orçamentos do site)
                    ├─ agricola_medusa   → camada de leitura do site: catalogo_odoo +
                    │                      categorias_catalogo (+ tabelas herdadas do
                    │                      Medusa, congeladas, de onde o sync ainda
                    │                      copia metadata/handle/categoria — não dropar)
                    └─ agricola          → catálogo bruto extraído dos PDFs

                    Odoo ──sincronizar.py (cron horário)──► catalogo_odoo ──► Next.js
                                                    └─► POST /api/revalidar (cache)
                    Site ──/api/cotacao──► Odoo (res.partner + sale.order draft)

                    Cloudflare R2 (bucket agricola-catalogo)
                    → fotos de produto; recortadas/{sku}.png = versão sem fundo
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
├── medusa/              ← backend Medusa v2 (DESLIGADO em 20/08/2026; código
│                            mantido como histórico — o importador canônico
│                            agora é integracao-partsagricola/ no repo do Odoo)
├── storefront/           ← Next.js (fork do starter Medusa, hoje 100% sobre a
│                            camada catalogo_odoo; sem carrinho/checkout/conta)
├── scripts/deploy-storefront.sh ← deploy de um comando
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
  camada de leitura `catalogo_odoo` populada e sincronizada — com
  metadata técnica e handle da URL carregados (28.424/28.424); rota
  `POST /api/revalidar` no ar (token, falha fechado); orquestrador
  `vitrine/atualizar.py` instalado no VPS com cron horário; fotos
  importadas para o Odoo **com recorte de fundo** (serviço `recorte`
  no ar, modelo u2netp); **pedido do site → Odoo**: a lista de cotação
  tem formulário que cria `sale.order` em rascunho no ERP via
  `POST /api/cotacao` (testado em produção, orçamento S00001).
- **Conferência do catálogo (19/08/2026):** paridade total entre
  `catalogo_odoo` e o Medusa — mesmos 28.424 SKUs dos dois lados, zero
  divergências de nome, 3.806 imagens, metadata 100%.
- **Precificação:** a pesquisa de mercado acontece em sessão do Claude
  Code (sem chave de IA no servidor — o `precificar.py` que exigia
  `ANTHROPIC_API_KEY`/`BRAVE_API_KEY` foi removido em 19/08/2026); o
  resultado revisado é gravado no Odoo pelo `aplicar_precos.py` (CSV
  com fonte obrigatória, procedência no chatter interno).
- **Medusa removido (20/08/2026):** todas as páginas (vitrine, produto,
  categoria, busca, medidas, sitemaps) leem `catalogo_odoo` e
  `categorias_catalogo`; carrinho/checkout/conta/pedidos saíram do site
  (a conversão é a cotação → Odoo). O serviço `agricola-medusa` está
  parado e desabilitado; o banco `agricola_medusa` fica, porque a
  camada de leitura vive nele e o sync copia dele metadata/handle/
  categoria. O admin agora é o Odoo; `api.partsagricola.com.br`
  responde 502 (bloco do Caddy ficou inerte).

### Vistoria e plano de melhoria (21/08/2026)

Vistoria completa (site, catálogo, Odoo, infra, SEO) e plano P0–P3 em
artefato: <https://claude.ai/code/artifact/164f2fe2-dd78-4a9f-aeb9-7987181bac03>.
Entregues no mesmo dia: hero claro + menu lateral limpo, "Sob consulta" nos
cards, trigramas na busca, cabeçalhos de segurança, rate-limit no
`/api/cotacao`, cotação testada de ponta a ponta e **aviso de nova cotação
por e-mail** (fluxo n8n "PartsAgrícola — aviso de nova cotação", webhook com
token; env `COTACAO_WEBHOOK_URL`/`COTACAO_WEBHOOK_TOKEN` no storefront).

### Contagem real por categoria e relacionados por máquina (23/08/2026)

Cada página de categoria diz quantas peças publicadas tem (soma da
subárvore: Vedações e Selagem = 8.823), os cards "Escolha uma linha" vêm
ordenados por volume com o número em cada um (vazios aparecem como "em
catalogação", não somem), e a listagem mostra o total de referências.
Produtos relacionados passaram a priorizar a mesma máquina compatível
dentro da categoria — antes toda ficha da categoria repetia os mesmos 4.

### Categorias com texto próprio, breadcrumbs e CSP (23/08/2026)

As 42 páginas de categoria ganharam descrição editorial única
(`storefront/src/lib/catalog/category-descriptions.ts` — versionada no
código, já que a taxonomia nasceu dos nomes e a camada não guarda
descrição): aparece no hero, nos cards "Escolha uma linha" e na meta
description. As 21 marcas de vedação geram texto por nome, sem parágrafo
repetido. Breadcrumbs completos: trilha visual e JSON-LD `BreadcrumbList`
com a cadeia inteira (Início → Catálogo → departamento → categoria →
produto) em categorias e produtos — `listCategoryParents` anda a cadeia
pela camada, porque as cópias rasas só sobem um nível. E a
Content-Security-Policy entrou calibrada para a stack real (Next inline,
GTM/GA4, Meta Pixel, fotos do R2); vendor novo no GTM precisa entrar na
lista do `next.config.js`.

### Cards: placa técnica e fotos otimizadas (23/08/2026)

Card sem foto virou "placa técnica" — código da peça em destaque com
"foto em catalogação · ficha técnica disponível" — em vez do mesmo SVG
genérico repetido em 87% da grade. Fotos passaram pelo otimizador do
Next (fim do `unoptimized` para o R2: 869 KB → 224 KB em 384 px, WebP
nos browsers) e `object-contain` acabou com o corte das peças.

### Páginas por máquina e "Compatível com" (23/08/2026)

`/aplicacoes/<máquina>` para as 24 máquinas da camada (não só as 8
curadas): as curadas mantêm descrição própria, as demais ganham uma
genérica com a contagem real; todas no sitemap e no llms.txt. A ficha do
produto linka as máquinas compatíveis ("Compatível com John Deere →").

### Cache de HTML no edge da Cloudflare (21/08/2026)

Regra de cache na zona (criada pela API): produto, categoria, aplicação, home
e confirmação técnica ficam 1 dia na borda (browser 5 min); busca e APIs
seguem dinâmicas. Páginas de produto passaram a responder `HIT` da borda em
vez de ~1 s do servidor. A coerência é garantida pela purga: o `/api/revalidar`
purga a zona (token escopado só a Cache Purge, em `tokens.env` e no `.env`
do storefront) a menos que o orquestrador diga que o sync não mudou nada
(`ultimo_sync.json` → `{"purgar": false}`). Scripts manuais que chamam o
revalidar purgam sempre.

### Filtro por máquina compatível (21/08/2026)

A camada ganhou `aplicacoes[]` derivada do nome pelo sync ("Comp. John
Deere" → {John Deere}; 17.157 produtos). O catálogo filtra por
`?aplicacao=`, o painel lista as 24 máquinas mais frequentes com contagem,
as páginas `/aplicacoes/<marca>` usam o dado exato (antes: busca textual).

### Monitoramento (21/08/2026)

`vigia.sh` (repo do Odoo, cron 15 min no VPS) → n8n → e-mail: disco ≥ 90%,
site fora do ar, storefront/Postgres/Odoo parados. Um alerta por condição a
cada 6 h. Primeiro alerta real disparado no teste: disco Docker a 96%.

### Fechamento de 21/08/2026

Fotos: 3.515 sem a marca d'água da Geomaq (v2) + 247 recortadas da célula
(v3) no ar; 28 viraram "sem foto". Títulos: 1.930 repetidos receberam sufixo
(modelo/material ou SKU). Odoo: 42 categorias do site criadas e 28.564
produtos classificados. Scripts e resultados em
`odoo.avilaops.com/integracao-partsagricola/`.

### Disco do VPS — segundo incidente, 23/08/2026

Raiz a 100% de novo e Postgres em recuperação: desta vez o job noturno
`backup-todos-bancos.sh` tinha 19 GB de tars do filestore do tenant
**avilaops** (3,2 GB/noite × 7 dias). O vigia alertou por e-mail às 03:45.
Com autorização do Nicolas: apagado o tar mais antigo (Postgres voltou), e a
retenção dos tars de filestore nesse job caiu para 2 dias (dumps `.sql.gz`
seguem em 7) — backup do script em `/opt/backups/backup-todos-bancos.sh.bak-20260823`.
Raiz foi de 100% para 67%. O volume Docker (40 GB) segue a 93% com **tudo em
uso** (24,7 GB de imagens ativas + 9 GB de volumes): `image prune -a` não
libera nada — a saída é aumentar o volume na Hetzner.

### Disco do VPS — incidente de 21/08/2026

O filestore do Odoo (fotos, 4,8 GB) fez o job noturno server-wide
`backup-todos-bancos.sh` encher o disco raiz; o Postgres entrou em
recuperação. Saída: tars do nosso filestore removidos (redundantes com R2 +
snapshot diário), GC do Odoo nos anexos órfãos, e o volume
`odoo-avilaops_partsagricola-data` retirado da lista desse job (backup do
script em `/opt/backups/backup-todos-bancos.sh.bak-20260821`). O volume
Docker de 40 GB segue a ~96%: ~20 GB são imagens de outros projetos sem
container — `docker image prune -a` é decisão do Nicolas.

### Identidade visual v2 — aplicada e no ar (19/08/2026)

Tipografia oficial (Manrope/Inter via `next/font`), banners editoriais
`*-v2.webp` sem texto embutido, seção Novidades na home, página
`/br/confirmacao-tecnica`, metadados sociais/PWA completos e correção do
ciclo 307 do middleware para visitantes sem cookie. Deploy feito no VPS
no mesmo dia (backup em `/opt/backups/agricola-storefront-pre-*`).

## Pendências / próximas fases

### Bloqueia vender de verdade
1. **Pagamento** — o checkout do Medusa morreu junto com ele; o caminho
   agora é cotação no site → orçamento `sale.order` no Odoo → pagamento
   pelo Odoo (providers nativos do Odoo 19: Mercado Pago e PayPal; Éfi
   PIX/Boleto exigiria módulo custom). **Depende de decisão do Nicolas**:
   quais providers ativar, sandbox ou produção, e com quais credenciais
   (Mercado Pago/PayPal no `.env.production` da raiz; Éfi em
   `D:/administrativo/financeiro/.env.production.efi` + `.p12`). Nada
   ativado até lá — provider de pagamento com credencial real é ação
   externa, não se liga sem combinar.
2. **Preços reais** — os produtos estão a R$ 0,00 (catálogo para consulta
   pra fase atual). Alguém precisa definir preço de verdade pelo admin
   antes de vender de fato.

### Qualidade / acabamento
3. **Indexação externa** — enviar o sitemap no Google Search Console e
   acompanhar cobertura; a preparação técnica não garante rastreamento
   imediato pelo Google.
4. ~~Registros em quarentena~~ — **revisados em 20/08/2026**: dos 280,
   141 eram dado bom rejeitado por rigidez do pipeline (medida dupla de
   retentor, código no prefixo do nome, referência contaminada) — 140
   únicos criados no Odoo e no ar. As 139 restantes têm `revisar=sim`
   da revisão humana da extração e ficam de fora por decisão, não por
   bug.
5. ~~Rebuild não é automático~~ — **resolvido pela arquitetura da camada
   Odoo (verificado em 20/08/2026)**: toda leitura do catálogo é
   `unstable_cache` sob a tag `catalogo`; o `POST /api/revalidar` (chamado
   pelo orquestrador a cada sync) invalida dados e rotas de uma vez, e a
   próxima visita re-renderiza — inclusive páginas pré-geradas no build
   (testado com produto do top-100 cuja foto mudou depois do deploy).
   Rebuild só é preciso quando muda código, e aí é o
   `deploy-storefront.sh`.

### Operacional
6. ~~Sem backup configurado~~ — **resolvido em 20/08/2026**:
   `partsagricola-db-snapshot.timer` (00:30) despeja os três bancos
   (`partsagricola`, `agricola_medusa`, `agricola`) em
   `/opt/backups/partsagricola`, retenção de 5 dias
   (`integracao-partsagricola/backup_bancos.sh` no repo do Odoo).
7. ~~Deploy é manual~~ — **um comando desde 20/08/2026**:
   `./scripts/deploy-storefront.sh` (túnel, build, verificação
   anti-localhost, empacote, backup, troca, smoke test). CI/CD de
   verdade continua fora do escopo por ora.
8. ~~Fotos com marca Geomaq visível~~ — **tratado em 20–21/08/2026**, a pedido
   do Nicolas: as 3.525 fotos da loja online tinham o losango
   semitransparente da Geomaq (sempre igual, sempre no mesmo lugar) —
   removido por estatística de coleção (`limpar_marca_dagua.py`, sem IA
   generativa); as 281 dos PDFs eram a célula inteira do catálogo —
   recortada a foto e descartadas 28 que eram só etiqueta
   (`recortar_celula.py`); tudo refeito no Odoo e publicado com chave
   versionada (`refazer_fotos.py`). Resíduo honesto: um fantasma muito
   leve da marca sobre a superfície de algumas peças, e células cuja
   extração já trazia pedaço do produto vizinho.

### Fases futuras (fora do escopo atual)
9. ~~Rebrand pra Parts Agricola~~ — **concluído**: domínio, DNS/Caddy,
   identidade visual v2 e metadados já são Parts Agrícola; o "nome de
   exibição no Medusa" deixou de existir com o Medusa.
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
