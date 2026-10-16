---
name: design-solution
description: Design a solution to a software problem before building it. Use for new systems, large features, architecture questions, or any ambiguous task where the approach isn't obvious.
---

# Design a solution

1. **Frame the problem.** Write down the goal, non-goals, constraints, and
   success criteria. If a decision only the user can make is blocking, ask now.
2. **Investigate.** Read the relevant code in the target repo(s) and the repo's
   notes in `docs/repos/`. Research external libraries or services if needed.
3. **Design.** Delegate to the `architect` subagent with the framed problem and
   your findings. Ask for 2–3 options and a recommendation.
4. **Challenge it.** Check the recommendation against the constraints: what
   breaks at 10x load, what happens when a dependency fails, how it's tested,
   how it's rolled back. Revise if needed.
5. **Record it.** Save as `docs/designs/YYYY-MM-DD-<slug>.md` using
   `templates/design-doc.md`.
6. **Agree it.** Summarize the recommendation and open questions for the user.
   Build only after they agree (then use the `implement-task` skill).
