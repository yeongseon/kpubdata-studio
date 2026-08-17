/**
 * Monitoring 화면 (`/monitoring`) — 시스템 리소스와 빌드 통계 모니터링 (#264).
 *
 * Builder #516 시스템/집계 monitoring API를 사용하여 시스템 상태와 빌드 통계를 실시간으로 확인합니다.
 * 시스템 리소스와 빌드 통계 두 개의 탭을 제공하며, 최근 빌드 목록도 포함합니다.
 */
import { useMonitoringData, useRecentBuilds, MonitoringTab } from "@/features/monitoring/hooks";
import { SystemResources } from "@/features/monitoring/SystemResources";
import { BuildStatistics } from "@/features/monitoring/BuildStatistics";
import { RecentBuildsList } from "@/features/monitoring/RecentBuildsList";

export function MonitoringPage() {
  const {
    data,
    isLoading,
    error,
    availability,
    activeTab,
    setActiveTab,
    refreshData,
  } = useMonitoringData();

  const {
    builds,
    isLoading: buildsLoading,
    error: buildsError,
    navigateToBuild,
    refreshBuilds,
  } = useRecentBuilds();

  const formatAvailability = (avail: string) => {
    switch (avail) {
      case "available":
        return "데이터 이용 가능";
      case "partial":
        return "일부 데이터 이용 가능";
      case "unavailable":
        return "데이터 이용 불가";
      default:
        return avail;
    }
  };

  const getAvailabilityColor = (avail: string) => {
    switch (avail) {
      case "available":
        return "text-green-600";
      case "partial":
        return "text-yellow-600";
      case "unavailable":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">모니터링</h1>
        <p className="text-gray-600">시스템 리소스와 빌드 통계를 실시간으로 확인합니다.</p>
      </div>

      {/* 데이터 가용성 표시 */}
      <div className={`mb-4 p-3 rounded-lg border ${
        availability === "available"
          ? "bg-green-50 border-green-200"
          : availability === "partial"
          ? "bg-yellow-50 border-yellow-200"
          : "bg-red-50 border-red-200"
      }`}>
        <div className="flex justify-between items-center">
          <span className={`text-sm font-medium ${getAvailabilityColor(availability)}`}>
            {formatAvailability(availability)}
          </span>
          <button
            onClick={refreshData}
            className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
            disabled={isLoading}
          >
            {isLoading ? "로딩 중..." : "새로고침"}
          </button>
        </div>
      </div>

      {/* 에러 상태 */}
      {error && availability === "unavailable" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <div className="text-red-600 mr-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-red-900 mb-1">모니터링 데이터를 가져올 수 없습니다</h3>
              <p className="text-sm text-red-700">{error.message}</p>
              {error.message.includes("인증") && (
                <p className="text-sm text-red-700 mt-2">
                  로그인이 필요하거나 권한이 없습니다. 관리자에게 문의하세요.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 부분 데이터 상태 */}
      {availability === "partial" && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <div className="text-yellow-600 mr-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">일부 데이터만 표시됩니다</h3>
              <p className="text-sm text-yellow-700">
                서비스 일시적 장애로 인해 일부 데이터를 가져오지 못했습니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 로딩 상태 */}
      {isLoading && !data && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      )}

      {/* 메인 컨텐츠 */}
      {data && availability !== "unavailable" && (
        <>
          {/* 탭 네비게이션 */}
          <div className="mb-6 border-b border-gray-200">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab("system" as MonitoringTab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "system"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                시스템 리소스
              </button>
              <button
                onClick={() => setActiveTab("build" as MonitoringTab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "build"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                빌드 통계
              </button>
            </nav>
          </div>

          {/* 탭 컨텐츠 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 메인 탭 영역 */}
            <div className="lg:col-span-2">
              {activeTab === "system" && data.system ? (
                <SystemResources data={data.system} lastUpdated={data.last_updated} />
              ) : activeTab === "build" && data.build_stats ? (
                <BuildStatistics data={data.build_stats} />
              ) : (
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <div className="text-center py-8 text-gray-500">
                    데이터를 가져오는 중입니다...
                  </div>
                </div>
              )}
            </div>

            {/* 최근 빌드 사이드바 */}
            <div className="lg:col-span-1">
              <RecentBuildsList
                builds={builds}
                isLoading={buildsLoading}
                error={buildsError}
                onNavigateToBuild={navigateToBuild}
                onRefresh={refreshBuilds}
              />
            </div>
          </div>
        </>
      )}

      {/* 비고 */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="font-semibold text-sm text-gray-700 mb-2">참고사항</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• 데이터는 30초마다 자동으로 새로고침됩니다.</li>
          <li>• 페이지가 백그라운드로 전환되면 폴링이 중단됩니다.</li>
          <li>• p95 지연 시간은 최근 1시간 기준입니다.</li>
          <li>• 최근 빌드 목록에서 상세 보기를 클릭하면 빌드 상세 페이지로 이동합니다.</li>
          <li>• 데이터 가용성 상태에 따라 일부 정보가 표시되지 않을 수 있습니다.</li>
        </ul>
      </div>
    </div>
  );
}