# 화면 설계서 — 새 빌드 만들기 (New Build)

## 화면 개요

단계별 마법사(Wizard)로 빌드 스펙을 작성하는 핵심 화면입니다. 템플릿에서 출발해 데이터 소스·파라미터·출력 형식을 정하고, 미리보기와 검증을 거쳐 빌드를 실행합니다. 우측에는 실시간으로 생성되는 스펙 JSON이 표시됩니다.

## 라우트 및 진입·이탈

| 항목 | 내용 |
| :--- | :--- |
| 라우트 | `/builds/new` (편집: `/builds/:buildId/edit` — [빌드 편집](build-edit.md) 참고) |
| 컴포넌트 | `src/pages/NewBuildPage.tsx` |
| 진입점 | 사이드바 "새 빌드", 대시보드/빌드 목록의 새 빌드 버튼 |
| 이탈점 | 실행 → [빌드 실행 추적](build-run.md), 취소 → [빌드 목록](builds.md) |

## 7단계 마법사(Stepper)

1. **템플릿** — 빈 빌드, 대기오염정보(datago), 기준금리추이(bok), 인구통계(kosis)
2. **기본 정보** — 제목·설명 등 메타데이터
3. **데이터 소스** — Provider 선택(`bok`, `datago`, `kosis`, `krx`, `law`, `localdata`, `lofin`, `semas`, `seoul`, `sgis`)
4. **파라미터** — 날짜·지역 등 검색 조건
5. **미리보기** — `previewBuild`로 샘플 데이터 표 확인
6. **출력 형식** — Markdown / JSONL / Parquet 등
7. **검증·실행** — `validateSpec`로 검증 후 `useBuildJob`로 실행

## 주요 UI 구성요소

| 구성요소 | 설명 |
| :--- | :--- |
| Stepper | 7단계 진행 표시 및 이동 |
| 입력 폼 | 단계별 필드(템플릿/기본정보/소스/파라미터/출력) |
| 미리보기 영역 | `previewBuild` 결과 표 |
| 우측 aside | "생성될 스펙" JSON(접이식 `details`) |
| 상태 배지 | `draftStatus`(new / dirty / validated) 표시 |

## 상태 및 상호작용

- **초안 저장/복원**: 작성 내용을 `localStorage`에 자동 저장하고 재진입 시 복원(#10).
- **미리보기**: `previewBuild` 호출로 샘플 데이터를 표로 확인.
- **검증**: `validateSpec` 호출 결과에 따라 실행 활성화/오류 안내.
- **실행**: `useBuildJob`로 빌드 시작(MOCK 모드에서는 동기 목 응답).

## 데이터 소스

- `previewBuild`, `validateSpec`, `useBuildJob` (MOCK 모드에서는 목 응답).
- 초안 상태는 `localStorage`.

## 접근성

- 각 단계는 Stepper로 현재 위치를 명확히 표시합니다.
- 검증 실패 시 잘못된 입력을 강조하고 해결 방법을 안내합니다.

## 스크린샷

=== "라이트 테마 (Light)"
    ![새 빌드 만들기 - 라이트 테마](../assets/screenshots/new-build-light.png)

=== "다크 테마 (Dark)"
    ![새 빌드 만들기 - 다크 테마](../assets/screenshots/new-build-dark.png)

## 관련 문서

- [사용자 흐름](../USER_FLOWS.md) — 새 빌드 위저드 시퀀스
- [상태 모델](../STATE_MODEL.md) — Draft → Build Run 전이
