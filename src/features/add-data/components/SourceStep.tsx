/**
 * Add Data 1단계 — Source 선택 (#250).
 *
 * Prototype(`kpubdata_ui_prototype_v1.html`의 `addData()`/`source-card`)의 3-카드
 * 레이아웃을 그대로 따른다: Public API / File Upload / URL·REST API.
 */
import type { SourceKind } from "@/shared/lib/types";
import { Card } from "@/shared/ui";

interface SourceOption {
  kind: SourceKind;
  title: string;
  description: string;
}

const SOURCE_OPTIONS: SourceOption[] = [
  { kind: "public_api", title: "Public API", description: "Provider를 선택하고 인증·조회조건을 설정합니다." },
  { kind: "file", title: "File Upload", description: "CSV/JSON/JSONL/Parquet 파일을 업로드합니다." },
  { kind: "url", title: "URL / REST API", description: "HTTPS GET endpoint를 직접 입력합니다(P0: Auth 없음)." },
];

export interface SourceStepProps {
  selected: SourceKind | null;
  onSelect: (kind: SourceKind) => void;
}

export function SourceStep({ selected, onSelect }: SourceStepProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold tracking-tight">데이터 선택</h3>
      <p className="text-sm text-muted-foreground">
        데이터를 어디서 가져올지 선택하세요. 이후 단계는 선택한 source에 맞는 입력만 보여줍니다.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {SOURCE_OPTIONS.map((option) => (
          <button
            key={option.kind}
            type="button"
            onClick={() => onSelect(option.kind)}
            aria-pressed={selected === option.kind}
            className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
          >
            <Card
              variant={selected === option.kind ? "success" : "default"}
              className="h-full transition hover:border-accent/50 hover:shadow-md"
            >
              <p className="text-base font-semibold tracking-tight">{option.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
