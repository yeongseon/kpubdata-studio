/**
 * Publish readiness/실행 결과의 결정적 mock 데이터 (UI audit #4).
 *
 * `getPublishReadiness`/`publishBuild`는 다른 모든 Builder 연동 엔드포인트(getDataset,
 * listBuildStages, getBuildQuality 등, `src/features/datasets/api/index.ts` 참고)와 달리
 * `isRealBuilderEnabled()` 분기가 없어 mock 모드에서도 항상 실제 네트워크 요청을 시도했다.
 * 로컬/데모 환경에는 Builder 서버가 없으므로 요청이 실패해 readiness 카드가 항상
 * loading→error(또는 실질적으로 빈 카드)로만 보였다 — 이 파일은 그 mock 스위치가 참조하는
 * 결정적 fixture다. Builder readiness를 재계산하지 않고, 이미 알려진 mock run별로 실제
 * Builder가 반환했을 값을 그대로 하드코딩한다(#246 원칙: 값을 새로 만들지 않는다).
 */
import type { PublishReadinessResponse, PublishResponse } from "@/shared/lib/builderApi";

export const MOCK_PUBLISH_READINESS: Record<string, PublishReadinessResponse> = {
  "air-quality-20260621": {
    run_id: "air-quality-20260621",
    target: "huggingface",
    ready: true,
    blockers: [],
    warnings: [],
  },
  "dur-product-info-20260620": {
    run_id: "dur-product-info-20260620",
    target: "huggingface",
    ready: true,
    blockers: [],
    warnings: [],
  },
  "dur-usjnt-taboo-20260620": {
    run_id: "dur-usjnt-taboo-20260620",
    target: "huggingface",
    ready: true,
    blockers: [],
    warnings: [{ code: "license_unconfirmed", message: "원본 라이선스가 아직 확인되지 않았습니다." }],
  },
  "dur-pregnancy-taboo-20260621": {
    run_id: "dur-pregnancy-taboo-20260621",
    target: "huggingface",
    ready: false,
    blockers: [{ code: "run_not_completed", message: "이 run은 아직 실행 중입니다(running)." }],
    warnings: [],
  },
  "dur-older-adult-caution-20260618": {
    run_id: "dur-older-adult-caution-20260618",
    target: "huggingface",
    ready: false,
    blockers: [{ code: "stage_failed", message: "Bronze stage가 실패해 Gold 산출물이 없습니다." }],
    warnings: [],
  },
  "dur-dosage-caution-20260621": {
    run_id: "dur-dosage-caution-20260621",
    target: "huggingface",
    ready: false,
    blockers: [{ code: "run_not_started", message: "이 run은 아직 실행되지 않았습니다(queued)." }],
    warnings: [],
  },
  "air-2026-08-14": {
    run_id: "air-2026-08-14",
    target: "huggingface",
    ready: false,
    blockers: [{ code: "partial_failure", message: "source kma__weather의 silver stage가 실패했습니다." }],
    warnings: [],
  },
  "air-2026-08-13": {
    run_id: "air-2026-08-13",
    target: "huggingface",
    ready: true,
    blockers: [],
    warnings: [],
  },
  "population-2026-08-13": {
    run_id: "population-2026-08-13",
    target: "huggingface",
    ready: false,
    blockers: [{ code: "gold_unavailable", message: "Gold export가 아직 계산되지 않았습니다(unavailable)." }],
    warnings: [],
  },
  "transport-2026-08-12": {
    run_id: "transport-2026-08-12",
    target: "huggingface",
    ready: true,
    blockers: [],
    warnings: [],
  },
};

export function mockPublishResult(runId: string, destination: string, isPrivate: boolean): PublishResponse {
  return {
    run_id: runId,
    target: "huggingface",
    publisher: "kpubdata-builder (mock)",
    destination,
    reference: `https://huggingface.co/datasets/${destination}`,
    artifact_count: 1,
    status: isPrivate ? "published_private" : "published_public",
  };
}
