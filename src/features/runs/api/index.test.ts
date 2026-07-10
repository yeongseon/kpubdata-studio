import { describe, expect, it } from "vitest";

import { generateRunId } from "./index";

describe("generateRunId", () => {
  it("dataset id를 경로 안전한 슬러그로 정규화한다", () => {
    const runId = generateRunId("My Dataset/2024!");
    expect(runId).toMatch(/^my-dataset-2024-\d+$/);
  });

  it("빈/비영숫자 dataset id는 'build' 기본값으로 대체한다", () => {
    const runId = generateRunId("!!!");
    expect(runId).toMatch(/^build-\d+$/);
  });

  it("호출마다 서로 다른 값을 생성한다", async () => {
    const first = generateRunId("ds");
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = generateRunId("ds");
    expect(first).not.toBe(second);
  });
});
