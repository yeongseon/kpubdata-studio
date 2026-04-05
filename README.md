# KPubData Studio — Korea Public Data Studio

**KPubData Studio (Korea Public Data Studio)** is the visual interface for
the KPubData product family.

It helps users configure, preview, run, and inspect
[`kpubdata-builder`](https://github.com/yeongseon/kpubdata-builder) workflows
without hand-editing configuration files.

## Product family

| Package | Role |
|---|---|
| [`kpubdata`](https://github.com/yeongseon/kpubdata) | Korea Public Data access + parsing + normalization core |
| [`kpubdata-builder`](https://github.com/yeongseon/kpubdata-builder) | Dataset assembly + export pipeline |
| [`kpubdata-studio`](https://github.com/yeongseon/kpubdata-studio) | Visual interface for authoring and running builds |

## 📖 문서 가이드 (Document Guide)

### 핵심 설계
| 문서 | 설명 |
| :--- | :--- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Studio 시스템 아키텍처 및 설계 원칙 |
| [STATE_MODEL.md](./STATE_MODEL.md) | 빌드 상태 전이 및 UI 상태 관리 모델 |
| [UI_SPEC.md](./UI_SPEC.md) | 사용자 인터페이스 컴포넌트 및 디자인 규격 |
| [USER_FLOWS.md](./USER_FLOWS.md) | 주요 사용자 시나리오 및 화면 흐름도 |
| [INFORMATION_ARCHITECTURE.md](./INFORMATION_ARCHITECTURE.md) | 메뉴 구조 및 데이터 계층 구조 |
| [API_CONTRACT.md](./API_CONTRACT.md) | Builder API와의 통신 규약 및 데이터 모델 |

### 개발 가이드
| 문서 | 설명 |
| :--- | :--- |
| [AGENTS.md](./AGENTS.md) | AI 에이전트 협업 가이드 및 프롬프트 지침 |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 프로젝트 기여 방법 및 개발 환경 설정 |

### 프로젝트 관리
| 문서 | 설명 |
| :--- | :--- |
| [PRD.md](./PRD.md) | 제품 요구사항 정의 및 목표 |
| [ROADMAP.md](./ROADMAP.md) | 향후 개발 계획 및 마일스톤 |

### 자세한 참고
| 문서 | 설명 |
| :--- | :--- |
| [docs/adrs/0001-studio-as-control-surface.md](./docs/adrs/0001-studio-as-control-surface.md) | 결정 기록: Studio를 제어 인터페이스로 정의 |

---

## 📚 관련 문서

### 이 저장소 내 문서
| 문서 | 설명 |
| :--- | :--- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 시스템 아키텍처 설계 |
| [STATE_MODEL.md](./STATE_MODEL.md) | 상태 관리 모델 |
| [UI_SPEC.md](./UI_SPEC.md) | UI 디자인 규격 |
| [USER_FLOWS.md](./USER_FLOWS.md) | 사용자 흐름도 |
| [INFORMATION_ARCHITECTURE.md](./INFORMATION_ARCHITECTURE.md) | 정보 구조 설계 |
| [API_CONTRACT.md](./API_CONTRACT.md) | API 연동 규약 |
| [AGENTS.md](./AGENTS.md) | 에이전트 가이드 |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 기여 가이드 |
| [PRD.md](./PRD.md) | 제품 요구사항 |
| [ROADMAP.md](./ROADMAP.md) | 개발 로드맵 |

### KPubData Product Family
| 저장소 | 문서 | 설명 |
| :--- | :--- | :--- |
| [kpubdata](https://github.com/yeongseon/kpubdata) | [ARCHITECTURE.md](https://github.com/yeongseon/kpubdata/blob/main/ARCHITECTURE.md) | Core 아키텍처 |
| [kpubdata-builder](https://github.com/yeongseon/kpubdata-builder) | [ARCHITECTURE.md](https://github.com/yeongseon/kpubdata-builder/blob/master/ARCHITECTURE.md) | Builder 아키텍처 |

