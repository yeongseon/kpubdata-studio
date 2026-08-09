# 변경 이력

## v0.4 (Unreleased)

### 추가됨
- **인증 S1-S10**: apiFetch 인증 주입(#186), Google GIS 로그인(#187), 토큰 보관(#188), 만료 처리(#189), 로그인 게이트(#190), Settings 상태(#191), 계약 동기화(#192), 에러 메시지(#193), 오리진 정합(#194), 테스트(#195)
- **BuildSpec 어시스턴트 ST-A1-A10**: AssistProvider + BYOK(#205), 시크릿 스크러빙(#206), 채팅 UI(#207), validate 설명(#208), 카탈로그 조회(#209), 생성+리페어(#210), mock 모드(#211), 테스트(#212), 프라이버시 고지(#213)
- **MSW E2E 테스트 하네스** (#160, #104)
- **zod 스키마 런타임 검증** (#158, #103)
- **API_CONTRACT_VERSION 1.2.0 동기화**
- **계약 적합성 테스트** (contractConformance.test.ts)
- **SpecDiff 컴포넌트**

### 변경됨
- API_CONTRACT.md drift 표 갱신 — 모든 오퍼레이션 정합 (#219)
- WORK_PLAN.md를 .github/로 이동 (#222)

## v0.3

빌드 화면 실장, 검증/미리보기.

- Build Detail 화면 (manifest 요약, 파일 목록)
- Build Edit 마법사 (Stepper, React Hook Form)
- Build Run 페이지
- Build Publish 페이지
- Artifacts 뷰어
- 빌드 목록 페이지
- Spec 매핑 계층 (camelCase → snake_case)

## v0.2

아티팩트, 미리보기.

- 아티팩트 미리보기
- 데이터셋 검증 화면
- 검증 결과 표시
- 빌드 결과물 뷰어

## v0.1

초기 구조.

- Vite + React SPA 셸
- React Router 주요 경로
- feature-based 폴더 구조
- Builder API 클라이언트 (apiFetch, ApiError, 재시도)
- Vitest 테스트 환경
- 주요 페이지 골격 (Home, Builds, NewBuild)
- 도메인 타입 정의
