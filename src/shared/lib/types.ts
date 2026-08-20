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
  | "cancelling"
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

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

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
  metadata: Record<string, JsonValue>;
  /**
   * Studio 폼/YAML 에디터가 직접 모델링하지 않는 canonical 최상위 필드를 그대로
   * 보존한다(#250). Builder BuildSpec은 `publish`/`splits`/`pii`/`license`/`quality`/
   * `composition` 등 Studio가 아직 편집 UI를 제공하지 않는 필드를 허용하며,
   * `additionalProperties: true`다. 이 값이 있으면 GUI가 손대지 않는 한 round-trip
   * 중 유실되지 않도록 `toBuilderSpec`이 이 값을 먼저 펼치고 알려진 필드로 덮어쓴다.
   */
  extra?: Record<string, JsonValue>;
}

/** kind="public_api"(기본)/file/url 구분(#498). */
export type SourceKind = "public_api" | "file" | "url";

/** kind="file"/"url" source가 실제로 지원하는 포맷(Builder #498 계약 기준). */
export type SourceFormat = "csv" | "json" | "jsonl" | "parquet";

export interface SchemaContract {
  /** 반드시 존재해야 하는 컬럼 이름 목록 (Builder validate_table required_columns). */
  required: string[];
  /** 컬럼별 기대 dtype 문자열 (Builder _NAMED_DTYPES 키). */
  dtypes: Record<string, string>;
  /** 정규화 시 적용할 컬럼별 캐스팅 (Builder normalize_table casts). */
  casts: Record<string, string>;
}

export interface SourceRef {
  /**
   * source 종류(#498, #250). 생략하면 Builder는 항상 "public_api"로 해석한다
   * (하위 호환 — 기존 spec/테스트가 kind 없이도 그대로 동작).
   */
  kind?: SourceKind;
  /** provider 어댑터 이름. kind="public_api"에서 필수. */
  provider?: string;
  /** provider 내부의 dataset 이름 또는 코드. kind="public_api"에서 필수. */
  dataset?: string;
  params: Record<string, JsonValue>;
  /** 동일 provider/dataset을 여러 번 사용할 때 구분용 별칭 */
  alias?: string;
  /** 소스 스키마 계약 (VAL-1). undefined면 Silver 검증을 생략한다 (하위 호환). */
  schema?: SchemaContract;
  /** kind="file"에서 필수. `POST /uploads`가 발급한 식별자(`upl_` + hex 32자). */
  uploadId?: string;
  /**
   * 소스 content 포맷. kind="file"에서 필수(업로드 시 검증된 format과 일치해야
   * 함), kind="url"에서는 선택(json/jsonl/csv만 허용, 생략 시 Content-Type로 추론).
   */
  format?: SourceFormat;
  /** kind="file"에서 텍스트(csv/json/jsonl) 디코딩에 쓰는 인코딩. 기본 utf-8. */
  encoding?: string;
  /** kind="url"에서 필수. https만 허용(SSRF 정책, #498). */
  endpoint?: string;
  /** kind="url"에서만 쓰이며 P0는 GET만 허용한다. */
  method?: "GET";
}

export interface ExportTarget {
  /** 결과물을 어떤 형식으로 내보낼지 결정하는 식별자 */
  format: string;
  /** 특정 export 형식에만 필요한 추가 옵션 집합 */
  options?: Record<string, JsonValue>;
}

/** manifest 스키마 요약의 단일 컬럼 정보(Builder schema_summary.py FieldSummary). */
export interface ManifestFieldSummary {
  /** 컬럼명 */
  name: string;
  /** 컬럼 타입의 문자열 표현 */
  type: string;
  /** 컬럼에 null 값이 존재할 수 있는지 여부 */
  nullable: boolean;
}

/** 소스(산출물)별 스키마 요약(Builder schema_summary.py SchemaSummary). */
export interface ManifestSchemaSummary {
  /** 컬럼 순서를 보존한 필드 요약 목록 */
  fields: ManifestFieldSummary[];
  /** 컬럼 개수(fields 길이와 동일) */
  total_fields: number;
}

/** 소스별 상세 출처 정보(Builder provenance.py SourceProvenance). */
export interface ManifestSourceProvenance {
  /** 데이터 제공자 식별자(예: datago) */
  provider: string;
  /** 데이터셋 식별자 */
  dataset: string;
  /** fetch 완료 시각(UTC ISO 8601 문자열) */
  fetched_at: string;
  /** 가져온 레코드 수 */
  record_count: number;
  /** 데이터의 재현 가능한 체크섬("sha256:..." 형식) */
  data_checksum: string;
  /** 소스 API 버전. 알 수 없으면 "unknown" */
  api_version: string;
  /** fetch 요청 파라미터 스냅샷 */
  params: Record<string, unknown>;
}

/** 빌드를 생성한 실행 환경 스냅샷(Builder environment.py BuildEnvironment). */
export interface ManifestBuildEnvironment {
  /** 빌드를 실행한 Python 버전 */
  python_version: string;
  /** 설치된 kpubdata 버전. 알 수 없으면 "unknown" */
  kpubdata_version: string;
  /** 설치된 kpubdata-builder 버전. 알 수 없으면 "unknown" */
  builder_version: string;
}

/**
 * Builder가 디스크에 기록하는 manifest JSON의 와이어 형태와 1:1 정렬된 타입 (#98).
 *
 * Builder `manifest/writer.py`의 직렬화 payload를 그대로 따른다(snake_case). 기존의
 * camelCase·단일 합계(recordCount)·SourceRef[] 형태는 실제 Builder 출력과 달라 매핑이
 * 깨졌었다. 이 타입은 Builder가 반환하는 풍부한 정보(provenance/schema/환경/지문)를
 * UI가 그대로 활용할 수 있게 한다.
 */
export interface BuildManifest {
  /** manifest 직렬화 형식 버전(semver, Builder MANIFEST_SCHEMA_VERSION) */
  schema_version: string;
  /** 실행된 빌드를 추적하는 고유 ID */
  build_id: string;
  /** 빌드 시작 시각 ISO 문자열(UTC). 제공되지 않으면 undefined */
  started_at?: string;
  /** 빌드 종료 시각 ISO 문자열(UTC). 제공되지 않으면 undefined */
  finished_at?: string;
  /** 빌드를 생성한 실행 환경. 캡처하지 못했으면 null */
  build_environment: ManifestBuildEnvironment | null;
  /** 입력 파일 또는 소스 식별자 목록. 제공되지 않으면 undefined */
  inputs?: string[];
  /** 입력 데이터 전체의 재현성 지문("sha256:..."). 입력이 없으면 null */
  inputs_fingerprint: string | null;
  /** 생성된 결과물 경로 목록. 제공되지 않으면 undefined */
  outputs?: string[];
  /** 치명적이지 않지만 확인이 필요한 경고 목록. 제공되지 않으면 undefined */
  warnings?: string[];
  /** 실행 실패 또는 부분 실패 메시지 목록. 제공되지 않으면 undefined */
  errors?: string[];
  /** 단계별 또는 산출물별 레코드 수 요약(소스 키 → 건수). 제공되지 않으면 undefined */
  row_counts?: Record<string, number>;
  /** 소스(산출물) 키별 스키마 요약. row_counts와 동일한 키를 사용한다. 제공되지 않으면 undefined */
  schema_summaries?: Record<string, ManifestSchemaSummary>;
  /** 소스별 상세 출처(fetch 시각/파라미터/레코드 수/체크섬) 목록. 제공되지 않으면 undefined */
  provenance?: ManifestSourceProvenance[];
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
  /** 실패/취소 사유 (실패·부분 실패 잡의 terminal 상태에서만) */
  error?: string;
}

/**
 * 빌드 이력 목록용 최소 표현 타입(#153).
 *
 * Builder GET /builds가 spec/title을 제공하지 않으므로, 이들을 null로 가지고
 * UI에서는 run ID를 대신 표시한다. 실제 BuildSpec이 필요한 상세 화면으로 진입하면
 * 그때 개별 조회로 전체 스펙을 가져온다.
 */
export interface BuildListItem {
  /** 실행 이력 항목 고유 ID */
  id: string;
  /** 빌드 제목(Builder에서 제공하지 않으므로 실연동 시 null, mock 시 실제 title) */
  title: string | null;
  /** 현재 실행 상태 */
  status: BuildRunStatus;
  /** 실행 시작 시각 ISO 문자열(Builder에서 null이면 null 유지) */
  startedAt: string | null;
  /** 실행 종료 시각 ISO 문자열(Builder에서 null이거나 누락이면 null) */
  finishedAt: string | null;
}
