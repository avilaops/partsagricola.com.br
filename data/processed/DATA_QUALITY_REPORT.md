# Relatório de qualidade dos catálogos

## Resultado

- Linhas de origem: **28423**
- Aprovadas para importação: **28143**
- Enviadas para quarentena: **280**
- Linhas sem classificação: **0**
- Validação automática: **APROVADA**
- Pronto para deploy: **SIM**

## Por fonte

| Fonte | Origem | Importar | Quarentena |
|---|---:|---:|---:|
| gaxetas_raspadores | 126 | 126 | 0 |
| geomaq_online | 19089 | 19079 | 10 |
| kits_catalogo | 372 | 371 | 1 |
| orings | 1130 | 1130 | 0 |
| retentores | 3218 | 2949 | 269 |
| rpv_industrial | 4488 | 4488 | 0 |

## Motivos de quarentena

- `altura_nao_confirmada`: 265
- `codigo_ausente`: 10
- `dimensoes_principais_ausentes`: 4
- `referencia_mercado_contaminada`: 1

## Alertas de origem

- Nenhum.

## Escopo fechado

- Modo: `curated_snapshot`
- Arquivo: `data/geomaq_online.csv`
- Linhas esperadas: 19089
- Decisão: Publicar o lote fechado solicitado de aproximadamente 29 mil registros brutos. A coleta online completa, estimada em mais de 89 mil itens, fica fora deste deploy para evitar expansão não aprovada e risco operacional no VPS.

## Garantias

- Cada linha de origem termina em importação ou quarentena.
- `import_key` é determinístico e único, permitindo reexecução idempotente.
- Códigos repetidos com aplicações distintas são preservados.
- Nomes de fornecedores ficam apenas em metadados internos.
- Categorias públicas usam uma taxonomia comercial neutra.
- Registros incompletos não são publicados automaticamente.
