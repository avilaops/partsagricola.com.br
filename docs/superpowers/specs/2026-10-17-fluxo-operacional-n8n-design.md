# Fluxo operacional n8n da PARTSAGRICOLA

## Intenção

Automatizar os efeitos assíncronos do marketplace B2B sem transferir ao n8n as
regras de negócio, a autorização ou a persistência principal da plataforma.

## Escopo

O workflow recebe eventos v1 produzidos pela aplicação, normaliza, valida UUIDs,
versão, data e entidades obrigatórias, e elimina duplicidades pelo identificador
numa Data Table persistente. Em seguida, roteia cinco acontecimentos:

- solicitação de cadastro de empresa;
- aprovação de empresa;
- solicitação de moderação de anúncio;
- publicação de anúncio aprovado;
- recebimento de interesse ou proposta comercial.

Cada rota prepara uma notificação operacional com destinatário, assunto,
mensagem, correlação e estado de processamento. O envio externo ficará isolado
atrás de credenciais próprias e não será ativado durante a homologação.

## Regras

- A aplicação e o PostgreSQL continuam como fonte de verdade.
- Eventos não carregam documentos, tokens, pagamentos ou dados pessoais
  completos.
- `id` e `chave` garantem rastreabilidade; o consumidor registra cada `id`
  processado em armazenamento persistente.
- A Data Table evita repetição sequencial, sem prometer atomicidade concorrente;
  a garantia forte exige PostgreSQL próprio e uma restrição única sobre `id`.
- Envelopes inválidos são rejeitados antes da consulta de idempotência.
- Eventos desconhecidos terminam numa saída explícita de não suportado.
- Não existem pedido, checkout, pagamento, frete ou estoque próprio.
- O workflow será criado como rascunho desativado e testado com dados fixados,
  sem efeitos em serviços externos.

## Aceite

As cinco rotas devem executar no n8n com sucesso em modo de teste, produzir o
tipo de notificação esperado e preservar `id`, `correlacaoId` e identificadores
da entidade. Uma sexta execução deve comprovar o tratamento de evento não
suportado. O código versionado no GitHub deve corresponder ao rascunho criado.
