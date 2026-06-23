/**
 * 두 BuildSpec 간의 필드 단위 차이를 계산한다 (#13, v0.3 MVP).
 *
 * 스펙을 path→value 맵으로 평탄화한 뒤 비교해, 추가/삭제/변경된 경로 목록을 만든다.
 * 실행 이력 비교(#12)나 편집 전/후 비교 UI에서 재사용한다.
 */
import type { BuildSpec } from "@/shared/lib/types";

export type SpecChangeKind = "added" | "removed" | "changed";

export interface SpecChange {
  /** 변경된 필드 경로(예: `sources[0].dataset`) */
  path: string;
  /** 이전 값(removed/changed) */
  before?: string;
  /** 이후 값(added/changed) */
  after?: string;
  /** 변경 종류 */
  kind: SpecChangeKind;
}

/** BuildSpec을 path→value 평탄화 맵으로 만든다. */
function flatten(spec: BuildSpec): Map<string, string> {
  const map = new Map<string, string>();
  map.set("datasetId", spec.datasetId);
  map.set("title", spec.title);
  map.set("description", spec.description);
  spec.sources.forEach((source, i) => {
    map.set(`sources[${i}].provider`, source.provider);
    map.set(`sources[${i}].dataset`, source.dataset);
    if (source.alias) map.set(`sources[${i}].alias`, source.alias);
    for (const [key, value] of Object.entries(source.params)) {
      map.set(`sources[${i}].params.${key}`, String(value));
    }
  });
  spec.exports.forEach((target, i) => {
    map.set(`exports[${i}].format`, target.format);
    for (const [key, value] of Object.entries(target.options ?? {})) {
      map.set(`exports[${i}].options.${key}`, String(value));
    }
  });
  for (const [key, value] of Object.entries(spec.metadata)) {
    map.set(`metadata.${key}`, String(value));
  }
  return map;
}

/**
 * 두 BuildSpec의 필드 단위 차이를 경로순으로 반환한다.
 *
 * @param before - 이전 스펙.
 * @param after - 이후 스펙.
 * @returns 변경 목록(경로 오름차순). 동일하면 빈 배열.
 */
export function diffSpecs(before: BuildSpec, after: BuildSpec): SpecChange[] {
  const a = flatten(before);
  const b = flatten(after);
  const paths = [...new Set([...a.keys(), ...b.keys()])].sort();
  const changes: SpecChange[] = [];
  for (const path of paths) {
    const x = a.get(path);
    const y = b.get(path);
    if (x === y) continue;
    if (x === undefined) changes.push({ path, after: y, kind: "added" });
    else if (y === undefined) changes.push({ path, before: x, kind: "removed" });
    else changes.push({ path, before: x, after: y, kind: "changed" });
  }
  return changes;
}
