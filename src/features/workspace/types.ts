/**
 * Saved BuildSpec 데이터 모델 (#260).
 *
 * Saved BuildSpec은 사용자가 명시적으로 "저장" 액션을 눌러 이름 붙여 보관하는 자산이다.
 * 이는 다음 3가지와 전부 다른 개념이므로 섞지 않는다:
 * - `build-spec/draftStorage.ts`의 Auto Draft: 아직 실행 안 한, 편집 중인 임시 단일 초안.
 * - `build-spec/specStore.ts`의 run_id별 spec 캐시: Studio가 실행시킨 run의 spec을
 *   기억해 둔 것일 뿐 사용자가 "저장"한 게 아니며, 상한 초과 시 자동 삭제된다.
 * - run snapshot(Builder #487, 아직 미구현): Builder 서버가 실제 실행에 쓴 canonical spec.
 *   Saved BuildSpec은 이 정본을 대체하지 않는다 — 브라우저 로컬 캐시일 뿐이다.
 */
import type { BuildSpec } from "@/shared/lib/types";

/**
 * 이 spec을 마지막으로 저장한 시점의 검증 결과.
 * BuildSpec을 수정하지 않고 다시 저장(덮어쓰기)한 경우에만 최신 상태를 반영한다 — 저장
 * 시점의 spec과 다른 내용에 대한 검증 결과를 "통과"로 표시하지 않기 위해, 이 값은 항상
 * 그 저장 시점에 실제로 확인된 상태만 담는다.
 */
export type SavedSpecValidationStatus = "validated_pass" | "validated_fail" | "not_validated";

export interface SavedSpecValidation {
  status: SavedSpecValidationStatus;
  errors: string[];
}

export interface SavedBuildSpec {
  id: string;
  name: string;
  /** credential로 보이는 값은 저장 전에 redactSecrets()로 마스킹된 상태로만 들어온다. */
  spec: BuildSpec;
  validation: SavedSpecValidation;
  createdAt: string;
  updatedAt: string;
  /** 저장 형식 버전(개별 항목 단위, 저장소 봉투 버전과 별개). */
  version: number;
  /** 같은 브라우저의 다른 탭에서 먼저 저장했는지 감지하기 위한 낙관적 동시성 카운터. */
  revision: number;
}

/** Saved BuildSpec 목록 화면에 필요한 요약(이름/provider/output/validation). */
export interface SavedBuildSpecSummary {
  id: string;
  name: string;
  provider: string;
  outputPath: string;
  validationStatus: SavedSpecValidationStatus;
  updatedAt: string;
}

export const SAVED_SPEC_VERSION = 1;
