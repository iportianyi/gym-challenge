# syntax=docker/dockerfile:1

# ---------- frontend: dependencies (also the image for frontend checks) ----------
FROM node:24-slim AS frontend-deps
# pnpm via npm, not corepack: older corepack fails signature checks ("Cannot find matching keyid").
RUN npm install -g pnpm@11.17.0
# Dependencies live in /app/node_modules, one level above the source. Check containers bind-mount ./frontend at
# /app/frontend; module resolution walks up and finds /app/node_modules, so the mount never hides them.
WORKDIR /app
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
ENV PATH=/app/node_modules/.bin:$PATH
WORKDIR /app/frontend

# ---------- backend: dependencies incl. dev tools (also the image for backend checks) ----------
FROM ghcr.io/astral-sh/uv:0.12.22-python3.13-trixie-slim AS backend-deps
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    VIRTUAL_ENV=/opt/venv \
    PATH=/opt/venv/bin:$PATH
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-install-project
