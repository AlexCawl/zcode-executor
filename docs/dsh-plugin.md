# dsh-plugin/ — DSH-side plugin

English · [中文](dsh-plugin.zh-CN.md) · [Русский](dsh-plugin.ru.md)

The DSH (DeepSeek Harness) side connects this repository's CLI to DSH: dispatch instructions (SKILL.md + a system prompt announcement)
+ the official right-sidebar watch pane named “zcode 任务” (“zcode tasks”; refreshes about once a second, uses no quota, view-only).

**The plugin definition is at the repository root**: the `dsh` field in the root `package.json` + the root `cordis.patch.yml` (row id `zcode-executor`).
The npm package `zcode-executor` itself is the DSH plugin: install it by package name on the desktop app's plugin page, and the App registers the bundle automatically.
No `link:` and no manual profile configuration edits. The root `files` list includes `cordis.patch.yml` and
`dsh-plugin/lib` (build output) in the npm tarball; every peer dependency is optional, so a global CLI installation still has zero dependencies
(the host supplies the DSH-side runtime). `test/dsh-manifest.test.mjs` guards this definition against drift.

`dsh-plugin/` contains only **source and build output** (TypeScript + an independent pnpm package). It was merged on 2026-10-11 using `git subtree`
from a separate repository (Gitea `kyomio/dsh-zcode-executor`), preserving its complete history; the old repository is frozen.
Its **only coupling to the CLI** is the NDJSON line protocol of `zcode-executor watch --json`.

## Directory overview

| Path | Contents |
| --- | --- |
| `dsh-plugin/src/` | TypeScript source: index (cordis plugin entry), routes (NDJSON stream routes), watch-process, bridge (zen-remote plugin bridge), skill-link (`~/.dsh/skills` symlink), client/ (React pane) |
| `dsh-plugin/lib/` | Build output (tsc + inline bundling by `build-client.mjs`), **tracked in git** and published with the npm package |
| `dsh-plugin/skills/zcode-executor/` | A single SKILL.md **symlink** to the root `skills/zcode-executor/SKILL.md` (one source of truth; npm packaging skips symlinks, so skill-link falls back to the root skills/ at runtime, covering both layouts) |
| `dsh-plugin/test/` | 112 cases, all using stubs; no DSH sessions created and no tokens spent |
| `dsh-plugin/SPEC.md` / `README.md` | Full specification (including test decisions and boundaries) / installation and architecture |
| Root `cordis.patch.yml` | Bundle registration patch (**defined at the root, not in dsh-plugin/**) |

## Development and testing

```sh
cd dsh-plugin
pnpm install        # peer/dev dependencies
npm run build       # tsc with two tsconfig files + build-client.mjs; lib/ output is tracked
npm run verify      # type checking only
node --test test    # 112 cases (not included in root npm test: the plugin needs pnpm dependencies; root tests remain dependency-free)
```

Restart the DSH desktop app after changing plugin code for changes to take effect; `npm run preview` starts a local pane preview with mockup data.

## Releases

There is no separate version: the plugin follows the main package's `npm version` + tag → `publish.yml` npm publication, and its code ships in the tarball.
After changing the plugin, remember `npm run build` (lib is tracked); `test/dsh-manifest.test.mjs` checks that build outputs exist.

## Syncing upstream

The old repository is frozen. If plugin updates exist elsewhere, pull them in with subtree:

```sh
git subtree pull --prefix=dsh-plugin <旧仓库路径或 remote> main
```

`<旧仓库路径或 remote>` is the original placeholder for the old repository's path or remote.
