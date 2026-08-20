# Parts Agrícola — Manual rápido de identidade

Recebido em 16/08/2026 junto com o kit de artes
(`partsagricola-brand-assets-v2.zip`). Este arquivo é a cópia canônica no
repositório; os arquivos de imagem estão em `storefront/public/images/marca/`.

## 1. Conceito

Parts Agrícola combina precisão mecânica e crescimento agrícola. O símbolo une
uma engrenagem ao cultivo para comunicar peças, máquinas, manutenção e evolução.

## 2. Paleta principal

| Token | Cor | Uso |
|---|---|---|
| Verde Parts | `#0B6B3F` | Marca, CTAs, destaques e elementos agrícolas |
| Verde de apoio | `#2FBF71` | Estados ativos, detalhes e realces |
| Grafite Parts | `#1F2933` | Texto forte, fundos escuros e elementos técnicos |
| Cinza neutro | `#64748B` | Texto secundário, descrições, ícones e estados neutros |
| Superfície clara | `#F5F7F6` | Fundos de interface e cartões |
| Branco | `#FFFFFF` | Fundos claros e logo reversa |

## 3. Tipografia recomendada

- **Títulos e chamadas:** Manrope, pesos 700 ou 800.
- **Interface, descrições e formulários:** Inter, pesos 400, 500 e 600.
- **Wordmark:** usar sempre o arquivo oficial da logo; não redigitar o nome com
  outra fonte.

## 4. Área de proteção

Defina `X` como a altura da pequena folha superior do símbolo.

- Logo horizontal: manter no mínimo `1X` de espaço livre em todos os lados.
- Logo vertical: manter no mínimo `1X` entre símbolo e wordmark e ao redor do
  conjunto.
- Símbolo isolado: manter no mínimo `0,5X` ao redor.
- Não encostar a logo em bordas, textos, imagens ou botões.

## 5. Tamanhos mínimos

- Logo horizontal em telas: 180 px de largura.
- Logo horizontal em impressão: 35 mm de largura.
- Símbolo em interface: 24 px.
- Favicon: usar o arquivo específico, sem o wordmark.
- PWA: usar os arquivos `192×192` e `512×512`.

## 6. Aplicação correta

- Fundo claro: logo colorida original.
- Fundo verde ou grafite: logo branca/reversa.
- Documentos técnicos e impressão simples: versão monocromática preta.
- Fundos escuros de impressão: versão monocromática branca.
- iPhone/PWA: símbolo centralizado em fundo branco com margem segura.

## 7. Não fazer

- Não esticar, inclinar ou distorcer a logo.
- Não alterar o verde ou o grafite.
- Não aplicar sombras, gradientes ou efeitos 3D.
- Não colocar o wordmark em fundos com pouco contraste.
- Não usar a logo sobre fotografias sem uma área de proteção limpa.
- Não substituir o símbolo por ícones genéricos de trator ou folha.

---

## Notas de implementação no site

O que precisou de tratamento entre o kit recebido e a implementação atual do
site.

### Verde alinhado ao token

O site nasceu com `#0b6b3a` em 111 lugares — um dígito de diferença do
`#0B6B3F` oficial. Trocado para o token, que agora é o único verde de marca no
código.

### As logos do kit vêm com fundo chapado

Só `partsagricola-favicon.png` e `partsagricola-symbol-transparent.png` têm
canal alfa. Todos os lockups vêm com fundo embutido: o primário em creme
(`#fdfbf8`), o reverso em verde (`#0f552c`), o monocromático branco em cinza
(`#2f3032`).

Isso choca com a seção 6 deste manual: “fundo verde ou grafite → logo
branca/reversa” não é aplicável com um arquivo que já traz um retângulo verde
dentro. Por isso as versões usadas no site são recortadas para alfa:

- `logo-partsagricola.png` — colorida, fundo transparente (cabeçalho e rodapé).
- `logo-partsagricola-branca.png` — reversa, fundo transparente, para superfície
  verde ou grafite.

Se o kit for regerado, pedir os lockups **em PNG com transparência** resolve
isso na origem.

### Banners editoriais e destinos

O kit traz 15 banners; o site tem 4 departamentos. Os três que casam por nome
(`pecas-agricolas`, `maquinas-pesadas`, `vedacoes-retentores` →
`vedacoes-e-selagem`) tinham título e descrição gravados na imagem. O recorte
responsivo dos cards cortava essas palavras e ainda duplicava a copy do HTML.

Por isso, os cards usam derivados editoriais `*-v2.webp`, sem logo, texto ou
botão embutido. Título, descrição e CTA continuam em HTML, acessíveis e
responsivos. As artes originais permanecem extraídas em
`images/geral/partsagricola-brand-assets-v2/`, fora do `public/`; servir PNGs
que nenhuma página referencia apenas engordaria o deploy.
`kits-e-reparos` usa sua fotografia técnica anterior porque o kit não trouxe
uma arte correspondente.

Sem destino hoje:

- `home-desktop` e `home-mobile` — a home hoje tem hero em CSS, sem imagem.
  Usá-los é mudança de design, não troca de arte.
- `hidraulica`, `eletrica`, `filtros-manutencao`, `motores-transmissao`,
  `implementos-agricolas`, `pecas-construcao` — departamentos que não existem
  na taxonomia atual.
- `confirmacao-tecnica` — ganhou derivado editorial sem texto em
  `public/images/campaigns/confirmacao-tecnica-v2.webp`, usado na home e na
  página `/br/confirmacao-tecnica`.
- `novidades` — virou uma seção alimentada pelos produtos realmente adicionados
  por último; o banner raster não é usado porque cita vendedores sem comprovar
  esse dado no catálogo.
- `ofertas` — permanece reservado até existirem preços promocionais ou uma
  coleção de ofertas real no Medusa.
- `vendedores` — permanece reservado até o cadastro ter backend, operação e
  automação n8n; não se publica um CTA de onboarding que termina sem fluxo.

### Tipografia aplicada

Manrope 700/800 é carregada nos títulos e Inter 400/500/600 na interface por
`next/font`. Os arquivos são servidos pelo próprio domínio e as métricas são
reservadas antes do carregamento, evitando salto de layout.

### PWA e compartilhamento

- Open Graph e Twitter usam imagens 1200×630 e metadados explícitos, com texto
  alternativo.
- O manifest usa o grafite oficial `#1F2933`.
- Os ícones atuais são declarados como `purpose: any`. Uma futura versão
  `maskable` deve ser exportada separadamente, com todo o símbolo dentro da área
  segura; não se deve declarar o arquivo atual como maskable e aceitar cortes.
