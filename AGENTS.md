# AGENTS.md — kpubdata-studio

## Mission

Implement KPubData Studio as the UI shell and workflow interface for `kpubdata-builder`.

## Ground Rules

- Studio must not reimplement builder logic
- Prefer explicit UI state transitions
- Keep generated specs portable
- Surface validation and manifests clearly
- Make preview a first-class feature

## Priorities

1. information architecture
2. build draft state
3. builder API integration layer
4. preview and validation views
5. artifact viewer
6. publish flow
