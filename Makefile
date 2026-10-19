PYTHON ?= python3.12
.PHONY: setup dev test smoke whisper ensure
setup:
	npm install
	$(PYTHON) -m venv .venv
	.venv/bin/python -m pip install -r apps/media-worker/requirements.txt
	npm run catalog
	npm run db:migrate
	$(MAKE) whisper
	@test -f .env || cp .env.example .env
whisper:
	$(PYTHON) -m venv .venv-whisper
	.venv-whisper/bin/python -m pip install -r apps/media-worker/requirements-whisper.txt
ensure:
	@test -d node_modules -a -x .venv/bin/python -a -x .venv-whisper/bin/python || $(MAKE) setup
dev: ensure
	npm run catalog
	npm run dev
test:
	npm run typecheck
	npm test
	.venv/bin/python -m unittest discover -s tests -p '*_test.py'
smoke:
	bash scripts/smoke.sh
