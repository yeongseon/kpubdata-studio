/**
 * Studio 전역에서 공유하는 도메인 타입과 상태 모델 정의.
 *
 * Builder와 Studio 사이에서 주고받는 스펙, 실행 결과, 게시 상태를 일관된 타입으로 표현한다.
 */
/** 사용자가 편집 중인 draft가 어떤 단계에 있는지 나타내는 상태 값 */
export type DraftStatus = "new" | "dirty" | "validated" | "invalid";

/** 실제 빌드 실행이 큐에서 완료까지 어떤 상태를 지나는지 나타내는 값 */
export type BuildRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

/** 최종 게시 흐름이 어느 단계에 있는지 표현하는 상태 값 */
export type PublishStatus =
  | "not_started"
  | "ready"
  | "publishing"
  | "published"
  | "publish_failed";

export interface BuildSpec {
  /** Studio와 Builder 전체에서 공통으로 사용하는 데이터셋 식별자 */
  datasetId: string;
  /** 사람이 읽기 쉬운 빌드 제목 */
  title: string;
  /** 빌드 목적과 맥락을 설명하는 문장 */
  description: string;
  /** 실제 원본 데이터 공급원 목록 */
  sources: SourceRef[];
  /** 산출물을 어떤 형식으로 내보낼지 정의한 대상 목록 */
  exports: ExportTarget[];
  /** 후속 단계에서 재사용할 메타데이터 키-값 사전 */
  metadata: Record<string, string>;
}

export interface SourceRef {
  /** provider 어댑터 이름 */
  provider: string;
  /** provider 내부의 dataset 이름 또는 코드 */
  dataset: string;
  /** provider 요청 시 전달할 문자열 기반 파라미터 집합 */
  params: Record<string, string>;
  /** 동일 provider/dataset을 여러 번 사용할 때 구분용 별칭 */
  alias?: string;
}

export interface ExportTarget {
  /** 결과물을 어떤 형식으로 내보낼지 결정하는 식별자 */
  format: "markdown" | "jsonl" | "parquet" | "huggingface";
  /** 특정 export 형식에만 필요한 추가 옵션 집합 */
  options?: Record<string, string>;
}

export interface BuildManifest {
  /** 실행된 빌드를 추적하는 고유 ID */
  buildId: string;
  /** 빌드 시작 시각 ISO 문자열 */
  startedAt: string;
  /** 빌드 종료 시각 ISO 문자열 */
  finishedAt: string;
  /** 실행에 사용된 원본 소스 목록 */
  sources: SourceRef[];
  /** 생성된 파일 경로 목록 */
  artifactPaths: string[];
  /** 처리된 총 레코드 수 */
  recordCount: number;
  /** 치명적이지 않지만 확인이 필요한 경고 목록 */
  warnings: string[];
  /** 실행 실패 또는 검토 필요 오류 목록 */
  errors: string[];
}

export interface BuildDraft {
  /** 사용자가 편집 중인 현재 스펙 본문 */
  spec: BuildSpec;
  /** 편집/검증 상태를 나타내는 draft 상태 값 */
  status: DraftStatus;
  /** 마지막 수정 시각 ISO 문자열 */
  lastModified: string;
}

export interface BuildRun {
  /** 실행 이력 항목 고유 ID */
  id: string;
  /** 실행에 사용된 빌드 스펙 */
  spec: BuildSpec;
  /** 현재 실행 상태 */
  status: BuildRunStatus;
  /** 실행 완료 후 생성될 manifest 정보 */
  manifest?: BuildManifest;
  /** 실행 시작 시각 ISO 문자열 */
  startedAt: string;
  /** 실행 종료 시각 ISO 문자열 */
  finishedAt?: string;
}
