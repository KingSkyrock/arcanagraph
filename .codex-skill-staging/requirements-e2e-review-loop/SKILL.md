---
name: requirements-e2e-review-loop
description: "Execute a full coding delivery loop with strict order: analyze requirements, trace relevant code flow end-to-end, plan implementation, implement changes, validate with project checks, and iterate with a reviewer agent until PASS. Use when users ask for end-to-end implementation with explicit analysis, planning, coding, and review closure."
---

# Requirements E2E Review Loop

## Overview

Deliver code changes with a repeatable, auditable process.
Follow the ordered steps below without skipping core gates.

## Workflow

### 1) Analyze requirements

Capture:
- Functional requirements.
- Non-functional constraints such as performance, architecture, security, and UX.
- Project guardrails from repo instructions.
- Completion criteria.

If requirements are ambiguous, state assumptions before implementation.

### 2) Analyze relevant flow end-to-end

Trace real execution paths before editing:
- Entry points such as UI events, routes, API handlers, jobs, and CLI entrypoints.
- Contract boundaries such as schemas, DTOs, shared types, and APIs.
- Business logic and domain rules.
- Persistence and external integrations.
- Side effects and state synchronization.

Anchor conclusions to specific files and call paths.

### 3) Plan implementation

Create a minimal ordered plan:
- Files or modules to change.
- Why each change is required.
- Validation scope, including targeted checks and required repo checks.
- Risk notes for potential regressions.

Prefer the smallest change that resolves the root issue.

### 4) Implement

Apply focused edits only in relevant files.
Preserve SSOT and existing contracts.
Avoid unrelated refactors unless they are required for correctness.

Enforce these principles in all code changes:
- SSOT: Keep a single source of truth and avoid duplicated definitions or state.
- DRY: Avoid repetition; extract only when repetition is proven.
- SOLID: Preserve clear responsibilities and stable interfaces.
- KISS: Prefer the most straightforward solution.
- YAGNI: Do not build what is not needed yet.
- Immutable and functional: Prefer immutable data and pure functions where the language supports them.
- Memory safe and efficient: Avoid leaks, unbounded allocations, and delayed cleanup.
- Thread safe: Avoid shared mutable state without synchronization; prefer immutable sharing or message-passing.

### 5) Validate

Run targeted checks first, then project-required checks from repo guidance such as lint, format, type-check, tests, and contract checks.
If any required check cannot run, record the exact blocker.

### 6) Reviewer-agent loop until PASS

After meaningful changes, run a reviewer agent with this prompt:

```text
Review the recent changes for bugs, regressions, contract mismatches, and missing tests.
Prioritize correctness and edge cases.
Return findings ordered by severity with exact file/line references.
If no actionable issues remain, respond with PASS.
```

Use this iteration contract:
1. Run reviewer.
2. Fix actionable findings.
3. Re-run relevant validations.
4. Re-run reviewer.
5. Stop only when reviewer returns PASS or an explicit external blocker exists.

### 7) Handoff

Report:
- Requirement summary.
- End-to-end flow summary.
- Plan and implemented changes.
- Validation commands and outcomes.
- Reviewer final status.
- Residual risks or deferred items.

## Resources

No extra resources are required for this skill.
