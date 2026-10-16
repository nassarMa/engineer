---
name: implement-task
description: Implement a feature, fix, or design plan end to end in a target repository — plan, build, test, review, and commit. Use for any change bigger than a one-line fix.
---

# Implement a task

1. **Locate.** Identify the target repo and branch. Read its notes in
   `docs/repos/` (run `onboard-repo` first if it has none) and its own
   CLAUDE.md/CONTRIBUTING if present.
2. **Plan.** Break the work into small steps, each independently verifiable.
   Track them with the task list.
3. **Reproduce (bugs only).** Follow `test-driven-development` (Prove-It):
   write a failing test that shows the bug before touching the fix.
4. **Build.** Follow `incremental-implementation` + `test-driven-development`:
   one thin slice at a time (directly or via the `implementer` subagent),
   red → green → refactor, then the repo's build, lint, typecheck, and tests.
   Commit each slice. When something breaks, `debugging-and-error-recovery`.
5. **Review.** Run the `code-reviewer` subagent (`code-review-and-quality`)
   on the full diff; add `security-auditor` when the change touches input
   handling, auth, data storage or external integrations. Fix every
   Critical and Required finding; re-run checks.
6. **Ship.** Follow `git-workflow-and-versioning`: atomic commits with a
   clear message, push to the feature branch, open a PR only if the user
   asked. Report what changed, how it was verified, and anything left open.
