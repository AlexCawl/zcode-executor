# Decision record

English · [中文](decisions.zh-CN.md) · [Русский](decisions.ru.md)

Each entry records what was decided, why, and when it would be worth reopening. D1 through D5 were decided on 2026-09-07; D6 through D9 were added while aligning requirements the same day.
D10 followed the T0.2 probe; D11 emerged from checkpoint 1; D12 and D13 were decided during phase 2 on 2026-09-08.
D14 was added on 2026-09-18 when adapting to ZCode App 3.12.2; D15 was added the same day when optional Jev fast screening was agreed; D16 records the Jev pre-screen revision approved in this round, replacing D15's routing and audit design.
D17, D18, and D19 were added on 2026-09-21 during tracks A/B/C against ZCode's open-source code (3.14.0): D17 moves steering to v4 commands, D18 records the risk of retiring the old protocol surface, and D19 covers the source for account-based Coding Plans.
D20 was added on 2026-09-27 after a successful end-to-end live run, before implementing off-peak sends, and revises D19's read scope. D21 (start-plan sends) was added on 2026-09-29 and removed in full on 2026-10-02 because of the CAPTCHA gate.
D22 (implementing the watch pane as a Claude Code mod) was added on 2026-10-02 while building v0.4.0 and removed in full on 2026-11-05 in this fork (watch subcommand, `hooks/`, `dsh-plugin/`, `types/`).

## D1 Positioning: dispatch and acceptance; the protocol is somebody else's job

Three third-party projects (zcode-open-bridge, zcode-acp, coder-mcp-bridge) have already explored ZCode's
app-server protocol three times. None addresses how Claude writes a task file, chooses a worktree,
queues work, accepts results, or keeps records. This project does only that latter part.

**Explicitly out of scope**: a protocol-translation product, TUI, remote access, review tool, or general resource scheduling.

Reopen when: ZCode officially provides dispatch/acceptance capabilities.

## D2 Connect directly to app-server, with no ACP in between

The original plan used the ACP transport layer, translated by zcode-acp-server.
ACP is a common language only when connecting multiple executors; this project connects only ZCode, making it an unnecessary translation layer.

Going direct removes three of the original four problems: `session/create` immediately returns a real `sess_` id
(lazy sessions and the list namespace were inventions of zcode-acp for editors); `session/close` already exists;
`mode` and `toolDenylist` can be passed directly at create time; `interaction/requestPermission`
comes straight to us. The remaining provider-registry synchronization is only a few lines of filtering.

Cost: maintaining our own app-server client of roughly 800 to 1200 lines, with its core taken from zcode-acp
(Apache-2.0, preserving its notices). zcode-acp released ten minor versions in two days and is moving toward TUI and remote access;
using it as a runtime dependency is riskier than maintaining a small client ourselves.

Reopen when: ZCode changes the app-server protocol faster than we can keep up.

## D3 Approvals: hard rules → model review → pending for a human

Sessions use `build` mode (which sends permission requests); optional `toolDenylist` physically removes tools.
Permission requests enter the gate:

1. Evaluate the hard rules first (the rules that cannot be cleared).
2. Run model review through `workspace/generateText`, using ZCode's Coding Plan quota,
   without creating a session or cluttering the App's list. The logic follows Claude Code auto mode's fast/slow two-stage review.
3. If no decision can be reached, leave it pending: write the request to `runs/<id>/pending.json` and keep the connection open without replying
   (app-server has no timeout); `send --wait` returns `blocked`. Claude asks the human through
   AskUserQuestion, then runs `zcode-executor approve|deny <id>`.

**Model review produces only allow or ask a human.** Denials also go through a human. This is the prerequisite for accepting "reviewing oneself."

Why not Claude Code's native channel: MCP elicitation is the only route for showing an external request in a Claude
Code dialog, but it requires the bridge to remain running as an MCP service, the dialog must appear during an active tool call,
and non-interactive mode fails outright. Hooks and `--permission-prompt-tool` work in the opposite direction: they handle only Claude's
own tool calls. Leave this as an upgrade for the MCP-shell phase.

Reopen when: Claude Code exposes an approval entry point to external processes.

## D4 A single executor, an independent project

Do not build a generic bridge connecting multiple backends. This project connects only ZCode. It borrows patterns
validated in the author's earlier dispatch tools (runner lifecycle, queue and locks, runs persistence, acceptance), without referencing their code.

## D5 Name: zcode-executor

The repository, plugin, CLI, and skill share one name, matching the author's other dispatch skills. Saying
"让 zcode 去做" ("let zcode do it") triggers it. The name contains neither bridge (all three third-party projects use bridge)
nor a protocol name (the protocol is an implementation detail).

## D6 Select models by tier, not by name

Dispatch and model review both use two tiers, `fast` / `strong`. Get the list from `workspace/readState` and classify it automatically by name keywords;
`config.json` can override this. Dispatch defaults to thought level `high`, overridable with `--thought`; model review defaults to `low` (changed on 2026-09-08: review only determines whether this is routine work; high wastes time and tokens, and slow review at high once spent its budget on reasoning and was truncated).

Model names are not hardcoded because models change generations; hardcoding would require changing code and the skill every time. Do not reduce the thought level of Flash-class models:
users observed worse results at lower levels.

**Provider priority (added after T0.2b)**: models with the same name coexist under several providers; ZCode defaults to the API-key, usage-billed `builtin:bigmodel`.
We prefer Coding Plans: configured `preferredProvider` > ids ending in `-coding-plan` > `-start-plan` > others, selecting only enabled providers.
Treat domestic `builtin:bigmodel-*` and international `builtin:zai-*` equally; use whichever is enabled.

Reopen when: a clearly different third model class appears that does not fit into two tiers.

## D7 Executor questions also become pending; Claude answers first

ZCode's AskUserQuestion bypasses hard rules and model review and becomes pending directly. `send --wait` returns 5;
Claude reads the question and decides whether to `answer` itself or relay it to a human.

Do not automatically reply "decide from the task file": that would brush aside the moment when the executor most needs help. Do not deny directly either: Claude is the foreman,
and most questions are already covered in the task file, so it can answer without disturbing the human every time.

Reopen when: in practice, Claude answers incorrectly often enough that forwarding everything to a human would be better.

## D8 A cwd allowlist, defaulting to `~/.zcode-executor/worktrees/` only

The allowlist prevents Claude from accidentally using the main checkout as cwd; hard rules prevent the executor from crossing boundaries. They do not overlap.
If cwd is not a worktree, warn rather than reject: placing an ordinary repository in the allowlist is a deliberate user choice.

## D9 Plain `.mjs`, zero dependencies, no build

Manually strip the types from the approval layer's TypeScript prototype. A few hundred lines of code do not justify a build;
Node 22.18's runtime type stripping would raise the minimum Node version and introduce another file form.

Reopen when: imported code exceeds two or three thousand lines and manually maintaining two copies starts causing errors.

## D10 Push the provider registry before creating a session, requiring `~/.zcode/v2/config.json` (obsolete from 3.12; see D14)

The T0.2 probe confirmed that a direct app-server connection without `workspace/updateProviderRegistry` immediately rejects `session/create`
(Model config is missing), and readState cannot get the model list either. app-server does not read v2 config itself;
only the App and zcode-acp push it on its behalf. We must therefore read `~/.zcode/v2/config.json` to construct the registry,
including apiKey inline when passing it to the child process.

Unchanged constraints: this file is **read-only**; apiKey appears only in stdin sent to the child process, never persisted or printed;
filter out providers with empty models or `enabled:false`. Replace RULES' earlier "check only existence, do not read contents" with
"read-only, and contents do not leave the protocol layer."

Reopen when: ZCode makes app-server read its own configuration.

As of 2026-09-18, ZCode 3.12.2 removed `workspace/updateProviderRegistry` / `runtimeModel`; see D14.

## D11 Create sessions with `runtimeModel`; we specify the model and provider (obsolete from 3.12; see D14)

Checkpoint 1 confirmed that, after pushing the provider registry, create without `runtimeModel` still leads to a failed turn because the provider lacks a key, and the default model belongs to
a provider billed by API key. Passing `runtimeModel` (model ref + provider definition with inline apiKey) resolves both problems.
Thus `new` always calculates the model ref from the tier and provider priority, constructs runtimeModel, and passes it to create; resume does not include it.

Reopen when: ZCode makes app-server resolve provider authentication itself.

As of 2026-09-18, ZCode 3.12.2 removed `workspace/updateProviderRegistry` / `runtimeModel`; see D14.

## D12 The runner always runs in the background; foreground commands only read files

The original design made foreground `send --wait` the runner itself. But pending in this project requires **keeping the connection open without replying**, so the connection cannot close
when the foreground command returns exit code 5. The runner must therefore be an independent background process; foreground `send --wait`, `follow`, and `status` only read files in `runs/<id>/`,
and `approve / deny / answer` deliver replies to the runner through `answer.json`. The cost is another detached process and a layer of file polling.

Reopen conditions: none.

## D13 `new` does not create a ZCode session; the registry uses a local dispatch id

Live verification confirmed that sessions which have never run a turn cannot be resumed after their process closes, and create does not accept a custom sessionId. So `new` only performs zero-token model validation and registration;
the registry key is a local id (`x_` followed by 8 hexadecimal digits), with `sessionId` initially empty. On the first send, the runner calls `session/create` (with runtimeModel, thoughtLevel,
and toolDenylist), writes `sess_` back to the registry, and uses `session/resume` thereafter. Every command's `<id>` argument is the local id.
If runner resume reports Session not found (the session was lost on ZCode's side), record `executor.recreated` and create again rather than failing silently.

Cost: two ids, local and ZCode; `list` displays both columns. The "Session" entry in [CONTEXT.md](CONTEXT.md) was rewritten accordingly.

Reopen when: ZCode allows custom sessionId or persistent empty sessions.

## D14 From 3.12, supply a personal provider file; keys go in a temporary file

Decision: ZCode App 3.12.2 changed provider-registry handling from "the host pushes it to app-server" to "app-server reads it from two files."
`workspace/updateProviderRegistry` and `runtimeModel` disappeared together (see D10, D11). We now spawn the child process with two
environment variables: `ZCODE_BUILTIN_PROVIDER_CONFIG_FILE` points to the builtin provider file shipped with ZCode App (`zcode-builtin.json`,
defined in [CONTEXT.md](CONTEXT.md)); `ZCODE_PERSONAL_PROVIDER_CONFIG_FILE` points to a personal provider file we write ourselves. It contains only
one provider, with providerId hardcoded to `zcode-executor` (not reusing config.json's `builtin:bigmodel-coding-plan`,
for the same reason as D11: the new `builtin:` / `account:` prefixes have reserved meanings). The model parameter for `session/create` changes from `runtimeModel` to
`model:{providerId:'zcode-executor', modelId, options:{reasoningLevel}}`; `workspace/generateText` changes from
`modelRef` to `selection` with the same shape. zcode.cjs also adds a new reverse request,
`interaction/requestProviderRuntimeHeaders` (asking the host for runtime headers before a model request). Live checkpoint 5 confirmed that api-key
providers do not send it ([verified.md](verified.md), 2026-09-18, table row 5). The client still keeps a builtin reply in case account providers use it: with a key, reply
`{headersApplied:true, requestAuth:{apiKey}}`; without one, reply `{headersApplied:false, errorMessage}`.

Why: app-server now reads files itself and no longer accepts a registry pushed by the host. Both `workspace/updateProviderRegistry` (D10) and
`runtimeModel` (D11) were deleted; we need another way to give it keys and model lists. None of the non-persistent approaches tried worked:
`provider/updateAccountConfig` accepts only account providers with `access.type:"zhipu-account"`; supplying `apiKey` is immediately
rejected. The `requestProviderRuntimeHeaders` reverse request comes only when a model request happens, while the provider must already exist in the
registry at session creation; it cannot insert one on demand. Writing the user's own `~/.zcode/v2/provider_config.json` is also ruled out: the App rewrites that file,
it would conflict with the user's configuration, and it violates the "`~/.zcode` is read-only" constraint (RULES §6). The only option is to write our own personal provider file
for app-server to read.

Key location: place the personal provider file in a temporary directory created with `mkdtemp` under `os.tmpdir()`, with mode 0600; delete it in the
`finally` when the child process finishes. Do not put it in `runs/<id>/` (that directory is retained for later inspection and should not contain keys).

Remaining boundary: this temporary file remains undeleted in `os.tmpdir()` only if the runner receives SIGKILL or the machine crashes. Production paths contain
no code sending SIGKILL to the runner; `cancel` uses file signals (`answer.json` / `stop.json`), not process killing. macOS's
`$TMPDIR` itself is mode 0700 (accessible only by the current user), and the system periodically cleans it, providing two fallback protections.

Reopen when: ZCode provides a way to push api-key providers without writing to disk; or legacy `~/.zcode/v2/config.json`
no longer stores apiKey in plaintext (which would eliminate the underlying key-persistence problem).

## D15 Jev selects fast screening through a key in plugin config, with no shadow phase (historical decision; D16 revised the routing)

> The decision and reasons below are preserved as history, not current routing. D16 revises the original replacement fast screen, direct fallback to slow review on failure, and `fastReview` recording design; constraints on key source, file protection, and no shadow remain. Historical calibration does not prove the safety or performance of the new route.

Decision: when `review.jev.apiKey` in `~/.zcode-executor/config.json` is nonempty, the gate's first stage directly uses a fixed Jev version; without a key, it falls back to the existing ZCode fast-tier + `low` thought-level fast screen. Jev replaces only fast screening; flags and all call/validation failures enter the same ZCode slow review. Hard rules, `allow_once`, slow review, and pending remain unchanged. The first version offers no shadow/off/screen, provider enumeration, or environment-variable key source.

Why: local historical replay had completed calibration, and the user chose to skip shadow. A config file is more reliable than environment inheritance by a detached runner and lets `doctor` check deterministically; a single key source removes priority ambiguity. Letting Jev failures fall back to slow review rather than directly becoming pending maintains two-stage model-review availability; keeping slow review on ZCode prevents an external-service failure from becoming a storm of human approvals.

Security and data boundary: config containing a Jev key must be a regular, non-symlink file owned by the current uid with permissions no broader than `0600`; otherwise refuse to read it. Send only the minimal state under a field allowlist; Write/Edit bodies stay on the machine, and paths and credentials are redacted. Keys, Authorization, full state, and raw response bodies never enter events, pending, runner.log, or the app-server child process. Jev questions are all independent negative risks; do not use "routine operation" or an aggregate confidence. Events retain existing stage/decision, adding only reviewer and filtered typed metadata; slow-review events explain Jev flags/failures through nested `fastReview`.

Cost: the key is stored as plaintext in a config file under the user's directory, so owner/mode must be enforced. This no longer satisfies the old RULES restriction of "no key persistence except the temporary provider file"; the user explicitly chose this tradeoff for stable reads. Config changes affect only runners started/restarted by a later command that rereads config; existing connections do not hot-reload.

Reopen when: a system keychain, enterprise secret store, custom TypeSafe endpoint/model, or multiple key sources are needed; Jev becomes so unreliable that "failure falls back to slow review" remains unacceptable; or the user explicitly needs per-session/project switches.

## D16 Jev becomes an optional pre-screen; the original ZCode fast screen remains intact

Decision: under the approved repair and optimization plan (`docs/jev-hardening-plan.md`, local record, not committed), Jev is an early-pass layer and no longer replaces ZCode fast screening. Hard rules and `allow_once` come first; a non-whitespace `review.jev.apiKey` enables Jev. With sufficient evidence and all five probabilities meeting their thresholds, a pass allows early; flag/error/skip, timeout, invalid responses, and adapter exceptions all enter the original ZCode fast + low fast screen. Only a non-passing or unparseable result goes to slow review. Original fast-screen call failures still produce `review-failed` / ask; slow-review failures still ask. Without a key, preserve the original chain; disabling review retains the original pending contract.

Why: preserve the original fast screen's opportunity to decide. When Jev cannot pass early, return to the existing review chain rather than forcing slow review. The pre-screen can still allow early; adding a layer is not itself a safety proof. Required-evidence thresholds, input redaction, response validation, and a strict deadline must all hold together.

Evidence boundary: if Write/Edit/MultiEdit bodies are omitted, valid intent is missing, command or authorization information is truncated, or reliable redaction is impossible, skip locally with zero Jev HTTP requests. Complexity is not risk: complete, task-relevant pipelines, subshells, batch operations, and project scripts can still be pre-screened; fall back only when necessary facts are actually missing. The original fast screen gets the original action/context, without instructions from Jev probabilities. Do not upload bodies to improve the early-pass rate or expand the existing privacy permissions.

Audit and diagnostics: each request still has only one final `executor.gate`; `preScreen` independently records Jev pass/flag/error/skip, and final stage/reviewer distinguish early Jev passes, ZCode fast-screen passes, and slow review. Historical `fastReview` retains its old meaning of Jev fallback rather than silently changing meaning. `doctor` adds `review.pipeline`: `['jev','zcode-fast','zcode-slow']` with a key, the latter two without a key, `[]` when disabled, and `null` on configuration failure (indeterminate); compatibility `fastScreen` does not mean replacement of the original fast screen.

Retained: config as the only key source, owner/permission checks, no environment-variable backdoor, no shadow/mode, fixed model, and zero runtime dependencies; no concurrent racing. This round's question deduplication and boundary revisions upgrade the schema to `approval-v2` (model still `jev-1.13.0`), without new live recalibration; keep the threshold at 0.20, without relaxing it.

Cost: Jev adds serial waiting when it does not pass early; local skip avoids this HTTP cost. Writes whose bodies are omitted no longer get early passage through Jev. Compare end-to-end duration, early-pass rate, fallback, and cost on the same sample batch; old live Write passes and old calibration are historical evidence only, not verification of the new route.

Reopen when: paired measurements show no net benefit, requiring a narrower scope or adjusted budget. Restoring early passage for actions with omitted bodies, or sending original fast-screen call exceptions to slow review, requires a separate decision and acceptance; do not slip either change into this round.

## D17 Steering uses sendText through v4/command; sessions and the event stream still use old session/* methods

Decision (2026-09-21, T6-B): steering during an active turn no longer sends a second `session/send` (rejected from App 3.12.2 with -32010,
"A prompt is already running"). Instead, send the `sendText` command through `v4/command`, with `requestedDelivery:"guide"`:
while the turn is busy, inject after the next tool batch and before the next model request; if there is no tool boundary, or attachments are present, ZCode falls back to queuing,
executing it as the next input after the turn finishes. Both count as successful steering (live checkpoint 6b: guide was injected and took effect between b.txt and c.txt).
An ACK of `startNow` means the turn had already ended when the steering arrived and an unplanned turn started; immediately send v4 `stop` and record failure.
Sessions are still created with old `session/create` (needed for `toolDenylist`, and only it provides the model list), still subscribe through old `session/subscribe`,
and still answer old reverse requests for approvals and questions. The protocol layer adds only a thin `AppServerClient.command()` wrapper.

Why: source code shows `v4/command` only checks that the session exists. It requires neither prior subscription to a v4 topic nor a handshake; sessions created by old create
are in the same table (confirmed by a local zero-token probe). The desktop App itself also mixes old create and v4 commands. v4 `createSession` has no
`toolDenylist`, and the model catalog appears only in old `session/create` results, so v4 is not the main path.

Reopen when: any of old `session/create` / `session/subscribe` / `session/event` returns -32601 (see D18).

## D18 The old protocol surface is heading for retirement; defer v4 subscription and projection

Decision (2026-09-21): ZCode 3.14 source marks `session/send` (partly), `session/stop`, and `session/fork`
@deprecated, with a comment saying "after old session/* is deleted, v4/ is the only protocol surface." Do not migrate now: the desktop itself still uses old `session/create`,
and migration brings work without a functional benefit (v4 downstream frames use a projection model of snapshot + five delta types, with ≥1 MiB chunks, requiring an applier).
The trigger is fixed: any old method returns -32601 on a new App version, or release notes announce removal of old `session/*`. The route is documented in
track D of `docs/PLAN-v4.md` (`v4/conversation/subscribe` → apply snapshot/delta → determine turn completion from
`turnHeader.state` / `control.phase`); D17's `command()` is the starting point. Approvals still answer reverse requests; there is no need to switch to `resolveInteraction`.

## D19 Decrypt the platform key for account-based Coding Plans from credentials.json; use the same D14 path

Decision (2026-09-21, T6-C): add a second provider-registry source. Read only
four keys from `~/.zcode/v2/credentials.json` (the platform API keys ZCode App obtains on behalf of OAuth users; values look like `enc:v1:<iv>.<tag>.<密文>`, where `<密文>` means ciphertext;
AES-256-GCM, key = sha256(`ZCODE_CREDENTIAL_SECRET` or `zcode-credential-fallback:<platform>:<homedir>:<username>`)):
`oauth:active_provider`, `oauth:<family>:user_info` (for id), and the individual/team
`account-provider:coding-plan:...:api-key` keys. Combine the decrypted keys with the baseUrl and model lists in the builtin provider file's `account:*-coding-plan` entries
(`modelRules` regexes match modelId case-insensitively; later matching rules overwrite earlier ones), producing registry elements with the same shape as legacy config.json
(`buildAccountProviders`). Writing the temporary personal provider file, creating sessions, and model review all then use D14's
existing path, with zero protocol-layer changes. The personal file still specifies `access.type` as `api-key`: the decrypted key is an ordinary platform key,
and the App uses it the same way. Insert two account tiers into pickProvider priority (`preferredProvider` > `account:*-individual-coding-plan`
> `account:*-team-coding-plan` > `-coding-plan` > `-start-plan` > others). A missing source only records a warning; error only when neither source
provides any provider (message contains both reasons; doctor ② reports the two sources' status on separate lines).

Why not `provider/updateAccountConfig`: it accepts only account entries with `access.type:"zhipu-account"`; inserting `apiKey`
is immediately rejected. Answering the account provider's `interaction/requestProviderRuntimeHeaders` needs the same key, merely adding another set of revision
maintenance; start-plan uses an expiring jwt; writing the user's `~/.zcode/v2/provider_config.json` conflicts with the App (already ruled out in D14).

Risks and boundaries: key derivation depends on platform/homedir/username (moving machines or changing usernames prevents decryption; explicitly report "不可用"—"unavailable"—
rather than failing silently). App sign-out deletes keys from credentials.json; when that source disappears, fall back to legacy. Key names are private App implementation details; changes
also make them unreadable. credentials.json is read-only and only four keys are decrypted; do not read or decrypt other keys (such as OAuth tokens). Treat the decrypted keys
exactly like config.json's apiKey (RULES §6, §8).

Reopen when: ZCode provides a non-persistent way to push account providers; or keys are no longer stored in credentials.json / encrypted this way.

## D20 Off-peak tasks: obtain tickets and queue ourselves, run turns through the official off-peak provider; additionally read `zcodejwttoken` from credentials.json

Decision (2026-09-27): for off-peak tasks (free with a Coding Plan subscription, without consuming plan quota), implement the desktop host's half ourselves:
connect directly to the ticket, polling, and settlement endpoints at `https://zcode.z.ai/api/v1/off-peak`. Once a ticket is ready, first push
`provider/updateAccountConfig` in app-server to mark builtin `account:<family>-offpeak-idle-plan` as authorized
(`basedOnZCodeBuiltinRevision` = `zcode-builtin:<内置文件 revision>:<sha256(内置文件绝对路径)>`, meaning builtin-file revision and sha256 of its absolute path),
then call `session/send` with `modelSelection`, `modelExecution.requestAuth` (JWT, Coding Plan key, ticket number),
`offPeakTaskId`, and `offPeakRunType`. This requires decrypting one more credentials.json key, `zcodejwttoken`, in addition to D19's four,
revising D19's "do not read or decrypt OAuth tokens": allow this one key only; leave all others unread.

Why: the off-peak server accepts only this JWT, with no other source. Do not issue HTTP requests for the turn ourselves; use the CLI's official off-peak provider. The CLI enforces
client signatures for z.ai domains, with only account-based off-peak exempt; it also already handles "3105/429 means still queued, back off and retry" and "3102
means expired ticket." The live end-to-end path passed ([verified.md](verified.md), "Off-peak task probe"). Do not make CLI reverse request `offPeak/create` the only
entry point: it occurs only when the executor's own model asks for off-peak; the foreman dispatches through our own entry point. Reverse requests can be added later using the same core.

Risks and boundaries: endpoints and key names are private App implementation details; changes break the off-peak path without affecting ordinary dispatch. The JWT has no expiry and broad privileges;
treat it like the plan key: only in memory, the secrets-redaction list, and JSON-RPC parameters; never on disk, in runs/, or logs (the probe confirmed that the CLI
does not write requestAuth into ~/.zcode/cli). Free ticket requests are limited, so cap retries after ticket expiry; readiness lasts only about 5 minutes, with a maximum runtime of 3 hours.

Rules (agreed in the 2026-09-27 grill; details in `docs/SPEC-offpeak.md`, local record, not committed):

- Entry point: `send <id> <正文> --offpeak` (`<正文>` means message body). Sessions have no type; off-peak is a send property. An off-peak send exclusively occupies an idle session:
  reject if the session has a live runner or nonempty queue (exit code 2); reject other sends to the same session while queuing too. Convention: create a separate session for off-peak sends;
  after completion, ordinary or off-peak sends in the same session can request rework.
- Obtain a ticket immediately; ticket failure (ineligible, quota exhausted, endpoint changed) is exit code 2. Without `--wait`, successful ticket acquisition returns 0 immediately; `--wait` timeout starts only
  when the turn starts running.
- Keep the session's model and thought level; the model must appear in the off-peak list. Support only individual plans from the two families.
- Gate unchanged: the dispatcher answers pending requests; model review still uses the regular provider.
- Automatically reacquire expired or invalid tickets, at most 2 reacquisitions per send; exhausting them ends the turn with an error (exit code 4). Settle the ticket on every terminal outcome; after 3 settlement retries,
  leave only a status warning. On macOS, use caffeinate to prevent idle sleep while waiting for a ticket and during execution.
- doctor item ⑤ / `doctor --offpeak` checks four layers at zero quota cost (credentials, builtin entry, server contract, fake-ticket end-to-end path), reporting
  ok / changed / unavailable / not-applicable. Only changed yields exit code 1; record the verified App version and merely warn on a mismatch.
- Do not implement: automatic self-check before send, scheduled self-checks (users configure cron themselves); CLI reverse request `offPeak/create`; team plans.
- User addition on 2026-09-28: dispatch **defaults to ordinary sends**. Offer off-peak only as a choice: before the first dispatch in each conversation, run zero-quota `quota`,
  explain "off-peak is available instead (free, uncertain start time); this tool has used it N times today, and here is whether a ticket can be obtained now," and send `--offpeak` only if the user chooses it. Rework also defaults to ordinary sends
  (replacing "Claude may choose off-peak itself for rework taking over 20 minutes"). Reason: the server does not report remaining requests; the roughly 3 daily requests can easily be consumed by reacquisitions for one send,
  so the user should make an informed choice about off-peak.

Reopen when: ZCode moves off-peak queuing into app-server (the CLI queues itself) or provides an official API; or the server starts requiring client signatures.

## D21 Start-plan sends: leave the session unchanged, route each turn separately, supply JWT through host reverse requests

Decision (2026-09-29, reopening PLAN-v4 track 3, "do not implement start-plan"): `send <id> <正文> --start-plan` (`<正文>` means message body). A send property (the same philosophy as D20:
sessions have no type), with the same queue, gate, timing, and exit codes as ordinary sends; no ticket, waiting, or settlement. Only this turn's model requests use the builtin
`account:<family>-start-plan` entry (endpoint `https://zcode.z.ai/api/v1/zcode-plan/anthropic`), consuming Start Plan subscription quota.
Send prerequisites (exit code 2): the session model appears in that entry's `builtinModelIds` (GLM-5.3-Flash, GLM-5.2, GLM-5-Turbo; GLM-5.3 is absent);
credentials yield family (`oauth:active_provider`) and `zcodejwttoken` (`readStartPlanAuth`, requiring neither Coding Plan key nor user_info);
and the builtin file contains the entry. Combining with `--steer` / `--offpeak` / `--resume` is a usage error (exit code 1). Before opening a connection, the runner checks the queue head; for a start-plan
item it first adds JWT to secrets and providerAuth. Before send, push `provider/updateAccountConfig` to authorize the entry (revision prefix
`zcode-executor-start-plan:`, same shape as D20); send includes `modelSelection` (per-turn routing) and
`modelExecution:{selectionScope:"execution", memoryExtraction:"skip"}`, and records `executor.startplan.started`.

Why (2026-09-29 comparison with local App 3.14.1's zcode.cjs and app.asar; sources and evidence in `docs/tasks/T8-startplan.md`):

- The CLI recognizes inline `modelExecution.requestAuth` in send parameters only for turns with `mode:"off-peak"`; every other zhipu-account (including start-plan)
  sends reverse request `interaction/requestProviderRuntimeHeaders` before every model request. Start-plan authentication must therefore use reverse requests;
  appserver.mjs's existing providerAuth hook reply shape (`{headersApplied:true, requestAuth:{apiKey}}`) is sufficient.
- The material supplied by the App host for start-plan (app.asar `createAccountProviderRequestAuthService.resolveCurrent`) is simply
  `{apiKey: <zcodejwttoken>}`: JWT alone is the credential, without extra headers or a Coding Plan key. credentials.json has no
  start-plan key in the first place. This is also why `readStartPlanAuth` does not require user_info or the two plan keys.
- The CLI exempts zhipu-account with `mode:"start-plan"` from client signatures (zcode.cjs `wEs`); a personal provider file, however, defines api-key providers,
  and pointing one at zcode.z.ai forces domain-based signing, while JWT is not shaped like `id.secret` ([verified.md](verified.md), 2026-09-28, "Signing keys require one dot").
  The shortcut of constructing an api-key provider in the personal file is therefore a dead end; an account provider is required.
- `modelExecution.selectionScope` must be `"execution"` (a required literal in the send-parameter schema), meaning per-turn routing. Without it,
  modelSelection may become the session's current model, rerouting later ordinary sends too; their runner has no JWT and the turn can only fail.

Reason for reopening PLAN-v4 track 3: the 2026-09-21 note, "start-plan uses an expiring jwt and requires refreshing OAuth ourselves," was wrong in two ways:
D20 already decrypts `zcodejwttoken`, with no expiry observed live; the host's start-plan requestAuth does not need OAuth refresh either. Simply feed the same JWT
to app-server in response to reverse requests.

Risks and boundaries: endpoints and key names are private App implementation details; changes break this channel without affecting ordinary dispatch. The CLI already handles
backoff and recovery when Start Plan is busy (3008/3009/3010); for captcha (3007), it requests runtime headers again (we answer with the same JWT), and the turn ends with an error if a human must solve the CAPTCHA. If providerAuth
cannot answer (credentials gone), fail the turn immediately instead of waiting pointlessly for 180 seconds. Treat JWT as in D20: only memory, the secrets-redaction list, and JSON-RPC replies.
Do not add doctor ⑥: send prerequisites cover missing credentials and entries; interface changes surface as a turn error on the next send.

Reopen when: the CLI recognizes other authentication sources for start-plan turns; or the builtin entry's mode/model list changes (read the model list from the builtin file through `startPlanModelIds`
and follow App changes).

Live verification (2026-09-29; see [verified.md](verified.md), "Start-plan send live probe"): the entire implementation chain works as designed (authorization push, rerouting,
host-supplied JWT, requests reaching the zcode-plan endpoint), but the server rejects with HTTP 400 `captcha verify failed`. The zcode-plan endpoint requires
an Alibaba Cloud CAPTCHA (`x-aliyun-captcha-verify-param`); the desktop App host answers through its embedded CAPTCHA SDK, and a headless host cannot produce that header.
For the same reason, the CLI's standalone port supports only individual-coding-plan. **Conclusion: the start-plan channel currently depends on the App UI;
the executor-side implementation remains, but cannot be used**. `--start-plan` ends with a clear turn failure (exit code 4); ordinary and off-peak sends are unaffected.
Additional reopen condition: the server waives CAPTCHA requirements for account-based start-plan (for example, issuing platform keys as for Coding Plans), or provides verification credentials
a headless host can reuse.

**Removal (2026-10-02; reopened 2026-10-09)**: the entire implementation was once removed because of that CAPTCHA gate (reverting e26fedb); on 2026-10-09 the server no longer required human verification for account-based
start-plan (the reopen condition was met), and the old implementation was restored (e26fedb's code and tests); see [verified.md](verified.md) for live verification.

## D22 Implement the watch pane as a Claude Code mod; data comes only from the `watch` subcommand

Removed in full on 2026-11-05 (`watch` subcommand, `hooks/`, `dsh-plugin/`, `types/`); the text below is the historical record.

Decision (2026-10-02): add a watch pane to the plugin that works only in Claude Code (`hooks/`, a Claude Code function-hook plugin, commonly called a mod).
`/zcode` opens it; Claude sends open it automatically. Show live replies, tools, pending requests, and off-peak queues across this project's sessions, with a status-bar summary and pop-up notifications.
Add a persistent, read-only `watch --json` CLI command that pushes session snapshots; the mod starts a `watch` child process and keeps it until the session ends.

Why:

- Previously, dispatched tasks were observable only through Claude polling `status` / `follow`; humans could not see the process. A mod can draw panes, status bars, and notifications at zero quota cost.
- The mod runtime has no Node and cannot import `lib/`. Reading `runs/` directly would require rewriting phase detection inside the mod (`phaseOf` checks whether processes are alive, which the mod cannot do),
  so data comes only from the CLI, leaving one copy of the logic. Use persistent `watch` pushes rather than periodic mod calls to `status`: event files reach 121MB, making repeated full reads unaffordable.
- The pane is view-only: Claude still relays approvals and questions with AskUserQuestion (AGENTS.md hard constraint); no approve button in the pane.
- Display only sessions belonging to the repository of the current Claude session (determine the repository from git's shared data directory; see [CONTEXT.md](CONTEXT.md)).
- Desktop animated icons use `Svg` image mode with CSS animation inside SVG: tests on 2026-10-02 showed the host irregularly refreshing `isInteractive` sandbox frames, causing obvious flicker; image mode animates without flicker ([verified.md](verified.md)).

Risks and boundaries: Claude Code marks mod interfaces as early preview, subject to version changes; therefore use few interfaces in the mod and keep logic in the CLI. Only Claude Code recognizes mods;
Codex, Gemini, Copilot, and Grok retain only the skill and CLI. Whether function hooks are enabled by default in a normally installed plugin is subject to checkpoint verification.

Reopen when: Claude Code removes or substantially changes function hooks; or answering pending requests in the pane is needed (first change the AGENTS.md hard constraint).

Observed (2026-10-02, [verified.md](verified.md), "Claude Code mod"): the user reported desktop checkpoints W1–W9 passing; Claude dispatch opened the pane automatically at normal width. `watch` took about 0.4 seconds for the initial local 219 sessions, with steady CPU around 4%.
v0.4.1 (2026-10-03): display the latest reply message as Markdown (snapshots add `replyMarkdown`, restoring code fences and table headers when truncated); collapse by default above two lines and expand with a button.
Unverified: whether other hosts error when reading `hooks/hooks.json` containing only `modules` (if Codex or Copilot CLI reads it according to Claude's hook convention); change the manifest only after someone reports an error.

## D23 Gate self-protection and tradeoffs from the 2026-10-08 security audit

Decision (2026-10-08, after verifying external security-audit findings D1–D9 individually against code and the local machine):

1. **The out-of-bounds hard rule follows the kernel's path traversal** (audit D1). Previously, `path.resolve` before `realpathSync` lexically collapsed `<执行副本>/link/../x` to apparently in-bounds `<执行副本>/x`
   (`<执行副本>` denotes the worktree), while the actual write landed one level above the symlink target. Now resolve segment by segment from the root (expand symlinks in place, let `..` move to the real parent, follow dangling symlinks in the final segment too); evaluate both the original string and the lexically normalized string, matching if either is out of bounds.
   Unknown destinations, or write tools without an assessable path, always match.
2. **Gate self-protection** (audit D2). If the executor touches this tool's data directory (excluding default worktree root `worktrees/` and this session's worktree), or invokes this tool's CLI, mechanically ask a human under `self-modify-approval`.
3. **Snapshot task files on queue entry; review reads only snapshots** (audit D3). Store at `runs/<id>/tasks/<sha256>.md`, recording the hash in the queue item and `executor.send`.
4. Narrow hardening: remove host-agent credential environment variables from the zcode child (D4); `runs/` tree 0700, persisted files 0600, redact `pending.json` by value (D5); disable fsmonitor, hooks, external diff, textconv, and filter drivers for approval-probe git (D6);
   fast screen recognizes only a unique, standalone Y (D8); escape terminal control characters in output (D9-①); randomize temporary names for atomic writes and create exclusively (D9-②); retain reverse-request reply caches only until the turn boundary (D9-③).

Why:

- Executor ZCode and runner are **the same user**. File permissions and owner checks cannot stop it writing `answer.json` or running `zcode-executor approve`; the audit explicitly rejected "chmod only" fixes.
  The human gate is the prerequisite for D3's "model review only produces allow or ask a human," so neither operation is delegated to a model.
- Self-protection deliberately has a narrow matching surface. The audit's claim that "matching the data-directory prefix causes no false positives" is false here: default worktrees live under `~/.zcode-executor/worktrees/`, so routine executor commands contain that prefix.
  Exempt `worktrees/` and this session's cwd; only the rest is the control plane. For CLI calls, recognize only "name followed by a subcommand"; merely mentioning `zcode-executor` (clone, grep, npm view) does not count.
- Put snapshots in the data directory rather than the worktree: the skill requires task files in the worktree, where the executor can edit them. Reading the live file would let it write "what the user said" itself.
  `executor.send` records from before the upgrade have no snapshots, so those task-file passages are no longer review evidence; less evidence can only cause more human referrals.
- New checks always fail toward asking a human: an unresolvable path, a probe unable to enumerate filter drivers, or an ambiguous fast-screen answer never allows.

Risks and boundaries (recording known gaps honestly):

- **Self-protection recognizes only direct forms**: literal paths, `~`, `$HOME`, `$PWD`, `$ZCODE_EXECUTOR_HOME`, relative `..`, and a CLI name followed by a subcommand. Constructed variables, encoding, or writing a script and then running it
  (code triggered by `npm test` writing `answer.json`) are not recognized; they still go through model review and humans. There is no complete fix under the same user; a complete fix requires system isolation (another user or a sandbox), a product decision outside this scope.
- Self-hosted development causes extra human referrals: commands containing literal `zcode-executor send`, for example in commit messages or documentation, are intercepted to ask a human. Referral is not denial.
- Hard links: hard-link a file from outside the worktree inside it, then Edit in place, and path-boundary checks cannot detect it. The audit did not mention this; it was not addressed here.
- Environment variables (D4) cut only direct inheritance. Under the same user, the host agent's and runner's own process environments and shell rc files remain readable. The list includes `GITHUB_TOKEN` / `GH_TOKEN`
  (explicitly named in the audit; Copilot CLI credentials capable of remote writes). Executor tasks needing GitHub credentials use the locally authenticated gh / git credential helper. This is not configurable.
- `--deny "WebFetch WebSearch"` removes those two builtin network tools from tool registration (including alias `web_search`; [verified.md](verified.md), 2026-10-08 source check), reducing the available surface;
  Bash, js, and MCP tools can still access the network. Blocking network access requires system or container restrictions.
- Persistence permissions (D5) protect against other users on the same machine. The data-directory root was not changed to 0700: the default worktree root sits below it, and users such as container build users may need to traverse it.
- Git probes (D6) disable known switches; git itself does not guarantee safety under untrusted repository configuration. Submodules' own configuration cannot be disabled here: `git status` enters checked-out submodules and runs git again,
  and filter driver names defined there cannot be enumerated here. The audit did not mention filter drivers; they were discovered by local tests while verifying D6 ([verified.md](verified.md), 2026-10-08).
- No implementation of `ApplyPatch` was found in the local 3.14.4 builtin tool registry ([verified.md](verified.md)); it currently always asks a human. If live ZCode emits it, capture its patch format before adding path extraction.

Unchanged, and why:

- **Do not apply Jev's heuristic redaction to slow-review prompts** (audit D7). Prompts go to the same provider as the executor, which already has the content; heuristic redaction would hide parameters needed by the review model,
  becoming an evasion technique (make dangerous parameters resemble credentials). Similarly, `pending.json` redacts only exact secret values; humans need the original text to decide whether to allow.
- **Write / Edit bodies still reach the fast screen** (latter half of audit D8). Receiving original bodies is an existing test invariant (the gate.test case "原始正文，不得丢弃", meaning "original body must not be discarded").
  It reflects T3.3's cost tradeoff: in-bounds writes authorized by the task file pass the fast screen without slow review every time. Changing this is a product decision.
- Do not change the answer channel to a unix socket (audit D2's optional second layer): the same user can still connect, and the audit itself calls this defense in depth. CLI invocation is already mechanically intercepted by the self-protection hard rule;
  another socket lifecycle and cross-platform handling are not worth it.
- README's "worktree is a sandbox" wording and Jev pass bypassing prose hard rules: the audit left these as product/documentation decisions for the author; unchanged.

Reopen when: system isolation is needed for the executor; ZCode actually emits `ApplyPatch` or another write tool; live permission requests arrive without `requestId` (currently deduplicated by full parameters, sufficient but unverified).

## Addendum: select model-review models from the provider registry already pushed, without another readState

The runner already pushed the registry at startup, and the model list in registry matches readState, saving a round trip. The cost is losing backend `disabledReason` visibility;
neither Coding Plan model has ever been disabled in live runs. Switch to readState if a disabled model appears.

## Addendum: project documentation no longer equals user intent; read it from the original repository instead (2026-09-28)

Remove allow exception `documented-ops` and the sentence "does not apply if documentation lists this as routine maintenance" from `shared-service-lifecycle`: repository documentation is written by the repository author,
so an unfamiliar repository or executor-modified AGENTS.md could use it to clear soft rules (the same issue fixed in dsh-auto-approve that day).
Change the documentation source from worktree cwd to `repoRoot` (original repository root), recorded in the registry at `new`. Older entries and non-worktrees lack it, so do not read documentation; run `new` again.

## Deferred

- ~~While pending, ZCode resends permission requests every second; acceptance of replies to old envelope ids is unverified.~~ Verified (2026-09-08, post-delivery check ②):
  after 75 seconds pending, approve was still accepted and ZCode continued. Keeping only the latest 5 envelope ids is sufficient.

- ZCode App coexistence experiment (while this plugin runs a long task, open that same session in the App and inspect cli log).
  Both share `~/.zcode/cli/db/db.sqlite`, without cross-process locks. SQLite prevents torn files;
  logical consistency is unverified. Rely on worktree isolation for now.
- Synchronize sessions into `~/.zcode/v2/tasks-index.sqlite` so the App list can see them. Not in the first version.
- MCP shell and elicitation.
- Report issues upstream to zcode-acp. We no longer depend on it; reporting is optional, and ask the user first.
- Account-provider route (`account:bigmodel-individual-coding-plan` + `provider/updateAccountConfig`): pushing
  `{access:{type:'zhipu-account',entitled:true}}` returns received, but `session/create` still reports that the registry lacks
  the model. Further progress requires untangling `states` and the builtin active file's semantics. The only benefit is "the session appears under the same account in the App"; keep this noted for now.
- Support only ZCode App 3.12+, without dual old/new handshake compatibility. Reason: `--version` cannot distinguish them (3.11.2 and 3.12.2 both print
  `0.16.5`); dual handshakes would double mocks and tests; the App auto-updates, and user machines cannot return to old versions.
- At `new`, record the owning repository in the registry even for non-worktree cwd: currently `repoRoot` is written only for worktrees; otherwise `list` queries git live and caches the result.
  This would change the registry format, and old records lack the field; wait until live lookup becomes a bottleneck.
- Left by D23: `ApplyPatch` path extraction (wait for a live patch-format capture); hard-link boundary crossing; make the host-credential environment-variable list configurable (revisit if someone cannot run without `GITHUB_TOKEN`);
  switch approval probes to plumbing commands that do not compare contents (`diff-files` / `diff-index` / `ls-files`) and handle submodules, fully preventing repository configuration from executing programs through them.

## D24 Configurable proxy for Jev fast screening: `review.jev.proxy`, a self-implemented CONNECT tunnel, without environment-variable proxies

Decision (2026-10-28, user request to proxy Jev requests): configure `review.jev.proxy` in `~/.zcode-executor/config.json` (a nonempty `http://`/`https://` URL,
optionally containing userinfo for Basic Proxy-Authorization) to send Jev fast-screen HTTP requests through that proxy's CONNECT tunnel. `lib/review/proxy-fetch.mjs`
implements this with zero dependencies (`http.request` sends CONNECT, wrap the tunnel in target TLS, and `http(s).request`'s `createConnection` takes over the tunnel socket), wrapping the result as the minimal Response
required by jev.mjs's fetchImpl seam. The enablement contract stays unchanged: only non-whitespace `review.jev.apiKey` enables Jev; proxy without key makes `loadConfig` issue a
warning and leaves the proxy unused. Deadline, retry, skip, and ZCode fallback logic remain unchanged; an unreachable proxy becomes network_error, using existing retries before fallback.

Why: the Jev endpoint is overseas and direct connections are unreliable. Do not use `NODE_USE_ENV_PROXY`: it parses env only at process startup (official undici documentation; available only from Node ≥22.21),
a detached runner's environment inheritance is unreliable (use config.json, as for D15's key), and proxy env passed through spawn would leak to the app-server child, changing the main dispatch
path's network behavior. The zero-dependency constraint (RULES §1) rules out undici `ProxyAgent`.

Reopen when: SOCKS or proxy-side mTLS is needed; Node natively provides a fetch proxy API configurable at runtime; outbound requests other than Jev also need proxying, in which case
promote proxy-fetch to a shared workflow-layer module. Tests do not cover the TLS handshake inside a tunnel to an https target (no self-signed test certificate with zero dependencies); update [verified.md](verified.md) after live verification.

## D25 Configurable Jev model name: `review.jev.model`, default changes from pinned `jev-1.13.0` to alias `jev-latest`

Decision (2026-10-28, released with D24 in 0.6.0): `review.jev.model` is an optional nonempty string, a model ID or alias, defaulting to `jev-latest` (official documentation examples all use the alias; since 2026-10-14 it resolves to `jev-1.14.0`). Relax response `model` validation: a pinned version must match exactly; an alias accepts either its echo or a resolved version (`/jev-\d+\.\d+\.\d+/`); everything else is an invalid response. Metadata reports the actual answering version on success, the configured value on error.

Why: models change generations; a fixed pin requires a release for each new version, and the documentation recommends aliases. Threshold 0.20 and schema `approval-v2` were set for `jev-1.13.0` (SPEC marks v2 as not recalibrated live). Using an alias accepts that "the threshold may no longer fit the latest version"; expose that risk through configuration, where pinning a version restores old behavior. PLAN already said "first version only apiKey, model constant; reopen when needed," and the need has appeared.

Reopen when: live tests show a newly resolved alias version badly mismatching the threshold; restore the default to the latest actually verified version or add per-model threshold tables. If TypeSafe adds a new model family not named jev-*, relax validation rules.
