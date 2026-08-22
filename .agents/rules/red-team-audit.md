# Rule: Mandatory Red-Team Logic Audit
- Scope: Always Active for all logic, state, algorithmic, and backend modifications.
- Execution Protocol:
  1. Draft Plan: Summarize the intended logic and identify affected files/functions.
  2. Red-Team Critique: Explicitly list at least 3 concrete failure points (e.g., race conditions, unhandled edge cases, timer/listener leaks, or unintended state mutations).
  3. Defensive Patch: Only write and apply code diffs after adjusting the implementation to defend against all identified failure points.
- Output Standard: Never skip Phase 2. The critique must be printed prior to making any file edits.
