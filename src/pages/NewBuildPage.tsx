/**
 * 새 빌드 작성 마법사(New Build Wizard) 화면.
 *
 * 단일 폼 대신 단계별 Stepper로 안내한다(제안 §5.2): 기본 정보 → 데이터 소스 →
 * 파라미터 → 미리보기 → 출력 형식 → 검증·실행. React Hook Form으로 입력을 관리하고
 * 각 단계 진행 전에 해당 단계 필드만 검증한다. Preview/Validate는 독립 페이지가 아니라
 * 마법사 내부 단계로 통합되어 있다(§5.3/§5.4).
 */
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import { clearDraft, hasDraft, loadDraft, saveDraft } from "@/features/build-spec/draftStorage";
import { previewBuild } from "@/features/preview/api";
import { useBuildJob } from "@/features/runs/useBuildJob";
import { validateSpec } from "@/features/validation/api";
import { buildSpecSchema, exportFormatSchema } from "@/shared/lib/schemas";
import type { BuildSpec } from "@/shared/lib/types";
import {
  Button,
  Card,
  EmptyState,
  FormField,
  PageHeader,
  Select,
  StatusBadge,
  Stepper,
  TextInput,
  Textarea,
  type StepItem,
} from "@/shared/ui";

const exportFormats = exportFormatSchema.options;

// Provider는 직접 입력 대신 선택형으로 제공한다(제안 §5.2.2). dataset 자동 로딩은
// #29 Builder API 연동 시 추가한다.
const PROVIDER_OPTIONS = [
  { value: "datago", label: "data.go.kr (공공데이터포털)" },
  { value: "kma", label: "기상청 (KMA)" },
  { value: "seoul", label: "서울 열린데이터광장" },
  { value: "kosis", label: "통계청 (KOSIS)" },
] as const;

interface BuildFormValues {
  datasetId: string;
  title: string;
  description: string;
  provider: string;
  sourceDataset: string;
  sourceParams: string;
  outputPath: string;
  exportFormats: Array<(typeof exportFormats)[number]>;
}

const initialValues: BuildFormValues = {
  datasetId: "",
  title: "",
  description: "",
  provider: "",
  sourceDataset: "",
  sourceParams: "{}",
  outputPath: "artifacts/builds/example",
  exportFormats: ["jsonl"],
};

// 빌드 시작 템플릿(제안 §5.2.1). 선택 시 폼을 해당 값으로 채우고 다음 단계로 넘어간다.
interface BuildTemplate {
  id: string;
  name: string;
  description: string;
  values: BuildFormValues;
}

const TEMPLATES: BuildTemplate[] = [
  {
    id: "blank",
    name: "빈 빌드",
    description: "아무 값 없이 처음부터 직접 설정합니다.",
    values: initialValues,
  },
  {
    id: "air_quality",
    name: "대기오염 정보",
    description: "data.go.kr 대기오염 측정 데이터로 시작합니다.",
    values: {
      datasetId: "datago-air-quality",
      title: "대기오염 정보",
      description: "data.go.kr 대기오염 측정 데이터셋",
      provider: "datago",
      sourceDataset: "air-quality",
      sourceParams: '{"sidoName": "서울"}',
      outputPath: "artifacts/builds/air-quality",
      exportFormats: ["jsonl"],
    },
  },
  {
    id: "weather",
    name: "기상 관측",
    description: "기상청 일별 관측 데이터로 시작합니다.",
    values: {
      datasetId: "kma-daily-observations",
      title: "기상청 일별 관측",
      description: "기상청 일별 지상 관측 데이터셋",
      provider: "kma",
      sourceDataset: "daily-observations",
      sourceParams: '{"stn": "108"}',
      outputPath: "artifacts/builds/kma-daily",
      exportFormats: ["jsonl", "parquet"],
    },
  },
  {
    id: "population",
    name: "인구 통계",
    description: "통계청(KOSIS) 인구 통계로 시작합니다.",
    values: {
      datasetId: "kosis-population",
      title: "인구 통계",
      description: "통계청 KOSIS 인구 통계 데이터셋",
      provider: "kosis",
      sourceDataset: "population",
      sourceParams: '{"region": "11"}',
      outputPath: "artifacts/builds/population",
      exportFormats: ["jsonl"],
    },
  },
];

const STEPS: StepItem[] = [
  { id: "template", label: "템플릿" },
  { id: "identity", label: "기본 정보" },
  { id: "source", label: "데이터 소스" },
  { id: "params", label: "파라미터" },
  { id: "preview", label: "미리보기" },
  { id: "output", label: "출력 형식" },
  { id: "review", label: "검증·실행" },
];

// 각 단계에서 Next 진입 전에 검증할 폼 필드. Template/Preview/Review 단계는 입력 필드가 없다.
const STEP_FIELDS: Array<Array<keyof BuildFormValues>> = [
  [],
  ["datasetId", "title", "description"],
  ["provider", "sourceDataset"],
  ["sourceParams"],
  [],
  ["exportFormats", "outputPath"],
  [],
];

/**
 * textarea의 JSON 파라미터 문자열을 `Record<string, string>`으로 정규화한다.
 *
 * @param sourceParams - 사용자가 입력한 JSON 문자열.
 * @returns 파싱된 객체 또는 한국어 오류 메시지.
 */
function parseSourceParams(sourceParams: string) {
  try {
    const parsed = JSON.parse(sourceParams) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "파라미터는 JSON 객체여야 합니다. 예: {\"region\": \"seoul\"}" };
    }
    const entries = Object.entries(parsed);
    const values = Object.fromEntries(entries.map(([key, value]) => [key, String(value)]));
    return { data: values };
  } catch {
    return { error: "파라미터가 올바른 JSON이 아닙니다. 형식을 확인하세요." };
  }
}

/**
 * 폼 입력값으로 BuildSpec 후보를 만들고 zod로 검증한다.
 *
 * @param values - 현재 폼 입력값.
 * @returns 검증을 통과한 스펙 또는 한국어 오류 메시지.
 */
function toBuildSpec(values: BuildFormValues): { spec?: BuildSpec; error?: string } {
  const parsedParams = parseSourceParams(values.sourceParams);
  if (parsedParams.error) {
    return { error: parsedParams.error };
  }

  const candidate: BuildSpec = {
    datasetId: values.datasetId,
    title: values.title,
    description: values.description,
    sources: [
      { provider: values.provider, dataset: values.sourceDataset, params: parsedParams.data ?? {} },
    ],
    exports: values.exportFormats.map((format) => ({
      format,
      options: format === "huggingface" ? { outputPath: values.outputPath } : undefined,
    })),
    metadata: { outputPath: values.outputPath },
  };

  const result = buildSpecSchema.safeParse(candidate);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "빌드 스펙이 올바르지 않습니다." };
  }
  return { spec: result.data };
}

interface PreviewState {
  status: "idle" | "loading" | "loaded" | "error";
  rows: Record<string, unknown>[];
  schema: Record<string, string>;
  error?: string;
}

interface ValidationState {
  status: "idle" | "validating" | "validated";
  isValid: boolean;
  errors: string[];
}

/**
 * 단계별 New Build Wizard 페이지 컴포넌트.
 *
 * @returns 마법사 UI.
 */
export function NewBuildPage() {
  // /builds/:buildId/edit 로 진입한 경우(편집 모드). 기존 스펙 로드는 Builder 연동(#29)
  // 이후 지원하므로, 지금은 안내만 표시한다.
  const { buildId } = useParams();
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState<PreviewState>({ status: "idle", rows: [], schema: {} });
  const [validation, setValidation] = useState<ValidationState>({
    status: "idle",
    isValid: false,
    errors: [],
  });
  // 저장된 초안이 있으면 복원 배너를 보여준다 (#10). 마운트 시 한 번만 확인한다.
  const [draftAvailable, setDraftAvailable] = useState(() => hasDraft());
  const [draftSaved, setDraftSaved] = useState(false);
  const job = useBuildJob();

  const {
    formState: { errors, isDirty },
    register,
    trigger,
    watch,
    getValues,
    reset,
  } = useForm<BuildFormValues>({ defaultValues: initialValues, mode: "onChange" });

  const values = watch();
  const specPreview = useMemo(() => toBuildSpec(values), [values]);

  const draftStatus = validation.isValid ? "validated" : isDirty ? "dirty" : "new";

  // 템플릿을 선택하면 폼을 해당 값으로 채우고 기본 정보 단계로 넘어간다 (#11).
  // 이전 템플릿에서 로드된 미리보기/검증 결과가 남지 않도록 함께 초기화한다.
  function selectTemplate(template: BuildTemplate) {
    reset(template.values);
    setPreview({ status: "idle", rows: [], schema: {} });
    setValidation({ status: "idle", isValid: false, errors: [] });
    setStep(1);
  }

  // 현재 입력을 localStorage 초안으로 저장한다 (#10).
  // 방금 저장한 값을 기준으로 reset 하여 dirty 상태를 정리하고, 같은 세션에서 복원 배너가
  // 뜨지 않도록 draftAvailable은 건드리지 않는다(배너는 새 마운트 시 복원용).
  function saveCurrentDraft() {
    const current = getValues();
    saveDraft(current);
    reset(current);
    setDraftSaved(true);
  }

  // 저장된 초안을 복원해 기본 정보 단계로 이동한다.
  function restoreDraft() {
    const saved = loadDraft<BuildFormValues>();
    if (!saved) {
      // 깨진 값이 남아 배너가 반복되지 않도록 정리하고, 이동/숨김은 하지 않는다.
      clearDraft();
      setDraftAvailable(false);
      return;
    }
    reset(saved);
    setDraftAvailable(false);
    setStep(1);
  }

  // 저장된 초안을 삭제하고 배너를 숨긴다.
  function discardDraft() {
    clearDraft();
    setDraftAvailable(false);
  }

  async function goNext() {
    const fields = STEP_FIELDS[step];
    const ok = fields.length === 0 ? true : await trigger(fields);
    if (!ok) return;
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, 0));
  }

  async function runPreview() {
    const next = toBuildSpec(getValues());
    if (next.error || !next.spec) {
      setPreview({ status: "error", rows: [], schema: {}, error: next.error });
      return;
    }
    setPreview({ status: "loading", rows: [], schema: {} });
    try {
      const result = await previewBuild(next.spec);
      setPreview({ status: "loaded", rows: result.rows, schema: result.schema });
    } catch (cause) {
      setPreview({
        status: "error",
        rows: [],
        schema: {},
        error: cause instanceof Error ? cause.message : "미리보기에 실패했습니다.",
      });
    }
  }

  async function runValidate() {
    const next = toBuildSpec(getValues());
    if (next.error || !next.spec) {
      setValidation({ status: "validated", isValid: false, errors: [next.error ?? "스펙 오류"] });
      return;
    }
    setValidation({ status: "validating", isValid: false, errors: [] });
    try {
      const result = await validateSpec(next.spec);
      setValidation({ status: "validated", isValid: result.valid, errors: result.errors });
    } catch (cause) {
      // 네트워크/5xx/파싱 실패를 화면에서 확인할 수 있게 오류로 반영한다(미처리 rejection 방지).
      setValidation({
        status: "validated",
        isValid: false,
        errors: [cause instanceof Error ? cause.message : "검증 요청에 실패했습니다."],
      });
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="새 빌드"
        title="새 공공데이터 빌드 만들기"
        description="데이터 소스, 파라미터, 출력 형식을 단계별로 설정합니다."
        actions={<StatusBadge status={draftStatus} />}
      />

      {buildId ? (
        <Card variant="dashed" className="p-4">
          <p className="text-sm text-zinc-700 dark:text-zinc-200">
            기존 빌드 <span className="font-medium">{buildId}</span> 편집은 Builder 연동(#29) 후
            지원됩니다. 지금은 새 빌드로 작성됩니다.
          </p>
        </Card>
      ) : null}

      {draftAvailable ? (
        <Card variant="dashed" className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-700 dark:text-zinc-200">
            저장된 초안이 있습니다. 이어서 편집할까요?
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={restoreDraft}>
              불러오기
            </Button>
            <Button size="sm" variant="ghost" onClick={discardDraft}>
              삭제
            </Button>
          </div>
        </Card>
      ) : null}

      <Card>
        <Stepper steps={STEPS} current={step} onStepClick={setStep} />
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.8fr)]">
        <Card>
          {step === 0 ? (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold tracking-tight">템플릿 선택</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                자주 쓰는 공공데이터 조합으로 시작하거나 빈 빌드로 처음부터 설정하세요.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => selectTemplate(template)}
                    className="rounded-2xl border border-zinc-200/80 bg-white/80 p-4 text-left transition hover:border-zinc-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/70"
                  >
                    <p className="text-base font-semibold tracking-tight">{template.name}</p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                      {template.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold tracking-tight">기본 정보</h3>
              <FormField
                id="datasetId"
                label="데이터셋 ID"
                required
                help="공백 없이 영문 소문자·숫자·하이픈만. 예: kma-daily-observations"
                error={errors.datasetId?.message}
              >
                {(field) => (
                  <TextInput
                    placeholder="kma-daily-observations"
                    {...field}
                    {...register("datasetId", { required: "데이터셋 ID를 입력해주세요. 예: kma-daily-observations" })}
                  />
                )}
              </FormField>
              <FormField id="title" label="제목" required error={errors.title?.message}>
                {(field) => (
                  <TextInput
                    placeholder="기상청 일별 관측"
                    {...field}
                    {...register("title", { required: "제목을 입력해주세요." })}
                  />
                )}
              </FormField>
              <FormField
                id="description"
                label="설명"
                required
                help="이 빌드가 무엇을 수집하고 어떻게 활용하는지 적어주세요."
                error={errors.description?.message}
              >
                {(field) => (
                  <Textarea
                    className="font-sans"
                    {...field}
                    {...register("description", { required: "설명을 입력해주세요." })}
                  />
                )}
              </FormField>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold tracking-tight">데이터 소스</h3>
              <FormField id="provider" label="제공자 (Provider)" required error={errors.provider?.message}>
                {(field) => (
                  <Select {...field} {...register("provider", { required: "제공자를 선택해주세요." })}>
                    <option value="">제공자 선택…</option>
                    {PROVIDER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <FormField
                id="sourceDataset"
                label="데이터셋 (Dataset)"
                required
                help="제공자 내부의 데이터셋 코드. (자동 목록은 Builder API 연동 후 제공)"
                error={errors.sourceDataset?.message}
              >
                {(field) => (
                  <TextInput
                    placeholder="air-quality"
                    {...field}
                    {...register("sourceDataset", { required: "데이터셋을 입력해주세요." })}
                  />
                )}
              </FormField>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold tracking-tight">파라미터</h3>
              <FormField
                id="sourceParams"
                label="요청 파라미터 (고급 / Advanced JSON)"
                help='지역·기간 등 요청 파라미터를 JSON 객체로 입력하세요. 예: {"region": "gangnam"}'
                error={errors.sourceParams?.message}
              >
                {(field) => (
                  <Textarea
                    rows={8}
                    {...field}
                    {...register("sourceParams", {
                      required: "파라미터를 입력해주세요.",
                      // JSON 문법/객체 여부를 단계 이동(trigger) 시점에 바로 막고 필드에 표시한다.
                      validate: (value) => parseSourceParams(value).error ?? true,
                    })}
                  />
                )}
              </FormField>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold tracking-tight">미리보기</h3>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={preview.status === "loading"}
                  onClick={() => void runPreview()}
                >
                  미리보기 새로고침
                </Button>
              </div>
              {preview.status === "idle" ? (
                <EmptyState
                  title="현재 설정으로 샘플 데이터를 확인하세요"
                  description="‘미리보기 새로고침’을 누르면 Builder가 반환한 샘플 행과 스키마가 표시됩니다."
                />
              ) : null}
              {preview.status === "error" ? (
                <EmptyState
                  title="미리보기를 불러오지 못했습니다"
                  description={preview.error ?? "파라미터를 확인한 뒤 다시 시도하세요."}
                />
              ) : null}
              {preview.status === "loaded" && preview.rows.length === 0 ? (
                <EmptyState
                  title="조건에 맞는 데이터가 없습니다"
                  description="날짜 범위나 지역 조건을 조정해보세요. (현재 Preview API는 스텁이라 빈 결과를 반환합니다.)"
                />
              ) : null}
              {preview.status === "loaded" && preview.rows.length > 0 ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  {preview.rows.length}개 샘플 행 · {Object.keys(preview.schema).length}개 컬럼
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold tracking-tight">출력 형식</h3>
              <fieldset>
                <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  결과물 형식 (최소 1개)
                </legend>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {exportFormats.map((format) => (
                    <label
                      key={format}
                      className="flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/70"
                    >
                      <input
                        type="checkbox"
                        value={format}
                        className="h-4 w-4 accent-zinc-900 dark:accent-white"
                        {...register("exportFormats", {
                          validate: (selected) =>
                            (selected?.length ?? 0) > 0 || "출력 형식을 최소 1개 선택해주세요.",
                        })}
                      />
                      <span className="text-sm font-medium capitalize">{format}</span>
                    </label>
                  ))}
                </div>
                {errors.exportFormats ? (
                  <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {errors.exportFormats.message}
                  </p>
                ) : null}
              </fieldset>
              <FormField
                id="outputPath"
                label="출력 경로 (Output path)"
                required
                error={errors.outputPath?.message}
              >
                {(field) => (
                  <TextInput
                    placeholder="artifacts/builds/air-quality"
                    {...field}
                    {...register("outputPath", { required: "출력 경로를 입력해주세요." })}
                  />
                )}
              </FormField>
            </div>
          ) : null}

          {step === 6 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold tracking-tight">검증·실행</h3>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={validation.status === "validating"}
                  onClick={() => void runValidate()}
                >
                  다시 검증
                </Button>
              </div>
              {validation.status === "idle" ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  ‘다시 검증’을 눌러 입력값과 빌드 설정을 확인하세요.
                </p>
              ) : null}
              {validation.status === "validated" && validation.isValid ? (
                <Card variant="success" className="p-4">
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                    검증을 통과했습니다. 빌드를 실행할 수 있습니다.
                  </p>
                </Card>
              ) : null}
              {validation.errors.length > 0 ? (
                <ul className="space-y-2">
                  {validation.errors.map((error) => (
                    <li
                      key={error}
                      role="alert"
                      className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200"
                    >
                      {error}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={!validation.isValid || job.status === "running" || !specPreview.spec}
                  loading={job.status === "running"}
                  onClick={() => {
                    if (specPreview.spec) void job.start(specPreview.spec);
                  }}
                >
                  빌드 실행
                </Button>
                {job.status === "running" ? (
                  <Button variant="secondary" onClick={job.cancel}>
                    취소
                  </Button>
                ) : null}
                {job.status === "succeeded" ? (
                  <span className="text-sm text-emerald-700 dark:text-emerald-300">
                    빌드 성공 (run {job.run?.id})
                  </span>
                ) : null}
                {job.status === "failed" ? (
                  <span role="alert" className="text-sm text-red-700 dark:text-red-300">
                    {job.error}
                  </span>
                ) : null}
                {job.status === "cancelled" ? (
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">실행이 취소되었습니다.</span>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mt-8 flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={goBack} disabled={step === 0}>
              이전
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={saveCurrentDraft}>
                {draftSaved && !isDirty ? "저장됨 ✓" : "초안 저장"}
              </Button>
              {step < STEPS.length - 1 ? (
                <Button onClick={() => void goNext()}>다음</Button>
              ) : null}
            </div>
          </div>
        </Card>

        <aside className="space-y-5">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
              생성될 스펙 (Generated spec)
            </p>
            <pre className="mt-4 overflow-x-auto rounded-[1.5rem] bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">
              <code>{JSON.stringify(specPreview.spec ?? values, null, 2)}</code>
            </pre>
          </Card>
        </aside>
      </div>
    </main>
  );
}
