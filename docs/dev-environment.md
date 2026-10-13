# 개발환경

Blogville을 내 컴퓨터에서 띄우고, 고치고, 시험하는 방법입니다. 운영 배포는 [README의 배포](../README.md#배포-도커-포트-8400), 브랜치 규칙은 [CONTRIBUTING.md](../CONTRIBUTING.md)를 봅니다.

## 필요한 것

| 도구 | 버전 | 비고 |
|---|---|---|
| Node.js | 22 | 운영 이미지와 CI도 22 |
| PostgreSQL | 16 이상 | Docker가 있으면 `docker compose up -d db`, 맥은 `brew install postgresql@17` |
| Git | 아무 최신 | |
| Chromium | Playwright용 | `npx playwright install chromium` 또는 미리 깔린 브라우저를 `PW_CHROMIUM_PATH`로 지정 |

에디터는 무엇이든 되지만 VS Code라면 ESLint, Tailwind CSS IntelliSense 확장을 권합니다. 코드 모양은 ESLint(`eslint.config.mjs`)가 정합니다.

## 처음 한 번

```bash
git clone https://github.com/handsomeguen/blogville.git
cd blogville
git checkout develop                 # 개발은 develop에서 시작 (CONTRIBUTING.md)
cp .env.example .env.local           # 아래 환경 변수 표를 보고 채운다
docker compose up -d db              # Docker가 없으면 로컬 PostgreSQL에 blog/blog 계정과 blogville DB를 만든다
npm install
npm run db:migrate                   # drizzle/의 마이그레이션 적용
npm run db:seed                      # (선택) 예시 회원 demo / demo1234, 블로그 /@demo
npm run admin:create                 # (선택) 관리자와 공지 블로그 /@notice
npm run dev                          # http://localhost:3000
```

맥에서 Docker 없이 쓸 때:

```bash
brew install postgresql@17 && brew services start postgresql@17
psql postgres -c "create role blog login password 'blog' createdb"
psql postgres -c "create database blogville owner blog"
```

## 환경 변수 (`.env.local`)

| 이름 | 필수 | 뜻 |
|---|---|---|
| `DATABASE_URL` | ✓ | `postgres://blog:blog@localhost:5432/blogville`. 다른 스키마를 쓰려면 `?search_path=스키마` |
| `BETTER_AUTH_SECRET` | ✓ | 로그인 세션 서명 키. 긴 무작위 값 (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | ✓ | 사이트 주소. 로컬은 `http://localhost:3000` |
| `UPLOAD_DIR` | | 올린 파일 폴더. 기본 `storage/uploads` (git 제외) |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | | `npm run admin:create`가 쓰는 관리자 아이디(영문 소문자·숫자·_ 4~20자)와 비밀번호(12~64자) |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | | 네이버 로그인. 없으면 버튼이 안 보임 |
| `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET` | | 카카오 로그인. 없으면 버튼이 안 보임 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | | 구글 로그인. 없으면 버튼이 안 보임 |

## 자주 쓰는 명령

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 (코드가 바뀌면 바로 반영) |
| `npm run lint` / `npm run typecheck` | ESLint / 타입 검사 |
| `npm test` | Vitest 단위 테스트 (`tests/unit`, DB 필요 없음) |
| `npm run test:e2e` | Playwright E2E (`tests/e2e`, `.env.local`의 DB와 개발 서버 사용) |
| `npm run db:generate` | `src/db/schema.ts`를 바꾼 뒤 마이그레이션 SQL 만들기 |
| `npm run db:migrate` | 마이그레이션 적용 |
| `npm run posts:cleanup` | 오래된 미첨부 파일·조회 기록·세션 정리 (`-- --dry-run`으로 개수만) |

## 기능 하나를 만드는 순서

1. `develop`에서 `feature/<이름>` 브랜치를 만든다.
2. 문서 저장소 [handsomeguen/docs](https://github.com/handsomeguen/docs)에 spec·plan·tasks를 쓴다 (Spec Kit: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks`).
3. DB가 바뀌면 `src/db/schema.ts`를 고치고 `npm run db:generate`로 `drizzle/` SQL을 만든다.
4. 규칙은 `src/lib/`의 순수 함수로 두고 `tests/unit`에서 시험, 화면 흐름은 `tests/e2e`에서 시험한다.
5. lint·타입·단위·바뀐 E2E를 통과시킨 뒤 `develop` 대상 PR을 연다. CI가 같은 검사를 다시 돌린다.

## 알아 두면 좋은 것

- E2E 전체는 약 25분 걸리고 컴퓨터가 바쁘면 시간 초과가 날 수 있습니다. 실패한 파일만 `--workers=2`로 다시 돌려 봅니다.
- 브랜치를 바꾸거나 `npm run build`를 한 뒤에는 개발 서버를 끄고 `.next`를 지운 뒤 다시 띄웁니다. 아니면 옛 코드로 화면이 뜰 수 있습니다.
- 시험은 매번 고유한 아이디로 회원을 만들어 `.env.local`의 DB에 넣습니다. 보여 주기용 DB와 나눠 쓰려면 `DATABASE_URL`만 바꿉니다.
- 마을 그림은 이미지 파일이 아니라 `src/lib/art`의 코드로 그린 16×16 도트입니다.
- 서버 전용 코드는 `src/server/`에 두고 맨 위에 `import "server-only"`를 씁니다.
