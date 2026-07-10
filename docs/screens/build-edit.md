# 화면 설계서 — 빌드 편집 (Build Edit)

## 화면 개요

기존 빌드의 스펙을 수정하는 화면입니다. [새 빌드 만들기](new-build.md) 마법사(`NewBuildPage`)를 재사용하되, 편집 컨텍스트에서 진입합니다.

## 라우트 및 진입·이탈

| 항목 | 내용 |
| :--- | :--- |
| 라우트 | `/builds/:buildId/edit` |
| 컴포넌트 | `src/pages/NewBuildPage.tsx` (편집 모드로 재사용) |
| 진입점 | [빌드 상세](build-detail.md)의 "편집" 카드 |
| 이탈점 | 저장/실행 후 [빌드 실행 추적](build-run.md) 또는 [빌드 상세](build-detail.md) |

## 주요 UI 구성요소

- [새 빌드 만들기](new-build.md)와 동일한 7단계 마법사 구성.
- 현재 편집 기능은 완전 구현 전 단계로, "편집 아직 지원되지 않음"을 알리는 점선(dashed) 카드가 표시됩니다.

## 상태 및 상호작용

- `/edit` 진입 시 편집 미지원 안내 카드를 노출합니다(향후 기존 스펙 로딩·수정 지원 예정).
- 마법사 구성·상호작용은 [새 빌드 만들기](new-build.md)와 동일합니다.

## 데이터 소스

- `buildId` 경로 파라미터. 기존 스펙 로딩 연동은 예정.

## 접근성

- 안내 카드는 명확한 텍스트로 현재 제약을 전달합니다.

## 스크린샷

=== "라이트 테마 (Light)"
    ![빌드 편집 - 라이트 테마](../assets/screenshots/build-edit-light.png)

=== "다크 테마 (Dark)"
    ![빌드 편집 - 다크 테마](../assets/screenshots/build-edit-dark.png)

## 관련 문서

- [새 빌드 만들기](new-build.md)
- [빌드 상세](build-detail.md)
