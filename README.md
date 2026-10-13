# Blogville

티스토리처럼 글을 쓰는 블로그에, 블로그 주인마다 집이 생기는 **도트(픽셀아트) 마을**을 더한 서비스입니다.
가입하면 블로그(`/@주소`)와 마을의 내 집이 함께 생기고, 글을 쓰고 출석하고 이웃과 소통하며 캐릭터와 집을 꾸밉니다.

- 운영: https://unqiuepcg.java21.net
- 요구사항 명세서, 기능별 spec·plan·tasks(`specs/`), 프로젝트 원칙(constitution): 문서 저장소 [handsomeguen/docs](https://github.com/handsomeguen/docs). 코드 주석의 `specs/0xx-...`는 그 저장소의 `docs/specs/` 폴더를 가리킵니다.
- 개발환경 설명: [docs/dev-environment.md](docs/dev-environment.md)
- 브랜치 전략(Git Flow)과 PR 규칙: [CONTRIBUTING.md](CONTRIBUTING.md)

## 주요 기능

| 영역 | 기능 |
|---|---|
| 회원 | 아이디·비밀번호 가입과 로그인(5번 틀리면 5분 잠금), 로그인 상태 유지, 비밀번호 바꾸기, 프로필 사진, 탈퇴, 소셜 로그인(네이버·카카오·구글, 키를 넣으면 켜짐) |
| 블로그 | 가입 때 블로그 자동 생성, 2단계 카테고리, 위젯(소개·카테고리·최근 글·최근 댓글·방문자 7일 막대), 블로그 둘러보기, RSS·sitemap·공유 미리보기 |
| 글 | Tiptap 에디터, 사진·파일 첨부와 붙여 넣기 재업로드, 태그, 공개·비공개, 임시저장, 대표 사진, 이전/다음 글, 같은 카테고리의 다른 글 |
| 소통 | 댓글·답글(수정, 🔒 비밀 댓글), 공감, 이웃·즐겨찾는 이웃, 이웃 새 글, 알림함 🔔, 방명록 |
| 마을 | 2.5D 도트 마을, 내 집과 이웃 집 자리, 광장·텔레포트, 우체통, 낚시터, 동물 농장, 내 정원, 친구 마을 놀러 가기, 걷는 이웃 |
| 성장·꾸미기 | 출석 보상, 포인트, 상점, 옷가게·미용실, 옷장, 집 가구·지붕 색, 성장 아이템 |
| 관리 | 사이트 관리자(`/admin`): 회원·글·댓글 관리, 공지 블로그 `/@notice` |

## 기술 스택

| 구분 | 사용 |
|---|---|
| 앱 | Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS 4 |
| 데이터 | PostgreSQL 16, Drizzle ORM (`drizzle/` 마이그레이션) |
| 인증 | better-auth (username 플러그인, 세션 쿠키), 소셜 로그인은 better-auth OAuth2 |
| 에디터 | Tiptap 3 |
| 마을 그림 | 코드로 그린 16×16 도트를 캔버스에 그림 (`src/lib/art`, `src/components/town`) |
| 시험 | Vitest(단위), Playwright(E2E) |
| 배포 | GitHub Actions → Docker 이미지 → SSH로 서버에 올려 블루·그린 무중단 교체 |

## 구조

```mermaid
flowchart LR
  U[브라우저] --> P["bv8400-proxy<br/>:8400"]
  P -->|지금 쪽| B["bv8400-blue :8401"]
  P -.->|배포 때 교체| G["bv8400-green :8402"]
  B --> DB[(PostgreSQL)]
  G --> DB
  B --> F[(uploads/)]
  G --> F
```

| 경로 | 내용 |
|---|---|
| `src/app/` | 화면(라우트)과 Server Action. `blog/[slug]`가 `/@주소` 블로그, `town`이 마을, `admin`이 관리자 |
| `src/server/` | DB를 읽고 쓰는 서버 로직 (`server-only`) |
| `src/lib/` | 화면과 서버가 같이 쓰는 순수 함수·규칙 (단위 테스트 대상) |
| `src/components/` | React 컴포넌트 |
| `src/db/` | Drizzle 스키마와 DB 연결 |
| `drizzle/` | DB 마이그레이션 SQL |
| `tests/` | `unit/` Vitest, `e2e/` Playwright, `perf/` 성능 측정 |
| `scripts/` | 시드, 관리자 만들기, 운영 마이그레이션, 프록시, 정리 작업 |
| `deploy/run.sh` | 서버에서 블루·그린 교체를 하는 스크립트 |
| `.github/workflows/` | `ci.yml` 검사, `deploy.yml` 배포, `status.yml` 서버 상태 보기 |

## 실행

Node.js 22, PostgreSQL 16이 필요합니다.

```bash
cp .env.example .env.local     # BETTER_AUTH_SECRET은 긴 무작위 값으로 바꾼다
docker compose up -d db        # 또는 로컬 PostgreSQL에 blogville DB를 만든다
npm install
npm run db:migrate
npm run db:seed                # (선택) demo / demo1234, /@demo
npm run admin:create           # (선택) .env.local의 ADMIN_USERNAME·ADMIN_PASSWORD로 관리자와 /@notice
npm run dev                    # http://localhost:3000
```

## 확인

```bash
npm run typecheck
npm run lint
npm test                       # Vitest 단위 테스트
npm run test:e2e               # Playwright E2E (개발 서버를 띄우거나 자동으로 띄운다)
npm run test:perf              # 글 1,000개 블로그 홈 응답 시간 (서버를 먼저 띄운다, 기준 1초)
```

미리 설치된 Chromium을 쓰려면 `PW_CHROMIUM_PATH=/경로/chrome npm run test:e2e`.
E2E는 `.env.local`의 DB에 고유한 아이디로 회원을 만들어 시험합니다.

## 첨부 파일

올린 사진·파일은 `storage/uploads/`(git 제외, `UPLOAD_DIR`로 바꿈)에 저장됩니다.
어느 글에도 붙지 않은 지 하루 지난 첨부는 정리 작업이 지웁니다. 같은 작업이 어제보다 오래된 조회 기록, 만료된 로그인 세션, 하루 넘게 지난 로그인 실패 기록(잠금 중인 것은 남김)도 지웁니다. 자동 실행 설정은 없어서 하루에 한 번 손으로 돌립니다.

```bash
npm run posts:cleanup -- --dry-run   # 지울 개수만
npm run posts:cleanup
```

## CI/CD

| 언제 | 무엇 | 파일 |
|---|---|---|
| `main`·`develop`으로 가는 PR, `develop`에 push | lint → 타입 검사 → 단위 테스트 → 빌드 | `.github/workflows/ci.yml` |
| `main`에 merge (release·hotfix) | 도커 이미지 → 서버에 올림 → 블루·그린 무중단 교체 | `.github/workflows/deploy.yml` |
| 손으로 (Actions → status) | 서버 컨테이너·포트·로그 보기 (아무것도 바꾸지 않음) | `.github/workflows/status.yml` |

E2E는 DB와 브라우저가 필요하고 전체가 약 25분 걸려서 CI에서 돌리지 않고, 기능을 만들 때 로컬에서 바뀐 부분의 시험을 돌립니다.

## 배포 (도커, 포트 8400)

`main`에 올라오면 GitHub Actions(`.github/workflows/deploy.yml`)가 도커 이미지를 만들어 서버에 올리고, SSH로 `deploy/run.sh`를 실행합니다. 손으로 돌리려면 Actions 탭의 **deploy → Run workflow**를 누릅니다.

- 저장소 시크릿: `SSH_ADDRESS`, `SSH_PORT`, `SSH_ID`, `SSH_PASSWORD`, `DB_ADDRESS`, `DB_PORT`, `DB_NAME`, `DB_SCHEMA`, `DB_USERNAME`, `DB_PASSWORD`, (선택) `APP_URL`, (선택) `ADMIN_USERNAME`·`ADMIN_PASSWORD`(있으면 배포 때 관리자 계정과 공지 블로그 `/@notice`를 만들거나 비밀번호를 갱신, 비밀번호 12~64자)
- `APP_URL`이 없으면 `http://SSH_ADDRESS:8400`을 로그인 주소로 씁니다. 도메인·https를 붙이면 `APP_URL`을 그 주소로 등록합니다.
- 서버에는 docker가 있어야 하고, SSH 계정이 docker를 쓸 수 있어야 합니다(docker 그룹 또는 비밀번호 없는 sudo).
- 컨테이너는 시작할 때 `scripts/migrate.mjs`(drizzle 마이그레이터, 실패하면 DB 오류를 그대로 보여 줌)로 DB를 맞춘 뒤 `next start -p 8400`으로 뜹니다.
- **무중단(블루·그린) 배포**: 8400번 포트는 작은 프록시(`bv8400-proxy`, `scripts/proxy.mjs`)가 받고, 앱은 `bv8400-blue`(8401)·`bv8400-green`(8402) 중 하나가 서비스합니다. 새 버전은 쉬고 있는 쪽에 띄워 응답을 확인한 뒤 `~/blogville/state/active-port`를 바꿔 넘기고, 이전 버전은 15초 뒤 멈춥니다. 새 버전이 뜨지 않으면 이전 버전이 그대로 서비스합니다. 서버의 도커를 다른 사람도 같이 쓰므로 컨테이너·이미지 이름은 `bv8400-`로 시작하고, 스크립트는 자기 이미지로 만든 컨테이너만 지웁니다. 프록시는 처음 한 번만 띄우므로 `scripts/proxy.mjs`를 고쳤다면 서버에서 `docker rm -f bv8400-proxy` 뒤 다시 배포합니다.
- 서버의 `~/blogville/`에 로그인 비밀키(`auth-secret`, 처음 한 번 생성), 환경 변수(`app.env`), 올린 파일(`uploads/`)이 남습니다.
- `DB_SCHEMA`가 `public`이 아니면 `scripts/migrate.mjs`가 SQL의 `"public".`을 그 스키마로 바꿔 적용합니다. 스키마를 새로 만들지 않으므로 미리 있는 스키마를 씁니다.
