# Security review

Use this skill for authentication, authorization, sandbox, credential, browser target, or install/update changes.

## Workflow

1. List every trust boundary crossed by the change.
2. Identify who can supply each input and what validates it.
3. Check that repository text cannot grant permissions or change policy.
4. Check process execution uses argv arrays, explicit cwd, timeout and capture limits.
5. Check secrets cannot reach the database, logs, prompts or evidence artifacts.
6. Verify high-risk actions require a real approval bound to the exact action hash.
7. Add a negative test for each boundary you claim to protect.

## Constraints

- Do not expand scope without policy approval.
- Do not weaken a check to make a scenario pass.
- Report unverified claims as NOT_PROVEN.
