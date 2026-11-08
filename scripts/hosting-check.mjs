#!/usr/bin/env node
// Checks the hosted game against the scenarios of the `hosting` spec (deploy-fly). Run by hand after a deploy:
//
//   node scripts/hosting-check.mjs [--base https://gym-challenge.fly.dev]
//
// Prints one line per check and exits 1 if any fails. Not part of `make check`: it depends on the network and on
// what is deployed, not on the code. Scenarios that need flyctl or Telegram are checked by hand (tasks.md).
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { userInitData } from "./telegram-init-data.mjs";

const { values } = parseArgs({
  options: { base: { type: "string", default: "https://gym-challenge.fly.dev" } },
});
const base = values.base.replace(/\/$/, "");
const plain = base.replace(/^https:/, "http:");
const GAME_BOT = "gym_challenge_iport_bot";
// A stopped Machine starts on the first request; give it time.
const TIMEOUT_MS = 30_000;

const get = (url, headers = {}) =>
  fetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });

/** The key = "value" lines of one [table] of fly.toml; enough for the two facts checked here, no TOML parser. */
function tomlTable(text, table) {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.trim() === `[${table}]`);
  if (start === -1) return {};
  const entries = {};
  for (const line of lines.slice(start + 1)) {
    if (/^\s*\[/.test(line)) break;
    const match = /^\s*([A-Za-z0-9_]+)\s*=\s*"([^"]*)"\s*$/.exec(line);
    if (match) entries[match[1]] = match[2];
  }
  return entries;
}

const checks = [
  [
    "health over HTTPS",
    async () => {
      const response = await get(`${base}/api/health`);
      const body = await response.text();
      if (response.status !== 200) return `status ${response.status}`;
      if (JSON.stringify(JSON.parse(body)) !== JSON.stringify({ status: "ok" })) return `body ${body}`;
    },
  ],
  [
    "plain HTTP is redirected",
    async () => {
      const response = await get(`${plain}/api/health`);
      const location = response.headers.get("location");
      if (![301, 302, 307, 308].includes(response.status)) return `status ${response.status}`;
      if (location !== `${base}/api/health`) return `Location ${location}`;
    },
  ],
  [
    "web app at the root",
    async () => {
      const response = await get(`${base}/`, { Accept: "text/html" });
      const body = await response.text();
      if (response.status !== 200) return `status ${response.status}`;
      if (!body.includes('<div id="root">')) return "no <div id=\"root\"> in the page";
    },
  ],
  [
    "development login refused",
    async () => {
      const initData = userInitData({ id: 1001, name: "Іван" });
      const response = await get(`${base}/api/me`, { Authorization: `tma ${initData}` });
      if (response.status !== 401) return `status ${response.status}`;
    },
  ],
  [
    "fly.toml names no token",
    async () => {
      const text = readFileSync(new URL("../fly.toml", import.meta.url), "utf8");
      if (text.includes("TELEGRAM_BOT_TOKEN")) return "fly.toml contains TELEGRAM_BOT_TOKEN";
      const username = tomlTable(text, "env").TELEGRAM_BOT_USERNAME;
      if (username !== GAME_BOT) return `[env] TELEGRAM_BOT_USERNAME is ${username}`;
    },
  ],
];

let failed = 0;
for (const [name, check] of checks) {
  let problem;
  try {
    problem = await check();
  } catch (error) {
    problem = error.cause?.code ?? error.code ?? error.message;
  }
  if (problem) failed += 1;
  console.log(problem ? `FAIL ${name}: ${problem}` : `ok   ${name}`);
}
console.log(failed ? `hosting-check: ${failed} of ${checks.length} failed (${base})` : `hosting-check: OK (${base})`);
process.exit(failed ? 1 : 0);
