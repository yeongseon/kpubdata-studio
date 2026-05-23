/**
 * Studio가 Builder 백엔드와 통신할 때 사용할 기본 API 엔드포인트를 정의한다.
 *
 * 환경 변수가 있으면 배포 환경 값을 우선 사용하고, 없으면 로컬 개발 기본값으로 폴백한다.
 */
export const API_BASE =
  import.meta.env.VITE_BUILDER_API_URL ?? "http://localhost:8000";
