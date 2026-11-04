# PRD — zcode-executor

English · [中文](PRD.zh-CN.md) · [Русский](PRD.ru.md)

> Status: the first version is implemented (2026-09-08); off-peak sends and `quota` shipped in v0.3.5 (2026-10-02, D20), and the watch pane in v0.4.0 (D22). The model-review section has been updated to the target contract following the approved Jev revision plan (`docs/jev-hardening-plan.md`, a local record not committed to the repository); consult the corresponding records for implementation and validation progress. Requirements were aligned on 2026-09-07 (31 questions, resolved over successive rounds).
> Terms follow [CONTEXT.md](CONTEXT.md); see [decisions.md](decisions.md) for the reasoning;
> locally verified facts are in [verified.md](verified.md); for taking over development, see `docs/handoff/handoff-20260908.md` (a local record not committed to the repository).

## 1. The problem to solve

Claude Code specifies a development task, and local ZCode (GLM) makes the code changes. They need a channel
that can send the task as a file, run it in an isolated worktree, let a human or model answer the executor's permission requests,
and finally accept the result using `git diff` and tests rather than the executor's own account.

**User**: the person using the local ZCode desktop App. Single-user, local only; remote access and multitenancy are out of scope.

**Out of scope**: a protocol-translation product, TUI, remote access, code-review tool, general resource scheduling, synchronization with the ZCode App task list, and an MCP shell.

## 2. Form

A Claude Code plugin (the skill and CLI are also available to other coding agents); the repository, plugin, CLI, and skill share the name `zcode-executor`.

| Layer | Files | Responsibility |
| --- | --- | --- |
| Protocol | `lib/appserver.mjs` `lib/session.mjs` `lib/providers.mjs` `lib/offpeak-provider.mjs` `lib/scrub.mjs` | Start `zcode app-server --stdio`; pair JSON-RPC messages, route reverse requests, manage session lifecycle, detect turn completion, manage the provider table, and redact secrets |
| Workflow | `lib/config.mjs` `lib/credentials.mjs` `lib/registry.mjs` `lib/tiers.mjs` `lib/models.mjs` `lib/runs.mjs` `lib/queue.mjs` `lib/run.mjs` `lib/intent.mjs` `lib/offpeak.mjs` `lib/offpeak-check.mjs` `lib/offpeak-send.mjs` `lib/offpeak-run.mjs` `lib/tool-summary.mjs` `lib/snapshot.mjs` | Configuration, credentials, registry, tier assignment, queue and locks, runner lifecycle, persistence in `runs/<id>/`, allowlist, model-review inputs, off-peak sends, current-turn parsing, and session snapshots |
| Gate | `lib/gate.mjs` `lib/pending.mjs` `lib/review/` | Hard rules → model review → pending |
| Shell | `bin/zcode-executor` `lib/cli/` `skills/zcode-executor/` `templates/task.md` `hooks/` `types/` | CLI, skill, task-file template; watch-pane mod and its state type declarations (effective only in Claude Code, D22) |

**Stack**: Node ≥ 22, ESM, plain `.mjs`, zero runtime dependencies, no build step, `node --test`.
The review layer's TypeScript prototype is converted manually to `.mjs` by removing types.
Code taken from zcode-acp retains its Apache-2.0 notice and is recorded in `NOTICE`.

## 3. A complete dispatch

The original command placeholders are retained: `<主仓>` means the main checkout, `<执行副本>` the executor's worktree, `<仓库名>` the repository name, and `<档>` the thought level; `工具` means a tool. The example message `执行 tasks/T-xxx.md` means “execute tasks/T-xxx.md”.

1. Claude writes the task to `tasks/T-xxx.md` (template: `templates/task.md`), with machine-checkable acceptance criteria.
2. Claude runs the two git commands itself to create a worktree under an allowlisted directory:
   `git -C <主仓> worktree add ~/.zcode-executor/worktrees/<仓库名> -b task/T-xxx`; install dependencies on first use.
3. `zcode-executor new --cwd <执行副本> --title T-xxx [--tier fast|strong] [--thought <档>] [--deny "工具 工具"]`
   → Add a registry entry and return a local id (`x_…`). The zcode session is created only on the first send (D13).
4. `zcode-executor send <id> "执行 tasks/T-xxx.md" --task <执行副本>/tasks/T-xxx.md --wait`
   → Wait in the foreground, or remove `--wait` to run in the background and observe with `follow` / `status`. The relative path in the message is for the executor to read;
   `--task` supplies the authorization basis for model review and must be an absolute path.
5. When the executor requests permission during a turn, the gate checks hard rules, then model review; if neither resolves it, the request becomes pending.
   `send --wait` immediately returns exit code 5 and prints the pending contents.
   Claude examines them: relay permission requests to a human using AskUserQuestion, then `approve <id>` or `deny <id>`;
   answer questions with `answer <id> <值>` if it knows the answer (`<值>` means the value), otherwise ask a human. The turn resumes from the pending point.
6. After the turn ends, Claude performs acceptance. The executor does not commit; changes remain in the worktree's working directory, so first
   `git -C <执行副本> add -A` to include new files, then inspect `git -C <执行副本> diff --cached` and run tests in the worktree.
7. If accepted, Claude commits in the worktree and merges from the main checkout with `git -C <主仓> merge`;
   otherwise, unstage with `git -C <执行副本> reset`, write `tasks/T-xxx-fix.md`, and send again to the same session.

## 4. CLI

The command name is `zcode-executor`. Its contract and exit codes follow the author's other dispatch tools, so Claude needs to learn only one convention.

The original command metavariables are retained: `关键字` = keyword, `绝对路径` = absolute path, `档` = thought level, `工具…` = tools, `正文` = message body, `文件` = file, `秒` = seconds, and `值…` = values.

| Command | Purpose |
| --- | --- |
| `doctor [--offpeak] [--json]` | Five self-check steps, all without quota usage: ① find `config/provider/zcode-builtin.json` beside `zcode.cjs` (the 3.12+ criterion; if missing, recommend upgrading ZCode App) → ② report both provider sources (whether the account is signed in through `credentials.json`, and the `config.json` fallback) and the selected provider → ③ perform a real handshake (zero tokens), reporting model tiers and provider-key status → ④ report the review pipeline for a newly started runner (optional Jev pre-screen → ZCode fast screen → slow review; read configuration only, without probing Jev over the network) → ⑤ self-check the off-peak API: this uses the network and starts an off-peak turn with a fake ticket (rejected immediately by the server, zero quota); see “Off-peak sends” below. `--offpeak` runs only ⑤ |
| `quota [--json]` | Today's off-peak ticket usage, with zero quota usage, no app-server, and no ticket acquisition: how many times this tool obtained a ticket today (count acquisition and reacquisition events in `runs/*/events.jsonl` since midnight today in the machine's local time; skip files modified before today entirely; skip unreadable files and report one stderr line; App usage is excluded; roughly 3 times daily is an observation) + whether the server currently permits another ticket (if not, give the local time when another can be obtained). One human-readable line; `--json` is `{usedToday, estimatedDailyLimit, canTakeNumber, nextTakeAt, state, reason}`, with the same four `state` values as doctor ⑤. Only “API changed” returns exit code 1; exhausted quota still returns 0 (see “Off-peak sends” below) |
| `models [--json]` | Derive available models locally from two sources (account: the key decrypted from `credentials.json` + model table in the builtin provider file; legacy: `~/.zcode/v2/config.json`; `workspace/readState` was removed starting with 3.12, so no handshake); show each model's thought levels and automatically assigned tier |
| `list [--project 关键字] [--json]` | List registered sessions: id, title, cwd, tier, last result, and whether pending; each `--json` line includes the owning repository, `repo` |
| `new --cwd <绝对路径> [--title T] [--tier fast\|strong] [--thought 档] [--deny "工具…"] [--provider id] [--json]` | Create a session. cwd must be allowlisted; a non-worktree produces a warning, not rejection |
| `send <id> <正文\|-> [--task 文件] [--wait] [--steer] [--timeout 秒] [--stream] [--json]` | Send. Queue by default; `--steer` uses `v4/command`'s `sendText` (guide) to interject into the current turn, taking effect at the next tool boundary; with no boundary, it is queued until the turn ends, without interruption |
| `send <id> <正文\|-> --offpeak [--task 文件] [--wait] [--timeout 秒] [--stream] [--json]` | Off-peak send: obtain a ticket immediately, then start with free off-peak compute when the ticket is ready, without using the plan's regular quota (see “Off-peak sends” below). Cannot be combined with `--steer` |
| `send <id> <正文\|-> --start-plan [--task 文件] [--wait] [--timeout 秒] [--stream] [--json]` | Start-plan send: start immediately like a regular send, but route only this turn's model requests through Start Plan subscription quota (see “Start-plan sends” below). Cannot be combined with `--steer` or `--offpeak` |
| `send <id> --offpeak --resume [--wait] [--stream] [--json]` | After a turn exits or the runner crashes, restart only the runner to continue the off-peak send already in the queue; do not enqueue again or obtain a ticket |
| `follow <id> [--timeout 秒] [--stream] [--json]` | Observe the background runner; return when it writes a new result |
| `status <id> [--tools N] [--json]` | Read-only snapshot: phase (`running` executing / `idle` queue empty / `pending` waiting for a response / `exited` normal shutdown / `stale` runner disappeared mid-flight), recent tool calls, queue length, last result, and pending duration; `--json` includes the owning repository `repo`, and each `tools[]` entry includes an argument `summary` |
| `watch [--json]` | Read-only, persistent: watch all sessions and emit the complete snapshot of any changed session (phase, final reply lines, active tool, recent tools, pending contents, off-peak queue, owning repository), at most once per session per 300 milliseconds; exit if the reader disconnects or the parent process disappears. Used by the watch pane (decisions D22), with no quota usage |
| `cancel <id>` | Stop: deny any pending request first, then `session/stop`; stop consuming the queue afterwards |
| `approve <id>` | Answer the current pending permission request with `allow_once` only |
| `deny <id>` | Deny the current pending permission request |
| `answer <id> [--] <值…>` | Answer the current pending question: match options by value, label, or number; for multiple choices, comma-separate values in one argument; without options, use free text. If the value starts with `--`, precede it with the `--` separator |

Exit codes:

| Code | Meaning |
| --- | --- |
| 0 | Turn finished; proceed to acceptance |
| 1 | Usage error or zcode cannot start (including ZCode App older than 3.12: builtin provider file not found) |
| 2 | Rejected: outside the allowlist, session absent from the registry, invalid tier or thought level; off-peak send rejected before or during ticket acquisition (session not idle, model absent from the off-peak model table, not signed in or using a team plan, no off-peak eligibility, quota exhausted, authentication rejected during ticket acquisition (401/403; sign in again in the App), off-peak service temporarily unavailable, off-peak API may have changed); start-plan prerequisites unmet (model absent from the start-plan model table, not signed in, no start-plan entry in the builtin file); regular sends while an off-peak send owns the session and `--steer` while waiting for a ticket; `--resume` with no recoverable off-peak send |
| 3 | `send --wait` timed out: the current turn was cancelled, but the session remains available for another send; `follow --timeout` only stops the observer when time runs out and cancels nothing |
| 4 | Abnormal turn: `turn.failed`, aborted, or output limit reached |
| 5 | Pending human response: permission request or question |

- `--wait` defaults to 1800 seconds (config `waitTimeoutSec`); cancel the current turn when time runs out. Pending is not a timeout: return 5 as soon as a request becomes pending.
- In `--json` output, `id` is the local dispatch id and `sessionId` is zcode's `sess_` (null before the first turn), consistently across all commands.
- When `send --wait` and `follow` finish, print two summary blocks: “闸门：放行 N 次（红线挂起 a、快筛 b、慢判 c、转人工 d）” (gate: allowed N times; hard-rule pending a, fast screen b, slow review c, referred to human d) and “改动：文件列表；Bash 条数” (changes: file list; Bash count); the `--json` equivalent is `summary:{gate:{allow, ask, hard, fast, slow}, files:[…], bashCount}`.
- `status` lists one entry per recent tool call, including an argument summary: `Bash(npm test)`, `Edit(src/a.mjs)`, or just the tool name if no summary is available; pending rows in `list` end with “挂起: 工具名” (pending: tool name).
- A session has at most one pending request at a time (permission requests are sequential within a turn). `approve` / `deny` / `answer` respond to that request.
- Validate `--thought` against the model's legal levels before creating the session; an invalid value returns exit code 2 (`session/create` silently ignores invalid values, so it cannot provide validation errors).
- `watch --json` emits one object per line: first `{type:'hello', repo}` (the owning repository of the startup directory), then `{type:'session', session}`; after the initial full set, `{type:'synced'}`; when a session disappears from the registry, `{type:'removed', id}`. Snapshot fields have new meanings only where their names differ from `status --json` (`activeTool`, `recentTools`, `pendingDetail`, `offpeakQueue`, `reply`, `since`, `lastEndedAt`, `lastEndOutcome`, `replyMarkdown`).
- Use `-` as the message body to read from stdin. `--json` supplies machine-readable structures.
- In output (stdout, stderr, `runner.log`), replace terminal control characters—C0 (except newline and tab), DEL, C1, and bidirectional-formatting controls—with literal `\uXXXX`:
  tool names, reasons, questions, model replies, and filenames are executor-controlled text; displaying it unchanged could clear the screen or overwrite the pending line being read. `--json` retains its meaning (escaping occurs inside JSON strings, and parsing restores the original characters).
- `doctor` exit code and `--json.ok`: if any step ①–③ fails, or ⑤ concludes “API changed” (changed), `ok` is false and the exit code is 1; the other three outcomes of ⑤ (healthy, temporarily unavailable, not applicable) affect neither. Before ⑤ was added, `ok` depended only on ①–③ (⑤ has counted since 2026-09-27). `--json` adds `offpeak: {state, layer, expected, actual, reason, logid, appVersion, verifiedAppVersion}`; `doctor --offpeak --json` outputs only `{ok, offpeak}` (also, if the test off-peak service URL environment variable `ZCODE_EXECUTOR_OFFPEAK_ORIGIN` is misconfigured, `doctor --offpeak` exits with 1).

### Off-peak sends

See `docs/SPEC-offpeak.md` (a local record not committed to the repository) for the specification and decisions D20 for the reasoning.

- **What it is**: a property of a send; sessions have no type. The turn runs on the Coding Plan subscription's free off-peak compute, without using the plan's regular quota; the server decides when it starts—obtain a ticket and queue first, then start when ready. Acceptance is the same as for regular sends. Only personal Coding Plan subscriptions are supported, and the session's model must appear in the off-peak model table.
- **Who chooses**: regular sends are the default; off-peak is the user's choice. Before the first dispatch in each chat, Claude runs `quota` to check today's usage and tells the user that off-peak is available, how many tickets have been used today, and whether another can be obtained now. After informing them, proceed with a regular send without waiting for an answer; use `--offpeak` on subsequent sends only after the user chooses it. Rework also defaults to regular sends (decisions D20, 2026-09-28 addendum).
- **Exclusive use of an idle session**: the session must be idle when an off-peak send is made (no live runner and an empty queue), otherwise exit code 2. While that send is queued or running, regular sends to the same session are rejected; `--steer` is permitted only after the turn starts. Use a separate session for off-peak sends; after completion, the same session can receive regular or off-peak rework sends.
- **Obtain a ticket immediately**: `send --offpeak` requests a ticket from the off-peak server immediately; failure returns exit code 2 with a reason and remedial action. After successful acquisition, without `--wait`, return 0 immediately; human-readable output is `send: 已取号，排第 N 位（闲时投递 <offPeakId>）` (ticket obtained, position N, off-peak send <offPeakId>); `--json` adds `offpeak: {offPeakId, ticketId, position}` to the existing fields.
- **Queue time does not count toward `--timeout`**: the `--wait` timer starts when the turn begins; exit codes after the turn ends are the same as for regular sends. While queued, `--stream` prints one stderr line with the position on each poll.
- **Automatically replace invalid tickets, at most 3 tickets**: if a ticket expires before becoming ready, or a turn fails because the ticket is invalid (error code 3102 / 3104 / 3001), the runner obtains a new ticket automatically (same send, at most 2 replacements), then sends a continuation instruction to the same session once ready. Restart the `--timeout` timer for each continuation turn. Once all 3 tickets are used or the server rejects reacquisition, the send ends as `failed` (exit code 4); worktree changes remain.
- **cancel settles the ticket at every stage**: while queued, running, replacing a ticket, or after the runner disappears, `cancel` settles the current ticket; a send without a final outcome ends as `cancelled`, while an existing outcome is unchanged. If the runner is alive, it settles the ticket, retrying failures 3 times with backoff; otherwise the CLI tries once. Tickets that still cannot be settled are recorded in `unsettledTickets` in `runs/<id>/offpeak.json`; `status` shows “闲时：号 … 未结算” (off-peak: ticket … unsettled).
- **Recover after exited with `--resume`**: if the turn exited or the runner crashed and the off-peak send remains in the queue, a regular send is rejected with two options: `send <id> --offpeak --resume` to continue (no body, `--task`, or `--timeout`; supplying any is a usage error, exit code 1; no recoverable send gives exit code 2; without `--wait`, `--json` adds `offpeak: {offPeakId, resumed: true}`), or `cancel` to close it out.
- **Display**: during an off-peak send, `status` and `follow` add a line for queue position, ready, or running (with deadline), plus “号 … 未结算” (ticket … unsettled) and “投递 … 没收尾” (send … not finalized); `status --json` and `follow --json` always include `offpeak` (the contents of offpeak.json, or null if absent). On macOS, hold `caffeinate` from the ticket wait through finalization to prevent idle sleep.
- **Health check `doctor --offpeak`**: run only doctor ⑤, checking four layers: credentials, builtin entry, server contract, and the end-to-end fake-ticket path. Four outcomes: healthy / API changed / temporarily unavailable / not applicable. Only “API changed” returns exit code 1, making it suitable for the user's own cron job; stdout always contains a one-line conclusion, so discard stdout in cron and inspect only the exit code and stderr. If the App version differs from the verified version, add one stderr notice without changing the conclusion. Cost: each run adds one self-check session to zcode CLI's own session database; it is not visible in the App's task list.

### Start-plan sends (only on the local `offpeak` branch)

See decisions D21 for the reasoning. Start Plan is another App subscription tier (builtin entry `account:<family>-start-plan`, endpoint at zcode.z.ai).

- **Currently unavailable (verified on 2026-09-29)**: the zcode-plan endpoint requires an Alibaba Cloud captcha, answered by the desktop App's embedded captcha SDK; headless hosts such as this tool cannot pass it—`send --start-plan` ends with a failed turn (exit code 4, `captcha verify failed`). The implementation is retained (the protocol layer has been verified up to the outbound request); do not use it until the server permits access. Regular and off-peak sends are unaffected.
- **What it is**: a property of a send; sessions have no type. Start immediately and begin timing like a regular send; the gate, pending behavior, acceptance, `--wait`, and exit codes are identical. Only this turn's model requests use Start Plan subscription quota. There is no ticket: no acquisition, queue, settlement, or exclusive session use.
- **Prerequisites** (exit code 2): the session's model appears in the start-plan model table (GLM-5.3-Flash, GLM-5.2, GLM-5-Turbo; GLM-5.3 is absent); ZCode App is signed in (`oauth:active_provider` and `zcodejwttoken` can be decrypted from credentials); and the builtin provider file contains a start-plan entry. Combining it with `--steer` or `--offpeak` is a usage error (exit code 1).
- **Mechanism**: the runner sends `provider/updateAccountConfig` to authorize the builtin entry, then sends the turn; the host supplies turn authentication by answering the reverse request `interaction/requestProviderRuntimeHeaders` (using `zcodejwttoken`, as the App host does). `modelSelection` applies only to this turn and does not change the session's current model.
- **Display**: without `--wait`, human-readable output is `send: 已排队，runner pid …（这一回合走 start plan 额度，account:<family>-start-plan）` (queued, runner pid …; this turn uses start-plan quota, account:<family>-start-plan); `--json` adds `startPlan: {providerId}`. The event `executor.startplan.started` records it.

## 5. Model tiers and thought levels

- **Two tiers**: `fast` (Flash, lite, mini, air, and similar models) and `strong` (flagship models).
- **Map to concrete models**: derive the list locally from two sources (for account sources, `builtinModelIds` and `modelRules` in the builtin provider file; for legacy sources, `~/.zcode/v2/config.json`; `workspace/readState` was removed starting with 3.12), automatically classify by model-name keywords, and choose the latest version if a tier has multiple models.
  During the handshake, `doctor` compares models under `zcode-executor` in the returned `settings.model.available` with the local list and warns about missing entries. `tiers` in `config.json` can override this. Model names are not hardcoded, so a new generation needs no code changes.
- **Provider preference: account-based personal coding plan, then account-based team plan, then the coding plan in `config.json`** (overridable with `preferredProvider`, for example `account:bigmodel-team-coding-plan`); use whichever site is signed in, domestic `bigmodel` or international `zai`.
- **Without `--tier`**, use `fast`, falling back to `strong` only when `fast` is unavailable.
- **Dispatch thought level defaults to `high`**; if the model has no `high` level, omit it and use the model default. `--thought` overrides it. ZCode model review defaults to `low`, overridable with `review.thought`; a nonblank `review.jev.apiKey` in configuration adds a Jev pre-screen before the original fast screen, while ZCode fast screening and slow review still use this thought level. Jev requests can use an http(s) proxy configured through `review.jev.proxy` (D24); without apiKey, the proxy has no effect.
- **The only mode is `build`**. Do not expose `--mode`.
- **`--deny`** removes no tools by default.

The skill's selection guide: mechanical changes → `fast`; ordinary implementation → `fast`; difficult work (tradeoffs, hard-to-reproduce debugging, unfamiliar code) → `strong`.
Do not lower the thought level for Flash-class models; results are poor.

## 6. Gate

Both `interaction/requestPermission` and `interaction/requestUserInput` from the executor enter the gate.

**Permission requests** pass through three stages. Write one final `executor.gate` event per request to `events.jsonl`; its stage has one of these values (Jev pre-screen details are nested in `preScreen`; historical `fastReview` retains its old meaning):
`hard` (hard rule), `no-allow-option` (no `allow_once` in options, so it cannot be allowed), `review-fast` (allowed by fast screening),
`review-slow` (slow review), `review-failed` (model call or parsing failed), `review-disabled` (model review disabled in configuration),
`gate-error` (the gate itself failed), `question` (question goes directly to pending).

1. **Hard rules** (hardcoded; nobody can override them):
   - The hard-rule table follows Claude Code auto-mode categories (credential leakage, etc.).
   - **Project-specific rule one (outside the worktree, `outside-worktree`)**: for tools with path arguments (Write, Edit, etc.), a path outside cwd → refer to a human.
     Resolve paths segment by segment as the kernel does before checking boundaries: expand symlinks in place, with `..` acting on the link target (`<执行副本>/link/../x` lands in the link target's parent, outside the worktree; `<执行副本>` means the worktree);
     consider both readings, “normalize lexically first” and “pass unchanged to the kernel”; either escaping the boundary triggers the rule. If the destination cannot be determined (symlink cycle, traversing a file as a directory),
     or a write tool (Write, Edit, MultiEdit, NotebookEdit, ApplyPatch) supplies no usable path, refer to a human as well.
     Bash paths cannot be parsed reliably, so no outside-worktree hard rule is applied to them; defer to model review and state in the prompt that any write or deletion outside the worktree must go to a human.
   - **Project-specific rule two (self-protection, `self-modify-approval`)**: an operation targeting this tool's own data directory (which contains pending requests and answers, registry, and configuration;
     excluding the default worktree root `worktrees/` and this session's worktree), or invoking this tool's CLI (`zcode-executor <子命令>`, where `<子命令>` means subcommand) → refer to a human.
     The executor and runner run as the same user; file permissions cannot prevent the executor from writing `answer.json` or running `approve` itself, so neither is left to model review.
     Match Bash `command` and js-tool `code` as raw text, recognizing only explicit forms (literal paths, `~`, `$HOME`, `$PWD`, relative `..`, and the CLI name followed by a subcommand);
     assembled variables, encoding, or writing and then running a script are not recognized and remain the responsibility of model review and humans. There is no complete solution under the same user; system-level isolation would be required (decisions D23).
   - A match goes directly to pending, bypassing model review.
2. **Model review**: optional Jev pre-screen → original ZCode `fast` + `low` fast screen → slow review when needed. A nonblank `review.jev.apiKey` enables pre-screening; Jev pass allows early, while flag/error/skip (including timeout, invalid response, or adapter exception) all fall back to the original fast screen. Without a key, the original pipeline is unchanged. Only a non-passing or unparseable original fast-screen result proceeds to slow review; a failed original fast-screen call still goes to a human as `review-failed`.
   The original fast screen receives the existing full action/context, not Jev's reduced state, and does not treat Jev probabilities as instructions; prompts, thought level, and parsing rules retain the original contract. ZCode fast-screen output budget is 300 tokens (`review.fastMaxTokens`), and slow review 2000 (`review.slowMaxTokens`). Jev has no shadow/mode and reads no key from environment variables. A `~/.zcode-executor/config.json` containing a Jev key must be a regular, non-symlink file owned by the current user, with permissions no broader than `0600`; otherwise configuration loading fails.
   Slow review requires **the conclusion on the first line** (`结论: allow` / `结论: ask` / `结论: deny <规则 id>`, where `结论` means conclusion and `<规则 id>` means rule id), followed by the reason—
   placing the conclusion last lets long reasoning truncate it and invalidate the entire review.
   **Produce only allow or referral to a human, never deny**; an unparseable slow-review response or failed call → refer to a human.
   ZCode slow-review input: the full task file + all send bodies in this session (intent), summaries of earlier tool calls in the current turn, `config.json`'s
   `environment` / `sensitive`, evidence (whether the target file exists and whether the workspace is dirty), and AGENTS.md / CLAUDE.md from the original repository (not the worktree)—background only, not user authorization.
   The Jev pre-screen sends only redacted, minimized task contracts, recent messages, and tool inputs. If Write/Edit/MultiEdit bodies are omitted, valid intent is missing, command or authorization information is truncated, or reliable redaction is impossible, skip locally: send no HTTP request and run the original fast screen directly. Jev's five negative risks are scope conflict, writes outside the worktree, credentials/outbound transfer, destruction/external side effects, and clear irrelevance/lack of necessity; pass only if all probabilities are `<=0.20` and local evidence is sufficient. Complex Bash, pipes, subshells, batch processing, and project scripts are not themselves risks or reasons to skip.
   Carry soft rules over unchanged; a rule is cleared only if the task file explicitly names both the action and the object.
   Allow → answer `allow_once`.
3. **Pending**: write `runs/<id>/pending.json` (kind = permission, with tool name, arguments, and the matching hard rule or reason for human referral),
   and leave the connection unanswered. **No expiry**; only `approve` / `deny` / `cancel` ends it.

**Questions** (zcode's AskUserQuestion) bypass hard rules and model review and go directly to pending, kind = question, with question text and options.
Respond with `answer`. ExitPlanMode does not occur in build mode.

**`--task`** supplies intent for model review. Without it, intent consists only of the send body, leaving no basis for boundary decisions and making fast-screen flags more likely—the skill requires it.
Snapshot the task file when the send enters the queue (`runs/<id>/tasks/<sha256>.md`, with the hash recorded in the queue item and `taskSha256` of the `executor.send` event); review reads only that snapshot:
the task file lives in the worktree and the executor can edit it, so reading the original at review time would let the executor write what “the user said”. Later edits do not change the review basis;
to expose new content to review, send again with `--task`. Old events without snapshots (written before upgrading) are no longer used as a review basis.

Each review records only one final `executor.gate`: `stage:"review-fast"` + `reviewer:"jev"` means an early pre-screen pass; the same stage + `reviewer:"zcode"` means an original fast-screen pass. Slow review/call failure has ZCode as the final reviewer. A separate `preScreen` records Jev pass/flag/error/skip, permitted reasons, duration, counts, probabilities, and other metadata; skip is not disguised as a model flag. Historical `fastReview` retains its old Jev-fallback meaning and is not repurposed to record ZCode fast screening. Terminal statistics do not double-count; see SPEC for the field contract.

In `doctor --json`, `review.pipeline` is `['jev','zcode-fast','zcode-slow']` when enabled with a key, `['zcode-fast','zcode-slow']` without a key, `[]` when review is disabled, or `null` with an explanation that it is indeterminate when configuration loading fails. The legacy `fastScreen` field is only a compatibility name for the first optional screen; it does not mean ZCode fast screening is replaced.

## 7. Storage

In the tree, `<仓库名>` means repository name and `<本地 id>` means local id.

```
~/.zcode-executor/                 overridable with ZCODE_EXECUTOR_HOME
  config.json                      allowedRoots (default [~/.zcode-executor/worktrees]), waitTimeoutSec (1800),
                                   preferredProvider, tiers overrides, environment, sensitive,
                                   review (enabled, model, thought defaults to low, fastMaxTokens 300,
                                   slowMaxTokens 2000, timeoutMs, jev.apiKey). All optional; file must be 0600 if it contains a Jev key
  sessions.json                    registry: local id, zcode sess_ (after first turn), title, cwd, whether worktree, original repoRoot (for worktrees), tier, provider, model, thought level, creation time, last result
  worktrees/<仓库名>/               worktree created by Claude
  runs/<本地 id>/
    state.json                     runner state, pid
    events.jsonl                   original zcode events + this project's actions (sends, gate-stage results, approve/deny/answer)
    last.json                      last turn result
    pending.json                   pending permission request or question; deleted after answering
    offpeak.json                   off-peak send state: ticket, position, phase, deadline, unsettled tickets (no credentials)
    answer.json                    answer written by approve/deny/answer; deleted after runner consumes it
    cancel                         marker to stop the current turn; runner sends session/stop and denies pending requests on the human's behalf; deleted after handling
    runner.log                     runner stderr
    queue/                         queued sends
    tasks/<sha256>.md              task snapshot at enqueue time; sole task-file intent source for model review
    lock                           O_EXCL lock
    stop                           shutdown marker; after the current item, runner stops consuming the queue, closes the connection, and exits
```

`runs/` and its subdirectories use 0700; files this tool writes use 0600 (0755 directories left by older versions are tightened on the next send): they contain raw commands, task files, and session events.
This protects against other users on the same machine, not an executor running as the same user. Do not tighten the data-directory root—the default worktree root also lives under it.
Before persisting `pending.json`, redact by value the secrets held by the runner (provider key, off-peak credentials, Jev key); do not guess that anything resembling a credential should be hidden, because humans need the original text to decide whether to allow it.

There is one audit source: `events.jsonl`. A session's history can be examined in one place.
`~/.zcode/v2/config.json` and `~/.zcode/v2/credentials.json` are read-only; `doctor` reports only whether the files and keys exist, never their contents.

## 8. runner

- One runner process per session, no persistent daemon, always started in the background; `send --wait` only observes files, while the runner keeps the connection alive during pending.
- Runner lifecycle: acquire lock → start app-server child process → `session/resume` (if the registry has no `sess_`, or resume reports
  Session not found, use `session/create`, write the new id back to the registry, and record `executor.recreated`) → consume the queue in a loop →
  exit when the queue is empty or the stop marker appears.
- Both runner and app-server child process remain alive during pending.
- Multiple sessions can run concurrently, each with its own app-server child process; no limit is imposed.
- Detect turn end through `turn.completed` / `turn.failed` / `turn.terminal`. No fallback for missing signals initially; add one after encountering a hang.
- Unanswered reverse requests resend the same requestId every second and must be deduplicated. Keep cached responses only until the next send starts: if the peer reuses a requestId, an allowance from the previous turn must not answer the new request unchanged.
- Start the app-server child without the host agent's credential environment variables (the fixed list including `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GITHUB_TOKEN`, `GH_TOKEN`,
  `HOST_CREDENTIAL_ENV` in `lib/appserver.mjs`): the executor's Bash inherits the child's environment, exposing everything through `env`. zcode model keys use the personal provider file and do not need these variables;
  when the executor's task needs GitHub credentials, use the already signed-in local gh / git credential helper. Record omitted variable names in one `runner.log` line (names only).

## 9. skill

`skills/zcode-executor/SKILL.md` must teach:

- Iron rules: the task file is the contract and the message is only a doorbell; acceptance uses `git diff` and tests; after three or four unsuccessful turns in the same session, revise the task file; do not approve boundary violations on the user's behalf.
- Write the task file before dispatch; `send` must include `--task` (absolute path). Put no credentials in it: its full text is sent to model review as the authorization basis.
- Commands always use the local dispatch id; zcode's `sess_` is only for reconciliation in `list`.
- Before acceptance, run `git -C <执行副本> add -A` (`<执行副本>` means worktree): the executor does not commit, and unstaged new files are invisible in the diff.
- Model-tier and thought-level selection guidance (section 5).
- Two ways to handle exit code 5: relay permission requests to a human with AskUserQuestion, then `approve` / `deny`; for questions, first decide whether Claude can answer, and use `answer` if so.
- `--steer` interjects rather than interrupts; use `cancel` first to interrupt.
- Start `follow` as a background task; do not wrap it in a foreground timeout and wait.
- Off-peak sends: when to use them, use a separate session, how to handle the causes of exit code 2, `--resume` and `cancel`, and `doctor --offpeak`.
- Do not open a running session in ZCode App (shared sqlite, no cross-process lock).
- Always use `-C <绝对路径>` for git operations (`<绝对路径>` means absolute path), distinguishing merges in the main checkout from branch changes in the worktree; before switching to a new branch, verify that main includes the previous task (a previously encountered mistake).

## 10. Tests and validation

- `npm test` runs only against `test/mock-appserver.mjs` and `test/mock-offpeak.mjs`, without quota usage.
- Live validation has two categories: zero-token checks (handshake, create (including model table), list, close) can be run freely;
  quota-consuming checks (`session/send`) are done only once per step; see the handoff's completion criteria.
- ~~Acceptance criterion: open a new Claude Code session and use only the skill to complete a dispatch, pending request, approval, and acceptance~~ Achieved (T4.2, 2026-09-08).

## 11. Facts to verify live before implementation (all verified; retained as a source index)

Zero tokens:

- ~~Does `session/requestRuntimePreferences` arrive before create?~~ Verified: not received through a direct connection on 0.16.5; keep the handler but do not wait for it.
- ~~Does create return the correct models without synchronizing the provider table?~~ Verified: create is rejected outright without pushing the table; pushing it is required (decisions D10).
- ~~The field name and value format of `toolDenylist`~~ Verified: after `--deny "Write Edit MultiEdit"`, the model cannot access these tools throughout the turn (verified.md, “Seven post-delivery checks”, ⑤).
- ~~Which `querySource` is accepted by `workspace/generateText`, and does passing a thought level through `modelRef.variant` work?~~ Verified: `zcode-executor.review` is accepted, and `modelRef.variant` can be passed (high was tested then; review now defaults to low) (verified.md). Starting with 3.12, `modelRef` was renamed to `selection` and `variant` became `options.reasoningLevel`; see decisions.md D14.

Quota-consuming:

- ~~Which operations request permission in `build` mode?~~ Partly verified: Write does (verified.md, “First live send”), and Bash running git does too (verified.md, “Checkpoint 2”).
- ~~Is `turn.completed` sufficient to determine turn completion?~~ Verified: yes, and the payload contains the full answer and usage.
