/**
 * URL source secret redaction — Review UI regression tests (PR #283 리뷰 대응, Epic #246).
 *
 * `draft.url.endpoint`에 `api_key`/`serviceKey`/`token` 등 secret query parameter가
 * 있을 때, Review DOM(Source/Query summary, "실제 제출될 canonical BuildSpec" preview)에
 * 원문이 노출되지 않는지 검증한다. 동시에 실제 Build 제출값(`onBuild`가 받는 in-memory
 * `spec`)은 이 컴포넌트의 표시용 redaction과 무관하게 원문 그대로 유지됨을 확인한다.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReviewBuildStep } from "./ReviewBuildStep";
import { INITIAL_DRAFT, buildSpecFromDraft, type AddDataDraft } from "@/features/add-data/model";

function urlDraft(endpoint: string): AddDataDraft {
  return {
    ...INITIAL_DRAFT,
    sourceKind: "url",
    url: { endpoint, format: null },
    datasetId: "d",
    title: "t",
    description: "desc",
  };
}

function renderReview(draft: AddDataDraft) {
  const specResult = buildSpecFromDraft(draft);
  return {
    specResult,
    ...render(
      <ReviewBuildStep
        draft={draft}
        spec={specResult.spec}
        specError={specResult.error}
        validation={{ status: "idle", valid: false, errors: [] }}
        previewSources={[]}
        previewLimit={5}
        previewSampleMode="first"
        isStale={false}
        jobStatus="idle"
        onBuild={vi.fn()}
        onCancel={vi.fn()}
      />,
    ),
  };
}

describe("ReviewBuildStep — URL source secret redaction (#283)", () => {
  it("?api_key=<secret>의 원문이 Review DOM에 없다", () => {
    const secret = "A7vK2mQ9xP4rT8yW3nC6dF1hJ5sL0zB";
    renderReview(urlDraft(`https://api.example.org/data?api_key=${secret}`));
    expect(document.body.textContent ?? "").not.toContain(secret);
    expect(screen.getAllByText(/REDACTED/).length).toBeGreaterThan(0);
  });

  it("?serviceKey=<secret>의 원문이 Review DOM에 없다", () => {
    const secret = "9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e";
    renderReview(urlDraft(`https://api.data.go.kr/openapi?serviceKey=${secret}`));
    expect(document.body.textContent ?? "").not.toContain(secret);
  });

  it("?token=<secret>의 원문이 Review DOM에 없다", () => {
    const secret = "eyJhbGciOiJIUzI1NiJ9.abcdefghijklmnopqrstuvwxyz012345";
    renderReview(urlDraft(`https://api.example.org/v1/data?token=${secret}`));
    expect(document.body.textContent ?? "").not.toContain(secret);
  });

  it("key 이름이 평범해도 고엔트로피 값이면 Review DOM에서 가려진다", () => {
    const secret = "Zx8pQ2vR7mK4nL9wT1yB6cU3sD0fH5jA8gE2rN7iM4x";
    renderReview(urlDraft(`https://api.example.org/v1/data?auth=${secret}`));
    expect(document.body.textContent ?? "").not.toContain(secret);
  });

  it("일반 비민감 query parameter는 Review DOM에 그대로 남는다", () => {
    renderReview(urlDraft("https://api.example.org/data?region=seoul&year=2024"));
    expect(document.body.textContent ?? "").toContain("region=seoul");
    expect(document.body.textContent ?? "").toContain("year=2024");
  });

  it("표시용 redaction은 실제 in-memory submission spec(endpoint 원문)을 바꾸지 않는다", () => {
    const secret = "A7vK2mQ9xP4rT8yW3nC6dF1hJ5sL0zB";
    const draft = urlDraft(`https://api.example.org/data?api_key=${secret}&region=seoul`);
    const { specResult } = renderReview(draft);

    // Review DOM에서는 가려지지만
    expect(document.body.textContent ?? "").not.toContain(secret);

    // AddDataPage의 onBuild가 실제로 job.start에 넘기는 값(specResult.spec)은
    // 이 컴포넌트의 렌더링과 무관하게 원문 endpoint를 그대로 갖고 있어야 한다.
    expect(specResult.spec?.sources[0]).toMatchObject({
      kind: "url",
      endpoint: `https://api.example.org/data?api_key=${secret}&region=seoul`,
    });
  });
});
