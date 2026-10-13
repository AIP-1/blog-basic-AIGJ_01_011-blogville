# Blogville

티스토리 같은 블로그 서비스 **Blogville**의 소스 코드 저장소입니다 (Next.js 16 · PostgreSQL · Drizzle).

요구사항 명세서, 기능별 spec·plan·tasks(`specs/`), 프로젝트 원칙(constitution)은 문서 저장소 [handsomeguen/docs](https://github.com/handsomeguen/docs)에 있습니다. 코드 주석의 `specs/0xx-...`는 그 저장소의 `docs/specs/` 폴더를 가리킵니다.

| 경로 | 내용 |
|---|---|
| `src/` | Next.js 앱 (화면, Server Action, 서버 로직) |
| `drizzle/` | DB 마이그레이션 |
| `tests/` | Vitest 단위 테스트, Playwright E2E, 성능 측정 |
| `scripts/` | 시드, 관리자 만들기, 정리 작업 |

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
