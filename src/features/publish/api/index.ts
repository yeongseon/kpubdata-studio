/**
 * 게시(publish) 워크플로 API 진입점 (#9).
 *
 * 빌드 결과를 외부 배포 대상(로컬/HuggingFace/GitHub)에 게시한다. Builder service가
 * 아직 publish 엔드포인트를 완전히 구현하지 않았으므로, VITE_USE_REAL_BUILDER=true일 때는
 * 실제 Builder API를 호출하고 그 외에는 mock 결과를 반환한다.
 */
import { builderApi, isRealBuilderEnabled } from "@/shared/lib/builderApi";
import type { BuildSpec } from "@/shared/lib/types";

export type PublishDestination = "local" | "huggingface" | "github";

export interface PublishResult {
  /** 게시 결과 상태 */
  status: "published" | "failed";
  /** 게시된 결과물 위치(로컬은 없음) */
  url?: string;
  /** 실패 시 메시지 */
  error?: string;
}

/**
 * 빌드 결과를 선택한 대상에 게시한다.
 *
 * @param buildId - 게시할 빌드 실행 ID.
 * @param destination - 배포 대상.
 * @param signal - 취소용 AbortSignal(선택).
 * @returns 게시 결과(상태 + 결과 링크).
 */
export async function publishBuild(
  buildId: string,
  destination: PublishDestination,
  signal?: AbortSignal,
): Promise<PublishResult> {
  // 이미 취소된 신호로 호출되면 취소 흐름이 일관되게 동작하도록 AbortError를 던진다.
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  if (isRealBuilderEnabled()) {
    // 실제 Builder API 호출
    try {
      const result = await builderApi.publish(buildId, destination, signal);
      return result;
    } catch (error) {
      // Builder API 오류를 PublishResult 형식으로 변환
      return {
        status: "failed",
        error: error instanceof Error ? error.message : "게시에 실패했습니다.",
      };
    }
  }

  // Mock 모드: 결정적 mock 결과 반환
  return { status: "published" };
}

/** 게시 전 메타데이터 점검(필수 라이선스/제목 등). 누락 항목 메시지를 반환한다. */
export function checkPublishReadiness(spec: Pick<BuildSpec, "title" | "metadata">): string[] {
  const problems: string[] = [];
  if (!spec.title.trim()) problems.push("제목이 필요합니다.");
  if (!spec.metadata.license) problems.push("라이선스 정보가 필요합니다.");
  return problems;
}
