# T-XXX task title

> This file is the contract Claude (planning) hands to zcode (execution). zcode does what is written here;
> Claude checks against the acceptance criteria below. Whatever is written unclearly, zcode improvises —
> and that is the root cause of rework.
>
> Always include this file's path when sending:
> `zcode-executor send <id> "Execute tasks/T-XXX.md" --task "$WT/tasks/T-XXX.md" --wait` (`--task` takes an absolute path: it resolves against Claude's current directory, and the task file lives in the worktree `$WT`)
> Pending answers treat this file as your authorization: operations not written into the acceptance criteria do not get allowed.

## What to do

State the goal in one sentence. Not "improve X a bit", but "change X from state A to state B".

## Background (already established by Claude — do not re-explore)

- Relevant files: `path/to/a.mjs:120` (responsible for …), `path/to/b.mjs` (…)
- Known constraints: …
- Already ruled out: … (state why, so it does not try that road again)

## Files to change

- [ ] `path/to/a.mjs` — what to change
- [ ] `path/to/a.test.mjs` — which tests to add

## Acceptance criteria (must be machine-checkable)

- [ ] `<test command>` fully green (e.g. `npm test`)
- [ ] New tests cover … (name the cases)
- [ ] `<build or check command>` reports no errors (e.g. `node --check`)
- [ ] `git diff` touches only the files listed above

## Off-limits

- Do not change `…` (reason)
- Do not introduce new dependencies
- Do not run git commands: no commit, no rebase, no amend. Leave changes in the working tree; Claude commits after acceptance

## When done

Leave the changes uncommitted in the working tree; say briefly which files changed and whether you deviated from
this file. No long report — Claude accepts by reading the diff and running the tests.
