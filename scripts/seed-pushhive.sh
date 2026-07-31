#!/usr/bin/env bash
# Создаёт admin и site в PushHive, печатает API key.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if [[ ! -f .env ]]; then
  echo "Нет .env — сначала запустите ./scripts/setup-pushhive.sh" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

echo "→ Seed admin ..."
docker compose exec -T pushhive node seed.js \
  "${ADMIN_EMAIL:-admin@example.com}" \
  "${ADMIN_PASSWORD:-changeme}" \
  "${ADMIN_NAME:-Admin}"

SITE_NAME="${PUSHHIVE_SITE_NAME:-PWA Messenger}"
SITE_DOMAIN="${PUSHHIVE_SITE_DOMAIN:-localhost:8000}"

echo "→ Создаём site «${SITE_NAME}» ..."
API_KEY="$(docker compose exec -T pushhive node /scripts/create-site.js \
  "${SITE_NAME}" \
  "${SITE_DOMAIN}")"

# create-site.js prints only the api key on the last line when successful
API_KEY="$(printf '%s\n' "${API_KEY}" | tail -n 1 | tr -d '\r')"

if [[ -z "${API_KEY}" || "${API_KEY}" != ph_* ]]; then
  echo "Не удалось получить API key. Вывод: ${API_KEY}" >&2
  exit 1
fi

tmp="$(mktemp)"
if grep -q '^PUSHHIVE_API_KEY=' .env; then
  awk -v v="${API_KEY}" '
    BEGIN { FS=OFS="=" }
    $1=="PUSHHIVE_API_KEY" { print $1"="v; next }
    { print }
  ' .env > "${tmp}"
  mv "${tmp}" .env
else
  printf 'PUSHHIVE_API_KEY=%s\n' "${API_KEY}" >> .env
fi

echo "✓ Site API key сохранён в .env как PUSHHIVE_API_KEY"
echo "  ${API_KEY}"
echo "→ Перезапустите app: docker compose up -d app"
