# 화면 설계서 — 빌드 결과물 (Build Artifacts)

## 화면 개요

빌드가 생성한 결과물을 확인하는 화면입니다. 매니페스트(Manifest) 요약, 생성 파일 목록, 원본 `manifest.json`을 제공하고 게시로 이동합니다.

## 라우트 및 진입·이탈

| 항목 | 내용 |
| :--- | :--- |
| 라우트 | `/builds/:buildId/artifacts` |
| 컴포넌트 | `src/pages/BuildArtifactsPage.tsx` |
| 진입점 | [빌드 상세](build-detail.md), [빌드 실행 추적](build-run.md) "결과물 보기" |
| 이탈점 | "게시하기" → [빌드 게시](build-publish.md) |

## 주요 UI 구성요소

| 구성요소 | 설명 |
| :--- | :--- |
| 매니페스트 요약 | `dl`: 레코드 수 · 출력 형식 · 소스 · 빌드 ID |
| 파일 테이블 | 열: 파일 · 형식 · 액션(다운로드 — 연동 예정) |
| manifest.json | 원본 매니페스트 `pre` 블록 |
| 게시 CTA | "게시하기" |

## 상태 및 상호작용

- **로딩**: `SkeletonTable` 표시.
- **오류**: `ErrorState` + 재시도 버튼.
- **로드 완료**: 요약·파일 목록·매니페스트 JSON 표시.
- 다운로드 액션은 현재 "연동 예정" 상태입니다.

## 데이터 소스

- `getBuildManifest(buildId)` (MOCK 모드에서는 목 매니페스트 반환). 실연동 `GET /artifacts/{run_id}`는 real-builder 모드에서만 호출됩니다.

## 접근성

- 표는 명확한 열 헤더를 가지며, 상태(로딩/오류/완료)를 텍스트로 안내합니다.

## 스크린샷

=== "라이트 테마 (Light)"
    ![빌드 결과물 - 라이트 테마](../assets/screenshots/build-artifacts-light.png)

=== "다크 테마 (Dark)"
    ![빌드 결과물 - 다크 테마](../assets/screenshots/build-artifacts-dark.png)

## 관련 문서

- [사용자 흐름](../USER_FLOWS.md)
- [빌드 게시](build-publish.md)
- [API 규약](../API_CONTRACT.md)
