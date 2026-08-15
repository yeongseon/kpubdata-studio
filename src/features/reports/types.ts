/**
 * Report 데이터 모델 (#258).
 *
 * Report 안의 모든 블록은 출처(provenance)가 셋 중 하나로 고정된다 — Builder에서 그대로
 * 가져온 값(BUILDER_EVIDENCE), Kubi가 생성한 해석(KUBI_INTERPRETATION), 사용자가 직접 쓴
 * 내용(USER_CONTENT). 세 종류를 같은 표현으로 섞어서 저장하지 않는다(#258 리뷰 §2) —
 * BUILDER_EVIDENCE 블록은 deterministic 코드만 생성하고, 사용자는 별도 USER_CONTENT
 * 블록으로만 자기 설명을 남긴다.
 *
 * Report는 생성 당시 선택한 dataset/run(`datasetId`/`baseRunId`)을 고정해서 저장한다.
 * 새 Run이 생겨도 이 값을 자동으로 바꾸지 않는다(#258 리뷰 §1) — `staleness.ts`가 저장된
 * 기준과 현재 Builder 상태를 비교해 CURRENT/STALE/ORPHAN/UNAVAILABLE만 판정한다.
 */

/** Report 블록의 출처. 세 종류를 같은 표현으로 섞지 않기 위한 판별 태그. */
export type BlockProvenance = "BUILDER_EVIDENCE" | "KUBI_INTERPRETATION" | "USER_CONTENT";

interface BaseBlock {
  id: string;
  provenance: BlockProvenance;
  createdAt: string;
  updatedAt: string;
}

/** deterministic section 종류. Builder evidence에서만 채워지며 LLM이 생성하지 않는다. */
export type BuilderEvidenceSection =
  | "overview"
  | "pipeline"
  | "quality"
  | "schema"
  | "data_summary"
  | "output";

/**
 * Builder evidence로부터 코드가 그대로 구성한 블록. 값이 없거나 조회에 실패한 필드는
 * "N/A"/"확인할 수 없음"으로 표시하며, 0/PASS/정상 등으로 임의 대체하지 않는다(#258 §4).
 * 사용자가 직접 편집할 수 없다 — 실제 값과 사용자가 고친 값을 구분 없이 섞지 않기 위함이다
 * (#258 §10). 다시 만들고 싶으면 evidence를 새로고침해 재생성한다.
 */
export interface BuilderEvidenceBlock extends BaseBlock {
  provenance: "BUILDER_EVIDENCE";
  section: BuilderEvidenceSection;
  title: string;
  /** 렌더링된 안전한 plain-text/markdown 본문(사용자가 입력한 원문이 아니라 코드가 생성) */
  markdown: string;
  /** 이 섹션이 의존한 evidence 조회가 전부 성공했는지, 일부만 실패했는지, 전부 실패했는지 */
  evidenceStatus: "ok" | "partial" | "unavailable";
  /** unavailable/partial일 때 사람이 읽을 수 있는 사유(재시도 유도용) */
  unavailableReason?: string;
  /**
   * `markdown`(상세 근거 표)를 deterministic 문장으로 요약한 본문(#258 IA 개편).
   * `narrativeSummary.ts`가 evidence에서 그대로 문장화하며, 값이 없으면 0/PASS로 꾸미지
   * 않고 "확인할 수 없습니다"라고 쓴다. optional인 이유: 이 필드가 추가되기 전에 저장된
   * Report에는 없을 수 있고, 그 경우 렌더러는 상세 표만 보여준다.
   */
  summary?: string;
  /**
   * section이 "quality"일 때만, 실제 Builder quality evidence가 있을 때만 채워지는 집계.
   * availability=unavailable이거나 quality 조회 자체가 실패하면 채우지 않는다(가짜 0으로
   * 대체하지 않음) — Report Context sidebar의 Quality summary 표시에 쓰인다.
   */
  qualityCounts?: { pass: number; warn: number; fail: number; evaluated: number };
}

/**
 * Kubi가 제안(ADD_REPORT_BLOCK)했고 사용자가 승인한 해석 블록(#258 §6, §7).
 *
 * `sourceContext`는 이 note가 생성된 시점의 dataset/run/stage다 — Report의 base와 다를 수
 * 있으며, 다르면 `isSameContext=false`로 남겨 "참고 분석"임을 구분한다(다른 Run의 분석을
 * 현재 Report의 정본처럼 합치지 않는다).
 */
export interface KubiInterpretationBlock extends BaseBlock {
  provenance: "KUBI_INTERPRETATION";
  note: string;
  reason: string;
  sourceContext: { datasetId?: string; runId?: string; stage?: string };
  /** sourceContext가 이 Report의 datasetId/baseRunId와 일치하는지 */
  isSameContext: boolean;
  /** ADD_REPORT_BLOCK이 큐에 쌓인 시각(Kubi가 답변을 생성한 시각과 동일하게 취급) */
  generatedAt: string;
  /** evidenceRefs 등 세부 근거는 reportInbox가 보관하지 않으므로 채울 수 있을 때만 채운다 */
  provider?: string;
  model?: string;
}

/** 사용자가 직접 쓰거나 수정한 자유 서술 블록. */
export interface UserContentBlock extends BaseBlock {
  provenance: "USER_CONTENT";
  heading: string;
  markdown: string;
}

export type ReportBlock = BuilderEvidenceBlock | KubiInterpretationBlock | UserContentBlock;

/** 저장된 Report를 다시 열었을 때 기준 evidence가 여전히 유효한지에 대한 판정(#258 §8). */
export type EvidenceRunStatus = "current" | "stale" | "orphan" | "unavailable";

/** Report가 인용하는 evidence 조각에 대한 안정적 참조(내보내기/재확인에 사용). */
export interface ReportEvidenceRef {
  kind: "dataset" | "run" | "quality" | "schema" | "stage" | "output";
  id: string;
  label: string;
}

/**
 * 저장되는 Report Draft. `id`는 저장소 내에서 유일하며, `datasetId`/`baseRunId`는
 * 생성 시점에 고정되어 이후 편집으로도 바뀌지 않는다(별도 "새 Run 기준으로 만들기" 흐름만
 * 새 Report를 만든다).
 */
export interface ReportDraft {
  id: string;
  title: string;
  datasetId: string;
  baseRunId: string;
  /** run 조회 시 얻은 spec_digest(있으면). Builder가 spec을 영속화하지 않으므로 null일 수 있다. */
  buildSpecDigest: string | null;
  createdAt: string;
  updatedAt: string;
  /** 이 Report의 BUILDER_EVIDENCE 블록을 마지막으로 채운 evidence 조회 시각 */
  evidenceFetchedAt: string;
  /** Report 봉투 스키마 버전(개별 Report 단위, 저장소 봉투 버전과 별개) */
  version: number;
  /** 같은 브라우저의 다른 탭에서 저장했는지 감지하기 위한 낙관적 동시성 카운터(#258 §13 최소 안전판) */
  revision: number;
  blocks: ReportBlock[];
  evidenceRefs: ReportEvidenceRef[];
}

/** Report 목록 화면에 필요한 최소 요약(전체 블록을 불러오지 않고 나열하기 위함). */
export interface ReportSummary {
  id: string;
  title: string;
  datasetId: string;
  baseRunId: string;
  createdAt: string;
  updatedAt: string;
}

export const REPORT_VERSION = 1;
