# Storefront Parts Agrícola

Interface pública do marketplace B2B Parts Agrícola, construída com Next.js 15,
React 19 e Tailwind CSS.

## Regra de negócio

A Parts Agrícola é a plataforma que conecta compradores a empresas anunciantes.
A plataforma não é lojista, não mantém estoque próprio e não publica catálogo
próprio. Cada empresa participante é responsável pelos seus anúncios e pelas
condições comerciais apresentadas.

As rotas históricas de catálogo, categorias e produtos redirecionam para a home.
As APIs públicas antigas de busca e cotação retornam `410 Gone`.

## Desenvolvimento

Requisitos: Node.js 24 e npm.

```bash
npm ci --ignore-scripts
npm run dev
```

O site fica disponível em <http://localhost:8000/br>.

## Validação

```bash
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

O workflow `Storefront marketplace` executa essas verificações no GitHub,
publica os prints de desktop e celular e envia a produção somente o runtime
aprovado. Build e testes de navegador ocorrem no GitHub; não execute build no
servidor de produção.

## Publicação

Alterações passam por pull request para `main`. Após as verificações, o push em
`main` publica o artefato com troca atômica e rollback automático se o smoke test
falhar. Não há dependência de Odoo neste fluxo.
