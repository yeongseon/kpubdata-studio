import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { checkPublishReadiness, publishBuild } from "@/features/publish/api";
import { BuildPublishPage } from "@/pages/BuildPublishPage";

describe("publish api (#9)", () => {
  it("publishes (mock) without a result url until Builder integration", async () => {
    const res = await publishBuild("run-1", "huggingface");
    expect(res.status).toBe("published");
    // mock 단계에서는 깨진 링크를 만들지 않도록 url을 비워 둔다.
    expect(res.url).toBeUndefined();
  });

  it("throws AbortError when called with an already-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(publishBuild("run-1", "local", controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("flags missing title and license in readiness check", () => {
    expect(checkPublishReadiness({ title: "", metadata: {} })).toEqual([
      "제목이 필요합니다.",
      "라이선스 정보가 필요합니다.",
    ]);
    expect(checkPublishReadiness({ title: "t", metadata: { license: "CC-BY" } })).toEqual([]);
  });
});

describe("BuildPublishPage (#9)", () => {
  it("publishes the selected destination and shows the published state", async () => {
    render(
      <MemoryRouter initialEntries={["/builds/run-7/publish"]}>
        <Routes>
          <Route path="/builds/:buildId/publish" element={<BuildPublishPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText(/HuggingFace/));
    fireEvent.click(screen.getByRole("button", { name: "게시" }));

    expect(await screen.findByText("게시됨")).toBeInTheDocument();
    expect(screen.getByText(/게시가 완료되었습니다/)).toBeInTheDocument();
  });
});
