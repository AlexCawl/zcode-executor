<!-- Source: zcode-acp-server 0.27.3 docs/PROTOCOL.md (https://github.com/william0wang/zcode-acp, Apache-2.0, author William Wang).
     Copied as a ZCode app-server protocol reference on 2026-09-07. Original project changes: a “3.12.2 changes” section and notices at the start of affected obsolete sections; other upstream text was unchanged. This language edition translates prose and adjusts navigation; protocol examples are preserved. -->

# ZCode JSON-RPC Protocol

English · [中文](zcode-app-server-protocol.zh-CN.md) · [Русский](zcode-app-server-protocol.ru.md)

This document describes the internal JSON-RPC protocol between zcode-acp-server
and the ZCode CLI.

## 3.12.2 changes (verified on a real device, 2026-09-18)

> This section was added by this project; it is not part of the original zcode-acp-server document. It records protocol changes in ZCode App 3.12.2.
> Original sections describing affected methods are marked “Invalid from 3.12; see above”; the original text is retained for comparison with older versions.
> For the full reasoning, see [`decisions.md`](../decisions.md) D14 and the “3.12.2 direct-connection probe” section in [`verified.md`](../verified.md).

**Removed methods**: `workspace/updateProviderRegistry` and `workspace/readState` both return `-32601 Method not found`.
The app-server now assembles its provider table (providers, models, and key authentication) from two files: the builtin provider config file
and the personal provider config file (both terms are defined in [`CONTEXT.md`](../CONTEXT.md)).

**Startup**: the new CLI searches for its builtin provider config file itself (internal function `resolveBundledZCodeBuiltinProviderConfig`).
It checks only `provider/` beside `zcode.cjs`, and `config/provider/` five levels above `zcode.cjs`. The latter reflects the source repository's layout;
inside the packaged App it resolves to `/config/…` at the filesystem root. A missing file causes an error and exit (the actual location is
`<App>/Contents/Resources/config/provider/zcode-builtin.json`). When the App launches the CLI, it supplies this location through an environment variable.
A directly spawned child receives no such hint, so we calculate and pass two variables ourselves:
`ZCODE_BUILTIN_PROVIDER_CONFIG_FILE` (builtin provider path, derived from `zcode.cjs`) and
`ZCODE_PERSONAL_PROVIDER_CONFIG_FILE` (the personal provider file we write). When both are set, the CLI uses them as supplied,
without refreshing from the CDN or touching the user's `~/.zcode/v2/provider_config.json`.

**Personal provider file shape** (copied from the CLI's legacy import function `importLegacyCliPersonalProviderConfig`):

```json
{"schemaVersion":1,"config":{
  "providerConfigRules":{"providerRules":[{
    "providerId":"zcode-executor","providerName":"zcode-executor",
    "config":{"group":"standard-personal",
              "access":{"type":"api-key","apiKey":"<config.json 里的 key>"},
              "api":{"type":"anthropic-messages","baseUrl":"<config.json 里的 baseURL>"},
              "personalModelIds":["GLM-5.3-Flash","GLM-5.3"],"modelOrder":["GLM-5.3-Flash","GLM-5.3"]}}]},
  "modelConfigRules":{"providerModelRules":[],"manualProviderModelRules":[]}}}
```

The preserved placeholders `<config.json 里的 key>` and `<config.json 里的 baseURL>` mean the key and baseURL from config.json, respectively.

**New `session/create` parameters** (strict schema: additional fields cause an error):

| Field | Description |
| --- | --- |
| `model` | `{providerId, modelId, options?:{reasoningLevel}}`, replacing the old `runtimeModel` |
| `runtimeModel` | No longer accepted; including it returns `Unrecognized key: "runtimeModel"` |
| `thoughtLevel` | Still required at the top level (when only `options.reasoningLevel` was supplied, `settings.thoughtLevel.current` was empty in real-device testing; supplying both is safest) |

GLM-5.3 models require `options.reasoningLevel`; omitting it returns `Reasoning level is required`. The response's
`settings.model.available` is the model table currently recognized by app-server; previously it required a separate `workspace/readState` call.
This plugin computes tier assignments locally from config.json; during the `doctor` handshake, this table is used only to check that all models in the personal provider file are recognized.

**`workspace/generateText`**: `modelRef` was renamed to `selection`, with the same shape as `model` above
(`{providerId, modelId, options?:{reasoningLevel}}`). Without `selection`, it reports
`Unrecognized key: "modelRef"`.

**New reverse request `interaction/requestProviderRuntimeHeaders`**: in the zcode.cjs 3.12.2 source, the host-mode headers port
requests runtime headers from the client before a model request. **Checkpoint 5 real-device testing (2026-09-18) confirmed that api-key providers do not send this request**:
turns and generateText use the key in the personal file directly. Account providers were not verified. The client retains a built-in response just in case.
The params shape below was read from source; no instance was captured on a real device:

```json
{
  "id": 200,
  "method": "interaction/requestProviderRuntimeHeaders",
  "params": {
    "requestId": "<sessionId>:provider-runtime-headers:<uuid>",
    "sessionId": "sess_...",
    "turnId": "...",
    "workspace": { "workspacePath": "...", "workspaceKey": "..." },
    "modelSelection": { "providerId": "zcode-executor", "modelId": "GLM-5.3" },
    "providerId": "zcode-executor",
    "accountAccess": null,
    "reason": "model-request"
  }
}
```

Two response shapes:

```json
{ "headersApplied": true, "requestAuth": { "apiKey": "...", "headers": { "...": "..." } } }
```

```json
{ "headersApplied": false, "errorMessage": "..." }
```

After 180 seconds without a response, the turn reports `-32031 Provider runtime headers were not applied before model request attempt`.

**Unchanged methods**: `session/send`, `resume`, `subscribe`, `stop`, `close`, `list`,
`requestRuntimePreferences`, `interaction/requestPermission`, `interaction/requestUserInput`,
and the event types of `session/event` are unchanged. The session lifecycle, end-of-turn detection, and the gate's three stages need no changes.

## Protocol Overview

ZCode communicates over stdio using **line-delimited JSON**. The message format
resembles JSON-RPC, but **does not include the `jsonrpc` field**.

### Message classification

Messages are classified by the presence of `id` and `method`:

| Combination        | Type         | Direction                          |
| ------------------ | ------------ | ---------------------------------- |
| `id` + no `method` | Response     | zcode -> bridge                    |
| `id` + `method`    | Request      | bridge -> zcode or zcode -> bridge |
| `method` + no `id` | Notification | bidirectional                      |

### Request format

```json
{
  "id": 1,
  "method": "session/create",
  "params": {
    "workspace": {
      "workspacePath": "/path/to/project",
      "workspaceKey": "/path/to/project"
    },
    "mode": "yolo"
  }
}
```

### Response format

```json
{
  "id": 1,
  "result": {
    "session": {
      "sessionId": "sess_abc123",
      "title": "your prompt text..."
    }
  }
}
```

### Error format

```json
{
  "id": 1,
  "error": {
    "message": "prompt is running",
    "code": 1308
  }
}
```

### Notification format

```json
{
  "method": "session/event",
  "params": {
    "sessionId": "sess_abc123",
    "seq": 42,
    "type": "turn.started",
    "payload": {}
  }
}
```

## Session Lifecycle Methods

### `session/create`

Create a new session. Note: the bridge defers this call until a session's
first use — ACP `session/new` returns a local placeholder id and materializes
the backend session (this RPC) on the first prompt / config change / extension
method, so an editor startup that never sends a message leaves no session.

**Request:**

```json
{
  "id": 1,
  "method": "session/create",
  "params": {
    "workspace": {
      "workspacePath": "/path/to/project",
      "workspaceKey": "/path/to/project"
    },
    "mode": "yolo"
  }
}
```

**Response:**

```json
{
  "id": 1,
  "result": {
    "session": {
      "sessionId": "sess_abc123",
      "title": "",
      "traceId": "trace_xyz789"
    }
  }
}
```

### `session/list`

List all sessions.

**Request:**

```json
{
  "id": 2,
  "method": "session/list",
  "params": {
    "workspace": {
      "workspacePath": "/path/to/project",
      "workspaceKey": "/path/to/project"
    }
  }
}
```

### `session/resume`

Resume an existing session.

The sessionId may be a lazy `session/new` placeholder (the editor persists it
and resumes it after a bridge restart). The bridge resolves it before the
backend call: an in-memory or persisted (`acp-lazy-sessions.json`) mapping is
followed to the real backend session — resuming it, or materializing a fresh
empty one if the placeholder was never used. Real ids from `session/list` pass
through unchanged.

**Request:**

```json
{
  "id": 3,
  "method": "session/resume",
  "params": {
    "sessionId": "sess_abc123",
    "workspace": {
      "workspacePath": "/path/to/project",
      "workspaceKey": "/path/to/project"
    }
  }
}
```

### `session/send`

Send a prompt.

**Request:**

```json
{
  "id": 4,
  "method": "session/send",
  "params": {
    "sessionId": "sess_abc123",
    "content": "your prompt text"
  }
}
```

**Response:**

```json
{
  "id": 4,
  "result": {
    "accepted": true
  }
}
```

Sending another `session/send` while a turn is already running is rejected with
JSON-RPC error code `-32010`, message `A prompt is already running for this
session` (checked against ZCode source on 2026-09-21: rejected directly since 3.12.2; the queued steering from 3.11 was removed).

### `session/stop`

Stop the current turn. This is a **request**: it must carry an `id` —
app-server ignores any message without an `id` (checked on 2026-09-21 against ZCode 3.14.0 source and the local 3.12.2 zcode.cjs).

**Request:**

```json
{
  "id": 8,
  "method": "session/stop",
  "params": {
    "sessionId": "sess_abc123"
  }
}
```

**Response:** `{}` (result may contain additional fields; ignore them). Once stopped, the turn ends with
`turn.completed` (`payload.resultType: "cancelled"`, see below), not
`turn.failed`.

### `v4/command` (minimal usage)

Checked against ZCode source (3.14.0) and verified with a zero-token probe on local App 3.12.2 on 2026-09-21. v4 and legacy
`session/*` methods use **the same NDJSON stream**. The method is `v4/command`, and request params are the command envelope:

```json
{
  "id": 9,
  "method": "v4/command",
  "params": {
    "commandId": "<任意唯一字符串，客户端用 crypto.randomUUID()>",
    "clientId": "zcode-executor",
    "sessionId": "sess_abc123",
    "type": "sendText",
    "issuedAt": 1758412800000,
    "payload": { "text": "方向改一下，先只改 A", "requestedDelivery": "guide" }
  }
}
```

The preserved `commandId` placeholder means any unique string, generated by the client with `crypto.randomUUID()`.
The example text “方向改一下，先只改 A” means “Change direction: modify only A first”.

The response result is an ACK: `{commandId, status, revisionAtDecision, reasonCode?, message?,
result?}`, with `status ∈ accepted | rejected | stale | duplicate | noop | failed`.
`accepted | noop | duplicate` count as success; all other statuses count as failure.

**`requestedDelivery` for `sendText`**: `"guide"` injects input after the next tool batch and before
its next model request when the turn is busy. If there is no tool boundary or there are attachments, the CLI falls back to queuing
(`fallbackReasonCode`) and executes the input after the turn ends. Both delivery modes count as successful steering.
On acceptance, `result` is `{type: "inputAccepted", delivery: "startNow" | "queue", inputId}`
(read from source, not captured on a real device). **`sendText` on an idle session immediately starts a new turn**
(`delivery: "startNow"`), so use steering only during an active turn; send to an idle session via `session/send`.
After steering is accepted, the legacy event stream continues to push `turn.steerQueued` / `turn.steerDrained` as ordinary turn events.

**`stop`**: `payload: {}` returns `{status: "accepted"}` even on an idle session (verified locally).

**No v4 topic subscription or handshake is required**: the v4 gateway checks only that the session exists. Sessions created by legacy `session/create`
also work; v4 `createSession` is unnecessary and lacks `toolDenylist`.

Four local checks (App 3.12.2, 2026-09-21):

| Command | ACK |
| --- | --- |
| `sendText` with a nonexistent sessionId | `{status: "rejected", reasonCode: "proto.sessionNotFound"}` |
| `sendText` with empty text | `{status: "failed", reasonCode: "proto.invalidPayload", message: "input must not be empty"}` |
| `type: "stop"`, `payload: {}` on an idle session | `{status: "accepted"}` |
| Direct `sendText` on a session created by legacy `session/create` | Works without subscribing or a handshake |

### `session/read`

Read the session state and projection.

**Request:**

```json
{
  "id": 5,
  "method": "session/read",
  "params": {
    "sessionId": "sess_abc123"
  }
}
```

**Response:**

```json
{
  "id": 5,
  "result": {
    "projection": {
      "status": "idle",
      "contextUsed": 1234,
      "contextWindow": 32000,
      "totalTokenCount": 5678
    },
    "settings": {
      "mode": { "current": "yolo" },
      "model": { "current": { "modelId": "GLM-5.2" } },
      "thoughtLevel": { "current": "high" }
    },
    "todos": [{ "content": "Implement login", "status": "pending", "priority": "high" }]
  }
}
```

### `session/messages`

Fetch the session's historical messages.

**Request:**

```json
{
  "id": 6,
  "method": "session/messages",
  "params": {
    "sessionId": "sess_abc123"
  }
}
```

## Event Stream Subscription

### `session/subscribe`

Subscribe to a session's event push.

**Request:**

```json
{
  "id": 7,
  "method": "session/subscribe",
  "params": {
    "sessionId": "sess_abc123",
    "deliveryKind": "desktop-continuous",
    "includeSnapshot": true,
    "afterSeq": 0
  }
}
```

**Response:**

```json
{
  "id": 7,
  "result": {
    "eventSeq": 42,
    "snapshot": {
      "projection": { ... },
      "messages": [ ... ]
    }
  }
}
```

## Event Types

After subscribing, zcode pushes events via `session/event` notifications:

### `turn.started`

The turn has started.

```json
{
  "method": "session/event",
  "params": {
    "sessionId": "sess_abc123",
    "seq": 43,
    "type": "turn.started",
    "payload": {}
  }
}
```

### `model.streaming`

Model streaming output.

```json
{
  "method": "session/event",
  "params": {
    "sessionId": "sess_abc123",
    "seq": 44,
    "type": "model.streaming",
    "payload": {
      "kind": "text_delta",
      "delta": "this code..."
    }
  }
}
```

`kind` can be:

- `text_delta`: text delta
- `reasoning_delta`: reasoning text delta
- `tool_call`: tool call declaration (caches toolName and input)

### `tool.updated`

Tool status update.

```json
{
  "method": "session/event",
  "params": {
    "sessionId": "sess_abc123",
    "seq": 45,
    "type": "tool.updated",
    "payload": {
      "kind": "scheduled",
      "toolCallId": "call_xyz",
      "toolName": "Bash",
      "input": { "command": "ls -la" }
    }
  }
}
```

`kind` can be:

- `scheduled`: tool scheduled
- `started`: tool started executing
- `progress`: progress update (stdoutTail / stderrTail)
- `result`: tool finished
- `error`: tool error
- `batch`: multiple tools finished in a batch

### `turn.completed`

The turn completed.

```json
{
  "method": "session/event",
  "params": {
    "sessionId": "sess_abc123",
    "seq": 46,
    "type": "turn.completed",
    "payload": {
      "resultType": "success",
      "usage": {
        "totalTokens": 1234
      }
    }
  }
}
```

`payload.resultType` can be (checked against ZCode source on 2026-09-21: non-success outcomes also use
`turn.completed`, not `turn.failed`):

| `resultType` | Meaning |
| --- | --- |
| `success` | Finished normally |
| `cancelled` | Turn stopped (`session/stop`) |
| `error_max_turns` | Turn limit reached |
| `error_max_budget` | Budget limit reached |
| `error_during_execution` | Error during turn execution |
| `error_max_tool_calls` | Tool-call limit reached |

### `turn.failed`

The turn failed.

```json
{
  "method": "session/event",
  "params": {
    "sessionId": "sess_abc123",
    "seq": 47,
    "type": "turn.failed",
    "payload": {
      "error": {
        "code": 1308,
        "message": "prompt is running"
      }
    }
  }
}
```

### `session.updated`

Session state update (usage, etc.).

```json
{
  "method": "session/event",
  "params": {
    "sessionId": "sess_abc123",
    "seq": 48,
    "type": "session.updated",
    "payload": {
      "usage": {
        "inputTokens": 1234
      },
      "contextWindow": 32000
    }
  }
}
```

### Steer lifecycle events

When a user input is steered into (queued behind) a running turn, the backend
emits a pair of lifecycle events (app-server 0.15.2+). The bridge does
not currently translate these — they are tracked as a future enhancement (see
`BACKLOG.md` in the upstream zcode-acp documentation (not included in this repository)).

```json
{
  "type": "turn.steerQueued",
  "payload": {}
}
```

```json
{
  "type": "turn.steerDrained",
  "payload": {}
}
```

## Interaction Protocol (Server -> Client)

Requests that zcode actively sends to the bridge.

### `interaction/requestPermission`

Tool permission request.

```json
{
  "id": 100,
  "method": "interaction/requestPermission",
  "params": {
    "requestId": "req_xyz",
    "sessionId": "sess_abc123",
    "toolCallId": "call_xyz",
    "toolName": "Bash",
    "reason": "run command",
    "input": { "command": "rm -rf /" },
    "options": [
      { "optionId": "allow", "kind": "allow_once", "name": "Allow once" },
      { "optionId": "deny", "kind": "deny_once", "name": "Deny" }
    ]
  }
}
```

### `interaction/requestUserInput`

User input request (ExitPlanMode / AskUserQuestion).

**ExitPlanMode:**

```json
{
  "id": 101,
  "method": "interaction/requestUserInput",
  "params": {
    "requestId": "req_xyz",
    "sessionId": "sess_abc123",
    "toolCallId": "call_xyz",
    "schema": { "interaction": "plan_approval" },
    "input": { "plan": "1. Implement login\n2. Implement signup" }
  }
}
```

**AskUserQuestion:**

```json
{
  "id": 102,
  "method": "interaction/requestUserInput",
  "params": {
    "requestId": "req_xyz",
    "sessionId": "sess_abc123",
    "toolCallId": "call_xyz",
    "questions": [
      {
        "question": "Select the files to test",
        "multiSelect": true,
        "options": [
          { "label": "auth.test.ts", "value": "auth" },
          { "label": "user.test.ts", "value": "user" }
        ]
      }
    ]
  }
}
```

### Bridge routing (protocol negotiation)

ZCode `interaction/*` requests are routed to different ACP interaction
mechanisms based on client capabilities:

| Request type                                                  |      Client supports elicitation.form      |              Client does not              |
| ------------------------------------------------------------- | :----------------------------------------: | :---------------------------------------: |
| Tool auth (`interaction/requestPermission`)                   |        `session/request_permission`        |       `session/request_permission`        |
| ExitPlanMode (`interaction/requestUserInput` + plan_approval) | `elicitation/create` (approve/reject form) |       `session/request_permission`        |
| AskUserQuestion (`interaction/requestUserInput`)              |     `elicitation/create` (single form)     | per-question `session/request_permission` |

**Capability detection**: at `initialize` time the client declares support via
`clientCapabilities.elicitation.form`. The server detects it with
`server.supportsElicitationForm()`.

**Reconnect resend**: interaction requests are one-shot and raced across the
clients connected when they fire (first response wins). A client that was
offline at that moment never sees them — so when a client completes
`session/load` / `session/resume` (the reconnect catch-up), the bridge re-sends
that session's still-unanswered interaction requests to it (after a short
delay, so the replay renders first). The re-send joins the existing race: if
another client answers first, the reconnected client receives `$/cancel_request`
and should drop the dialog.

**elicitation form example** (AskUserQuestion):

```json
{
  "method": "elicitation/create",
  "params": {
    "mode": "form",
    "sessionId": "sess_abc123",
    "message": "Please answer 2 questions.",
    "requestedSchema": {
      "type": "object",
      "properties": {
        "q_0": {
          "type": "string",
          "title": "Select the files to test",
          "oneOf": [
            { "const": "auth.test.ts", "title": "auth.test.ts" },
            { "const": "user.test.ts", "title": "user.test.ts" },
            { "const": "__skip__", "title": "Skip this question" }
          ]
        },
        "q_0_other": {
          "type": "string",
          "title": "↳    or type a custom value (overrides the selection)"
        }
      },
      "required": []
    }
  }
}
```

ACP/MCP elicitation string fields are EITHER an enum (restricted dropdown) OR
free text — the spec forbids a single field that is both. So each question is
rendered as TWO fields: `q_<i>` (a `oneOf`/`anyOf` enum dropdown of the model's
suggested answers, with a trailing "Skip this question" option whose `const` is
the `__skip__` sentinel and whose `title` is the readable label) and
`q_<i>_other` (a free-text companion). On submit, a non-empty `q_<i>_other`
overrides the dropdown (single-select) or is appended to the picked values
(multi-select); selecting "Skip this question" or leaving both blank skips just
that question without cancelling the form.

**elicitation response** (accept/decline/cancel):

```json
{
  "action": "accept",
  "content": { "q_0": "auth.test.ts" }
}
```

**ExitPlanMode elicitation form** — single `feedback` text field; no
approve/reject dropdown. The client's own submit button is the approve action;
typing into the field is the reject action. Submitting with the field empty
approves the plan; submitting with text rejects it and returns the text to
zcode as the decline `reason` (so the agent sees the redirection when it
re-plans). The cancel/decline button is a plain reject with no reason.

```json
{
  "method": "elicitation/create",
  "params": {
    "mode": "form",
    "sessionId": "sess_abc123",
    "message": "Ready to code?\n\n1. Implement login\n2. Implement signup\n\nLeave the box empty and submit to approve; type feedback to reject and redirect.",
    "requestedSchema": {
      "type": "object",
      "properties": {
        "feedback": {
          "type": "string",
          "title": "Feedback",
          "description": "Empty = approve the plan. Anything typed = reject and use this text as the redirection."
        }
      },
      "required": []
    }
  }
}
```

## Extension Methods (0.14.8+)

### `session/fork`

Fork a new session from a checkpoint.

**Request:**

```json
{
  "id": 8,
  "method": "session/fork",
  "params": {
    "sessionId": "sess_abc123",
    "target": { "kind": "latestCheckpoint" }
  }
}
```

### `session/rewind` — removed in 0.16+

`session/rewind` (and `session/rewindCascade`) existed up to app-server
0.15.x. The 0.16 app-server removed them from its RPC dispatch (verified
against 0.16.3: `-32601 Method not found`) — rewind moved to the v4
conversation API (`v4/conversation/fileRewindPreview` and friends), which the
bridge does not speak. The bridge's `session/rewind` /
`session/rewindCascade` ACP extensions and the `/rewind` slash command were
removed accordingly. `session/fork` (branch from checkpoint) remains the
bridge-side alternative.

### `session/goal`

Read / set / replace / clear the goal.

**Request:**

```json
{
  "id": 10,
  "method": "session/goal",
  "params": {
    "sessionId": "sess_abc123",
    "action": "set",
    "objective": "Refactor the auth module"
  }
}
```

`action` can be: `show`, `set`, `replace`, `clear`, `pause`, `resume`

### `session/compact`

Compact the conversation history.

**Request:**

```json
{
  "id": 11,
  "method": "session/compact",
  "params": {
    "sessionId": "sess_abc123"
  }
}
```

### `session/steer` — removed in 0.16+

`session/steer` existed up to app-server 0.15.x. The 0.16 app-server removed
it from its RPC dispatch (verified against 0.16.3: `-32601 Method not found`);
steering moved to the v4 command/conversation API. The bridge's
`session/steer` ACP extension and the `/steer` slash command were removed
accordingly. Queued inputs still surface as `turn.steerQueued` /
`turn.steerDrained` events (see above).

### `session/setMode`

Switch the session mode.

**Request:**

```json
{
  "id": 13,
  "method": "session/setMode",
  "params": {
    "sessionId": "sess_abc123",
    "mode": "build"
  }
}
```

### `session/setThoughtLevel`

Set the thought level.

**Request:**

```json
{
  "id": 14,
  "method": "session/setThoughtLevel",
  "params": {
    "sessionId": "sess_abc123",
    "thoughtLevel": "max"
  }
}
```

## Background Tasks & Sub-Agents

When the model dispatches a sub-agent via the `Agent` (or `Task`) tool, the
backend keeps producing events on the **same session stream** — both while the
sub-agent runs and after the main turn ends. The bridge forwards a curated
subset to the ACP client:

### Synchronous sub-agent (blocking)

The `Agent` tool blocks until the sub-agent finishes. Its internal tool calls
(`Read`, `Bash`, …) arrive as ordinary `tool.updated` events on the main stream
and are forwarded as regular `tool_call` cards. The `Agent` card itself carries
structured metadata in `_meta.subagent` (parsed from the result content):

```json
{
  "sessionUpdate": "tool_call_update",
  "toolCallId": "call_xxx",
  "status": "completed",
  "_meta": {
    "claudeCode": { "toolName": "Agent" },
    "subagent": {
      "agentId": "agent_73c7c63d-...",
      "tokens": 40904,
      "toolUses": 1,
      "durationMs": 10559
    }
  }
}
```

### Background sub-agent (`run_in_background: true`)

The `Agent` tool returns immediately with a launch acknowledgement (result
content contains `agentId` + `output_file` + "working in the background"). The
main turn then completes, but the backend continues to push the task's
lifecycle on the same stream:

**1. Status changes** — `session.updated` carries a `taskId` and `status`:

```json
{
  "method": "session/event",
  "params": {
    "sessionId": "sess_abc123",
    "seq": 16,
    "type": "session.updated",
    "payload": {
      "taskId": "agent_88a44529-...",
      "toolCallId": "call_orig",
      "toolName": "Agent",
      "status": "running",
      "description": "Read README first heading",
      "outputPath": "/.../output.txt",
      "terminalId": "agent_88a44529-...",
      "startedAt": "2026-07-18T09:06:45.929Z"
    }
  }
}
```

The bridge's session-scoped `BackgroundTaskListener` turns these into a
dedicated ACP tool card (`[background] <description>`) plus status updates:

| Backend event                              | ACP notification                                               |
| ------------------------------------------ | -------------------------------------------------------------- |
| first `session.updated` (status `running`) | `tool_call` (new card, `kind:"other"`, `status:"in_progress"`) |
| `session.updated` (status `completed`)     | `tool_call_update` (`status:"completed"`)                      |

`session.updated` events WITHOUT a `taskId` (e.g. usage updates) are ignored by
the background listener — they remain owned by the turn loop.

**2. Completion notification turn** — when the background task finishes, the
backend auto-triggers a new turn whose `turn.started` carries
`inputSource:"background_task"`:

```json
{
  "type": "turn.started",
  "payload": {
    "inputSource": "background_task",
    "inputVisibility": "model-only",
    "input": "<task-notification>\n  <task-id>agent_...</task-id>\n  <status>completed</status-status>\n  ...\n</task-notification>",
    "turnId": "turn_95197b25-..."
  }
}
```

The background listener forwards that turn's `model.streaming text_delta` as
`agent_message_chunk` so the user sees the background result. The per-prompt
turn loop **defers** this entire turn (drops its events) to avoid double-
forwarding and to keep it from prematurely ending the user's real turn.

### Background Bash (`run_in_background: true`)

The `Bash` tool launched with `run_in_background: true` returns immediately
with a launch acknowledgement (result content: "Command running in background
with ID: exec_…"). Like the Agent sub-agent, the backend keeps pushing the
task's lifecycle on the same stream via `session.updated` events that carry
the originating `toolCallId`:

```json
{
  "type": "session.updated",
  "payload": {
    "taskId": "exec_ac3a5053-...",
    "toolCallId": "call_e282b4ec...",
    "toolName": "Bash",
    "status": "running",
    "pid": 22410,
    "outputPath": "/.../call_...-stdout.log",
    "outputTail": "done\n"
  }
}
```

**Card reuse, not duplication.** Unlike an Agent sub-agent (which mints a fresh
`bg_*` card), a background Bash task **reuses the launch card** — the very
terminal card the dispatcher created when `Bash` was scheduled. This keeps the
lifecycle on a single card instead of producing a duplicate `[background]` card
that the editor would show alongside the closed launch card.

The mechanism:

1. **Launch turn** — the dispatcher tags the `ToolCallNew`/`ToolCallUpdate`
   with `background: true` (threaded from the cached `input.run_in_background`
   flag) and, on the launch `result`, **skips `terminal_exit`** so the launch
   card stays `in_progress`. It seeds an empty marker in `terminalSentData`
   for the `toolCallId` — this is the signal the background listener uses to
   recognise "this is a tracked launch card".
2. **Lifecycle (`session.updated`)** — the `BackgroundTaskListener` resolves
   the `toolCallId`, sees it in `terminalSentData`, and routes status updates
   back to the launch card. On `status:"completed"`, it emits the final
   `outputTail` via `terminal_output` (iff launch text wasn't already streamed)
   and closes the terminal UI with `terminal_exit` (exit code 0, or 1 on
   `failed`), then clears the `terminalSentData` entry.
3. **Fallback** — if the `session.updated` lacks a `toolCallId`, or the
   `toolCallId` is unknown to `terminalSentData` (sub-agent case), the listener
   falls back to minting a fresh `bg_*` card — the Agent sub-agent path above.

| Backend event                                             | ACP notification (background Bash)                                                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| first `session.updated` (status `running`)                | `tool_call_update` on the launch card (`status:"in_progress"`)                                                             |
| `session.updated` (status `completed`, with `outputTail`) | `terminal_output` (final output, if not already streamed) + `tool_call_update` with `terminal_exit` (`status:"completed"`) |
| `session.updated` (status `failed`)                       | `tool_call_update` with `terminal_exit` (`status:"failed"`, exit_code 1)                                                   |

`session/cancelBackgroundTask` for a background Bash task additionally emits
`terminal_exit` with `_meta.backgroundTask.cancelled = true` so the terminal
UI closes on cancellation.

### `session/cancelBackgroundTask`

Cancels a background task. The bridge additionally marks the corresponding ACP
tool card as `failed` with `_meta.backgroundTask.cancelled = true`.

| ZCode CLI version | session/subscribe | Extension methods       | Notes                                                                                                                                                        |
| ----------------- | ----------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| >= 0.16.0         | Supported         | All except steer/rewind | `session/steer`, `session/rewind`, `session/rewindCascade` removed upstream (v4 API); bridge dropped its passthroughs and `/steer`, `/rewind` slash commands |
| >= 0.15.0         | Supported         | All supported           | Full functionality                                                                                                                                           |
| >= 0.14.8         | Supported         | Partially supported     | workspace/* unavailable                                                                                                                                      |
| 0.14.5 ~ 0.14.7   | Not supported     | Not supported           | Incompatible with this project                                                                                                                               |

## Additional backend methods (not wired into the bridge)

The backend exposes more RPC methods than the bridge uses (sub-agent listing,
event pull, session usage/close, automation, workspace config, MCP/plugins).
These have no ACP-side counterpart yet. See `BACKLOG.md` in the upstream zcode-acp documentation (not included in this repository) for
the full list and which are candidates for future support.

## Multi-client semantics (remote access)

When `ZCODE_ACP_REMOTE=1` is enabled, the bridge accepts additional ACP clients
over WebSocket (via the machine-level hub) alongside the stdio editor. All
clients share the same backend sessions; the rules below define how one agent
serves many clients.

| Aspect                                             | Behaviour                                                                                                                                                                                |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session/update` notifications                     | Broadcast to every connected client. A client that never saw a session (e.g. an editor receiving a phone-created session) simply ignores the update.                                     |
| `session/request_permission`, `elicitation/create` | Sent to every client; the **first response wins**. Losing requests are aborted, which emits `$/cancel_request` so the losing client dismisses its dialog and replies `RequestCancelled`. |
| Capabilities                                       | OR-merged across clients at each `initialize` (booleans union, `_meta` shallow-merged). A capability any client declares is enabled for interaction routing.                             |
| Concurrent `session/prompt` on one session         | Serialized by the per-session preempt lock — identical to the single-client case; a second client's prompt preempts or queues the same way.                                              |
| `session/cancel`                                   | Affects the shared turn regardless of which client sent it.                                                                                                                              |
| Process lifetime                                   | Follows the stdio client: when the editor disconnects, the bridge (and every remote attachment) exits. Remote clients never extend the lifetime.                                         |

Transport details (hub discovery API, token auth, tunnel notes) live in the “Remote Access” section of the upstream zcode-acp README, which is not included in this repository.
