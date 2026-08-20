/**
 * Provider 화면 (`/provider`) — Provider Connection·Credential + Settings 통합 (#259).
 *
 * Issue #259: Provider credential/connection 관리와 Settings를 통합한다.
 *
 * P0 범위:
 * - provider selector/detail
 * - masked credential 등록/변경/삭제
 * - connection test loading/double-click 방지
 * - connected/failed/not_configured + latency/checked_at/error category
 * - raw secret DOM/error/log 비노출
 */
import { useEffect, useState } from "react";
import {
  Card,
  Button,
  PageHeader,
  EmptyState,
  Skeleton,
} from "@/shared/ui";

interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  status: "connected" | "failed" | "not_configured";
  latency?: number;
  checkedAt?: string;
  errorCategory?: string;
}

interface CredentialForm {
  providerId: string;
  credential: string;
}

export function ProviderPage() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showCredentialForm, setShowCredentialForm] = useState(false);
  const [credentialForm, setCredentialForm] = useState<CredentialForm>({
    providerId: "",
    credential: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/providers");
      if (!response.ok) {
        throw new Error("Failed to load providers");
      }
      const data = await response.json();
      setProviders(data.providers || []);
    } catch (err) {
      setError("Provider 정보를 불러올 수 없습니다");
      setProviders(getMockProviders());
    } finally {
      setLoading(false);
    }
  };

  const handleProviderSelect = (provider: ProviderConfig) => {
    setSelectedProvider(provider);
    setShowCredentialForm(false);
  };

  const handleConnectionTest = async () => {
    if (!selectedProvider) return;

    setIsTesting(true);
    try {
      const response = await fetch(`/api/providers/${selectedProvider.id}/test`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Connection test failed");
      }
      await loadProviders();
    } catch (err) {
      setError("연결 테스트에 실패했습니다");
    } finally {
      setIsTesting(false);
    }
  };

  const handleCredentialSubmit = async () => {
    try {
      const response = await fetch(`/api/providers/${credentialForm.providerId}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential: credentialForm.credential,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to save credential");
      }
      await loadProviders();
      setCredentialForm({ providerId: "", credential: "" });
      setShowCredentialForm(false);
    } catch (err) {
      setError("Credential 저장에 실패했습니다");
    }
  };

  const handleCredentialDelete = async () => {
    if (!selectedProvider) return;

    try {
      const response = await fetch(`/api/providers/${selectedProvider.id}/credentials`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete credential");
      }
      await loadProviders();
    } catch (err) {
      setError("Credential 삭제에 실패했습니다");
    }
  };

  const maskCredential = (credential: string): string => {
    if (!credential) return "";
    if (credential.length <= 4) return "****";
    return credential.substring(0, 2) + "****" + credential.substring(credential.length - 2);
  };

  const getStatusBadge = (status: ProviderConfig["status"]) => {
    const styles = {
      connected: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
      failed: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
      not_configured: "bg-muted text-muted-foreground",
    };
    const labels = {
      connected: "연결됨",
      failed: "연결 실패",
      not_configured: "미설정",
    };
    return { className: styles[status], label: labels[status] };
  };

  return (
    <main className="flex flex-1 flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="Provider"
        title="데이터 제공 기관 연결"
        description="공공데이터 제공 기관과 연결하고 자격 증명(credential)을 관리합니다."
        actions={
          <Button variant="primary" asChild>
            <a href="/settings">설정으로 이동</a>
          </Button>
        }
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
                    className={`inline-flex items-center rounded-full px-2. py-0.5 text-xs font-medium ${
                      getStatusBadge(selectedProvider.status).className
                    }`}
                  >
                    {getStatusBadge(selectedProvider.status).label}
                  </span>
                </div>

                {selectedProvider.status === "connected" && (
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">지연 시각</span>
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
                  {selectedProvider.status === "not_configured" && (
                    <Button
                      size="sm"
                      onClick={() => setShowCredentialForm(true)}
                    >
                      등록하기
                    </Button>
                  )}
                  {selectedProvider.status !== "not_configured" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleCredentialDelete}
                    >
                      삭제
                    </Button>
                  )}
                </div>

                {showCredentialForm ? (
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        API Key
                      </label>
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
                        onClick={() => setShowCredentialForm(false)}
                      >
                        취소
                      </Button>
                    </div>
                  </div>
                ) : selectedProvider.status === "not_configured" ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    이 Provider를 사용하려면 자격 증명을 등록해야 합니다.
                  </p>
                ) : (
                  <div className="mt-4">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">마스킹된 API Key:</span>{" "}
                      {maskCredential("••••••••••••••••")}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      보안상 원문 표시되지 않습니다.
                    </p>
                  </div>
                )}
              </Card>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function getMockProviders(): ProviderConfig[] {
  return [
    {
      id: "datago",
      name: "데이터고",
      description: "대한민국 대표 공공데이터 포털",
      status: "not_configured",
    },
    {
      id: "kosis",
      name: "KOSIS",
      description: "한국 통계청 통계포털",
      status: "connected",
      latency: 150,
      checkedAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "g2b",
      name: "G2B",
      description: "국가과학기술정보원",
      status: "failed",
      errorCategory: "AUTH_ERROR",
      checkedAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ];
}