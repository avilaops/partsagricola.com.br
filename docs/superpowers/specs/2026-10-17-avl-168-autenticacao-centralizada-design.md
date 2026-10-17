# AVL-168 — Autenticação centralizada

## Intenção

Transformar `apps/auth` no provedor de identidade central da PARTSAGRICOLA.
Uma conta deve autenticar web, área do fornecedor, administração e clientes
móveis por OpenID Connect sem repetir a senha entre superfícies. O serviço deve
persistir identidade, sessões e revogações no PostgreSQL e não depender de
estado em memória para decisões de segurança.

## Decisões de produto e escopo

- A marca exibida é `PARTSAGRICOLA`; “AgroPeças” no texto legado não substitui
  a identidade já confirmada no monorepo.
- Compradores são usuários. Anunciantes são empresas (`company_id`). Tokens
  expõem `seller_ids` como nome compatível para as empresas ativas das quais o
  usuário é membro, sem criar uma segunda entidade “loja”.
- Papéis globais: `USER`, `SUPPORT`, `FINANCE`, `ADMIN`. Papéis por anunciante
  reutilizam `OWNER`, `MANAGER`, `EDITOR`, `VIEWER` de `company_member`.
- `ADMIN` e `FINANCE` exigem TOTP antes da emissão de código ou sessão elevada.
  Demais contas podem ativar TOTP opcionalmente.
- Google, Facebook, Apple e Microsoft usam o mesmo contrato de conector. O
  banco guarda somente ativação, endpoints e nome das variáveis de ambiente;
  client secret e chaves privadas nunca são persistidos nem retornados.
- Cadastro por e-mail ocorre em uma tela e termina com verificação pendente.
  Cadastro social cria a conta no callback; somente falta real de nome/e-mail
  leva a um segundo passo de complementação.
- Biometria/Face ID não pertence a este módulo.

## Arquitetura

### Persistência

A migration `003_auth_identity.sql` cria, no schema `marketplace`, tabelas para
credenciais, papéis globais, identidades sociais, sessões, transações OIDC,
códigos de autorização, refresh tokens, tokens de verificação/recuperação e
configuração pública dos conectores. Credenciais se ligam a `app_user`; escopo
de anunciante é calculado de `company_member active=true`.

Tokens de uso único e refresh tokens são guardados apenas como SHA-256. Senhas
usam Argon2id. Segredos TOTP são cifrados com AES-256-GCM por uma chave obtida
de `AUTH_DATA_KEY`; códigos de recuperação, verificação e reset são igualmente
hashados. Tentativas e expirações são validadas atomicamente no banco.

CPF é opcional e pode ser informado no cadastro ou depois. Para login e
unicidade, seu valor normalizado é representado por HMAC-SHA-256 com
`AUTH_LOOKUP_KEY`; o número bruto não precisa ser guardado. Usuários existentes
continuam válidos, mas só autenticam depois de criar credencial por convite ou
reset. A migration não inventa senha nem papel administrativo. Papéis globais
são semeados; o primeiro administrador é provisionado por comando explícito
usando ambiente, nunca por senha padrão.

### Protocolo e sessão

`apps/auth` continua em Fastify e implementa:

- discovery OIDC e JWKS;
- `/authorize`, `/token`, `/userinfo` e logout global;
- Authorization Code obrigatório com PKCE S256 para `web`, `seller`, `admin`
  e clientes móveis;
- access/id tokens JWT assinados por Ed25519 via `jose`;
- authorization codes opacos de uso único;
- refresh tokens opacos, rotativos por família, com revogação da família ao
  detectar reutilização;
- cookie de SSO opaco, `HttpOnly`, `SameSite=Lax`, `Secure` em produção;
- logout global revogando todas as sessões e famílias do usuário.

Access tokens são JWTs curtos, mas toda decisão autenticada passa por
`/session/introspect`: assinatura, `jti`, sessão e revogação são verificadas no
banco. Assim, logout global é imediato. `packages/shared` fornece o cliente e
os guardas dessa introspecção; não promete validação puramente offline.

Clientes públicos sem segredo são semeados como `partsagricola-web`,
`partsagricola-seller`, `partsagricola-admin` e `partsagricola-mobile`. Em
desenvolvimento, redirects são respectivamente `http://127.0.0.1:3000`,
`:3001`, `:3002` em `/auth/callback`, e
`br.com.partsagricola.app:/oauth/callback`; origens adicionais entram somente
por configuração explícita. Todos exigem PKCE S256.

TTLs: transação OIDC 10 minutos, authorization code 60 segundos, access/id
token 5 minutos, sessão SSO 12 horas absolutas e 30 minutos ociosa, refresh
family 30 dias, verificação de e-mail 24 horas e reset 30 minutos.

O provedor é deliberadamente restrito aos fluxos necessários; implicit e
password grant não existem. Clientes e redirects são allowlists persistidas.

### Fluxos humanos

Uma tela server-rendered em `/login` oferece e-mail/CPF e senha, cadastro,
recuperação e somente conectores ativos. Erros não revelam se a conta existe.
Textos são selecionados por `lang`/`Accept-Language` entre `pt-BR`, `es` e
`en`. A interface usa tokens da PARTSAGRICOLA, contraste, foco visível, alvos
adequados, labels reais, estados de erro/carregamento e layout de 320 px até
desktop, com claro/escuro e movimento reduzido.

E-mails usam SMTP configurado por ambiente. Em teste, um transportador em
memória expõe a mensagem apenas ao harness, nunca em produção.

Conectores sociais usam endpoints configurados e um adaptador HTTP testável.
O mock Google existe somente quando `NODE_ENV=test` e prova o callback sem
credencial externa; produção falha fechada quando uma variável exigida falta.

Uma identidade social nova cria conta somente quando o provedor entrega e-mail
verificado e nome. Se faltarem dados, um registro provisório expira em 10
minutos e o segundo passo os coleta antes de criar `app_user`. Se o e-mail já
pertence a outra conta, o callback nunca vincula automaticamente: o usuário
deve autenticar a conta existente e iniciar uma ação explícita de vinculação.
E-mail não verificado pelo provedor exige a verificação normal da plataforma.

### Consumo pelos aplicativos

`packages/shared` fornece validação de bearer/session claims, exigência de
papel global e exigência de empresa ativa. Os três Next.js recebem middleware
finos usando o mesmo contrato e redirecionam sessão ausente ao `/authorize`
com PKCE iniciado pelo cliente. Nenhum middleware confia em dados de cookie
não assinados.

## Segurança e erros

- Chaves Ed25519 e AES são obrigatórias em produção e têm validação fail-fast.
- Estado OIDC, nonce, PKCE, redirect URI e client ID são vinculados à transação.
- CPF e e-mail são normalizados e únicos sem aparecer em logs.
- Login, reset e verificação respondem genericamente para evitar enumeração.
- Cookies e respostas sensíveis usam `Cache-Control: no-store`.
- Segredos e tokens nunca aparecem em URLs, logs, Settings ou evidências.
- SQL usa parâmetros; HTML escapa todos os valores dinâmicos.
- Sessões possuem expiração absoluta e o logout invalida todas as superfícies.
- Atribuir `ADMIN`/`FINANCE` sem TOTP é permitido para administração segura do
  cadastro, mas `/authorize` exige enrollment e confirmação de um código antes
  de emitir credenciais. Depois do enrollment, TOTP ou código de recuperação de
  uso único satisfaz o segundo fator.

## Critérios de aceite verificáveis

1. Migration limpa e reaplicação passam, sem segredos persistidos.
2. Cadastro por e-mail cria Argon2id, envia verificação e permite login após a
   confirmação; e-mail ou CPF autenticam a mesma conta.
3. Reset invalida o token após um uso e encerra sessões anteriores.
4. Apenas conectores ativos aparecem; Google mock cria/autentica conta; os
   quatro conectores falham fechados sem credencial de ambiente.
5. Authorization Code + PKCE S256 atende web, seller, admin e mobile; redirect
   fora da allowlist, verifier errado e code reutilizado falham.
6. Refresh rotaciona; reutilização de token consumido revoga toda a família.
7. SSO permite iniciar autorização para web e seller sem nova senha.
8. Logout global invalida sessão, access/refresh relacionados e as superfícies.
9. Claims contêm papéis globais e `seller_ids` somente de memberships ativos;
   guardas compartilhados negam papel/empresa ausente.
10. TOTP funciona opcionalmente e bloqueia ADMIN/FINANCE sem segundo fator.
11. Login, cadastro e recuperação renderizam em `pt-BR`, `es` e `en`, sem
    overflow em mobile/desktop e com navegação por teclado.
12. E2E cobre cadastro por e-mail, Google mock, SSO web/seller e logout global.
13. Format, lint, typecheck e testes passam localmente; build, Playwright e
    capturas desktop/mobile rodam somente no GitHub Actions.

## Fora do escopo

- deploy ou publicação em produção;
- credenciais reais dos provedores;
- biometria, passkeys, SAML ou password grant;
- autorização de recursos de negócio além dos guardas de papel/empresa;
- mudança do modelo `company` para “seller” ou integração com Odoo.

## Evidências de entrega

O módulo produzirá documentação operacional, contrato de variáveis, inventário
da migration, resultados dos testes de segurança, screenshots do login em
desktop/mobile e links do único commit, PR e GitHub Actions. Nenhum commit ou
push será feito antes de o módulo completo e essas evidências existirem.
