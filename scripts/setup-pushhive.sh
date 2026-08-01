#!/usr/bin/env bash
# Клонирует PushHive, генерирует VAPID-ключи и дополняет .env.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR_DIR="${ROOT_DIR}/vendor/pushhive"
ENV_FILE="${ROOT_DIR}/.env"
ENV_EXAMPLE="${ROOT_DIR}/.env.example"
REPO_URL="${PUSHHIVE_REPO_URL:-https://github.com/dhirendralive9/pushhive.git}"

mkdir -p "${ROOT_DIR}/vendor"

if [[ ! -d "${VENDOR_DIR}/.git" ]]; then
  echo "→ Клонируем PushHive в vendor/pushhive ..."
  git clone --depth 1 "${REPO_URL}" "${VENDOR_DIR}"
else
  echo "→ vendor/pushhive уже есть, пропускаем clone"
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${ENV_EXAMPLE}" "${ENV_FILE}"
  echo "→ Создан .env из .env.example"
fi

set_env_var() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "${ENV_FILE}"; then
    # portable-ish in-place replace
    local tmp
    tmp="$(mktemp)"
    awk -v k="${key}" -v v="${value}" '
      BEGIN { FS=OFS="=" }
      $1==k { print k"="v; next }
      { print }
    ' "${ENV_FILE}" > "${tmp}"
    mv "${tmp}" "${ENV_FILE}"
  else
    printf '%s=%s\n' "${key}" "${value}" >> "${ENV_FILE}"
  fi
}

if ! grep -q '^VAPID_PUBLIC_KEY=.\+' "${ENV_FILE}" 2>/dev/null; then
  echo "→ Генерируем VAPID-ключи ..."
  KEYS="$(docker run --rm node:20-alpine sh -c 'npm install web-push --silent >/dev/null && npx web-push generate-vapid-keys --json')"
  PUBLIC_KEY="$(printf '%s' "${KEYS}" | sed -n 's/.*"publicKey":"\([^"]*\)".*/\1/p')"
  PRIVATE_KEY="$(printf '%s' "${KEYS}" | sed -n 's/.*"privateKey":"\([^"]*\)".*/\1/p')"
  if [[ -z "${PUBLIC_KEY}" || -z "${PRIVATE_KEY}" ]]; then
    echo "Не удалось разобрать VAPID-ключи. Вывод: ${KEYS}" >&2
    exit 1
  fi
  set_env_var "VAPID_PUBLIC_KEY" "${PUBLIC_KEY}"
  set_env_var "VAPID_PRIVATE_KEY" "${PRIVATE_KEY}"
else
  echo "→ VAPID-ключи уже заданы в .env"
fi

if ! grep -q '^SESSION_SECRET=.\+' "${ENV_FILE}" || grep -q '^SESSION_SECRET=$' "${ENV_FILE}" || grep -q 'SESSION_SECRET=CHANGE_ME' "${ENV_FILE}"; then
  set_env_var "SESSION_SECRET" "$(openssl rand -hex 32)"
fi

set_env_var "VAPID_EMAIL" "${VAPID_EMAIL:-admin@example.com}"
set_env_var "ADMIN_EMAIL" "${ADMIN_EMAIL:-admin@example.com}"
set_env_var "ADMIN_PASSWORD" "${ADMIN_PASSWORD:-changeme}"
set_env_var "ADMIN_NAME" "${ADMIN_NAME:-Admin}"
set_env_var "PUSHHIVE_URL" "${PUSHHIVE_URL:-http://localhost:3000}"
set_env_var "PUBLIC_APP_URL" "${PUBLIC_APP_URL:-http://localhost:8000}"

echo
echo "Готово. Дальше:"
echo "  1. docker compose up --build -d"
echo "  2. ./scripts/seed-pushhive.sh"
echo "  3. Скопируйте PUSHHIVE_API_KEY из вывода seed в .env и перезапустите app"
