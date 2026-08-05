/**
 * 빌드 스펙 편집기 컴포넌트.
 *
 * 새 빌드 및 기존 빌드 편집에서 재사용되는 공통 스펙 편집 UI.
 * React Hook Form으로 입력을 관리하고, Builder POST /validate와 연동하여 검증한다.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { validateSpec } from "@/features/validation/api";
import type { BuildSpec } from "@/shared/lib/types";
import {
  Button,
  Card,
  EmptyState,
  FormField,
  Select,
  Stepper,
  StatusBadge,
  TextInput,
  Textarea,
  type StepItem,
} from "@/shared/ui";

export interface BuildFormValues {
  datasetId: string;
  title: string;
  description: string;
  provider: string;
  sourceDataset: string;
  sourceParams: string;
  outputPath: string;
  exportFormats: Array<"markdown" | "jsonl" | "parquet" | "huggingface">;
}

export interface SpecEditorProps {
  mode: "create" | "edit";
  initialSpec?: BuildSpec;
  onSave: (spec: BuildSpec) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

const PROVIDER_OPTIONS = [
  { value: "bok", label: "한국은행 ECOS (BOK)" },
  { value: "datago", label: "공공데이터포털 (data.go.kr)" },
  { value: "kosis", label: "통계청 KOSIS" },
  { value: "krx", label: "한국거래소 (KRX)" },
  { value: "law", label: "국가법령정보센터" },
  { value: "localdata", label: "지역정보포털 (LocalData)" },
  { value: "lofin", label: "지방재정365 (LOFIN)" },
  { value: "semas", label: "소상공인시장진흥공단 (SEMAS)" },
  { value: "seoul", label: "서울 열린데이터광장" },
  { value: "sgis", label: "통계지리정보서비스 (SGIS)" },
] as const;

const EXPORT_FORMATS = ["markdown", "jsonl", "parquet", "huggingface"] as const;

const STEPS: StepItem[] = [
  { id: "identity", label: "기본 정보" },
  { id: "source", label: "데이터 소스" },
  { id: "params", label: "파라미터" },
  { id: "output", label: "출력 형식" },
  { id: "review", label: "검증·저장" },
];

const STEP_FIELDS: Array<Array<keyof BuildFormValues>> = [
  ["datasetId", "title", "description"],
  ["provider", "sourceDataset"],
  ["sourceParams"],
  ["exportFormats", "outputPath"],
  [],
];

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

interface ValidationState {
  status: "idle" | "validating" | "validated";
  isValid: boolean;
  errors: string[];
}

export function SpecEditor({ mode, initialSpec, onSave, onCancel, isSaving = false }: SpecEditorProps) {
  const [step, setStep] = useState(0);
  const [validation, setValidation] = useState<ValidationState>({
    status: "idle",
    isValid: false,
    errors: [],
  });

  const initialFormValues = useMemo<BuildFormValues>(() => {
    if (initialSpec && initialSpec.sources[0]) {
      const source = initialSpec.sources[0];
      return {
        datasetId: initialSpec.datasetId,
        title: initialSpec.title,
        description: initialSpec.description,
        provider: source.provider,
        sourceDataset: source.dataset,
        sourceParams: JSON.stringify(source.params, null, 2),
        outputPath: initialSpec.metadata.outputPath || "artifacts/builds/example",
        exportFormats: initialSpec.exports.map((e) => e.format),
      };
    }
    return {
      datasetId: "",
      title: "",
      description: "",
      provider: "",
      sourceDataset: "",
      sourceParams: "{}",
      outputPath: "artifacts/builds/example",
      exportFormats: ["jsonl"],
    };
  }, [initialSpec]);

  const {
    formState: { errors, isDirty },
    register,
    trigger,
    watch,
    getValues,
  } = useForm<BuildFormValues>({ defaultValues: initialFormValues, mode: "onChange" });

  const values = watch();
  const validatedSnapshotRef = useRef<string | null>(null);

  useEffect(() => {
    if (validation.status === "idle") return;
    const current = JSON.stringify(values);
    if (validatedSnapshotRef.current === null) {
      validatedSnapshotRef.current = current;
      return;
    }
    if (current !== validatedSnapshotRef.current) {
      validatedSnapshotRef.current = null;
      setValidation({ status: "idle", isValid: false, errors: [] });
    }
  }, [values, validation.status]);

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

    return { spec: candidate };
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

  async function runValidate() {
    validatedSnapshotRef.current = JSON.stringify(getValues());
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
      setValidation({
        status: "validated",
        isValid: false,
        errors: [cause instanceof Error ? cause.message : "검증 요청에 실패했습니다."],
      });
    }
  }

  function handleSave() {
    if (!validation.isValid) {
      runValidate();
      return;
    }
    const next = toBuildSpec(getValues());
    if (next.spec) {
      onSave(next.spec);
    }
  }

  const specPreview = useMemo(() => toBuildSpec(values), [values]);
  const draftStatus = validation.isValid ? "validated" : isDirty ? "dirty" : "new";

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {mode === "edit" ? "빌드 편집" : "새 빌드"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "edit" ? "기존 빌드 스펙을 수정하고 검증합니다." : "새 빌드 스펙을 작성하고 검증합니다."}
          </p>
        </div>
        <StatusBadge status={draftStatus} />
      </div>

      <Card>
        <Stepper steps={STEPS} current={step} onStepClick={setStep} />
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.8fr)]">
        <Card>
          {step === 0 && (
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
                    {...field}
                    {...register("description", { required: "설명을 입력해주세요." })}
                  />
                )}
              </FormField>
            </div>
          )}

          {step === 1 && (
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
                help="제공자 내부의 데이터셋 코드."
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
          )}

          {step === 2 && (
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
                    mono
                    rows={8}
                    {...field}
                    {...register("sourceParams", {
                      required: "파라미터를 입력해주세요.",
                      validate: (value) => parseSourceParams(value).error ?? true,
                    })}
                  />
                )}
              </FormField>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold tracking-tight">출력 형식</h3>
              <fieldset>
                <legend className="text-sm font-medium text-foreground">결과물 형식 (최소 1개)</legend>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {EXPORT_FORMATS.map((format) => (
                    <label
                      key={format}
                      className="flex items-center gap-3 rounded-xl border border-border bg-muted px-4 py-3"
                    >
                      <input
                        type="checkbox"
                        value={format}
                        className="h-4 w-4 accent-emerald-600"
                        {...register("exportFormats", {
                          validate: (selected) => (selected?.length ?? 0) > 0 || "출력 형식을 최소 1개 선택해주세요.",
                        })}
                      />
                      <span className="text-sm font-medium capitalize">{format}</span>
                    </label>
                  ))}
                </div>
                {errors.exportFormats?.message && (
                  <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {errors.exportFormats.message}
                  </p>
                )}
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
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold tracking-tight">검증·저장</h3>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={validation.status === "validating"}
                  onClick={() => void runValidate()}
                >
                  다시 검증
                </Button>
              </div>

              {validation.status === "idle" && (
                <EmptyState
                  title="검증을 진행하세요"
                  description="‘다시 검증’을 눌러 입력값과 빌드 설정을 확인하고 저장할 수 있습니다."
                />
              )}

              {validation.status === "validated" && validation.isValid && (
                <Card variant="success" className="p-4">
                  <p className="text-sm font-medium text-accent-subtle-foreground">
                    검증을 통과했습니다. 빌드 스펙을 저장할 수 있습니다.
                  </p>
                </Card>
              )}

              {validation.errors.length > 0 && (
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
              )}

              <div className="flex gap-3">
                <Button
                  disabled={!validation.isValid || isSaving || !specPreview.spec}
                  loading={isSaving}
                  onClick={handleSave}
                >
                  {mode === "edit" ? "변경사항 저장" : "빌드 스펙 저장"}
                </Button>
                <Button variant="ghost" onClick={onCancel}>
                  취소
                </Button>
              </div>
            </div>
          )}

          <div className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-8 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-6 py-3 backdrop-blur sm:static sm:mx-0 sm:mb-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:dark:bg-transparent">
            <Button variant="ghost" onClick={goBack} disabled={step === 0}>
              이전
            </Button>
            <div className="flex gap-2">
              {step < STEPS.length - 1 ? (
                <Button onClick={() => void goNext()}>다음</Button>
              ) : null}
            </div>
          </div>
        </Card>

        <aside className="space-y-5">
          <Card>
            <details className="group" open>
              <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                생성될 스펙 (Generated spec)
                <span className="text-base transition group-open:rotate-180" aria-hidden="true">
                  ⌄
                </span>
              </summary>
              <pre className="mt-4 overflow-x-auto rounded-xl bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">
                <code>{JSON.stringify(specPreview.spec ?? values, null, 2)}</code>
              </pre>
            </details>
          </Card>
        </aside>
      </div>
    </div>
  );
}