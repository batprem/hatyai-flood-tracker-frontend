# Frontend Agent Guide

This directory is the Vite + React + TypeScript frontend for the Hat Yai flood warning project. It is a Git submodule of the parent repository at `hatyai-flood-warning`.

## Worktree First

Before editing any code in this submodule, the working sub-agent must run in an isolated git worktree. The parent project's `coordinator` agent handles this by spawning sub-agents with `isolation: "worktree"`, which the Claude Code harness translates into a temporary worktree of this submodule.

If you are an agent invoked here:

1. **Confirm you are inside an isolated worktree** before making any changes. If you were not spawned with worktree isolation and your task will modify files, stop and ask the coordinator to re-spawn you with `isolation: "worktree"`.
2. **Never run two write-mode agents on `frontend/` in parallel without separate worktrees** — they will fight over the same working tree and over `node_modules`/`dist`.
3. **Read-only investigations do not require a worktree.** Skip isolation for component review, type inspection, design audits, or documentation reading.
4. After finishing, report the worktree path and branch name back so the user can review the diff and decide whether to merge.

## Conventions

Follow the rules in the parent repository:

- `../.claude/rules/frontend.md` — strict TypeScript, React hooks, typed API contracts, MapLibre, Thai/English copy, four-level risk.
- `../.claude/rules/git.md` — submodule-aware Git workflow. Commit frontend changes from inside `frontend/`, never from the root.
- `../AGENT.md` — project context, risk levels, public-safety expectations.

Local tooling lives here:

- `package.json`, `bun.lock` — Bun is the package manager.
- `vite.config.ts`, `tsconfig*.json` — Vite + TypeScript configuration.
- `components.json` — shadcn/ui generator config.

Run commands from `frontend/` unless explicitly told otherwise.
