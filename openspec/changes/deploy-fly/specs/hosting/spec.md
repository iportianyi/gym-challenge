# Spec Delta

## Purpose

Keeps the game playable without the developer's laptop: the hosted app answers over HTTPS at its Fly.io address,
accepts only the game bot's logins, keeps its games across deploys, and never ships a secret in the repository or
the build context.

## ADDED Requirements

### Requirement: The hosted game answers over HTTPS
The hosted app SHALL answer at `https://gym-challenge.fly.dev` with the same API and web app as the local run.
A plain-HTTP request SHALL be redirected to the same path over HTTPS. A stopped Machine SHALL be started by the
request and answer it.

#### Scenario: Health over HTTPS
- **WHEN** a client sends `GET https://gym-challenge.fly.dev/api/health`
- **THEN** the response status is `200`
- **AND** the body parsed as JSON equals `{"status": "ok"}`

#### Scenario: Plain HTTP is redirected
- **WHEN** a client sends `GET http://gym-challenge.fly.dev/api/health` without following redirects
- **THEN** the response status is one of `301`, `302`, `307`, `308`
- **AND** the `Location` header equals `https://gym-challenge.fly.dev/api/health`

#### Scenario: Web app at the root
- **WHEN** a client sends `GET https://gym-challenge.fly.dev/` with header `Accept: text/html`
- **THEN** the response status is `200`
- **AND** the body contains `<div id="root">`

#### Scenario: Idle Machine wakes up
- **WHEN** the app's only Machine is in state `stopped` and a client sends
  `GET https://gym-challenge.fly.dev/api/health`
- **THEN** the response status is `200`
- **AND** afterwards the Machine is in state `started`

### Requirement: The hosted game trusts only the game bot
The hosted app SHALL check logins with the token of `gym_challenge_iport_bot` and SHALL name that bot in invite
links. A login signed with any other token — the development bot's or the non-secret `local-dev-token` — SHALL be
refused like any invalid login.

#### Scenario: Development login refused
- **WHEN** a client sends `GET https://gym-challenge.fly.dev/api/me` with header `Authorization: tma <initData>`,
  where `<initData>` is produced by `node scripts/dev-login-link.mjs --id 1001 --name Іван` (signed with
  `local-dev-token`)
- **THEN** the response status is `401`

#### Scenario: Invite names the game bot
- **WHEN** a player opens the app from `gym_challenge_iport_bot` in Telegram, starts a game with
  `Запросити за посиланням` and taps `Копіювати посилання`
- **THEN** the copied link starts with `https://t.me/gym_challenge_iport_bot?startapp=`

#### Scenario: Opened from the game bot
- **WHEN** a person taps `Open` in the profile of `gym_challenge_iport_bot` in Telegram on a phone
- **THEN** the app shows the heading `Як тебе звати?` on the first visit or `Мої ігри` afterwards
- **AND** it does not show `Відкрий Gym Challenge у Telegram`

### Requirement: Games survive a deploy and a restart
The hosted app SHALL keep its database on a persistent volume, so that every player, game and round stays after a
new deploy and after the Machine is stopped and started again.

#### Scenario: Game still there after a deploy
- **WHEN** a player has created a game in the hosted app from Telegram and a new version is deployed
- **THEN** after the deploy the same player sees that game under `Мої ігри` with the same score

#### Scenario: Game still there after a stop
- **WHEN** a player has created a game, the Machine is stopped and then started by the next request
- **THEN** the player sees that game under `Мої ігри` with the same score

### Requirement: No secret in the repository or the build context
The game bot's token SHALL exist only in the host's secret store. No tracked file — `fly.toml` included — SHALL
contain a bot token, and the build context sent to the image builder SHALL NOT include any `.env*` file.

#### Scenario: fly.toml names no token
- **WHEN** `fly.toml` is read
- **THEN** it does not contain the text `TELEGRAM_BOT_TOKEN`
- **AND** its `[env]` table has `TELEGRAM_BOT_USERNAME` equal to `gym_challenge_iport_bot`

#### Scenario: .env stays out of the build context
- **WHEN** an image is built from the repository root while it holds the human's `.env`, using the repository's
  `.dockerignore` and a Dockerfile that copies the whole context and lists the file names in its root
- **THEN** no listed name starts with `.env`

#### Scenario: Token set as a secret
- **WHEN** `fly secrets list` is run for the app
- **THEN** the list has a secret named `TELEGRAM_BOT_TOKEN`
