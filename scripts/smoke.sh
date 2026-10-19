#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
printf 'ClipForge — verificações locais\n'
npm run typecheck
npm test
if test -x .venv/bin/python; then
  .venv/bin/python -m unittest discover -s tests -p '*_test.py'
else
  printf 'PENDENTE: ambiente Python. Execute make setup.\n'
  exit 1
fi
ffmpeg -version >/dev/null
ffprobe -version >/dev/null
printf 'Contratos e ambiente: OK\n'
if curl --fail --silent http://127.0.0.1:3000/api/health; then
  printf '\nAPI local: OK\n'
else
  printf '\nAPI não está iniciada; execute make dev.\n'
fi
printf 'Pipeline com IA real e benchmark de 20 min exigem um provedor LLM e transcritor configurados. Não executados por este script.\n'
