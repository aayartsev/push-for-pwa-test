#!/usr/bin/env bash
# Локальный (без Docker) bootstrap: venv, зависимости, каталог БД.
# Usage: ./setup-dev.sh [--drop] [--start]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
VENV_DIR="${BACKEND_DIR}/.venv"
DATA_DIR="${ROOT_DIR}/data"
DB_PATH="${DATA_DIR}/app.db"
ENV_FILE="${ROOT_DIR}/.env"
ENV_EXAMPLE="${ROOT_DIR}/.env.example"

DROP=0
START=0

usage() {
  cat <<'EOF'
Usage: ./setup-dev.sh [--drop] [--start]

  (без флагов)  Создаёт venv (если нет), ставит зависимости, готовит data/
  --drop        Удаляет .venv и SQLite-базу, затем настраивает заново
  --start       После настройки запускает uvicorn
  -h, --help    Справка
EOF
}

for arg in "$@"; do
  case "${arg}" in
    --drop) DROP=1 ;;
    --start) START=1 ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Неизвестный аргумент: ${arg}" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if ! command -v python3 >/dev/null 2>&1; then
  echo "Нужен python3 (пакет python3 / python3-venv)." >&2
  exit 1
fi

if [[ "${DROP}" -eq 1 ]]; then
  echo "→ --drop: сбрасываем окружение и базу"
  rm -rf "${VENV_DIR}"
  rm -f "${DB_PATH}" "${DB_PATH}-wal" "${DB_PATH}-shm" "${DB_PATH}-journal"
  find "${BACKEND_DIR}" -type d -name '__pycache__' -prune -exec rm -rf {} + 2>/dev/null || true
  find "${BACKEND_DIR}" -type d -name '.pytest_cache' -prune -exec rm -rf {} + 2>/dev/null || true
fi

mkdir -p "${DATA_DIR}"

if [[ ! -f "${ENV_FILE}" && -f "${ENV_EXAMPLE}" ]]; then
  cp "${ENV_EXAMPLE}" "${ENV_FILE}"
  echo "→ Создан .env из .env.example"
fi

if [[ ! -d "${VENV_DIR}" ]]; then
  echo "→ Создаём venv в backend/.venv ..."
  python3 -m venv "${VENV_DIR}"
else
  echo "→ venv уже есть, пропускаем создание"
fi

# shellcheck disable=SC1091
source "${VENV_DIR}/bin/activate"

echo "→ Устанавливаем зависимости ..."
python -m pip install --upgrade pip >/dev/null
python -m pip install -r "${BACKEND_DIR}/requirements.txt"

echo
echo "Готово."
echo "  venv: ${VENV_DIR}"
echo "  db:   ${DB_PATH}"
echo
echo "Запуск:"
echo "  source backend/.venv/bin/activate"
echo "  cd backend"
echo "  export DATABASE_PATH=../data/app.db FRONTEND_DIR=../frontend"
echo "  uvicorn app.main:app --reload --reload-dir app --port 8000"
echo
echo "Или: ./setup-dev.sh --start"

if [[ "${START}" -eq 1 ]]; then
  echo
  echo "→ Запускаем uvicorn на http://127.0.0.1:8000 ..."
  cd "${BACKEND_DIR}"
  export DATABASE_PATH="${DB_PATH}"
  export FRONTEND_DIR="${ROOT_DIR}/frontend"
  exec uvicorn app.main:app --reload --reload-dir app --port 8000
fi
