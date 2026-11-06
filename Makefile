.PHONY: help dev node-native-deps nuxt-prepare nuxt-cleanup build clean clean-all watch watch-frontend stop-watch preview lint lint-fix lint-docs typecheck audit openspec-validate test test\:coverage test\:e2e test\:e2e\:sync test\:a11y test\:all test\:go docker-ready test\:go\:integration test\:go\:pg test\:go\:fuzz gen\:go\:api gen\:sync\:types mr pr quality docs docs-build catalog-import ldap-users-export verify go\:fmt go\:vet lint\:go
.PHONY: db-init db-seed
.DEFAULT_GOAL := help
WATCH_PID_FILE := .watch.pid
HOST ?= localhost
PORT ?= 3000
UV := uv

# Help styling
HELP_TITLE      := Available commands:
HELP_USAGE      := Usage: make <target>
HELP_COL_WIDTH  := 22

COLOR_TITLE := \033[1;36m
COLOR_TARGET := \033[1;32m
COLOR_DIM := \033[2m
COLOR_RESET := \033[0m

dev: ## Bootstrap dev environment (Node deps + Python docs deps + Go tools)
	which pnpm &> /dev/null || npm install -g pnpm@10
	pnpm install
	$(MAKE) node-native-deps
	# Lifecycle scripts may be disabled, so explicitly generate and verify the
	# Nuxt artifacts instead of relying on postinstall.
	$(MAKE) nuxt-prepare
	brew install uv
	$(UV) sync --directory site --quiet
	which golangci-lint &> /dev/null || brew install golangci-lint
	which sqlc &> /dev/null || go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
	npx playwright install chromium
	@printf "\n$(COLOR_TITLE)✔ Environment bootstrapped$(COLOR_RESET)\n"
	@echo "  Run 'make watch' to start the full dev stack (PostgreSQL + Go API + Nuxt)"
	@echo "  Run 'make watch-backend' to start only the backend dev stack (PostgreSQL + Go API)"
	@echo "  Run 'make docs'  to serve the documentation site"
	@echo ""

node-native-deps: ## Verify and repair trusted native Node bindings
	@node -e 'const Database = require("better-sqlite3"); const db = new Database(":memory:"); db.close()' >/dev/null 2>&1 || pnpm rebuild better-sqlite3
	@node -e 'const Database = require("better-sqlite3"); const db = new Database(":memory:"); db.close()'

nuxt-prepare: ## Generate the complete Nuxt development artifacts
	pnpm exec nuxt prepare
	test -f .nuxt/eslint.config.mjs
	test -f .nuxt/tsconfig.json

nuxt-cleanup: ## Remove stale Nuxt and Vite development artifacts
	pnpm exec nuxt cleanup

build: ## Build binary under bin/
	pnpm run build

clean: ## Clean build artifacts (.nuxt, .output, dist); avoids too many files open bug etc
	rm -rf .nuxt .output dist

clean-all: clean ## Clean everything including node_modules (run make dev after)
	rm -rf node_modules

db-init: ## Create peaky DB user + database in the running postgres container (idempotent)
	@echo "[db-init] Creating peaky user and database..."
	-docker compose exec -T postgres psql -h /tmp -U postgres -c "CREATE USER peaky WITH PASSWORD 'peaky';" 2>/dev/null
	-docker compose exec -T postgres psql -h /tmp -U postgres -c "CREATE DATABASE peaky OWNER peaky;" 2>/dev/null
	-docker compose exec -T postgres psql -h /tmp -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE peaky TO peaky;" 2>/dev/null
	@echo "[db-init] Done (errors above are safe if user/db already exist)"

db-seed: ## Insert idempotent demo data via the peaky-ctl image
	docker compose --profile tools run --rm ctl seed

_db-allow-host:
	@HOST_IP=$$(docker compose exec -T postgres bash -c 'getent hosts host.docker.internal | cut -d" " -f1'); \
	if [ -z "$$HOST_IP" ] || ! echo "$$HOST_IP" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$$'; then \
	  echo "[db-allow-host] WARNING: could not resolve host.docker.internal (got '$$HOST_IP') — skipping"; \
	  exit 0; \
	fi; \
	SUBNET=$$(echo "$$HOST_IP" | sed 's/\.[0-9]*$$/.0\/24/'); \
	if docker compose exec -T postgres cat /var/lib/postgresql/conf/pg_hba.conf | grep -q "$$SUBNET"; then \
	  echo "[db-allow-host] Rule for $$SUBNET already present"; \
	else \
	  docker compose exec -T postgres bash -c "echo \"host all all $$SUBNET scram-sha-256\" >> /var/lib/postgresql/conf/pg_hba.conf && pg_ctl reload -D /var/lib/postgresql/data"; \
	  echo "[db-allow-host] Added pg_hba rule for $$SUBNET"; \
	fi

_backend-up:
	docker compose up -d --build postgres
	docker compose build api sse ctl
	@echo "[backend] Waiting for PostgreSQL to be healthy..."
	@i=0; while [ $$i -lt 30 ]; do \
	  docker compose ps postgres | grep -q "(healthy)" && break; \
	  sleep 2; i=$$((i + 1)); \
	done; \
	docker compose ps postgres | grep -q "(healthy)" || { echo "[backend] ERROR: PostgreSQL not healthy after 60s"; exit 1; }
	$(MAKE) db-init
	docker compose --profile tools run --rm ctl migrate
	$(MAKE) db-seed
	$(MAKE) _db-allow-host
	docker compose up -d api sse
	@echo "[backend] Waiting for Go API to be healthy..."
	@i=0; while [ $$i -lt 30 ]; do \
	  docker compose ps api | grep -q "(healthy)" && break; \
	  sleep 2; i=$$((i + 1)); \
	done; \
	docker compose ps api | grep -q "(healthy)" || { echo "[backend] ERROR: Go API not healthy after 60s"; exit 1; }

watch: _backend-up nuxt-cleanup ## Hot-reload full stack; override frontend port with PORT=3003
	./scripts/watch.sh "$(WATCH_PID_FILE)" "$(PORT)" "$(HOST)"

watch-frontend: nuxt-cleanup ## Hot-reload Nuxt only; override port with PORT=3003
	pnpm exec nuxt dev --host "$(HOST)" --port "$(PORT)"

stop-watch: ## Stop the local dev stack without removing database data
	./scripts/stop-watch.sh "$(WATCH_PID_FILE)" "$(CURDIR)"

watch-backend: _backend-up ## Backend only (postgres + api + sse — no Nuxt)
	@echo "[watch-backend] Ready. API=localhost:3001 SSE=localhost:3002 PG=localhost:5432"
	@echo "[watch-backend] Press Ctrl+C to stop."
	trap 'echo "[watch-backend] Stopping Docker services..."; ./scripts/stop-watch-services.sh' EXIT; \
	  while true; do sleep 1; done

preview: build ## Preview production build
	pnpm run preview

lint: nuxt-prepare ## Run oxlint then ESLint (catches more issues)
	pnpm run lint

lint-fix: nuxt-prepare ## Run oxlint and ESLint with auto-fix
	pnpm run lint:fix

lint-docs: ## Lint markdown documentation (site/docs/)
	@pnpm exec rumdl check site/docs/ || echo "⚠ Markdown lint issues found (non-blocking)"

lint-docs-fix: ## Auto-fix formatting issues (site/docs/)
	@pnpm exec rumdl fmt site/docs/

changelog: ## Generate developer changelog from git history
	$(UV) run --project site git-cliff -o site/docs/development/changelog.md
	@echo "[changelog] Written to site/docs/development/changelog.md"

typecheck: nuxt-prepare ## Run TypeScript type checking (nuxt typecheck)
	pnpm run typecheck

audit: ## Check dependencies for known vulnerabilities
	@pnpm audit --prod 2>&1 || true

openspec-validate: ## Strictly validate OpenSpec structure and stable traceability IDs
	pnpm exec openspec validate --all --strict --no-interactive
	pnpm openspec:ids

test: ## Run unit tests (fast)
	pnpm run test:run $(TEST_ARGS)

test\:coverage: ## Run unit tests with coverage report
	pnpm run test:coverage

test\:integration: ## Run selected Node integration tests
	pnpm run test:integration

test\:e2e: ## Run functional e2e tests (excludes a11y)
	pnpm run test:e2e

test\:e2e\:sync: ## Run gated sync-stack e2e (requires `make watch`: API + SSE + Postgres)
	@echo "  Extra args: EXTRA_ARGS='--headed' for browser windows, '--reporter=list' for step-by-step output"
	pnpm run test:e2e:sync -- $(EXTRA_ARGS)

test\:a11y: ## Run accessibility tests
	pnpm run test:a11y

go\:fmt: ## Format Go source files (gofmt -w)
	cd services && gofmt -w .

go\:vet: ## Run go vet on all Go packages
	cd services && go vet ./...

lint\:go: ## Run golangci-lint on all Go packages (install: brew install golangci-lint)
	cd services && golangci-lint run ./...

gen\:sqlc: ## Regenerate Go query code from services/internal/syncengine/repo/queries.sql (requires sqlc)
	cd services && sqlc generate

migrate\:new: ## Scaffold a new goose migration (usage: make migrate:new NAME=add_foo_column)
	@[ -n "$(NAME)" ] || { echo "Usage: make migrate:new NAME=add_foo_column"; exit 1; }
	@NEXT=$$(ls services/internal/dbmigrate/migrations/*.sql 2>/dev/null | wc -l | tr -d ' '); \
	NEXT=$$((NEXT + 1)); \
	FILE=services/internal/dbmigrate/migrations/$$(printf "%03d" $$NEXT)_$(NAME).sql; \
	printf "-- +goose Up\n\n\n-- +goose Down\n\n" > $$FILE; \
	echo "[migrate:new] Created $$FILE"; \
	echo "  Next: write the SQL, then update services/schema.sql to match"; \
	echo "  If any queried column changed: also edit queries.sql (pre-commit runs sqlc automatically)"

test\:go: ## Run Go tests (unit + in-memory integration — no Docker required)
	cd services && go test ./...

docker-ready: ## Verify the Docker CLI and daemon are available
	@command -v docker >/dev/null 2>&1 || { echo "[docker-ready] Docker CLI is not installed or not on PATH" >&2; exit 1; }
	@docker info >/dev/null 2>&1 || { echo "[docker-ready] Docker daemon is unavailable; start Docker and retry" >&2; exit 1; }

test\:go\:integration: docker-ready ## Run Go tests that hit real Postgres (requires Docker)
	docker compose up -d postgres
	@echo "[test:go:integration] Waiting for PostgreSQL..."
	@until docker compose ps postgres | grep -q "healthy"; do sleep 2; done
	$(MAKE) db-init
	docker compose --profile tools run --rm ctl migrate
	$(MAKE) db-seed
	cd services && PG_DSN="*************************************/peaky?sslmode=disable" \
		go test -tags integration ./...

PG_TEST_IMAGE ?= acr-main.is.adyen.com/containers/postgres17-o9-ci
test\:go\:pg: docker-ready ## Run PostgreSQL integration tests via testcontainers (no Docker Compose needed)
	cd services && PEAKY_TEST_PG_IMAGE="$(PG_TEST_IMAGE)" TESTCONTAINERS_RYUK_DISABLED=true \
		go test -tags integration -v -count=1 -timeout 120s ./internal/syncengine/repo/... ./internal/dbmigrate/...

test\:go\:fuzz: ## Run Go fuzz tests for HLC module (30s per target)
	cd services && go test -fuzz=FuzzParseWire -fuzztime=30s ./internal/syncengine/conflict/
	cd services && go test -fuzz=FuzzCompareWire -fuzztime=30s ./internal/syncengine/conflict/
	cd services && go test -fuzz=FuzzWinsOver -fuzztime=30s ./internal/syncengine/conflict/
	cd services && go test -fuzz=FuzzGenerate -fuzztime=30s ./internal/syncengine/conflict/

test\:all: test test\:integration test\:e2e test\:a11y test\:go ## Run all tests (unit + integration + e2e + a11y + Go)

quality: openspec-validate lint lint-docs typecheck audit test go\:fmt lint\:go test\:go ## All quality gates: OpenSpec → TS lint → docs → typecheck → audit → unit → Go fmt/lint/tests → integration
	pnpm run test:integration

mr: quality ## Pre-merge request: full quality gate (TS + Go)
	@printf "\n$(COLOR_TITLE)✔ All quality gates passed — ready to submit MR$(COLOR_RESET)\n\n"

pr: mr ## Alias for 'mr' (GitHub PRs or GitLab MRs)

docs: ## Serve documentation site (Zensical)
	cd site && $(UV) run zensical serve

docs-build: ## Build documentation site for deployment
	cd site && $(UV) run zensical build

catalog-import: ## Import Launchpad catalog snapshot into checked-in JSON
	pnpm run catalog:import

ldap-users-export: ## Export directory users from LDAP into checked-in JSON
	pnpm run ldap:users:export

## Formal verification (FizzBee)
# Specs are run by the `fizz` wrapper (brew install fizzbee), which parses .fizz into
# a JSON AST and hands it to the model checker. `fizz` — not `fizzbee` — reads .fizz:
# the bare `fizzbee` binary accepts the parsed JSON only.
# Override to test another build:
#   make verify FIZZ=/path/to/fizzbee-vX.Y.Z-macos_arm/fizz
FIZZ ?= fizz
FIZZBEE_OUT ?= $(CURDIR)/.fizzbee-out
FIZZBEE_SPECS := $(shell find formal_verification -name '*.fizz' -type f | sort)
FIZZBEE_TARGETS := $(patsubst formal_verification/%.fizz,verify/%,$(FIZZBEE_SPECS))

# NOTE: the verify/% targets must NOT be .PHONY — make skips pattern-rule lookup for
# phony targets, so declaring them silently turns every spec run into a no-op.
.PHONY: verify-tool verify-mbt

verify: $(FIZZBEE_TARGETS) ## Run all FizzBee formal verification specs (requires the fizz CLI)
	$(if $(FIZZBEE_SPECS),,$(error No .fizz specs found in formal_verification/ — run from the repo root))
	@echo "[verify] All $(words $(FIZZBEE_SPECS)) specs passed."

verify-tool:
	@command -v $(FIZZ) >/dev/null 2>&1 || { \
		echo "[verify] '$(FIZZ)' not found on PATH."; \
		echo "[verify] FizzBee needs the 'fizz' wrapper (parser + model checker):"; \
		echo "[verify]   brew install fizzbee"; \
		echo "[verify] Or point at another build: make verify FIZZ=<dir>/fizz"; \
		exit 1; }

# `fizz` exits 0 even when an invariant is violated, so the PASSED line is the gate.
verify/%: verify-tool ## Run a single FizzBee spec by path, e.g. make verify/sync/outbox_item_lifecycle
	@echo "[verify] Running formal_verification/$*.fizz"
	@out=$$($(FIZZ) --output-dir "$(FIZZBEE_OUT)/$*" formal_verification/$*.fizz 2>&1) || { printf '%s\n' "$$out"; exit 1; }; \
		printf '%s\n' "$$out" | grep -q '^PASSED' || { printf '%s\n' "$$out"; echo "[verify] FAILED: formal_verification/$*.fizz"; exit 1; }

## Model-based testing (FizzBee MBT)
# Replays traces generated from the checker's state space against the real
# implementation, which is the only mechanism that can detect spec-vs-code
# drift — `verify` never reads the code.
# Requires `brew install fizzbee-mbt` (the runner and the state server).
MBT_SERVER ?= fizzbee-mbt-server
MBT_SPEC ?= resilience/aimd_concurrency_controller
MBT_ADAPTER_DIR ?= formal_verification/mbt/$(notdir $(MBT_SPEC))
MBT_READY_MARKER ?= server listening on
MBT_READY_TIMEOUT ?= 150

verify-mbt: verify/$(MBT_SPEC) ## Drive the implementation through a spec's state space (needs fizzbee-mbt)
	@command -v $(MBT_SERVER) >/dev/null 2>&1 || { \
		echo "[mbt] '$(MBT_SERVER)' not found on PATH."; \
		echo "[mbt]   brew install fizzbee-mbt"; \
		exit 1; }
	@echo "[mbt] Serving states from $(FIZZBEE_OUT)/$(MBT_SPEC)"
	@$(MBT_SERVER) --states_file "$(FIZZBEE_OUT)/$(MBT_SPEC)" > "$(FIZZBEE_OUT)/mbt-server.log" 2>&1 & \
		server_pid=$$!; \
		trap 'kill $$server_pid 2>/dev/null' EXIT INT TERM; \
		waited=0; \
		until grep -q '$(MBT_READY_MARKER)' "$(FIZZBEE_OUT)/mbt-server.log" 2>/dev/null; do \
			kill -0 $$server_pid 2>/dev/null || { echo "[mbt] server exited before becoming ready:"; cat "$(FIZZBEE_OUT)/mbt-server.log"; exit 1; }; \
			waited=$$((waited + 1)); \
			if [ $$waited -ge $(MBT_READY_TIMEOUT) ]; then \
				echo "[mbt] server not ready after $$(($(MBT_READY_TIMEOUT) / 5))s:"; \
				cat "$(FIZZBEE_OUT)/mbt-server.log"; exit 1; fi; \
			sleep 0.2; \
		done; \
		pnpm exec tsx $(MBT_ADAPTER_DIR)/$(notdir $(MBT_SPEC))_test.ts; \
		status=$$?; \
		kill $$server_pid 2>/dev/null; \
		if [ $$status -ne 0 ]; then echo "[mbt] FAILED — server log: $(FIZZBEE_OUT)/mbt-server.log"; fi; \
		exit $$status

help: ## Show this help
	@printf "\n$(COLOR_TITLE)%s$(COLOR_RESET)\n\n" "$(HELP_TITLE)"
	@sed 's/\\:/COLON_PLACEHOLDER/g' $(MAKEFILE_LIST) | awk 'BEGIN { \
			FS=":.*##[[:space:]]*"; \
			TARGET_COLOR="$(COLOR_TARGET)"; \
			RESET="$(COLOR_RESET)"; \
			WIDTH=$(HELP_COL_WIDTH); \
		} \
		/^[A-Za-z0-9_.-]+.*:.*##[[:space:]]*/ { \
			target = $$1; \
			gsub(/COLON_PLACEHOLDER/, ":", target); \
			printf "  " TARGET_COLOR "%-*s" RESET " %s\n", WIDTH, target, $$2 \
		}'
	@printf "\n$(COLOR_DIM)%s$(COLOR_RESET)\n\n" "$(HELP_USAGE)"
