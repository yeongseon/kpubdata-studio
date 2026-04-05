# PRD — KPubData Studio

## 1. Product Summary

KPubData Studio is a visual interface for creating and managing public-data build workflows powered by `kpubdata-builder`.

It helps users define sources, preview records, configure metadata, run builds, and review outputs without hand-editing every configuration file.

## 2. Problem

The builder pipeline is powerful but configuration-first.
Many users need a safer and more discoverable way to:
- choose sources
- inspect schemas
- configure exports
- validate before publishing
- review build history and outputs

## 3. Goals

### Primary goals
- Make build spec authoring visual and inspectable
- Expose builder validation and preview in UI
- Show outputs before publication
- Reduce YAML/TOML hand-editing burden

### Non-goals
- Replacing the builder execution engine
- Reimplementing provider adapters
- Acting as a notebook or BI tool
- Semantic analytics across all public datasets

## 4. Users

### 4.1 OSS maintainer
Wants a faster and safer way to author dataset build specs.

### 4.2 Data curator
Wants previews, validation feedback, and publishing flows in UI.

### 4.3 Developer
Wants to inspect generated artifacts and copy/export config.

## 5. Product Principles

- UI is a control surface, not the source of truth for build semantics
- Generated specs must remain portable
- Preview first
- Validation must be visible and understandable
- Outputs must be inspectable before publish
- Build history must be easy to review

## 6. Core User Flows

### Flow A — Create a new dataset build
1. Start new build
2. Select one or more sources
3. Configure source params
4. Preview rows/schema
5. Configure metadata and exports
6. Validate
7. Run build
8. Review outputs
9. Save/export spec

### Flow B — Edit existing build
1. Open existing spec
2. Modify source/export settings
3. Revalidate
4. Rerun preview
5. Build again

### Flow C — Publish artifact
1. Open successful build
2. Review generated outputs
3. Configure publication target
4. Confirm publish
5. View publish result

---

## 📚 관련 문서

### 이 저장소 내 문서
| 문서 | 설명 |
| :--- | :--- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 시스템 아키텍처 설계 |
| [ROADMAP.md](./ROADMAP.md) | 개발 로드맵 |

### KPubData Product Family
| 저장소 | 문서 | 설명 |
| :--- | :--- | :--- |
| [kpubdata](https://github.com/yeongseon/kpubdata) | [PRD.md](https://github.com/yeongseon/kpubdata/blob/main/PRD.md) | Core 제품 요구사항 |
| [kpubdata-builder](https://github.com/yeongseon/kpubdata-builder) | [PRD.md](https://github.com/yeongseon/kpubdata-builder/blob/master/PRD.md) | Builder 제품 요구사항 |

