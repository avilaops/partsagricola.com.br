# Parts Agrícola — ícones de interface

Conjunto vetorial personalizado para a interface do marketplace.

O kit v2 também publica os 28 arquivos individuais em
`public/assets/icons/`. Use os arquivos individuais em e-mail, PDF ou conteúdo
estático; no React, prefira os componentes gerados em
`src/modules/common/icons/parts/`.

## Linguagem visual

- Traço técnico com cantos arredondados.
- Peso padrão de 1.8 px em uma grade de 24×24.
- Cor principal herdada de `currentColor`.
- Detalhes de destaque em `--pa-green`, com fallback para `#0B6B3F`.
- Formas de apoio inspiradas em engrenagem, folha, catálogo técnico e peças mecânicas.

## Uso em HTML/React

```html
<svg class="pa-icon" aria-hidden="true">
  <use href="/assets/partsagricola-icons.svg#pa-search-code"></use>
</svg>
```

> **No storefront, não é assim.** `<use>` apontando para outro arquivo cria uma
> fronteira de documento: `currentColor` e as custom properties da página não
> atravessam essa fronteira no Firefox nem no Safari, porque o conteúdo
> referenciado é estilizado pelo documento do sprite, não por quem o referencia.
> Na prática o ícone ficaria preso à cor de fallback em vez de seguir a cor do
> texto, e o `--pa-green` definido no `.pa-icon` nunca chegaria lá dentro.
>
> Por isso a geometria é inlinada em componentes React
> (`src/modules/common/icons/parts/`), gerados do sprite por
> `npm run icones`. O sprite continua publicado em `/assets/` para e-mail, PDF
> e qualquer consumidor que não seja este React — o trecho acima vale para eles.
>
> As classes `.pa-accent` e `.pa-fill-accent` foram movidas para
> `styles/globals.css`, então `--pa-green` continua sobreponível.

```css
.pa-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #1F2933;
  --pa-green: #0B6B3F;
  flex: 0 0 auto;
}

.pa-icon--large {
  width: 2rem;
  height: 2rem;
}
```

## IDs disponíveis

`pa-search-code`, `pa-search-name`, `pa-search-application`, `pa-filter`, `pa-compatibility`, `pa-machine`, `pa-brand`, `pa-category`, `pa-cart`, `pa-favorites`, `pa-compare`, `pa-order`, `pa-delivery`, `pa-pickup`, `pa-payment`, `pa-pix`, `pa-card`, `pa-whatsapp`, `pa-support`, `pa-verified-seller`, `pa-checked-product`, `pa-technical-confirmation`, `pa-stock-available`, `pa-made-to-order`, `pa-offer`, `pa-new-product`, `pa-warranty`, `pa-return`.
