/**
 * BuildArtifactsPage UI 테스트 - Issue #119
 *
 * undefined와 빈 배열이 서로 다른 문구로 표시되는지 검증한다.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { BuildManifest } from "@/shared/lib/types";
import { BuildArtifactsPage } from "@/pages/BuildArtifactsPage";
import * as artifactsApi from "@/features/artifacts/api";

const mockGetBuildManifest = vi.spyOn(artifactsApi, "getBuildManifest");

function renderWithManifest(manifest: BuildManifest) {
  mockGetBuildManifest.mockResolvedValue(manifest);
  return render(
    <MemoryRouter initialEntries={["/builds/test-id/artifacts"]}>
      <Routes>
        <Route path="/builds/:buildId/artifacts" element={<BuildArtifactsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe("BuildArtifactsPage - Issue #119: undefined vs empty array", () => {
  it("outputs: undefined → '파일 정보 미제공', outputs: [] → '생성된 파일이 없습니다'", async () => {
    const withUndefined: BuildManifest = {
      schema_version: "1.0.0",
      build_id: "test-undefined",
      build_environment: null,
      inputs_fingerprint: null,
    };

    renderWithManifest(withUndefined);
    await waitFor(() => expect(screen.getByText("파일 정보 미제공")).toBeInTheDocument());
    expect(screen.getByText("파일 정보 미제공")).toBeInTheDocument();
    expect(screen.queryByText("생성된 파일이 없습니다")).not.toBeInTheDocument();
    cleanup();

    const withEmpty: BuildManifest = {
      schema_version: "1.0.0",
      build_id: "test-empty",
      build_environment: null,
      inputs_fingerprint: null,
      outputs: [],
    };

    renderWithManifest(withEmpty);
    await waitFor(() => expect(screen.getByText("생성된 파일이 없습니다")).toBeInTheDocument());
    expect(screen.getByText("생성된 파일이 없습니다")).toBeInTheDocument();
    expect(screen.queryByText("파일 정보 미제공")).not.toBeInTheDocument();
  });

  it("formats: undefined → '미제공', formats: [] → '출력 형식 없음'", async () => {
    const withUndefined: BuildManifest = {
      schema_version: "1.0.0",
      build_id: "test-undefined",
      build_environment: null,
      inputs_fingerprint: null,
    };

    renderWithManifest(withUndefined);
    await waitFor(() => expect(screen.getByText("출력 형식")).toBeInTheDocument());
    expect(screen.queryByText("출력 형식 없음")).not.toBeInTheDocument();
    cleanup();

    const withEmpty: BuildManifest = {
      schema_version: "1.0.0",
      build_id: "test-empty",
      build_environment: null,
      inputs_fingerprint: null,
      outputs: [],
    };

    renderWithManifest(withEmpty);
    await waitFor(() => expect(screen.getByText("출력 형식 없음")).toBeInTheDocument());
    expect(screen.getByText("출력 형식 없음")).toBeInTheDocument();
  });

  it("provenance: undefined → '미제공', provenance: [] → '소스 없음'", async () => {
    const withUndefined: BuildManifest = {
      schema_version: "1.0.0",
      build_id: "test-undefined",
      build_environment: null,
      inputs_fingerprint: null,
    };

    renderWithManifest(withUndefined);
    await waitFor(() => expect(screen.getByText("소스")).toBeInTheDocument());
    expect(screen.queryByText("소스 없음")).not.toBeInTheDocument();
    cleanup();

    const withEmpty: BuildManifest = {
      schema_version: "1.0.0",
      build_id: "test-empty",
      build_environment: null,
      inputs_fingerprint: null,
      provenance: [],
    };

    renderWithManifest(withEmpty);
    await waitFor(() => expect(screen.getByText("소스 없음")).toBeInTheDocument());
    expect(screen.getByText("소스 없음")).toBeInTheDocument();
  });

  it("값이 존재할 때 올바르게 표시됨", async () => {
    const withValues: BuildManifest = {
      schema_version: "1.0.0",
      build_id: "test-values",
      build_environment: null,
      inputs_fingerprint: null,
      outputs: ["artifacts/builds/test/data.jsonl", "artifacts/builds/test/output.parquet"],
      provenance: [
        {
          provider: "datago",
          dataset: "air-quality",
          fetched_at: "2026-06-21T00:00:00+00:00",
          record_count: 100,
          data_checksum: "sha256:abc",
          api_version: "1.0",
          params: {},
        },
      ],
      row_counts: { "datago.air-quality": 100 },
    };

    renderWithManifest(withValues);
    await waitFor(() => expect(screen.queryByText("jsonl, parquet")).toBeInTheDocument());
    expect(screen.getByText("jsonl, parquet")).toBeInTheDocument();
    expect(screen.getByText("datago.air-quality")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });
});

describe("BuildArtifactsPage - manifest truthfulness (F05A)", () => {
  it("full authoritative manifest shows no stale '미연동' warning", async () => {
    const full: BuildManifest = {
      schema_version: "1.0.0",
      build_id: "run-full",
      build_environment: null,
      inputs_fingerprint: null,
      outputs: ["artifacts/builds/run-full/data.jsonl"],
      row_counts: { "datago.air-quality": 100 },
      provenance: [
        {
          provider: "datago",
          dataset: "air-quality",
          fetched_at: "2026-06-21T00:00:00+00:00",
          record_count: 100,
          data_checksum: "sha256:abc",
          api_version: "1.0",
          params: {},
        },
      ],
    };

    renderWithManifest(full);
    await waitFor(() => expect(screen.getByText("Manifest 요약")).toBeInTheDocument());
    expect(screen.queryByText(/아직 연동되지 않아/)).not.toBeInTheDocument();
    expect(screen.queryByText(/manifest가 아직 연동/)).not.toBeInTheDocument();
  });

  it("legacy/partial manifest is described factually (missing metadata, not 'API not integrated')", async () => {
    const partial: BuildManifest = {
      schema_version: "1.0.0",
      build_id: "run-partial",
      build_environment: null,
      inputs_fingerprint: null,
      outputs: ["artifacts/builds/run-partial/data.jsonl"],
      // row_counts / provenance 없음
    };

    renderWithManifest(partial);
    await waitFor(() => expect(screen.getByText("Manifest 요약")).toBeInTheDocument());
    expect(screen.getByText(/일부 메타데이터 필드/)).toBeInTheDocument();
    expect(screen.queryByText(/아직 연동되지 않아/)).not.toBeInTheDocument();
  });
});
