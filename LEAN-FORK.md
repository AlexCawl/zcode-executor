# Lean fork: what was removed and what changed

This branch (`zcode/lean-fork`) trims the upstream [zcode-executor](https://github.com/KyoMio/zcode-executor)
down to one working shape: **a head harness (Claude Code, Codex, …) plans and accepts;
the local ZCode (GLM) executes in an isolated worktree; everything the mechanical gate cannot
clear on its own stops and waits for a human answer.** The reviewer is the head harness
reading the `git diff` — not a chain of screening models.

## Removed wholesale

| Removed | Upstream purpose | Size |
| --- | --- | --- |
| `lib/review/{jev,prompt,evidence,run,parse,complete,proxy-fetch}.mjs` | Model-review pipeline: Jev pre-screen (TypeSafe cloud API) → ZCode fast screen → slow review, prompt assembly, response parsing, `workspace/generateText` wiring | ~1 600 lines |
| `lib/intent.mjs` | Intent gathering that fed the review prompt (task snapshot reading went with it; `snapshotTask` stays as the audit trail) | 74 lines |
| `lib/offpeak.mjs`, `offpeak-send/run/check/provider.mjs`, `lib/cli/quota.mjs` | Off-peak delivery: server tickets, queueing, settling, resume, `quota`, doctor's off-peak self-check | ~1 500 lines |
| `--offpeak` / `--resume` flags, `offpeak.json`, off-peak lines in `status`/`follow`/`cancel`, `readOffPeakAuth` | UX and credentials for the above | — |
| `review.*`, `environment`, `sensitive` config keys | Model-review configuration (now unknown keys → config warnings; remove them from an existing `config.json`) | — |
| doctor steps ④ (review pipeline) and ⑤ (off-peak interface) | Diagnostics of the removed subsystems | — |
| `lib/cli/watch.mjs`, `lib/snapshot.mjs`, `hooks/`, `dsh-plugin/`, `types/`, `cordis.patch.yml`, the `dsh` field / `peerDependencies` / `main`+`exports` wiring, the CI pnpm build | Watch pane (removed 2026-11-05, D22): the `watch --json` NDJSON observer, the Claude Code mod, the DSH desktop plugin and its npm-package wiring | ~470 lines in `lib/` + a TS subtree |

`lib/` went from 10 107 to ~6 550 lines; the test suite from 817 to 475 cases. The watch-pane removal (2026-11-05) took `lib/` to ~6 080 lines and the suite to 414 cases.

## Kept

- **Start-plan sends** (`send --start-plan`, D19/D21 credentials, `lib/startplan-*.mjs`) — account-based dispatch that runs now, no queueing. `lib/builtins.mjs` (new) holds the builtin-provider-file helpers they used to share with the off-peak modules.
- **Every host manifest** (Claude Code, Codex, Copilot, Grok, Antigravity, Gemini, Kimi) and `scripts/sync-doc-version.mjs`.
- **Mechanical gate hardening from the security audit (D23)**: kernel-style path resolution, gate self-protection (`self-guard.mjs`), task-file snapshots at dispatch time, secret scrubbing, private file modes.

## Behavior changes to know

1. **The gate is deterministic.** Hard rules (write outside the worktree, touching zcode-executor's own state, calling its CLI) → pending with the rule id. No `allow_once` in the options → pending saying so. Everything else → pending with stage `manual`. There is **no automatic approval anywhere**: expect more exit-code-5 pendings than upstream; the head agent answers them per the skill's rules (`approve` / `deny` / `answer`, or AskUserQuestion for the user).
2. **Gate events** are `executor.gate` with stages `hard` / `no-allow-option` / `manual` / `question` / `gate-error`. The turn summary prints `放行 N 次（红线挂起 N、转人工 N）` — no fast/slow counters.
3. **Dispatch is always a normal send.** `--task` snapshots still freeze the approval basis at dispatch time; `--steer`, `--wait`, `--stream`, `--start-plan` all work as before.
4. **doctor** is three steps (zcode binary, provider sources, handshake) and never goes online for self-checks.
5. **Old configs keep working** but warn about the removed keys — delete `review`, `environment`, `sensitive` from `~/.zcode-executor/config.json`.

## Why keep the protocol tests that carry off-peak shapes?

`test/session.test.mjs` still sends a few turns with an off-peak-shaped `modelSelection`/`requestAuth`.
Those shapes are protocol-level carriers: the tests exercise `session.send`'s `extraParams`
merging and secret scrubbing, which start-plan turns also rely on. The mock app-server keeps
its off-peak branch only to serve them.
