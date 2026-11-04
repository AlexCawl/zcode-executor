# AGENTS.md — zcode-executor

A Claude Code plugin. Claude acts as the foreman: it hands a well-specified development task to the local ZCode (GLM),
which executes it in an isolated worktree, and acceptance is judged objectively with `git diff` and tests.

**Status (2026-10-26)**: the first version is complete and adapted to ZCode App 3.12.2+ (decisions D14; on 2026-10-26 the zero-token checks all passed on App 3.16.3 and a quota-spending smoke run passed on 3.14.5, see verified.md); interjection goes through `v4/command` (D17); the account-type Coding Plan is wired up (credentials-file source, D19); off-peak sends and `quota` (D20) shipped with v0.3.5, and start-plan sends were dropped and then restored (D21, picked back up on 2026-10-09 after the server removed the human verification); v0.4.0 added the watch pane: the `watch` subcommand gained a Claude Code mod (`hooks/`, D22), v0.4.1 renders replies as Markdown with expand beyond two lines, v0.4.2–0.4.3 fixed long commands squeezing the tool name onto two lines and overflowing the card border. On 2026-10-08 the gate was hardened per an external security audit (boundary checks follow the kernel's approach, gate self-protection, task-file snapshots, etc., decisions D23, shipped with v0.5.3). Jev pre-screening supports a `review.jev.proxy` http(s) proxy (D24) and a `review.jev.model` model (D25, default alias `jev-latest`), shipped with v0.6.0. `npm test` runs 817 cases.
Glossary in [docs/CONTEXT.md](docs/CONTEXT.md). Local development records (`docs/handoff/`, `docs/tasks/`, `docs/PLAN*.md`, `docs/archive/`, `docs/SPEC-offpeak.md`, `docs/SPEC-watch-pane.md`, `docs/jev-*-plan.md`, `docs/research/`) are not in GitHub; they exist only on the development machine.
If you have them, pick up from `docs/PLAN-v4.md` and `docs/handoff/handoff-20260908.md`; if not, start from the README and docs/PRD.md.

## Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Protocol | `lib/appserver.mjs` `lib/session.mjs` `lib/providers.mjs` `lib/offpeak-provider.mjs` `lib/startplan-provider.mjs` `lib/scrub.mjs` | Spawns `zcode app-server --stdio`, JSON-RPC request pairing and reverse-request routing, session lifecycle, turn-end detection |
| Workflow | `lib/config.mjs` `lib/credentials.mjs` `lib/offpeak.mjs` `lib/offpeak-check.mjs` `lib/offpeak-send.mjs` `lib/offpeak-run.mjs` `lib/startplan-send.mjs` `lib/startplan-run.mjs` `lib/registry.mjs` `lib/models.mjs` `lib/tiers.mjs` `lib/runs.mjs` `lib/queue.mjs` `lib/run.mjs` `lib/intent.mjs` `lib/tool-summary.mjs` `lib/snapshot.mjs` | Configuration, registry, tier assignment, queue and locks, a runner's life, `runs/<id>/` persistence, per-turn parsing and session snapshots |
| Gate | `lib/gate.mjs` `lib/pending.mjs` `lib/review/` | Hard rules → model review (`workspace/generateText`) → pending, waiting for a human |
| Shell | `bin/zcode-executor` `lib/cli/` `skills/zcode-executor/` `templates/` `hooks/` `types/` | CLI and skill; `hooks/` is the watch-pane mod that only takes effect inside Claude Code (decisions D22) — its runtime has no Node and does not import `lib/`, data comes only from the `watch` subcommand; `types/` holds the type declarations of the mod state, checked by `claude plugin validate`. MCP shell to be added later as needed |

The only cross-layer shared module is `lib/errors.mjs` (`ExecutorError`).

The project targets zcode only; the protocol layer speaks the app-server's JSON-RPC directly, with no ACP in between.

## Hard constraints

- Verify the protocol through the zero-token path first (handshake, create, list, close). Every `session/send` spends real quota.
- Model review only produces allow or escalate-to-human; a denial likewise returns to the human. The human handoff goes through Claude with AskUserQuestion.
- Terminology follows `CONTEXT.md`: session, task file, dispatch, turn, approval request, question, hard rule, model review, pending, model tier, thought level.
- Pure `.mjs`, zero runtime dependencies, no build step.
- `~/.zcode/v2/config.json` and `~/.zcode/v2/credentials.json` are read-only: the former holds plaintext API keys and the App rewrites it; the latter holds the App's encrypted credentials — only the four keys the account-type coding plan needs (D19) and the `zcodejwttoken` for off-peak sends (D20) are decrypted. Keys read from either place only land in D14's temporary personal provider file; the JWT stays in memory and JSON-RPC parameters, never on disk.
- Code ported from zcode-acp keeps its Apache-2.0 copyright notice, recorded in `NOTICE`.
- For troubleshooting read `~/.zcode/cli/log/zcode-YYYY-MM-DD.jsonl`. JSON-RPC error details live in `error.data.details`; `message` is only a one-line summary.
- The DSH plugin is defined in the root `package.json` (`dsh` field + `cordis.patch.yml`); the npm package name is the plugin, installed straight from the desktop app's plugin page; `dsh-plugin/` is its TypeScript source and build output (lib is checked in), subtree-merged on 2026-10-11, the old Gitea repo is frozen. Its only coupling to the CLI is the `watch --json` line protocol. Development and testing: see its [docs/dsh-plugin.md](docs/dsh-plugin.md) and the in-directory README; peer dependencies are all optional, keeping the global CLI install at zero dependencies.

## Releases

The version number changes only in `package.json`; everywhere else (the version badges in the three READMEs, `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`,
`.github/plugin/plugin.json`, `.grok-plugin/plugin.json`, `.antigravity-plugin/plugin.json`, `gemini-extension.json`, `plugin.yaml`) is synced by `scripts/sync-doc-version.mjs`,
hooked to npm's `version` lifecycle script; `npm test`'s `--check` fails if a sync is missed. If a marker in the docs moves, update that script — a missing marker makes it exit non-zero.
The test-count badges in the READMEs are not in sync scope; when the case count changes, update them by hand (plus the README "Development" section and the status line at the top of this file).

```sh
npm version patch      # bumps package.json + syncs version numbers + creates the commit and v* tag; use minor for features
git push --follow-tags # pushing the tag is the trigger
```

`.github/workflows/publish.yml` runs per tag: tests → tag matches the package.json version → `npm publish`
(Trusted Publishing, OIDC, no token) → creates the GitHub Release (`--generate-notes`, commit messages are the changelog).
The only manual configuration: registering the trusted publisher `kyomio/zcode-executor` + filename `publish.yml` in the npmjs.com package settings.
`ci.yml` runs the tests on pushes to main and on PRs (Node 22 and 24).

## What to read when

- What it should do, what the CLI looks like, how the gate flows → [docs/PRD.md](docs/PRD.md); implementation and testing decisions, user stories → [docs/SPEC.md](docs/SPEC.md)
- Before writing code → [docs/RULES.md](docs/RULES.md) (style, comments, output, persistence, tests, commits)
- Where things stand, what's next → `docs/PLAN.md` (local record, not in the repo)
- Taking over development, background → `docs/handoff/handoff-20260908.md` (local record, not in the repo)
- Changing plugin manifests, the marketplace, install methods → the memory bank's "Claude plugin marketplace spec" entry (`search_memories`), official page code.claude.com/docs/en/plugins-reference
- Writing the protocol layer, or facing app-server methods, events, reverse requests → [docs/reference/zcode-app-server-protocol.md](docs/reference/zcode-app-server-protocol.md), cross-checked against the measured facts in [docs/verified.md](docs/verified.md)
- Wanting to change the positioning, swap the protocol, loosen review, rename → read the reasoning in [docs/decisions.md](docs/decisions.md) first
- Need a reference implementation → zcode-acp, mentioned in docs/decisions.md D2 (`npm pack zcode-acp-server`)
