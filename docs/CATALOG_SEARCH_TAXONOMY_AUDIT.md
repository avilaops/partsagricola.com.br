# Levantamento de Catálogo, Categorias e Busca

Data da análise: 31/07/2026

## Objetivo

Transformar o catálogo atual em uma experiência de descoberta e cotação no
padrão dos grandes marketplaces: busca tolerante a variações, navegação por
departamento, compatibilidade por máquina, filtros técnicos, comparação e
páginas comerciais indexáveis.

O objetivo não é copiar visualmente a Amazon. É aplicar o mesmo princípio:
uma fonte de verdade estruturada, múltiplas formas de encontrar o item e uma
jornada clara até a compra ou cotação.

## Diagnóstico executivo

- O banco possui **25.520 produtos publicados**.
- **25.239** vieram da base tratada e **281** pertencem ao catálogo anterior.
- Existem **39 categorias**, todas no nível raiz.
- Existem **0 subcategorias** e **0 produtos em múltiplas categorias**.
- Cada produto está ligado a exatamente uma categoria.
- A home aponta somente para as quatro categorias antigas, que somam os
  **281 itens** exibidos no contador desatualizado.
- Os outros **25.239 produtos** estão pesquisáveis, mas praticamente invisíveis
  na navegação principal.
- **17.152 produtos (68%)** têm compatibilidade escrita no título como
  `Comp. Marca/Modelo`, mas esse dado não é um filtro estruturado.
- **23.730 produtos (94%)** não possuem atributos técnicos estruturados além
  de código, origem e linha.
- **16.389 produtos (64,9%)** não possuem descrição.
- **3.806 produtos (14,9%)** possuem imagem; **21.714** ainda não possuem.
- Existem **24.722 códigos distintos** e **517 repetições de código** entre
  aplicações diferentes. A busca deve mostrar todas as compatibilidades, sem
  tratar essas ocorrências como erro.

## Problemas da estrutura atual

1. **Categorias planas**
   - Cultura, máquina, marca e tipo de peça aparecem no mesmo nível.
   - `Caterpillar`, `O-Rings` e `Peças Agrícolas - Grãos` são tratados como
     categorias equivalentes, embora representem dimensões diferentes.

2. **Marcas usadas como categorias**
   - Caterpillar, Fiat, Case, Komatsu, Volvo e outras deveriam ser filtros de
     compatibilidade, não departamentos.

3. **Categorias antigas duplicadas**
   - `Algodão`, `Amendoim`, `Construção` e `Verde` continuam separadas das
     categorias importadas.

4. **URLs frágeis**
   - Parte dos handles contém acentos e separadores triplos, como
     `peças-agrícolas---grãos`.

5. **Busca dependente do título**
   - Marca, modelo, posição e aplicação estão concatenados no nome.
   - Não há normalização suficiente para código com hífen, ponto, barra,
     espaço, zero à esquerda ou equivalente OEM.

6. **Ausência de descoberta comercial**
   - Não há mega menu, filtros técnicos, comparação, histórico, itens
     equivalentes, compatibilidade confirmada ou lista de cotação.

## Categorias atuais no banco

### Peças agrícolas

| Categoria atual | Produtos |
|---|---:|
| Peças Agrícolas - Grãos | 4.799 |
| Peças Agrícolas - Canavieira | 4.797 |
| Peças Agrícolas - Tratores | 2.297 |
| Peças Agrícolas - Amendoim | 693 |
| Peças Agrícolas - Implementos Agrícolas | 421 |
| Peças Agrícolas - Algodão | 116 |
| Algodão, catálogo anterior | 60 |
| Amendoim, catálogo anterior | 60 |
| Verde, catálogo anterior | 94 |

### Máquinas pesadas

| Categoria atual | Produtos |
|---|---:|
| Máquinas Pesadas - Construção | 4.795 |
| Máquinas Pesadas - Rodante | 1.161 |
| Construção, catálogo anterior | 67 |

### Vedações e componentes industriais

| Categoria atual | Produtos |
|---|---:|
| Vedações Industriais - Caterpillar | 808 |
| Vedações Industriais - Fiat | 748 |
| Vedações Industriais - Case | 711 |
| Vedações Industriais - Massey Ferguson | 649 |
| Vedações Industriais - Fiat Anéis | 502 |
| Vedações Industriais - Michigan | 302 |
| Vedações Industriais - Komatsu | 205 |
| Vedações Industriais - Michigan Anéis | 174 |
| Vedações Industriais - Volvo | 72 |
| Vedações Industriais - Huber Warco | 72 |
| Vedações Industriais - New Holland Industrial | 62 |
| Vedações Industriais - Yale Carregadeira | 52 |
| Vedações Industriais - Danfoss | 35 |
| Vedações Industriais - Hyundai | 23 |
| Vedações Industriais - JCB | 18 |
| Vedações Industriais - Randon | 15 |
| Vedações Industriais - Muller | 12 |
| Vedações Industriais - Bob Cat | 12 |
| Vedações Industriais - POCLAIN | 6 |
| Vedações Industriais - Dinapac | 5 |
| Vedações Industriais - Engesa | 5 |
| O-Rings - Milimétricos | 768 |
| O-Rings - Standard | 362 |
| Gaxetas e Raspadores | 98 |
| Reparos Pneumáticos | 28 |
| Retentores | 45 |

### Kits

| Categoria atual | Produtos |
|---|---:|
| Kits de Reparo - Direção Hidráulica | 371 |

## Famílias técnicas detectáveis

As famílias abaixo foram encontradas nos títulos. Um produto pode conter mais
de uma família, portanto os números não devem ser somados.

| Família detectada | Ocorrências |
|---|---:|
| Anéis e O-Rings | 3.773 |
| Kits e reparos | 1.711 |
| Filtros | 1.118 |
| Guias e suportes | 1.050 |
| Eixos | 1.047 |
| Rodas e roletes | 982 |
| Buchas | 938 |
| Rolamentos | 771 |
| Parafusos e fixadores | 770 |
| Pinos | 768 |
| Retentores | 752 |
| Discos e placas | 668 |
| Gaxetas e raspadores | 593 |
| Bombas e cilindros | 589 |
| Correias e correntes | 581 |
| Arruelas | 566 |
| Engrenagens | 509 |
| Molas | 368 |
| Juntas | 287 |
| Mangueiras | 281 |
| Mancais | 252 |
| Válvulas | 249 |
| Coroas e pinhões | 243 |
| Dentes, lâminas e facas | 213 |
| Componentes elétricos | 209 |
| Caçambas | 173 |
| Sem família reconhecida pelas regras iniciais | 7.683 |

## Marcas de compatibilidade detectadas

As maiores ocorrências extraídas de `Comp. ...` são:

| Marca compatível | Produtos |
|---|---:|
| John Deere | 5.150 |
| Case | 2.220 |
| Caterpillar | 1.666 |
| New Holland | 1.444 |
| Fiatallis | 779 |
| Massey Ferguson | 600 |
| Komatsu | 457 |
| Valtra | 386 |
| Antoniosi | 312 |
| Tatu Marchesan | 291 |
| Miac | 286 |
| Jacto | 259 |
| Volvo | 221 |
| Donaldson | 216 |
| DMB | 187 |
| Valmet | 143 |
| Hyundai | 138 |
| GTS | 115 |
| JCB | 107 |
| Stara | 92 |

Essas marcas indicam compatibilidade ou aplicação e não afiliação comercial.

## Medidas e atributos existentes

| Atributo estruturado | Produtos | Cobertura |
|---|---:|---:|
| Diâmetro interno de O-Ring | 1.130 | 4,5% |
| Seção de O-Ring | 768 | 3,0% |
| Tolerância / padrão Standard | 362 | 1,4% |
| Referência de mercado de kit | 236 | 0,9% |
| Diâmetro externo | 143 | 0,6% |
| Altura | 143 | 0,6% |
| Diâmetro interno de gaxeta | 98 | 0,4% |
| Diâmetro de eixo | 45 | 0,2% |
| Material de retentor | 45 | 0,2% |
| Modelo de retentor | 45 | 0,2% |

Além disso, **1.054 títulos** contêm medidas no formato `N × N`, parte delas
ainda não convertida em atributos.

## Formas de procura que o mercado oferece

### Amazon e marketplaces automotivos

- Código da peça e número do fabricante.
- Seletor de compatibilidade antes da busca.
- Marca, modelo, ano, versão e motor.
- Confirmação visual de “serve no seu equipamento”.
- Histórico, itens relacionados e comparação.

### Mercado Livre

- Catálogo de compatibilidades separado da publicação.
- Marca, modelo, ano, motor, posição e observações.
- Compatibilidade sugerida, incompleta ou universal.
- Reputação da compatibilidade para reduzir devoluções.

Referências:

- <https://developers.mercadolivre.com.br/pt_br/publicacao-de-produtos/compatibilidades-itens-e-produtos-de-autopecas>
- <https://developers.mercadolivre.com.br/pt_br/convivencia-me1-me2/referencias-de-dominios-produtos-e-atributos-para-autopecas>

### Motion Industries

- Busca dentro dos resultados.
- Ordenação por relevância e mais vendidos.
- Comparação de produtos.
- Código do fabricante e código interno.
- Filtros por diâmetro interno, externo, seção, dureza e material.

Referências:

- <https://www.motion.com/products/Seals%20and%20Gaskets/O-Rings%20and%20Cord%20Stock/O-Rings>
- <https://www.motion.com/products/Seals%20and%20Gaskets/Seals>

### Grainger

- Sistema métrico ou polegadas.
- Número DASH.
- Medidas nominais e reais.
- Material, dureza, temperatura, compatibilidade química e normas.
- Desenhos dimensionais e documentos.

Referência:

- <https://www.grainger.com/category/hardware/sealing-supplies/o-rings-o-ring-kits/o-rings>

## Nova arquitetura recomendada

### Nível 1: Departamentos

| Departamento proposto | Produtos atuais |
|---|---:|
| Peças Agrícolas | 13.337 |
| Máquinas Pesadas | 6.023 |
| Vedações e Selagem | 5.789 |
| Kits e Reparos | 371 |

### Nível 2: Forma principal de navegação

#### Peças Agrícolas

- Grãos
- Cana-de-açúcar
- Tratores
- Amendoim
- Implementos agrícolas
- Algodão
- Linha verde

#### Máquinas Pesadas

- Construção
- Material rodante
- Escavadeiras
- Retroescavadeiras
- Carregadeiras
- Motoniveladoras
- Tratores de esteira
- Compactadores

Os tipos de equipamento ainda precisam ser extraídos dos títulos e descrições.

#### Vedações e Selagem

- O-Rings
- Retentores
- Gaxetas
- Raspadores
- Anéis de vedação
- Reparos pneumáticos
- Reparos hidráulicos

As marcas atuais passam a ser filtros de compatibilidade.

#### Kits e Reparos

- Direção hidráulica
- Cilindros hidráulicos
- Bombas
- Caixa de direção
- Sistemas pneumáticos

### Nível 3: Família técnica

Famílias como filtros e páginas de destino:

- Engrenagens
- Rolamentos
- Eixos
- Buchas
- Pinos
- Filtros
- Correias e correntes
- Rodas e roletes
- Bombas e cilindros
- Guias e suportes
- Discos e placas
- Dentes, lâminas e facas
- Fixadores

### Filtros globais

- Código original
- Código equivalente
- Família da peça
- Marca compatível
- Modelo da máquina
- Tipo de equipamento
- Cultura / aplicação
- Sistema da máquina
- Posição: dianteiro, traseiro, direito, esquerdo, superior ou inferior
- Disponibilidade
- Com imagem

### Filtros para O-Rings e vedações

- Sistema métrico ou polegadas
- Diâmetro interno
- Diâmetro externo
- Seção / espessura
- Altura / largura
- Diâmetro do eixo
- Material: NBR, Viton/FKM, silicone, poliuretano, PTFE e outros
- Dureza
- Perfil
- Número DASH
- Faixa de temperatura
- Compatibilidade química

### Filtros para máquinas e peças agrícolas

- Marca
- Modelo
- Tipo de máquina
- Cultura
- Sistema: transmissão, hidráulico, motor, rodante, corte, alimentação etc.
- Família técnica
- Posição de montagem
- Código OEM

## Busca recomendada

### Uma única caixa, três caminhos

1. **Buscar por código**
   - Prioridade para código exato.
   - Ignorar hífen, ponto, barra, espaço, acento e diferença entre maiúsculas.
   - Preservar zeros à esquerda.

2. **Buscar por máquina**
   - Marca → modelo → tipo de equipamento → sistema → peça.
   - Exibir “compatibilidade confirmada”, “provável” ou “não informada”.

3. **Buscar por medida**
   - Tipo da vedação → unidade → diâmetros → seção/altura → material.
   - Permitir tolerância numérica e conversão mm/polegada.

### Ranking

1. Código exato normalizado.
2. Código equivalente exato.
3. Marca e modelo compatíveis.
4. Frase exata no título.
5. Família + marca + modelo.
6. Aplicação e descrição.
7. Busca aproximada por erro de digitação.

### Autocomplete

Agrupar sugestões em:

- Produtos
- Códigos
- Categorias
- Marcas
- Modelos
- Famílias técnicas

### Sinônimos iniciais

- `oring`, `o-ring`, `anel o`
- `retentor`, `seal`, `vedador`
- `gaxeta`, `guarnição`
- `raspador`, `limpador`
- `engrenagem`, `coroa`, `pinhão`
- `rolamento`, `bearing`
- `bucha`, `casquilho`

## Página de categoria no padrão recomendado

### Cabeçalho

- Nome comercial claro.
- Quantidade real de itens.
- Descrição curta e útil.
- Subcategorias visuais.
- Marcas mais procuradas.
- Busca dentro da categoria.

### Resultado

- Filtros à esquerda no desktop e drawer no celular.
- Chips com filtros aplicados.
- Ordenação por relevância, código, novidade e disponibilidade.
- Alternância entre grade e lista técnica.
- Comparação de até quatro itens.

### Card de produto

- Foto ou placeholder técnico.
- Nome curto.
- Código em destaque e copiável.
- Marca/modelo compatível.
- Medidas principais.
- Estado da compatibilidade.
- Disponibilidade ou prazo.
- CTA “Ver detalhes” e “Adicionar à cotação”.

## Página de produto

- Código principal e códigos equivalentes.
- Compatibilidades estruturadas.
- Tabela técnica.
- Medidas com unidade.
- Desenho dimensional quando disponível.
- Produtos equivalentes.
- Itens frequentemente cotados juntos.
- Documentos e fonte técnica.
- Confirmação de aplicação antes da compra.
- CTA de cotação quando preço ou estoque não estiver confirmado.

## SEO

Devem ser indexadas:

- Páginas dos quatro departamentos.
- Categorias e famílias técnicas relevantes.
- Marcas compatíveis.
- Modelos e tipos de máquina com conteúdo suficiente.
- Produtos.

Não devem ser indexadas automaticamente:

- Todas as combinações possíveis de filtros.
- Ordenações.
- Resultados de busca interna.
- Páginas vazias ou com poucos dados.

As URLs novas devem usar ASCII e palavras claras, por exemplo:

- `/br/pecas-agricolas`
- `/br/pecas-agricolas/graos`
- `/br/maquinas-pesadas/escavadeiras`
- `/br/vedacoes/o-rings`
- `/br/pecas/engrenagens`
- `/br/marcas/john-deere`

As URLs antigas precisam de redirecionamentos permanentes.

## Modelo de dados recomendado

### Identificadores

- Código principal.
- Código OEM.
- Código equivalente.
- Código normalizado para busca.
- Tipo e origem do código.

### Compatibilidades

- Marca.
- Modelo.
- Tipo de equipamento.
- Ano ou geração, quando aplicável.
- Sistema.
- Posição.
- Nota técnica.
- Nível de confiança e origem da informação.

### Dimensões

- Nome da medida.
- Valor.
- Unidade.
- Tolerância.
- Valor normalizado em milímetros.

### Classificação

- Departamento.
- Categoria principal.
- Família técnica.
- Aplicação.
- Tags comerciais controladas.

## Estratégia técnica de busca

Para o volume atual, a primeira versão pode permanecer no PostgreSQL:

- coluna de código normalizado;
- `unaccent`;
- índices `pg_trgm`;
- documento de busca consolidado;
- índices GIN;
- tabelas estruturadas de compatibilidade e dimensão;
- endpoint que retorna resultados e facets.

Isso evita colocar outro serviço pesado no VPS atual.

Algolia, Typesense, Meilisearch ou OpenSearch só devem entrar quando houver
volume de tráfego, necessidade de personalização ou infraestrutura dedicada.

## Plano de implementação

### Fase 1: Fundação do catálogo

1. Criar snapshot antes da migração.
2. Criar a árvore com quatro departamentos.
3. Unificar as quatro categorias antigas.
4. Transformar marcas em atributos de compatibilidade.
5. Normalizar handles e criar redirecionamentos.
6. Validar 25.520 produtos antes e depois.

### Fase 2: Enriquecimento automático

1. Extrair marca e modelo dos 17.152 títulos com `Comp.`.
2. Classificar famílias técnicas com regras versionadas.
3. Extrair as 1.054 medidas existentes nos títulos.
4. Criar códigos normalizados e aliases.
5. Colocar casos ambíguos em quarentena.

### Fase 3: Nova experiência

1. Mega menu de departamentos.
2. Home com categorias, marcas e famílias.
3. Autocomplete agrupado.
4. Busca dentro da categoria.
5. Facets por domínio.
6. Cards técnicos e lista de cotação.
7. Compatibilidade na página do produto.

### Fase 4: Conteúdo comercial

1. Imagens para os 21.714 produtos sem foto.
2. Descrições para os 16.389 produtos sem texto.
3. Especificações e desenhos dimensionais.
4. Produtos equivalentes e complementares.
5. Preços, estoque, prazo e regras de frete.

## Critérios de aceite

- Exatamente **25.520 produtos** preservados.
- Nenhum produto sem categoria principal.
- Nenhum código perdido.
- Repetições de código preservadas como aplicações diferentes.
- Nenhuma marca de compatibilidade apresentada como fabricante da loja.
- Busca exata por código retorna o item em primeiro lugar.
- Busca sem pontuação encontra códigos com hífen, ponto ou barra.
- Filtros numéricos funcionam por unidade e tolerância.
- URLs antigas redirecionam.
- Sitemaps mantêm todos os produtos e apenas páginas de categoria úteis.
- Desktop e celular validados em produção.
