// This file is responsible for: the real-device delivery script (spends quota; run by Claude) —
// read the provider registry, write the personal provider file, spawn the app-server, create or
// resume, attach the session, deliver one message, wait for the turn to settle, print the result.
// Not responsible for: the gate's hard rules and model review (the manual y/n here is only a
// channel), batch tasks, persisting anything beyond pending.
// Usage:
//   node scripts/real-send.mjs --yes [--cwd <dir>] [--text "<message>"] [--resume <sess_>]
//        [--provider <providerId>] [--model <modelId>]
//        [--on-permission allow|deny] [--on-question "<text>"]
//        [--steer-after <seconds> [--steer-text "<interjection>"]] [--stop-after <seconds>]
// --steer-after: N seconds after delivery, interject mid-turn (v4/command sendText guide, T6-B
// checkpoint); --stop-after: N seconds after delivery, send session/stop so the core turn settles
// with resultType=cancelled (T6-A checkpoint).
// create carries model + top-level thoughtLevel by default (D14: since 3.12 create no longer
// accepts runtimeModel and we no longer push a registry — the app-server reads providers from the
// personal provider file itself): the provider is picked by D6 priority (an explicit --provider
// must hit), the model is that provider's first id containing flash/lite/mini/air, else the first
// one (an explicit --model must exist); --resume sends no model (verified). --provider/--model are
// validated before mkdtemp, the personal file, and spawn: a wrong value exits 2, leaving no temp
// dir and no child process.
// RULES §9: print the "this will spend quota" warning first; without --yes, exit code 2 and no
// spawning at all.
// Answering order for permission/question: use --on-permission / --on-question when given; else,
// with a tty on stdin, ask interactively (an empty answer means deny for permissions, throws for
// questions); with neither → keep pending.json, print {"outcome":"blocked",…}, exit code 5
// (T1.2b item 2).
// stdout is one JSON line per step, all through redactSecrets + scrubValues (no apiKey appears in
// any output); the personal provider file is disposed in a finally (RULES §6: the key lands only
// in that one temp file, deleted at teardown).
import { mkdtemp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { AppServerClient } from '../lib/appserver.mjs';
import { attachSession } from '../lib/session.mjs';
import { createPendingGate } from '../lib/pending.mjs';
import {
  EXECUTOR_PROVIDER_ID,
  buildModelSelection,
  pickProvider,
  readProviderRegistry,
  writePersonalProviderFile,
} from '../lib/providers.mjs';
import { ExecutorError } from '../lib/errors.mjs';
import { redactSecrets, scrubValues } from '../lib/scrub.mjs';

const EXIT_USAGE = 2;
const EXIT_BLOCKED = 5;
const VALUE_FLAGS = ['--cwd', '--text', '--resume', '--on-permission', '--on-question', '--provider', '--model', '--steer-after', '--steer-text', '--stop-after'];
// Keywords of the "fast" tier from SPEC's model tiers, case-insensitive; real-send picks its default model from these (task sheet T1.3)
const FAST_MODEL_WORDS = ['flash', 'lite', 'mini', 'air'];

// An explicit --provider must hit (an explicit choice must not silently fall back to the priority rules); without it, pick by D6 priority
function selectProvider(registry, wanted) {
  if (wanted === undefined) return pickProvider(registry);
  const hit = registry.providers.find((p) => p.providerId === wanted);
  if (!hit) {
    console.error(
      `real-send: registry 里没有 provider ${wanted}。现有的：${registry.providers.map((p) => p.providerId).join('、') || '（空）'}`,
    );
    process.exit(EXIT_USAGE);
  }
  return hit;
}

// Default model: the first id containing flash/lite/mini/air, else the first one (after registry filtering, models is never empty)
function defaultModelId(provider) {
  const hit = provider.models.find((m) => FAST_MODEL_WORDS.some((w) => m.modelId.toLowerCase().includes(w)));
  return hit?.modelId ?? provider.models[0]?.modelId;
}

function parseArgs(argv) {
  const args = { yes: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--yes') {
      args.yes = true;
      continue;
    }
    if (VALUE_FLAGS.includes(a)) {
      const value = argv[++i];
      if (value === undefined) {
        console.error(`real-send: ${a} 后缺一个值`);
        process.exit(EXIT_USAGE);
      }
      // --on-permission → onPermission (camelCase key)
      const key = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      args[key] = value;
      continue;
    }
    console.error(`real-send: 不认识的参数 ${a}`);
    process.exit(EXIT_USAGE);
  }
  // --resume locates the session by directory; without --cwd we would not know which workspace's session to attach
  if (args.resume && !args.cwd) {
    console.error('real-send: --resume 需要同时给 --cwd');
    process.exit(EXIT_USAGE);
  }
  if (args.onPermission !== undefined && !['allow', 'deny'].includes(args.onPermission)) {
    console.error('real-send: --on-permission 只能是 allow 或 deny');
    process.exit(EXIT_USAGE);
  }
  for (const key of ['steerAfter', 'stopAfter']) {
    if (args[key] === undefined) continue;
    const n = Number(args[key]);
    if (!Number.isFinite(n) || n < 0) {
      console.error(`real-send: --${key === 'steerAfter' ? 'steer-after' : 'stop-after'} 要非负秒数，收到：${args[key]}`);
      process.exit(EXIT_USAGE);
    }
    args[key] = n;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.yes) {
    // RULES §9: a script that spends money — without --yes, read no config, spawn nothing, refuse outright
    console.error('real-send: 这次会花额度（真实投递给 zcode，消耗编码计划）。确认要跑请加 --yes。');
    process.exit(EXIT_USAGE);
  }

  let secrets = []; // apiKey values from the registry: used to scrub stderr forwarding and output
  const emit = (obj) => console.log(scrubValues(JSON.stringify(redactSecrets(obj)), secrets));
  let client = null;
  let gate = null;
  let sessionId = null;
  let pendingPath = null;
  let exitCodeSet = false;
  let personalFile = null; // D14 personal provider file: disposed in the finally
  // When a permission/question cannot be answered, or answering fails, interrupt the send wait so main does one unified teardown (T1.2b item 1)
  let abortTrigger = null;
  const aborted = new Promise((resolve) => {
    abortTrigger = (kind, error) => resolve({ kind, error });
  });

  try {
    const registry = readProviderRegistry(process.env.ZCODE_CONFIG_PATH);
    secrets = registry.providers.map((p) => p.apiKey?.value).filter(Boolean);

    // Model selection (D14) is settled before any mkdtemp / spawn: a wrong --provider/--model
    // exits 2 — no temp dir left behind, no child process, no personal provider file written
    const provider = selectProvider(registry, args.provider);
    const thoughtLevel = 'high';
    const model = buildModelSelection(provider, args.model ?? defaultModelId(provider), thoughtLevel);

    let cwd = args.cwd;
    if (!cwd) {
      cwd = await mkdtemp(path.join(os.tmpdir(), 'zcode-real-send-'));
      try {
        execFileSync('git', ['init', '--quiet'], { cwd, stdio: 'ignore' });
      } catch (err) {
        console.error(`real-send: git init 失败（${err.message}），继续用普通目录`);
      }
    }
    cwd = path.resolve(cwd);
    const workspace = { workspacePath: cwd, workspaceKey: cwd };
    const eventsPath = path.join(cwd, '.zcode-executor-events.jsonl');
    pendingPath = path.join(cwd, '.zcode-executor-pending.json');

    // D14: the app-server no longer accepts a pushed registry; instead it gets a personal file
    // holding just this one provider. The apiKey leaves only through that one temp file and the
    // requestProviderRuntimeHeaders reply — never into stdout
    personalFile = writePersonalProviderFile(provider);
    const apiKey = provider.apiKey?.value;
    const providerAuth = (providerId) => {
      // Checkpoint 5 (2026-09-18): api-key providers never sent this reverse request; keep one stderr line so it gets noticed the day one does
      console.error(`real-send: [反向请求] requestProviderRuntimeHeaders providerId=${providerId ?? '(缺 providerId)'}`);
      return providerId === EXECUTOR_PROVIDER_ID ? apiKey : undefined;
    };
    client = await AppServerClient.spawn({ cwd, secrets, personalProviderFile: personalFile.path, providerAuth });
    emit({ step: 'spawn', ok: true, result: { pid: client.pid } });

    // Review T1.3b item 2: this must use the outer sessionId — an earlier inner let shadowed it, so the blocked line was always null
    sessionId = args.resume;
    if (sessionId) {
      emit({ step: 'resume', ok: true, result: { sessionId } });
    } else {
      const created = await client.request(
        'session/create',
        // D14: create carries model (no longer runtimeModel), plus the top-level thoughtLevel (required as reasoningLevel by the GLM-5.3 family)
        { workspace, mode: 'build', persistence: 'immediate', titleGenerationEnabled: false, thoughtLevel, model },
        { timeoutMs: 20_000 },
      );
      sessionId = created.session.sessionId;
      emit({ step: 'create', ok: true, result: { sessionId, model: created.settings?.model?.current } });
    }

    gate = createPendingGate({ pendingPath, onPending: (pending) => handlePending(pending) });
    const session = await attachSession({ client, sessionId, cwd, eventsPath, handlers: gate.handlers });
    emit({ step: 'attach', ok: true, result: { sessionId, eventsPath } });

    const text = args.text ?? '在当前目录新建 hello.txt，内容一行 hello，然后结束';
    // Timed actions for checkpoints: interjection (v4 sendText guide) and stop (session/stop request); failures only log one line, never interrupting the send
    const timers = [];
    if (args.steerAfter !== undefined) {
      timers.push(setTimeout(async () => {
        try {
          const ack = await session.steer(args.steerText ?? '补充：文件末尾再加一行 steered');
          emit({ step: 'steer', ok: true, ...ack });
        } catch (err) {
          emit({ step: 'steer', ok: false, error: scrubValues(String(err?.message ?? err), secrets), details: err?.details ?? null });
        }
      }, args.steerAfter * 1000));
    }
    if (args.stopAfter !== undefined) {
      timers.push(setTimeout(async () => {
        try {
          const result = await session.stop();
          emit({ step: 'stop', ok: true, result });
        } catch (err) {
          emit({ step: 'stop', ok: false, error: scrubValues(String(err?.message ?? err), secrets) });
        }
      }, args.stopAfter * 1000));
    }
    let settled;
    try {
      settled = await Promise.race([
        session.send(text).then((outcome) => ({ kind: 'outcome', outcome })),
        aborted.then(({ kind }) => ({ kind })),
      ]);
    } finally {
      for (const t of timers) clearTimeout(t);
    }

    if (settled.kind === 'blocked') {
      // A pending that cannot be answered: pending.json is kept as-is for a human; the process ends as blocked (child process shut down)
      emit({ outcome: 'blocked', pendingPath, sessionId });
      process.exitCode = EXIT_BLOCKED;
      exitCodeSet = true;
    } else {
      const outcome = settled.outcome;
      emit({ step: 'outcome', ok: true, sessionId, eventsPath, ...outcome });
      // RULES exit-code table: done 0; cannot start 1; timeout 3; failed 4; blocked 5
      process.exitCode = { done: 0, timeout: 3, failed: 4, cancelled: 4, exited: 1, blocked: EXIT_BLOCKED }[outcome.outcome] ?? 1;
      exitCodeSet = true;
      await session.close();
    }
  } catch (err) {
    // T1.2b item 6: an error message may carry secrets; run it through scrubValues
    console.error(`real-send: ${scrubValues(String(err?.message ?? err), secrets)}`);
    if (!exitCodeSet) process.exitCode = err?.exitCode ?? 1;
  } finally {
    // T1.2b item 3: the error path must tear down too — no orphan app-server; a close failure must not clobber an already-set exit code
    try {
      await client?.close({ timeoutMs: 5000 });
    } catch (err) {
      console.error(`real-send: 收场失败：${scrubValues(String(err?.message ?? err), secrets)}`);
    }
    // D14: the personal provider file is deleted once used, whether the above succeeded or failed
    personalFile?.dispose();
  }

  // ---------- pending answers ----------

  async function handlePending(pending) {
    try {
      if (pending.kind === 'permission') {
        // T1.2b item 6: input may echo sensitive content; scrub before printing
        const input = scrubValues(JSON.stringify(pending.input ?? {}), secrets);
        console.error(`real-send: [挂起·审批] ${pending.toolName} ${input} —— ${pending.reason ?? '无理由'}`);
        const response = await decidePermission();
        if (response === null) return; // already on the blocked path
        gate.answer(response);
        return;
      }
      console.error('real-send: [挂起·提问]');
      const values = await decideQuestionValues(pending);
      if (values === null) return;
      gate.answer({ values });
    } catch (err) {
      abortTrigger('error', err); // answering failed: interrupt the send, let main's catch print and tear down uniformly
    }
  }

  async function decidePermission() {
    if (args.onPermission !== undefined) {
      return { decision: args.onPermission }; // a pre-given answer wins (non-tty environments)
    }
    if (process.stdin.isTTY) {
      const line = (await ask('real-send: 允许这次操作？(y=允许 / n=拒绝) > ')).trim();
      if (!line) return { decision: 'deny' }; // an empty answer counts as deny
      return line.toLowerCase() === 'y' ? { decision: 'allow' } : { decision: 'deny' };
    }
    blockedExit(); // no flag and no tty: cannot answer; keep the pending for a human
    return null;
  }

  async function decideQuestionValues(pending) {
    if (args.onQuestion !== undefined) {
      // Pre-given answer: apply the same text to every question in order
      return (pending.questions ?? []).map(() => args.onQuestion);
    }
    if (process.stdin.isTTY) {
      const values = [];
      for (const q of pending.questions ?? []) {
        const choices = (q.options ?? []).map((o, i) => `${i + 1}=${o.label ?? o.value}`).join(' ');
        const hint = choices ? `（${choices}${q.multiSelect ? '，多选逗号分隔' : ''}）` : '（直接输文字）';
        const line = (await ask(`real-send: ${q.question}${hint} > `)).trim();
        if (!line) throw new ExecutorError(`提问「${q.question ?? ''}」答案为空，拒绝作答`);
        values.push(q.multiSelect && line.includes(',') ? line.split(',').map((x) => x.trim()) : line);
      }
      return values;
    }
    blockedExit();
    return null;
  }

  function blockedExit() {
    process.exitCode = EXIT_BLOCKED;
    exitCodeSet = true;
    emit({ outcome: 'blocked', pendingPath, sessionId });
    abortTrigger('blocked');
  }

  function ask(prompt) {
    return new Promise((resolve, reject) => {
      const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: true, prompt });
      rl.on('close', () => resolve('')); // EOF fallback: treated as an empty answer
      rl.on('error', reject);
      rl.question(prompt, (line) => {
        rl.close();
        resolve(line);
      });
    });
  }
}

await main();
