# Browser QA

Use this skill when a mission requires observing a real user flow in a browser.

## Workflow

1. Confirm the target is loopback or explicitly authorized.
2. Prefer semantic locators: label, role and accessible name before CSS.
3. Cover invalid input, server error, timeout, double submit, unauthorized role, multiple tabs and keyboard-only use where they apply.
4. Record console entries, network status, a trace and screenshots.
5. Reproduce a suspected defect twice before calling it deterministic.
6. Convert the defect into a scenario that fails on the baseline and passes on the candidate.

## Constraints

- Only PitCrew-managed browser contexts and authorized targets.
- Never enter real credentials or personal data into a scenario.
- Do not treat a screenshot as proof of behavior without an assertion.
