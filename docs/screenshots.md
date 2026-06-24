# 화면 스크린샷 (Screenshots)

KPubData Studio 주요 화면의 스크린샷 모음입니다.
각 화면은 라이트 (Light) 및 다크 (Dark) 테마로 자동 캡처됩니다.

스크린샷은 아래 명령어로 언제든지 재생성할 수 있습니다.

```bash
npx playwright install chromium   # 최초 1회만
npm run screenshots
```

---

## 대시보드 (Dashboard)

빌드 상태 요약, 최근 빌드 목록, 빠른 시작 진입점을 제공하는 메인 화면입니다.

=== "라이트 테마 (Light)"
    ![대시보드 - 라이트 테마 (Dashboard Light)](assets/screenshots/dashboard-light.png)

=== "다크 테마 (Dark)"
    ![대시보드 - 다크 테마 (Dashboard Dark)](assets/screenshots/dashboard-dark.png)

---

## 빌드 목록 (Builds)

전체 빌드와 대기·실행·완료 상태의 실행 이력을 확인하는 화면입니다.
제목 검색과 시작 시각 정렬 기능을 제공합니다.

=== "라이트 테마 (Light)"
    ![빌드 목록 - 라이트 테마 (Builds Light)](assets/screenshots/builds-light.png)

=== "다크 테마 (Dark)"
    ![빌드 목록 - 다크 테마 (Builds Dark)](assets/screenshots/builds-dark.png)

---

## 새 빌드 만들기 (New Build)

단계별 마법사 (Wizard) 방식으로 빌드 스펙을 작성하는 화면입니다.
템플릿 선택 → 기본 정보 → 데이터 소스 → 파라미터 → 미리보기 → 출력 형식 → 검증·실행 순서로 진행합니다.

=== "라이트 테마 (Light)"
    ![새 빌드 만들기 - 라이트 테마 (New Build Light)](assets/screenshots/new-build-light.png)

=== "다크 테마 (Dark)"
    ![새 빌드 만들기 - 다크 테마 (New Build Dark)](assets/screenshots/new-build-dark.png)

---

## 결과물 (Artifacts)

빌드가 완료되면 생성된 파일, 매니페스트 (Manifest), 다운로드 링크를 확인하는 화면입니다.

=== "라이트 테마 (Light)"
    ![결과물 - 라이트 테마 (Artifacts Light)](assets/screenshots/artifacts-light.png)

=== "다크 테마 (Dark)"
    ![결과물 - 다크 테마 (Artifacts Dark)](assets/screenshots/artifacts-dark.png)

---

## 설정 (Settings)

Studio 환경설정 화면입니다. Builder API 연동 등 고급 설정을 관리합니다.

=== "라이트 테마 (Light)"
    ![설정 - 라이트 테마 (Settings Light)](assets/screenshots/settings-light.png)

=== "다크 테마 (Dark)"
    ![설정 - 다크 테마 (Settings Dark)](assets/screenshots/settings-dark.png)

---

!!! info "스크린샷 자동 생성"
    위 이미지는 `scripts/capture-screenshots.mjs` 스크립트로 자동 캡처됩니다.
    Playwright/Chromium 을 사용하며, 1280×800 해상도 데스크톱 뷰포트를 기준으로 촬영합니다.
    앱을 MOCK 모드 (오프라인) 로 실행하므로 실제 Builder API 서버가 필요하지 않습니다.
