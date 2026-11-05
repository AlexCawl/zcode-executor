// This file is responsible for: the zero-token probe (AGENTS.md hard constraint: exercise the
// zero-token path first) — walking the 3.12.2 flow (decisions D14): readProviderRegistry →
// pickProvider → writePersonalProviderFile → spawn (personalProviderFile, providerAuth, secrets) →
// confirm the two removed methods/fields still error (workspace/updateProviderRegistry → -32601,
// create with runtimeModel → -32602) → create with the new shape (model + top-level thoughtLevel +
// a toolDenylist probe) → session/subscribe → session/list → session/resume → session/close →
// teardown, emitting one JSON line per step to stdout to accumulate real-device facts for
// docs/verified.md.
// Not responsible for: sending session/send (never sent — the probe spends no tokens), session
// orchestration (a layer above).
// Usage: node scripts/probe.mjs. A single step failing does not abort: steps that can continue do;
// the global fallback is the catch around main().
// All stdout passes redactSecrets then scrubValues (apiKeys scrubbed by value); the personal
// provider file is disposed in a finally (RULES §6: the key lands only in that one temp file,
// deleted at teardown).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { AppServerClient } from '../lib/appserver.mjs';
import { ExecutorError } from '../lib/errors.mjs';
import {
  EXECUTOR_PROVIDER_ID,
  buildModelSelection,
  pickProvider,
  readProviderRegistry,
  writePersonalProviderFile,
} from '../lib/providers.mjs';
import { redactSecrets, scrubValues } from '../lib/scrub.mjs';

// apiKey values from the registry, filled in after reading it; each output line is serialized, scrubbed by value first, then by key name
let outSecrets = [];
const emit = (obj) => console.log(scrubValues(JSON.stringify(redactSecrets(obj)), outSecrets));
const okStep = (step, extra) => emit({ step, ok: true, ...extra });
const failStep = (step, err) => emit({ step, ok: false, error: errorOf(err) });

function errorOf(err) {
  if (err instanceof ExecutorError) return { message: err.message, ...err.details };
  return { message: String(err?.message ?? err) };
}

/**
 * Expect this request to be rejected — a method/field deleted in 3.12 must fail with expectedCode.
 * Any other error code, or an unexpected success, is ok:false (the protocol may have changed
 * again, worth watching); the expected code emits ok:true, meaning "confirmed gone".
 */
async function expectGone(step, request, expectedCode) {
  try {
    const result = await request();
    emit({ step, ok: false, note: '预期报错却成功了，协议可能又变了', result });
  } catch (err) {
    const code = err instanceof ExecutorError ? err.details?.code : undefined;
    emit({ step, ok: code === expectedCode, expectedCode, actualCode: code, message: err.message });
  }
}

/** The protocol docs do not pin down the session-list shape; defensively extract every sessionId. */
function extractSessionIds(result) {
  const list = Array.isArray(result) ? result : result?.sessions ?? result?.items;
  if (!Array.isArray(list)) return [];
  return list.map((s) => (typeof s === 'string' ? s : s?.sessionId)).filter(Boolean);
}

async function main() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'zcode-probe-'));
  try {
    // A git repo as the workspace is closer to reality; a failed init only warns and does not block the probe
    try {
      execFileSync('git', ['init', '--quiet'], { cwd: dir, stdio: 'ignore' });
    } catch (err) {
      console.error(`probe: git init 失败（${err.message}），继续用普通目录`);
    }
    await runProbe(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function runProbe(dir) {
  // Read registry → pickProvider: on failure there is no way forward to the personal file and spawn, so report and stop
  let provider;
  try {
    const registry = readProviderRegistry();
    outSecrets = registry.providers.map((p) => p.apiKey?.value).filter(Boolean);
    provider = pickProvider(registry);
    okStep('pickProvider', { providerId: provider.providerId, models: provider.models.map((m) => m.modelId) });
  } catch (err) {
    failStep('pickProvider', err);
    process.exitCode = err.exitCode ?? 1;
    return;
  }

  // Personal provider file (D14): its apiKey is the same value as the registry's; adding it twice is harmless (outSecrets is deduped)
  let personalFile;
  try {
    personalFile = writePersonalProviderFile(provider);
    outSecrets = [...new Set([...outSecrets, provider.apiKey?.value].filter(Boolean))];
    okStep('writePersonalProviderFile', { path: personalFile.path });
  } catch (err) {
    failStep('writePersonalProviderFile', err);
    process.exitCode = err.exitCode ?? 1;
    return;
  }

  try {
    await runWithClient(dir, provider, personalFile);
  } finally {
    personalFile.dispose();
    const existsAfter = existsSync(personalFile.path); // should be false: confirms the key file really got deleted
    emit({ step: 'dispose', ok: !existsAfter, existsAfter });
  }
}

async function runWithClient(dir, provider, personalFile) {
  let client;
  try {
    client = await AppServerClient.spawn({
      cwd: dir,
      secrets: outSecrets,
      personalProviderFile: personalFile.path,
      providerAuth: (providerId) => (providerId === EXECUTOR_PROVIDER_ID ? provider.apiKey?.value : undefined),
    });
  } catch (err) {
    failStep('spawn', err);
    process.exitCode = err.exitCode ?? 1;
    return;
  }
  okStep('spawn', { result: { pid: client.pid } });

  const workspace = { workspacePath: dir, workspaceKey: dir };

  // Two methods/fields deleted in 3.12: confirm they are gone (verified.md, "3.12.2 direct-connect probe" table rows 2–3; decisions D10, D11)
  await expectGone(
    'updateProviderRegistry-gone',
    () =>
      client.request(
        'workspace/updateProviderRegistry',
        { workspace, registry: { providers: [], generatedAt: 1, revision: 'x' } },
        { timeoutMs: 20_000 },
      ),
    -32601,
  );
  await expectGone(
    'create-runtimeModel-gone',
    () =>
      client.request(
        'session/create',
        {
          workspace,
          mode: 'build',
          persistence: 'deferred',
          titleGenerationEnabled: false,
          runtimeModel: { model: { providerId: provider.providerId, modelId: provider.models[0]?.modelId } },
        },
        { timeoutMs: 20_000 },
      ),
    -32602,
  );

  // create with the new shape: model + top-level thoughtLevel + a toolDenylist probe (docs/reference/zcode-app-server-protocol.md, "3.12.2 changes")
  const modelId = provider.models[0]?.modelId;
  const model = buildModelSelection(provider, modelId, 'high');
  const createParams = {
    workspace,
    mode: 'build',
    persistence: 'immediate',
    titleGenerationEnabled: false,
    thoughtLevel: 'high',
    model,
    toolDenylist: ['WebSearch'],
  };
  let created = null;
  try {
    created = await client.request('session/create', createParams, { timeoutMs: 20_000 });
    okStep('create', { result: created });
  } catch (err) {
    failStep('create', err);
    // toolDenylist may be rejected; drop it and create once more to see the result
    const { toolDenylist: _dropped, ...withoutDenylist } = createParams;
    try {
      created = await client.request('session/create', withoutDenylist, { timeoutMs: 20_000 });
      okStep('create-retry-without-denylist', { result: created });
    } catch (err2) {
      failStep('create-retry-without-denylist', err2);
    }
  }

  const sessionId = created?.session?.sessionId;

  if (sessionId !== undefined) {
    try {
      const result = await client.request(
        'session/subscribe',
        { sessionId, deliveryKind: 'desktop-continuous', includeSnapshot: false, afterSeq: 0 },
        { timeoutMs: 20_000 },
      );
      okStep('subscribe', { result });
    } catch (err) {
      failStep('subscribe', err);
    }
  } else {
    console.error('probe: 没拿到 sessionId，跳过 session/subscribe');
  }

  try {
    const result = await client.request('session/list', { workspace }, { timeoutMs: 20_000 });
    const ids = extractSessionIds(result);
    okStep('list', { result: ids });
    emit({ step: 'list-contains-created', ok: sessionId !== undefined && ids.includes(sessionId) });
  } catch (err) {
    failStep('list', err);
    emit({ step: 'list-contains-created', ok: false });
  }

  if (sessionId !== undefined) {
    try {
      const result = await client.request('session/resume', { sessionId, workspace }, { timeoutMs: 20_000 });
      okStep('resume', { result });
    } catch (err) {
      failStep('resume', err);
    }
  } else {
    console.error('probe: 没拿到 sessionId，跳过 session/resume');
  }

  if (sessionId !== undefined) {
    try {
      const result = await client.request('session/close', { sessionId }, { timeoutMs: 20_000 });
      okStep('close', { result });
    } catch (err) {
      failStep('close', err);
    }
  } else {
    console.error('probe: 没拿到 sessionId，跳过 session/close');
  }

  const exitInfo = await client.close();
  emit({ step: 'exit', code: exitInfo.code, signal: exitInfo.signal });
  process.exitCode = exitInfo.code ?? 1;
}

try {
  await main();
} catch (err) {
  // Fallback: any error not caught earlier goes to stderr; the exit code follows the ExecutorError table
  console.error(`probe: ${err?.message ?? err}`);
  process.exitCode = err?.exitCode ?? 1;
}
