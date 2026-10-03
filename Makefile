# One command to verify the tree: `make check`. Backend and frontend tools run in Docker (profile "check",
# sources bind-mounted); the OpenSpec spec gate runs on the host. Stops at the first failing step.
SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail -c

# Check containers run as the host user, so nothing they write is owned by root.
export UID := $(shell id -u)
export GID := $(shell id -g)

COMPOSE := docker compose --profile check
BACKEND := $(COMPOSE) run --rm --no-deps backend-check
FRONTEND := $(COMPOSE) run --rm --no-deps frontend-check

.PHONY: check check-build check-backend check-frontend check-spec check-secrets

check: check-build check-backend check-frontend check-spec check-secrets
	@echo "check: OK (backend, frontend, spec, secrets)"

check-build:
	@echo "==> build check images"
	@$(COMPOSE) build --quiet backend-check frontend-check

check-backend:
	@echo "==> backend: ruff check"
	@$(BACKEND) ruff check .
	@echo "==> backend: ruff format --check"
	@$(BACKEND) ruff format --check .
	@echo "==> backend: ty check"
	@$(BACKEND) ty check
	@echo "==> backend: pytest"
	@$(BACKEND) pytest

# Tools are called directly from /app/node_modules/.bin, not via `pnpm run`: pnpm 11 checks the install state
# before running a script and, finding no ./node_modules in the bind mount, installs into the working tree.
# Commands mirror the scripts in frontend/package.json — keep them in sync.
check-frontend:
	@echo "==> frontend: lint"
	@$(FRONTEND) eslint .
	@echo "==> frontend: typecheck"
	@$(FRONTEND) tsc --noEmit -p tsconfig.json
	@echo "==> frontend: test"
	@$(FRONTEND) vitest run

check-spec:
	@echo "==> spec: pnpm spec:check"
	@pnpm --silent spec:check

# The pre-push secret gate must itself work: real pushes into a temp repo (blocked with a fake key, allowed without).
check-secrets:
	@echo "==> secrets: pre-push gate self-test"
	@node scripts/secret-scan.mjs --self-test | tail -1
	@test "$$(git config core.hooksPath)" = ".githooks" || { echo "pre-push gate not active: run pnpm githooks:install"; exit 1; }
