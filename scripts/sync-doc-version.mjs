// This file is responsible for: syncing the package.json version everywhere a version appears —
// the version badges in the three READMEs and the version field of every host manifest
// (.claude-plugin, .codex-plugin, .github/plugin, .grok-plugin, .antigravity-plugin plugin.json,
// gemini-extension.json, plugin.yaml).
// Hooked into npm's version lifecycle script: runs after `npm version patch` rewrites package.json
// and before the commit is created, so the synced files ride along in the same release commit.
// `--check` only reports drift without writing; npm test runs it so CI catches a missed sync.
// Every marker is required: a missing marker exits non-zero instead of passing silently — a silent
// no-op is exactly what this script exists to prevent.
// Not responsible for: changing the version itself (that is npm version's job), tagging, publishing.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const checkOnly = process.argv.includes('--check');

const targets = [
  ...['README.md', 'README.zh-CN.md', 'README.ru.md'].flatMap((file) => [
    { file, label: '版本徽章', pattern: /badge\/version-v\d+\.\d+\.\d+[^"'\s]*-/, replace: `badge/version-v${version}-` },
    { file, label: '徽章 alt', pattern: /alt="v\d+\.\d+\.\d+[^"]*"/, replace: `alt="v${version}"` },
  ]),
  ...['.claude-plugin/plugin.json', '.codex-plugin/plugin.json', '.github/plugin/plugin.json', '.grok-plugin/plugin.json', '.antigravity-plugin/plugin.json', 'gemini-extension.json'].map((file) => ({
    file, label: 'version 字段', pattern: /"version": "[^"]+"/, replace: `"version": "${version}"`,
  })),
  { file: 'plugin.yaml', label: 'version 字段', pattern: /^version: .+$/m, replace: `version: ${version}` },
];

const edits = new Map();
const missing = [];
const drifted = [];
for (const t of targets) {
  const before = edits.get(t.file) ?? readFileSync(join(root, t.file), 'utf8');
  if (!t.pattern.test(before)) { missing.push(`${t.file}: ${t.label} (${t.pattern})`); continue; }
  const after = before.replace(t.pattern, t.replace);
  if (after !== before) drifted.push(`${t.file}: ${t.label} -> ${t.replace}`);
  edits.set(t.file, after);
}

if (missing.length) {
  console.error(`sync-doc-version: 找不到标记，文档挪了位置就要改这个脚本：\n  ${missing.join('\n  ')}`);
  process.exit(1);
}
if (checkOnly) {
  if (!drifted.length) { console.log(`sync-doc-version: 文档已是 ${version}`); process.exit(0); }
  console.error(`sync-doc-version: 文档版本号落后于 package.json（${version}）：\n  ${drifted.join('\n  ')}`);
  process.exit(1);
}
for (const [file, content] of edits) writeFileSync(join(root, file), content);
console.log(drifted.length ? `sync-doc-version: 已同步到 ${version}\n  ${drifted.join('\n  ')}` : `sync-doc-version: 文档已是 ${version}`);
