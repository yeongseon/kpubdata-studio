/**
 * Provider 상태 → 사용자 문구 변환의 단일 지점.
 *
 * - `describeCredentialReadiness` (현재 user-facing): ProviderPage / Add Data가
 *   generic live probe 대신 쓰는 credential readiness 표현. Provider 수준에서
 *   신뢰성 있게 확인 가능한 축(요구 여부 / effective configured / 사용자 저장
 *   credential 유무)만 다룬다.
 * - `describeProviderProbe` (retained): Builder `ProviderTestResponse` 매핑.
 *   generic probe는 임의의 첫 Dataset을 필수 파라미터 없이 호출하므로 "연결 성공
 *   여부"로 신뢰할 수 없어 user flow에서는 제거됐다(#S-provider-probe). Builder
 *   API contract는 유지되므로 매핑/테스트는 남겨 둔다(직접 진단용).
 * - 어느 경우든 선택한 Dataset의 실제 사용 가능 여부는 Preview가 SSOT다.
 */

export type ProviderProbeStatus = "connected" | "failed" | "not_configured" | "unknown";
export type ProviderProbeTone = "success" | "warning" | "error" | "neutral";

export interface ProviderProbeInput {
  /** `ProviderTestResponse.status` (`unknown` = 아직 점검 안 함). */
  status: ProviderProbeStatus;
  /** `ProviderTestResponse.error_category`. */
  errorCategory?: string;
  /** `ProviderTestResponse.response_code` — Provider가 실제로 돌려준 HTTP 코드. */
  responseCode?: number;
  /**
   * 이 principal에 대해 credential이 (effective하게) 구성돼 있는지.
   * 저장된 credential이 있는데도 403이면 단순 인증 실패가 아니라 Dataset/API별
   * 사용 권한 문제일 수 있으므로 "확인 필요"로 승격한다.
   */
  credentialConfigured?: boolean;
}

export interface ProviderProbePresentation {
  tone: ProviderProbeTone;
  /** 짧은 배지 문구. */
  label: string;
  /** 자세히 보기 제목(연결 오류/확인 필요일 때만, 그 외 null). */
  title: string | null;
  /** 사용자 행동 안내 1–2문장(없으면 null). */
  detail: string | null;
}

const PERMISSION_CHECK = {
  title: "인증 또는 API 활용신청 확인 필요",
  detail:
    "저장된 자격 증명으로 실제 API를 확인했지만 접근이 거부되었습니다. Provider는 Dataset/API별 사용 권한이 다를 수 있으므로 선택한 Dataset의 Preview에서 실제 사용 가능 여부를 확인하세요.",
} as const;

const FAILURES: Record<string, { title: string; detail: string }> = {
  auth: { title: "인증 정보 확인 필요", detail: "저장된 자격 증명이 유효한지 확인한 뒤 다시 테스트하세요." },
  network: { title: "네트워크 연결 오류", detail: "Builder가 Provider에 연결하지 못했습니다. 네트워크 상태를 확인하세요." },
  timeout: { title: "연결 시간 초과", detail: "Provider 응답이 제한 시간 안에 도착하지 않았습니다. 잠시 후 다시 시도하세요." },
  provider: { title: "Provider 응답 오류", detail: "Provider가 실제 API 확인 요청을 처리하지 못했습니다." },
  unknown: { title: "연결 상태를 확인할 수 없습니다", detail: "Builder가 실제 API 확인 중 분류되지 않은 오류를 받았습니다." },
};

/** Provider 수준 검사 결과임을 항상 함께 안내한다(Dataset 사용 가능 여부와 구분). */
export const PROVIDER_PROBE_SCOPE_NOTE =
  "이 검사는 Provider 수준의 기본 연결 확인입니다. 선택한 Dataset의 실제 사용 가능 여부는 다음 단계 Preview에서 확인합니다.";

/**
 * Provider 상태를 **credential readiness** 로 표현한다(#S-provider-probe). Provider
 * 수준에서 신뢰성 있게 확인 가능한 축은 이것뿐이다:
 *   - provider가 credential을 요구하는지(`requires_credential`)
 *   - effective credential이 구성돼 있는지(`configured`: user credential > server
 *     default > 없음, ADR 0012)
 *   - 이 사용자가 직접 저장한 credential이 있는지(GET /providers/{provider}/credential)
 *
 * "이 API Key가 해당 Dataset에서 실제 유효한가 / 활용신청이 됐는가 / 필수 파라미터가
 * 맞는가 / 실제 응답이 성공하는가" 는 Provider 수준에서 판정하지 않는다 — 선택한
 * Dataset의 Preview가 SSOT다. generic probe(`ProviderTestResponse`)를 사용자-facing
 * "연결 성공 여부" 로 쓰지 않는다.
 */
export interface CredentialReadinessInput {
  /** GET /providers 요약의 `requires_credential`. */
  requiresCredential: boolean;
  /** GET /providers 요약의 effective `configured`(user credential > server default > 없음). */
  summaryConfigured: boolean;
  /**
   * 이 사용자가 직접 저장한 credential 유무(GET /providers/{provider}/credential
   * 메타데이터). server default와 구분한다 — 목록처럼 이 값을 모를 때는 생략한다.
   */
  userCredentialConfigured?: boolean;
}

export interface CredentialReadinessPresentation {
  tone: Exclude<ProviderProbeTone, "error">;
  /** 짧은 배지/헤드라인 문구. */
  label: string;
  /** 안내 1–2문장. */
  detail: string;
}

/** Preview가 실제 사용 가능 여부의 최종 확인임을 항상 함께 안내한다. */
const READINESS_PREVIEW_NOTE =
  "실제 Dataset API 사용 가능 여부는 Add Data의 Preview에서 확인합니다.";

export function describeCredentialReadiness(
  input: CredentialReadinessInput,
): CredentialReadinessPresentation {
  if (!input.requiresCredential) {
    return {
      tone: "neutral",
      label: "인증 불필요",
      detail: "이 제공 기관은 자격 증명 없이 사용할 수 있습니다.",
    };
  }
  if (input.userCredentialConfigured) {
    return {
      tone: "success",
      label: "API Key 등록됨",
      detail: `이 Provider의 인증 정보가 준비되어 있습니다. ${READINESS_PREVIEW_NOTE}`,
    };
  }
  if (input.summaryConfigured) {
    // server default 로 사용 중 — 사용자 등록 API Key와 동일하게 표현하지 않는다.
    return {
      tone: "success",
      label: "연결 준비됨",
      detail: `이 제공 기관은 현재 Builder 기본 자격 증명으로 사용 중입니다. ${READINESS_PREVIEW_NOTE}`,
    };
  }
  return {
    tone: "warning",
    label: "API Key 미설정",
    detail: "이 Provider를 사용하는 Dataset은 API Key가 필요할 수 있습니다.",
  };
}

export function describeProviderProbe(input: ProviderProbeInput): ProviderProbePresentation {
  if (input.status === "connected") {
    return { tone: "success", label: "연결됨", title: null, detail: null };
  }
  if (input.status === "not_configured") {
    return {
      tone: "neutral",
      label: "미설정",
      title: "자격 증명 필요",
      detail: "이 Provider는 자격 증명이 필요합니다. Provider 설정에서 연결하세요.",
    };
  }
  if (input.status === "unknown") {
    return { tone: "neutral", label: "연결 확인 필요", title: null, detail: null };
  }
  // status === "failed"
  const needsPermissionCheck = Boolean(input.credentialConfigured) && input.responseCode === 403;
  if (needsPermissionCheck) {
    return { tone: "warning", label: "확인 필요", ...PERMISSION_CHECK };
  }
  const failure = FAILURES[input.errorCategory ?? "unknown"] ?? FAILURES.unknown;
  return { tone: "error", label: "연결 오류", ...failure };
}
