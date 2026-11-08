# Proposal

## Why

The game only runs on the human's laptop: in Telegram it opens through the ngrok tunnel of the development bot, so
it is gone whenever the laptop sleeps. `docs/spec.md` (v2.1, "Вирішено") already chose the host — Fly.io, one
Machine from the existing Dockerfile, SQLite on a Fly Volume, HTTPS at `*.fly.dev`, a separate game bot — and left
hosting to its own change. The human now has the game bot `gym_challenge_iport_bot` and chose to run `flyctl`
through Docker rather than install it.

## What Changes

- `fly.toml` for one app (`gym-challenge`, address `https://gym-challenge.fly.dev`; if the name is taken on Fly,
  `gym-challenge-iport`, as the human decided): the `runtime` stage
  of the existing Dockerfile, the Volume `gym_challenge_data` mounted where `DATABASE_URL` points, HTTPS forced, the Machine
  stopped when idle and started on request, `GET /api/health` as its health check, and
  `TELEGRAM_BOT_USERNAME=gym_challenge_iport_bot` in `[env]`.
- `TELEGRAM_BOT_TOKEN` of the game bot lives only in `fly secrets`, set by the human; it is never in the repository,
  `fly.toml`, a command line the agent runs, or the build context.
- `.dockerignore` excludes `.env*`: `fly deploy` uploads the build context to Fly's remote builder, and today `.env`
  (development bot and ngrok tokens) would go with it.
- `flyctl` runs from a pinned `flyio/flyctl` image as a Compose service in a `deploy` profile, with its login in a
  named Docker volume, not on the host and not in the repository. **New dependency** (the image), approved in
  principle by the human; the exact version is pinned at apply.
- Migrations keep running at startup (the app already runs `alembic upgrade head` in its lifespan, one process), so
  no `release_command`.
- `docs/fly-deploy.md`: first deploy (login, app, volume, secret, deploy), the Main Mini App of the game bot at the
  Fly address, every later deploy, and what to check after it. `docs/spec.md` and `openspec/config.yaml` stop saying
  "local run only".
- Out of scope, as `docs/spec.md` decided: manual snapshots before each deploy, longer snapshot retention, Litestream,
  a custom domain, CI deploys.

## Capabilities

### New Capabilities

- `hosting`: where the game runs for real play — reachable over HTTPS at its Fly address with the game bot's login,
  keeping its data across deploys, and with no secret in the repository or the build context.

### Modified Capabilities

(none)

## Impact

- New files: `fly.toml`, `docs/fly-deploy.md`, `scripts/hosting-check.mjs` (checks the hosting scenarios against
  the live app, run by hand after a deploy; not part of `make check`). Changed: `.dockerignore`, `docker-compose.yml` (a `fly` service in
  profile `deploy` and a named volume for its login), `docs/spec.md`, `docs/telegram-dev.md` (link to the new doc).
- Harness, in a separate commit after the human's yes: `CLAUDE.md` (deploy commands), `openspec/config.yaml`
  (context says "Local run only … no hosting").
- No application code, API or database change is planned; if the Volume's ownership needs a startup step (design
  D4), it is a small change to the `runtime` image.
- An external, billed service: the Fly.io app, one shared-CPU Machine and a 1 GB Volume (`docs/spec.md` estimates
  ≈ $2.5–4 per month).
