# 화면 설계서 — 설정 (Settings)

## 화면 개요

Studio 환경설정 화면입니다. 워크스페이스 전환과 Builder API 연동(엔드포인트, 연결 상태, 계약 버전)을 관리합니다.

## 라우트 및 진입·이탈

| 항목 | 내용 |
| :--- | :--- |
| 라우트 | `/settings` |
| 컴포넌트 | `src/pages/SettingsPage.tsx` |
| 진입점 | 사이드바 "설정" |
| 이탈점 | 사이드바를 통한 다른 화면 이동 |

## 주요 UI 구성요소

| 구성요소 | 설명 |
| :--- | :--- |
| 워크스페이스 전환 | `WorkspaceSwitcher` |
| Builder API base URL | `API_BASE` 엔드포인트 설정 |
| 연결 상태 | MOCK 모드 안내 또는 `builderApi.version` 기반 연결 확인(ok/error) |
| 계약 버전 비교 | Studio가 기대하는 contract 버전과 Builder 버전 비교 |

## 상태 및 상호작용

- **MOCK 모드**: 실제 Builder 연결 없이 오프라인 안내를 표시합니다.
- **실연동 모드**: `builderApi.version`으로 연결 상태와 계약 버전을 확인하고 성공/오류를 표시합니다.

## 데이터 소스

- `builderApi.version` (실연동 모드에서만 호출). MOCK 모드에서는 정적 안내.

## 접근성

- 입력 필드와 상태 메시지는 라벨과 텍스트로 상태를 명확히 제공합니다.

## 스크린샷

=== "라이트 테마 (Light)"
    ![설정 - 라이트 테마](../assets/screenshots/settings-light.png)

=== "다크 테마 (Dark)"
    ![설정 - 다크 테마](../assets/screenshots/settings-dark.png)

## 관련 문서

- [API 규약](../API_CONTRACT.md)
- [애플리케이션 셸](layout-shell.md)
