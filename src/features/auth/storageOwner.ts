/**
 * 사용자별 localStorage 네임스페이스 (#293).
 *
 * 같은 브라우저를 여러 사람이 쓸 수 있어 Saved BuildSpec/Report/초안 같은
 * 로컬 저장 작업도 로그인한 사용자별로 분리한다. 미로그인 세션은 기존
 * (무소속) 키를 그대로 쓴다 — 데모 데이터 정책: 로그인 전 만든 항목은
 * 이관하지 않고 anonymous 버킷에 그대로 남는다(#293 정책).
 *
 * 소유자 판별은 현재 mock auth의 email(정규화: trim+lowercase)을 쓴다.
 * ADR 0015(builder #515) 이후 실 IdP가 붙으면 여기 한 곳만 안정 식별자
 * (OIDC sub 기반 owner)로 교체하면 저장 키 정책 전체가 따라온다.
 */
import { useAuthStore } from "./store";

const ANONYMOUS_OWNER = "anonymous";

/** 로그인 사용자의 저장 소유자 키. 미로그인이면 "anonymous". */
export function resolveStorageOwnerKey(): string {
  const { email } = useAuthStore.getState();
  if (!email || !email.trim()) return ANONYMOUS_OWNER;
  return `user:${email.trim().toLowerCase()}`;
}

/** 로그인 여부. 미로그인 저장은 기존 무소속 키를 쓴다(하위 호환). */
export function isOwnedStorageSession(): boolean {
  return resolveStorageOwnerKey() !== ANONYMOUS_OWNER;
}

/**
 * 저장 키를 소유자로 네임스페이싱한다.
 * 미로그인이면 baseKey를 그대로 돌려준다(기존 데이터 무손실).
 */
export function ownedStorageKey(baseKey: string): string {
  if (!isOwnedStorageSession()) return baseKey;
  return `${baseKey}:${resolveStorageOwnerKey()}`;
}
