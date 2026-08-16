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

O que precisou de tratamento entre o kit recebido e o que está no ar.

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

### Banners sem destino

O kit traz 15 banners; o site tem 4 departamentos. Aplicados os três que casam
por nome (`pecas-agricolas`, `maquinas-pesadas`, `vedacoes-retentores` →
`vedacoes-e-selagem`). Os demais ficaram em `images/marca/banners/` — **fora do
`public/`**, porque servir 26 MB de PNG que nenhuma página referencia só engorda
o deploy. Convertidos para WebP no versionamento (26 MB → 1,5 MB); os PNG
originais seguem no Drive.

Sem destino hoje:

- `home-desktop` e `home-mobile` — a home hoje tem hero em CSS, sem imagem.
  Usá-los é mudança de design, não troca de arte.
- `hidraulica`, `eletrica`, `filtros-manutencao`, `motores-transmissao`,
  `implementos-agricolas`, `pecas-construcao` — departamentos que não existem
  na taxonomia atual.
- `confirmacao-tecnica`, `novidades`, `ofertas`, `vendedores` — seções que o
  site ainda não tem.

E `kits-e-reparos`, que existe no site, não tem banner no kit.

### Tipografia ainda não aplicada

Manrope e Inter são a recomendação da seção 3. O site usa a pilha de fontes do
sistema. Carregar as duas famílias é uma mudança de performance e de layout
(altura de linha, largura de coluna) que merece uma passada própria.
