# KPubData-Studio 기여 가이드 (CONTRIBUTING.md)

KPubData-Studio 프로젝트에 오신 것을 환영합니다! 이 프로젝트는 공공데이터를 시각화하고 관리하기 위한 웹 대시보드입니다. Next.js와 TypeScript를 사용해 멋진 화면을 만들어 보세요.

## 1. 환영 인사 및 프로젝트 소개

KPubData 패밀리 소개:
- **kpubdata**: 데이터 수집 엔진 (Python)
- **kpubdata-builder**: 데이터 가공 도구 (Python)
- **kpubdata-studio**: 데이터 시각화 및 웹 관리 도구 (Next.js)

이 레포지토리(`kpubdata-studio`)는 사용자에게 데이터를 보여주는 웹 애플리케이션입니다.

## 2. 개발 환경 설정 (Next.js)

### Step 1: Node.js 설치
Node.js 20 버전 이상이 필요합니다. [공식 사이트](https://nodejs.org/ko/)에서 설치하거나, `nvm` 도구를 추천합니다.

### Step 2: 프로젝트 Clone
GitHub에서 이 레포지토리를 **Fork**한 뒤, 터미널에서 명령어를 입력하세요.

```bash
git clone https://github.com/YOUR_USERNAME/kpubdata-studio.git
cd kpubdata-studio
```

### Step 3: 패키지 설치
모든 도구들을 설치합니다.

```bash
npm install
```

### Step 4: 개발 서버 실행 및 확인
아래 명령어를 통해 로컬 서버를 띄워보세요.

```bash
# 로컬 개발 서버 시작 (http://localhost:3000 에서 확인 가능)
npm run dev

# 코드 문법 및 규칙 검사 (린트)
npm run lint

# 타입 체크 (TypeScript 오류 확인)
npx tsc --noEmit

# 테스트 실행
npm test
```

## 3. 기여 시작하기 (Git 워크플로)

1. **이슈 선택**: GitHub Issues 탭에서 `good first issue` 라벨이 붙은 이슈를 골라보세요.
2. **브랜치 만들기**: 작업 내용에 맞춰 이름을 정합니다.
   - 예: `feat/issue-20-add-chart-component`
   - 예: `fix/issue-8-fix-layout`
3. **코드 수정**: 코드를 수정한 뒤 커밋 메시지를 작성합니다.
   - `feat: 데이터 시각화 차트 컴포넌트 추가`
   - `fix: 레이아웃 깨짐 현상 수정`
4. **Push**: 내 GitHub 레포지토리에 올립니다.
   - `git push origin feat/issue-20-add-chart-component`
5. **PR 보내기**: GitHub에서 "Pull Request"를 생성하세요.

## 4. 코딩 규칙 (Coding Convention)

- **TypeScript**: 모든 데이터와 컴포넌트에는 타입이 있어야 합니다. `any` 타입은 금지입니다.
- **함수형 컴포넌트**: 모든 UI 컴포넌트는 함수형(`function`)으로 작성해 주세요.
- **Tailwind CSS**: 디자인은 Tailwind CSS를 기본으로 사용합니다.

## 5. 첫 번째 페이지 추가하기 (Next.js App Router)

Next.js 15의 App Router 방식을 사용합니다.

1. `src/app/` 폴더 아래에 새로운 폴더를 만듭니다 (예: `src/app/dashboard/`).
2. 해당 폴더 안에 `page.tsx` 파일을 만듭니다.
3. React 컴포넌트를 작성하고 `export default`로 내보냅니다.
4. 브라우저에서 `http://localhost:3000/dashboard` 주소로 접속해 확인합니다.

## 6. PR 가이드 및 체크리스트

PR 제목은 `[#이슈번호] 간단한 설명` 형식을 지켜주세요.

**보내기 전 체크리스트:**
- [ ] `npm run lint` 결과가 깨끗한가요?
- [ ] `npx tsc --noEmit`에서 타입 오류가 없나요?
- [ ] `npm test`가 모두 통과하나요?

## 7. 도움 요청하기

잘 안 되는 것이나 궁금한 점이 있다면 언제든지 GitHub Issues에 남겨주세요! 모르는 것이 생기는 것은 당연합니다. 질문을 통해 지식을 나누는 것도 멋진 기여입니다. 함께 공부하며 만들어 가요!
