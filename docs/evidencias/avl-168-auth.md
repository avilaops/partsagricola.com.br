# Evidências AVL-168

- PostgreSQL: constraints, cadastro, tokens únicos, sessões, memberships e replay concorrente.
- Unitários: Argon2id, AES-GCM, HMAC de CPF, TOTP/recovery, Ed25519/JWKS, PKCE, i18n e guards.
- Playwright no GitHub Actions: login desktop/mobile, cadastro por e-mail e Google mock.
- Screenshots são publicados pelo job `auth-evidence` no artefato `avl-168-auth-screenshots`; nenhum token ou credencial é capturado.
- Build e Playwright são executados exclusivamente no GitHub Actions.
- `pnpm audit --audit-level high`: sem vulnerabilidade crítica ou alta em runtime; permanece GHSA-vfj7-8cjw-p6xm em `braces`, dependência transitiva exclusiva das ferramentas de lint, para a qual o registry informa não existir versão corrigida.
