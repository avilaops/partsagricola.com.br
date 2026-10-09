#!/bin/sh
# Deploy do storefront: build local -> artefatos pro VPS -> restart.
#
# O build é local de propósito (rodar npm no servidor compartilhado já causou
# susto de memória), e precisa alcançar o Postgres do VPS: as páginas SSG
# (produtos, categorias, aplicações) leem a camada catalogo_odoo no build.
# O script abre um túnel SSH próprio e o fecha ao final.
#
#   ./scripts/deploy-storefront.sh            # build + deploy + smoke test
#   ./scripts/deploy-storefront.sh --so-build # para, depois do build
#
# Pré-requisitos (uma vez): storefront/.env.production.local com
# MEDUSA_BACKEND_URL sem uso, NEXT_PUBLIC_BASE_URL=https://partsagricola.com.br
# e LEITURA_DSN apontando para 127.0.0.1:15432 (a porta do túnel).
set -e

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
FRONT="$RAIZ/storefront"
CHAVE="$HOME/.ssh/hetzner_avilaops"
VPS=root@178.105.82.48
PORTA_TUNEL=15432

cd "$FRONT"

if ! grep -q "^LEITURA_DSN=.*127.0.0.1:$PORTA_TUNEL" .env.production.local 2>/dev/null; then
  echo "ERRO: .env.production.local sem LEITURA_DSN no túnel (127.0.0.1:$PORTA_TUNEL)." >&2
  exit 1
fi

# Túnel + build, juntos: o túnel só existe para o build (as páginas SSG leem o
# Postgres do VPS) e só abre na hora de construir.
#
# Sem -f/ControlMaster: o OpenSSH do Windows não tem mux — o túnel roda em
# background do shell e morre no trap. Se a porta já estiver ocupada por um
# túnel anterior, este ssh falha sozinho e o build usa o que já existe.
tunel_e_build() {
  echo "== túnel para o Postgres do VPS"
  ssh -i "$CHAVE" -N -L "$PORTA_TUNEL:127.0.0.1:5432" "$VPS" &
  TUNEL=$!
  trap 'kill $TUNEL 2>/dev/null || true' EXIT
  sleep 3

  echo "== build"
  npm run build
}

# Modo interno: é este script rodando por dentro do build-pesado (abaixo).
if [ "$1" = "--tunel-e-build" ]; then
  tunel_e_build
  exit 0
fi

# No servidor dos agentes (4 GB de RAM) o build passa pelo build-pesado: um
# build pesado por vez, com teto de heap no Node. O que roda sob a trava é o
# túnel + build inteiro, para o túnel não ficar aberto enquanto o script
# espera a vez (até 30 min): sem a trava, nenhuma conexão com o VPS. Onde o
# build-pesado não existe, o comando é o de sempre.
if command -v build-pesado >/dev/null 2>&1; then
  build-pesado sh "$RAIZ/scripts/deploy-storefront.sh" --tunel-e-build
else
  tunel_e_build
fi

# O bug do commit 80496b8: NEXT_PUBLIC_* é compilado no bundle — localhost
# baked no build já derrubou canonicals e sitemaps uma vez.
if grep -rl "localhost:8000" .next/standalone .next/server .next/static 2>/dev/null | head -1 | grep -q .; then
  echo "ERRO: localhost:8000 compilado no bundle — confira o .env.production.local." >&2
  exit 1
fi

if [ "$1" = "--so-build" ]; then
  echo "build ok — parando antes do deploy (--so-build)"
  exit 0
fi

echo "== empacotando"
STAMP=$(date +%Y%m%d%H%M%S)
PACOTE=".deploy/agricola-storefront-$STAMP.tar.gz"
rm -rf .deploy/pack && mkdir -p .deploy/pack
cp -r .next/standalone/. .deploy/pack/
mkdir -p .deploy/pack/.next/static
cp -r .next/static/. .deploy/pack/.next/static/
cp -r public/. .deploy/pack/public/
# nunca embarcar .env: o do servidor é a única fonte de config em produção
rm -f .deploy/pack/.env*
tar -czf "$PACOTE" -C .deploy/pack .
rm -rf .deploy/pack

echo "== enviando e trocando ($STAMP)"
scp -i "$CHAVE" "$PACOTE" "$VPS:/tmp/"
ssh -i "$CHAVE" "$VPS" "
set -e
STAMP=$STAMP
tar -czf /opt/backups/agricola-storefront-pre-\$STAMP.tar.gz -C /opt/agricola-storefront .next server.js package.json public .env
mkdir -p /opt/agricola-storefront-new
tar -xzf /tmp/agricola-storefront-\$STAMP.tar.gz -C /opt/agricola-storefront-new
cp /opt/agricola-storefront/.env /opt/agricola-storefront-new/.env
systemctl stop agricola-storefront
rm -rf /opt/agricola-storefront-old
mv /opt/agricola-storefront /opt/agricola-storefront-old
mv /opt/agricola-storefront-new /opt/agricola-storefront
systemctl start agricola-storefront
sleep 4
systemctl is-active agricola-storefront
rm -f /tmp/agricola-storefront-\$STAMP.tar.gz
# só os 3 backups pré-deploy mais recentes: o disco vive perto de 90%
ls -t /opt/backups/agricola-storefront-pre-*.tar.gz 2>/dev/null | tail -n +4 | xargs -r rm -f
"

echo "== smoke test"
FALHOU=0
for p in /br /br/store /br/categories/retentores /br/medidas /sitemap.xml /sitemaps/products/1; do
  CODIGO=$(ssh -i "$CHAVE" "$VPS" "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3006$p")
  echo "  $p -> $CODIGO"
  [ "$CODIGO" = "200" ] || FALHOU=1
done
if [ "$FALHOU" = "1" ]; then
  echo "SMOKE TEST FALHOU — o build anterior está em /opt/agricola-storefront-old" >&2
  exit 1
fi
echo "deploy ok: https://partsagricola.com.br"
