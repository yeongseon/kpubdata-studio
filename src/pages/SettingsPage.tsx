/**
 * Studio 환경 설정 페이지 (/settings).
 *
 * 환경 변수로 주입된 Builder API 엔드포인트를 노출하고, 실제 연동 모드일 때는 Builder
 * `/version`을 호출해 계약 버전 호환성을 점검한다(#29).
 */
import { useEffect, useState } from "react";
import { API_BASE } from "@/shared/config/env";
import {
  API_CONTRACT_VERSION,
  ApiError,
  builderApi,
  isRealBuilderEnabled,
} from "@/shared/lib/builderApi";
import { useAuthStore } from "@/features/auth/store";
import { Card, PageHeader, StatusBadge } from "@/shared/ui";

interface ConnectionState {
  status: "idle" | "checking" | "ok" | "error";
  apiVersion?: string;
  error?: string;
}

/**
 * 환경 기반 설정 값과 Builder 연결 상태를 보여주는 페이지 컴포넌트.
 *
 * @returns 설정 화면.
 */
export function SettingsPage() {
  const realEnabled = isRealBuilderEnabled();
  const { email, clear } = useAuthStore();
  const [connection, setConnection] = useState<ConnectionState>({ status: "idle" });

  useEffect(() => {
    if (!realEnabled) return;
    const controller = new AbortController();
    setConnection({ status: "checking" });
    builderApi
      .version(controller.signal)
      .then((info) => setConnection({ status: "ok", apiVersion: info.api_version }))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setConnection({
          status: "error",
          error: cause instanceof ApiError ? cause.message : "연결 확인에 실패했습니다.",
        });
      });
    return () => controller.abort();
  }, [realEnabled]);

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="설정"
        title="환경 설정"
        description="Builder API 엔드포인트와 연결 상태를 확인합니다. 실제 저장 기능은 이후 연동됩니다."
      />

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Builder API 엔드포인트
        </p>
        <div className="mt-4 rounded-xl border border-dashed border-border bg-muted p-4">
          <p className="text-sm font-medium">현재 base URL</p>
          <code className="mt-3 block break-all text-sm text-accent-subtle-foreground">
            {API_BASE}
          </code>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            연결 상태
          </p>
          <span className="text-xs text-muted-foreground">
            Studio 계약 버전 {API_CONTRACT_VERSION}
          </span>
        </div>
        <div className="mt-4 text-sm">
          {!realEnabled ? (
            <p className="text-muted-foreground">
              mock 모드입니다. 실제 Builder에 연결하려면{" "}
              <code className="text-accent-subtle-foreground">VITE_USE_REAL_BUILDER=true</code>
              로 설정하세요.
            </p>
          ) : connection.status === "checking" ? (
            <p className="text-muted-foreground">Builder 연결을 확인하는 중입니다…</p>
          ) : connection.status === "ok" ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status="succeeded" />
                <span className="text-foreground">
                  Builder API 버전 {connection.apiVersion}
                </span>
              </div>
              {connection.apiVersion !== API_CONTRACT_VERSION ? (
                <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">
                  계약 버전 불일치 주의: Builder {connection.apiVersion} ≠ Studio{" "}
                  {API_CONTRACT_VERSION}. 일부 응답 형태가 호환되지 않을 수 있습니다.
                </p>
              ) : null}
            </div>
          ) : connection.status === "error" ? (
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status="failed" />
              <span className="text-red-700 dark:text-red-300">{connection.error}</span>
            </div>
          ) : null}
        </div>
      </Card>

      {realEnabled && (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            로그인 상태
          </p>
          <div className="mt-4 text-sm">
            {email ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-foreground">{email}</span>
                <button
                  type="button"
                  onClick={() => clear()}
                  className="rounded-lg border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <p className="text-muted-foreground">
                로그인되지 않았습니다. 실연동 모드에서는 Builder 호출을 위해 Google 로그인이 필요합니다.
              </p>
            )}
          </div>
        </Card>
      )}

      <Card variant="dashed">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          프라이버시 고지
        </p>
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          <p>
            어시스턴트 기능을 사용하면 대화 내용이 사용자가 설정한 외부 LLM 제공자(OpenAI 등)로
            전송됩니다. API 키와 비용은 사용자 부담입니다.
          </p>
          <p className="text-amber-700 dark:text-amber-400">
            공용 API 키를 VITE_* 환경변수로 주입하지 마세요 — 번들에 평문으로 포함됩니다.
          </p>
          <p>
            시크릿 스크러빙(#206)이 sourceParams의 서비스 키를 자동 마스킹하지만,
            대화에 직접 입력하는 민감 정보는 마스킹되지 않습니다.
          </p>
        </div>
      </Card>
    </main>
  );
}
