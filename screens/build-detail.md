# 화면 설계서 — 빌드 상세 (Build Detail)

## 화면 개요

선택한 빌드의 요약을 보여주고, 편집·실행·결과물·게시 등 하위 작업으로 이동하는 허브 화면입니다.

## 라우트 및 진입·이탈

| 항목 | 내용 |
| :--- | :--- |
| 라우트 | `/builds/:buildId` |
| 컴포넌트 | `src/pages/BuildDetailPage.tsx` |
| 진입점 | [빌드 목록](builds.md) 행 액션, [대시보드](dashboard.md) 최근 빌드 "보기" |
| 이탈점 | [빌드 편집](build-edit.md) · [실행](build-run.md) · [결과물](build-artifacts.md) · [게시](build-publish.md) |

## 주요 UI 구성요소

| 구성요소 | 설명 |
| :--- | :--- |
| 상태 요약 | 현재 상태 자리표시(Skeleton) — 실연동은 #29에서 예정 |
| 하위 작업 카드(4) | 편집 · 실행 · 결과물 · 게시 진입 |
| 실행 CTA | "실행하기" 주요 액션 |

## 상태 및 상호작용

- 현재는 상태 영역이 Skeleton 자리표시로 표시되며, 실제 상태 연동은 향후(#29) 반영됩니다.
- 4개 하위 작업 카드로 각 작업 화면에 진입합니다.
- "실행하기" CTA로 실행 추적 화면으로 이동합니다.

## 데이터 소스

- `buildId` 경로 파라미터. 상세 데이터 연동은 예정(#29).

## 접근성

- 하위 작업 카드는 명확한 라벨과 키보드 포커스를 제공합니다.

## 스크린샷

=== "라이트 테마 (Light)"
    ![빌드 상세 - 라이트 테마](../assets/screenshots/build-detail-light.png)

=== "다크 테마 (Dark)"
    ![빌드 상세 - 다크 테마](../assets/screenshots/build-detail-dark.png)

## 관련 문서

- [사용자 흐름](../USER_FLOWS.md) — 기존 빌드 검토 및 재실행
