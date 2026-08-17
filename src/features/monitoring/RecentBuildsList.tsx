/**
 * 최근 빌드 목록 UI 컴포넌트 (#264).
 *
 * Build 상세 화면으로 네비게이션할 수 있는 최근 빌드 정보를 표시합니다.
 */
import type { RecentBuilds } from "../api/types";

interface RecentBuildsListProps {
  builds: RecentBuilds;
  isLoading: boolean;
  error: Error | null;
  onNavigateToBuild: (runId: string) => void;
  onRefresh: () => void;
}

export function RecentBuildsList({ builds, isLoading, error, onNavigateToBuild, onRefresh }: RecentBuildsListProps) {
  const formatTime = (isoString: string | null) => {
    if (!isoString) return "-";
    const date = new Date(isoString);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  };

  const getStatusBadge = (status: string) => {
    const baseClass = "px-2 py-1 rounded text-xs font-medium";
    switch (status) {
      case "ok":
        return `${baseClass} bg-green-100 text-green-800`;
      case "failed":
        return `${baseClass} bg-red-100 text-red-800`;
      case "cancelled":
        return `${baseClass} bg-yellow-100 text-yellow-800`;
      default:
        return `${baseClass} bg-gray-100 text-gray-800`;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "ok":
        return "성공";
      case "failed":
        return "실패";
      case "cancelled":
        return "취소";
      default:
        return status;
    }
  };

  if (isLoading && !builds) {
    return (
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex flex-col items-center py-8">
          <div className="text-red-600 mb-2">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-gray-600 mb-3">{error.message}</p>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!builds || builds.builds.length === 0) {
    return (
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex flex-col items-center py-8">
          <div className="text-gray-400 mb-2">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-sm text-gray-600">최근 빌드가 없습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold">최근 빌드</h3>
        <button
          onClick={onRefresh}
          className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
          disabled={isLoading}
        >
          {isLoading ? "로딩 중..." : "새로고침"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-medium text-gray-700">빌드 ID</th>
              <th className="text-left py-2 px-3 font-medium text-gray-700">데이터셋</th>
              <th className="text-center py-2 px-3 font-medium text-gray-700">상태</th>
              <th className="text-right py-2 px-3 font-medium text-gray-700">시작 시간</th>
              <th className="text-right py-2 px-3 font-medium text-gray-700">완료 시간</th>
              <th className="text-right py-2 px-3 font-medium text-gray-700">동작</th>
            </tr>
          </thead>
          <tbody>
            {builds.builds.map((build) => (
              <tr key={build.run_id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 px-3 text-gray-900 font-mono text-xs">
                  {build.run_id}
                </td>
                <td className="py-2 px-3 text-gray-900">
                  {build.dataset_id || "-"}
                </td>
                <td className="py-2 px-3 text-center">
                  <span className={getStatusBadge(build.status)}>
                    {getStatusText(build.status)}
                  </span>
                </td>
                <td className="py-2 px-3 text-right text-gray-600">
                  {formatTime(build.started_at)}
                </td>
                <td className="py-2 px-3 text-right text-gray-600">
                  {formatTime(build.finished_at)}
                </td>
                <td className="py-2 px-3 text-right">
                  <button
                    onClick={() => onNavigateToBuild(build.run_id)}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium transition-colors"
                  >
                    상세 보기
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}