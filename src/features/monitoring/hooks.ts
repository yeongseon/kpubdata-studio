/**
 * Monitoring 데이터 관리용 React hooks (#264).
 *
 * 시스템 리소스, 빌드 통계, 최근 빌드 데이터를 가져오고 상태를 관리합니다.
 * 폴링, 에러 처리, unavailable 상태 처리를 포함합니다.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  checkMonitoringAvailability,
  getMonitoringData,
  getRecentBuilds,
  type MonitoringAvailability,
  type MonitoringResponse,
  type RecentBuilds,
} from "./api";
import type { ApiError } from "@/shared/lib/builderApi";

/**
 * 폴링 인터벌 (ms) - 30초마다 업데이트
 */
const POLLING_INTERVAL_MS = 30_000;

/**
 * 탭 타입
 */
export type MonitoringTab = "system" | "build";

/**
 * Monitoring 데이터 상태를 관리하는 hook (#264).
 *
 * @returns Monitoring 데이터 및 관련 상태/메서드.
 */
export function useMonitoringData() {
  const [data, setData] = useState<MonitoringResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [availability, setAvailability] = useState<MonitoringAvailability>("available");
  const [activeTab, setActiveTab] = useState<MonitoringTab>("system");
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const isPageHidden = useRef(false);

  const fetchData = useCallback(async () => {
    // 페이지가 숨겨져 있으면 데이터 갱신 중단
    if (isPageHidden.current) {
      return;
    }

    setIsLoading(true);
    setError(null);

    // 이전 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      const [availabilityCheck, monitoringData] = await Promise.all([
        checkMonitoringAvailability(abortControllerRef.current.signal),
        getMonitoringData(abortControllerRef.current.signal),
      ]);

      setAvailability(availabilityCheck);
      setData(monitoringData);
      setIsLoading(false);
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.name === "AbortError") {
        return; // 취소된 경우 무시
      }
      
      // 401/403은 unavailable 상태로 처리
      if (apiError.status === 401 || apiError.status === 403) {
        setAvailability("unavailable");
        setError(new Error("인증이 필요하거나 권한이 없습니다."));
      } else if (apiError.status === 503) {
        setAvailability("partial");
        setError(new Error("서비스 일시적 장애가 있습니다."));
      } else {
        setError(apiError);
        setAvailability("unavailable");
      }
      setIsLoading(false);
    }
  }, []);

  // 페이지 가시성 감지 및 폴링 관리
  useEffect(() => {
    const handleVisibilityChange = () => {
      isPageHidden.current = document.hidden;
      
      // 페이지가 다시 보이면 즉시 데이터 갱신
      if (!document.hidden && data) {
        fetchData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 초기 데이터 로드
    fetchData();

    // 폴링 설정
    pollingIntervalRef.current = window.setInterval(() => {
      if (!document.hidden) {
        fetchData();
      }
    }, POLLING_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData, data]);

  const refreshData = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    availability,
    activeTab,
    setActiveTab,
    refreshData,
  };
}

/**
 * 최근 빌드 목록을 관리하는 hook (#264).
 *
 * @returns 최근 빌드 데이터 및 관련 상태/메서드.
 */
export function useRecentBuilds(limit = 10) {
  const [builds, setBuilds] = useState<RecentBuilds | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const navigate = useNavigate();

  const fetchBuilds = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const abortController = new AbortController();

    try {
      const data = await getRecentBuilds(limit, abortController.signal);
      setBuilds(data);
      setIsLoading(false);
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.name !== "AbortError") {
        setError(apiError);
      }
      setIsLoading(false);
    }

    return () => abortController.abort();
  }, [limit]);

  useEffect(() => {
    const cleanup = fetchBuilds();
    return () => {
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, [fetchBuilds]);

  const navigateToBuild = useCallback((runId: string) => {
    navigate(`/builds/${runId}`);
  }, [navigate]);

  return {
    builds,
    isLoading,
    error,
    navigateToBuild,
    refreshBuilds: fetchBuilds,
  };
}