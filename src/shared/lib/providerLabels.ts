/**
 * Builder `/catalog` provider 코드의 한글 표시명.
 *
 * NewBuildPage(#29)와 Discover(#249)가 같은 provider 목록을 서로 다른 화면에서
 * 보여주므로, 라벨 매핑을 여기 하나로 모아 중복 정의를 피한다.
 */
export const PROVIDER_LABELS: Readonly<Record<string, string>> = {
  bok: "한국은행 ECOS (BOK)",
  datago: "공공데이터포털 (data.go.kr)",
  kosis: "통계청 KOSIS",
  krx: "한국거래소 (KRX)",
  law: "국가법령정보센터",
  localdata: "지역정보포털 (LocalData)",
  lofin: "지방재정365 (LOFIN)",
  semas: "소상공인시장진흥공단 (SEMAS)",
  seoul: "서울 열린데이터광장",
  sgis: "통계지리정보서비스 (SGIS)",
};

/** 알려진 provider 코드는 한글 라벨로, 모르는 코드는 원문 그대로 보여준다. */
export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}
