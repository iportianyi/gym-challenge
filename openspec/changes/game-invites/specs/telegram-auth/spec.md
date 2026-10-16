# Spec Delta

## MODIFIED Requirements

### Requirement: The server needs a bot token to start
The server SHALL read the bot token from the environment variable `TELEGRAM_BOT_TOKEN` and the bot's username, used in
invite links, from `TELEGRAM_BOT_USERNAME`, and SHALL refuse to start when either is unset or empty, naming the
variable in the error. The token SHALL NOT be sent in any response.

#### Scenario: Token missing
- **WHEN** the app is started with `TELEGRAM_BOT_TOKEN` unset
- **THEN** startup fails with an error whose message contains `TELEGRAM_BOT_TOKEN`

#### Scenario: Username missing
- **WHEN** the app is started with a token and `TELEGRAM_BOT_USERNAME` unset
- **THEN** startup fails with an error whose message contains `TELEGRAM_BOT_USERNAME`

#### Scenario: Health check does not need a login
- **WHEN** the server runs with a token and a client sends `GET /api/health` without the `Authorization` header
- **THEN** the response status is `200`
