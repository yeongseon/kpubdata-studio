/**
 * 최소 안전 Markdown 파서/렌더러 (#258).
 *
 * Kubi 응답과 사용자 입력은 untrusted input으로 취급한다(#258 §13). 이 저장소에는 markdown
 * 렌더링/HTML sanitize 라이브러리가 없고(package.json 확인 완료), 이슈 지침상 새 대형
 * dependency를 들이기 전에 기존 코드를 재사용해야 하므로, 대신 아주 작은 subset(GFM의 일부)만
 * 지원하는 파서를 직접 둔다 — 지원하지 않는 문법은 그냥 이스케이프된 텍스트로 남는다.
 *
 * 안전성의 핵심 불변식: `<script>`/`javascript:`/on* 이벤트 속성 등 임의 HTML을 절대
 * 생성하지 않는다.
 * - React 렌더러(`renderMarkdownToReact`)는 `dangerouslySetInnerHTML`을 전혀 쓰지 않고
 *   React 엘리먼트만 만든다(React가 텍스트 노드를 자동 이스케이프).
 * - HTML 문자열 렌더러(`renderMarkdownToHtml`, 내보내기용)는 원문을 절대 그대로 넣지 않고
 *   `escapeHtml`을 통과한 텍스트만 우리가 만든 태그 사이에 넣는다.
 * - 링크는 `http(s)://`로 시작하는 href만 허용하고, 새 창으로 열 때 `rel="noopener
 *   noreferrer"`를 강제한다(#258 §13).
 */
import { Fragment, createElement, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// 블록 파싱
// ---------------------------------------------------------------------------

type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "blockquote"; text: string }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "hr" };

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isTableSeparatorRow(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell));
}

/** 텍스트를 blank-line 단위 블록으로 나눈 뒤 각 블록을 분류한다. 알 수 없는 형태는 문단으로 취급한다. */
function parseBlocks(markdown: string): Block[] {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const chunks = normalized.split(/\n{2,}/).map((chunk) => chunk.trim()).filter(Boolean);
  const blocks: Block[] = [];

  for (const chunk of chunks) {
    const lines = chunk.split("\n");

    if (/^-{3,}$/.test(chunk.trim())) {
      blocks.push({ type: "hr" });
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.*)$/.exec(lines[0]);
    if (headingMatch && lines.length === 1) {
      blocks.push({ type: "heading", level: headingMatch[1].length as 1 | 2 | 3, text: headingMatch[2].trim() });
      continue;
    }

    if (lines.length >= 2 && lines[0].includes("|") && isTableSeparatorRow(lines[1])) {
      const header = splitTableRow(lines[0]);
      const rows = lines.slice(2).filter((line) => line.includes("|")).map(splitTableRow);
      blocks.push({ type: "table", header, rows });
      continue;
    }

    if (lines.every((line) => /^\s*([-*])\s+/.test(line))) {
      blocks.push({ type: "list", ordered: false, items: lines.map((line) => line.replace(/^\s*[-*]\s+/, "")) });
      continue;
    }

    if (lines.every((line) => /^\s*\d+\.\s+/.test(line))) {
      blocks.push({ type: "list", ordered: true, items: lines.map((line) => line.replace(/^\s*\d+\.\s+/, "")) });
      continue;
    }

    if (lines.every((line) => /^>\s?/.test(line))) {
      blocks.push({ type: "blockquote", text: lines.map((line) => line.replace(/^>\s?/, "")).join(" ") });
      continue;
    }

    blocks.push({ type: "paragraph", text: lines.join(" ") });
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// 인라인 토큰(굵게/기울임/코드/링크)
// ---------------------------------------------------------------------------

type InlineToken =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string };

/** `http://`/`https://`로 시작하는 href만 안전하다고 판단한다. `javascript:` 등은 전부 거부. */
export function isSafeHref(href: string): boolean {
  return /^https?:\/\//i.test(href.trim());
}

const INLINE_PATTERN = /\*\*(.+?)\*\*|`(.+?)`|\*(.+?)\*|_(.+?)_|\[([^\]]+)\]\((\S+?)\)/g;

function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  INLINE_PATTERN.lastIndex = 0;

  while ((match = INLINE_PATTERN.exec(text))) {
    if (match.index > lastIndex) tokens.push({ type: "text", text: text.slice(lastIndex, match.index) });

    if (match[1] !== undefined) tokens.push({ type: "bold", text: match[1] });
    else if (match[2] !== undefined) tokens.push({ type: "code", text: match[2] });
    else if (match[3] !== undefined) tokens.push({ type: "italic", text: match[3] });
    else if (match[4] !== undefined) tokens.push({ type: "italic", text: match[4] });
    else if (match[5] !== undefined && match[6] !== undefined) {
      const href = match[6];
      if (isSafeHref(href)) tokens.push({ type: "link", text: match[5], href });
      else tokens.push({ type: "text", text: `${match[5]} (${href})` });
    }

    lastIndex = INLINE_PATTERN.lastIndex;
  }
  if (lastIndex < text.length) tokens.push({ type: "text", text: text.slice(lastIndex) });
  return tokens;
}

// ---------------------------------------------------------------------------
// React 렌더러 — dangerouslySetInnerHTML을 쓰지 않는다.
// ---------------------------------------------------------------------------

function renderInlineToReact(text: string, keyPrefix: string): ReactNode[] {
  return tokenizeInline(text).map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (token.type) {
      case "text":
        return token.text;
      case "bold":
        return createElement("strong", { key }, token.text);
      case "italic":
        return createElement("em", { key }, token.text);
      case "code":
        return createElement("code", { key, className: "rounded bg-muted px-1 py-0.5 text-xs" }, token.text);
      case "link":
        return createElement(
          "a",
          { key, href: token.href, target: "_blank", rel: "noopener noreferrer", className: "underline" },
          token.text,
        );
    }
  });
}

/** Markdown 원문을 안전한 React 엘리먼트 트리로 렌더링한다(미리보기/편집기 표시용). */
export function renderMarkdownToReact(markdown: string): ReactNode {
  const blocks = parseBlocks(markdown);
  if (blocks.length === 0) return null;

  return createElement(
    Fragment,
    null,
    blocks.map((block, index) => {
      const key = `block-${index}`;
      switch (block.type) {
        case "heading": {
          const tag = `h${block.level + 2}`; // 문서 내 상대 크기 — h1은 Report 제목이 쓴다.
          return createElement(tag, { key, className: "font-semibold" }, renderInlineToReact(block.text, key));
        }
        case "paragraph":
          return createElement("p", { key, className: "leading-relaxed" }, renderInlineToReact(block.text, key));
        case "list":
          return createElement(
            block.ordered ? "ol" : "ul",
            { key, className: block.ordered ? "list-decimal pl-5" : "list-disc pl-5" },
            block.items.map((item, itemIndex) =>
              createElement("li", { key: `${key}-${itemIndex}` }, renderInlineToReact(item, `${key}-${itemIndex}`)),
            ),
          );
        case "blockquote":
          return createElement(
            "blockquote",
            { key, className: "border-l-2 border-border pl-3 italic text-muted-foreground" },
            renderInlineToReact(block.text, key),
          );
        case "table":
          return createElement(
            "div",
            { key, className: "overflow-x-auto" },
            createElement(
              "table",
              { className: "w-full text-left text-sm" },
              createElement(
                "thead",
                null,
                createElement(
                  "tr",
                  null,
                  block.header.map((cell, cellIndex) =>
                    createElement("th", { key: cellIndex, className: "border-b border-border px-2 py-1 font-semibold" }, cell),
                  ),
                ),
              ),
              createElement(
                "tbody",
                null,
                block.rows.map((row, rowIndex) =>
                  createElement(
                    "tr",
                    { key: rowIndex },
                    row.map((cell, cellIndex) =>
                      createElement("td", { key: cellIndex, className: "border-b border-border px-2 py-1" }, cell),
                    ),
                  ),
                ),
              ),
            ),
          );
        case "hr":
          return createElement("hr", { key, className: "border-border" });
      }
    }),
  );
}

// ---------------------------------------------------------------------------
// HTML 문자열 렌더러 — export/print용. 원문은 escapeHtml을 거친 뒤에만 태그 안에 들어간다.
// ---------------------------------------------------------------------------

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInlineToHtml(text: string): string {
  return tokenizeInline(text)
    .map((token) => {
      switch (token.type) {
        case "text":
          return escapeHtml(token.text);
        case "bold":
          return `<strong>${escapeHtml(token.text)}</strong>`;
        case "italic":
          return `<em>${escapeHtml(token.text)}</em>`;
        case "code":
          return `<code>${escapeHtml(token.text)}</code>`;
        case "link":
          // href는 isSafeHref로 이미 http(s)만 허용됨. 속성 값 자체도 이스케이프한다.
          return `<a href="${escapeHtml(token.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(token.text)}</a>`;
      }
    })
    .join("");
}

/** Markdown 원문을 안전한 HTML 문자열로 렌더링한다(내보내기/인쇄용). */
export function renderMarkdownToHtml(markdown: string): string {
  const blocks = parseBlocks(markdown);
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return `<h${block.level + 2}>${renderInlineToHtml(block.text)}</h${block.level + 2}>`;
        case "paragraph":
          return `<p>${renderInlineToHtml(block.text)}</p>`;
        case "list": {
          const tag = block.ordered ? "ol" : "ul";
          const items = block.items.map((item) => `<li>${renderInlineToHtml(item)}</li>`).join("");
          return `<${tag}>${items}</${tag}>`;
        }
        case "blockquote":
          return `<blockquote>${renderInlineToHtml(block.text)}</blockquote>`;
        case "table": {
          const header = block.header.map((cell) => `<th>${renderInlineToHtml(cell)}</th>`).join("");
          const rows = block.rows
            .map((row) => `<tr>${row.map((cell) => `<td>${renderInlineToHtml(cell)}</td>`).join("")}</tr>`)
            .join("");
          return `<table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
        }
        case "hr":
          return "<hr />";
      }
    })
    .join("\n");
}
