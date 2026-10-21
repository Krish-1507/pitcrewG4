# API contract

Use this skill when a request adds or changes an HTTP route, event, schema, or serialized artifact.

## Workflow

1. Locate the schema that owns the contract. Schemas belong in the protocol package.
2. Classify the change as additive or breaking.
3. Validate untrusted input at the boundary and reject unknown fields.
4. Keep error codes stable and documented.
5. Add a test for the accepted shape and at least one rejected shape.
6. For breaking changes, state the migration or new version explicitly.

## Constraints

- Do not expose raw provider payloads or secret values in responses.
- Do not reuse an existing error code for a different condition.
- A route change must not bypass authorization or policy checks.
