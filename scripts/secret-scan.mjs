#!/usr/bin/env node
// Secret gate for `git push`. Scans only the ADDED lines of the commits about to be pushed and exits 1 on a hit,
// which makes git abort the push. Wired as .githooks/pre-push (activate once: `pnpm githooks:install`).
//
// Patterns describe real credentials, not their names: the first scan (autonomy log, row 34) matched the TEXT of
// its own pattern recorded in .agent-log and, being chained with `;`, could not stop the push anyway.
//
// Usage:
//   node scripts/secret-scan.mjs --pre-push <remote> <url>   (git passes refs on stdin)
//   node scripts/secret-scan.mjs --range <rev-range>          (e.g. origin/main..HEAD)
//   node scripts/secret-scan.mjs --self-test                  (real pushes in a temp repo; no agent needed)
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PATTERNS = [
  ["Context7 API key", /ctx7sk-[0-9a-f]{8}-[0-9a-f-]{20,}/],
  ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["GitHub token", /\b(?:ghp|gho|ghs|ghu|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/],
  ["AWS access key id", /\bAKIA[0-9A-Z]{16}\b/],
  ["Anthropic API key", /\bsk-ant-[A-Za-z0-9_-]{32,}\b/],
];

const ZERO = /^0+$/;
const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

/** Added lines of the given commits as [{ commit, file, line }]. */
function addedLines(revListArgs, cwd) {
  const commits = git(["rev-list", ...revListArgs], cwd).split("\n").filter(Boolean);
  const out = [];
  for (const commit of commits) {
    let file = "?";
    for (const line of git(["show", "--format=", "--unified=0", "--no-color", commit], cwd).split("\n")) {
      if (line.startsWith("+++ ")) file = line.slice(4).replace(/^b\//, "");
      else if (line.startsWith("+")) out.push({ commit: commit.slice(0, 7), file, line: line.slice(1) });
    }
  }
  return out;
}

export function scan(lines) {
  const hits = [];
  for (const l of lines) for (const [name, re] of PATTERNS) if (re.test(l.line)) hits.push({ ...l, name });
  return hits;
}

function report(hits, what) {
  if (hits.length === 0) {
    console.log(`secret-scan: ok — ${what}`);
    return 0;
  }
  console.error(`secret-scan: BLOCKED — ${hits.length} possible secret(s) in ${what}:`);
  // Never echo the value itself: name, commit and file are enough to find it.
  for (const h of hits) console.error(`  ${h.commit}  ${h.file}  ${h.name}`);
  console.error("Remove the secret from the commits (and rotate it if it is real) before pushing.");
  return 1;
}

function prePush(cwd) {
  const stdin = readFileSync(0, "utf8");
  const lines = [];
  let refs = 0;
  for (const row of stdin.split("\n").filter(Boolean)) {
    const [, localSha, , remoteSha] = row.split(" ");
    if (ZERO.test(localSha)) continue; // deleting a remote branch pushes no content
    refs++;
    const range = ZERO.test(remoteSha) ? [localSha, "--not", "--remotes"] : [`${remoteSha}..${localSha}`];
    lines.push(...addedLines(range, cwd));
  }
  return report(scan(lines), `${refs} ref(s), ${lines.length} added line(s)`);
}

function selfTest() {
  const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const tmp = mkdtempSync(join(tmpdir(), "secret-scan-selftest-"));
  const remote = join(tmp, "remote.git");
  const work = join(tmp, "work");
  let failed = 0;
  const check = (name, ok, extra = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
    if (!ok) failed++;
  };
  try {
    git(["init", "-q", "--bare", remote], tmp);
    git(["init", "-q", "-b", "main", work], tmp);
    for (const [k, v] of [["user.email", "selftest@example.invalid"], ["user.name", "selftest"], ["core.hooksPath", ".githooks"]])
      git(["config", k, v], work);
    mkdirSync(join(work, "scripts"), { recursive: true });
    mkdirSync(join(work, ".githooks"), { recursive: true });
    cpSync(join(here, "scripts", "secret-scan.mjs"), join(work, "scripts", "secret-scan.mjs"));
    cpSync(join(here, ".githooks", "pre-push"), join(work, ".githooks", "pre-push"));
    chmodSync(join(work, ".githooks", "pre-push"), 0o755);
    git(["remote", "add", "origin", remote], work);
    const commit = (file, text, msg) => {
      writeFileSync(join(work, file), text);
      git(["add", "-A"], work);
      git(["commit", "-q", "-m", msg], work);
    };
    const push = () => spawnSync("git", ["push", "-q", "origin", "main"], { cwd: work, encoding: "utf8" });

    commit("README.md", "clean\n", "clean");
    let r = push();
    check("clean commit is pushed", r.status === 0, r.stderr.trim());

    // The scanner's own pattern text, as recorded in .agent-log — must NOT block (row 34 false positive).
    commit("log.jsonl", `{"cmd":"grep -E 'ctx7sk-|BEGIN (RSA|OPENSSH) PRIVATE|AKIA[0-9A-Z]{16}'"}\n`, "pattern text");
    r = push();
    check("pattern text is not a secret", r.status === 0, r.stderr.trim());

    // Fake credentials are assembled at runtime so that no secret-shaped string is ever committed to this repo.
    const fakeKey = ["ctx7sk", "-", "0123abcd", "-", "4567-89ab-cdef-0123456789ab"].join("");
    commit("settings.json", `{"env":{"CONTEXT7_API_KEY":"${fakeKey}"}}\n`, "leak");
    r = push();
    check("Context7-shaped key blocks the push", r.status !== 0 && /BLOCKED/.test(r.stderr), r.stderr.split("\n")[0]);
    check("blocked output does not echo the key", !r.stderr.includes(fakeKey));
    const remoteHead = git(["rev-parse", "main"], remote).trim();
    const localHead = git(["rev-parse", "HEAD"], work).trim();
    check("remote did not receive the leaking commit", remoteHead !== localHead);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  console.log(failed ? `\n${failed} check(s) failed` : "\nall secret-scan checks passed");
  return failed ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [mode, arg] = process.argv.slice(2);
  if (mode === "--pre-push") process.exit(prePush(process.cwd()));
  else if (mode === "--range" && arg) process.exit(report(scan(addedLines([arg], process.cwd())), arg));
  else if (mode === "--self-test") process.exit(selfTest());
  else {
    console.error("usage: secret-scan.mjs --pre-push <remote> <url> | --range <rev-range> | --self-test");
    process.exit(2);
  }
}
