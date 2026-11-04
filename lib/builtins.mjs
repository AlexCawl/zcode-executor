// 本文件负责：ZCode 内置 provider 文件（builtin provider config）的两件小事——定位（builtinPathFor）
// 与版本号（formatBuiltinRevision / builtinRevision，provider/updateAccountConfig 的 basedOnZCodeBuiltinRevision）。
// 账号型投递（start plan，decisions D19/D21）要拿它拼授权配置；原出处在闲时模块（D20），本 fork 移到这里共用。
// 不负责：授权配置与 send 参数的形状（协议层 lib/startplan-provider.mjs）、发请求（会话层）。
// 只依赖协议层 lib/appserver.mjs（定位规则与 AppServerClient.spawn 给子进程的一致）与 lib/errors.mjs。
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ExecutorError } from './errors.mjs';
import { builtinProviderConfigPath, findZcode } from './appserver.mjs';

/**
 * 内置 provider 文件的绝对路径，定位规则与 AppServerClient.spawn 给子进程的一致（lib/appserver.mjs）：
 * 环境变量 ZCODE_BUILTIN_PROVIDER_CONFIG_FILE 指了就用它，没指从 zcode.cjs 位置推。
 */
export function builtinPathFor(env = process.env) {
  const builtinFile = env.ZCODE_BUILTIN_PROVIDER_CONFIG_FILE || '';
  return builtinFile
    ? builtinProviderConfigPath(null, { builtinFile })
    : builtinProviderConfigPath(findZcode({ zcodeBin: env.ZCODE_BIN || '' }), { builtinFile: '' });
}

/**
 * 纯函数：内置文件 revision + 路径 → updateAccountConfig 的 basedOnZCodeBuiltinRevision。
 * verified.md「闲时任务探针」2026-09-27：CLI 算的是 sha256(path.resolve(内置文件路径))——哈希路径字符串，不是文件内容；
 * 不等就静默忽略整份账号配置。路径必须和 app-server 子进程读的那个一致（lib/appserver.mjs 的
 * builtinProviderConfigPath 返回绝对路径，子进程环境变量里的也是它）。
 */
export function formatBuiltinRevision(revision, builtinPath) {
  const hash = createHash('sha256').update(path.resolve(builtinPath)).digest('hex');
  return `zcode-builtin:${revision}:${hash}`;
}

/** 读内置文件的顶层 revision 拼成 basedOnZCodeBuiltinRevision。读不到、不是 JSON、没有 revision 抛 ExecutorError(2)。 */
export function builtinRevision(builtinPath) {
  let revision;
  try {
    revision = JSON.parse(readFileSync(builtinPath, 'utf8'))?.revision;
  } catch (err) {
    throw new ExecutorError(`内置 provider 文件读不了或不是合法 JSON：${builtinPath}：${err.message}。确认 ZCode App 安装完整`, 2);
  }
  if (revision == null) {
    throw new ExecutorError(`内置 provider 文件没有顶层 revision：${builtinPath}。App 的文件格式可能变了，跑 zcode-executor doctor 确认`, 2);
  }
  return formatBuiltinRevision(revision, builtinPath);
}
