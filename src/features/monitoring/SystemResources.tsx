/**
 * 시스템 리소스 모니터링 UI 컴포넌트 (#264).
 *
 * Builder API health, queue status, workers, artifact store 상태를 표시합니다.
 */
import type { SystemResource } from "../api/types";

interface SystemResourcesProps {
  data: SystemResource;
  lastUpdated: string;
}

export function SystemResources({ data, lastUpdated }: SystemResourcesProps) {
  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString("ko-KR");
  };

  const formatLatency = (ms: number | null) => {
    if (ms === null) return "데이터 없음";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case "healthy":
        return "text-green-600";
      case "degraded":
        return "text-yellow-600";
      case "unavailable":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getHealthBgColor = (health: string) => {
    switch (health) {
      case "healthy":
        return "bg-green-100 border-green-200";
      case "degraded":
        return "bg-yellow-100 border-yellow-200";
      case "unavailable":
        return "bg-red-100 border-red-200";
      default:
        return "bg-gray-100 border-gray-200";
    }
  };

  const getStoreStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "text-green-600";
      case "degraded":
        return "text-yellow-600";
      case "unavailable":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getProviderStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "text-green-600";
      case "degraded":
        return "text-yellow-600";
      case "unavailable":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      {/* API Health */}
      <div className={`p-4 rounded-lg border ${getHealthBgColor(data.health)}`}>
        <h3 className="text-lg font-semibold mb-2">Builder API 상태</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-600">Health:</span>
            <span className={`ml-2 font-medium ${getHealthColor(data.health)}`}>
              {data.health.toUpperCase()}
            </span>
          </div>
          <div>
            <span className="text-sm text-gray-600">P95 Latency:</span>
            <span className="ml-2 font-medium">
              {formatLatency(data.p95_latency)}
            </span>
          </div>
        </div>
      </div>

      {/* Queue Status */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-lg font-semibold mb-3">큐 상태</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{data.queue.queued}</div>
            <div className="text-sm text-gray-600">Queued</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{data.queue.running}</div>
            <div className="text-sm text-gray-600">Running</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{data.queue.total}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
        </div>
      </div>

      {/* Workers Status */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-lg font-semibold mb-3">워커 상태</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Active Workers:</span>
            <span className="font-medium">{data.workers.active} / {data.workers.capacity}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-blue-600 h-4 rounded-full transition-all"
              style={{ width: `${data.workers.utilization * 100}%` }}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Utilization:</span>
            <span className="font-medium">{formatPercentage(data.workers.utilization)}</span>
          </div>
        </div>
      </div>

      {/* Artifact Store Status */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-lg font-semibold mb-3">Artifact Store 상태</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Status:</span>
            <span className={`font-medium ${getStoreStatusColor(data.artifact_store.status)}`}>
              {data.artifact_store.status.toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Last Write:</span>
            <span className="font-medium">
              {data.artifact_store.last_write ? formatTime(data.artifact_store.last_write) : "데이터 없음"}
            </span>
          </div>
        </div>
      </div>

      {/* Provider Status */}
      {data.provider_status && Object.keys(data.provider_status).length > 0 && (
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-3">Provider 상태</h3>
          <div className="space-y-2">
            {Object.entries(data.provider_status).map(([provider, status]) => (
              <div key={provider} className="flex justify-between items-center">
                <span className="text-sm text-gray-600">{provider}:</span>
                <span className={`font-medium ${getProviderStatusColor(status)}`}>
                  {status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last Updated */}
      <div className="text-sm text-gray-500 text-center">
        마지막 업데이트: {formatTime(lastUpdated)}
      </div>
    </div>
  );
}