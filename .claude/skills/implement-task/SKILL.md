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
3. **Reproduce (bugs only).** Have the `tester` subagent write a failing test
   that shows the bug.
4. **Build.** For each step, implement (directly or via the `implementer`
   subagent), then run the repo's build, lint, typecheck, and tests.
5. **Review.** Run the `reviewer` subagent on the full diff. Fix every
   blocker and should-fix; re-run checks.
6. **Ship.** Commit with a clear message, push to the feature branch, and
   open a PR only if the user asked. Report what changed, how it was
   verified, and anything left open.
