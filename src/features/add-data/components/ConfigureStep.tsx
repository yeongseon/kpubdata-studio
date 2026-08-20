/**
 * Add Data 2단계 — Configure (#250).
 *
 * source kind에 맞는 입력만 보여준다(Public API/File/URL). Dataset ID/제목/설명은
 * `AddDataPage`가 provider/dataset 선택·파일 업로드·URL 입력으로부터 자동 생성해
 * draft에 반영하므로(`features/add-data/identity.ts`), 이 컴포넌트는 그 결과를
 * "선택한 Dataset 요약"으로 보여주기만 한다 — 필수 수동 입력 폼으로 다시 요구하지
 * 않는다(#250 amendment 2). 자동 생성값을 고치고 싶을 때만 "고급 설정 · Dataset
 * metadata" collapsible을 연다. Output은 기존처럼 kind와 무관하게 항상 함께 보여준다.
 */
import { useState } from "react";
import type { ProviderTestResponse } from "@/shared/lib/builderApi";
import { exportFormatSchema } from "@/shared/lib/schemas";
import { findDataset, findProvider } from "@/features/add-data/identity";
import type { AddDataDraft } from "@/features/add-data/model";
import type { SourceFormat } from "@/shared/lib/types";
import { Button, Card, FormField, Select, Textarea, TextInput } from "@/shared/ui";
import type { CatalogProvider } from "@/shared/lib/builderApi";

const EXPORT_FORMATS = exportFormatSchema.options;
const FILE_FORMATS: SourceFormat[] = ["csv", "json", "jsonl", "parquet"];
const URL_FORMATS = ["json", "jsonl", "csv"] as const;

export type CatalogState =
  | { status: "loading"; providers: readonly CatalogProvider[]; error?: undefined }
  | { status: "loaded"; providers: readonly CatalogProvider[]; error?: undefined }
  | { status: "error"; providers: readonly CatalogProvider[]; error: string };

export interface ProviderTestState {
  status: "idle" | "testing" | "tested";
  result?: ProviderTestResponse;
  error?: string;
}

export interface UploadState {
  status: "idle" | "uploading" | "done" | "error";
  error?: string;
}

export interface ConfigureStepProps {
  draft: AddDataDraft;
  updateDraft: (patch: Partial<AddDataDraft>) => void;
  catalog: CatalogState;
  providerTest: ProviderTestState;
  onTestProvider: () => void;
  upload: UploadState;
  onUploadFile: (file: File) => void;
  specError?: string;
  yamlText: string;
  yamlEditError?: string;
  onApplyYaml: (text: string) => void;
}

export function ConfigureStep({
  draft,
  updateDraft,
  catalog,
  providerTest,
  onTestProvider,
  upload,
  onUploadFile,
  specError,
  yamlText,
  yamlEditError,
  onApplyYaml,
}: ConfigureStepProps) {
  const [editorMode, setEditorMode] = useState<"form" | "yaml">("form");
  const [yamlDraft, setYamlDraft] = useState(yamlText);

  const selectedDataset = findDataset(catalog.providers, draft.publicApi.provider, draft.publicApi.dataset);

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold tracking-tight">설정 (Configure)</h3>

      {draft.sourceKind === "public_api" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="section-title text-sm font-semibold text-muted-foreground">제공자 연결</div>
            {catalog.status === "loading" ? (
              <p className="text-sm text-muted-foreground">Builder catalog를 불러오는 중입니다...</p>
            ) : null}
            {catalog.status === "error" ? (
              <p role="alert" className="text-sm text-red-700 dark:text-red-300">{catalog.error}</p>
            ) : null}
            {catalog.status === "loaded" && catalog.providers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Builder catalog에 등록된 provider가 없습니다.</p>
            ) : null}
            <FormField id="add-data-provider" label="제공자 (Provider)">
              {(field) => (
                <Select
                  {...field}
                  value={draft.publicApi.provider}
                  onChange={(e) =>
                    updateDraft({
                      publicApi: { ...draft.publicApi, provider: e.target.value, dataset: "" },
                    })
                  }
                >
                  <option value="">제공자 선택…</option>
                  {catalog.providers.map((p) => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField id="add-data-dataset" label="데이터셋 (Dataset)">
              {(field) => (
                <Select
                  {...field}
                  disabled={!draft.publicApi.provider}
                  value={draft.publicApi.dataset}
                  onChange={(e) => updateDraft({ publicApi: { ...draft.publicApi, dataset: e.target.value } })}
                >
                  <option value="">Dataset 선택…</option>
                  {findProvider(catalog.providers, draft.publicApi.provider)?.datasets.map((d) => (
                    <option key={d.name} value={d.name}>{d.title} ({d.name})</option>
                  ))}
                </Select>
              )}
            </FormField>
            {draft.publicApi.provider ? (
              <div className="flex items-center gap-3">
                <Button variant="secondary" size="sm" loading={providerTest.status === "testing"} onClick={onTestProvider}>
                  연결 테스트
                </Button>
                {providerTest.status === "tested" && providerTest.result?.status === "connected" ? (
                  <span className="text-sm text-accent-subtle-foreground">연결됨 ({providerTest.result.latency_ms}ms)</span>
                ) : null}
                {providerTest.status === "tested" && providerTest.result?.status === "not_configured" ? (
                  <span role="alert" className="text-sm text-amber-700 dark:text-amber-300">
                    이 provider는 자격 증명이 필요합니다. Provider 설정에서 연결하세요.
                  </span>
                ) : null}
                {providerTest.status === "tested" && providerTest.result?.status === "failed" ? (
                  <span role="alert" className="text-sm text-red-700 dark:text-red-300">연결 실패</span>
                ) : null}
                {providerTest.error ? <span role="alert" className="text-sm text-red-700 dark:text-red-300">{providerTest.error}</span> : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="section-title text-sm font-semibold text-muted-foreground">쿼리 · BuildSpec</div>
            {selectedDataset ? (
              <Card variant="dashed" className="p-3 text-sm text-muted-foreground">
                {selectedDataset.description ?? "설명 없음"}
                {selectedDataset.tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedDataset.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs">{tag}</span>
                    ))}
                  </div>
                ) : null}
              </Card>
            ) : null}
            <FormField id="add-data-params" label="요청 파라미터 (JSON)" help='예: {"region": "seoul"}'>
              {(field) => (
                <Textarea
                  {...field}
                  mono
                  rows={6}
                  value={draft.publicApi.sourceParams}
                  onChange={(e) => updateDraft({ publicApi: { ...draft.publicApi, sourceParams: e.target.value } })}
                />
              )}
            </FormField>
          </div>
        </div>
      ) : null}

      {draft.sourceKind === "file" ? (
        <div className="space-y-4">
          <div className="section-title text-sm font-semibold text-muted-foreground">파일 업로드</div>
          <FormField id="add-data-format" label="포맷 (Format)" required>
            {(field) => (
              <Select
                {...field}
                value={draft.file.format ?? ""}
                onChange={(e) => updateDraft({ file: { ...draft.file, format: (e.target.value || null) as SourceFormat | null } })}
              >
                <option value="">포맷 선택…</option>
                {FILE_FORMATS.map((f) => (
                  <option key={f} value={f}>{f.toUpperCase()}</option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField id="add-data-encoding" label="인코딩 (Encoding)">
            {(field) => (
              <TextInput
                {...field}
                value={draft.file.encoding}
                onChange={(e) => updateDraft({ file: { ...draft.file, encoding: e.target.value } })}
              />
            )}
          </FormField>
          <FormField id="add-data-file" label="파일" required>
            {(field) => (
              <input
                id={field.id}
                type="file"
                accept=".csv,.json,.jsonl,.parquet"
                disabled={!draft.file.format}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUploadFile(file);
                }}
                className="block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent-foreground"
              />
            )}
          </FormField>
          {!draft.file.format ? (
            <p className="text-xs text-muted-foreground">먼저 포맷을 선택해주세요.</p>
          ) : null}
          {upload.status === "uploading" ? <p className="text-sm text-muted-foreground">업로드 중입니다...</p> : null}
          {upload.status === "error" ? <p role="alert" className="text-sm text-red-700 dark:text-red-300">{upload.error}</p> : null}
          {upload.status === "done" && draft.file.uploadId ? (
            <p className="text-sm text-accent-subtle-foreground">
              업로드 완료: {draft.file.filename ?? draft.file.uploadId} ({draft.file.sizeBytes ?? 0} bytes)
            </p>
          ) : null}
        </div>
      ) : null}

      {draft.sourceKind === "url" ? (
        <div className="space-y-4">
          <div className="section-title text-sm font-semibold text-muted-foreground">URL / REST API</div>
          <FormField id="add-data-endpoint" label="Endpoint" required help="https:// GET만 지원합니다(P0).">
            {(field) => (
              <TextInput
                {...field}
                placeholder="https://api.example.org/data"
                value={draft.url.endpoint}
                onChange={(e) => updateDraft({ url: { ...draft.url, endpoint: e.target.value } })}
              />
            )}
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="add-data-method" label="메서드 (Method)">
              {(field) => <TextInput {...field} value="GET" readOnly disabled />}
            </FormField>
            <FormField id="add-data-auth" label="인증 (Auth)">
              {(field) => <TextInput {...field} value="없음 (Auth=None)" readOnly disabled />}
            </FormField>
          </div>
          <FormField id="add-data-url-format" label="포맷 (Format, 선택)" help="생략하면 응답 Content-Type로 추론합니다.">
            {(field) => (
              <Select
                {...field}
                value={draft.url.format ?? ""}
                onChange={(e) =>
                  updateDraft({ url: { ...draft.url, format: (e.target.value || null) as typeof draft.url.format } })
                }
              >
                <option value="">추론(생략)</option>
                {URL_FORMATS.map((f) => (
                  <option key={f} value={f}>{f.toUpperCase()}</option>
                ))}
              </Select>
            )}
          </FormField>
        </div>
      ) : null}

      <div className="space-y-3 border-t border-border pt-4">
        <div className="section-title text-sm font-semibold text-muted-foreground">선택한 Dataset 요약</div>
        {draft.datasetId || draft.title ? (
          <Card variant="dashed" className="space-y-1 p-3">
            <p className="text-sm font-semibold">{draft.title || "(제목 없음)"}</p>
            <p className="text-xs text-muted-foreground">ID: {draft.datasetId || "—"}</p>
            {draft.description ? <p className="text-xs text-muted-foreground">{draft.description}</p> : null}
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">
            {draft.sourceKind === "public_api"
              ? "Provider와 Dataset을 선택하면 Dataset ID/제목/설명이 자동으로 채워집니다."
              : draft.sourceKind === "file"
                ? "파일을 업로드하면 파일명에서 Dataset ID/제목이 자동으로 채워집니다."
                : "Endpoint를 입력하면 Dataset ID/제목이 자동으로 채워집니다."}
          </p>
        )}

        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            고급 설정 · Dataset metadata (자동 생성값 수정)
            <span className="text-base transition group-open:rotate-180" aria-hidden="true">⌄</span>
          </summary>
          <div className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="add-data-dataset-id" label="데이터셋 ID">
                {(field) => (
                  <TextInput
                    {...field}
                    value={draft.datasetId}
                    onChange={(e) => updateDraft({ datasetId: e.target.value, datasetIdTouched: true })}
                  />
                )}
              </FormField>
              <FormField id="add-data-title" label="제목">
                {(field) => (
                  <TextInput
                    {...field}
                    value={draft.title}
                    onChange={(e) => updateDraft({ title: e.target.value, titleTouched: true })}
                  />
                )}
              </FormField>
            </div>
            <FormField id="add-data-description" label="설명">
              {(field) => (
                <Textarea
                  {...field}
                  value={draft.description}
                  onChange={(e) => updateDraft({ description: e.target.value, descriptionTouched: true })}
                />
              )}
            </FormField>
          </div>
        </details>
      </div>

      <div className="space-y-4 border-t border-border pt-4">
        <div className="section-title text-sm font-semibold text-muted-foreground">Output</div>
        <fieldset>
          <legend className="text-sm font-medium text-foreground">결과물 형식 (최소 1개)</legend>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {EXPORT_FORMATS.map((format) => (
              <label key={format} className="flex items-center gap-3 rounded-xl border border-border bg-muted px-4 py-3">
                <input
                  type="checkbox"
                  checked={draft.exportFormats.includes(format)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...draft.exportFormats, format]
                      : draft.exportFormats.filter((f) => f !== format);
                    updateDraft({ exportFormats: next });
                  }}
                  className="h-4 w-4 accent-emerald-600"
                />
                <span className="text-sm font-medium capitalize">{format}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <FormField id="add-data-output-path" label="출력 경로 (선택)">
          {(field) => (
            <TextInput {...field} value={draft.outputPath} onChange={(e) => updateDraft({ outputPath: e.target.value })} />
          )}
        </FormField>
      </div>

      {specError ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">{specError}</p>
      ) : null}

      <details className="group border-t border-border pt-4">
        <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Canonical BuildSpec (GUI ↔ YAML)
          <span className="text-base transition group-open:rotate-180" aria-hidden="true">⌄</span>
        </summary>
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <Button
              variant={editorMode === "form" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setEditorMode("form")}
            >
              Form
            </Button>
            <Button
              variant={editorMode === "yaml" ? "primary" : "secondary"}
              size="sm"
              onClick={() => {
                setYamlDraft(yamlText);
                setEditorMode("yaml");
              }}
            >
              YAML
            </Button>
          </div>
          {editorMode === "form" ? (
            <pre className="overflow-x-auto rounded-xl bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">
              <code>{yamlText}</code>
            </pre>
          ) : (
            <div className="space-y-2">
              <Textarea mono rows={14} value={yamlDraft} onChange={(e) => setYamlDraft(e.target.value)} />
              {yamlEditError ? (
                <p role="alert" className="text-sm text-red-700 dark:text-red-300">{yamlEditError}</p>
              ) : null}
              <Button size="sm" onClick={() => onApplyYaml(yamlDraft)}>YAML 적용</Button>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
