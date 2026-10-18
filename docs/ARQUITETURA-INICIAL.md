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

## Domínio persistente do marketplace

O AVL-167 introduz o schema PostgreSQL `marketplace`, separado de `catalogo` e
`imdepa`. Ele modela usuários, empresas anunciantes, catálogo canônico de
referência, anúncios, solicitações, interesses, propostas e conversas. Apenas
empresas aprovadas podem publicar anúncios; compradores são usuários e podem
representar opcionalmente uma empresa da qual sejam membros.

Catálogos históricos entram apenas pelo importador transacional e permanecem
rastreáveis por `legacy_catalog_link`. Uma peça importada não é estoque, oferta
ou propriedade da PARTSAGRICOLA. A oferta existe somente quando uma empresa cria
um `listing`. O modelo não possui carrinho, pedido, pagamento, split, frete,
devolução ou estoque.

O executor de migrations aplica arquivos numerados com lock consultivo,
transação individual e checksum SHA-256 imutável. Seeds e importações são
idempotentes. A operação detalhada está em `docs/BANCO-MARKETPLACE.md`.

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

- `empresa.cadastro_solicitado`
- `empresa.aprovada`
- `anuncio.moderacao_solicitada`
- `anuncio.publicado`
- `interesse.recebido`

Reservar o nome não significa que a funcionalidade já esteja implementada ou
contratada.

Não existem eventos de carrinho, pedido, checkout, pagamento ou envio: a
PARTSAGRICOLA aproxima compradores e empresas anunciantes, sem operar a venda.

## Workflow operacional

O código versionado em `n8n/partsagricola-operacao.ts` corresponde ao workflow
`t2rlskN2x1OYthGF`, criado no projeto pessoal do n8n como rascunho desativado.
Ele contém 14 nós, valida o contrato v1 e prepara notificações para as cinco
rotas acima. Nenhum nó envia e-mail, mensagem ou chamada externa nesta fase.
Os identificadores processados ficam na Data Table persistente
`partsagricola_eventos_processados`, fora da janela limitada do nó de
deduplicação em memória. A consulta seguida do registro impede reprocessamentos
sequenciais, como comprovado na homologação, mas não é uma operação atômica sob
concorrência. A garantia forte depende de uma tabela PostgreSQL própria com
índice único, que só poderá ser conectada quando existir uma credencial isolada
da PARTSAGRICOLA; nenhuma credencial de outro produto será reutilizada.
O rascunho anterior `jcMc1KFHLETFE0yh` foi arquivado após a homologação da v2,
evitando duas definições operacionais concorrentes.

Em 17 de outubro de 2026 foram executadas sete homologações manuais com dados
fixados: execuções `94000`, `94002` a `94007`, todas concluídas com sucesso,
incluindo o fallback desconhecido e a rejeição de envelope inválido. A execução
`94009` repetiu o identificador da primeira e foi interrompida pela consulta ao
histórico persistente antes da notificação.
As execuções `94012`, `94013` e `94014` rejeitaram, respectivamente, versão
incorreta, data inválida e entidade obrigatória ausente. A execução `94015`
comprovou que o normalizador também aceita o envelope diretamente na raiz.
Após remover os defaults permissivos, as execuções `94023`, `94024` e `94025`
comprovaram a rejeição de versão, data e correlação ausentes.

As capturas Playwright em `docs/evidencias/` apresentam o fluxo e os resultados
em desktop e mobile. O aviso visual sobre caixas no nível superior foi mantido
conscientemente: as saídas são mutuamente exclusivas e não podem compartilhar
um grupo válido do n8n sem ocultar o roteamento.

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

# Identidade central

`apps/auth` é a autoridade OIDC e o PostgreSQL é a fonte de verdade de identidades, papéis, sessões, revogações e memberships. A API central faz a introspecção online; web, seller e admin consomem `packages/api-client`, gerado do OpenAPI, sem chamadas HTTP soltas. Tokens de acesso curtos não são aceitos sem sessão ativa, permitindo logout global imediato. Detalhes operacionais estão em `docs/AUTENTICACAO.md`.

## API central e mídia

O AVL-169 introduz `/v1/health`, `/v1/docs`, os plugins de domínio e políticas
compartilhadas de autorização, mercado, CORS, rate limit, paginação e erros.
Ações sensíveis persistem ator, empresa, mercado, IP e diff no `audit_log`.

Imagens seguem upload direto por URL S3 v4 assinada. A confirmação cria um
`image_job`; o worker reivindica jobs com lock, remove metadados e publica três
derivados WebP antes de marcar o trabalho como concluído. Falhas voltam para a
fila com limite de tentativas. Detalhes estão em `docs/API-CENTRAL.md`.
