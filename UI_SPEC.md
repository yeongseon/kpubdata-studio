# UI Spec — KPubData Studio

## 1. Screen Navigation Flow (화면 이동 흐름)

```mermaid
flowchart TD
    Home[Home / Dashboard] -->|Create New| Editor[Build Editor]
    Home -->|View Recent| Run[Build Run / History]
    Editor -->|Validate/Run| Run
    Run -->|Success| Artifacts[Artifact Viewer]
    Artifacts -->|Share| Publish[Publish Page]
    Run -->|Failure/Edit| Editor
    Publish --> Home
```

## 2. Primary Screens & Wireframes

### [Home] 대시보드
빌드 목록을 한눈에 보고 빠르게 작업을 시작하는 곳입니다.

**Wireframe:**
```text
+--------------------------------------------------+
| [Header] KPubData Studio          [User Profile] |
+--------------------------------------------------+
| [Sidebar]    |                                   |
| - Dashboard  |  [ + New Build ] [ Quick Actions ]|
| - Builds     |                                   |
| - Settings   |  Recent Build Runs                |
|              |  +-----------------------------+  |
|              |  | ID | Status | Time | Action |  |
|              |  |----|--------|------|--------|  |
|              |  | 01 | Success| 2min | View   |  |
|              |  +-----------------------------+  |
+--------------+-----------------------------------+
```
- **Interactions**:
  - `[ + New Build ]`: 새로운 빌드 작성 페이지(`/builds/new`)로 이동합니다.
  - `[ View ]`: 해당 빌드의 상세 결과 페이지로 이동합니다.
- **APIs**: `GET /builds` (최근 빌드 목록 조회)

---

### [Build Editor] 빌드 편집기
빌드 어떤 데이터를 어떻게 수집할지 기획서를 작성하는 곳입니다.

```mermaid
graph TD
    subgraph EditorPage [Build Editor Page]
        Header[Editor Header: Validate/Run Buttons]
        subgraph MainContent [Main Configuration Area]
            direction LR
            SourceArea[1. Source: Provider/Dataset/Params]
            ExportArea[2. Export Config: Format/Target]
        end
        subgraph FeedbackArea [Feedback Panels]
            direction LR
            PreviewPanel[3. Preview Panel: Data Table]
            ValidationPanel[4. Validation Panel: Errors/Warnings]
        end
        Header --> MainContent
        MainContent --> FeedbackArea
    end
```

**Wireframe:**
```text
+--------------------------------------------------+
| < Back to List         [ Validate ] [ Run Build ]|
+--------------------------------------------------+
| [1. Source]          | [3. Preview Panel]        |
| + Provider Choice    |                           |
| + Dataset Choice     | (Sample Data Table)       |
| + Parameters Input   |                           |
|                      |                           |
| [2. Export Config]   | [4. Validation Panel]     |
| + Format (JSON/MD..) |                           |
| + Target (HF/Local)  | (Warnings/Errors List)    |
+----------------------+---------------------------+
```
- **Interactions**:
  - `Provider/Dataset Choice`: 선택 시 관련 파라미터 입력란이 자동으로 나타납니다.
  - `[ Validate ]`: 현재 설정이 올바른지 확인합니다. (Validation Panel 업데이트)
  - `[ Run Build ]`: 검증이 완료된 상태에서만 활성화되며, 누르면 실제 빌드가 시작됩니다.
- **APIs**:
  - `GET /providers`: 제공 기관 목록 조회
  - `POST /validate`: 설정값 검증
  - `POST /preview`: 샘플 데이터 미리보기

---

### [Build Run] 빌드 실행 화면
빌드가 진행되는 과정을 실시간으로 지켜보는 곳입니다.

**Wireframe:**
```text
+--------------------------------------------------+
| Build #123 - Running...           [ Cancel Build ]|
+--------------------------------------------------+
| Status: [====------] 40%                         |
|                                                  |
| [ Execution Logs ]                               |
| 10:00:01 - Fetching data from data.go.kr...      |
| 10:00:05 - Normalizing records...                |
| 10:00:08 - Converting to Markdown...             |
+--------------------------------------------------+
```
- **Interactions**:
  - `[ Cancel Build ]`: 실행 중인 작업을 즉시 중단합니다.
- **APIs**: `GET /builds/:id/status` (상태 주기적 확인), `DELETE /builds/:id` (취소)

---

## 3. API Call Map per Screen (화면별 API 호출 지도)

```mermaid
graph LR
    subgraph Screens [Studio 화면]
        HomeS[Home Dashboard]
        EditorS[Build Editor]
        RunS[Build Run Tracking]
        ArtifactsS[Artifact Viewer]
        PublishS[Publish Page]
    end

    subgraph APIEndpoints [Builder API 엔드포인트]
        GET_Builds[GET /builds]
        POST_Validate[POST /validate]
        POST_Preview[POST /preview]
        POST_Run[POST /builds/run]
        GET_Status[GET /builds/:id/status]
        GET_Manifest[GET /builds/:id/manifest]
        POST_Publish[POST /builds/:id/publish]
    end

    HomeS --> GET_Builds
    EditorS --> POST_Validate
    EditorS --> POST_Preview
    EditorS --> POST_Run
    RunS --> GET_Status
    ArtifactsS --> GET_Manifest
    PublishS --> POST_Publish
```

## 4. 에러 및 예외 상태 처리 (Error Handling)

- **Loading State**: 데이터를 불러오는 동안 스피너(Spinner)나 스켈레톤(Skeleton) UI를 보여줍니다.
- **Empty State**: 목록이 없을 때 "아직 생성된 빌드가 없습니다. 첫 빌드를 만들어보세요!" 라는 안내 문구를 보여줍니다.
- **Error State**:
  - **Network Error**: "서버와 연결이 끊겼습니다. 인터넷 연결을 확인해주세요."
  - **Validation Error**: 입력창 아래에 붉은색 글씨로 구체적인 오류 원인을 적어줍니다. (예: "날짜 형식은 YYYYMMDD여야 합니다.")

---

## 3. 화면별 명세 요약

| 화면명 | 주요 기능 | 호출 API |
| :--- | :--- | :--- |
| Home | 전체 현황 파악 | `listBuilds` |
| Editor | 빌드 설정 기획 및 검증 | `validateSpec`, `previewBuild` |
| Run | 실시간 빌드 추적 | `getBuildStatus`, `cancelBuild` |
| Artifacts | 결과물 확인 및 다운로드 | `listArtifacts`, `readManifest` |
| Publish | 외부 저장소 배포 | `triggerPublish` |

---

## 관련 문서

### 이 저장소 내 문서
| 문서 | 설명 |
| :--- | :--- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 시스템 아키텍처 설계 |
| [STATE_MODEL.md](./STATE_MODEL.md) | 상태 관리 모델 |
| [USER_FLOWS.md](./USER_FLOWS.md) | 사용자 흐름도 |
| [INFORMATION_ARCHITECTURE.md](./INFORMATION_ARCHITECTURE.md) | 정보 구조 설계 |

### KPubData Product Family
| 저장소 | 문서 | 설명 |
| :--- | :--- | :--- |
| [kpubdata](https://github.com/yeongseon/kpubdata) | [ARCHITECTURE.md](https://github.com/yeongseon/kpubdata/blob/main/ARCHITECTURE.md) | Core 아키텍처 |
| [kpubdata-builder](https://github.com/yeongseon/kpubdata-builder) | [ARCHITECTURE.md](https://github.com/yeongseon/kpubdata-builder/blob/main/ARCHITECTURE.md) | Builder 아키텍처 |
