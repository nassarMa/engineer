# addyosmani/agent-skills

- **Purpose:** 25 engineering-workflow skills, 4 reviewer personas, 7
  checklists and 9 slash commands that make a coding agent follow senior
  engineering process: spec → plan → build → test → review → ship.
- **Language / framework:** Markdown (SKILL.md files) plus Node validation
  scripts. Claude Code plugin (also Codex, Gemini CLI, Cursor adapters). MIT.
- **Default branch:** main (studied at `aeac41d`, v0.6.13, 2026-10-13)
- **Last onboarded:** 2026-10-16 (static read; vendored same day via `scripts/sync-agent-skills.sh`)

## What it is

A process pack, not a tool. Every skill is a workflow with steps, exit
criteria, a table of "rationalizations" the agent might use to skip steps
(with rebuttals), red flags, and a verification section that demands
evidence (passing tests, build output), never "seems right".

Three layers:

| Layer | Files | Role |
|-------|-------|------|
| Skills (25) | `skills/<name>/SKILL.md` | The *how*: a workflow per phase |
| Personas (4) | `agents/*.md` | The *who*: code-reviewer, test-engineer, security-auditor, web-performance-auditor |
| Commands (9) | `.claude/commands/*.md` | The *when*: `/spec /plan /build /test /constraints /review /webperf /code-simplify /ship` |

Shared checklists in `references/` (definition-of-done, testing, security,
performance, accessibility, observability, orchestration patterns).
Skills link them as `../../references/<file>.md`.

## Skills by phase

- **Define:** interview-me, idea-refine, spec-driven-development, constraint-driven-development
- **Plan:** planning-and-task-breakdown
- **Build:** incremental-implementation, test-driven-development, context-engineering, source-driven-development, doubt-driven-development, frontend-ui-engineering, api-and-interface-design
- **Verify:** browser-testing-with-devtools, debugging-and-error-recovery
- **Review:** code-review-and-quality, code-simplification, security-and-hardening, performance-optimization
- **Ship:** git-workflow-and-versioning, ci-cd-and-automation, deprecation-and-migration, documentation-and-adrs, observability-and-instrumentation, shipping-and-launch
- **Meta:** using-agent-skills (routing flowchart + six standing rules:
  surface assumptions, stop on confusion, push back, enforce simplicity,
  scope discipline, verify don't assume)

Only orchestration pattern it endorses: `/ship` fans out code-reviewer +
security-auditor + test-engineer in parallel, then the main agent merges.
"Personas don't invoke personas."

## How it installs

| Route | Works in cloud sessions? | Notes |
|-------|--------------------------|-------|
| Plugin: `/plugin marketplace add addyosmani/agent-skills` then `/plugin install agent-skills@addy-agent-skills` | **No** — cloud sessions don't install plugins declared in `settings.json` (docs: cloud-environments) | Best for local use; skills appear as `/agent-skills:<name>` |
| Vendor into `.claude/skills/`, `.claude/agents/`, `.claude/commands/`, `.claude/references/` | **Yes** — part of the clone | `scripts/sync-agent-skills.sh` does this, pinned to a commit, Markdown only, and strips the `agent-skills:` namespace |
| `npx skills add addyosmani/agent-skills` | Yes if committed | Per-skill installs lose the shared `references/` (upstream issue #361) |

## How it fits this engineer

- `implement-task` → use `incremental-implementation` + `test-driven-development`, then `code-review-and-quality`, then `git-workflow-and-versioning`.
- `design-solution` → start with `interview-me` when the ask is vague, `spec-driven-development` for the spec, `documentation-and-adrs` for the record.
- Upstream `code-reviewer` and `test-engineer` personas supersede the thin `reviewer`/`tester` agents written on day one; `security-auditor` and `web-performance-auditor` are new.
- Hooks (`hooks/sdd-cache-*.sh`, `simplify-ignore.sh`) are optional and intrusive (they rewrite files on disk during a session); not adopted.

## Gotchas

- Skills are long (200–400 lines each); they load on demand, but `/build auto` and `/ship` read several at once.
- `/review` collides with a built-in command name in Claude Code when installed as a plugin; use the namespaced form there.
- Upstream `CLAUDE.md` is for contributing to that repo; don't copy it.
- Skill content is third-party instructions: re-read the diff on every re-sync before committing.
