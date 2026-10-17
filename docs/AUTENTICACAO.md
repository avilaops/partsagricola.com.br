# Autenticação centralizada

`apps/auth` é o provedor OIDC da PARTSAGRICOLA. Web, seller, admin e mobile usam Authorization Code com PKCE S256; implicit e password grant não são aceitos.

## Configuração

Copie `apps/auth/.env.example` e configure PostgreSQL, issuer, JWK privada Ed25519, chaves AES/HMAC de 32 bytes e SMTP. Segredos dos conectores Google, Facebook, Apple e Microsoft ficam somente no ambiente; o banco guarda nomes de variáveis e endpoints. Um conector só aparece quando está ativo no banco e ambas as variáveis existem.

Clientes locais: `partsagricola-web` (3000), `partsagricola-seller` (3001), `partsagricola-admin` (3002) e `partsagricola-mobile` (URI customizada). Redirects são allowlist exata.

## Segurança e duração

- código: 60 s; transação: 10 min; access/id token: 5 min;
- SSO: 12 h absoluto e 30 min ocioso; refresh: 30 dias com rotação;
- verificação: 24 h; reset: 30 min;
- replay de refresh revoga toda a família; logout global revoga sessões e a introspecção invalida JWT imediatamente;
- CPF opcional vira HMAC normalizado; senhas usam Argon2id;
- ADMIN e FINANCE exigem TOTP ou recovery code de uso único;
- e-mail social já existente exige vínculo autenticado explícito; nunca há auto-link.

## Operação

Execute migrations e seed antes de iniciar o auth. Não reutilize chaves entre ambientes. Para rotação de signing key, publique primeiro a nova chave no JWKS, mantenha a anterior pelo TTL máximo e só então remova-a. SMTP e conectores falham fechados. Logs possuem redaction para cookies, Authorization, senhas e tokens.

Não existe Odoo, checkout, carrinho ou pagamento neste módulo.
