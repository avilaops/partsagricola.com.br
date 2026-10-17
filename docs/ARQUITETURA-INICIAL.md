# Arquitetura inicial da PARTSAGRICOLA

Este documento registra a fundação técnica iniciada na tarefa Linear
[`AVL-166`](https://linear.app/avilaops/issue/AVL-166/marketplace-t00-estrutura-do-monorepo-e-infraestrutura-local).
Ele descreve o estado real do repositório e a direção de evolução sem apagar o
catálogo PostgreSQL, os dados importados ou o storefront legado existentes.

## Estado encontrado

- Catálogo consolidado em PostgreSQL 16, com carga e testes em Python.
- Odoo não faz parte do projeto. Referências a Odoo no código e na documentação
  são legado inconsistente e não definem a nova arquitetura.
- `catalogo_unificado`/PostgreSQL é a fronteira de catálogo adotada para a
  evolução do marketplace.
- Storefront Next.js em `storefront/`.
- Infraestrutura local do catálogo em `docker-compose.yml`.
- Validação do catálogo em `.github/workflows/catalogo-postgres.yml`.
- Código Medusa preservado como legado, não como fonte atual do catálogo.

O repositório já contém produto e dados úteis. A implantação de um segundo
monorepo em paralelo criaria duas fontes de verdade; por isso a migração para a
estrutura final será incremental e preservará as rotas e dados atuais.

## Padrão herdado do CMS Ávila Ops

A PARTSAGRICOLA adota as mesmas fronteiras do `cms.avilaops.com`:

1. Regras de negócio e autorização ficam na aplicação e no banco.
2. Eventos são persistidos junto com a mudança de estado antes de qualquer
   chamada externa (outbox transacional).
3. O n8n executa efeitos posteriores: e-mail, avisos, indexação, integrações e
   rotinas operacionais.
4. Consumidores são idempotentes e eventos têm identificador e chave únicos.
5. Workflows ficam versionados em `n8n/` e só são publicados depois de
   validação e aprovação.
6. Segredos ficam no gerenciador de credenciais; nunca no código ou no payload
   do evento.

## Contrato de eventos v1

```json
{
  "id": "uuid",
  "versao": 1,
  "tipo": "fornecedor.cadastro_solicitado",
  "chave": "fornecedor:uuid:cadastro_solicitado",
  "ocorridoEm": "2026-10-17T12:00:00Z",
  "correlacaoId": "uuid",
  "ator": { "id": "uuid", "tipo": "usuario" },
  "dados": {}
}
```

Campos pessoais completos, documentos, tokens e dados de pagamento não entram
no envelope. O consumidor busca detalhes autorizados na API quando necessário.

Tipos iniciais reservados:

- `fornecedor.cadastro_solicitado`
- `fornecedor.aprovado`
- `anuncio.publicado`
- `solicitacao.criada`
- `proposta.recebida`
- `pedido.criado`
- `pagamento.atualizado`
- `envio.atualizado`

Reservar o nome não significa que a funcionalidade já esteja implementada ou
contratada.

## Sequência de implementação

1. Consolidar scripts e gerenciador de pacotes sem interromper o catálogo
   PostgreSQL e o storefront legado.
2. Introduzir o pacote compartilhado de configuração e validação de ambiente.
3. Expandir a infraestrutura local com Redis, MinIO e Mailpit.
4. Criar outbox transacional e dispatcher com teste de idempotência.
5. Ligar o workflow versionado somente quando existir um produtor real de
   eventos e credenciais próprias da PARTSAGRICOLA.
6. Separar comprador, fornecedor e administração por fronteiras de autorização,
   migrando uma fatia funcional por vez.

## Critérios para encerrar AVL-166

A tarefa permanece em andamento até que todos os critérios do Linear sejam
executados e comprovados: seis apps, pacotes compartilhados, ambiente local em
um comando, validação de variáveis, lint, typecheck, testes e CI. A existência
deste documento ou do workflow em rascunho não equivale à homologação.
