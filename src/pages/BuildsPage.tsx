/**
 * 빌드 목록 페이지 (/builds).
 *
 * 전체 빌드 실행 이력을 표로 보여주고, 제목 검색과 시작 시각 정렬을 제공한다(제안 §5.6/§12).
 * 현재 목록은 mock이며 #29 Builder API 연동 시 실제 데이터로 교체된다.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { listBuilds } from "@/features/runs/api";
import type { BuildRun } from "@/shared/lib/types";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LinkButton,
  PageHeader,
  StatusBadge,
  TextInput,
} from "@/shared/ui";

interface BuildsState {
  status: "loading" | "loaded" | "error";
  runs?: BuildRun[];
  error?: string;
}

function formatTime(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString("ko-KR");
}

/** ISO 시작 시각을 timestamp로 정렬하기 위한 안전한 변환(파싱 실패 시 0). */
function startedAtMillis(iso: string): number {
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * 빌드 실행 목록 표(검색/정렬)와 새 빌드 진입점을 보여주는 페이지.
 *
 * @returns 빌드 목록 화면.
 */
export function BuildsPage() {
  const [state, setState] = useState<BuildsState>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);

  const load = useCallback(() => {
    let active = true;
    setState({ status: "loading" });
    listBuilds()
      .then((result) => {
        if (active) setState({ status: "loaded", runs: result });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setState({
          status: "error",
          error: cause instanceof Error ? cause.message : "빌드 목록을 불러오지 못했습니다.",
        });
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => load(), [load]);

  const runs = state.runs;
  const visible = useMemo(() => {
    if (!runs) return [];
    const filtered = runs.filter((run) =>
      run.spec.title.toLowerCase().includes(query.trim().toLowerCase()),
    );
    return [...filtered].sort((a, b) => {
      const diff = startedAtMillis(a.startedAt) - startedAtMillis(b.startedAt);
      return newestFirst ? -diff : diff;
    });
  }, [runs, query, newestFirst]);

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="빌드"
        title="빌드 목록"
        description="전체 빌드와 대기·실행·완료 상태의 실행 이력을 확인하세요."
        actions={<LinkButton to="/builds/new">새 빌드 만들기</LinkButton>}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="sm:max-w-xs sm:flex-1">
          <label htmlFor="build-search" className="sr-only">
            빌드 제목 검색
          </label>
          <TextInput
            id="build-search"
            placeholder="제목으로 검색…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Button variant="secondary" size="sm" onClick={() => setNewestFirst((prev) => !prev)}>
          시작 시각 {newestFirst ? "최신순 ↓" : "오래된순 ↑"}
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-[1.4fr_0.7fr_0.9fr_0.7fr] gap-4 border-b border-border px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span>빌드</span>
          <span>상태</span>
          <span>마지막 실행</span>
          <span>액션</span>
        </div>

        {state.status === "loading" ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            불러오는 중입니다…
          </div>
        ) : state.status === "error" ? (
          <ErrorState
            title="빌드 목록을 불러오지 못했습니다"
            message={state.error}
            onRetry={() => load()}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title={query ? "검색 결과가 없습니다" : "아직 생성된 빌드가 없습니다"}
            description={
              query
                ? "다른 검색어로 시도해보세요."
                : "첫 빌드를 만들면 여기에 상태와 실행 이력이 표시됩니다."
            }
            actionLabel="새 빌드 만들기"
            actionHref="/builds/new"
          />
        ) : (
          <ul>
            {visible.map((run) => (
              <li
                key={run.id}
                className="grid grid-cols-[1.4fr_0.7fr_0.9fr_0.7fr] items-center gap-4 border-b border-border px-6 py-3 text-sm last:border-0 "
              >
                <span className="font-medium">{run.spec.title}</span>
                <span>
                  <StatusBadge status={run.status} />
                </span>
                <span className="text-muted-foreground">{formatTime(run.startedAt)}</span>
                <span>
                  <LinkButton variant="secondary" size="sm" to={`/builds/${run.id}`}>
                    보기
                  </LinkButton>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
