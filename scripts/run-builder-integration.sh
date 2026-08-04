#!/bin/sh
# Builder HTTP E2E 통합 테스트 실행 스크립트 (#160).
#
# Builder Docker 컨테이너를 기동하고 readiness 확인 후 Vitest 통합 테스트를 실행한다.
# 테스트 성공·실패와 관계없이 cleanup을 수행하며, 실패 시 Builder 로그를 출력한다.
# Ctrl+C로 중단해도 cleanup이 수행된다.

set -eu

# 색상 출력
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 기본값
BUILDER_CONTEXT="${KPUBDATA_BUILDER_CONTEXT:-../kpubdata-builder}"
E2E_PORT="${KPUBDATA_BUILDER_E2E_PORT:-18000}"
COMPOSE_PROJECT_NAME="kpubdata-studio-e2e"
COMPOSE_FILE="docker-compose.integration.yml"

echo "=== Builder HTTP E2E 통합 테스트 ==="
echo "Builder context: ${BUILDER_CONTEXT}"
echo "E2E port: ${E2E_PORT}"
echo ""

# Docker 확인
if ! command -v docker >/dev/null 2>&1; then
    echo "${RED}Error: Docker가 설치되지 않았습니다.${NC}" >&2
    exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
    echo "${RED}Error: Docker Compose가 설치되지 않았습니다.${NC}" >&2
    exit 1
fi

# Builder context 확인
if [ ! -d "${BUILDER_CONTEXT}" ]; then
    echo "${RED}Error: Builder context 디렉터리가 존재하지 않습니다: ${BUILDER_CONTEXT}${NC}" >&2
    echo "KPUBDATA_BUILDER_CONTEXT 환경변수로 Builder 경로를 지정하세요." >&2
    exit 1
fi

if [ ! -f "${BUILDER_CONTEXT}/Dockerfile" ]; then
    echo "${RED}Error: Builder Dockerfile이 존재하지 않습니다: ${BUILDER_CONTEXT}/Dockerfile${NC}" >&2
    exit 1
fi

# trap 설정: 항상 cleanup 수행
cleanup() {
    EXIT_CODE=$?
    if [ ${EXIT_CODE} -ne 0 ]; then
        echo "${YELLOW}테스트 실패. Builder 로그를 출력합니다...${NC}"
        docker compose -f "${COMPOSE_FILE}" -p "${COMPOSE_PROJECT_NAME}" logs builder || true
    fi
    echo ""
    echo "=== Cleanup ==="
    docker compose -f "${COMPOSE_FILE}" -p "${COMPOSE_PROJECT_NAME}" down --remove-orphans -v
    echo "${GREEN}Cleanup 완료${NC}"
    exit ${EXIT_CODE}
}

trap cleanup EXIT INT TERM

# 기존 컨테이너 정리
echo "기존 컨테이너 정리 중..."
docker compose -f "${COMPOSE_FILE}" -p "${COMPOSE_PROJECT_NAME}" down --remove-orphans -v 2>/dev/null || true

# Builder 이미지 빌드 및 컨테이너 기동
echo "Builder 이미지 빌드 및 컨테이너 기동 중..."
docker compose -f "${COMPOSE_FILE}" -p "${COMPOSE_PROJECT_NAME}" up -d --build

# readiness polling (healthcheck 대신 curl로 직접 확인)
echo "Builder readiness 확인 중..."
MAX_WAIT=60
WAITED=0
READY=0

while [ ${WAITED} -lt ${MAX_WAIT} ]; do
    if curl -s -f "http://127.0.0.1:${E2E_PORT}/version" >/dev/null 2>&1; then
        READY=1
        break
    fi
    sleep 2
    WAITED=$((WAITED + 2))
    echo -n "."
done

echo ""

if [ ${READY} -eq 0 ]; then
    echo "${RED}Error: Builder가 ${MAX_WAIT}초 내에 준비되지 않았습니다.${NC}" >&2
    exit 1
fi

echo "${GREEN}Builder 준비 완료 (port ${E2E_PORT})${NC}"

# 환경변수 설정하여 Vitest 실행
echo ""
echo "=== Vitest 통합 테스트 실행 ==="
export VITE_BUILDER_API_URL="http://127.0.0.1:${E2E_PORT}"
export VITE_USE_REAL_BUILDER="true"

# npx를 사용하여 vitest 실행 (node_modules 없어도 동작하도록)
npx vitest run --config vitest.integration.config.ts

echo "${GREEN}=== 통합 테스트 완료 ===${NC}"
