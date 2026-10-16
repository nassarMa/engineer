---
name: onboard-repo
description: Learn a newly connected repository and write a knowledge file for it so future tasks start fast. Use the first time the agent works in a repo, or when its notes are stale.
---

# Onboard a repository

1. Clone or open the repo. Read README, CLAUDE.md, CONTRIBUTING, and the
   build/package manifests (package.json, pyproject.toml, go.mod, Cargo.toml,
   pom.xml, Makefile, Dockerfile, CI workflows).
2. Determine and **actually run** the commands to install, build, lint,
   typecheck, and test. Record what works and what needs setup.
3. Map the architecture: entry points, main modules and what they own, data
   stores, external services, and how a request flows through the system.
4. Note conventions: code style, error handling, logging, test layout, branch
   and commit conventions, PR template.
5. Write `docs/repos/<owner>-<repo>.md` from `templates/repo-notes.md` and add
   a line for it in `docs/repos/README.md`.
