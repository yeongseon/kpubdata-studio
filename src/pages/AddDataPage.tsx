/**
 * Add Data Workbench (`/add`, #250).
 *
 * Add Data → Source → Configure → Canonical BuildSpec → Preview & Validation → Review →
 * Build → Builds/Runs. Prototype(`kpubdata_ui_prototype_v1.html`)의 4단계 wizard
 * 구조(Source/Configure/Preview & Validate/Review & Build)를 그대로 따르되, 실제
 * 값/상태/limit/availability는 Builder 계약을 따른다.
 *
 * 재사용:
 *  - Builder API client/Zod 스키마 — `shared/lib/builderApi.ts`
 *  - BuildSpec 매핑/직렬화 — `features/build-spec/specMapping.ts`(제출과 Review 표시가
 *    같은 `toBuilderSpec` 호출 결과를 쓰도록 보장, #250 amendment 1)
 *  - 초안 저장 — `features/build-spec/draftStorage.ts`(다른 key로 재사용)
 *  - Preview/Validate/Build 실행 — `features/preview/api`, `features/validation/api`,
 *    `features/runs/useBuildJob`(mock/real 분기와 실제 run_id 보장을 그대로 물려받음)
 *  - Quality 표시 — `features/quality/model.ts`, `features/quality/QualityBadge`
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchCatalog, testProvider, uploadSourceFile } from "@/features/add-data/api";
import { ConfigureStep, type CatalogState, type ProviderTestState, type UploadState } from "@/features/add-data/components/ConfigureStep";
import { PreviewValidationStep, type PreviewState } from "@/features/add-data/components/PreviewValidationStep";
import { ReviewBuildStep } from "@/features/add-data/components/ReviewBuildStep";
import { SourceStep } from "@/features/add-data/components/SourceStep";
import { clearAddDataDraft, hasAddDataDraft, loadAddDataDraft, saveAddDataDraft } from "@/features/add-data/draftStorage";
import { findDataset, identityFromCatalog, identityFromFilename, identityFromUrl } from "@/features/add-data/identity";
import {
  INITIAL_DRAFT,
  applyBuildSpecToDraft,
  buildSpecFromDraft,
  draftSignature,
  type AddDataDraft,
  type PreviewColumnView,
  type PreviewLimit,
  type PreviewSampleMode,
} from "@/features/add-data/model";
import { BuildSpecShapeError, YamlSyntaxError, fromYamlText, toYamlText } from "@/features/build-spec/yamlText";
import { previewBuildDetailed } from "@/features/preview/api";
import { useBuildJob } from "@/features/runs/useBuildJob";
import { validateSpec } from "@/features/validation/api";
import { Button, Card, PageHeader, Stepper, type StepItem } from "@/shared/ui";

const STEPS: StepItem[] = [
  { id: "source", label: "소스" },
  { id: "configure", label: "설정" },
  { id: "preview", label: "미리보기·검증" },
  { id: "review", label: "검토·빌드" },
];

export function AddDataPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const job = useBuildJob();

  const [draft, setDraft] = useState<AddDataDraft>(INITIAL_DRAFT);
  const [step, setStep] = useState(0);
  const [catalog, setCatalog] = useState<CatalogState>({ status: "loading", providers: [] });
  const [providerTest, setProviderTest] = useState<ProviderTestState>({ status: "idle" });
  const [upload, setUpload] = useState<UploadState>({ status: "idle" });
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
  const [previewView, setPreviewView] = useState<"sample" | "diff">("sample");
  const [validation, setValidation] = useState<{ status: "idle" | "validating" | "validated"; valid: boolean; errors: string[] }>(
    { status: "idle", valid: false, errors: [] },
  );
  const [yamlEditError, setYamlEditError] = useState<string>();
  const [draftAvailable, setDraftAvailable] = useState(() => hasAddDataDraft());
  const [draftSaved, setDraftSaved] = useState(false);
  const [lastPreviewSignature, setLastPreviewSignature] = useState<string | null>(null);

  const preselectApplied = useRef(false);
  // 직전에 identity를 자동 반영한 "source 자체"의 key(#250 최종 검증 §1).
  // provider+dataset/URL identity/파일 등 source identity가 바뀌면(같은 source의 세부
  // 설정 변경이 아니라 다른 source로의 교체) touched 플래그를 reset하고 새 identity를
  // 강제로 적용한다 — query params/output/preview 같은 세부 설정 변경과 구분하기 위함.
  const lastIdentitySourceRef = useRef<string | null>(null);
  const previewRequestIdRef = useRef(0);

  const updateDraft = useCallback((patch: Partial<AddDataDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  // Source/설정이 preview 이후 바뀌면 stale로 취급한다(#250 §2, §6).
  const currentSignature = draftSignature(draft);
  const isStale = lastPreviewSignature !== null && lastPreviewSignature !== currentSignature;

  useEffect(() => {
    const controller = new AbortController();
    fetchCatalog(controller.signal)
      .then((response) => setCatalog({ status: "loaded", providers: response.providers }))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setCatalog({
          status: "error",
          providers: [],
          error: cause instanceof Error ? cause.message : "Builder catalog를 불러오지 못했습니다.",
        });
      });
    return () => controller.abort();
  }, []);

  // Discover preselection(#249 완료를 hard blocker로 두지 않는다 — 쿼리 파라미터만 읽는다).
  useEffect(() => {
    if (preselectApplied.current || catalog.status !== "loaded") return;
    const provider = searchParams.get("provider");
    const dataset = searchParams.get("dataset");
    if (!provider || !dataset) return;
    const found = catalog.providers.find((p) => p.name === provider)?.datasets.find((d) => d.name === dataset);
    preselectApplied.current = true;
    if (!found) return;
    setDraft((current) => ({
      ...current,
      sourceKind: "public_api",
      publicApi: { ...current.publicApi, provider, dataset },
    }));
    setStep(1);
  }, [catalog, searchParams]);

  // Public API: provider/dataset 선택이 바뀌면 catalog dataset 기준으로 dataset
  // identity(ID/제목/설명)를 자동 반영한다(#250 amendment 2). 사용자가 고급 설정에서
  // 이미 직접 고친 필드(*Touched)는 "같은 dataset"의 세부 설정(query params 등) 변경
  // 동안에는 유지한다 — 그러나 provider/dataset 자체가 바뀌면(다른 source로 교체)
  // touched를 reset하고 새 catalog dataset identity를 강제 적용한다(#250 최종 검증 §1).
  useEffect(() => {
    if (draft.sourceKind !== "public_api") return;
    const { provider, dataset } = draft.publicApi;
    if (!provider || !dataset) return;
    const catalogDataset = findDataset(catalog.providers, provider, dataset);
    if (!catalogDataset) return;
    const identity = identityFromCatalog(provider, catalogDataset);
    const sourceKey = `public_api:${provider}:${dataset}`;
    setDraft((current) => {
      if (current.sourceKind !== "public_api" || current.publicApi.provider !== provider || current.publicApi.dataset !== dataset) {
        return current;
      }
      const sourceChanged = lastIdentitySourceRef.current !== null && lastIdentitySourceRef.current !== sourceKey;
      lastIdentitySourceRef.current = sourceKey;
      if (sourceChanged) {
        return {
          ...current,
          datasetId: identity.datasetId,
          title: identity.title,
          description: identity.description,
          datasetIdTouched: false,
          titleTouched: false,
          descriptionTouched: false,
        };
      }
      const patch: Partial<AddDataDraft> = {};
      if (!current.datasetIdTouched && current.datasetId !== identity.datasetId) patch.datasetId = identity.datasetId;
      if (!current.titleTouched && current.title !== identity.title) patch.title = identity.title;
      if (!current.descriptionTouched && current.description !== identity.description) patch.description = identity.description;
      return Object.keys(patch).length > 0 ? { ...current, ...patch } : current;
    });
  }, [draft.sourceKind, draft.publicApi.provider, draft.publicApi.dataset, catalog.providers]);

  // URL: endpoint에서 안전한 hostname/path만으로 dataset identity를 자동 반영한다
  // (query string/credential은 identityFromUrl이 애초에 포함하지 않는다). identity의
  // 기반인 hostname+path 자체가 바뀌면(다른 endpoint로 교체) touched를 reset하고 새
  // identity를 강제 적용한다 — query string만 바뀌는 경우(같은 endpoint identity)는
  // touched 상태를 그대로 유지해 사용자가 고친 metadata를 지키지 않는다(#250 최종 검증 §1).
  useEffect(() => {
    if (draft.sourceKind !== "url" || !draft.url.endpoint) return;
    const identity = identityFromUrl(draft.url.endpoint);
    if (!identity.datasetId) return;
    // identity.datasetId는 hostname+path에서만 결정되므로(쿼리스트링 제외), 이 값 자체가
    // "같은 endpoint identity인지"를 판정하는 key로 그대로 쓸 수 있다.
    const sourceKey = `url:${identity.datasetId}`;
    setDraft((current) => {
      if (current.sourceKind !== "url" || current.url.endpoint !== draft.url.endpoint) return current;
      const sourceChanged = lastIdentitySourceRef.current !== null && lastIdentitySourceRef.current !== sourceKey;
      lastIdentitySourceRef.current = sourceKey;
      if (sourceChanged) {
        return {
          ...current,
          datasetId: identity.datasetId,
          title: identity.title,
          description: identity.description,
          datasetIdTouched: false,
          titleTouched: false,
          descriptionTouched: false,
        };
      }
      const patch: Partial<AddDataDraft> = {};
      if (!current.datasetIdTouched && current.datasetId !== identity.datasetId) patch.datasetId = identity.datasetId;
      if (!current.titleTouched && current.title !== identity.title) patch.title = identity.title;
      if (!current.descriptionTouched && current.description !== identity.description) patch.description = identity.description;
      return Object.keys(patch).length > 0 ? { ...current, ...patch } : current;
    });
  }, [draft.sourceKind, draft.url.endpoint]);

  // source kind 자체를 바꾸는 것은 "다른 source로 교체"의 가장 큰 단위다 — touched
  // 플래그와 자동 생성 identity 기반 필드를 reset해 이전 source의 metadata가 잔존하지
  // 않게 한다(#250 최종 검증 §1).
  function selectSource(kind: AddDataDraft["sourceKind"]) {
    setDraft((current) => {
      if (current.sourceKind === kind) return current;
      lastIdentitySourceRef.current = null;
      return {
        ...current,
        sourceKind: kind,
        datasetId: "",
        title: "",
        description: "",
        datasetIdTouched: false,
        titleTouched: false,
        descriptionTouched: false,
      };
    });
  }

  function goNext() {
    if (step === 0 && !draft.sourceKind) return;
    if (step === 1 && buildSpecFromDraft(draft).error) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleTestProvider() {
    setProviderTest({ status: "testing" });
    try {
      const result = await testProvider(draft.publicApi.provider);
      setProviderTest({ status: "tested", result });
    } catch (cause) {
      setProviderTest({
        status: "tested",
        error: cause instanceof Error ? cause.message : "연결 테스트에 실패했습니다.",
      });
    }
  }

  async function handleUploadFile(file: File) {
    if (!draft.file.format) return;
    setUpload({ status: "uploading" });
    try {
      const meta = await uploadSourceFile(file, draft.file.format);
      const identity = identityFromFilename(meta.original_filename ?? file.name);
      // 업로드는 항상 "파일을 (새로) 선택"하는 행위다 — 기존 파일을 다른 파일로
      // 교체하는 경우를 포함해 매번 touched를 reset하고 새 filename identity를 적용한다
      // (#250 최종 검증 §1: "File을 다른 파일로 교체: touched reset 후 새 filename identity 적용").
      lastIdentitySourceRef.current = `file:${meta.original_filename ?? file.name}`;
      setDraft((current) => ({
        ...current,
        file: {
          uploadId: meta.upload_id,
          format: meta.format,
          encoding: meta.encoding,
          filename: meta.original_filename,
          sizeBytes: meta.size_bytes,
        },
        datasetId: identity.datasetId,
        title: identity.title,
        description: identity.description,
        datasetIdTouched: false,
        titleTouched: false,
        descriptionTouched: false,
      }));
      setUpload({ status: "done" });
    } catch (cause) {
      setUpload({
        status: "error",
        error: cause instanceof Error ? cause.message : "파일 업로드에 실패했습니다.",
      });
    }
  }

  function handleApplyYaml(text: string) {
    try {
      const spec = fromYamlText(text);
      setDraft((current) => applyBuildSpecToDraft(current, spec));
      setYamlEditError(undefined);
    } catch (cause) {
      if (cause instanceof YamlSyntaxError) {
        setYamlEditError(`YAML 구문 오류: ${cause.message}`);
      } else if (cause instanceof BuildSpecShapeError) {
        setYamlEditError(cause.message);
      } else {
        setYamlEditError("YAML을 적용하지 못했습니다.");
      }
    }
  }

  async function runPreviewAndValidate() {
    const specResult = buildSpecFromDraft(draft);
    if (specResult.error || !specResult.spec) {
      setPreview({ status: "error", error: specResult.error ?? "빌드 스펙 오류" });
      setValidation({ status: "validated", valid: false, errors: [specResult.error ?? "빌드 스펙 오류"] });
      return;
    }
    const spec = specResult.spec;
    const signatureAtRequest = draftSignature(draft);
    const requestId = ++previewRequestIdRef.current;
    setPreview({ status: "loading" });
    setValidation({ status: "validating", valid: false, errors: [] });

    const [previewOutcome, validateOutcome] = await Promise.allSettled([
      previewBuildDetailed(spec, { limit: draft.previewLimit, sample_mode: draft.previewSampleMode }),
      validateSpec(spec),
    ]);

    if (requestId !== previewRequestIdRef.current) return;
    if (previewOutcome.status === "fulfilled") {
      setPreview({ status: "loaded", response: previewOutcome.value });
      setLastPreviewSignature(signatureAtRequest);
    } else {
      setPreview({
        status: "error",
        error: previewOutcome.reason instanceof Error ? previewOutcome.reason.message : "Preview 요청에 실패했습니다.",
      });
    }

    if (requestId !== previewRequestIdRef.current) return;
    if (validateOutcome.status === "fulfilled") {
      setValidation({ status: "validated", valid: validateOutcome.value.valid, errors: validateOutcome.value.errors });
    } else {
      setValidation({
        status: "validated",
        valid: false,
        errors: [validateOutcome.reason instanceof Error ? validateOutcome.reason.message : "검증 요청에 실패했습니다."],
      });
    }
  }

  function saveCurrentDraft() {
    saveAddDataDraft(draft);
    setDraftSaved(true);
  }

  function restoreDraft() {
    const saved = loadAddDataDraft();
    if (!saved) {
      clearAddDataDraft();
      setDraftAvailable(false);
      return;
    }
    setDraft(saved);
    setDraftAvailable(false);
  }

  function discardDraft() {
    clearAddDataDraft();
    setDraftAvailable(false);
  }

  const specResult = buildSpecFromDraft(draft);
  const previewSources = preview.status === "loaded" ? preview.response.previews : [];

  // Build 성공(실연동 모드는 항상 Builder가 반환한 실제 run_id, mock 모드는 기존 mock 경로
  // 그대로) 시 Builds/Runs로 이동한다. mock run id를 새로 만들지 않는다 — useBuildJob이
  // 이미 실제 run_id/mock-run 구분을 보장한다.
  useEffect(() => {
    if (job.status === "succeeded" && job.run) {
      clearAddDataDraft();
      navigate(`/builds/${encodeURIComponent(job.run.id)}`);
    }
  }, [job.status, job.run, navigate]);

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="Add Data"
        title="데이터 추가"
        description="Source 유형에 맞는 입력만 보여주고 Preview·Validation을 거쳐 Build를 시작합니다."
      />

      {draftAvailable ? (
        <Card variant="dashed" className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">저장된 초안이 있습니다. 이어서 편집할까요?</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={restoreDraft}>불러오기</Button>
            <Button size="sm" variant="ghost" onClick={discardDraft}>삭제</Button>
          </div>
        </Card>
      ) : null}

      <Card>
        <Stepper steps={STEPS} current={step} onStepClick={setStep} />
      </Card>

      <Card>
        {step === 0 ? <SourceStep selected={draft.sourceKind} onSelect={selectSource} /> : null}

        {step === 1 ? (
          <ConfigureStep
            draft={draft}
            updateDraft={updateDraft}
            catalog={catalog}
            providerTest={providerTest}
            onTestProvider={handleTestProvider}
            upload={upload}
            onUploadFile={handleUploadFile}
            specError={specResult.error}
            yamlText={specResult.spec ? toYamlText(specResult.spec) : ""}
            yamlEditError={yamlEditError}
            onApplyYaml={handleApplyYaml}
          />
        ) : null}

        {step === 2 ? (
          <PreviewValidationStep
            preview={preview}
            limit={draft.previewLimit}
            sampleMode={draft.previewSampleMode}
            columns={draft.previewColumns}
            onChangeLimit={(limit: PreviewLimit) => updateDraft({ previewLimit: limit })}
            onChangeSampleMode={(mode: PreviewSampleMode) => updateDraft({ previewSampleMode: mode })}
            onChangeColumns={(columns: PreviewColumnView) => updateDraft({ previewColumns: columns })}
            onRefresh={() => void runPreviewAndValidate()}
            view={previewView}
            onChangeView={setPreviewView}
          />
        ) : null}

        {step === 3 ? (
          <ReviewBuildStep
            draft={draft}
            spec={specResult.spec}
            specError={specResult.error}
            validation={validation}
            previewSources={previewSources}
            previewLimit={draft.previewLimit}
            previewSampleMode={draft.previewSampleMode}
            isStale={isStale}
            jobStatus={job.status}
            jobError={job.error}
            runId={job.run?.id}
            onBuild={() => {
              if (specResult.spec) void job.start(specResult.spec);
            }}
            onCancel={job.cancel}
          />
        ) : null}

        <div className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-8 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-6 py-3 backdrop-blur sm:static sm:mx-0 sm:mb-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none sm:dark:bg-transparent">
          <Button variant="ghost" onClick={goBack} disabled={step === 0}>이전</Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={saveCurrentDraft}>
              {draftSaved ? "저장됨 ✓" : "초안 저장"}
            </Button>
            {step < STEPS.length - 1 ? <Button onClick={goNext}>다음</Button> : null}
          </div>
        </div>
      </Card>
    </main>
  );
}
