# AVL-170 — Design system compartilhado

## Intenção

Construir a linguagem visual comum da PARTSAGRICOLA para marketplace,
fornecedores e administração. A interface deve comunicar uma plataforma B2B
de anúncios agrícolas, não uma loja que vende estoque próprio.

## Direção visual

O sistema reaproveita a identidade presente no storefront: verde de marca
`#0B6B3F`, verde de ação `#2FBF71`, grafite `#1F2933`, cinza `#64748B` e
superfície `#F5F7F6`. O dourado de colheita é reservado para foco e aviso; não
substitui o verde como cor principal. Inter atende leitura operacional e
Manrope dá personalidade a títulos e números.

A metáfora visual é um painel técnico agrícola: superfícies claras, divisores
precisos, controles robustos e informação compacta. Não usar efeitos de vidro,
gradientes decorativos, excesso de cards nem padrões de checkout.

```text
Desktop
┌──────── marca ─── busca ampla ─── ações ───────┐
├──── navegação ─── conteúdo / tabela / estados ─┤
│                   componentes e exemplos       │
└──────── confiança · suporte · segurança ───────┘

Mobile
┌─ marca · menu ─┐
├─ busca ampla ──┤
├─ conteúdo ─────┤
├─ lista densa ──┤
└─ confiança ────┘
```

## Entrega

- Tokens centrais para cor, tipografia, espaço, raio, sombra, movimento e
  estados, incluindo tema escuro opcional.
- Button, Input, Select, Combobox pesquisável, Stepper, Card, Badge de condição,
  Price, Rating, avatar de empresa verificada, uploader com preview, EmptyState,
  Skeleton, Toast, Modal, Tabs e DataTable.
- Header de marketplace, sidebar de fornecedor/admin, footer de confiança e
  evolução compatível do AppShell.
- Página pública `/ui` no admin com todos os componentes, estados e layouts.
- Logo raster existente copiada sem alteração e com hash documentado.
- Evidências Playwright desktop e mobile.

## Comportamento e acessibilidade

- Alvos de toque confortáveis, foco visível, rótulos explícitos e mensagens de
  erro associadas ao campo.
- Componentes interativos operáveis por teclado e com semântica HTML nativa
  sempre que possível.
- Tabelas mantêm cabeçalho e ações no desktop; no mobile viram lista legível sem
  rolagem horizontal obrigatória.
- Estados vazio, carregando, erro, sucesso e indisponível aparecem na vitrine.
- Movimento respeita `prefers-reduced-motion`; contraste não depende apenas de
  cor; o layout não transborda a partir de 320 px.

## Limites

- Não alterar a logo nem inventar vetor, cor oficial ou propriedade de domínio.
- Não implementar telas de negócio de AVL-171 em diante.
- Não migrar todo o storefront legado neste módulo; os novos apps ficam
  proibidos de definir cor ou família tipográfica fora do pacote de tokens.
- B03 continua sendo o aceite humano dos protótipos e direitos dos ativos.

## Decisões do executor

- Componentes serão implementados em React/CSS nativos, seguindo a composição
  e API enxuta do shadcn, sem adicionar Radix ou Tailwind apenas para esta base.
- Inter e Manrope serão empacotadas por `@fontsource`, sem dependência de CDN em
  runtime.
- O header recebe slots e URLs por propriedades; nenhuma regra de autenticação
  ou dado de negócio entra no pacote visual.
