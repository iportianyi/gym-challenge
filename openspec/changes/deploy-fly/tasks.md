# Tasks

Scope: deployment configuration and docs; no application code unless design D4 needs the entrypoint. Steps marked
**human** are done by the human (account, billing, secrets, Telegram); the agent prepares the command and records the
result. `fly …` below means `docker compose --profile deploy run --rm fly …`.

## 1. Scenario checks first

- [x] 1.1 Write `scripts/hosting-check.mjs`: one check per agent-checkable scenario of the `hosting` spec — health over
  HTTPS, the plain-HTTP redirect, the web app at the root, the refused development login (initData from
  `dev-login-link.mjs` logic, signed with `local-dev-token`), and `fly.toml` (no `TELEGRAM_BOT_TOKEN`,
  `[env].TELEGRAM_BOT_USERNAME` = `gym_challenge_iport_bot`); prints one line per check and exits non-zero on any
  failure. Node built-ins only (no new dependency); the initData signing moves from `dev-login-link.mjs` into a module
  both scripts import (the dev link's output unchanged, checked by comparing it before and after for a fixed
  `auth_date`); `--base <url>` overrides the default `https://gym-challenge.fly.dev`; `fly.toml` is read by matching
  lines, no TOML parser. Run by hand after a deploy, not in `make check` — signing in
  `scripts/telegram-init-data.mjs`; `dev-login-link.mjs` output byte-identical before and after for two calls with
  `Date.now` fixed at 1794000000000 (`cmp`: IDENTICAL). Sanity run against the local app (`--base
  http://localhost:8000`, `local-dev-token`): `ok` health and web app, `FAIL` redirect (`status 200`) and development
  login (`status 200`, i.e. the signature is valid where the token matches), as expected locally
- [x] 1.2 Run it now and quote the failing lines (no `fly.toml`, the address does not answer); commit on its own
  (`test: hosting scenario checks for the Fly.io app`) — `FAIL health over HTTPS: ENOTFOUND`, the same `ENOTFOUND`
  for the redirect, the web app and the development login, `FAIL fly.toml names no token: ENOENT`;
  `hosting-check: 5 of 5 failed (https://gym-challenge.fly.dev)`, exit 1
- [ ] 1.3 The `.env` scenario: build a throwaway Dockerfile from stdin (`FROM busybox`, `COPY . /ctx`,
  `RUN ls -a /ctx`) with the repository context and quote whether any name starts with `.env` — expected to fail now

## 2. Repository configuration

- [ ] 2.1 `.dockerignore`: add `.env*` (design D3); rerun 1.3 and quote that no name starts with `.env`
- [ ] 2.2 `docker-compose.yml`: the `fly` service in profile `deploy` and the `fly-home` volume (design D5), image
  `flyio/flyctl` pinned to a release at least two weeks old (version checked on Docker Hub, recorded here); verify
  `docker compose --profile deploy run --rm fly version` prints that version and `docker compose config --quiet`
  passes
- [ ] 2.3 `fly.toml` as in design D1, the region left as a placeholder until 3.2; verify the `fly.toml` checks of
  `hosting-check.mjs` pass
- [ ] 2.4 Commit (`chore(deploy): fly.toml, flyctl in Docker, .env out of the build context`)

## 3. First deploy

- [ ] 3.1 **human** — `fly auth login` (opens a URL to approve in the browser); agent verifies `fly auth whoami`
- [ ] 3.2 Choose the region from `fly platform regions` (nearest to Ukraine: Warsaw, then Frankfurt), write it into
  `fly.toml`, record the choice here
- [ ] 3.3 **human** — `fly apps create gym-challenge` (if taken: `gym-challenge-iport`, and a separate commit
  moves the address in spec, `fly.toml`, docs and `hosting-check.mjs`, design D1) and `fly volumes create gym_challenge_data --region <region> --size 1`
  (billed resources); agent verifies with `fly volumes list`
- [ ] 3.4 **human** — `fly secrets import`, pasting `TELEGRAM_BOT_TOKEN=<token of gym_challenge_iport_bot>` and
  Ctrl-D; agent verifies the name in `fly secrets list` ("Token set as a secret")
- [ ] 3.5 `fly deploy --remote-only`; quote the release line and `fly status`. Check design D4 with
  `fly ssh console -C "ls -ld /app/data"` and the health check; if `app` cannot write, add the entrypoint of D4, record
  it in design.md as an implementation note, and redeploy
- [ ] 3.6 Run `node scripts/hosting-check.mjs` and quote every line passing
- [ ] 3.7 "Idle Machine wakes up": `fly machine stop`, check `fly machine list` shows `stopped`, request
  `/api/health`, quote `200` and the state `started`
- [ ] 3.8 Commit the region and any D4 change (`chore(deploy): first deploy to Fly.io in <region>`)

## 4. Telegram

- [ ] 4.1 **human** — in @BotFather, `gym_challenge_iport_bot` → Bot Settings → Configure Mini App → Enable Mini App
  with `https://gym-challenge.fly.dev` (and Menu Button with the same URL)
- [ ] 4.2 **human** — on the phone: "Opened from the game bot", "Invite names the game bot", create a game, then the
  agent runs `fly deploy --remote-only` again and the human checks "Game still there after a deploy"; then
  `fly machine stop` and "Game still there after a stop". Record each answer here

## 5. Docs and harness

- [ ] 5.1 `docs/fly-deploy.md` in Ukrainian: one-time setup (3.1–3.4, 4.1), every deploy, checks after it
  (`hosting-check.mjs`), rollback (design, Migration Plan), where the token lives; `docs/telegram-dev.md` links to it;
  `docs/spec.md` "Запуск" says the game is hosted and the version note names this change. Verify every command in the
  doc was run in this change as written
- [ ] 5.2 Commit (`docs: deploying the game to Fly.io`)
- [ ] 5.3 Harness, shown as a diff and committed only after the human's yes, on its own: `CLAUDE.md` gets the deploy
  commands, `openspec/config.yaml` context drops "Local run only … no hosting"
  (`chore(harness): deploy commands and hosting context`)

## 6. Review and check

- [ ] 6.1 Run the change-reviewer subagent on a review packet and save its reply verbatim to
  `docs/reviews/deploy-fly.md`
- [ ] 6.2 Run the project check command and quote its summary line
