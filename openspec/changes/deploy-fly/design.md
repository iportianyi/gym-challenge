# Design

## Context

The `runtime` stage of the root `Dockerfile` already is the production image: `fastapi run --port 8000`, the built
frontend served by FastAPI, a non-root user `app`, and `/app/data` owned by `app` for the SQLite file. The app reads
`DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` and `FRONTEND_DIST` from the environment, refuses to
start without the two Telegram values, and runs `alembic upgrade head` in its lifespan — safe because there is one
process. Compose sets `DATABASE_URL=sqlite:////app/data/gym.db` and mounts the `gym-data` volume at `/app/data`.
`.dockerignore` excludes `.git`, `node_modules`, `docs`, `openspec`, `scripts` and `*.db`, but not `.env*`. `flyctl`
is not installed on the host, and the project runs its tools in Docker. See proposal.md (Why) and `docs/spec.md`
("Вирішено", Fly.io) for the hosting decision itself.

## Goals / Non-Goals

**Goals:**
- One `fly deploy` from the repository root gives a running game at `https://gym-challenge.fly.dev`.
- Everything about the app's shape on Fly is in the committed `fly.toml`; only the bot token is outside it.
- Every `flyctl` command the human or the agent runs goes through one Compose service.

**Non-Goals:**
- Snapshots beyond Fly's default daily ones, Litestream, a custom domain, CI or GitHub Actions deploys, more than one
  Machine or region, Postgres.

## Decisions

### D1. `fly.toml` in the repository root

```toml
app = "gym-challenge"
primary_region = "<nearest available to Ukraine, chosen at apply>"

[build]
  build-target = "runtime"

[env]
  DATABASE_URL = "sqlite:////app/data/gym.db"
  TELEGRAM_BOT_USERNAME = "gym_challenge_iport_bot"

[[mounts]]
  source = "gym_challenge_data"
  destination = "/app/data"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

  [[http_service.checks]]
    method = "GET"
    path = "/api/health"
    interval = "30s"
    timeout = "5s"
    grace_period = "10s"

[[vm]]
  size = "shared-cpu-1x"
  memory = "256mb"
```

The same `DATABASE_URL` and mount path as Compose, so the image behaves the same in both. `build-target` picks the
`runtime` stage; the Dockerfile is the one Compose builds. `auto_stop_machines = "stop"` with
`min_machines_running = 0` keeps the cost near the Volume's alone between games; the game screen polls every 3 s, so
the Machine stays up while anyone looks at a game. The region is the nearest one to Ukraine that
`fly platform regions` lists at apply time (Warsaw, then Frankfurt), because Fly's region list changes; it is recorded
in tasks.md. The app name is unique across Fly: `gym-challenge` first; if `fly apps create` says it is taken, the human's
fallback is `gym-challenge-iport`, and the address in the spec, `fly.toml`, the docs and the check script changes
with it in a separate commit that says why.

Alternatives: `fly launch` generating the file — it also tries to create resources and rewrite config; written by
hand, the file is reviewed like any other change. `release_command` for migrations — it runs in a temporary Machine
without the Volume, which for SQLite would migrate the wrong file; the lifespan migration already runs on the Volume.

### D2. The bot token only in `fly secrets`, set by the human

The human runs `fly secrets import` through the Compose service and pastes `TELEGRAM_BOT_TOKEN=<token>` on stdin,
so the token is in no file, no shell history and no command the agent runs. The agent only checks
`fly secrets list` (names and digests, no values). `TELEGRAM_BOT_USERNAME` is not a secret and stays in `[env]`.

### D3. `.env*` out of the build context

Add `.env*` to `.dockerignore`. `fly deploy` sends the build context to Fly's remote builder; without the line, the
development bot token and the ngrok token in `.env` would leave the laptop, even though no stage copies them. The
local build loses nothing: no stage reads `.env`, Compose passes its values as environment variables.

### D4. Writing to the Volume as `app`

A Fly Volume is formatted and mounted by Fly's init; the image's `chown app /app/data` does not apply to it. The
first deploy shows whether `app` can write there (`fly ssh console -C "ls -ld /app/data"` and the health check:
the app migrates the database at startup, so it does not start if it cannot write). If it cannot, the `runtime`
stage gets a short entrypoint that runs as root, `chown`s `/app/data` and starts the server as `app` with `setpriv`
(present in the base image), recorded as an implementation note. Running the whole server as root is the rejected
alternative.

### D5. `flyctl` as a Compose service

```yaml
  fly:
    profiles: [deploy]
    image: flyio/flyctl:<pinned version>
    working_dir: /app
    environment:
      HOME: /fly-home
    volumes:
      - .:/app
      - fly-home:/fly-home
```

Used as `docker compose --profile deploy run --rm fly <command>`; the image's entrypoint is `flyctl`. The login of
`fly auth login` stays in the named volume `fly-home`: not on the host, not in the repository, and deleted with
`docker volume rm`. `fly deploy --remote-only` builds on Fly's builder, so the service needs no Docker socket. The
version is pinned to a release at least two weeks old, like every other image in the repository.

Alternatives: install `flyctl` on the host — the human chose Docker; a `FLY_API_TOKEN` in `.env` — one more
long-lived secret on disk for no gain on a single laptop.

### D6. Checking the scenarios

The hosting scenarios run against the live app, not in `make check`: `curl` for health, the redirect, the web page
and the refused development login (`dev-login-link.mjs` output as the `Authorization` header);
`fly machine list` / `fly machine stop` for the idle and restart scenarios; a throwaway Dockerfile on stdin with the
repository context for the `.env` scenario (names only, nothing read). Scenarios in Telegram (open, invite, the game
after a deploy) are the human's, on the phone, recorded in tasks.md.

## Risks / Trade-offs

- [A host failure loses up to a day of rounds] → accepted in `docs/spec.md`; Fly keeps daily Volume snapshots.
- [The first request after idle waits for the Machine to start] → a few seconds once per session; accepted for the
  cost. `min_machines_running = 1` is the fix if it bothers the players.
- [`flyctl` in Docker cannot open a browser for login] → it prints the URL; the human opens it on the host.
- [Billing] → the human creates the app and the Volume themselves in task order; the agent runs no command that
  creates billed resources.

## Migration Plan

First deploy: create app → create Volume → import the secret → deploy → set the Main Mini App URL in @BotFather.
Rollback: `fly deploy --image <previous image>` (listed by `fly releases --image`) when the release added no
migration; after a migration the old code may not read the new schema, so the rollback is to restore the Volume from
its last snapshot and redeploy the previous image. Removing the hosting: `fly apps destroy`.

## Implementation notes

- Region `fra`: the `fly platform regions` list of 2026-11-08 has no Warsaw (D1's first choice).
- D4's entrypoint was not needed: Fly mounted `gym_challenge_data` at `/app/data` owned by `app`, and the app
  created and migrated `gym.db` there on the first start (task 3.5).
- `flyctl` v0.4.122 runs as root in its container (the image sets no user); it writes nothing to the working tree
  in the commands used here, so the service keeps the image's user rather than mapping the host's (whose UID could
  not write the root-owned `fly-home` volume).
- The first health check after a cold start can fail once: the Machine answers about 2–3 s after boot and
  `grace_period` is 10 s, yet one failure was logged a second before `Application startup complete`. It passed
  from the next check on; left as is, since `auto_start_machines` holds the request until the app answers (the
  wake-up took 4.7 s in task 3.7).
