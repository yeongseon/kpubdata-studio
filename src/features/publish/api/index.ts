/**
 * 게시(publish) 워크플로 API 진입점 (#9).
 *
 * 빌드 결과를 외부 배포 대상(로컬/HuggingFace/GitHub)에 게시한다. Builder service가
 * 아직 publish 엔드포인트를 노출하지 않으므로 현재는 결정적 mock 결과를 반환한다.
 * Builder publish 엔드포인트가 생기면 이 함수만 실제 호출로 교체한다.
 */
import { isRealBuilderEnabled } from "@/shared/lib/builderApi";
import type { BuildSpec } from "@/shared/lib/types";

/**
 * 게시 대상. Builder의 `PUBLISHER_REGISTRY` 키와 일치해야 한다.
 *
 * Builder가 실제로 제공하는 publisher는 local / huggingface / kaggle 세 가지다.
 * 이전에는 여기에 "github"가 있었지만 Builder에 대응 publisher가 없어, 사용자가 고를 수
 * 있는데 실행은 불가능한 선택지였다 (#120).
 */
export type PublishDestination = "local" | "huggingface" | "kaggle";

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
 * Builder service(`service/app.py`)는 `/version`, `/validate`, `/preview`, `/build`,
 * `/artifacts/{run_id}`, `/builds`만 노출하며 publish 엔드포인트가 없다. 게시 로직 자체는
 * Builder CLI(`kpubdata publish`)와 `PUBLISHER_REGISTRY`에 존재하지만 HTTP로는 닿을 수 없다.
 *
 * 따라서 실연동 모드에서 성공을 반환하면 아무 일도 일어나지 않았는데 게시된 것처럼 보인다.
 * 이는 이슈 #120이 지적한 문제이므로, 여기서는 성공을 가장하지 않고 실패 사유를 그대로
 * 돌려준다. Builder에 `POST /publish`가 추가되면 이 분기를 실제 호출로 교체한다.
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
    return {
      status: "failed",
      error:
        "Builder에 게시 엔드포인트가 없어 실제 게시를 수행할 수 없습니다. " +
        "현재는 Builder CLI(kpubdata publish)로만 게시할 수 있습니다.",
    };
  }

  // mock 모드에서는 게시 흐름 UI(진행/성공/취소)를 개발·검증할 수 있도록 성공을 반환한다.
  // 실제 결과 URL이 없으므로 url은 비워 둔다(깨진 링크 방지).
  void buildId;
  void destination;
  return { status: "published" };
}

/** 게시 전 메타데이터 점검(필수 라이선스/제목 등). 누락 항목 메시지를 반환한다. */
export function checkPublishReadiness(spec: Pick<BuildSpec, "title" | "metadata">): string[] {
  const problems: string[] = [];
  if (!spec.title.trim()) problems.push("제목이 필요합니다.");
  if (!spec.metadata.license) problems.push("라이선스 정보가 필요합니다.");
  return problems;
}
