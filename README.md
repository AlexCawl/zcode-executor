<p align="center"><img src="assets/logo.png" width="128" alt="zcode-executor logo"></p>

<h1 align="center">zcode-executor</h1>

<p align="center"><a href="./README.zh-CN.md">中文</a> · <a href="./README.ru.md">Русский</a> · English</p>

<p align="center"><strong>Claude plans. ZCode codes. Git verifies.</strong></p>

<p align="center">A plugin for Claude Code and other coding agents that hands a well-specified development task to the local <a href="https://zcode.z.ai">ZCode</a> agent (GLM), runs it in an isolated git worktree, guards every write with a hard-rule check plus a model-based review, and lets you verify the result with <code>git diff</code> and tests instead of trusting the agent's own report.</p>

<p align="center"><img src="https://img.shields.io/badge/version-v0.6.1-5B4CF0" alt="v0.6.1"> <a href="https://www.npmjs.com/package/zcode-executor"><img src="https://img.shields.io/npm/v/zcode-executor?label=npm" alt="npm"></a> <img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License"> <img src="https://img.shields.io/badge/node-%3E%3D22-green" alt="Node"> <img src="https://img.shields.io/badge/tests-475%20passing-brightgreen" alt="Tests"></p>

## Why

Claude Code is good at thinking a task through. ZCode grinds out the code at a fraction of the cost. Left alone, either one will happily go off-script. This plugin puts the two in their places:

- **The task file is the contract.** Claude writes `tasks/T-xxx.md`; the message to ZCode is just a doorbell.
- **The worktree is the sandbox.** ZCode works in `~/.zcode-executor/worktrees/<repo>`, never in your main checkout.
- **The gate decides who gets asked.** Every tool call ZCode wants to make passes mechanical hard rules (worktree boundary, self-protection) and everything else stops for a human — you, or the head agent acting for you. Nothing is ever auto-denied or auto-allowed on your behalf. *(lean fork: the model-review pipeline and off-peak queue were removed, see [LEAN-FORK.md](LEAN-FORK.md))*
- **Evidence beats narrative.** You accept with `git diff` and your test suite.

## Quick start

Paste this to your agent (Claude Code, Codex, or anything with a shell):

> `Read https://github.com/kyomio/zcode-executor/blob/main/README.md and install zcode-executor by following its Install section, then run zcode-executor doctor.`

## How to use

You don't drive the CLI yourself. You describe the task to your agent, and it runs the skill: writes a task file, adds a worktree, dispatches to ZCode, waits, then checks the result with `git diff` and your tests before telling you it's done. If ZCode asks for something the gate won't pass on its own, the agent stops and asks you.

Two ways to trigger it:

**Call the skill directly**

```
/zcode-executor add a --json flag to the status command, keep the tests green
```

(The full name is `/zcode-executor:zcode-executor`; the short form works unless another plugin claims it.)

**Or just say so in plain language**

```
Hand the lib/queue.mjs refactor off to zcode.
```

Either way, say what "done" looks like — which command should pass, which file should exist, what output you expect. The agent turns that into the acceptance criteria in the task file, and the task file is the contract; the message sent to ZCode is only a doorbell.

## Two layers

- **Workflow layer** — dispatch and acceptance: task file → isolated worktree → local session id → background runner → `git diff` and tests. This is what the CLI commands and the skill are about.
- **Safety layer** — automatic handling of ZCode's permission requests: a fixed set of mechanical hard rules that nothing can override (writes outside the worktree, touching this tool's own state), then a human for everything else. The gate can *ask*; it never *denies* or *allows* on your behalf.

## How it works

![How zcode-executor works: dispatch, permission gate, verify](https://raw.githubusercontent.com/kyomio/zcode-executor/main/assets/how-it-works.en.png)

_Sequence diagram rendered with [archify](https://github.com/tt-a1i/archify) from [`assets/how-it-works.en.json`](assets/how-it-works.en.json)._

One runner process per session, always in the background; the CLI only reads files under `~/.zcode-executor/runs/<id>/`. Nothing costs tokens except `send` and the review calls.

## Measured cost

The workload below is what it took to build this project: 35 task files, 4 executor sessions, 957M prompt tokens and 2.39M output tokens on the executor side. The same tokens priced three ways at public API list prices, with the cache-read rate fixed at 95% for both models:

![Execution cost for the same workload](https://raw.githubusercontent.com/kyomio/zcode-executor/main/assets/cost.en.png)

| Executor | New input | Cache read | Output | Total | vs Sonnet 5 |
| --- | --- | --- | --- | --- | --- |
| Claude Sonnet 5 | $119.6 | $181.9 | $23.9 | **$325** | 1× |
| GLM-5.3-Flash, list price | $7.2 | $27.3 | $1.2 | **$35.7** | 1/9.1, saves 89% |
| GLM-5.3-Flash via ZCode (67% of list) | $4.8 | $18.3 | $0.8 | **$23.9** | 1/13.6, saves 93% |

Prices used (USD per million tokens): Sonnet 5 $2.50 cache write / $0.20 cache read / $10 output; GLM-5.3-Flash $0.15 / $0.03 / $0.50. Sonnet's new input is billed at the cache-write rate because Claude Code writes every turn into the cache. Cache reads dominate: in an agent loop the whole context is re-read every turn, so the cache-read price is what decides the gap. The measured cache-read rate was actually 99.3%; at that rate the ratio is 7.5× and 11.2×. The planner's cost is the same in every scenario and is left out. Prices as of September 2026: [Claude](https://platform.claude.com/docs/en/about-claude/pricing), [Z.ai](https://docs.z.ai/guides/overview/pricing).

## Install

### Claude Code (plugin marketplace)

This repository is both the plugin and its own marketplace.

```bash
claude plugin marketplace add kyomio/zcode-executor      # or a local path
claude plugin install zcode-executor@zcode-executor --scope user
```

`bin/zcode-executor` is added to Bash's `PATH` while the plugin is enabled; the skill appears as `/zcode-executor:zcode-executor`. Saying "let zcode do it" triggers it.

The plugin also ships a **Claude Code mod** (a module of function hooks, `hooks/`): type `/zcode` to open the [watch pane](#watch-pane), a live view of this project's zcode sessions. It also opens by itself when Claude sends a task, and adds a status-line summary and toasts. Nothing to configure; it needs a Claude Code version with function-hook mods (the API is in early access).

### DeepSeek Harness (DSH)

The npm package **is** the DSH plugin: the root `package.json` carries the `dsh` definition (`cordis.patch.yml` bundle + right-sidebar client), and the plugin code is the built output under `dsh-plugin/lib/` (sources in [dsh-plugin/](dsh-plugin/README.md)). In the DSH desktop app's plugin page, just install by the npm package name `zcode-executor` — the app registers the bundle by itself; no manual `link:` or config editing. The plugin teaches the DSH agent the full dispatch flow (the skill auto-symlinks into `~/.dsh/skills/`) and adds the **"zcode 任务" tab** to the official right sidebar — the same live watch pane, refreshing about once a second at zero quota. Local development: `pnpm install && npm run build` inside `dsh-plugin/`, then restart the desktop app.

### Kimi Work

The repo root ships a native `kimi.plugin.json` (skills only; the Claude Code mod above is Claude-only and not included). Register it into the personal market once, then install from the 个人 tab:

```bash
kimi-daimon kimi-plugin register-personal /path/to/zcode-executor
```

Like the agents below, Kimi Work does not put the plugin's `bin/` on `PATH` — the skill falls back to `bin/zcode-executor` relative to the plugin root, or `npx zcode-executor`. Saying 「让 zcode 去做」「派给 zcode」 triggers the skill.

### Codex

```bash
codex plugin marketplace add kyomio/zcode-executor        # or a local path
codex plugin add zcode-executor@zcode-executor
```

Two differences from Claude Code: Codex does not put a plugin's `bin/` on `PATH` (the skill tells the agent where the binary lives), and the default `workspace-write` sandbox blocks writes to `~/.zcode-executor` — add it to `[sandbox_workspace_write] writable_roots` in `~/.codex/config.toml` or approve when prompted.

### GitHub Copilot CLI

This repository doubles as a Copilot CLI plugin marketplace.

```bash
copilot plugin marketplace add kyomio/zcode-executor
copilot plugin install zcode-executor@zcode-executor
```

### Gemini CLI

A `gemini-extension.json` at the repo root makes it a Gemini CLI extension; the bundled `skills/` are discovered automatically.

```bash
gemini extensions install https://github.com/kyomio/zcode-executor
```

### Antigravity

Antigravity (`agy`) loads the native `.antigravity-plugin/plugin.json`; skills under `skills/` load automatically.

```bash
agy plugin install https://github.com/kyomio/zcode-executor
```

### pi

pi reads the `pi` field in `package.json` and installs the package directly.

```bash
pi install npm:zcode-executor
```

### OpenClaw

No manifest needed — link the skill into its user skills directory:

```bash
ln -s "$(npm root -g)/zcode-executor/skills/zcode-executor" ~/.openclaw/skills/zcode-executor
```

### Hermes

The repo root ships a Hermes `plugin.yaml`; install, then enable:

```bash
hermes plugins install kyomio/zcode-executor
hermes plugins enable zcode-executor
```

### Grok Build

`.grok-plugin/` carries its marketplace manifests, and the skill itself is one symlink away (it also reads `~/.agents/skills/`):

```bash
ln -s "$(npm root -g)/zcode-executor/skills/zcode-executor" ~/.grok/skills/zcode-executor
```

None of the seven agents above puts the plugin's `bin/` on `PATH` the way Claude Code does — run `npm install -g zcode-executor` once, or let the skill fall back to `npx zcode-executor`; the SKILL.md covers both.

### npm (any agent, or no agent)

```bash
npm install -g zcode-executor   # zero dependencies, nothing to build
zcode-executor doctor           # zero-token self-check
```

Or run it without installing: `npx zcode-executor doctor`. The skill ships in the package at `$(npm root -g)/zcode-executor/skills/zcode-executor/`; copy or symlink it into your agent's skills directory. The CLI itself has no Claude-specific dependency.

```bash
SKILL=$(npm root -g)/zcode-executor/skills/zcode-executor
mkdir -p ~/.claude/skills && ln -s "$SKILL" ~/.claude/skills/zcode-executor
```

Swap in your own agent's directory from this table:

| Agent | User skills directory |
| --- | --- |
| Claude Code | `~/.claude/skills` |
| Codex | `~/.codex/skills` |
| Gemini CLI / Antigravity | `~/.gemini/skills` |
| Grok Build | `~/.grok/skills` |
| Hermes | `~/.hermes/skills` |
| OpenClaw | `~/.openclaw/skills` |
| opencode | `~/.config/opencode/skills` |
| Shared (several agents read it) | `~/.agents/skills` |

### From source

```bash
git clone https://github.com/kyomio/zcode-executor && cd zcode-executor
npm link && zcode-executor doctor
```

```bash
ln -s "$PWD/skills/zcode-executor" ~/.claude/skills/zcode-executor
```

Swap in your agent's directory from the table in the npm section above.

### Requirements

- macOS or Linux. **Windows is not supported yet.** The ZCode app bundle is looked up where each platform puts it (`/Applications/…`, `/opt/ZCode/…`, `/usr/share/zcode/…`); installed anywhere else, point `ZCODE_BIN` at `zcode.cjs`.
- Node ≥ 22 (ZCode's app-server needs `node:sqlite`).
- ZCode desktop app **≥ 3.12.2** installed and logged in (3.11 and earlier are not supported). Both login styles work: an account (OAuth) Coding Plan — the CLI decrypts the platform key the App stores in `~/.zcode/v2/credentials.json` (individual and team plans; only the four keys it needs are ever read, plus `zcodejwttoken` for start-plan sends) — or an API-key provider in `~/.zcode/v2/config.json`. Both files are read-only; nothing is ever written back.

## Recommended workflow

This is how zcode-executor itself was built:

1. **Plan with Claude Fable.** The strongest reasoning model does the grilling, writes the spec, and turns it into task files with machine-checkable acceptance criteria.
2. **Execute with ZCode.** Each task goes to a GLM session in its own worktree through `zcode-executor`; the permission gate handles the routine approvals.
3. **Fable does a coarse pass, Opus does the review.** Fable checks `git diff` and runs the tests; if they hold, it dispatches an Opus subagent for a line-by-line code review. Findings go back to the same ZCode session as a follow-up task file.
4. **Merge on evidence.** Nothing lands until the tests and the review both pass.

The split keeps the expensive model on judgment and the cheap one on typing.

## Watch pane

The pane is not Claude Code-only: the Claude Code plugin and the DSH plugin each ship one, both fed by the same `watch --json` stream.

**Claude Code** (terminal or the desktop Code tab): type `/zcode` to open a live pane showing what this project's zcode sessions are doing:

- **Needs you**: pending permission requests (full command and reason), questions, runners that died;
- **Running**: the executor's latest message rendered as Markdown, the tool it is running with its arguments, recently finished tools (failures in red);
- **Finished**: sessions that ended in the last 10 minutes show the outcome and their last message; older ones take one line each.

A message longer than two lines is folded to its first two; press **Expand reply** to read it in full and **Collapse** to fold it again.

The pane opens by itself when Claude sends a task. The status line sums up running turns and pending requests, and a toast pops on a pending request, a finished turn, or a dead runner. The pane is read-only: pending requests still go through Claude.
It reads `zcode-executor watch --json` (read-only, long-running, no quota) and shows only sessions of the repository the Claude session is in. If the pane says node cannot be found, set `nodePath` in the plugin's settings.

**DSH**: the `dsh-plugin/` install above shows the same live view in the right sidebar's "zcode 任务" tab, refreshing about once a second at zero quota. It is read-only there too — pending requests go to the dispatching agent, which handles them per the skill's answering rules.

Other agents have no pane and keep using the skill and the CLI.

## Commands

| Command | What it does |
| --- | --- |
| `doctor [--json]` | Self-check that spends no quota: finds `zcode.cjs` and the bundled `zcode-builtin.json` (ZCode App ≥ 3.12.2), reports both provider sources, does one real handshake, reports model tiers |
| `models [--json]` | Lists available models with thought levels and tier assignment |
| `new --cwd <abs> [--title T] [--tier fast\|strong] [--thought L] [--deny "Tool…"] [--provider id] [--json]` | Registers a session (returns a local id `x_…`); the ZCode session is created on first `send` |
| `send <id> <text\|-> [--task file] [--wait] [--timeout s] [--steer] [--stream] [--json]` | Queues a message; `--wait` follows until done or blocked; `--task` is the task file the pending answer uses as your authorization; `--steer` injects into a running turn — it takes effect at the next tool boundary, or after the turn ends if there is none |
| `follow <id> [--timeout s] [--stream] [--json]` | Follows a background runner until a result or a pending request |
| `status <id> [--tools N] [--json]` | Read-only snapshot: phase, recent tools (with command or path), queue, pending, last result |
| `list [--project kw] [--json]` | Registered sessions with phase, tier and last outcome; `--json` adds the owning repository |
| `watch [--json]` | Read-only, long-running: prints a session snapshot whenever one changes; feeds the watch pane |
| `cancel <id>` | Denies any pending request, stops the turn, clears the queue |
| `approve <id>` / `deny <id>` | Answers the pending permission request (allow is `allow_once` only) |
| `answer <id> [--] <values…>` | Answers the pending question by index, value or label; multi-select comma-separated |

Exit codes: `0` done · `1` usage / cannot start · `2` refused (whitelist, unknown session, bad tier) · `3` `--wait` timed out (turn cancelled) · `4` turn failed / cancelled · `5` **blocked, waiting for a human** (permission or question).

## Configuration

`~/.zcode-executor/config.json` (override the directory with `ZCODE_EXECUTOR_HOME`). Every field is optional.

| Field | Default | Meaning |
| --- | --- | --- |
| `allowedRoots` | `["~/.zcode-executor/worktrees"]` | Directories `new --cwd` may point into (symlinks resolved) |
| `waitTimeoutSec` | `3600` | `send --wait` timeout; the turn is stopped when it fires |
| `preferredProvider` | account individual plan › account team plan › `config.json` coding plan | Which provider to pick when the same model exists under several, e.g. `account:bigmodel-team-coding-plan` |
| `tiers` | auto by name | Override which model is `fast` / `strong` |

## Safety model

- **Hard rules** are code constants, never configuration: any path-bearing tool writing outside the worktree stops for a human. The rule table follows the categories of Claude Code's auto mode (credentials, exfiltration, destructive git, deletion, supply chain, persistence, deploys, shared resources, external writes).
- **The gate never denies.** Its only outcome is *ask* — a hard-rule hit carries the rule id, everything else says why it stopped. Deciding allow or deny is always a human's (or the head agent's) move.
- **Allow only when allowed.** `approve` requires an `allow_once` option; there is no "always allow" and no automatic approval.
- **Secrets are tightly scoped.** ZCode's provider key goes only to the app-server path; known secret values are scrubbed from `pending.json`, events and logs.
- **Answers are bound to requests.** Every `approve`/`deny`/`answer` carries the request id; stale answers are discarded.
- **The gate guards itself.** Anything that touches zcode-executor's own data directory (except the default `worktrees/` root and the current session's worktree) or invokes the `zcode-executor` CLI stops for a human. The executor runs as the same OS user as the runner, so this only catches plain spellings: variable splicing or a script written first and run later is not recognised and still relies on the human.
- **The approval basis is frozen at send time.** The task file is snapshotted when the turn is queued; editing the task file afterwards cannot change what the pending answer can be checked against as "what the user said".
- **Host-agent credentials are not passed down.** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GITHUB_TOKEN`, `GH_TOKEN` and similar variables are stripped when ZCode is spawned; add `--deny "WebFetch WebSearch"` when the task does not need network access. This removes those two tools; Bash, js and MCP tools can still access the network.

## Development

```bash
npm test          # 475 cases against a scripted mock app-server, plus a doc-version drift check; no tokens spent
node --check lib/**/*.mjs
```

Releases are tag-driven: `npm version patch` bumps `package.json`, syncs the version into all three READMEs and every host's plugin manifest, and commits and tags; `git push --follow-tags` triggers the workflow that runs the tests, publishes to npm (Trusted Publishing, no token) and creates the GitHub Release. Commit messages are the changelog.

Pure `.mjs`, zero runtime dependencies, no build step. Design documents live in `docs/`: [PRD](docs/PRD.md), [SPEC](docs/SPEC.md), [CONTEXT](docs/CONTEXT.md) (glossary), [RULES](docs/RULES.md) (coding rules), [decisions](docs/decisions.md), [verified](docs/verified.md) (facts measured against the real app-server). Agent-facing entry point: [AGENTS.md](AGENTS.md).

See also the [DSH plugin](docs/dsh-plugin.md) and [protocol reference](docs/reference/zcode-app-server-protocol.md). Each document links to its English, [Chinese](docs/PRD.zh-CN.md), and [Russian](docs/PRD.ru.md) editions.

## FAQ

**Does it work with agents other than ZCode?** No, by design. The executor side is ZCode only; the planning side can be Claude Code, Codex or anything that runs a shell.

**Why not just let Claude edit the code?** Cost and isolation. ZCode's GLM coding plan is credit-based and far cheaper than frontier-model tokens (inside ZCode it is billed at a 67% discount), and the worktree keeps two agents from editing the same files.

**How much does a task cost?** Measured in tokens, a one-file change is roughly 30–65k input on ZCode's side (its system prompt is heavy). Billed against the coding plan's credits at ZCode's discounted rate, that is a small fraction of doing the same edit with a frontier model.

**What happened to model review and off-peak sends?** This is a lean fork: the gate is mechanical (hard rules, then a human) and dispatch is always a normal send. See [LEAN-FORK.md](LEAN-FORK.md).

## License

Apache-2.0. Ported code keeps its original notices; see [NOTICE](NOTICE).
