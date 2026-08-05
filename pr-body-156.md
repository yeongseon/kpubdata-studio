이슈 #156 해결

Build Edit 화면 실장 — BuildSpec 편집/검증

- SpecEditor 컴포넌트: BuildSpec 편집 폼, Builder POST /validate 연동, 검증 오류 UI
- BuildEditPage: 기존 빌드 스펙 로드 및 편집
- BuildEditPage.test.tsx: 유닛 테스트
- 라우터 설정: /builds/:buildId/edit → BuildEditPage

완료 조건:
- [x] spec 편집 + validate 연동
- [x] 검증 오류 UI
- [x] 유닛 테스트