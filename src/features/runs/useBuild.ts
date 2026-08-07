/**
 * 빌드 데이터 로딩 훅.
 *
 * buildId로 빌드 정보를 가져오고 로딩/에러 상태를 관리한다.
 */
import { useEffect, useState } from "react";
import { getBuild } from "./api/getBuild";
import type { BuildRun } from "@/shared/lib/types";

export interface UseBuildResult {
  build: BuildRun | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * buildId로 빌드 정보를 로드하는 훅.
 *
 * @param buildId - 조회할 빌드 ID.
 * @returns 빌드 데이터와 로딩 상태.
 */
export function useBuild(buildId: string): UseBuildResult {
  const [state, setState] = useState<{
    build: BuildRun | null;
    isLoading: boolean;
    error: string | null;
  }>({
    build: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadBuild() {
      if (!buildId) {
        setState({ build: null, isLoading: false, error: "빌드 ID가 없습니다." });
        return;
      }

      setState({ build: null, isLoading: true, error: null });

      try {
        const build = await getBuild(buildId);
        if (!cancelled) {
          setState({ build, isLoading: false, error: null });
        }
      } catch (cause) {
        if (!cancelled) {
          setState({
            build: null,
            isLoading: false,
            error: cause instanceof Error ? cause.message : "빌드 정보를 불러오지 못했습니다.",
          });
        }
      }
    }

    loadBuild();

    return () => {
      cancelled = true;
    };
  }, [buildId]);

  return state;
}
