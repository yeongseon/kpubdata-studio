# 로드맵 — kpubdata-studio

> 한국 공공데이터 빌드 과정을 기획, 미리보기, 실행 및 검사하는 웹 기반 작업실.

## v0.1 ✅ 완료

- ✅ Vite + React SPA 셸
- ✅ React Router 주요 경로
- ✅ feature-based 폴더 구조
- ✅ Builder API 클라이언트 (apiFetch, 재시도, 타임아웃)
- ✅ 도메인 타입 정의
- ✅ 주요 페이지 골격

## v0.2 ✅ 완료

- ✅ 아티팩트 미리보기
- ✅ 데이터셋 검증 화면
- ✅ 빌드 결과물 뷰어

## v0.3 ✅ 완료

- ✅ Build Detail (manifest 요약, 파일 목록)
- ✅ Build Edit 마법사 (Stepper, RHF)
- ✅ Build Run / Publish 페이지
- ✅ Spec 매핑 계층

## v0.4 🔧 진행 중

- ✅ 인증 S1-S10 (apiFetch → Google GIS → 토큰 → 게이트 → 에러)
- ✅ BuildSpec 어시스턴트 ST-A1-A10 (BYOK → 스크러빙 → 채팅 → 생성 → 테스트)
- ✅ MSW E2E 테스트 하네스
- ✅ zod 런타임 검증
- ✅ API 1.2.0 동기화

## v1.0 기준

- ✅ 전체 빌드 워크플로우 UI
- ✅ Builder API 모든 오퍼레이션 클라이언트
- ✅ 인증 (Google OIDC BYOK)
- ✅ BuildSpec 어시스턴트 (설명 + 생성)
- 🔲 Studio↔Builder 실 HTTP E2E (실배포 환경)
