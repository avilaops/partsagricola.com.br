# Catálogo unificado

As fontes do catálogo sob um vocabulário único de medida, para o cliente
buscar **a peça** e ver o que serve — de todos os fornecedores.

## O problema

Cada fornecedor nomeia a mesma medida física de um jeito:

| Furo de 30 mm é… | na fonte |
|---|---|
| `Diâmetro Interno` | Imdepa |
| `eixo_mm` | retentores (Rio Preto) |
| `interno_mm` | gaxetas (Rio Preto) |
| `diametro_interno_mm` | o-rings (Agel) |

Quatro nomes, uma medida. E como a busca do site compara `metadata` com
igualdade exata ([catalogo.ts:318](../storefront/src/lib/data/catalogo.ts#L318)),
o cliente precisava saber de antemão de que fornecedor era a peça para
acertar o campo. Na prateleira é a mesma peça.

## Por que não unificamos por código

Foi a primeira hipótese, e ela **não funciona**. Cruzando os códigos
normalizados (maiúsculo, sem pontuação) das 6 fontes:

| Cruzamento | Códigos iguais |
|---|---|
| Imdepa × qualquer outra | **0** |
| geomaq_online × retentores | 11 |
| geomaq_online × o-rings | 8 |
| geomaq_online × geomaq_parts | 194 *(mesma marca — legítimo)* |

E os poucos que batem, em geral **não são a mesma peça**:

- `6234` → "Facão Para Cana" na Geomaq, retentor de eixo 27 mm na Rio Preto
- `1917` → "Mola 15.88X74X190mm" contra retentor de eixo 71 mm
- `7066` → "Parafuso Roda Tras" contra o-ring de 135 mm

São colisões numéricas. Cada fornecedor usa a numeração dele e não há
identificador comum (GTIN não vem preenchido). Unificar por código
fundiria facão com retentor.

## O que fizemos

O elo real é a **medida física**. Um retentor de eixo 30 × externo 47 é
intercambiável esteja ele na Rio Preto ou na Imdepa.

**Nada é fundido.** Cada produto continua sendo o do seu fornecedor —
dois fornecedores com a mesma medida geram duas linhas, que é exatamente
o que se quer mostrar lado a lado. O que se unifica é o vocabulário.

```
interno_mm  ← "Diâmetro Interno" | eixo_mm | interno_mm | diametro_interno_mm
externo_mm  ← "Diâmetro Externo" | externo_mm
altura_mm   ← "Largura" (rolamento) | "Altura" (retentor) | altura_mm
secao_mm    ← secao_w_mm (só o-ring)
```

A terceira dimensão merece nota: rolamento chama de **Largura** e
retentor de **Altura**, mas é a mesma medida no mesmo eixo. Sem juntar as
duas, retentor da Imdepa nunca casaria com retentor da Rio Preto.

## O que entrou

```bash
docker exec -i catalogo_pg psql -U catalogo -d catalogo_db \
    -v ON_ERROR_STOP=1 < sql/migrations/005_catalogo_unificado.sql
docker exec -i catalogo_pg psql -U catalogo -d catalogo_db \
    -v ON_ERROR_STOP=1 < sql/migrations/006_equivalentes_indexado.sql

python scripts/unificar_catalogo.py --truncate
```

| Fornecedor | Itens | Com medida |
|---|---|---|
| Geomaq | 19.079 | 0 |
| Imdepa | 12.502 | 2.947 |
| Rio Preto Vedações *(retentores + gaxetas)* | 2.206 | 2.191 |
| Agel *(o-rings)* | 1.130 | 1.130 |
| **Total** | **34.917** | **6.309** |

Rio Preto entra com 2.206 itens e não com os 3.344 lidos dos CSVs: os
arquivos repetem o mesmo código em variações de linha, e `(origem,
origem_id)` consolida — 3.218 linhas de retentor viram 2.141 códigos.

**1.232 itens têm alternativa em outro fornecedor.** Tipos presentes em
mais de um fornecedor: Retentor (3), O-Ring (3), Rolamento (2), Gaxeta
(2), Mancal (2), Bucha (2).

## Como usar

**Buscar por medida, cruzando fornecedores:**

```sql
SELECT fornecedor, marca, codigo, interno_mm, externo_mm, altura_mm
FROM imdepa.v_item
WHERE tipo_slug = 'retentor'
  AND interno_mm BETWEEN 30 - 0.5 AND 30 + 0.5
  AND externo_mm BETWEEN 47 - 0.5 AND 47 + 0.5;
```

**"Tenho esta peça — quem mais fornece?"** — a pergunta do balcão quando
o item preferido está em falta:

```sql
SELECT codigo, fornecedor, marca, diferenca
FROM imdepa.equivalentes(7907);   -- diferenca 0.000 = medida idêntica
```

Um retentor Sabó 25×35×7 da Imdepa devolve 10 equivalentes da Rio Preto.
A tolerância padrão é 0,5 mm; passe o 2º argumento para afrouxar
(`equivalentes(7907, 1.0)`).

Mais consultas em [queries_unificado.sql](../sql/queries_unificado.sql).

## Ressalvas honestas

**Equivalência é candidatura, não identidade.** A função diz "estas peças
têm a mesma medida e o mesmo tipo", o que as torna candidatas
intercambiáveis. Não afirma que material, vedação e temperatura de
trabalho sejam equivalentes — quem decide é quem entende da aplicação.

**Geomaq (19.079 itens, a maior fonte) não tem medida estruturada** —
só descrição em texto. Entra na busca por código e por texto, mas **não
aparece no filtro dimensional**. Não é bug: o dado não existe na origem.
Extrair medida da descrição é possível, mas seria um passo próprio, com
verificação.

**`tipo` é inferido do nome** por palavra-chave ("retentor", "o-ring",
"gaxeta"…). Cobre bem o que tem medida, mas 1.514 itens da Imdepa caíram
em "Outro". Como o tipo restringe a equivalência, um item mal
classificado deixa de casar — erra para menos, não para mais.

**Isto é uma camada de busca, não fonte da verdade.** `origem` +
`origem_id` apontam para o registro na fonte original. Nada aqui
substitui `catalogo_odoo`, e o site continua no ar exatamente como está.

## Arquivos

| Arquivo | O que é |
|---|---|
| `sql/migrations/005_catalogo_unificado.sql` | fornecedor, tipo_peca, item, equivalentes |
| `sql/migrations/006_equivalentes_indexado.sql` | equivalentes() usando índice (268 ms → 5 ms) |
| `scripts/unificar_catalogo.py` | ETL das 5 fontes, idempotente |
| `sql/queries_unificado.sql` | 8 consultas prontas |
