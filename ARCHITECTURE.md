# Architecture — KPubData Studio

## 1. Role

Studio is the presentation and workflow layer above `kpubdata-builder`.

```text
kpubdata-studio
  -> builder API/service
  -> kpubdata-builder
  -> kpubdata
```

## 2. Architectural Principle

Studio does not own build semantics.
It renders configuration, previews, statuses, and outputs.

## 3. Major Frontend Areas

- build dashboard
- source selection
- build spec editor
- preview panel
- validation panel
- run/build history
- artifact viewer
- publication form

## 4. Backend / Integration Surface

Studio needs a stable integration layer exposing:
- list datasets
- fetch source preview
- validate spec
- execute build
- fetch build status
- read manifest
- list artifacts
- publish build

## 5. State Ownership

### Studio owns
- unsaved form state
- local wizard state
- UI filters and selections

### Builder/backend owns
- build execution state
- manifest data
- artifact file state
- validation semantics
