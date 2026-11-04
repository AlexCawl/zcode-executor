# Start-plan sends (zcode-executor detailed reference)

SKILL.md's "Start-plan sends" section points here; below is the full detail — read it when this send mode comes up.

## Start-plan sends

Start Plan is another subscription tier in the ZCode App. `send <id> <body> --start-plan` routes **this turn's**
quota to the Start Plan; everything else is exactly a regular send: it starts immediately, does not monopolize the
session, and acceptance is unchanged. `--steer` cannot interject into a start-plan send (it is itself a fresh send).
(Unavailable since 2026-09-29 — Aliyun's human verification cannot run on headless hosts; restored on 2026-10-09
after the server dropped the verification.)

- The model table follows the App's builtin config (a rejection exits 2 and the error lists the table); if the
  session's model is not in it, `new` a session with a different `--tier`.
- Sends can mix within one session: some with `--start-plan`, some without, without interference; a failed one does
  not affect later regular sends either.
