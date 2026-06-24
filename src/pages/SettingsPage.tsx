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
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
          Builder API 엔드포인트
        </p>
        <div className="mt-4 rounded-[1.5rem] border border-dashed border-zinc-300/80 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/80">
          <p className="text-sm font-medium">현재 base URL</p>
          <code className="mt-3 block break-all text-sm text-emerald-700 dark:text-emerald-400">
            {API_BASE}
          </code>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
            연결 상태
          </p>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Studio 계약 버전 {API_CONTRACT_VERSION}
          </span>
        </div>
        <div className="mt-4 text-sm">
          {!realEnabled ? (
            <p className="text-zinc-600 dark:text-zinc-300">
              mock 모드입니다. 실제 Builder에 연결하려면{" "}
              <code className="text-emerald-700 dark:text-emerald-400">VITE_USE_REAL_BUILDER=true</code>
              로 설정하세요.
            </p>
          ) : connection.status === "checking" ? (
            <p className="text-zinc-600 dark:text-zinc-300">Builder 연결을 확인하는 중입니다…</p>
          ) : connection.status === "ok" ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status="succeeded" />
                <span className="text-zinc-700 dark:text-zinc-200">
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
    </main>
  );
}
