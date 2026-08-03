/**
 * MSW 서버 설정 — E2E 테스트에서 공유 사용
 *
 * vitest.setup.ts에서 시작한 MSW 서버를 여기서 export하여,
 * 개별 테스트에서 use()로 핸들러를 동적으로 추가할 수 있게 한다.
 */

import { setupServer } from "msw/node";
import { handlers } from "./handlers";

// MSW 서버 생성 (실제로는 vitest.setup.ts에서 listen됨)
export const server = setupServer(...handlers);
