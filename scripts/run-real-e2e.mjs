#!/usr/bin/env node
/**
 * cross-repo 실연동 E2E 러너 (kpubdata#282).
 *
 * Studio → 실 Builder HTTP → kpubdata ingestion(file) → manifest 전체 경로를
 * 검증한다. Builder를 KPUBDATA_BUILDER_DEV_MODE=true(인증 생략, dev principal)로
 * 임시 기동하고, Studio를 VITE_USE_REAL_BUILDER=true로 띄운 Playwright
 * real 슈트(@real-builder)를 실행한다. 종료 시 Builder를 정리한다.
 *
 * 사용: node scripts/run-real-e2e.mjs [--builder-root <path>] [--keep]
 * 기본 --builder-root는 ../kpubdata-builder(웍스페이스 레이아웃).
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const keep = args.includes("--keep");
const rootIndex = args.indexOf("--builder-root");
const builderRoot = resolve(
  rootIndex !== -1 ? args[rootIndex + 1] : join(process.cwd(), "..", "kpubdata-builder"),
);

if (!existsSync(join(builderRoot, "pyproject.toml"))) {
  console.error(`builder root not found: ${builderRoot} (pass --builder-root)`);
  process.exit(1);
}

const port = "8902";
const dataDir = mkdtempSync(join(tmpdir(), "kpubdata-real-e2e-"));
console.log(`[real-e2e] builder root: ${builderRoot}`);
console.log(`[real-e2e] builder data: ${dataDir}`);

const builder = spawn(
  "uv",
  ["run", "--project", builderRoot, "kpubdata-builder", "serve", "--output-dir", dataDir, "--port", port],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      KPUBDATA_BUILDER_DEV_MODE: "true",
      // Studio dev 서버(5174) 오리진 허용 — CORS는 default-deny(ADR 0006).
      KPUBDATA_BUILDER_ALLOWED_ORIGINS: "http://localhost:5174",
    },
  },
);
builder.stdout.on("data", (chunk) => process.stdout.write(`[builder] ${chunk}`));
builder.stderr.on("data", (chunk) => process.stderr.write(`[builder] ${chunk}`));

const shutdown = (exitCode) => {
  if (!keep && !builder.killed) builder.kill("SIGTERM");
  process.exit(exitCode);
};
process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

// /healthz가 뜰 때까지 폴링(최대 30초).
const ready = spawnSync(
  "bash",
  [
    "-c",
    `for i in $(seq 1 60); do curl -sf http://localhost:${port}/healthz >/dev/null && exit 0; sleep 0.5; done; exit 1`,
  ],
  { stdio: "inherit" },
);
if (ready.status !== 0) {
  console.error("[real-e2e] builder did not become healthy");
  shutdown(1);
}

const e2e = spawnSync(
  "npx",
  ["playwright", "test", "-c", "playwright.real.config.ts"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      REAL_BUILDER_E2E: "1",
      REAL_BUILDER_URL: `http://localhost:${port}`,
    },
  },
);

shutdown(e2e.status ?? 1);
