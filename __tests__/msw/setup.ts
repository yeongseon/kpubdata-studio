/**
 * MSW 서버 설정 — E2E 테스트에서 공유 사용
 *
 * vitest.setup.ts에서 시작한 MSW 서버를 여기서 re-export하여,
 * 개별 테스트에서 use()로 핸들러를 동적으로 추가할 수 있게 한다.
 */

export { mswServer as server } from "../../vitest.setup";
