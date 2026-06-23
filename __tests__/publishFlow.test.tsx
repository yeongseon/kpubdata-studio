import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { checkPublishReadiness, publishBuild } from "@/features/publish/api";
import { BuildPublishPage } from "@/pages/BuildPublishPage";

describe("publish api (#9)", () => {
  it("returns a HuggingFace URL when publishing there", async () => {
    const res = await publishBuild("run-1", "huggingface");
    expect(res.status).toBe("published");
    expect(res.url).toContain("huggingface.co/datasets/run-1");
  });

  it("has no url for a local publish", async () => {
    const res = await publishBuild("run-1", "local");
    expect(res.url).toBeUndefined();
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
  it("publishes the selected destination and shows the result link", async () => {
    render(
      <MemoryRouter initialEntries={["/builds/run-7/publish"]}>
        <Routes>
          <Route path="/builds/:buildId/publish" element={<BuildPublishPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText(/HuggingFace/));
    fireEvent.click(screen.getByRole("button", { name: "게시" }));

    const link = await screen.findByRole("link", { name: "결과 보기" });
    expect(link).toHaveAttribute("href", expect.stringContaining("huggingface.co/datasets/run-7"));
  });
});
