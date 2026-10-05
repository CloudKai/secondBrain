# [Folder name]

Optional. Copy next to a folder whose invariants are easy to violate
(auth clients, embeddings, a scrape pipeline). Write as a delta on root `AGENTS.md`.

Governed by [ADR / `context/architecture.md` §].

## The gotcha

State the failure, not just a preference.

- **Wrong:** what training data will suggest
- **Right:** what this codebase needs
- **If you skip this:** compile error / silent bypass / empty result

## Clients / entry points

Do not mix these up.

| File | Role | Allowed on user data? |
| --- | --- | --- |
|  |  |  |

## Import rule

Client components must not import this folder’s barrel if it re-exports server-only modules. Import the leaf instead.

## Related

- Root `AGENTS.md`
- [ADR or architecture section]
