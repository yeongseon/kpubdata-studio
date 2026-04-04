# ADR 0001 — Studio as Control Surface

## Decision
Treat Studio as a control surface for authoring and executing builder workflows, not as the execution engine.

## Rationale
This keeps build semantics centralized in `kpubdata-builder` and prevents duplicated logic.
