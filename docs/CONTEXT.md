# zcode-executor

English · [中文](CONTEXT.zh-CN.md) · [Русский](CONTEXT.ru.md)

Claude acts as the foreman: it hands a well-specified development task to local ZCode and accepts the result using objective evidence.
This file defines terms, not implementation; implementation decisions live in [decisions.md](decisions.md) and [SPEC.md](SPEC.md).

## Language

### Dispatch

**Session**:
A conversation on the ZCode side, identified by its `sess_` id. This project assigns a local dispatch id (starting with `x_`) in its registry; the CLI uses only the local id.
ZCode's `sess_` does not exist until after the first turn.
_Avoid_: run, task instance, job

**Local id**:
The registry key for a session: `x_` followed by 8 hexadecimal digits. Every command's `<id>` refers to this key; ZCode's `sess_` is displayed alongside it only in `list` and `--json`, for reconciliation.
_Avoid_: run id, task id

**Task file**:
The contract Claude writes for the executor, stating the goal, files to change, acceptance criteria, and forbidden areas.
_Avoid_: prompt, message

**Task snapshot**:
The task file's contents when a send enters the queue, stored in the data directory (`runs/<id>/tasks/`). Model review reads intent only from this snapshot, never from the original in the worktree, which the executor can edit.
_Avoid_: task backup, cache

**Send**:
Sending one message to a session to trigger a turn. The message is only a doorbell; the content is in the task file.
_Avoid_: submit, prompt

**Turn**:
The executor's entire stretch of work from receiving a send until it stops.
_Avoid_: round, prompt, run

**Acceptance**:
Claude determines whether the task is complete by examining `git diff` and test results. The executor's own report is not evidence.
_Avoid_: confirmation, review

**Off-peak send**:
A send whose turn waits for the server to release off-peak compute. It uses the Coding Plan subscription's free off-peak quota rather than the plan's regular quota.
Session, turn, and acceptance retain their meanings; only the server decides when execution starts.
_Avoid_: off-peak task (except for the feature with that name in ZCode App), off-peak session (sessions have no type; off-peak is a property of a send)

**Ticket**:
The credential used to queue an off-peak send on the server. One send may use several tickets in succession. Obtaining a ticket enters the queue; once ready, execution must start within a few minutes and has a maximum runtime.
The ticket must be settled afterwards.
_Avoid_: queue item, queue entry

**Start-plan send**:
A send that routes this turn's model requests through the Start Plan subscription quota. It starts immediately like a regular send, with no ticket, waiting, or settlement.
Session, turn, and acceptance retain their meanings.
_Avoid_: start-plan task, Start Plan session (sessions have no type; start plan is a property of a send)

**Worktree**:
The git worktree where the executor works, isolated from the main checkout. Claude creates it; this project only records it.

### Approvals

**Permission request**:
The executor's request for permission before performing an operation.
_Avoid_: permission dialog, permission prompt

**Question**:
A question from the executor that requires an answer rather than an allow or deny decision.
_Avoid_: user input

**Gate**:
The complete permission-request workflow: hard rules → model review → pending.
_Avoid_: approver, filter

**Hard rule**:
A rule nobody can override. A match goes directly to a human, bypassing model review.
_Avoid_: blacklist

**Control plane**:
The parts of this tool's data directory the executor must not touch: pending requests and answers, registry, configuration, events, and task snapshots. This is the data directory excluding the default worktree root `worktrees/` and this session's worktree.
An operation targeting it, or invoking this tool's CLI, matches the self-protection hard rule.
_Avoid_: state directory, internal directory

**Model review**:
Models assess a permission request in stages to allow it or refer it to a human. The stages can include pre-screening, fast screening, and slow review; the final result is only allow or ask, never deny.
_Avoid_: judgment, judge, automatic approval

**Pre-screen**:
An optional Jev assessment before the original fast screen. Sufficient evidence and a passing result allow early; everything else proceeds to the original fast screen, which it does not replace.
_Avoid_: replacement fast screen, shadow

**Local skip**:
Before sending, the client knows that evidence is insufficient or reliable redaction is impossible. It does not request Jev and proceeds to the original fast screen; this is not a model finding of risk.
_Avoid_: flag, model denial

**Fast screen**:
The first stage of the original ZCode model review, assessing whether an action can be allowed directly. A non-passing or unparseable result proceeds to slow review; a failed call goes to a human.
_Avoid_: Jev pre-screen, shadow, preliminary review

**Slow review**:
A second assessment after a non-passing or unparseable ZCode fast-screen result. It can allow or ask a human, never directly deny.
_Avoid_: second-instance review, final review

**Pending**:
A permission request or question is waiting for a human response, and the turn is paused there. Externally represented as blocked.
_Avoid_: blockage, awaiting approval, stuck

**Receipt**:
The `executor.approve` / `deny` / `answer` event written to `events.jsonl` after the runner consumes an answer.
This is the `eventType` in `approve` / `deny` / `answer` output with `--json`; null if not found.
_Avoid_: ack, confirmation message

### Models

**Model tier**:
A grouping of ZCode models by capability and cost. Dispatch, ZCode fast screening, and slow review select a tier rather than a specific model name; Jev uses a fixed version outside this tier table.
_Avoid_: model name, model number

**Thought level**:
The depth of the executor's reasoning during a turn, set when the session is created.
_Avoid_: effort, reasoning, thinking tier

**Personal provider config file**:
A JSON file containing one provider that we write for the app-server child process. Its content is derived from the selected provider
(from `~/.zcode/v2/config.json`, or a platform key decrypted from the credentials file for an account provider, D19). The path is passed in `ZCODE_PERSONAL_PROVIDER_CONFIG_FILE` (decisions D14).
_Avoid_: provider table, registry

**Builtin provider config file**:
The `zcode-builtin.json` shipped with ZCode App, whose path is passed to the child process through `ZCODE_BUILTIN_PROVIDER_CONFIG_FILE`.
This project only calculates and passes the path; it neither generates nor changes the file's contents.

**Account provider**:
A coding plan entry prefixed with `account:` in the builtin provider config file (personal / team). After the user signs in to the App with an account (OAuth),
the key is not written to config.json: the App obtains it on the user's behalf and stores it in the credentials file. This project decrypts it and treats it as an ordinary platform key through D14's personal-file path
(decisions D19).
_Avoid_: OAuth provider, zhipu-account

**Credentials file**:
`~/.zcode/v2/credentials.json`, the flat JSON file where ZCode App stores login credentials, mostly encrypted with `enc:v1:` (AES-256-GCM).
This project reads it without writing, decrypts only four keys (active provider, user_info, and two coding plan api-keys), plus `zcodejwttoken` for off-peak sends (D20); it neither reads nor decrypts any other keys.
_Avoid_: key store, keychain

### Observation

**Repo**:
The main repository root corresponding to a session's worktree, determined through git's shared data directory, not guessed from the directory name. Empty if the worktree was deleted or cannot be resolved.
It differs from the registry's `repoRoot`, which records the original repository at `new` time and exists only when cwd is a worktree; repo also has a value when cwd is the main repository itself.
_Avoid_: project name, workspace
