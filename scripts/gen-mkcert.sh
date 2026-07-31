#!/usr/bin/env bash
# Генерирует доверенные локальные сертификаты через mkcert для LAN-тестов.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="${ROOT_DIR}/local-certs"
HOSTS=("pwa.lan" "push.lan" "localhost")

if ! command -v mkcert >/dev/null 2>&1; then
  echo "Нужен mkcert: https://github.com/FiloSottile/mkcert" >&2
  echo "Пример: sudo apt install mkcert || brew install mkcert" >&2
  exit 1
fi

mkdir -p "${CERT_DIR}"
echo "→ Устанавливаем локальный CA mkcert (может запросить sudo) ..."
mkcert -install

cd "${CERT_DIR}"
for host in "${HOSTS[@]}"; do
  echo "→ Сертификат для ${host}"
  mkcert -cert-file "${host}.pem" -key-file "${host}-key.pem" "${host}"
done

echo
echo "Готово. Файлы в ${CERT_DIR}"
echo "На телефоне/других ПК установите корневой CA mkcert:"
echo "  $(mkcert -CAROOT)/rootCA.pem"
echo
echo "Пропишите в /etc/hosts (или DNS роутера) IP этой машины:"
echo "  <LAN-IP>  pwa.lan push.lan"
echo
echo "Запуск:"
echo "  export PUBLIC_APP_URL=https://pwa.lan"
echo "  export PUSHHIVE_URL=https://push.lan"
echo "  docker compose -f docker-compose.yml -f docker-compose.https.yml up --build -d"
