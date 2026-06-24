/**
 * 게시(publish) 워크플로 API 진입점 (#9).
 *
 * 빌드 결과를 외부 배포 대상(로컬/HuggingFace/GitHub)에 게시한다. Builder service가
 * 아직 publish 엔드포인트를 노출하지 않으므로 현재는 결정적 mock 결과를 반환한다.
 * Builder publish 엔드포인트가 생기면 이 함수만 실제 호출로 교체한다.
 */
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
 * 빌드 결과를 선택한 대상에 게시한다(현재 mock).
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
  void buildId;
  void destination;
  // Builder publish 엔드포인트 전까지는 실제 결과 URL이 없으므로 url을 비워 둔다(깨진 링크 방지).
  // Builder가 게시 결과 URL을 반환하면 이 함수에서 result.url에 채운다.
  return { status: "published" };
}

/** 게시 전 메타데이터 점검(필수 라이선스/제목 등). 누락 항목 메시지를 반환한다. */
export function checkPublishReadiness(spec: Pick<BuildSpec, "title" | "metadata">): string[] {
  const problems: string[] = [];
  if (!spec.title.trim()) problems.push("제목이 필요합니다.");
  if (!spec.metadata.license) problems.push("라이선스 정보가 필요합니다.");
  return problems;
}
