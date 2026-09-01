/** 보호된 Studio route를 /login 단일 진입점으로 연결한다. */
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isDevAuthBypassEnabled } from "@/shared/config/env";
import { isRealBuilderEnabled } from "@/shared/lib/builderApi";
import { useAuthStore } from "./store";

export function LoginGate({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token);
  const oidcStatus = useAuthStore((state) => state.oidcStatus);
  const location = useLocation();

  if (!isRealBuilderEnabled() || isDevAuthBypassEnabled()) return <>{children}</>;
  if (oidcStatus === "authenticated" || (oidcStatus === "disabled" && token)) return <>{children}</>;

  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  return <Navigate to={`/login?${new URLSearchParams({ returnTo }).toString()}`} replace />;
}
