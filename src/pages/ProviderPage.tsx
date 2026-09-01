/**
 * Provider 화면 (`/provider`) — Provider Connection·Credential + Settings 통합 (#259).
 *
 * Issue #259: Provider credential/connection 관리와 Settings를 통합한다.
 *
 * 진실성 원칙 (F01, builder ADR 0012):
 * - GET /providers 요약의 `configured`는 **effective provider configuration**
 *   (user credential > server default > 없음)이다. "이 사용자가 credential을 저장했다"가
 *   아니다.
 * - "이 사용자가 저장한 credential"의 유무/마스킹 값은 GET /providers/{provider}/credential
 *   메타데이터(`{ configured, masked, updated_at }`, raw secret 없음)로만 판정한다.
 * - requires_credential=false여도 요약 configured=true일 수 있다(무인증 provider).
 * - 세 축을 화면에서 분리한다: (1) provider 사용 가능 여부, (2) 사용자 저장 credential
 *   존재 여부, (3) 연결 테스트 결과.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  builderApi,
  isRealBuilderEnabled,
  type ProviderSummary,
  type ProviderTestResponse,
} from "@/shared/lib/builderApi";
import {
  Card,
  Button,
  LinkButton,
  PageHeader,
  EmptyState,
  Skeleton,
} from "@/shared/ui";

interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  /** 이 provider가 사용자 credential을 필요로 하는지(GET /providers). */
  requiresCredential: boolean;
  /**
   * GET /providers 요약의 `configured` — effective provider configuration
   * (user credential > server default > 없음). 사용자 저장 credential 유무가 아니다.
   */
  summaryConfigured: boolean;
  /** 연결 테스트 결과. `unknown` = 아직 점검하지 않음. */
  status: "connected" | "failed" | "not_configured" | "unknown";
  latency?: number;
  checkedAt?: string;
  errorCategory?: string;
}

interface CredentialForm {
  credential: string;
}

/**
 * 선택된 provider에 대한 "사용자 저장 credential" 메타데이터 상태.
 * `configured`는 GET /providers/{provider}/credential 응답 기준(사용자 본인 저장 여부).
 */
type CredentialMetaState =
  | { status: "idle" | "loading" }
  | { status: "not_applicable" }
  | { status: "error"; message: string }
  | {
      status: "loaded";
      configured: boolean;
      masked: string | null;
      updatedAt: string | null;
    };

/** Builder GET /providers 요약을 화면 모델로 변환한다(연결 상태는 별도 status 점검으로 채운다). */
function mapProviderSummary(summary: ProviderSummary): ProviderConfig {
  return {
    id: summary.provider,
    name: summary.provider,
    requiresCredential: summary.requires_credential,
    summaryConfigured: summary.configured,
    description: summary.requires_credential
      ? "자격 증명이 필요한 제공 기관입니다."
      : "자격 증명 없이 사용할 수 있는 제공 기관입니다.",
    status: "unknown",
  };
}

export function ProviderPage() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showCredentialForm, setShowCredentialForm] = useState(false);
  const [credentialForm, setCredentialForm] = useState<CredentialForm>({ credential: "" });
  const [credentialMeta, setCredentialMeta] = useState<CredentialMetaState>({ status: "idle" });
  const credentialRequestGeneration = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isRealBuilderEnabled()) {
        // real mode: GET /providers가 canonical source다. 실패를 mock 성공으로
        // 위장하지 않는다 — catch에서 명시적 error/빈 목록으로 떨어진다(#S01).
        const response = await builderApi.listProviders();
        const mapped = response.providers.map(mapProviderSummary);
        setProviders(mapped);
        setSelectedProvider((current) => {
          if (!current) return null;
          const next = mapped.find((p) => p.id === current.id);
          if (!next) return null;
          // 연결 테스트 결과는 목록 새로고침으로 잃지 않도록 보존한다.
          return {
            ...next,
            status: current.status,
            latency: current.latency,
            checkedAt: current.checkedAt,
            errorCategory: current.errorCategory,
          };
        });
      } else {
        // 명시적 mock/demo mode에서만 mock 목록을 쓴다.
        setProviders(getMockProviders());
      }
    } catch {
      setError("Provider 정보를 불러올 수 없습니다");
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  /**
   * 선택된 provider의 "사용자 저장 credential" 메타데이터를 authoritative하게 다시 읽는다.
   * requires_credential=false면 조회 자체를 하지 않는다(등록/삭제할 credential이 없음).
   */
  const loadCredentialMeta = useCallback(
    async (provider: ProviderConfig) => {
      const generation = ++credentialRequestGeneration.current;
      if (!provider.requiresCredential) {
        if (generation === credentialRequestGeneration.current) setCredentialMeta({ status: "not_applicable" });
        return;
      }
      setCredentialMeta({ status: "loading" });
      try {
        if (isRealBuilderEnabled()) {
          const meta = await builderApi.getProviderCredential(provider.id);
          if (generation !== credentialRequestGeneration.current) return;
          setCredentialMeta({
            status: "loaded",
            configured: meta.configured,
            masked: meta.masked,
            updatedAt: meta.updated_at,
          });
        } else {
          if (generation !== credentialRequestGeneration.current) return;
          setCredentialMeta(mockCredentialMeta(provider));
        }
      } catch {
        if (generation !== credentialRequestGeneration.current) return;
        setCredentialMeta({ status: "error", message: "자격 증명 상태를 불러오지 못했습니다" });
      }
    },
    [],
  );

  const handleProviderSelect = (provider: ProviderConfig) => {
    ++credentialRequestGeneration.current;
    setSelectedProvider(provider);
    setShowCredentialForm(false);
    setCredentialForm({ credential: "" });
    void loadCredentialMeta(provider);
  };

  /** status 점검/테스트 응답을 목록과 선택 상태에 반영한다. */
  const applyStatus = useCallback((res: ProviderTestResponse) => {
    const patch: Partial<ProviderConfig> = {
      status: res.status,
      latency: res.latency_ms,
      checkedAt: res.checked_at,
      errorCategory: res.error_category,
    };
    setProviders((list) => list.map((p) => (p.id === res.provider ? { ...p, ...patch } : p)));
    setSelectedProvider((current) =>
      current && current.id === res.provider ? { ...current, ...patch } : current,
    );
  }, []);

  const handleConnectionTest = async () => {
    if (!selectedProvider) return;
    const provider = selectedProvider.id;

    setIsTesting(true);
    setError(null);
    try {
      if (isRealBuilderEnabled()) {
        // 연결 테스트는 GET /providers/{provider}/status를 쓴다 — 임의 POST /test가 아니다(#S02).
        applyStatus(await builderApi.getProviderStatus(provider));
      } else {
        applyStatus({
          provider,
          status: "connected",
          configured: true,
          latency_ms: 42,
          checked_at: new Date().toISOString(),
        });
      }
    } catch {
      setError("연결 테스트에 실패했습니다");
    } finally {
      setIsTesting(false);
    }
  };

  const handleCredentialSubmit = async () => {
    if (!selectedProvider || !credentialForm.credential) return;
    if (!selectedProvider.requiresCredential) return;
    const provider = selectedProvider;
    setError(null);
    try {
      if (isRealBuilderEnabled()) {
        // PUT /providers/{provider}/credential, body는 { credential } 하나뿐. 원문은
        // response로 기대하지 않고, 선택된 provider의 canonical id를 URL에 쓴다(#S02).
        await builderApi.putProviderCredential(provider.id, credentialForm.credential);
      }
      setCredentialForm({ credential: "" });
      setShowCredentialForm(false);
      // 저장 후 metadata와 provider 요약을 다시 authoritative하게 갱신한다.
      await Promise.all([loadProviders(), loadCredentialMeta(provider)]);
    } catch {
      setError("Credential 저장에 실패했습니다");
    }
  };

  const handleCredentialDelete = async () => {
    if (!selectedProvider) return;
    const provider = selectedProvider;
    setError(null);
    try {
      if (isRealBuilderEnabled()) {
        await builderApi.deleteProviderCredential(provider.id);
      }
      // 삭제 후 metadata와 provider 요약을 다시 authoritative하게 갱신한다.
      await Promise.all([loadProviders(), loadCredentialMeta(provider)]);
    } catch {
      setError("Credential 삭제에 실패했습니다");
    }
  };

  const getStatusBadge = (status: ProviderConfig["status"]) => {
    const styles = {
      connected: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
      failed: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
      not_configured: "bg-muted text-muted-foreground",
      unknown: "bg-muted text-muted-foreground",
    };
    const labels = {
      connected: "연결됨",
      failed: "연결 실패",
      not_configured: "미설정",
      unknown: "연결 확인 필요",
    };
    return { className: styles[status], label: labels[status] };
  };

  // 사용자 본인이 저장한 credential이 있는지(삭제 버튼/마스킹 값 표시의 유일한 근거).
  const userCredentialConfigured =
    credentialMeta.status === "loaded" && credentialMeta.configured;
  const canRegisterCredential =
    !!selectedProvider &&
    selectedProvider.requiresCredential &&
    credentialMeta.status === "loaded";

  return (
    <main className="flex flex-1 flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="Provider"
        title="데이터 제공 기관 연결"
        description="공공데이터 제공 기관과 연결하고 자격 증명(credential)을 관리합니다."
        actions={<LinkButton to="/settings">설정으로 이동</LinkButton>}
      />

      {error && (
        <Card variant="error">
          <p className="font-semibold">{error}</p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-1">
          <PageHeader eyebrow="Providers" title="제공 기관" className="mb-4" />
          <Card className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="mt-1 h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : providers.length === 0 ? (
              <EmptyState
                title="등록된 Provider가 없습니다"
                description="데이터 제공 기관을 추가하고 연결하세요."
              />
            ) : (
              <ul>
                {providers.map((provider) => (
                  <li
                    key={provider.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition hover:bg-muted/50 ${
                      selectedProvider?.id === provider.id ? "bg-muted/50" : ""
                    }`}
                    onClick={() => handleProviderSelect(provider)}
                  >
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-lg font-semibold">
                      {provider.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{provider.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            getStatusBadge(provider.status).className
                          }`}
                        >
                          {getStatusBadge(provider.status).label}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <section className="lg:col-span-2">
          {!selectedProvider ? (
            <Card>
              <EmptyState
                title="Provider를 선택해주세요"
                description="왼쪽 목록에서 Provider를 선택하면 상세 정보를 볼 수 있습니다."
              />
            </Card>
          ) : (
            <div className="space-y-6">
              <Card>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{selectedProvider.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedProvider.description}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      getStatusBadge(selectedProvider.status).className
                    }`}
                  >
                    {getStatusBadge(selectedProvider.status).label}
                  </span>
                </div>

                {selectedProvider.status === "connected" && (
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">확인 시각</span>
                      <p className="font-medium">
                        {selectedProvider.checkedAt
                          ? new Date(selectedProvider.checkedAt).toLocaleString("ko-KR")
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">지연 시간</span>
                      <p className="font-medium">
                        {selectedProvider.latency
                          ? `${selectedProvider.latency}ms`
                          : "—"}
                      </p>
                    </div>
                  </div>
                )}

                {selectedProvider.status === "failed" && (
                  <div className="mt-4">
                    <span className="text-sm text-muted-foreground">에러 분류:</span>
                    <p className="mt-1 text-sm font-medium text-red-600 dark:text-red-400">
                      {selectedProvider.errorCategory || "알 수 없음"}
                    </p>
                  </div>
                )}

                <div className="mt-6">
                  <Button
                    variant="secondary"
                    onClick={handleConnectionTest}
                    disabled={isTesting}
                  >
                    {isTesting ? "테스트 중..." : "연결 테스트"}
                  </Button>
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">자격 증명 (Credential)</h4>
                  {userCredentialConfigured ? (
                    <Button size="sm" variant="danger" onClick={handleCredentialDelete}>
                      삭제
                    </Button>
                  ) : canRegisterCredential && !showCredentialForm ? (
                    <Button size="sm" onClick={() => setShowCredentialForm(true)}>
                      {selectedProvider.summaryConfigured ? "사용자 자격 증명 등록" : "등록하기"}
                    </Button>
                  ) : null}
                </div>

                {!selectedProvider.requiresCredential ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    이 제공 기관은 자격 증명 없이 사용할 수 있습니다. 등록하거나 삭제할
                    자격 증명이 없습니다.
                  </p>
                ) : credentialMeta.status === "loading" || credentialMeta.status === "idle" ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    자격 증명 상태를 불러오는 중…
                  </p>
                ) : credentialMeta.status === "error" ? (
                  <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                    {credentialMeta.message}
                  </p>
                ) : showCredentialForm ? (
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">API Key</label>
                      <input
                        type="password"
                        className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                        placeholder="API Key를 입력하세요"
                        value={credentialForm.credential}
                        onChange={(e) =>
                          setCredentialForm({ ...credentialForm, credential: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleCredentialSubmit}
                        disabled={!credentialForm.credential}
                      >
                        저장
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setShowCredentialForm(false);
                          setCredentialForm({ credential: "" });
                        }}
                      >
                        취소
                      </Button>
                    </div>
                  </div>
                ) : credentialMeta.status === "loaded" && credentialMeta.configured ? (
                  <div className="mt-4">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">저장된 API Key (마스킹):</span>{" "}
                      {credentialMeta.masked ?? "설정됨"}
                    </div>
                    {credentialMeta.updatedAt ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        마지막 업데이트:{" "}
                        {new Date(credentialMeta.updatedAt).toLocaleString("ko-KR")}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Builder가 마스킹한 값이며 원문은 표시되지 않습니다.
                    </p>
                  </div>
                ) : selectedProvider.summaryConfigured ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    이 제공 기관은 현재 Builder 기본 자격 증명으로 사용 중입니다. 별도
                    사용자 자격 증명을 등록하면 이 기관 호출에 우선 적용됩니다.
                  </p>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    이 제공 기관을 사용하려면 자격 증명을 등록해야 합니다.
                  </p>
                )}
              </Card>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/** mock/demo 모드에서 선택된 provider의 사용자 credential 상태를 시뮬레이션한다. */
function mockCredentialMeta(provider: ProviderConfig): CredentialMetaState {
  if (!provider.requiresCredential) return { status: "not_applicable" };
  const configured = provider.status === "connected";
  return {
    status: "loaded",
    configured,
    masked: configured ? "ab••••yz" : null,
    updatedAt: configured ? new Date(Date.now() - 3600000).toISOString() : null,
  };
}

function getMockProviders(): ProviderConfig[] {
  return [
    {
      id: "datago",
      name: "데이터고",
      description: "대한민국 대표 공공데이터 포털",
      requiresCredential: true,
      summaryConfigured: false,
      status: "not_configured",
    },
    {
      id: "kosis",
      name: "KOSIS",
      description: "한국 통계청 통계포털",
      requiresCredential: true,
      summaryConfigured: true,
      status: "connected",
      latency: 150,
      checkedAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "g2b",
      name: "G2B",
      description: "국가과학기술정보원",
      requiresCredential: true,
      summaryConfigured: false,
      status: "failed",
      errorCategory: "AUTH_ERROR",
      checkedAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ];
}
