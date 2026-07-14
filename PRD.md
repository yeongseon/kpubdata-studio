# PRD — KPubData Studio

## 1. Product Summary

KPubData Studio is a visual interface for creating and managing public-data build workflows powered by `kpubdata-builder`.

It helps users define sources, preview records, configure metadata, run builds, and review outputs without hand-editing every configuration file.

## 현재 구현 상태 (Current implementation status — v0.1.0)

> 이 절은 현재 실제로 구현된 범위를 명확히 구분한다.

- **구현된 UI 흐름**: PRD의 Core User Flows(A/B/C)에 대응하는 라우트/페이지가 존재한다 — `builds`, `builds/new`, `builds/:id`(상세/편집), `builds/:id/run`, `builds/:id/artifacts`, `builds/:id/publish`. 추가로 독립 실행형 `validate`, `preview`, `artifacts`, `settings` 페이지를 제공한다.
- **Builder API 연동은 기본적으로 MOCK 모드**다. 라이브 Builder 없이도 동작하도록 기본값이 mock이며(`shared/lib/builderApi.ts`, `demoDatasets.ts`), 실제 Builder 호출은 `VITE_USE_REAL_BUILDER=true` 환경 변수로만 활성화된다. 즉 현재 GitHub Pages 데모 등은 실제 백엔드가 아니라 demo 데이터로 동작한다.
- **경계 원칙 유지**: BuildSpec 검증·preview 계산·manifest 스키마·publish 실행 로직은 Builder가 소유하며 Studio는 이를 호출/표시만 한다.

> 실제 Builder API 통합의 완성도는 향후 작업이며, 세부 계획은 [ROADMAP.md](./ROADMAP.md)를 참조한다.

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

## 6. Frontend Tech Stack

- **Vite**: 개발 서버 및 프로덕션 빌드
- **React**: 화면 구성과 상태 기반 렌더링
- **React Router**: 클라이언트 사이드 라우팅
- **TypeScript**: Builder API 계약과 UI 상태 타입 안정성 확보
- **Tailwind CSS**: 빠른 화면 스타일링

## 7. Core User Flows

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

## 관련 문서

### 이 저장소 내 문서
| 문서 | 설명 |
| :--- | :--- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 시스템 아키텍처 설계 |
| [ROADMAP.md](./ROADMAP.md) | 개발 로드맵 |

### KPubData Product Family
| 저장소 | 문서 | 설명 |
| :--- | :--- | :--- |
| [kpubdata](https://github.com/yeongseon/kpubdata) | [PRD.md](https://github.com/yeongseon/kpubdata/blob/main/PRD.md) | Core 제품 요구사항 |
| [kpubdata-builder](https://github.com/yeongseon/kpubdata-builder) | [PRD.md](https://github.com/yeongseon/kpubdata-builder/blob/main/PRD.md) | Builder 제품 요구사항 |
