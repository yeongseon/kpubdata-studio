/**
 * USER_CONTENT 블록 추가/편집 폼 (#258 §10).
 *
 * Builder evidence 블록과 섞이지 않도록 항상 별도 블록으로만 저장한다. 여기서 입력한
 * 원문은 저장 시 그대로 markdown으로 보관되고, 렌더링은 항상 `markdown.ts`의 안전
 * 렌더러를 거친다(에디터 자체는 plain textarea이므로 입력 단계에서 스크립트가 실행될
 * 여지가 없다).
 */
import { useState } from "react";
import { Button, Textarea, TextInput } from "@/shared/ui";

export function UserContentEditor({
  initialHeading = "",
  initialMarkdown = "",
  onSave,
  onCancel,
}: {
  initialHeading?: string;
  initialMarkdown?: string;
  onSave: (heading: string, markdown: string) => void;
  onCancel: () => void;
}) {
  const [heading, setHeading] = useState(initialHeading);
  const [markdown, setMarkdown] = useState(initialMarkdown);

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground" htmlFor="user-block-heading">
          제목
        </label>
        <TextInput
          id="user-block-heading"
          value={heading}
          onChange={(e) => setHeading(e.target.value)}
          placeholder="예: 활용 아이디어"
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground" htmlFor="user-block-markdown">
          내용(Markdown)
        </label>
        <Textarea
          id="user-block-markdown"
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          rows={6}
          placeholder="자유롭게 서술하세요. **굵게**, - 목록, [링크](https://...) 를 지원합니다."
          className="mt-1"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          취소
        </Button>
        <Button
          onClick={() => onSave(heading.trim() || "제목 없음", markdown)}
          disabled={markdown.trim().length === 0}
        >
          저장
        </Button>
      </div>
    </div>
  );
}
