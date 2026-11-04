# RULES — Development conventions

English · [中文](RULES.zh-CN.md) · [Русский](RULES.ru.md)

> Read this before writing code. The rules reflect this project's constraints: dependency-free Node scripts, one stdio protocol, files on disk as state,
> and a cost for every real-device send. If a rule blocks the work, change this file before making an exception.

## 1. Language and structure

- Node ≥ 22, ESM, `.mjs` extension. No TypeScript and no build step.
- Zero runtime dependencies. Before adding a dependency, record a reason in decisions.md. No test framework either: use `node --test`.
- Place files according to the layer table in AGENTS.md: protocol in `lib/appserver.mjs`, `lib/session.mjs`, `lib/providers.mjs`, `lib/offpeak-provider.mjs`, `lib/scrub.mjs`;
  workflow in `lib/config.mjs`, `lib/credentials.mjs`, `lib/offpeak.mjs`, `lib/offpeak-check.mjs`, `lib/offpeak-send.mjs`, `lib/offpeak-run.mjs`, `lib/registry.mjs`, `lib/tiers.mjs`, `lib/models.mjs`, `lib/runs.mjs`, `lib/queue.mjs`, `lib/run.mjs`, `lib/intent.mjs`, `lib/tool-summary.mjs`, `lib/snapshot.mjs`;
  gate in `lib/gate.mjs`, `lib/pending.mjs`, `lib/review/`; shell in `bin/`, `lib/cli/`, `skills/`, `templates/`.
  Only `lib/errors.mjs` (`ExecutorError`) is shared across layers. Decide a new file's layer before creating it.
- Dependencies only point downward: shell → workflow → protocol. Workflow invokes the gate, which depends only on the protocol layer. The protocol layer knows nothing of
  `runs/`, the registry, or exit codes. Exception: the shell may use gate-layer **pure functions** (`readPending`, `optionClass`, `questionResponse`) directly,
  so CLI and runner share matching rules without forwarding calls through workflow.
- One responsibility per file. When a file exceeds five hundred lines, consider splitting it before adding more.
- Lowercase hyphenated filenames; camelCase identifiers; UPPER_SNAKE constants. Use a class only when state must be held (the protocol client is one example).

## 2. Terminology

- Code, output, and docs use the terms in [CONTEXT.md](CONTEXT.md): session, task file, send, turn, permission request,
  question, gate, hard rule, review (model review), pending, tier, thoughtLevel.
- Do not introduce judge, verdict (the result of model review is a review result), run (the session directory name `runs/` is historical; do not
  create a Run concept in code), or prompt (use send for dispatch and promptText for prompt text).
- Human-facing output is Chinese; identifiers, event types, and JSON field names are English.

## 3. Code style

- Two-space indentation, single quotes, semicolons. No fixed line-width limit: one idea per line, without horizontal scrolling. Do not add a formatter; run `node --check` before committing.
- Prefer `export function`; no statements with side effects at module top level (file reads, process launches).
- No `default export`.
- Use one error type, `ExecutorError`, carrying `exitCode`. Error messages are Chinese and explain what to do, for example:
  “会话不在登记簿里，用 `zcode-executor list` 看有哪些” (the session is not in the registry; use `zcode-executor list` to see available sessions). Avoid stack-trace-style fragments.
- Do not swallow errors. Rethrow any caught error you do not handle; when ignoring one is intentional, add a one-line explanation of why it is safe.
- Record JSON-RPC error details from `error.data.details`; `message` is only a short summary and insufficient for diagnosis.
- Use `async` / `await` throughout; do not mix in `.then`. Waiting for subprocesses or files must have a timeout.

## 4. Comments

- Begin each file with a paragraph stating its responsibility, what it explicitly does not handle, and what it interacts with.
- Inline comments explain why, not what. Do not comment what the code already makes clear.
- Cite the source and date for real-device facts: `// verified.md 2026-09-07：未答的反向请求每秒重发一次` (unanswered reverse requests are resent every second).
- Code copied from elsewhere must state source, version, and license at the top and be recorded in `NOTICE`. Mark changed parts with `// 改：…` (“changed”).
- Mark deliberate simplifications with `// 权宜：<现在的上限>，<什么时候要升级成什么>` (workaround: current limit; when and how to upgrade), for example
  `// 权宜：无信号不兜底，真机挂死过一次再加超时` (no fallback without a signal; add a timeout once a real-device hang has occurred). A simplification without a stated limit is not a workaround; it is insufficiently thought through.
- No TODOs. Record future work in `docs/PLAN.md` (local record) or the deferred items in decisions.md.

## 5. Output and exit codes

- stdout contains only results: a human-readable summary, or one JSON object per line with `--json`. Progress, warnings, and `--stream` go to stderr.
- All output goes through `process.stdout` / `process.stderr` (including `console.*`). The entry point wraps these streams to replace terminal control characters with literal `\uXXXX` (`lib/cli/terminal.mjs`):
  tool names, reasons, model replies, and filenames are all executor-controlled text. Do not bypass the wrappers by writing file descriptors directly (`fs.writeSync(1, …)` or children using `stdio: 'inherit'`).
- Each stderr message occupies one line, prefixed by command or phase: `new: cwd 不是 worktree，照常建` (cwd is not a worktree; create as usual).
- `--json` structures may gain fields, but never lose fields or change their meanings. Reflect any change in PRD section 4.
- Exit codes are fixed at 0 / 1 / 2 / 3 / 4 / 5; see PRD for meanings. Assign new cases to existing codes, never add codes.

## 6. Disk state

- Resolve the data directory from configuration once; all paths are absolute.
- Write JSON to a temporary file in the same directory, then `rename`, to avoid partial reads. Temporary names need a random component and exclusive creation (`wx`): a predictable name can be preoccupied by a symlink.
  Use `writeJsonAtomic` / `writeFileAtomic` from `lib/config.mjs`, not hand-built temporary names (gate-layer `pending.json` has an equivalent implementation because it cannot import workflow).
- Files written by this tool are 0600; `runs/` and its subdirectories are 0700 (`PRIVATE_FILE_MODE`, `PRIVATE_DIR_MODE`, and `ensureRunsDir` in `lib/runs.mjs`). Do not tighten permissions on the data root: it also contains the default worktree root.
  This protects against other local users; the executor and runner share a user, so protection from the executor belongs to the gate (§8).
- `events.jsonl` is append-only, one object per line; this project's own event `type` begins with `executor.`.
- All timestamps are ISO 8601 UTC strings.
- Do not track `runs/` or `worktrees/`; tests create temporary directories with `mkdtemp` and remove them in `after()`.
- Read `~/.zcode/v2/config.json` without writing it. An apiKey read from it is written only to a 0600 temporary personal provider file created under mkdtemp
  (decisions D14), deleted when the subprocess ends, never stored in `runs/`, logs, or output.
- `~/.zcode/v2/credentials.json` is also read-only. Decrypt only the four keys required for account coding plans; off-peak sends additionally decrypt `zcodejwttoken` (D20, memory and JSON-RPC parameters only, never persisted). Neither read nor decrypt other keys.
  Decrypted keys receive the same treatment as config.json's apiKey (decisions D19).

## 7. Protocol layer

- Every request has a timeout; on timeout, report failure and identify the method.
- Deduplicate reverse requests by `params.requestId`; without requestId, use method + full parameters (retries have identical parameters; different parameters mean separate requests).
  Cache completed responses only until a turn boundary; clear them at the start of `Session.send`: if the peer reuses requestId, an allow from the previous turn must not authorize the new request. Respond to reverse requests with no handler using `-32601` and one stderr line;
  never leave them unanswered (the peer resends every second). **Exception**: permission requests and questions are owned by the session layer; with no handler, deliberately leave them unanswered so the turn pauses (pending).
  Retain only the most recent 5 envelope ids for each such request and reply only to these (real-device approval after 75 seconds pending proved sufficient).
- Persist unknown event types unchanged, without error.
- Permission responses have shape `{decision:'allow'|'deny'}` (verified.md, approvals). Before allowing, verify that options contains an entry of `kind` `allow_once`; otherwise refer to a human.
- Forward all child stderr to this process's stderr with the `zcode:` prefix.
- Do not pass the host agent's credential environment variables to the zcode child (`HOST_CREDENTIAL_ENV` in `lib/appserver.mjs`), whether inherited from the process or supplied in the caller's `env`.
  Add new names to that table; do not replace it with an allowlist, where omitting something like `HOME` or `PATH` breaks functionality.

## 8. Security floor (not bypassable in code)

- Model review has only allow and ask outcomes. No code path sends deny to zcode except explicit human `deny` and `cancel` commands.
- `approve` allows only when options contains `allow_once`, and only for that operation. Do not implement “always allow”. Use `hasAllowOnce` from `lib/pending.mjs`
  for gate approval, pending persistence, and `approve`; do not implement three separate checks.
- The runner accepts an `answer.json` response only if its requestId matches the current pending request; discard mismatches. A previous answer must not allow a new request.
- Check allowed roots once at `new` and again against the registry's cwd when the runner starts.
- Never print API keys, tokens, or similar strings. Persistence is allowed in only two places: D14's 0600 temporary personal provider file, and the explicitly user-configured `review.jev.apiKey` in `~/.zcode-executor/config.json` (D15; a file containing a key must be a regular non-symlink file owned by the current uid, with permissions no broader than 0600). `doctor` reports only whether a key is configured, never the key.
- Hard rules are code constants, not configuration. The two mechanical rules (outside-worktree and self-protection) live in `lib/review/hard.mjs`: new checks must fail toward human review; anything undecidable matches. Never turn an ask path into automatic allow or automatic deny.
- Do not collapse paths lexically before resolving boundaries: `path.resolve`, `path.normalize`, and `fs.realpathSync` (whose JS implementation starts with `path.resolve`) collapse `link/..`,
  whereas the kernel enters the link target before moving up a level. Use the segment-by-segment resolver in `hard.mjs`.
- An executor touching this tool's data directory or invoking its CLI is mechanically referred to a human (`lib/review/self-guard.mjs`). Match only explicit forms; do not broaden interception: worktrees live under the data directory by default, so broad matching creates a flood of false positives (decisions D23).
- Model review reads intent only from the task snapshot recorded at queue time (`runs/<id>/tasks/`), never from the original in the worktree, which the executor can edit.
- Processes the runner itself launches in the worktree (git for review probes) bypass the gate; disable on the command line every repository configuration switch that could execute programs (`GIT_SAFE_OPTIONS` and `filterOverrides` in `lib/review/evidence.mjs`).

## 9. Tests

- One case per external behavior; name the behavior, not the implementation: “cwd outside allowed roots exits with code 2”.
- Assert exit codes, stdout JSON, and persisted files / mock record files. Do not assert internal function call counts.
- Run only against `test/mock-appserver.mjs` and `test/mock-offpeak.mjs` (off-peak service). `npm test` never touches real devices or spends quota.
- Real-device scripts belong in `scripts/`, with `real-` in their names. Before running, paid scripts print “这次会花额度” (“this run will spend quota”) and require `--yes`.
- Cases starting background processes must SIGKILL all of them in `after()`, including descendants; the mock exits itself on stdin EOF.
- Keep test scenario JSON next to the case; do not create a fixtures directory.
- When changing protocol behavior, update the mock before the client so it remains a replica of real-device behavior; document the real-device fact behind scenario fields.

## 10. Commits

- One task takes one or a few commits; each commit must independently pass `npm test`.
- Commit messages are Chinese. The subject is `<范围>: <做了什么>` (scope: change), with a layer or command as scope: `协议: 反向请求按 requestId 去重` (protocol: deduplicate reverse requests by requestId),
  `send: --wait 超时改为发 session/stop` (send: issue session/stop on --wait timeout). The body explains why instead of repeating the diff.
- Do not commit `runs/`, `worktrees/`, logs, or temporary directories.
- Develop directly on the main branch; tasks dispatched to the executor use `task/T-<编号>` branches and merge after acceptance (`<编号>` means task number).

## 11. Documentation

- For behavior changes, update [PRD.md](PRD.md) or [SPEC.md](SPEC.md) before code.
- Record new real-device findings in [verified.md](verified.md), with date and version.
- Record tradeoffs in [decisions.md](decisions.md): the decision, why, and when to reopen it.
- Add new terms to [CONTEXT.md](CONTEXT.md) before using them.
- Update `NOTICE` when copying code.
- Mark completed tasks in `docs/PLAN.md`; at a phase boundary, record checkpoint results in the corresponding handoff. Both are local records, not tracked in this repository.
