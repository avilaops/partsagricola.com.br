# Design system Parts Agrícola

## Uso

Importe os componentes de `@partsagricola/ui` e, uma vez no layout do app,
importe `@partsagricola/ui/styles.css`. Serviços que geram HTML sem React podem
usar `themeCssVariables` de `@partsagricola/ui/tokens`.

```tsx
import { Button, ConditionBadge, Price } from "@partsagricola/ui";

<Button>Publicar anúncio</Button>;
<ConditionBadge condition="used" />;
<Price amountMinor={23500000} />;
```

Preços usam centavos inteiros; `null` apresenta “Sob consulta”. As condições
aceitas são `new`, `used`, `reviewed` e `remanufactured`. A galeria executável
de todos os componentes está em `/ui` no app admin.

## Tokens e identidade

Cor, tipografia, espaçamento, raio, sombra e movimento são centralizados em
`packages/ui/src/tokens.ts` e nas variáveis CSS `--pa-*`. Inter é usada no
corpo e Manrope em títulos e valores. O dourado é funcional: foco, avaliação e
atenção; não substitui o verde como cor principal. O tema padrão é claro e o
tema escuro opcional é ativado com `data-theme="dark"` em um ancestral.

O logo deve ser reutilizado sem distorção. Origem, hash e restrição estão em
`assets/brand/partsagricola/README.md`.

## Acessibilidade

- todos os campos precisam de rótulo persistente;
- o foco visível não deve ser removido;
- Modal usa `dialog`, fecha com Escape e devolve foco ao gatilho;
- Combobox aceita setas, Enter e Escape;
- Tabs aceitam setas, Home e End com roving tabindex;
- DataTable se transforma em lista rotulada no mobile;
- animações respeitam `prefers-reduced-motion`.

## Limites do produto

Os componentes descrevem uma plataforma B2B de empresas anunciantes. Não use
linguagem ou padrões de estoque próprio, carrinho, checkout, pedido, pagamento
ou logística da plataforma.

## Validação

Execute `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`,
`pnpm build` e `pnpm format:check`. Os prints de referência ficam em
`docs/evidencias/avl-170/`.
