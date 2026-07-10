# 화면 설계서 — 빌드 게시 (Build Publish)

## 화면 개요

완성된 빌드 결과물을 배포 대상(로컬/HuggingFace/GitHub)으로 게시하는 최종 화면입니다. 게시 전 검토 정보를 확인하고 대상을 선택해 게시를 실행합니다.

## 라우트 및 진입·이탈

| 항목 | 내용 |
| :--- | :--- |
| 라우트 | `/builds/:buildId/publish` |
| 컴포넌트 | `src/pages/BuildPublishPage.tsx` |
| 진입점 | [빌드 상세](build-detail.md), [빌드 결과물](build-artifacts.md) "게시하기" |
| 이탈점 | 게시 완료 후 상세/결과물 화면 |

## 주요 UI 구성요소

| 구성요소 | 설명 |
| :--- | :--- |
| 검토 정보 | `dl` 형태의 게시 대상 요약 |
| 배포 대상 선택 | `radio`: local / huggingface / github |
| 게시 버튼 | `usePublishJob` 기반 게시 실행(MOCK) |

## 상태 및 상호작용

- **초기**: 배포 대상 선택 및 검토 정보 표시.
- **게시 중/완료(published)**: 성공 상태 안내.
- **실패(failed) / 취소(cancelled)**: 오류·취소 상태 안내.
- 게시는 `usePublishJob` 훅으로 처리되며 현재 MOCK 응답입니다(실제 게시 연동은 계획 단계).

## 데이터 소스

- `buildId` 경로 파라미터, `usePublishJob`(MOCK). 실연동 `POST /builds/:id/publish`는 계획(planned) 상태입니다.

## 접근성

- 배포 대상은 라디오 그룹으로 키보드 선택이 가능합니다.
- 게시 결과 상태를 텍스트로 명확히 안내합니다.

## 스크린샷

=== "라이트 테마 (Light)"
    ![빌드 게시 - 라이트 테마](../assets/screenshots/build-publish-light.png)

=== "다크 테마 (Dark)"
    ![빌드 게시 - 다크 테마](../assets/screenshots/build-publish-dark.png)

## 관련 문서

- [사용자 흐름](../USER_FLOWS.md) — 출판 및 공유 검토
- [상태 모델](../STATE_MODEL.md) — Build Run → Published
