# Evidências AVL-167 — schema do marketplace

Data: 17/10/2026. Ambiente: PostgreSQL 16 local descartável, sem produção.

## Inventário validado

| Evidência                |                                      Resultado |
| ------------------------ | ---------------------------------------------: |
| Migrations aplicadas     |                                              2 |
| Tabelas em `marketplace` |                                             28 |
| Índices em `marketplace` |                                             64 |
| Moedas iniciais          |                                              1 |
| Mercados iniciais        |                                              1 |
| Tipos de máquina         |                                              8 |
| Marcas                   |                                             23 |
| Categorias de peça       |                                             10 |
| Importação de exemplo    | 1 peça, 1 código, 1 compatibilidade, 1 vínculo |

Checksums observados:

| Versão | Nome                 | SHA-256                                                            |
| ------ | -------------------- | ------------------------------------------------------------------ |
| `001`  | `foundation`         | `8bfe2cccce2e1d9ee057378e545ee01e9cda4f9e0951d47b3739fda995d46604` |
| `002`  | `marketplace_domain` | `d9a766632cbeb2955364274c4184c688cc609eba36549581b40731afca8204b1` |

## Cenários comprovados

- primeira aplicação e reaplicação sem duplicidade;
- checksum alterado rejeitado;
- dois migradores concorrentes serializados;
- migration com erro revertida integralmente;
- empresa pendente impedida de publicar anúncio;
- troca de empresa em anúncio publicado impedida e anúncios pausados na
  suspensão do anunciante;
- publicação e suspensão concorrentes serializadas pela linha da empresa;
- referências cruzadas entre anunciantes impedidas;
- usuário impedido de representar empresa da qual não é membro ativo;
- direção, autor e empresa emissora de propostas validados;
- vínculo legado impedido de apontar para entidade inexistente ou de outro tipo,
  e entidade vinculada protegida contra exclusão;
- criação de vínculo legado e remoção concorrente da entidade serializadas;
- preço negativo e moeda inexistente rejeitados;
- anúncio de máquina impedido de referenciar peça canônica;
- ano de compatibilidade invertido rejeitado;
- favorito e participante duplicados rejeitados;
- remetente fora da conversa impedido de criar mensagem;
- CSV inválido agregado antes do banco;
- importação com erro revertida integralmente;
- reimportação preservando IDs e atualizando descrição;
- importações concorrentes, inclusive arquivos em ordem inversa, serializadas
  sem órfãos ou deadlock;
- cabeçalhos CSV duplicados/desconhecidos e linhas desalinhadas rejeitados;
- ausência de tabelas de e-commerce e de dinheiro em ponto flutuante.

O pacote de banco concluiu `30/30` testes de integração em PostgreSQL 16, sem
skips.

As evidências finais de lint, typecheck, testes, Playwright e build serão
produzidas pelo GitHub Actions após o único commit autorizado para o módulo.
