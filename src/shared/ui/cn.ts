/**
 * Tailwind 클래스 문자열을 조건부로 합성하는 경량 헬퍼.
 *
 * clsx 같은 외부 의존성 없이, falsy 값(`undefined`/`false`/`""`)을 걸러내고 공백으로
 * 이어 붙인다. 공통 컴포넌트에서 variant별 클래스를 조립할 때 사용한다.
 */
export type ClassValue = string | false | null | undefined;

/**
 * 전달된 클래스 값들 중 truthy인 것만 공백으로 이어 붙여 반환한다.
 *
 * @param values - 합성할 클래스 값 목록(거짓값은 무시).
 * @returns 합쳐진 className 문자열.
 */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
