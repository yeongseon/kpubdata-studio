# 작업 계획 — docs/add-korean-comments

## 범위
- `src/` 아래 모든 TypeScript/TSX 소스 파일에 한국어 설명 주석을 추가한다.
- 로직은 변경하지 않고 문서화 품질만 높인다.

## 영향 받는 모듈
- `src/app/*`
- `src/pages/*`
- `src/features/*/api/*`
- `src/shared/*`
- `src/main.tsx`, `src/vite-env.d.ts`

## 위험 요소
- JSX 주변 주석 위치가 잘못되면 빌드가 깨질 수 있다.
- 타입 선언 내부 주석 형식이 잘못되면 TypeScript 파싱이 실패할 수 있다.
- 긴 설명을 추가하면서 기존 코드 정렬이 흐트러질 수 있다.

## 검증 단계
- `npx tsc --noEmit`
- `npm run build`
