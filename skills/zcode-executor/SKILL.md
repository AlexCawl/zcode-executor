---
name: zcode-executor
description: Hand a fully specified development task to the local ZCode (GLM) — it changes code in an isolated worktree, and you accept the result with git diff and tests. Use when the user says "let zcode do it" / 「让 zcode 去做」「派给 zcode」「派给执行端」, or when this session does the planning while the actual code changes go to zcode. Also covers checking zcode session status, steering a running turn, and answering pending permission requests or questions.
---

# Dispatch the task to zcode

You are the planning hub; zcode is the executor. You write what to do into a task file, zcode changes
code in an isolated worktree (a git worktree), and you accept with objective evidence. The command is
`zcode-executor`; the command blocks below can be copied and run once placeholders are replaced.
First run `command -v zcode-executor` in the terminal: if it is on PATH, copy the blocks as they are.
If not found, resolve per host:
- With the Claude Code plugin installed it is already on PATH; in standalone usage it is
  `bin/zcode-executor` two levels above this skill's directory (`<plugin root>/bin/zcode-executor`) — call it by absolute path;
- Local source checkout: the absolute path of the repo's `bin/` (example: `/Volumes/MacData/projects/zcode-executor/bin/zcode-executor doctor`);
- Or `npm install -g zcode-executor`, or just `npx zcode-executor …`.

## Working model: the head agent orchestrates, loops close in the original sessions

- The head agent owns task files, dispatching, and final evidence-based acceptance; implementation and rework go to
  the execution session, code review and re-review to a separate review session. Record the execution id, review id,
  and worktree path for each task; the review session is read-only.
- **Rework → the original execution session; re-review after rework → the original review session.** Write the review
  findings, reproduction evidence, and pass criteria into a rework task file, wait for the original execution turn to
  finish, then resend with `--task`; hand the latest diff, test results, and the rework task file back to the original
  review session and confirm each finding is closed. The head agent's evidence check does not replace review, and it
  does not take over the fix itself. Only create a new session when the original one is truly unrecoverable, and hand
  over the context above.
- **After a send, advance independent work first; wait only when there is truly nothing else to do.** By default `send`
  runs without `--wait`: start `follow` as a background task and record its job id. Meanwhile plan the next step,
  prepare the acceptance checklist, or line up follow-up tasks; do not touch files the executor is changing and do not
  consume unfinished output early. Handle completion or pending notifications when they arrive, and collect all results
  before delivery. Do not replace background waiting with repeated `status` calls or sleep loops.

## Iron rules

1. **The task file is the contract; the message is only a doorbell.** All task content goes into the task file; a send
   body of "Execute tasks/T-xxx.md" is enough — zcode is a full agent with its own judgment, and a paragraph of prose
   will be re-interpreted on its own; the task file is what you reconcile against afterwards. That is why `send` must
   always carry `--task`: without a task file, a pending handed to you has no authorization basis, out-of-scope
   judgment has no reference, and nearly everything ends up asked of a human. The answer is judged against the task
   file **as it stood at the moment of the send** (a snapshot is kept at enqueue): later edits to the file are
   invisible to pending answers — only sending again with `--task` counts.
2. **Accept on `git diff` and tests, not on what it says.** The reply brought back at turn end is the executor's
   self-report. To judge whether it was done right, always go back to the main repository for the diff, run tests in
   the worktree, and read the produced files.
3. **If the same session fails three or four rounds in a row, go back and fix the task file.** The problem is usually
   an unclear task description, not something more sends will solve. Fix: write `tasks/T-xxx-fix.md` stating what fell
   short, then send to the same session again (it has the context and reworks with it).
4. **Triage a pending first; do not approve out-of-scope actions for the user.** Check the task file, the user's
   existing authorizations, and the concrete operation: what you can confirm and what the rules let the head agent
   handle, answer per the "exit code 5" section; anything out of scope, unverifiable, or required by higher-level
   instructions to go to a human, relay to the user with your reasoning. Pending itself is neither a danger signal
   nor a grounds for approval; this skill does not override the host's approval restrictions.

## One task, end to end

```bash
# 1. Write the task file first (template templates/task.md)
#    Acceptance criteria must be machine-checkable: which command to run, which files to look at, what output to expect
#    Split sensibly: one task file does one independently acceptable thing; work that will touch many files
#    or run long tests goes into several task files sent serially (next one only after the previous passes),
#    not crammed into one
#    A turn times out after 1 hour by default (--timeout 3600): for longer tasks give a longer --timeout manually —
#    a timeout cancels the current turn, and resending wastes quota

# 2. Create the worktree for the repository (one per repository, branch per task)
WT=~/.zcode-executor/worktrees/<repo-name>
git -C <main-repo-abs-path> worktree add "$WT" -b task/T-xxx    # first time: install dependencies once inside $WT

# 3. Create the session: a zero-token registration only, returns the local id (x_ prefix); the zcode session is created on first send
zcode-executor new --cwd "$WT" --title T-xxx --tier fast --json

# No extra step before the first dispatch in a conversation — just send as usual
# 4. Send non-blocking (--task is mandatory), then start follow <id> as a background task; advance independent work per "Working model"
#    tasks/T-xxx.md in the message is a relative path for zcode to read itself inside the worktree, so the task file must live in $WT;
#    --task is the task file a pending answer uses as the authorization basis — absolute path
zcode-executor send <id> "Execute tasks/T-xxx.md" --task "$WT/tasks/T-xxx.md"

# 5. On the completion notice, hand over to a separate review session; the head agent checks objective evidence.
#    zcode does not commit — changes sit in the worktree working tree; stage untracked files first, then look at the diff
git -C "$WT" add -A && git -C "$WT" diff --cached --stat && git -C "$WT" diff --cached
git -C "$WT" <test-command>
#    Want the approval trail too: lines with type executor.gate in $ZCODE_EXECUTOR_HOME/runs/<id>/events.jsonl

# 6. Passed: commit inside $WT (git -C "$WT" commit -m "T-xxx: …"), then merge in the main repository (next section).
#    Failed: git -C "$WT" reset to unstage, write tasks/T-xxx-fix.md, send to the original execution session;
#    on completion, re-review in the original review session
```

A send returns immediately and the background runner keeps working; start `follow` with the host's
background-task tool (`run_in_background: true`) and record the returned job id. Wait on that background
task only when the very next step truly depends on the result and there is no independent work;
`send --wait` is the optional blocking form — it returns exit code 5 when pending.

## Always `git -C <absolute-path>`, never rely on cd

The main repository and the worktree are two directories; after one `cd` inside a Bash call, the subsequent
`git merge` or `git checkout -b` may run in the other repository than you think. A real past trap: running
tests in the worktree, then merging right there — the merge landed in the worktree (HEAD was already that
branch, so the self-merge changed nothing), the main repository's main never moved, and the next task's
branch cut from main was missing the previous task's code.

```bash
git -C <main-repo-abs-path> merge --ff-only task/T-xxx      # merge into main: in the main repository
git -C <main-repo-abs-path> log --oneline -1                # before cutting a new branch, verify main contains the previous task
git -C "$WT" checkout -b task/T-yyy main              # cut the new branch: in the worktree
```

## Model tiers and thought levels

Select ZCode models by tier, not by model name — habits survive model churn. `models` shows which model
each tier currently resolves to.

| Work | Suggestion |
| --- | --- |
| Mechanical changes (renames, moving code, adding tests to an explicit list) | `--tier fast` |
| Regular implementation (a feature with clear acceptance criteria) | `--tier fast` |
| Hard work (design trade-offs, hard-to-reproduce debugging, unfamiliar code) | `--tier strong` |

- **The thought level defaults to `high`; leave it alone.** Do not lower it for Flash-class models — measured results are worse.
- Providers: prefer the personal account coding plan (the key obtained after signing in to the App), then the team
  account plan, then the coding plan in `config.json`; when the same model name exists under several providers, do not
  worry — the plugin picks the right one. To override, set `preferredProvider` in the plugin config
  (e.g. `account:bigmodel-team-coding-plan`).
- Model and thought level are set when the session is created and carry over to later sends. For hard work, do not
  reuse a previously created fast session — open a new one.
- **Once the original zcode session's context exceeds 1M tokens, dispatch to a new session.** The longer the session,
  the higher the fixed overhead of every send and the lower the execution efficiency; context accumulated in an old
  session is mostly noise for a new task. Always use a new session for a new task (with a new worktree if needed) and
  hand over the task file and any necessary diffs.

## Exit codes and what to do

| Code | Meaning | What you do |
| --- | --- | --- |
| 0 | Turn finished | Go accept; do not trust "done" on its word |
| 1 | Usage error, or zcode fails to start (including ZCode App older than 3.12) | Read the error; for environment problems run `zcode-executor doctor` (a zero-quota self-check) |
| 2 | Rejected: outside the allowlist, session not in the registry, invalid tier or thought level | The error states the reason — act on it, do not retry verbatim |
| 3 | `send --wait` timed out (default 3600 s, changeable via `--timeout`), **current turn already cancelled**, session still alive | Just send again to continue; a `follow` timeout cancels nothing — only the onlooker leaves at the deadline |
| 4 | Turn ended abnormally: error, aborted, or hit the output limit | Read the reason; on the output limit, split the task smaller and resend |
| 5 | Pending, waiting for a human: permission request or question | See the next section; do not look for ways around it |

## Exit code 5: the two kinds of pending

Pending does not expire; the session sits still waiting. `send --wait` returns 5 immediately and prints the
pending content; when running in the background, check with `status <id>`.

**Permission request** (the executor wants to perform an operation and waits for your leave):

1. Read the full tool name, arguments, target paths, and the stated reason; judge the actual impact against the task
   file and the user's authorizations; if evidence is insufficient, do read-only checks first.
2. **You can decide yourself**: the operation is clearly within the authorized scope, hits no red line, and
   higher-level instructions allow autonomous answering → state your basis, then `zcode-executor approve <id>`
   (this occurrence only); it clearly violates the task constraints and autonomous denial is allowed →
   `zcode-executor deny <id>` and hand the reason back to the original execution session to adjust.
3. **A human must decide**: out of scope (e.g. writes outside the worktree), new permissions or irreversible impact
   not authorized, insufficient evidence, or higher-level instructions explicitly require handoff → relay the tool
   name, arguments, and reason verbatim, with your recommendation and open points (AskUserQuestion in Claude Code;
   the host's escalation path in DSH); then `approve` / `deny` once decided. Never bypass a restriction by editing
   the task file, closing the approval, or switching commands.

   Be extra careful when the rule is `self-modify-approval`: that is the executor touching zcode-executor's own data
   directory (pending approvals and their answers live there) or invoking the `zcode-executor` command. Normal work
   needs neither; tell the user exactly what it wants to do — do not explain it into harmlessness on its behalf.

**Response-binding limitation (applies to approve / deny / answer alike)**: the current CLI re-reads pending and
provides no expected-requestId/CAS; reading twice or claiming a single operator does not prevent crossed answers.
Only answer when verified external serialization covers the whole "verify current request → CLI read" span;
otherwise keep the pending, report the limitation, and ask the user to coordinate safe handling — a human saying
"allow" does not by itself remove the race. Do not invent parameters or write answer.json directly.

**Question** (the executor asks you something; it wants an answer, not permission):

1. First check whether the task file already contains the answer; if you can answer, do not disturb the user:
   `zcode-executor answer <id> <value…>`. With options, give the value by index, value, or label — comma-separated
   for multiple choice; without options it is free text.
2. Only ask a human if you cannot answer; once you have the answer, pass it back the same way with `answer`.

## Steering, following, stopping

```bash
zcode-executor send <id> "Change of direction: do A only for now" --steer   # interject mid-turn, no interruption
zcode-executor follow <id> [--stream]                     # follow the background runner; returns when new results appear
zcode-executor status <id>                                # read-only snapshot: phase, recent tools, queue, how long pending
zcode-executor cancel <id>                                # stop: answer pending with a denial first, then stop the turn, take nothing more from the queue
```

- **`--steer` is an interjection, not an interruption.** The message is handed to the running turn without breaking it;
  to break, `cancel` first, then resend. The interjection takes effect at the next tool boundary; with no boundary it
  is queued until the turn ends.
- **Start `follow` as a background task** (`run_in_background`); you are called back automatically when it exits. Do
  not wrap it in a foreground `timeout` — a timeout cuts off only you, the onlooker; the turn keeps running, and it is
  easy to mistake that for a hang.
- For an on-demand "where is it now", use `status`: read-only, zero quota, non-blocking. Phase values: `running`
  (working), `pending` (waiting for a human), `idle` (runner alive, queue empty), `exited` (runner finished and
  exited normally — read together with the 「上次: done」 line, not a failure), `stale` (runner vanished mid-run;
  needs human eyes most). Every `[phase]` in `list` uses the same vocabulary; no running / pending means nothing is
  running.
- To watch live, add `--stream` to `send` / `follow`: tool-call summaries and finished replies stream to stderr.

## Start-plan sends

Before spending Start Plan (`--start-plan`) quota, read `references/start-plan.md`:
prerequisites, the full commands, and the rejection table live there.

## The two session ids

- Commands always use the **local id** (starts with `x_`, the one `new` returns).
- ZCode's own `sess_…` id exists only after the first turn and appears alongside the local id only in `list` and
  `--json` output — for reconciliation, never typed into commands.

## Do not

- **Never open a running session in the ZCode App.** Both sides write the same sqlite with no cross-process lock;
  they will trample each other.
- **Do not dispatch outside the worktrees.** The cwd allowlist for `new` defaults to
  `~/.zcode-executor/worktrees/` only — that is protection, not an obstacle; two agents editing the same files at
  once overwrite each other.
- **Never report "zcode says it's done" as acceptance.** Acceptance recognizes only `git diff` and test results
  (iron rule 2).
- Do not send a fourth round. Three or four failed rounds mean fix the task file (iron rule 3).
- **Never put credentials in a task file.** The task file is the authorization basis for pending answers, and it
  also lands on local disk with the events.

## Command cheat sheet

```bash
zcode-executor doctor [--json]                  # zero-quota self-check: zcode, config, handshake, tiers
zcode-executor models [--json]                  # available models, thought levels, disable reasons, automatic tier assignment
zcode-executor list [--project keyword] [--json]  # sessions in the registry: local id, sess_, last result, pending flag
zcode-executor new --cwd <abs-path> [--title T] [--tier fast|strong] [--thought level] [--deny "tools…"] [--provider id] [--json]
zcode-executor send <id> <body|-> [--task file] [--wait] [--steer] [--timeout s] [--stream] [--json]
zcode-executor send <id> <body|-> --start-plan [--task file] [--wait] [--timeout s] [--stream] [--json]  # Start Plan quota
zcode-executor follow <id> [--timeout s] [--stream] [--json]
zcode-executor status <id> [--tools N] [--json]  # running / idle / pending / abnormal end, recent tool calls, queue length
zcode-executor cancel <id>                       # stop: answer pending with a denial first, then take nothing more from the queue
zcode-executor approve <id>                      # answer a pending permission request; replies allow_once only
zcode-executor deny <id>                         # answer a pending permission request with a denial
zcode-executor answer <id> <value…>              # answer a pending question: by index/value/label, comma-separated for multiple choice
```

- The watch pane shows live progress across sessions (replies, tools, pending, queueing): in Claude Code the user
  opens it with `/zcode` (it also opens automatically when you send, with a status-bar summary and toasts on key
  changes); DSH has a 「zcode 任务」 tab in the right sidebar. The pane is view-only — pending is still handled in
  the conversation per the rules above. Behind it is a read-only `zcode-executor watch --json` you do not need to
  run yourself.

- A body of `-` reads from stdin; for long text do not fight shell quoting:

  ```bash
  zcode-executor send <id> - --task "$WT/tasks/T-xxx.md" <<'EOF'
  Execute tasks/T-xxx.md; self-check every acceptance criterion one by one before stopping
  EOF
  ```

- `--deny` removes the listed tools from the registry at session creation. **If the task needs no internet on the
  executor side, pass `--deny "WebFetch WebSearch"`** to shrink the attackable surface of network tools. This removes
  only those two; Bash, js, and MCP tools can still reach the network — cutting it off entirely is the OS's or
  container's job.
- Credential variables from your own environment (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`,
  `GITHUB_TOKEN`, `GH_TOKEN`, …) are not passed to the executor. When a task needs GitHub credentials, rely on the
  locally signed-in `gh` / git credential helper, not environment variables.
- `--json` gives a machine-readable structure for scripted handling; every `id` in the output is the local id.
- cwd is resolved to its real path before entering the registry (on macOS `/tmp/x` becomes `/private/tmp/x`);
  `list --project` matches against the resolved path.
- Data directory `~/.zcode-executor/` (overridable via `ZCODE_EXECUTOR_HOME`): `sessions.json` registry;
  `runs/<id>/` holds `events.jsonl` (zcode events and gate decisions), `last.json`, `pending.json`, `runner.log`.
