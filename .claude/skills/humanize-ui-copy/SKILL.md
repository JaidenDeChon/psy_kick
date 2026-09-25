---
name: humanize-ui-copy
description: Run the ui-copy-humanizer agent on a loop, one psy_kick source file at a time, so every label, button, hint, dialog, empty state and error message in the app is checked against the humanizer skill and rewritten to sound human, and to make sense to a first-time visitor who has never heard of remote viewing, without losing details or touching code. Use when asked to humanize psy_kick's copy, clean up AI-sounding UI text, make the app's wording clearer for new users, or run the humanizer loop. Optional args are a file path to do just that one, a number N to stop after N files, or a group name (`screens`, `explainers`, `messages`, `illustrations`, `docs`) to work only that group.
---

# Humanize psy_kick's UI copy on a loop

Drives `.claude/agents/ui-copy-humanizer.md` one file at a time. The agent takes the next file from `python3 scripts/humanize_copy.py next`, goes through its copy string by string with `.claude/skills/humanizer/SKILL.md`, verifies with `scripts/humanize_copy.py check` and `bunx nuxi typecheck`, records the file in `.claude/humanized.json`, and commits locally. This skill repeats that and pushes the results.

The queue walks five groups in order. `screens` covers the layout, the pages and the dialogs and widgets on them, in the order a visitor meets them: nav, choosing a protocol, the one-session-at-a-time warning, the breathing screen, capture, the sketch pad, ranking, reveal, result, history, stats, leaderboard, review_others, sign-in, settings and the email-link pages. `explainers` comes next: the home page, the SEO and share-card text in `app.vue`, the protocol steps and the stats and score explainers. They name controls from the screens, so the screens go first and the buttons already have their final names. `messages` holds the server routes whose error messages the pages show. `illustrations` holds the animated how_this_works slides, which copy the real labels and so go after everything they copy. `docs` holds Markdown, if any is ever added. A new file under `pages/`, `components/`, `layouts/`, `composables/` or `server/` joins the end of its group automatically, and a file with no user-facing text never enters the queue. Seed data, migrations, scripts and config are never queued (the agent explains why). After every file is done once, a file whose content changed since it was humanized comes back into the queue.

## Arguments

- **A file path:** run the agent once on that file, then stop.
- **A group name** (optionally followed by N): work only that group, with `python3 scripts/humanize_copy.py next --group NAME`.
- **A number N:** stop after N files.
- **No arguments:** keep going until the agent reports `ALL DONE`, or something blocks.

## Before the first iteration

Run `python3 scripts/humanize_copy.py status` (with `--group NAME` if one was given) and tell the user how many files are done and how many remain, per group. If `node_modules` is missing, run `bun install --frozen-lockfile` once so the agents can typecheck.

## Each iteration

1. Dispatch the `ui-copy-humanizer` agent in the foreground, one at a time. Pass the file if one was given; otherwise give no target (and when working one group, tell it the group). Pass on every rename that earlier agents in this run reported, so this file uses the new names. Never let parallel runs pick their own "next" item: they would take the same one and collide on the ledger.
   - Server routes in the `messages` group may run in parallel batches if each agent is given an explicit, distinct file path and told not to record or commit, because their messages do not name controls. After the batch, for each file: run `check` and `bunx nuxi typecheck`, spot-check it (step 3), then `record` and commit it yourself, one commit per file. Screens, explainers and illustrations always run one at a time, because later files depend on the names they settle on.
2. Read its report:
   - **`ALL DONE`** → stop.
   - **A blocker** (uncommitted changes on the file, a check or typecheck it could not pass without changing meaning or code) → tell the user what's blocking and stop. Don't retry blindly.
3. Spot-check the commit. `git show --stat HEAD` must touch only that file and `.claude/humanized.json` (plus a test that asserts its wording, if a test suite exists by then). Then skim `git show HEAD -- "<file>"` for a changed number or threshold, a dropped hedge about remote viewing (*the idea is that*, *is considered*, *tend to*), a stored tag or route that was renamed, a message that now reveals whether an account exists, or a label that no longer matches its control. If you find one, fix it in a follow-up commit before moving on.
4. Push every 10 files, and at the end: `git push -u origin <current branch>`. If there's no open PR for the branch, open one. Never push to the default branch.
5. Give the user a one-line status per file: path, strings changed, main patterns removed. List any renamed control, and every other file the agent said still uses the old name; pass that rename to every later agent in the sweep. Collect the things the agents reported but must not fix (copy that contradicts the code, a statistics error, a missing aria label, a developer hint shown to users, a bad seed caption) and list them for the user at the end.

## Pacing

Each file is a small run, and the full queue is only about fifty files, so one session can usually finish a group. For an unattended sweep, prefer `/loop /humanize-ui-copy 10` or a scheduled Routine that invokes this skill with a number, so each firing does a batch in a fresh context.
