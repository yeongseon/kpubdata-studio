/**
 * 데모(mock) 모드에서 사용하는 결정적 데이터셋 카탈로그.
 *
 * 정적 데모(GitHub Pages)에서 빌드 목록·상세·manifest 뷰어가 비어 보이지 않도록,
 * 실제 `kpubdata-builder`의 데이터셋 빌드 스펙(`scripts/configs/*.yaml`)과 Builder가
 * 기록하는 manifest 와이어 형태를 그대로 본떠 만든 시드 데이터다.
 *
 * 여기서 만든 데이터는 실서비스 값이 아니라 데모 표시용이며, `VITE_USE_REAL_BUILDER=true`
 * 실연동 모드에서는 사용하지 않는다(Builder 실데이터로 대체). Builder의 실제 컬럼명/출처/
 * HuggingFace 레이아웃을 반영하므로 UI가 실제와 유사한 모습으로 동작한다.
 */
import type {
  BuildRunStatus,
  ExportTarget,
  ManifestFieldSummary,
} from "@/shared/lib/types";

/** 데모 카탈로그의 단일 데이터셋 정의. */
export interface DemoDataset {
  /** 경로 안전한 데이터셋 슬러그(빌드 ID prefix로도 사용). */
  slug: string;
  /** 빌드 실행 ID(목록/상세/manifest 조회 키). */
  buildId: string;
  /** 사람이 읽는 제목. */
  title: string;
  /** 빌드 목적 설명. */
  description: string;
  /** provider 내부 dataset 식별자(underscore, 예: air_quality). */
  providerDataset: string;
  /** data.go.kr 원본 오픈API 주소. */
  sourceUrl: string;
  /** provider 요청 파라미터 스냅샷. */
  params: Record<string, string>;
  /** 산출물 export 형식 목록. */
  exports: ExportTarget[];
  /** HuggingFace Hub 리포지토리 경로. */
  hfRepo: string;
  /** 현재 실행 상태. */
  status: BuildRunStatus;
  /** 실행 시작 시각(ISO). */
  startedAt: string;
  /** 실행 종료 시각(ISO). running/queued면 미정. */
  finishedAt?: string;
  /** 수집한 레코드 수. */
  recordCount: number;
  /** 결과 표 컬럼 스키마(Builder column_mapping 기반). */
  fields: ManifestFieldSummary[];
  /** 실패 상태일 때의 에러 메시지. */
  errors?: string[];
}

/** DUR 계열 데이터셋의 공통 오픈API 주소(DURPrdlstInfoService03). */
const DUR_SOURCE_URL = "https://www.data.go.kr/data/15075057/openapi.do";

function str(name: string, nullable = true): ManifestFieldSummary {
  return { name, type: "string", nullable };
}

function f64(name: string): ManifestFieldSummary {
  return { name, type: "float64", nullable: true };
}

/**
 * 데모 데이터셋 카탈로그.
 *
 * 실제 builder 스펙(대기오염정보, DUR 품목/병용금기/임부금기/노인주의/용량주의)을 본떠
 * 다양한 상태(성공/실행 중/실패/대기)를 포함하도록 구성한다.
 */
export const DEMO_DATASETS: DemoDataset[] = [
  {
    slug: "air-quality",
    buildId: "air-quality-20260621",
    title: "대기오염 정보",
    description: "한국환경공단 AirKorea 대기오염정보(SO2/CO/O3/NO2/PM10/PM2.5, 통합대기환경지수) 데이터셋 빌드",
    providerDataset: "air_quality",
    sourceUrl: "https://www.data.go.kr/data/15073861/openapi.do",
    params: { stationName: "종로구", dataTerm: "MONTH" },
    exports: [{ format: "parquet" }, { format: "huggingface" }],
    hfRepo: "kpubdata/air-quality",
    status: "succeeded",
    startedAt: "2026-06-21T09:00:00.000Z",
    finishedAt: "2026-06-21T09:00:12.000Z",
    recordCount: 12304,
    fields: [
      str("station_name", false),
      str("data_time", false),
      f64("pm10"),
      f64("pm25"),
      f64("o3"),
      f64("no2"),
      f64("co"),
      f64("so2"),
      f64("khai_index"),
      str("khai_grade"),
    ],
  },
  {
    slug: "dur-product-info",
    buildId: "dur-product-info-20260620",
    title: "DUR 품목정보",
    description: "식약처 DUR 시스템 등록 의약품 품목 마스터(품목기준코드/품목명/업체명/약효분류) 데이터셋 빌드",
    providerDataset: "dur_product_info",
    sourceUrl: DUR_SOURCE_URL,
    params: {},
    exports: [{ format: "jsonl" }, { format: "huggingface" }],
    hfRepo: "kpubdata/dur-product-info",
    status: "succeeded",
    startedAt: "2026-06-20T14:30:00.000Z",
    finishedAt: "2026-06-20T14:31:47.000Z",
    recordCount: 48512,
    fields: [
      str("item_seq", false),
      str("item_name", false),
      str("company_name"),
      str("formulation"),
      str("class_code"),
      str("class_name"),
      str("etc_otc_code"),
      str("item_permit_date"),
      str("change_date"),
    ],
  },
  {
    slug: "dur-usjnt-taboo",
    buildId: "dur-usjnt-taboo-20260620",
    title: "병용금기 품목정보",
    description: "식약처 DUR 병용금기 의약품 조합(함께 복용하면 안 되는 약제 쌍과 금기 사유) 데이터셋 빌드",
    providerDataset: "dur_usjnt_taboo",
    sourceUrl: DUR_SOURCE_URL,
    params: {},
    exports: [{ format: "jsonl" }, { format: "huggingface" }],
    hfRepo: "kpubdata/dur-usjnt-taboo",
    status: "succeeded",
    startedAt: "2026-06-19T22:10:00.000Z",
    finishedAt: "2026-06-19T22:12:03.000Z",
    recordCount: 31894,
    fields: [
      str("item_seq", false),
      str("item_name", false),
      str("company_name"),
      str("class_name"),
      str("mixture_item_seq"),
      str("mixture_item_name"),
      str("mixture_company_name"),
      str("prohibition_content"),
      str("remark"),
      str("item_permit_date"),
      str("change_date"),
    ],
  },
  {
    slug: "dur-pregnancy-taboo",
    buildId: "dur-pregnancy-taboo-20260621",
    title: "임부금기 의약품",
    description: "식약처 DUR 임부금기 의약품(임신 중 사용 금기 약제와 금기 내용) 데이터셋 빌드",
    providerDataset: "dur_pregnancy_taboo",
    sourceUrl: DUR_SOURCE_URL,
    params: {},
    exports: [{ format: "jsonl" }, { format: "huggingface" }],
    hfRepo: "kpubdata/dur-pregnancy-taboo",
    status: "running",
    startedAt: "2026-06-21T10:15:00.000Z",
    recordCount: 0,
    fields: [
      str("item_seq", false),
      str("item_name", false),
      str("company_name"),
      str("class_name"),
      str("prohibition_content"),
      str("remark"),
      str("item_permit_date"),
      str("change_date"),
    ],
  },
  {
    slug: "dur-older-adult-caution",
    buildId: "dur-older-adult-caution-20260618",
    title: "노인주의 의약품",
    description: "식약처 DUR 노인주의 의약품 데이터셋 빌드(원본 오픈API 응답 지연으로 실패)",
    providerDataset: "dur_older_adult_caution",
    sourceUrl: DUR_SOURCE_URL,
    params: {},
    exports: [{ format: "jsonl" }, { format: "huggingface" }],
    hfRepo: "kpubdata/dur-older-adult-caution",
    status: "failed",
    startedAt: "2026-06-18T03:05:00.000Z",
    finishedAt: "2026-06-18T03:05:31.000Z",
    recordCount: 0,
    errors: ["원본 오픈API 응답 시간 초과(gateway timeout) — Bronze 단계 수집 실패"],
    fields: [
      str("item_seq", false),
      str("item_name", false),
      str("company_name"),
      str("class_name"),
      str("prohibition_content"),
      str("remark"),
    ],
  },
  {
    slug: "dur-dosage-caution",
    buildId: "dur-dosage-caution-20260621",
    title: "용량주의 의약품",
    description: "식약처 DUR 용량주의 의약품(1일 최대 투여량 주의 약제) 데이터셋 빌드(실행 대기 중)",
    providerDataset: "dur_dosage_caution",
    sourceUrl: DUR_SOURCE_URL,
    params: {},
    exports: [{ format: "jsonl" }, { format: "huggingface" }],
    hfRepo: "kpubdata/dur-dosage-caution",
    status: "queued",
    startedAt: "2026-06-21T10:20:00.000Z",
    recordCount: 0,
    fields: [
      str("item_seq", false),
      str("item_name", false),
      str("company_name"),
      str("class_name"),
      str("max_dosage_content"),
      str("remark"),
    ],
  },
];

/**
 * 빌드 ID로 데모 데이터셋을 찾는다. 정확 일치 후 슬러그 prefix 매칭을 시도한다.
 *
 * @param buildId - 조회할 빌드 실행 ID.
 * @returns 매칭되는 데모 데이터셋(없으면 첫 항목).
 */
export function findDemoDataset(buildId: string): DemoDataset {
  const exact = DEMO_DATASETS.find((d) => d.buildId === buildId);
  if (exact) return exact;
  const bySlug = DEMO_DATASETS.find((d) => buildId.startsWith(d.slug));
  return bySlug ?? DEMO_DATASETS[0];
}
