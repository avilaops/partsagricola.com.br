import Script from "next/script"

/**
 * Google Tag Manager — container GTM-PXF6MB94, criado pelo TagFlow.
 *
 * O container ja publica a configuracao do GA4 (G-S0LKZ4SM7K) e as tags de
 * generate_lead, search e select_item. Meta Pixel, conversoes de Ads e eventos
 * novos entram por la, sem novo deploy do site.
 *
 * O ID vem embutido como padrao de proposito: ele e publico — vai no HTML de
 * qualquer jeito — e quando o valor mora so num `.env` fora do versionamento
 * ele se perde em migracao de pasta ou build feito em outra maquina, e o site
 * fica sem medicao sem ninguem notar (foi o que aconteceu com o avilaops.com,
 * ver docs/analytics/ANALYTICS-AUDITORIA.md no workspace). `NEXT_PUBLIC_GTM_ID` continua
 * sobrepondo, pra builds de staging.
 */
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? "GTM-PXF6MB94"

export function GoogleTagManagerScript() {
  if (!GTM_ID) return null

  return (
    <Script id="gtm" strategy="afterInteractive">
      {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
    </Script>
  )
}

/** Fallback do GTM pra navegacao sem JavaScript. Vai logo apos `<body>`. */
export function GoogleTagManagerNoScript() {
  if (!GTM_ID) return null

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="Google Tag Manager"
      />
    </noscript>
  )
}
