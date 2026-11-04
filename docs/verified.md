# Local verification (2026-09-07)

English · [中文](verified.zh-CN.md) · [Русский](verified.ru.md)

These records describe the situation at the time. Check that files, versions, and commands still exist before using them.

## 3.16.3 check (2026-10-26, App 3.16.3 / CLI 0.17.0, zero tokens)

- Upgrade check; no code changes needed. All five `doctor` steps passed (account-based team key selected). `scripts/probe.mjs` was not run (no protocol-surface differences).
- Checked zcode.cjs source: every required method remains—`session/create|send|subscribe|stop|close|list|resume|fork|setMode`, `workspace/generateText|cancelGenerateText`, `v4/command|commands/query`, `interaction/requestPermission|requestUserInput|requestProviderRuntimeHeaders`; `turn.completed` and the `resultType` enum (success/cancelled/error_max_turns/error_max_budget/error_during_execution/error_max_tool_calls) are unchanged character for character. Track D's trigger (v4 migration) has not appeared.
- All additions are v4 extensions (`v4/attachment/*`, `v4/conversation/subscribe|resync|usage`, `v4/offPeak/lifecycle`, `workspace/hooks/trustGrant`, `session/compact|messages|read|goal|subagents|usage`, etc.); old APIs remain. `v4/conversation/subscribe` has appeared—more groundwork is available for track D.
- No quota-consuming turn was run; a complete off-peak send was not rerun on the new version. `OFFPEAK_VERIFIED_APP` remains 3.14.1.

## 3.15.3 check (2026-10-14, App 3.15.3 / CLI 0.16.9, zero tokens)

- Upgrade check; no code changes needed. All five `doctor` steps passed (account-based personal plan selected); every `scripts/probe.mjs` check passed (handshake, create/subscribe/list/resume/close, matching 3.14.5). `npm test` 803/803.
- Checked zcode.cjs source: `session/*`, `v4/command`, `workspace/generateText|cancelGenerateText`, `provider/updateAccountConfig`, `interaction/request*`, `modelSelection`/`selectionScope`/`requestedDelivery`, and `zcodejwttoken` remain; the start-plan endpoint `zcode.z.ai/api/v1/zcode-plan/anthropic` and GLM-5.3/5.3-Flash models remain. All ten account-provider kinds remain in the builtin provider file.
- No quota-consuming turn was run (protocol surface unchanged from 3.14.5, low risk); a complete off-peak send still has not been rerun on the new version. `OFFPEAK_VERIFIED_APP` remains 3.14.1.

## Start-plan sends re-enabled: live check (2026-10-09, App 3.14.5, after restoring implementation e26fedb)

- Zero-cost protocol-surface check: `provider/updateAccountConfig`, send's `modelSelection`/`modelExecution.selectionScope`, and the builtin start-plan entry (models GLM-5.3-Flash/5.2/5-Turbo, endpoint zcode.z.ai/api/v1/zcode-plan/anthropic) are all present in 3.14.5. `npm test` 755/755.
- One quota-consuming send: `send x_* "写 sp.txt" --start-plan --wait` (`写 sp.txt` means “write sp.txt”). The request reached the zcode-plan endpoint through `account:bigmodel-start-plan`, and **the 2026-09-29 `captcha verify failed` did not recur**—captcha verification has been removed and JWT authentication passed. The server returned business error 1005 `exceed quota limit` (Start Plan subscription quota exhausted); the turn ended failed with exit code 4, with clean event records and error attribution. Channel adaptation is established; add a successful turn when quota is restored.

## 3.14.5 smoke test (2026-10-09, App 3.14.5 / CLI 0.16.9)

- Upgrade check; no code changes needed. All five `doctor` steps passed; every `scripts/probe.mjs` check passed (old-method handshake, create/subscribe/list/resume/close).
- Checked zcode.cjs source: all methods and reverse requests we use remain—`session/create|send|subscribe|close|list|stop`, `v4/command`, `interaction/requestPermission|requestUserInput|requestProviderRuntimeHeaders`, `workspace/generateText`; new methods (`session/goal|fork|compact|usage`, etc.) are additive. `~/.zcode/v2/config.json` remains a `provider` table with plaintext apiKey.
- One short quota-consuming turn: `real-send --yes --on-permission allow` wrote hi.txt; create (flash/high) → Write triggered `interaction/requestPermission` → allow → `turn` settled as done after 13 seconds, usage `{input 67365 / output 157 / cacheRead 33536}`, no error code.
- Off-peak: `quota` zero-quota path worked (`canTakeNumber:true`, today 0/3). A full off-peak send was not rerun on 3.14.5 (requires an off-peak window); `OFFPEAK_VERIFIED_APP` still records 3.14.1, and doctor's notice remains.

## 3.14.1 smoke test (2026-09-22, App 3.14.1 / CLI 0.16.9, plugin 0.3.1, two short quota-consuming turns)

- Zero tokens: all four `doctor` steps passed (account-based personal plan selected); every result from `scripts/probe.mjs` and the v4 probe matched 3.12.2 exactly (old-method handshake, `v4/command` ACK shape, id-less stop ignored). The v4 `stop` ACK added `memoryEnabled:false`, which can be ignored.
- Full plugin path: `new` (automatically selected provider `account:bigmodel-individual-coding-plan`) → `send` (background runner) → `send --steer` during the turn → `follow`. Interjection ACK `delivery:"queue"`, events `turn.steerQueued` → `steerDrained`; c.txt was written according to the interjection. Three Write requests passed fast screening; `state.steerUnavailable` was null.
- cancel: during the second turn, `cancel` at the first Write produced `turn.completed resultType:"cancelled"` within one second; `last.outcome` cancelled, exit code 4, none of six files written, runner exited and lock deleted. Events and runner.log contained no `enc:v1`, no temporary provider directory remained, and no app-server was orphaned.
- Found and fixed a display issue: the final “改动” (changes) summary omitted a.txt—Read also omitted input but had no permission event, so fallback logic borrowed the first Write's approval input. Changed it to borrow only from the same tool name (`lib/cli/common.mjs`).

## Checkpoint 6c: live account-based Coding Plan (2026-09-21, App 3.12.2, one short quota-consuming turn)

- `doctor`: ② account-based coding plan signed in (bigmodel, personal key present, team key present); 3 usable providers in config.json (fallback source); selected `account:bigmodel-individual-coding-plan` (apiKey present); ③ handshake succeeded, fast=GLM-5.3-Flash, strong=GLM-5.3. `--json` field `config.sources.account` = `{ok:true, providerCount:2, family:"bigmodel", plans:["individual","team"]}`.
- `models`: the two account providers are listed first; thought levels low/high/max (derived from `reasoningLevel.values` in the builtin file's `modelRules`; same set as legacy low/max/high, different order).
- `scripts/real-send.mjs` (account-based personal provider selected automatically by priority): create `providerId:"zcode-executor"` (personal file), GLM-5.3-Flash; one Write permission request allowed, turn `done` in 15 seconds, correct file contents. Event file contained neither `enc:v1` nor strings in the “32 characters.16 characters” form; no `zcode-executor-provider-*` directory remained in `os.tmpdir()`.
- The team key was verified only as decryptable and usable in the provider table; no live send used it (personal is selected by default; set `preferredProvider` in plugin configuration to use the team plan).

## Checkpoint 6b: live interjection and stopping (2026-09-21, App 3.12.2, two short quota-consuming turns)

`scripts/real-send.mjs --steer-after 8 --steer-text …` and `--stop-after 6`, GLM-5.3-Flash, all permission requests allowed:

| Check | Result |
| --- | --- |
| `v4/command sendText` during a turn (`requestedDelivery:"guide"`) | ACK `{status:"accepted", result:{delivery:"queue"}}`—**guide never appears in the ACK** (matching source); the event stream then emits `turn.steerQueued` (payload `delivery:"guide"`, `pendingInputId:"queue_<commandId>"`) → `turn.steerDrained` (`injectedMessageIds`, `drainedInputs[].delivery:"guide"`). Injection happened after writing b.txt and before c.txt (tool boundary); c.txt finally contained `hello-steer` as requested, turn `resultType:"success"` |
| `session/stop` during a turn (request with id) | Returned `{}`; `turn.completed` arrived in the same second, `payload.resultType:"cancelled"`; `Session.send()` settled outcome `cancelled`, reason “回合被叫停（resultType=cancelled）” (turn stopped). Both turns took about 6 seconds from send to effective stop, and wrote no further files |
| Event kinds | Each turn had only `turn.started` and `turn.completed` (plus steerQueued/steerDrained for the steer turn); no `turn.failed` or `turn.terminal` |

## Local environment

| Item | State |
| --- | --- |
| ZCode desktop App | 3.11.2, signed in, running, installed that day (`recentProjects` empty) |
| ZCode CLI | 0.16.5, at `/Applications/ZCode.app/Contents/Resources/glm/zcode.cjs`; the App did not add it to PATH |
| Credentials | `~/.zcode/v2/config.json`; `builtin:bigmodel-coding-plan` has a key, models `GLM-5.3` / `GLM-5.3-Flash`; `builtin:zai-start-plan` disabled with empty models |
| Node | The app-server child needs Node ≥ 22 with `node:sqlite`; zcode-acp's `backend/resolve.js` has detection logic |

## Jev three-stage pre-screen pipeline (D16, T7 zero-cost acceptance)

- Implemented an early Jev pass; flag/error/skip/exceptions proceed to the original ZCode fast screen, then slow review if needed; a failed original fast-screen call still asks a human. Question-set version approval-v2, fixed jev-1.13.0, threshold unchanged at 0.20.
- TDD slices: doctor RED 4→GREEN 9/9; adapter repeated RED→GREEN, finally 25/25; gate/review 75/75; runner 29/29; real-review script 4/4. Final `npm test` **384/384**, exit code 0, version-marker check passed; no runtime dependencies.
- Independent read-only review found issues that were fixed and rechecked: outbound credential tails from line continuation/escaped spaces/concatenated quoted values; incorrect path marking for escaped whitespace. Rechecks used synthetic secrets and fake fetch; risky credentials produced local skip and zero requests, and original incorrect-path text was retained. Final scoped Approve, no unresolved Required/Critical; this does not guarantee unknown encodings, arbitrary shells, symlink races, or actual model accuracy.
- Integration assertions cover the four preScreen outcomes versus final reviewer, a single gate event, and original bodies reaching the original fast screen. Regression tests cover fixed response model, metadata-value filtering, final deadline check, non-2xx body cancellation, jitter, and skip on window truncation. Cancellation of an untrusted body promise is not awaited; no claim is made that malicious substitute resources can be forcibly released.
- doctor displays the complete pipeline; review state is null on configuration errors rather than incorrectly reporting ZCode. real-review's fixed Write now skips Jev locally and is explicitly not a Jev HTTP performance probe; disabled review is rejected before spawn/payment.
- This round made no real Jev HTTP request, no paid session/send, and no new performance comparison. Chinese-data calibration for approval-v2 and paired measurement of the three-stage pipeline still require separate confirmation; old samples do not prove the new version safe.
- One intermediate review-runner suite produced runner-gone; temporary logs had been removed by test cleanup, so the cause is unproven. A later independent 12/12 run and all corresponding cases in the final full suite passed; the unreproduced issue is not claimed to have been diagnosed and fixed.

## Optional Jev fast screen (2026-09-18, historical record of the old replacement approach)

> These records describe the version before fixes and cannot serve as acceptance evidence for the new three-stage pre-screen approach. Later review found gaps in path replacement, unknown-credential handling, metadata values, and deadline races. “Verified” here applies only to the samples at the time, not a comprehensive safety guarantee.

- Automated fake transport verified fixed `jev-1.13.0` / `approval-v1`, five Noul items, threshold 0.20, minimal state, omitted bodies, credential redaction, path normalization, bounded retries, and a total deadline covering response-body reading.
- gate/runner mocks verified: Jev pass makes zero `workspace/generateText` calls; Jev flag/error/adapter throw enters ZCode slow review exactly once; each permission request still records only one final `executor.gate`.
- doctor was verified to report only the selection for a newly started runner, without calling TypeSafe, making `session/send`, or displaying the key.
- `scripts/real-review.mjs` supports both real paths, with and without a configured key, requires explicit `--yes`, and prints neither complete Jev state, tool bodies, nor raw model output.
- Live verification with a real TypeSafe key (2026-09-18): first dispatched a session to write `jev-smoke.txt`; the default 3-second deadline produced `deadline_exceeded`, followed as designed by one ZCode slow review and allowance. A direct Jev call with the same minimal action and a temporary 15-second deadline returned pass in 4.665 seconds. This led to changing the internal default total deadline to 10 seconds (without widening public configuration). Another send to the same real session wrote `jev-direct-pass.txt`; Jev passed directly in 1.290 seconds, recording the single event `review-fast:allow`, with zero ZCode slow reviews. Actual model `jev-1.13.0`, all five probabilities <=0.20. Negative event checks found no key, Authorization, full state, or task body. Mocks still cover uncontrollable network/429/schema failures; those must not be described as live failure evidence.

## Cross-platform (2026-09-08, verified in CI)

- All four GitHub Actions combinations—ubuntu-latest and windows-latest, Node 22 and 24—run without installing dependencies.
- **Do not quote the glob for `node --test`.** `node --test 'test/*.test.mjs'` matches no files on Windows:
  npm starts scripts there with pwsh/cmd, which does not strip single quotes; node receives a literal string containing quotes.
  When `node --test` matches no files, **the exit code is 0** (verified locally), making the whole CI combination falsely green, with `tests 0` buried in logs.
  Removing quotes works on both: POSIX shells expand the glob themselves, while Windows leaves it to node.
- **Do not pass a directory.** `node --test test/` also runs non-test files such as `helpers.mjs` and `mock-appserver.mjs` as tests and fails outright.
- **Known real Windows gaps (verified in CI, not test defects)**:
  - Queue filenames cannot contain colons. ISO timestamps used directly as filenames produce ENOENT on Windows, breaking every `send` (fixed, `lib/queue.mjs`).
  - `SIGTERM` is not received. The Node handler does not run, runner cleanup (finalizing state, deleting the lock) does not happen, exit code is null rather than 0,
    and the lock file remains. Supporting this requires another shutdown signal on Windows.
  - `process.kill(-pid, 'SIGKILL')` cannot kill a process group (`lib/appserver.mjs`); only the direct child can be killed, leaving zcode grandchildren orphaned.
    CI does not cover this (requires real zcode); the conclusion comes from reading code.
  - Path containment uses string-prefix comparison (`lib/review/hard.mjs`); Windows case insensitivity can be mistaken for an escape.
    This is conservative (more human referrals, no mistaken allowance) and likewise not covered by CI.
- **Two cases fail intermittently in CI**: “exitAfter:send 重投” in `run.test.mjs` (resend after exitAfter:send) and
  “信封 id 只保留最近 5 个” in `appserver.test.mjs` (retain only the latest 5 envelope ids). Both launch real child processes and depend on timing. Three consecutive runs of the same commit failed one case each in the first two runs; the third passed entirely.
  Three local runs each on Node 22 and 25 all passed. Rerun once before interpreting a red result.
- Six suite cases use Unix-only mechanisms (SIGSTOP to freeze the runner, `/tmp` symlink normalization) and are skipped on Windows; these are not product defects.
- ZCode App locations (copied from zcode-acp `resolve.js`, `bundledZcodeCandidates`): macOS `/Applications/ZCode.app/…`
  and `~/Applications/…`; on Linux, common paths are `/opt/ZCode/resources/glm/zcode.cjs` and `/usr/share/zcode/resources/glm/zcode.cjs`,
  but the official description is “inside the extracted application directory”, so the location is not fixed; Windows `%LOCALAPPDATA%\Programs\ZCode\resources\glm\zcode.cjs` (unverified).
  All three platforms can fall back to `ZCODE_BIN`.

## app-server protocol

The full protocol is in `reference/zcode-app-server-protocol.md`. Below are locally observed parts
that are undocumented or differ from the documentation. Checks used zcode-acp-server 0.17.1;
items marked “not applicable to direct connection” are behaviors created by zcode-acp itself.

| Check | Result |
| --- | --- |
| Startup | `[node, zcode.cjs, "app-server", "--stdio"]`; coder-mcp-bridge also sets `ELECTRON_RUN_AS_NODE=1`, `NO_COLOR=1`, and removes `ZCODE_MODEL` |
| Envelope | No `jsonrpc` field starting with 0.16+: request `{id, method, params}`, response `{id, result}` / `{id, error}`, notification `{method, params}` |
| Handshake | Newer app-server versions first send the reverse request `session/requestRuntimePreferences`; without an answer, `session/create` stalls. zcode-acp answers `{nativeSearchEnhancementsEnabled:false, memoryEnabled:false, askUserQuestionAutoResolutionEnabled:false}` |
| `session/create` | Immediately returns a real `sess_` id. coder-mcp-bridge sends `{workspace:{workspacePath,workspaceKey}, persistence:"immediate", titleGenerationEnabled:false}` plus optional `mode` (plan/build/edit/yolo/auto), `toolAllowlist`, `toolDenylist`, `runtimeModel`, `thoughtLevel` |
| Reverse requests | `interaction/requestPermission`, `interaction/requestUserInput` (AskUserQuestion, ExitPlanMode), `interaction/requestProviderRuntimeHeaders`, `interaction/requestOfficialMcpAuthHeaders`. Unanswered requests resend every second with the same `params.requestId` but **a different envelope id each time**; zcode-acp records every envelope id, answers each when the result is ready, and caches it for late resends (`handlers/server-requests.js`, lines 271 to 290). Whether the peer accepts answering only the first envelope id is unverified; do not assume it |
| Approvals | yolo mode makes 0 permission requests and writes files directly. Allow-type optionId contains `allow_once`; unrecognized ids all mean deny. **Response shape** (zcode-acp `interaction/adapter.js` and `handlers/server-requests.js`): `requestPermission` answers `{decision:"allow"}` or `{decision:"deny", reason}`; `requestUserInput` (AskUserQuestion) answers `{action:"accept", content:{answers:{[question 原文]: "value"}}}` (`question 原文` means original question text; join multiple selections with `", "`), or `{action:"decline", reason}` to decline; ExitPlanMode also uses `{decision}`, but does not occur in build mode |
| Turn completion | Events `turn.completed` / `turn.failed` / `turn.terminal`. zcode-acp also has fallbacks for 120 seconds without signals and a 10-minute frozen watermark; whether direct connection needs them remains unverified |
| `session/send` | Sending another message during an active turn queues it as steer input |
| Event kinds | `turn.started`, `model.streaming`, `tool.updated`, `turn.completed`, `turn.failed`, `session.updated`, `state.updated` (model/mode changes); `computer-use/operation-event` and `process/mcpTelemetry` can also be discarded |
| resume | Cross-process resume preserves model selection and context (with zcode-acp 0.17.1, the first send after resume was rejected because provider-table synchronization failed to filter empty providers; fixed in 0.18.1; filter them ourselves for direct connection) |
| Removed methods | 0.16+ removed `session/steer`, `session/rewind`, `prompt/enhance*`; 0.16.5 removed `automation/*` |
| `workspace/generateText` | Extracted from zcode.cjs zod schema (not called live): params `{workspace, modelRef:{providerId,modelId,variant?}, prompt 或 messages（至少一个）, tools?, querySource（必填字符串）, maxOutputTokens?, operationId?}` (at least one of prompt or messages; querySource is a required string), **no thoughtLevel field; thought level goes through `modelRef.variant`**; result `{text, modelRef, toolCalls?, finishReason?, usage?}`. Reuses an existing session process for the workspace, or starts and closes a temporary one. `cancelGenerateText` params `{operationId}`. zcode-acp does not use it |
| `workspace/readState` | The only method returning the complete available-model set. Params `{workspace, preferWorkspaceDefaults?, runtimeModel?}`; result `settings.model.{current,available[],lastUsed}`, each model has `ref、label、reasoning.{enabled,levels[],defaultLevel}、disabledReason`; `settings.thoughtLevel.{enabled,current,defaultLevel,available[]}`. `session/read` result contains the same settings. zcode-acp does not use it, reading config.json directly |
| Thought level | A free string at protocol level, with legal values defined by model. GLM-5.3 family `low / high / max` (default max), no medium or off; GLM-5.2 has `nothink`; toggle models use `enabled / disabled`. Invalid values passed to `session/create` are **silently ignored**, with only a warn; `session/setThoughtLevel` reports errors. CLI recognizes `disabled/none/off/nothink` as off, but a value is usable only if present in that model's levels |
| diff | Protocol supplies changed filenames only, not contents. Acceptance uses `git diff` |

## Direct-connection probe (2026-09-07, CLI 0.16.5, T0.2)

| Check | Result |
| --- | --- |
| Direct `session/create` | **Rejected unless the provider table is pushed first**: `-32603 ModelProtocolError: Model config is missing. Create ~/.zcode/cli/config.json with an explicit model provider`. Local `~/.zcode/cli/config.json` contains only `skills`; all models and providers are in `~/.zcode/v2/config.json`, which app-server does not read itself |
| Provider table | Before `session/create`, zcode-acp sends `workspace/updateProviderRegistry {workspace, registry:{providers[], generatedAt, revision}}`, constructing registry from `provider` in `~/.zcode/v2/config.json`: each entry `{providerId, kind, apiFormat（anthropic→anthropic-messages）, baseURL, label, models[]（数组，不是对象）, source, apiKey:{source:"inline", value}}` (apiFormat maps anthropic to anthropic-messages; models[] is an array, not an object); each `models[]` entry `{modelId, label?, contextWindow?, maxOutputTokens?, reasoning:{enabled, levels[{value,label}], defaultLevel}}`. **Filter providers with empty models** (schema requires ≥1); local `builtin:zai-start-plan` has an empty **array** `[]` for `models` (the others use objects) |
| Local config.json shape | Top level contains only `provider`; all six providers use `kind:"anthropic"`, `source:"custom"`, and an omitted `enabled` means enabled; `options.{apiKey, baseURL, apiKeyRequired?}`; `models` is an object `{GLM-5.3:{…}, GLM-5.3-Flash:{…}}` |
| `session/requestRuntimePreferences` | **Not received** on direct 0.16.5 connection (at least before create was rejected). Keep the response handler, but do not wait for it |
| `workspace/readState` before pushing the table | Returns normally, but `modelCatalog.available` and `settings.model.available` are empty; `current` is `{providerId:"zcode-unconfigured", modelId:"missing-model"}`, `thoughtLevel.enabled:false`. Tier assignment must therefore read after pushing the table |
| After pushing the table (T0.2b) | `updateProviderRegistry` returns ok; backend records `revision` unchanged as `appliedProviderRevision` (change gate; a stable hash helps). `session/create` succeeds with `sess_` id and settings: `mode.current:"build"`, `thoughtLevel.current:"high"` (input accepted and echoed, available `low/high/max`, defaultLevel `max`); **default model is under `builtin:bigmodel` (API-key billing), not coding-plan**. Each model name appears under three providers, 6 entries total. `list` returns an array including the new id; `close` returns `{closed:true}` |
| Response shapes (T0.3 capture) | `updateProviderRegistry` returns `{appliedProviderRevision, providerCount, status, workspace, workspaceState}`; `session/list` returns an **object `{sessions:[…]}`** (entries include sessionId, etc.), not a bare array; `session/subscribe` **requires `deliveryKind`** (use `desktop-continuous`), otherwise rejected |
| `toolDenylist` | `['WebSearch']` accepted by schema, no create error. Actual tool blocking awaits a turn |
| `session/requestRuntimePreferences` timing | Arrives **after create succeeds**, params `{sessionId, scope:"runtime-materialization"}`. It is a post-create materialization request, not a prerequisite handshake; the handler must remain active, not just wait before create |
| CLI log | Probe session has only info and one warn `session.model_selection.persist_failed` (Session model selection persistence failed, no details), no error. Warn impact unknown; recorded for now |

## 3.12.2 direct-connection probe (2026-09-18, App 3.12.2, CLI --version still 0.16.5)

3.12.2 replaced “host pushes the provider table to app-server” entirely with “app-server reads two files itself”, making the old handshake incompatible.
Five layers in total: the first two are visible to the user, while the last three appear only after fixing the first two (see decisions.md D14):

| Layer | Symptom | Actual cause | Impact |
| --- | --- | --- | --- |
| 1 | `zcode: 无法定位 CLI ZCode Built-in Provider Config：…/glm/provider/zcode-builtin.json, /config/provider/zcode-builtin.json` (cannot locate CLI builtin provider config); child exits immediately with code=1 | New CLI locates builtin provider configuration on startup (`resolveBundledZCodeBuiltinProviderConfig`) in only two places: `provider/` beside `zcode.cjs`, or `config/provider/` five levels above `zcode.cjs`—the latter matches source-repository layout but resolves to root `/config/…` in the packaged App. Real location: `<App>/Contents/Resources/config/provider/zcode-builtin.json`. The App supplies it through an environment variable when launching CLI; direct spawn has nobody to supply it | Every command: doctor, models, runner all fail |
| 2 | `workspace/updateProviderRegistry` → -32601 Method not found; `workspace/readState` gone too | Methods removed. app-server's `startProcessProviderRegistryRuntime` now combines builtin and personal configuration files into the provider table. Personal file defaults to `~/.zcode/v2/provider_config.json`, empty locally (`providerRules: []`) because the user uses an OAuth account coding plan and has no API-key provider in the App | Handshake, doctor ③, and models fail |
| 3 | (Visible only after fixing 1 and 2) `session/create` → -32602 `Unrecognized key: "runtimeModel"` | create now uses a strict schema; `runtimeModel` replaced by `model: {providerId, modelId, options?: {reasoningLevel}}`; GLM 5.3 also requires `reasoningLevel`, otherwise `Reasoning level is required` | Runner cannot create sessions |
| 4 | (Same) `workspace/generateText` → -32602 `Unrecognized key: "modelRef"` | `modelRef` renamed `selection`, same shape as `model` above; old `variant` becomes `options.reasoningLevel` | Every model review refers to a human (gate is fail-safe by design, no allowance) |
| 5 | **Disproved at checkpoint 5 (2026-09-18 live send + generateText)**: api-key-provider model requests **do not** first trigger `interaction/requestProviderRuntimeHeaders`; both turns and generateText use the personal-file key directly at open.bigmodel.cn. The original inference (host-mode headers port always `shouldRefreshBeforeModelRequest`) missed provider-type gating | Client retains the builtin response (with key, `{headersApplied:true, requestAuth:{apiKey}}`; without, `{headersApplied:false, errorMessage}`), so it can handle an account-provider request if one arrives; mock sends only with scenario `runtimeHeaders:true` | None (one live turn done, model-review fast screen returned Y from 1 generateText) |

Unchanged parts (parameter schemas all checked in the new version): `session/send`, `resume`, `subscribe`, `stop`, `close`, `list`, `requestRuntimePreferences`, `interaction/requestPermission`, `interaction/requestUserInput`, and `session/event` event kinds. Session lifecycle, turn-end detection, and the three gate layers therefore need no changes.

Two additional facts:

- `node zcode.cjs --version` on 3.12.2 still prints `0.16.5`, the same as 3.11.2. **The version number cannot distinguish old from new**; doctor needs a different criterion.
- Key source: `builtin:bigmodel-coding-plan.options.apiKey` in `~/.zcode/v2/config.json` (called legacy CLI config in the new version) is still plaintext, and App 3.12.2 still writes it (mtime 2026-09-18 00:23). All `credentials.json` values are encrypted with `enc:v1:` and unreadable. For now, keys must still come from config.json; if the App stops writing it, that source disappears—the largest external risk after this adaptation, which doctor must report early.

The probe script was merged into `scripts/probe.mjs` (d2863e2).

Checkpoint 5 (2026-09-18, App 3.12.2, quota-consuming): one `scripts/real-send.mjs --yes --on-permission allow` turn
(GLM-5.3-Flash, `model` + top-level `thoughtLevel`) → Write permission request → allow → `turn.completed`, outcome done,
hello.txt created; one `scripts/real-review.mjs --yes` fast-screen `workspace/generateText` (`selection` with
`options.reasoningLevel:'low'`, inputTokens 4979) returned Y. Neither path received `requestProviderRuntimeHeaders`.
Afterwards, the raw apiKey was absent from `~/.zcode/cli/log/zcode-2026-09-18.jsonl`, and no personal provider file remained in `$TMPDIR`.
The 3.12 event stream added `v4/telemetry/event`, `process/mcpTelemetry`, and `computer-use/operation-event` notifications;
handle them as unknown events persisted unchanged; turn-end detection is unaffected.

Reverse request `interaction/requestProviderRuntimeHeaders` params (read from zcode.cjs 3.12.2 source;
checkpoint 5 live api-key provider never sent it, account-based untested, no instance captured live): `{requestId: "<sessionId>:provider-runtime-headers:<uuid>", sessionId, turnId?,
workspace, modelSelection: {providerId, modelId}, providerId, accountAccess?, reason: "model-request"}`;
response `{headersApplied: true, requestAuth: {apiKey?, headers?}}` or `{headersApplied: false, errorMessage?}`.

### Basis for mock replication (2026-09-18 probe)

Sources for each place marked “live” in the mock (`test/mock-appserver.mjs`), for reviewer comparison:

a. create returns `settings.model.available` entries shaped as `{ref:{providerId,modelId}, label（=modelId）,
   providerLabel, contextWindow: 1000000, maxOutputTokens: 128000, reasoning:{levels:[low,high,max],
   defaultLevel:'max'}, properties:{inputFormat…, outputFormat…}}` (label equals modelId); `settings.thoughtLevel` has only
   available / current / enabled, without defaultLevel.
b. If create receives only `model.options.reasoningLevel`, without top-level `thoughtLevel`, `model.current` echoes only
   `{providerId, modelId}` (not options), and `thoughtLevel.current` is absent; supply both to retain both. Without
   `model`, create uses the first model in the table; reasoningLevel comes from top-level thoughtLevel, defaulting to max.
c. Exact errors: create with runtimeModel → -32602 `Invalid params — (root): Unrecognized key: "runtimeModel"`;
   model absent from the table → -32603 `Provider Registry 中不存在 Model: <providerId>/<modelId>` (model absent from Provider Registry; data.name = Error /
   ModelProtocolError); missing reasoningLevel → -32603 `Reasoning level is required for <providerId>/<modelId>`;
   generateText with modelRef → -32602 `Invalid params — selection: Invalid input: expected object, received
   undefined; (root): Unrecognized key: "modelRef"`; old method → -32601 `Method not found: <method>`.
d. Session created with `persistence: 'deferred'`: create succeeds, close returns `{closed:true}`, but neither before nor after does
   `session/list` list it.
e. Session object keys: createdAt, mode, traceId, sessionId, sessionKind, status, target, title,
   updatedAt, workspace (session in 3.12.2 create response has no model key).
f. `-32031` message is the client's response `errorMessage ?? "Provider runtime headers were not applied
   before model request attempt."` (read from zcode.cjs source).

## v4/command probe (2026-09-21, App 3.12.2, zero tokens)

Basis for rerouting interjections: protocol read from ZCode open-source 3.14.0 + a local zero-token probe on App 3.12.2
(v4/command only, no model requests). v4 and legacy `session/*` share one NDJSON stream; method name
`v4/command`, request params are the command envelope (`commandId` from `crypto.randomUUID()`,
fixed `clientId`, `sessionId`, `type`, `issuedAt`, `payload`); response result is ACK
`{commandId, status, revisionAtDecision, reasonCode?, message?, result?}`, six states
`accepted | rejected | stale | duplicate | noop | failed`. Four local checks:

| Check | Result |
| --- | --- |
| `sendText` targeting a nonexistent sessionId | `{status:"rejected", reasonCode:"proto.sessionNotFound"}` |
| `sendText` with empty body | `{status:"failed", reasonCode:"proto.invalidPayload", message:"input must not be empty"}` |
| `type:"stop"`, `payload:{}` targeting an idle session | `{status:"accepted"}` |
| Direct `sendText` to a session created by legacy `session/create` | Works—no prior v4-topic subscription or handshake needed; the v4 gateway checks only session existence |

Two source-derived additions (not live): accepted `sendText` has `result`
`{type:"inputAccepted", delivery:"startNow"|"queue", inputId}`; `requestedDelivery:"guide"`
is injected after the next tool batch and before the next model request when a turn is busy; without a tool boundary or with attachments, CLI
falls back to queueing (`fallbackReasonCode`) and executes it as the next input after the turn ends. **On an idle session, `sendText`
starts a new turn directly (startNow)**, so interject only during an active turn. Accepted interjections still push legacy-stream events
`turn.steerQueued` / `turn.steerDrained` (already seen in our events.jsonl in the 3.11 era).

## First live send (2026-09-07, CLI 0.16.5, checkpoint 1)

Two quota-consuming calls: one turn to “新建 hello.txt” (create hello.txt), then kill the process, resume, and ask one more question.

| Check | Result |
| --- | --- |
| **create requires `runtimeModel`** | Pushing the provider table is insufficient: the turn reports `provider_not_configured`, “Model provider is missing an API key: builtin:bigmodel” (failed turn has no usage). With create `runtimeModel:{revision, generatedAt, model:{providerId, modelId}, provider:<registry 里那一项，含 apiKey:{source:"inline"}>}` (provider is the registry entry, including apiKey), the turn works and settings.model.current matches the selected provider/model (also fixing the default selection of the API-key provider) |
| resume | A new process can `session/resume {sessionId, workspace}` **without runtimeModel** and send normally with intact context (asked “刚才建了什么文件”, meaning “what file did you just create?”, answered hello.txt) |
| build-mode approvals | `Write` triggers `interaction/requestPermission`, reason “Tool has side effects and requires approval”. **Every options entry contains a `response` object**: `{kind:"allow_once", optionId:"allow_once", response:{decision:"allow", reason:"Approved once"}}`, `{kind:"allow_always", optionId:"allow_project", response:{decision:"allow", permissionUpdates:[{behavior:"allow", rules:[{toolName, ruleContent}], type:"addRules"}], reason:"Approved for this project"}}`, and **`{kind:"deny", optionId:"deny", response:{decision:"deny", reason:"Denied"}}` (deny-option kind is `deny`, not deny_once)**. Our response `{decision:"allow"}` was accepted |
| Event stream | One turn: `turn.started` (payload includes input, turnNumber, queryId) → `session.updated`×8 → `model.streaming`×15 → `tool.updated`×4 (kind: scheduled / started / with result / batch, `toolName` in scheduled and started) → one each of `permission.requested` / `permission.resolved` → `checkpoint.created` → `turn.completed`. `turn.completed.payload` includes `response` (full final answer), `usage` (inputTokens/outputTokens/totalTokens/cacheReadTokens…), `toolCallCount`, `duration`, `resultType:"success"`. Also many `v4/telemetry/event` (73), `computer-use/operation-event`, and `process/mcpTelemetry` notifications; can be discarded |
| Quota | File-writing turn: input 32k / output 91 (cacheRead 16k); one question after resume: input 16k / output 9. Heavy system prompt; budget dispatches by turn count |
| Unverified | Events after `session/stop`; `inputSource: background_task`; whether old envelope ids are accepted after pending for over a minute; no `turn.terminal` observed (only completed) |
| CLI log | One warn `session.model_selection.persist_failed` per turn, no error |
| Full CLI path (2026-09-08, T2.4b snapshot, fourth quota-consuming call) | `new` (local id, no session creation) → `send --wait` immediately returns 5 with pending contents → `status` shows pending and recent tools → `approve` applied → `follow` gets done (usage matches first send, about 32k input) → file written → `list` shows local id and `sess_`. Runner created the session on first send; CLI log has no error |
| Permission-request argument field | In `interaction/requestPermission` params, tool arguments are in **`input`** (live pending.json contained `toolName`, `input.file_path`, `input.content`, `input.command`). Zcode-side MultiEdit shape has not been observed |
| Live `workspace/generateText` (2026-09-08, T3.2 `scripts/real-review.mjs`, sixth quota-consuming call) | Accepts `querySource:"zcode-executor.review"`, `modelRef.variant:"high"` (coding-plan Flash), messages form; one fast screen took 5.3 seconds, usage input 5010 / output 286; returned `{text, usage}` matches zod-derived shape. Model answered Y for “任务单授权的 Write hello.txt” (Write hello.txt authorized by the task file) → allow |
| Live question (2026-09-08, ninth quota-consuming call) | `interaction/requestUserInput` params: `{questions:[{header, question, multiSelect, options:[{label, value, description}]}]}` (plus requestId, sessionId, toolCallId). **zcode's AskUserQuestion tool has no separate value field**; the model reported “工具不支持 value 字段，改用 label 承载” (value is unsupported; label must carry it), and actual options had equal value and label. Our `answer <id> 2` sent `{action:"accept", content:{answers:{"<question 原文>":"用 hello"}}}` (label; `<question 原文>` = original question text, `用 hello` = use hello); zcode accepted it and wrote `hello` as selected. The answer path works |
| AskUserQuestion response handling (zcode.cjs source, 2026-09-08) | Strict response schema `{action:"accept"|"decline"|"cancel", content?: record, reason?}`. `content.answers` uses the **original `question` text** as key (fallback `content.answer_<下标>`, where `<下标>` means index; for one question, `content.answer`); values are only `trim()`med and **passed unchanged** to the model (`"问题"="答案"`, meaning “question”=“answer”), without matching options value/label; arrays join with `", "`, equivalent to strings. app-server supplies `options[].value`, always equal to `label` (no value in model-side schema). Empty `answers` object means unanswered (model decides); no matching keys → tool fails with “requires user answers”. decline/cancel → tool not executed, model sees a declined response. Only plan_approval compares values exactly: fixed key “Review this implementation plan.”, value must be `approve` |
| Seven post-delivery checks (2026-09-08, eleventh through eighteenth quota-consuming calls, main cca7903) | ① **Background-task turn**: task requested Bash `run_in_background` with `sleep 8 && echo done > bg.txt`, then polling. Exactly one `turn.started` (turnNumber 0, no inputSource), no `background_task` turn, normal `turn.completed`. Background Bash completion on 0.16.5 starts no separate turn (Agent subagents untested). ② **approve after 75 seconds pending**: zcode accepted and continued (next step 9 seconds later); retaining only the latest 5 envelope ids is sufficient. ③ **Two parallel sessions**: two runners and two app-server children ran concurrently, both done within 24 seconds, no CLI-log error. ④ **resume Session not found → recreation**: replace registry sessionId with a fake and resend; `executor.recreated`, successful create, new id saved, file written. ⑤ **toolDenylist works**: after `--deny "Write Edit MultiEdit"`, model used only Read and Bash (echo to write), no Write. **`session/stop` after cancel**: no turn-end event within the 5-second grace period (Bash sleep running), only `tool.updated` progress; disconnected at grace expiry and settled `cancelled`, no orphan processes. ⑥ **`cancelGenerateText`** returned `{operationId, cancelled:false}` live (already finished within 150 milliseconds), matching zod-derived shape. ⑦ **Slow review**: Bash `git push --force origin main`, fast screen N → slow-review first line “结论： ask” (conclusion: ask), 65 output tokens, reason “命中 git-force-push…没点到 force push 也没点到 main” (git-force-push matched; neither force push nor main was specified), no truncation with budget 2000. Also, when the model tried Bash `mkdir` outside the worktree, slow review returned ask (citing outside-worktree), showing the prompt's boundary rule works for Bash |
| Model-review thought level low (2026-09-08, tenth quota-consuming call) | Same fast-screen request: `variant:"low"` output 3 tokens in 2.1 seconds; `high` output 158 to 286 tokens in 4 to 5 seconds. Review default changed to low |
| Truncated model slow review (same date) | Fast screen flagged an in-scope Write; with slow-review `maxOutputTokens:600`, the model wrote lengthy itemized reasoning and was truncated before the conclusion line → `parseSlow` failed → review-failed referred to a human. high thought-level budget must allow reasoning; 600 is insufficient for slow review |
| Checkpoint 3 (2026-09-08, main 8c5ff23, seventh and eighth quota-consuming calls) | A in-scope write: model fast screen Y, automatically allowed without pending; `executor.gate` stage review-fast with reason, turn done, file written. B outside write: `Write` outside cwd → hard-rule pending (stage hard, ruleId outside-worktree, why with path); after `approve`, turn continued and wrote the external file. No runner remained after either. Fast-screen budget 300 produced about 160 tokens in 4 seconds |
| Checkpoint 2 (2026-09-08, main ab6dfc8, fifth quota-consuming call) | Real worktree + `--task`: `new` → `send --wait --task` 5 (Write) → `approve` → model read task file, then requested **Bash `git -C …` permission** (git commands also require permission in build mode) → second approve → done. `hello.txt` appeared only in the worktree, main checkout unchanged; `last.json` recorded the task path; turn usage about 65k (two model requests + reading task file). Found bug: after the answer applied, `approve` crashed while matching event receipts on a `{method,params}` line yet exited 0 (fixed in T2.6) |
| **Sessions that have never run a turn cannot resume** (2026-09-08, T2.3b live check) | Immediately after `new`, `session/close` and exit; runner's `session/resume` reports `Session not found`. Matches zcode-acp-era checks: at least one turn is required for cross-process resume. Custom `sessionId` on `session/create` rejected: “sessionId is only supported for imported history creates” |

## Credentials-file probe (2026-09-21, App 3.12.2, scripts/probe-credentials.mjs, zero tokens)

Background facts for T6-C, checked with a probe on the user's machine; encryption and key names read from ZCode open-source 3.14.0 and compared with the local file format:

- Fallback key derivation (sha256 of `zcode-credential-fallback:<platform>:<homedir>:<username>`) decrypts values in local
  credentials.json (`ZCODE_CREDENTIAL_SECRET` unset).
- `oauth:active_provider` = `bigmodel`; `oauth:bigmodel:user_info` decrypts to JSON with id, username, displayName, rawProfile.
- Both personal and team coding-plan api-key entries exist; values are 49 characters with a dot (`apiKey.secretKey` form).
- Encryption form: `enc:v1:<iv>.<tag>.<密文>` (`<密文>` means ciphertext), three base64url segments, AES-256-GCM, iv 12 bytes, authTag 16 bytes;
  values without the prefix are used as plaintext.
- Key name is private App implementation: `account-provider:coding-plan:account:<family>-<plan>-coding-plan:account:<encodeURIComponent(id)>:api-key`.
  A change would make it unreadable; explicitly report unavailable rather than silently continuing (D19).

## Off-peak-task probe (2026-09-27, App 3.14.1, CLI 0.16.9)

Facts from unpacking the App (`app.asar` host / scheduler processes and `glm/zcode.cjs`) plus local probes.
Probe scripts were in the session scratchpad, not committed; obtained two tickets (using two free acquisitions), one tiny model call.

| Check | Result |
| --- | --- |
| Off-peak queue owner | Desktop host process (`OffPeakTaskService`), not CLI. CLI has only model tools `OffPeakCreate`/`OffPeakList`, enabled with `offPeakToolEnabled:true` at session creation; tool calls send reverse requests `offPeak/create`, `offPeak/list` to the client |
| Server and authentication | Production origin `https://zcode.z.ai`, API prefix `/api/v1/off-peak`; headers `Authorization: Bearer <JWT>` + `x-coding-plan-api-key: <账号 Coding Plan key>` (`账号 Coding Plan key` means account Coding Plan key). JWT is credentials.json key `zcodejwttoken` (same AES-GCM), payload `user_id, token_version, sub, iat`, **no exp** |
| `GET /ticket/availability` (zero quota) | `{code:0, data:{can_take_number:true}}`; when unavailable, includes `next_take_at` |
| `POST /ticket {task_id}` | `{ticket_id, task_id, state:"queued", position, next_poll_after:90, queued_at}`. First ticket position 1, second position 15 |
| `POST /ticket/status {ticket_ids}` | Both became `ready` within 30 to 100 seconds, with `ready_deadline` (about queued_at + 310 seconds, **only about 5 minutes to start**), `position:null` |
| `POST /ticket/<id>/settle` | Even expired tickets return 200, with data retaining `state:"expired"` |
| Direct fetch to `/anthropic/v1/messages` | Different model names and header combinations all returned 400 `code 3001 parameter error`; cause not established. CLI worked (next two rows); not investigated further |
| Ordinary api-key provider pointed at off-peak URL | CLI requires client signing for providers under `z.ai`/`bigmodel.cn`; signing key must have one dot, “id.secret”, but JWT has two → local error “Client signing credential must contain one separator”, no request sent. Only `zhipu-account` `off-peak`/`start-plan` bypass signing (`wEs`) |
| `zhipu-account` entry in personal provider file | Invalidates the whole personal file, removing even ordinary providers (create reports model absent) |
| **Official off-peak provider + updateAccountConfig (working approach)** | Builtin `account:<family>-offpeak-idle-plan` has always existed in CLI, only with `entitled:false`. Push `provider/updateAccountConfig {revision, basedOnZCodeBuiltinRevision, providers:{<id>:{access:{type:"zhipu-account", entitled:true}}}, states:{<id>:{availability:"available", entitled:true, current:true}}}` → `received`. **`basedOnZCodeBuiltinRevision` must be `zcode-builtin:<内置文件 revision>:<sha256(内置文件绝对路径)>`** (builtin-file revision and sha256 of its absolute path); if unequal, CLI ignores the entire update (why account providers were “pushed but not found” in D19). Then `session/send` with `modelSelection:{providerId:<id>, modelId, options:{reasoningLevel}}`, `modelExecution:{selectionScope:"execution", memoryExtraction:"skip", requestAuth:{apiKey:<JWT>, headers:{Authorization, X-Coding-Plan-Api-Key, X-Off-Peak-Ticket-ID}}, subagents:{foregroundModel:"submission", background:"deny"}}`, `offPeakTaskId`, `offPeakRunType:"init"` |
| Turn with expired ticket (zero quota) | Request reached zcode.z.ai, returned 400 `3102 off-peak ticket has expired or exceeded max running time`; `turn.failed` code `3102`, message starts `off-peak-ticket-expired:` (CLI off-peak failure detection works) |
| **End to end (second ticket acquisition)** | Position 15, ready after 30 seconds → push account config → send “只回复两个字：收到” (reply only with the two characters 收到, meaning “received”) → `account:bigmodel-offpeak-idle-plan`/`GLM-5.3-Flash` request completed in 6.3 seconds, `turn.completed` `resultType:"success"`, response “收到” (received), usage input 31619 / output 3. Ticket then `active`, `active_deadline` = first request + **exactly 3 hours**; after settle, `state:"settled"` |
| Fake ticket (zero quota) | Live 2026-09-27: `POST /ticket/status {ticket_ids:["1000000000000000000"]}` returned `{code:0, data:{next_poll_after:90, tickets:[{ticket_id, state:"not_found", position:null}]}}`; after authorization, using this ticket for an off-peak turn gave `turn.failed`, `payload.error.code` `"3104"`, message “off-peak ticket is invalid” (CLI stderr ProviderBusinessError, `providerCode: 3104`, HTTP 400). Doctor's end-to-end layer relies on these two calls (OP3 live rerun twice, same results) |
| Select off-peak provider without pushing authorization | Turn `turn.failed`; `turn.terminal` errorCode `provider_not_found`, `turnPhase: model_creation`, message “Provider Registry 中不存在 Provider: account:bigmodel-offpeak-idle-plan” (provider absent from Provider Registry) |
| Deferred sessions persist after a turn | A `persistence:"deferred"` session **is written as soon as a turn is sent** to `session` in `~/.zcode/cli/db/db.sqlite` (create + close without a turn leaves nothing; see 3.12.2 probe above). v4 `deleteSession` returns `accepted`, but source only calls the host's `closeSession`; CLI database row remains. These sessions are absent from App `tasks-index.sqlite` and invisible in its task list. v4 `renameSession {title}` works live (after OP3 rerun, database title “zcode-executor doctor 闲时自检”, meaning off-peak self-check) |
| Live doctor ⑤ (before OP3 merge) | `doctor --offpeak --json`: ok, exit 0, empty stderr, about 4 seconds; full doctor's seven lines all healthy; replace builtin file with a copy lacking off-peak entry → “接口变了（内置条目…）” (API changed, builtin entry…), exit 1; output contains no JWT or key |
| Checkpoint 6a (2026-09-28, offpeak branch 42c0d63) | New session (GLM-5.3-Flash), `send --offpeak`: position 9, ready in about 1 minute, turn done in 46 seconds, correct changes; taken/ready/started/settled events complete, ticket settled; all turn model requests used `account:bigmodel-offpeak-idle-plan`, only the gate's one fast screen used an ordinary provider; no JWT or key in 5 runs-directory files |
| Checkpoint 6b | Same session: regular rework send first (done, offpeak.json unaffected), then `--offpeak` rework: original text sent, `runType:"init"`, done, ticket settled |
| Checkpoint 6c (partial) | Hard-rule pending in an off-peak turn (write /tmp), **held for 10 minutes** then allowed: model's next action 6 seconds later, ticket still valid. The 40-minute case was cut off at minute 30 by our default turn timeout (`waitTimeoutSec` 1800 seconds, counted from turn start including pending time), outcome timeout, ticket settled normally; **test not completed**. Rerun with `--timeout 5400` |
| Free ticket quota | After 3 successful acquisitions on 2026-09-28 local time 02:07–02:11, fourth returned 3103 “take number limit exceeded”, `next_take_at` next day 00:00 (local, UTC+8). Previous day used 2. Inference: **roughly 3 per day, reset at midnight**; client reports converted local time, exit 2 (live path verified). One off-peak send can use 3 tickets and may exhaust that day's quota |
| requestAuth persistence | After probes, searched files written in the last 3 hours under `~/.zcode/cli` and tasks-index.sqlite; found neither JWT nor plan key |
| Error codes (source) | Task creation: 3101 ineligible, 3103 quota exhausted (with `next_take_at`); during execution: 3105 or HTTP 429 = still queued (CLI retries with backoff, at most 5 minutes between attempts); 3102/3001 = expired ticket (desktop returns to queue for another, continuing with fixed instruction “Continue the previous task from where it left off…” and `offPeakRunType:"resume"`) |

## Coding Plan client signing (2026-09-28, App 3.14.1, CLI 0.16.9)

ZCode's Coding Plan usage discount (the user's 0.67 multiplier) is not computed client-side; the client only lets the server identify “this is ZCode”:
- Feature switch: request `https://zcode.z.ai/api/v1/agent/configs` with the Coding Plan key; sign only if `data.codingPlanSignature.enable` is true, cached for 1 hour.
- Handshake: key must be `id.secret`; POST `/api/paas/c1f3a7e2/v2/client` to the model-service domain, obtain encrypted private key, decrypt Ed25519 private key locally.
- Each model request to `bigmodel.cn`/`z.ai` (or a Coding Plan provider) adds `X-App-Id: zcode`, `X-Client-Version`, `X-Session-Id`, `X-Client-Ts`,
  `X-Client-Nonce`, `X-Client-Sig` (signature over key id, timestamp, version, session id, nonce), `X-Client-Pow` (proof of work).
  Account-based off-peak / start-plan bypass signing (hence a custom api-key off-peak provider hits the one-dot signing-key requirement).
- **Our ordinary dispatches are signed**: `ZCODE_RUNTIME_ENV=development` (enables debug logs only, not server changes; server selection uses `ZCODE_ENV`) + `ZCODE_LOG_DIR` pointing to a temporary directory;
  one 18-token `workspace/generateText` using a personal provider file (providerId `zcode-executor`, pointing at open.bigmodel.cn) produced debug logs
  `feature_gate enabled:true` and `signed_sent {signedAttempt:1, providerId:"zcode-executor"}`. Turns use the same model-request module; logs contain no unsigned request or signing failure.
- The multiplier itself is a server rule; client code neither contains nor displays 0.67.

## One-shot CLI (fallback approach)

`zcode --prompt "<text>" --json --mode build --cwd <dir> --resume <sess_> --attach <file> --disallowed-tools "Write Edit Bash"`.
`--allowed-tools` and `--max-turns` listed by `--help` report Unknown option on 0.16.5.
zcode-open-bridge says this mode ignores the configured model and requires environment-variable injection; whether this remains true is unverified.
Each invocation leaves a session row in the database.

## Storage and coexistence with the App

- App task list reads `tasks` from `~/.zcode/v2/tasks-index.sqlite`, **grouped by `workspace_key` (=cwd)**.
  Only zcode-acp writes it; direct app-server does not, so sessions do not appear in the App list.
- Session contents are in `~/.zcode/cli/db/db.sqlite` (WAL, tables `session` / `message` / `part`,
  last two with `sequence`). App's `zcode-cli` child and our app-server
  open the same file (verified with lsof).
- `zcode.cjs` has no cross-process session-ownership lock. SQLite protects file integrity; whether two processes driving
  the same session corrupt its logical state is unverified.

## zcode-acp-server overview

- 0.27.3 totals 17,300 lines. Worth reusing: `backend/client.js`+`listener.js` (613, process startup and pairing),
  `backend/resolve.js`+`credentials.js` (242), `config/provider-registry.js` (143),
  deduplication and responses in `handlers/server-requests.js` (part of 815), turn-end detection in `handlers/session.js`
  (two or three hundred of 2665 lines, search `STALE_FREEZE_MS`). Optional `tasks-index.js` (360).
- Do not copy: `lazy-sessions`, `translators/*` (events to ACP mapping), `options`, `extensions`,
  `remote`, TUI, `sandbox`, `replay`, `i18n`.
- Release pace: 0.17.1 → 0.27.3 in two days. Changelog “session-create incubates terminal REPL”
  occurs only on hub/remote paths. 0.27.3 still does not implement ACP-side `session/close`.
- Source: `npm pack zcode-acp-server@0.27.3`, or 0.17.1 in the npx cache,
  `~/.npm/_npx/c904e5833c2b97e0/node_modules/zcode-acp-server`.

## Tool-argument location and Bash success/failure fields (2026-10-02, App 3.14.1, zero tokens, reading local runs/)

- `tool.updated` scheduled rows have `inputOmitted:true`, `inputRef:"model_stream"`, no `input`; arguments are in the same `toolCallId`'s
  `model.streaming`: `kind:'tool_call'` `payload.input` contains full arguments (preceded by streamed `tool_input_start/delta/end` fragments).
  Therefore, `status` looking only in `tool.updated` for `file_path` has always produced null `file` since 3.12.
- `tool.updated` result-row `result.success` is true even for nonzero Bash exit codes (all 122 results in x_af149b61 true, no false in the last 30 sessions);
  actual success/failure is in `result.perf.detail.command`: `exitCode`, `status:"failed"`.
- Reply text is `model.streaming` `kind:'text_delta'`, reasoning is `reasoning_delta` (roughly ten-plus times the reply volume); `last.json` `lastText`
  concatenates multiple messages within a turn with no separator.
- Over 90% of `events.jsonl` is `v4/telemetry/event`; largest local event file 121MB.

## Security-audit checks (2026-10-08, App 3.14.4, zero tokens, read-only local zcode.cjs and local experiments)

Examined `/Applications/ZCode.app/Contents/Resources/glm/zcode.cjs` (single bundled file), without making any requests.

| Fact | Details |
| --- | --- |
| Write-tool table | `isWriteTool` contains `Write`, `Edit`, `ApplyPatch`, `Bash`; `isReadOnlyTool` includes `Read`, `Glob`, `Grep`, `WebSearch`, `WebFetch`, `TodoRead`, `TodoWrite`, etc. `MultiEdit` occurs 0 times in the entire file |
| Builtin tool registration | `registerBuiltInTools` iterates the builtin table and registers by `metadata.name`. Names include literals and constants: `U1="WebFetch"`, `Oht="WebSearch"`, `jte="EvalWorkflowSnippet"`, etc.; the 17 literal entries found by searching only `metadata:{name:"…"}` are not the full tool table |
| `toolDenylist` | `session/create` converts it to runtime `toolDisallowlist`; `registerBuiltInTools` skips disallowed tools before registration. Alias `web_search` normalizes to `WebSearch`, so `--deny "WebFetch WebSearch"` covers these two builtin network tools and the alias. Conclusion from source, no model turn sent; Bash, js, and MCP network capabilities are unaffected by these two names |
| Workflow and off-peak tools | app-server `dynamicWorkflowEnabled` and `offPeakToolEnabled` both default false; this tool's runner does not enable them on session creation. `EvalWorkflowSnippet` is a dynamic-workflow tool, registered under the first switch; `OffPeakCreate` / `OffPeakList` need the port supplied by the second. Off-peak sends use protocol parameters, not these two model tools |
| `ApplyPatch` | Its implementation was not found in this local version's builtin registration table. Input schema `{patch_text: string}`, **no `file_path`**; target paths are in patch text, whose format is not established. Mechanical hard rule always refers it to a human (no determinable path); add path extraction when it can be emitted live |
| `js` tool | Node REPL, input `{code: string, timeout_ms?, title?}`, `needsApproval:true`; original permission description “Node REPL can run arbitrary JavaScript with full Node privileges (require/process), like Bash”. Gate self-protection therefore examines `code` as well as Bash `command` |
| Model-key environment fallback | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` are AI SDK fallbacks only when no explicit key is supplied; this tool uses a personal provider file and runtime headers, so child environment does not need them |

Local experiments (no zcode involved):

- Node v26.5.0 `fs.realpathSync` (JS implementation) first uses `path.resolve`, then resolves segments: `<dir>/link/../x` (`link` symlinks to another directory) produces `<dir>/x`;
  `fs.writeFileSync` instead passes the original string to the kernel and lands in the symlink target's parent. This mismatch is audit D1's gap, prompting our segment-by-segment boundary resolution.
- git 2.54.0: `git status --porcelain` reads tracked-file contents to compare when size is unchanged but timestamp changed; before comparing, it runs the `filter.<名字>.clean` named by `.gitattributes` (`<名字>` means name)
  (size-changed files skip content comparison and do not trigger it). `-c core.fsmonitor=false` does not control this; setting `filter.<名字>.process` to an empty string through `GIT_CONFIG_COUNT` / `GIT_CONFIG_KEY_n` / `GIT_CONFIG_VALUE_n`
  stops it (clean and smudge are then also unused).

## Claude Code mod (2026-10-02, Claude Code desktop, engine 2.1.286)

- Function-hook plugin (mod) `$.process.run` / `$.process.spawn` work in the desktop Code tab (type file says “CLI only”);
  desktop process PATH includes `~/.local/bin`, and `/usr/bin/env node` finds node (v22).
- A command registered with `$.command.register({name})` is `/<name>`, without a plugin-name prefix.
- Desktop `Svg` with `isInteractive: true` has its sandbox frame refreshed unpredictably by the host, visibly flickering (even after drawing the pane only once);
  without it, SVG displays as an image, CSS keyframe animations still run without flicker, and redrawing the pane every 250 milliseconds also does not flicker.
- `Text` / `Box` theme color keys (`warning`, `success`, `error`, `suggestion`, `inactive`) are resolved by the engine separately in light and dark themes.
- Engine static validation (`claude plugin validate`) requires functions receiving `$` to be declared at module top level; closures inside `register` are rejected.
- After setting `CLAUDE_CODE_PLUGIN_DIRS` (plus `CLAUDE_CODE_PLUGIN_DIR_WATCH=1`) through `env` in `~/.claude/settings.json`, newly opened desktop sessions load plugins from that directory without restarting the App.
- Watch-pane checkpoint B (watch-pane branch, `watch` + `hooks/`): user tried W1–W9 on desktop and reported success (dispatch refresh, pending handoff, turn-end notification and cards,
  project filtering, light/dark themes, reconnection, terminal version). W5: pane opens automatically with normal width when Claude runs `zcode-executor send` (desktop, user observation); W10 (other hosts reading `hooks/hooks.json` containing only `modules`) unverified.

## Claude Code side (official-documentation check)

- Plugins can contain `skills/`, `bin/` (added to Bash PATH while enabled), and `.mcp.json`;
  `${CLAUDE_PLUGIN_ROOT}` is the installation directory; `${CLAUDE_PLUGIN_DATA}` is persistent storage.
- Bash default timeout 2 minutes, maximum 10 minutes; timed-out commands automatically move to the background and notify Claude on completion.
  MCP calls exceeding 2 minutes (`CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS`) also move to the background automatically.
- MCP elicitation (forms / URLs) is supported in interactive sessions; in `-p` and SDK modes it fails the call.
  Documentation does not say whether it can appear after backgrounding.
- PreToolUse hooks and `--permission-prompt-tool` apply only to Claude's own tool calls.
- AskUserQuestion is available in interactive sessions; `askUserQuestionTimeout` can enable automatic continuation; unavailable in `dontAsk` mode.
- Plugin `bin/` scripts invoked through Bash receive ordinary Bash review; `Bash(zcode-executor *)` can be prefix-allowlisted.

## Third-party projects overview

| Project | Language | Zcode connection | Exposed interface | Activity |
| --- | --- | --- | --- | --- |
| zcode-open-bridge (tizerluo) | Python, zero dependencies | Direct app-server; also `--prompt --json` | ACP bridge, MCP review tool, capability probing | Last commit 2026-08-31 |
| zcode-acp (william0wang) | TypeScript | Direct app-server | ACP service, TUI, remote hub | Multiple releases daily; README credits open-bridge |
| coder-mcp-bridge (Deslord319) | Python, zero dependencies | Direct app-server (`zcode_protocol.py` 13KB) | MCP orchestration, manages three backends | Last commit 2026-08-15 |

coder-mcp-bridge approval policy: outside plan mode, auto-approve `requestPermission` (except writes to
exclusive roots); `requestUserInput` auto-approves only plan_approval.

## Live start-plan-send probe (2026-09-29, App 3.14.1, CLI 0.16.9)

> `--start-plan` was removed entirely on 2026-10-02 (decisions D21); below is the verification record from that time.

Full `send --start-plan` path (T8): authorization push, per-turn routing, and host runtime-header responses all work as expected, but **the server blocks the turn at the Alibaba Cloud captcha**.

| Item | Result |
| --- | --- |
| Authorization push | `provider/updateAccountConfig` (revision `zcode-executor-start-plan:*`) pushed successfully, receipt received |
| Send routing | `modelSelection.providerId = account:bigmodel-start-plan`, modelId GLM-5.3-Flash; request reaches `https://zcode.z.ai/api/v1/zcode-plan/anthropic` (baseURL in debug `model.network.started` is evidence) |
| Authentication response | Host answers by providerId with `{headersApplied:true, requestAuth:{apiKey:<zcodejwttoken>}}`; CLI log `Client request signing skipped by provider access mode` (start-plan bypasses signing, matching source `wEs`) |
| Server response | HTTP **400**, `captcha verify failed` (business error, reason classified as auth_failed); second attempt (captcha-retry) also 400. CLI retries only ask for runtime headers once more; without a captcha token from the host, it stops there |
| Comparison | Desktop App start-plan requests work during the same period (this session itself runs on it); App host handles start-plan runtime-header requests through UI (embedded Alibaba Cloud captcha SDK, `x-aliyun-captcha-verify-param`), a header a headless host cannot fabricate. CLI standalone port supports only individual-coding-plan and throws for start-plan; start plan is effectively App-UI-dependent |
| Conclusion | Protocol implementation is correct and verified up to the outbound request; the server captcha gateway is an external constraint. Regular and off-peak sends are unaffected |

Cause of npm test hanging inside an App-host session (same date): host environment `ZCODE_BUILTIN_PROVIDER_CONFIG_FILE`,
`ZCODE_PERSONAL_PROVIDER_CONFIG_FILE` leaked into tests; appserver.test.mjs's case expecting an error without environment variables became invalid,
and spawn cases started a real app-server and waited indefinitely for handshake. Fixed by clearing host `ZCODE_*` at the top of appserver.test.mjs (retaining `ZCODE_BIN`).
