import { glossary } from "@/shared/content/glossary";
import { QualityBadge } from "@/features/quality/QualityBadge";

export function StageLegend() {
  return (
    <div aria-label="데이터 단계 설명" className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {(["bronze", "silver", "gold"] as const).map((stage) => (
        <span key={stage}><strong className="capitalize text-foreground">{stage}</strong> · {glossary[stage]}</span>
      ))}
    </div>
  );
}

export function QualityLegend() {
  const items = [
    ["PASS", "평가한 규칙에서 문제가 발견되지 않음"],
    ["WARN", "결과는 존재하지만 확인이 필요한 품질 문제가 있음"],
    ["FAIL", "품질 규칙을 충족하지 못한 문제가 있음"],
    ["N/A", "평가값이 없거나 적용되지 않음. PASS가 아님"],
  ] as const;
  return (
    <div aria-label="Quality 상태 설명" className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {items.map(([status, copy]) => <span key={status} className="inline-flex items-center gap-1.5"><QualityBadge status={status} />{copy}</span>)}
      <span><strong className="text-foreground">UNAVAILABLE</strong> · Builder가 결과를 제공할 수 없는 상태. FAIL과 다름</span>
    </div>
  );
}
