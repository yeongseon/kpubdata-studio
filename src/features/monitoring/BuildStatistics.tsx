/**
 * 빌드 통계 UI 컴포넌트 (#264).
 *
 * 시간대별 build 수와 상태별 카운트를 표시합니다.
 */
import type { BuildStats } from "../api/types";

interface BuildStatsProps {
  data: BuildStats;
}

export function BuildStatistics({ data }: BuildStatsProps) {
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  };

  const formatPercentage = (value: number, total: number) => {
    if (total === 0) return "0.0%";
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* 요약 통계 */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-lg font-semibold mb-3">빌드 통계 요약</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{data.summary.total_count}</div>
            <div className="text-sm text-gray-600">전체</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{data.summary.success_count}</div>
            <div className="text-sm text-gray-600">성공</div>
            <div className="text-xs text-gray-500">
              {formatPercentage(data.summary.success_count, data.summary.total_count)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600">{data.summary.fail_count}</div>
            <div className="text-sm text-gray-600">실패</div>
            <div className="text-xs text-gray-500">
              {formatPercentage(data.summary.fail_count, data.summary.total_count)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600">{data.summary.cancelled_count}</div>
            <div className="text-sm text-gray-600">취소</div>
            <div className="text-xs text-gray-500">
              {formatPercentage(data.summary.cancelled_count, data.summary.total_count)}
            </div>
          </div>
        </div>
      </div>

      {/* 시간대별 통계 */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-lg font-semibold mb-3">시간대별 빌드 통계</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-700">시간</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">전체</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">성공</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">실패</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">취소</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700">성공률</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3 text-gray-900">{formatTime(entry.timestamp)}</td>
                  <td className="py-2 px-3 text-right text-gray-900">{entry.total_count}</td>
                  <td className="py-2 px-3 text-right text-green-600">{entry.success_count}</td>
                  <td className="py-2 px-3 text-right text-red-600">{entry.fail_count}</td>
                  <td className="py-2 px-3 text-right text-yellow-600">{entry.cancelled_count}</td>
                  <td className="py-2 px-3 text-gray-700">
                    {entry.total_count > 0 ? (
                      <div className="flex items-center">
                        <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-green-600 h-2 rounded-full"
                            style={{
                              width: `${(entry.success_count / entry.total_count) * 100}%`
                            }}
                          />
                        </div>
                        <span className="text-xs">
                          {formatPercentage(entry.success_count, entry.total_count)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}