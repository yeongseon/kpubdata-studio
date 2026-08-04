/**
 * Vitest 통합 테스트 설정 (#160).
 *
 * 실제 Builder Docker 컨테이너와 HTTP 통신하는 E2E 테스트를 위한 별도 설정.
 * 일반 unit 테스트(vitest.config.ts)와 분리되어 있어 `npm test`에서 실행되지 않는다.
 */
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // 통합 테스트는 Node 환경에서 실행 (jsdom 불필요)
  test: {
    // 테스트 파일이 아닌 파일은 제외
    exclude: ["node_modules", "dist"],
    // 통합 테스트만 포함 (기본 Vitest와 분리)
    include: ["__tests__/integration/**/*.e2e.ts"],
    environment: "node",
    // 충분한 timeout (Docker 컨테이너 기동 등)
    testTimeout: 30000,
    hookTimeout: 30000,
    // 단일 스레드 실행 (순서 보장)
    pool: "forks",
    fileParallelism: false,
    // 별도의 setup 파일 불필요 (jsdom 설정 없음)
    setupFiles: [],
    // coverage는 integration에서 비활성화 (unit 테스트에서만)
    coverage: { enabled: false },
  },

  // 경로 별칭 (vite.config.ts와 동일하게 유지)
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
