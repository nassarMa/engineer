---
name: skill-retro
description: Learn from how the user works and improve this engineer's skills, agents and CLAUDE.md through reviewed changes. Use at the end of a session with corrections or friction, when the user says "retro", "learn from this", "remember to do it this way", or asks to improve the skills from what was observed. Never edits a skill silently.
---

# Skill retro: observe, then improve through review

Idea from Task Observer (rebelytics/one-skill-to-rule-them-all), rebuilt
small for this repo: observations are committed files, so they survive
cloud containers, and every change to a skill is a reviewed diff.

## Mode 1: observe (end of a session, or "retro")

1. Scan this session for signals worth keeping:
   - **correction**: the user said "no, do it this way" or redid your work.
   - **gap**: a step you had to work out that a skill should have told you.
   - **misfire**: a skill triggered when it shouldn't have, or gave wrong
     instructions (a stale command, a wrong flag).
   - **preference**: a stable choice ("use pnpm", "Arabic UI first").
   Skip one-offs that won't recur and anything already written down.
2. For each signal write `docs/skill-observations/YYYY-MM-DD-<slug>.md`:

   ```markdown
   ---
   skill: research            # or agent:<name>, CLAUDE.md, or new:<name>
   type: correction           # correction | gap | misfire | preference
   status: open               # open | applied | rejected
   date: YYYY-MM-DD
   ---
   **What happened:** one or two sentences, paraphrased.
   **Proposed change:** the exact rule or step to add, change or remove.
   ```

   Paraphrase. Never paste tool output, file contents, URLs with tokens,
   customer data or secrets into an observation.
3. Commit the observations with the session's other work and tell the user
   in one line what you logged.

## Mode 2: improve ("improve the skills", or 3+ open observations on one skill)

1. Group open observations by target. Read each target file in full first.
2. Work on a branch, never the default branch. Make the smallest edit that
   satisfies the observations; keep the skill's structure and voice.
3. Targets you must not edit in place, because a sync script overwrites
   them (listed in `.claude/agent-skills.manifest` and
   `.claude/official-plugin-skills.manifest`): add the proposal to
   `docs/skill-observations/upstream.md` instead, or put the local rule in
   CLAUDE.md or one of our own skills.
4. Set each applied observation's `status: applied` (or `rejected` with a
   reason), show the user the diff, and open a PR only when asked. Merging
   the PR is the review.
5. Before committing, check the observations for secrets:
   `grep -rEn '(sk-|ghp_|AKIA|xox[bp]-|-----BEGIN)' docs/skill-observations/`.
