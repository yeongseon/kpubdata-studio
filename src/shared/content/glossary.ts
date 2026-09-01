export const glossary = {
  dataset: "KPubData에서 하나의 단위로 관리하는 빌드 결과 데이터입니다.",
  build: "선택한 source와 설정에 따라 데이터를 수집·처리하는 작업입니다.",
  run: "Build가 실제로 한 번 실행된 기록입니다. 같은 Dataset에도 여러 Run이 생길 수 있습니다.",
  buildSpec: "어떤 source를 가져오고 어떻게 처리할지 Builder에 전달하는 이식 가능한 실행 명세입니다.",
  provider: "Builder가 연결할 수 있는 외부 데이터 공급처 또는 API입니다.",
  credential: "Provider에서 데이터를 가져올 때 필요한 API Key 등의 인증 정보입니다.",
  preview: "Build 전에 가져올 데이터의 일부와 검증 결과를 미리 확인하는 기능입니다.",
  bronze: "수집한 원본 데이터를 가능한 그대로 보존하는 단계입니다.",
  silver: "Bronze 데이터를 정제·표준화해 분석과 품질 확인에 사용할 수 있게 만든 단계입니다.",
  gold: "특정 사용 목적에 맞게 가공한 최종 데이터 단계입니다.",
  quality: "Builder가 실제로 평가한 데이터 품질 규칙의 결과입니다.",
  schemaDrift: "이전과 비교해 컬럼 추가·삭제·타입 변경 등 데이터 구조가 달라진 상태입니다.",
  evidence: "Kubi 또는 Report가 참고한 Builder의 Dataset·Run·Quality 등의 근거입니다.",
  context: "Kubi가 현재 질문을 해석할 때 사용하는 Dataset·Run·Source·Stage 범위입니다.",
  generatedSql: "Kubi가 선택한 Silver 또는 Gold schema를 바탕으로 생성한 조회 SQL입니다.",
  artifact: "Build 실행으로 생성된 데이터 파일 또는 결과물입니다.",
  manifest: "Run과 생성된 산출물에 대한 메타데이터 기록입니다.",
  readiness: "Publish 전에 필요한 조건을 Builder가 확인한 결과입니다.",
} as const;

export type GlossaryKey = keyof typeof glossary;
